import { Router } from 'express';
import { z } from 'zod';
import { ExamMode, Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate, authorize } from '../middleware/auth';
import { generateBalancedSets } from '../services/setGenerator';

const router = Router();

router.use(authenticate);

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
    return res.status(409).json({ error: 'Attempt already in progress', attemptId: existing.id });
  }

  const bank = await prisma.question.findMany({ select: { id: true, difficulty: true } });
  const [set] = generateBalancedSets(bank, {
    numberOfSets: 1,
    easyPerSet: exam.easyPerSet,
    mediumPerSet: exam.mediumPerSet,
    hardPerSet: exam.hardPerSet,
  });

  const questions = await prisma.question.findMany({
    where: { id: { in: set.questionIds } },
    select: { id: true, text: true, type: true, options: true }, // no correctKey
  });
  // Preserve randomized order from the generator.
  const ordered = set.questionIds.map((id) => questions.find((q) => q.id === id)!);

  const attempt = await prisma.attempt.create({
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
