import { Router } from 'express';
import { z } from 'zod';
import { Difficulty, QuestionType, Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

const optionSchema = z.object({ id: z.string(), text: z.string() });
const questionSchema = z.object({
  text: z.string().min(1),
  type: z.nativeEnum(QuestionType).default('MCQ'),
  difficulty: z.nativeEnum(Difficulty),
  options: z.array(optionSchema).optional(),
  correctKey: z.string().optional(),
  subject: z.string().optional(),
});

// Bulk upload a large question bank.
const bulkSchema = z.object({ questions: z.array(questionSchema).min(1) });

router.use(authenticate, authorize(Role.ADMIN, Role.EXAMINER));

router.get('/', async (req, res) => {
  const { difficulty, subject } = req.query;
  const questions = await prisma.question.findMany({
    where: {
      difficulty: difficulty ? (difficulty as Difficulty) : undefined,
      subject: subject ? String(subject) : undefined,
    },
    orderBy: { createdAt: 'desc' },
  });
  const counts = await prisma.question.groupBy({ by: ['difficulty'], _count: true });
  res.json({ questions, counts });
});

router.post('/', async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const q = await prisma.question.create({ data: { ...parsed.data, options: parsed.data.options ?? undefined } });
  res.status(201).json(q);
});

router.post('/bulk', async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const created = await prisma.$transaction(
    parsed.data.questions.map((q) =>
      prisma.question.create({ data: { ...q, options: q.options ?? undefined } }),
    ),
  );
  res.status(201).json({ created: created.length });
});

router.delete('/:id', async (req, res) => {
  await prisma.question.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
