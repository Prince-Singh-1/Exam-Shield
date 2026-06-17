import { Router } from 'express';
import { z } from 'zod';
import { ExamMode, Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate, authorize } from '../middleware/auth';
import { generateBalancedSets } from '../services/setGenerator';

const router = Router();

router.use(authenticate);

async function loadPublicQuestions(questionIds: string[]) {
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, text: true, type: true, options: true }, // no correctKey
  });
  const byId = new Map(questions.map((q) => [q.id, q]));
  const ordered = questionIds.map((id) => byId.get(id)).filter(Boolean);
  if (ordered.length !== questionIds.length) {
    throw new Error('Question bank changed while preparing this paper. Try again.');
  }
  return ordered;
}

/**
 * Student starts an ONLINE exam. The paper is assembled JUST NOW from the bank,
 * so questions stay secret until the moment the student begins. Correct answers
 * are never sent to the client.
 */
router.post('/:examId/start', authorize(Role.STUDENT), async (req, res) => {
  const exam = await prisma.exam.findUnique({ where: { id: req.params.examId } });
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  if (exam.mode !== ExamMode.ONLINE) {
    return res.status(400).json({ error: 'Only online exams can be taken in-browser' });
  }

  const existing = await prisma.attempt.findFirst({
    where: { examId: exam.id, studentId: req.user!.sub, submittedAt: null },
  });
  if (existing) {
    const saved = existing.answers as { questionIds?: string[] } | null;
    if (Array.isArray(saved?.questionIds) && saved.questionIds.length > 0) {
      try {
        const questions = await loadPublicQuestions(saved.questionIds);
        return res.json({
          attemptId: existing.id,
          durationMinutes: exam.durationMinutes,
          instructions: exam.instructions,
          questions,
          resumed: true,
        });
      } catch (e) {
        return res.status(400).json({ error: (e as Error).message });
      }
    }
  }

  let set;
  try {
    const bank = await prisma.question.findMany({ select: { id: true, difficulty: true } });
    [set] = generateBalancedSets(bank, {
      numberOfSets: 1,
      easyPerSet: exam.easyPerSet,
      mediumPerSet: exam.mediumPerSet,
      hardPerSet: exam.hardPerSet,
    });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
  if (set.questionIds.length === 0) {
    return res.status(400).json({ error: 'This exam is configured with 0 questions per set.' });
  }

  let ordered;
  try {
    ordered = await loadPublicQuestions(set.questionIds);
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }

  const attempt = existing
    ? await prisma.attempt.update({
        where: { id: existing.id },
        data: { setLabel: 'ONLINE', answers: { questionIds: set.questionIds } },
      })
    : await prisma.attempt.create({
        data: {
          examId: exam.id,
          studentId: req.user!.sub,
          setLabel: 'ONLINE',
          answers: { questionIds: set.questionIds },
        },
      });

  res.json({
    attemptId: attempt.id,
    durationMinutes: exam.durationMinutes,
    instructions: exam.instructions,
    questions: ordered,
  });
});

const submitSchema = z.object({ answers: z.record(z.string()) });

router.post('/:attemptId/submit', authorize(Role.STUDENT), async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const attempt = await prisma.attempt.findUnique({ where: { id: req.params.attemptId } });
  if (!attempt || attempt.studentId !== req.user!.sub) {
    return res.status(404).json({ error: 'Attempt not found' });
  }

  // Auto-grade MCQs server-side.
  const ids = Object.keys(parsed.data.answers);
  const questions = await prisma.question.findMany({ where: { id: { in: ids } } });
  let score = 0;
  for (const q of questions) {
    if (q.type === 'MCQ' && q.correctKey && parsed.data.answers[q.id] === q.correctKey) score++;
  }

  const updated = await prisma.attempt.update({
    where: { id: attempt.id },
    data: { submittedAt: new Date(), answers: parsed.data.answers, score },
  });
  res.json({ submittedAt: updated.submittedAt, score });
});

export default router;
