import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { signToken, authenticate } from '../middleware/auth';

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

const googleSchema = z.object({
  credential: z.string().min(20),
  role: z.nativeEnum(Role).default(Role.STUDENT),
});

async function verifyGoogleCredential(credential: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google sign-in is not configured on the server.');
  }
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) {
    throw new Error('Google could not verify this account.');
  }
  const profile = (await response.json()) as { aud?: string; email?: string; name?: string; sub?: string; email_verified?: string | boolean };
  if (profile.aud !== clientId) {
    throw new Error('Google client mismatch.');
  }
  if (!profile.email || profile.email_verified === 'false' || profile.email_verified === false) {
    throw new Error('Google email is not verified.');
  }
  return {
    email: profile.email,
    name: profile.name || profile.email.split('@')[0],
    googleId: profile.sub || profile.email,
  };
}

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

  const token = signToken({ sub: user.id, role: user.role, email: user.email, name: user.name });
  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.post('/google', async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const profile = await verifyGoogleCredential(parsed.data.credential);
    const user = await prisma.user.upsert({
      where: { email: profile.email },
      update: { name: profile.name },
      create: {
        email: profile.email,
        name: profile.name,
        passwordHash: `google:${profile.googleId}`,
        role: parsed.data.role,
      },
    });
    const token = signToken({ sub: user.id, role: user.role, email: user.email, name: user.name });
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    return res.status(401).json({ error: (e as Error).message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  return res.json({ user: req.user });
});

export default router;
