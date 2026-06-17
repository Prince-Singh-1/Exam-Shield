import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { config } from '../config';

export interface AuthPayload {
  sub: string;
  role: Role;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  const options: jwt.SignOptions = { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwtSecret, options);
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.slice('Bearer '.length);
  try {
    req.user = jwt.verify(token, config.jwtSecret) as AuthPayload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Role-based authorization guard.
export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    return next();
  };
}
