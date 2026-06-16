import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Role, ViolationType } from '@prisma/client';
import { prisma } from '../prisma';
import { config } from '../config';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

const captureDir = path.resolve(process.cwd(), config.captureDir);
fs.mkdirSync(captureDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, captureDir),
  filename: (_req, _file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.png`),
});
const upload = multer({ storage });

router.use(authenticate);

const logSchema = z.object({
  attemptId: z.string(),
  type: z.nativeEnum(ViolationType),
  detail: z.string().optional(),
});

// Student client logs a violation. Optionally attaches a timestamped capture (multipart).
router.post('/', authorize(Role.STUDENT), upload.single('capture'), async (req, res) => {
  const body = { ...req.body };
  const parsed = logSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const attempt = await prisma.attempt.findUnique({ where: { id: parsed.data.attemptId } });
  if (!attempt || attempt.studentId !== req.user!.sub) {
    return res.status(404).json({ error: 'Attempt not found' });
  }
  const violation = await prisma.violation.create({
    data: {
      attemptId: parsed.data.attemptId,
      studentId: req.user!.sub,
      type: parsed.data.type,
      detail: parsed.data.detail,
      capturePath: req.file ? path.join(config.captureDir, req.file.filename) : undefined,
    },
  });
  res.status(201).json({ id: violation.id });
});

// Proctor dashboard: review violations (optionally by exam).
router.get('/', authorize(Role.ADMIN, Role.PROCTOR, Role.EXAMINER), async (req, res) => {
  const { examId } = req.query;
  const violations = await prisma.violation.findMany({
    where: examId ? { attempt: { examId: String(examId) } } : undefined,
    include: { student: { select: { id: true, name: true, email: true } }, attempt: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json(violations);
});

export default router;
