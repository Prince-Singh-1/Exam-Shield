import { Router } from 'express';
import { z } from 'zod';
import { ExamMode, ExamStatus, Role } from '@prisma/client';
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

// Create an exam config (online or offline).
router.post('/', authorize(Role.ADMIN, Role.EXAMINER), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
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
