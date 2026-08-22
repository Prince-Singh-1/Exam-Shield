import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { config } from '../config';
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

const oauthState: Map<string, { role: Role; createdAt: number }> = new Map();

function oauthRedirectUrl() {
  const base = config.googleRedirectUri || `${config.clientOrigin}/api/auth/google/callback`;
  return base;
}

function makeState(role: Role) {
  const state = `${role}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
  oauthState.set(state, { role, createdAt: Date.now() });
  return state;
}

function consumeState(state: string) {
  const saved = oauthState.get(state);
  if (!saved) return null;
  oauthState.delete(state);
  if (Date.now() - saved.createdAt > 10 * 60 * 1000) return null;
  return saved;
}

router.get('/google/start', async (req, res) => {
  const role = (String(req.query.role || 'STUDENT').toUpperCase() as Role);
  if (!Object.values(Role).includes(role)) {
    return res.status(400).json({ error: 'Invalid role for Google sign-in' });
  }
  if (!config.googleClientId || !config.googleClientSecret) {
    return res.status(500).json({ error: 'Google OAuth is not configured on the server' });
  }
  const state = makeState(role);
  const redirectUri = oauthRedirectUrl();
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get('/google/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const saved = consumeState(state);
  if (!code || !saved) {
    return res.redirect(`${config.clientOrigin}/signup?google=failed`);
  }
  if (!config.googleClientId || !config.googleClientSecret) {
    return res.redirect(`${config.clientOrigin}/signup?google=unavailable`);
  }

  const redirectUri = oauthRedirectUrl();
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });
  if (!tokenRes.ok) {
    return res.redirect(`${config.clientOrigin}/signup?google=failed`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    return res.redirect(`${config.clientOrigin}/signup?google=failed`);
  }

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profileRes.ok) {
    return res.redirect(`${config.clientOrigin}/signup?google=failed`);
  }
  const profile = (await profileRes.json()) as { id: string; email: string; name?: string };
  const email = profile.email;
  const name = profile.name || email.split('@')[0];
  const googlePassword = await bcrypt.hash(`google:${profile.id}`, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({
        where: { email },
        data: { name, role: existing.role ?? saved.role },
      })
    : await prisma.user.create({
        data: {
          email,
          name,
          passwordHash: googlePassword,
          role: saved.role,
        },
      });

  const token = signToken({ sub: user.id, role: user.role, email: user.email, name: user.name });
  const redirect = new URL(`${config.clientOrigin}/google-auth`);
  redirect.searchParams.set('token', token);
  redirect.searchParams.set('user', encodeURIComponent(JSON.stringify({ id: user.id, email: user.email, name: user.name, role: user.role })));
  return res.redirect(redirect.toString());
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
