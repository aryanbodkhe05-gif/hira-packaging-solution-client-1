import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AUTH_COOKIE } from '../middleware/auth';

const router = Router();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Cookie flags: httpOnly so JS can't read the token (XSS-resistant); Secure in
// production (HTTPS); SameSite=Lax is fine for a same-origin SPA + API.
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SEVEN_DAYS_MS,
    path: '/',
  };
}

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user || !user.active) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
    res.cookie(AUTH_COOKIE, token, cookieOptions());
    res.json({ user: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Current session — the frontend calls this on load to learn its role.
router.get('/me', authenticate, async (req: Request, res: Response) => {
  res.json({ user: req.user });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

export default router;
