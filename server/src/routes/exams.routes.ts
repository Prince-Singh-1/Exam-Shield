import { Router } from 'express';
import { z } from 'zod';
import { Difficulty, ExamMode, ExamStatus, Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate, authorize } from '../middleware/auth';
import { generateExamPapers } from '../services/examService';
import { buildPaperPdf } from '../services/pdf';

const router = Router();

const createSchema = z
  .object({
    title: z.string().min(2),
    mode: z.nativeEnum(ExamMode),
    examDate: z.string().datetime(),
    leadTimeHours: z.number().int().min(0).max(720).default(12),
    numberOfSets: z.number().int().min(1),
    easyPerSet: z.number().int().min(0),
    mediumPerSet: z.number().int().min(0),
    hardPerSet: z.number().int().min(0),
    durationMinutes: z.number().int().min(1).default(60),
    instructions: z.string().optional(),
  })
  .refine((exam) => exam.easyPerSet + exam.mediumPerSet + exam.hardPerSet > 0, {
    path: ['easyPerSet'],
    message: 'Each exam needs at least one question per set',
  });

router.use(authenticate);

async function getBankShortfalls(input: {
  mode: ExamMode;
  numberOfSets: number;
  easyPerSet: number;
  mediumPerSet: number;
  hardPerSet: number;
}) {
  const multiplier = input.mode === ExamMode.OFFLINE ? input.numberOfSets : 1;
  const required: Record<Difficulty, number> = {
    EASY: input.easyPerSet * multiplier,
    MEDIUM: input.mediumPerSet * multiplier,
    HARD: input.hardPerSet * multiplier,
  };
  const counts = await prisma.question.groupBy({ by: ['difficulty'], _count: true });
  const available: Record<Difficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  counts.forEach((item) => {
    available[item.difficulty] = item._count;
  });

  return (Object.keys(required) as Difficulty[])
    .filter((difficulty) => available[difficulty] < required[difficulty])
    .map((difficulty) => ({
      difficulty,
      required: required[difficulty],
      available: available[difficulty],
    }));
}

// Create an exam config (online or offline).
router.post('/', authorize(Role.ADMIN, Role.EXAMINER), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data as {
    title: string;
    mode: ExamMode;
    examDate: string;
    leadTimeHours: number;
    numberOfSets: number;
    easyPerSet: number;
    mediumPerSet: number;
    hardPerSet: number;
    durationMinutes: number;
    instructions?: string;
  };
  const shortfalls = await getBankShortfalls({
    mode: d.mode,
    numberOfSets: d.numberOfSets,
    easyPerSet: d.easyPerSet,
    mediumPerSet: d.mediumPerSet,
    hardPerSet: d.hardPerSet,
  });
  if (shortfalls.length > 0) {
    return res.status(400).json({
      error: shortfalls
        .map((item) => `Question bank too small: need ${item.required} ${item.difficulty} questions, have ${item.available}.`)
        .join(' '),
      shortfalls,
    });
  }

  const examDate = new Date(d.examDate);
  const questionsPerSet = d.easyPerSet + d.mediumPerSet + d.hardPerSet;
  const generateAt =
    d.mode === 'OFFLINE' ? new Date(examDate.getTime() - d.leadTimeHours * 3600_000) : null;

  const exam = await prisma.exam.create({
    data: {
      title: d.title,
      mode: d.mode,
      examDate,
      leadTimeHours: d.leadTimeHours,
      generateAt,
      numberOfSets: d.numberOfSets,
      questionsPerSet,
      easyPerSet: d.easyPerSet,
      mediumPerSet: d.mediumPerSet,
      hardPerSet: d.hardPerSet,
      durationMinutes: d.durationMinutes,
      instructions: d.instructions,
      status: d.mode === 'OFFLINE' ? ExamStatus.SCHEDULED : ExamStatus.DRAFT,
      createdById: req.user!.sub,
    },
  });

  if (d.mode === ExamMode.OFFLINE && generateAt && generateAt <= new Date()) {
    const generation = await generateExamPapers(exam.id, req.user!.sub);
    return res.status(201).json({ ...exam, generation });
  }

  res.status(201).json(exam);
});

router.get('/', authorize(Role.ADMIN, Role.EXAMINER, Role.PROCTOR), async (_req, res) => {
  const exams = await prisma.exam.findMany({
    orderBy: { examDate: 'asc' },
    include: {
      _count: { select: { papers: true, attempts: true } },
      papers: {
        select: { id: true, setLabel: true, totalWeight: true, generatedAt: true },
        orderBy: { setLabel: 'asc' },
      },
    },
  });
  res.json(exams);
});

router.get('/:id', authorize(Role.ADMIN, Role.EXAMINER, Role.PROCTOR), async (req, res) => {
  const exam = await prisma.exam.findUnique({
    where: { id: req.params.id },
    include: { papers: { include: { items: true } } },
  });
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  res.json(exam);
});

router.delete('/:id', authorize(Role.ADMIN, Role.EXAMINER), async (req, res) => {
  const exam = await prisma.exam.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  await prisma.exam.delete({ where: { id: exam.id } });
  return res.status(204).end();
});

// Manually trigger generation (also runs automatically via scheduler for offline).
router.post('/:id/generate', authorize(Role.ADMIN, Role.EXAMINER), async (req, res) => {
  try {
    const result = await generateExamPapers(req.params.id, req.user!.sub);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// Download a generated set as a printable PDF.
router.get('/:id/papers/:paperId/pdf', authorize(Role.ADMIN, Role.EXAMINER), async (req, res) => {
  const paper = await prisma.generatedPaper.findUnique({
    where: { id: req.params.paperId },
    include: {
      exam: true,
      generatedBy: true,
      items: { include: { question: true }, orderBy: { order: 'asc' } },
    },
  });
  if (!paper || paper.examId !== req.params.id) {
    return res.status(404).json({ error: 'Paper not found' });
  }
  const pdf = await buildPaperPdf({
    examTitle: paper.exam.title,
    setLabel: paper.setLabel,
    instructions: paper.exam.instructions,
    durationMinutes: paper.exam.durationMinutes,
    examDate: paper.examDate,
    generatedAt: paper.generatedAt,
    generatedByName: paper.generatedBy.name,
    totalWeight: paper.totalWeight,
    questions: paper.items.map((it) => ({
      order: it.order + 1,
      text: it.question.text,
      type: it.question.type,
      options: it.question.options as { id: string; text: string }[] | null,
    })),
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${paper.exam.title}-${paper.setLabel}.pdf"`);
  res.send(pdf);
});

export default router;
