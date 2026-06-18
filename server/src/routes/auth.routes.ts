import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { signToken, authenticate } from '../middleware/auth';
import { sendOtpEmail } from '../utils/email';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
  role: z.nativeEnum(Role),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Students may only authenticate for ONLINE exams.
  mode: z.enum(['ONLINE', 'OFFLINE']).optional(),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  mode: z.enum(['ONLINE', 'OFFLINE']).optional(),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, name, password, role } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, passwordHash, role },
  });
  return res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, mode } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Students can only log in for ONLINE exams. Offline exams are physical — no student login.
  if (user.role === Role.STUDENT && mode === 'OFFLINE') {
    return res.status(403).json({ error: 'Students cannot log in for offline exams' });
  }

  if (!user.isEmailVerified) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { otp, otpExpiresAt },
    });

    await sendOtpEmail(user.email, otp);

    return res.status(403).json({
      error: 'Email not verified',
      requiresVerification: true,
    });
  }

  const token = signToken({ sub: user.id, role: user.role, email: user.email, name: user.name });
  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.post('/verify-otp', async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, otp, mode } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  if (user.role === Role.STUDENT && mode === 'OFFLINE') {
    return res.status(403).json({ error: 'Students cannot log in for offline exams' });
  }

  if (!user.otp || user.otp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    return res.status(400).json({ error: 'OTP has expired' });
  }

  // OTP is valid, mark as verified and clear OTP fields
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      otp: null,
      otpExpiresAt: null,
    },
  });

  const token = signToken({ sub: user.id, role: user.role, email: user.email, name: user.name });
  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.get('/me', authenticate, async (req, res) => {
  return res.json({ user: req.user });
});

export default router;
