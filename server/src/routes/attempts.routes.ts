import { Router } from 'express';
import { z } from 'zod';
import { ExamMode, Prisma, Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate, authorize } from '../middleware/auth';
import { generateBalancedSets } from '../services/setGenerator';

const router = Router();

router.use(authenticate);

type AttemptAnswers = {
  questionIds?: string[];
  draftAnswers?: Record<string, string>;
  studentDetails?: Record<string, string>;
  subjectiveResults?: Record<string, { score: number; maxScore: number; feedback: string }>;
};

function asJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

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

router.get('/results/me', authorize(Role.STUDENT), async (req, res) => {
  const results = await prisma.examResult.findMany({
    where: { studentId: req.user!.sub },
    orderBy: { createdAt: 'desc' },
    include: {
      exam: { select: { id: true, title: true, examDate: true, mode: true } },
      attempt: { select: { startedAt: true, submittedAt: true, setLabel: true } },
    },
  });
  res.json(results);
});

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
    const saved = existing.answers as AttemptAnswers | null;
    if (Array.isArray(saved?.questionIds) && saved.questionIds.length > 0) {
      try {
        const questions = await loadPublicQuestions(saved.questionIds);
        return res.json({
          attemptId: existing.id,
          setLabel: existing.setLabel ?? 'Online Set 1',
          durationMinutes: exam.durationMinutes,
          instructions: exam.instructions,
          questions,
          answers: saved.draftAnswers ?? {},
          studentDetails: saved.studentDetails ?? {},
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

  const setLabel = `Online Set ${Math.max(1, (await prisma.attempt.count({ where: { examId: exam.id } })) + 1)}`;
  const attempt = existing
    ? await prisma.attempt.update({
        where: { id: existing.id },
        data: {
          setLabel: existing.setLabel ?? setLabel,
          answers: { ...((existing.answers as AttemptAnswers | null) ?? {}), questionIds: set.questionIds },
        },
      })
    : await prisma.attempt.create({
        data: {
          examId: exam.id,
          studentId: req.user!.sub,
          setLabel,
          answers: { questionIds: set.questionIds },
        },
      });

  res.json({
    attemptId: attempt.id,
    setLabel: attempt.setLabel,
    durationMinutes: exam.durationMinutes,
    instructions: exam.instructions,
    questions: ordered,
    answers: {},
  });
});

const studentDetailsSchema = z
  .object({
    name: z.string().min(1).max(120),
    rollNumber: z.string().min(1).max(80),
    section: z.string().max(80).optional(),
    institution: z.string().max(120).optional(),
  })
  .strict();

const saveSchema = z.object({
  answers: z.record(z.string()),
  studentDetails: studentDetailsSchema.optional(),
});

router.patch('/:attemptId/save', authorize(Role.STUDENT), async (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const attempt = await prisma.attempt.findUnique({ where: { id: req.params.attemptId } });
  if (!attempt || attempt.studentId !== req.user!.sub) {
    return res.status(404).json({ error: 'Attempt not found' });
  }
  if (attempt.submittedAt) {
    return res.status(400).json({ error: 'Submitted attempts cannot be changed.' });
  }

  const saved = (attempt.answers as AttemptAnswers | null) ?? {};
  const assignedIds = new Set(saved.questionIds ?? Object.keys(parsed.data.answers));
  const draftAnswers = Object.fromEntries(
    Object.entries(parsed.data.answers).filter(([questionId]) => assignedIds.has(questionId)),
  );
  await prisma.attempt.update({
    where: { id: attempt.id },
    data: {
      answers: {
        ...saved,
        draftAnswers,
        studentDetails: parsed.data.studentDetails ?? saved.studentDetails,
      },
    },
  });
  res.json({ savedAt: new Date().toISOString(), answeredCount: Object.keys(draftAnswers).length });
});

const submitSchema = saveSchema;

function scoreSubjective(questionText: string, answer: string) {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3);
  const answerWords = new Set(normalize(answer));
  const promptWords = new Set(normalize(questionText));
  const overlap = [...promptWords].filter((word) => answerWords.has(word)).length;
  const lengthScore = Math.min(1, answer.trim().split(/\s+/).filter(Boolean).length / 80);
  const relevanceScore = promptWords.size ? Math.min(1, overlap / Math.max(3, Math.ceil(promptWords.size * 0.35))) : 0;
  const score = Math.round((lengthScore * 0.45 + relevanceScore * 0.55) * 5);
  const feedback =
    score >= 4
      ? 'Complete answer with enough detail and relevant terminology.'
      : score >= 2
        ? 'Partial answer; add more explanation and connect it directly to the question.'
        : 'Needs review; the answer is too brief or does not match the question closely.';
  return { score, maxScore: 5, feedback };
}

router.post('/:attemptId/submit', authorize(Role.STUDENT), async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const attempt = await prisma.attempt.findUnique({ where: { id: req.params.attemptId } });
  if (!attempt || attempt.studentId !== req.user!.sub) {
    return res.status(404).json({ error: 'Attempt not found' });
  }

  const saved = attempt.answers as AttemptAnswers | null;
  const questionIds =
    Array.isArray(saved?.questionIds) && saved.questionIds.length > 0
      ? saved.questionIds
      : Object.keys(parsed.data.answers);
  const questions = await prisma.question.findMany({ where: { id: { in: questionIds } } });
  const byId = new Map(questions.map((question) => [question.id, question]));
  const assignedIds = new Set(questionIds);
  const submittedAnswers = Object.fromEntries(
    Object.entries(parsed.data.answers).filter(([questionId]) => assignedIds.has(questionId)),
  );

  // Auto-grade only MCQs assigned to this attempt.
  let score = 0;
  const subjectiveResults: AttemptAnswers['subjectiveResults'] = {};
  let subjectiveScore = 0;
  let totalSubjective = 0;
  const answerKey = questionIds.map((questionId, index) => {
    const question = byId.get(questionId);
    return {
      questionId,
      order: index + 1,
      type: question?.type,
      correctKey: question?.type === 'MCQ' ? question.correctKey : null,
      expected: question?.type === 'SUBJECTIVE' ? 'Subjective answer scored by checker and available for staff review.' : null,
    };
  });
  for (const q of questions) {
    if (q.type === 'MCQ' && q.correctKey && submittedAnswers[q.id] === q.correctKey) score++;
    if (q.type === 'SUBJECTIVE') {
      const result = scoreSubjective(q.text, submittedAnswers[q.id] ?? '');
      subjectiveResults[q.id] = result;
      subjectiveScore += result.score;
      totalSubjective += result.maxScore;
    }
  }
  const totalMcq = questions.filter((question) => question.type === 'MCQ').length;
  const answeredCount = Object.keys(submittedAnswers).length;
  const totalScore = score + subjectiveScore;
  const maxScore = totalMcq + totalSubjective;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0;

  const resultPayload = {
    examId: attempt.examId,
    attemptId: attempt.id,
    studentId: attempt.studentId,
    setLabel: attempt.setLabel,
    studentDetails: asJson(parsed.data.studentDetails ?? saved?.studentDetails ?? {}),
    submittedAnswers: asJson(submittedAnswers),
    answerKey: asJson(answerKey),
    mcqScore: score,
    totalMcq,
    subjectiveScore,
    totalSubjective,
    totalScore,
    maxScore,
    answeredCount,
    totalQuestions: questionIds.length,
    percentage,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const savedAttempt = await tx.attempt.update({
      where: { id: attempt.id },
      data: {
        submittedAt: new Date(),
        answers: {
          questionIds,
          submittedAnswers,
          studentDetails: parsed.data.studentDetails ?? saved?.studentDetails,
          subjectiveResults,
        },
        score,
      },
    });
    await tx.examResult.upsert({
      where: { attemptId: attempt.id },
      update: resultPayload,
      create: resultPayload,
    });
    return savedAttempt;
  });
  res.json({
    submittedAt: updated.submittedAt,
    score,
    totalMcq,
    subjectiveScore,
    totalSubjective,
    totalScore,
    maxScore,
    percentage,
    answerKey,
    subjectiveResults,
    totalQuestions: questionIds.length,
    answeredCount,
  });
});

export default router;
