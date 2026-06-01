import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany();
    const obj: Record<string, string> = {};
    settings.forEach((s: { key: string; value: string }) => (obj[s.key] = s.value));
    res.json(obj);
  } catch {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', authenticate, requireRole(UserRole.OWNER, UserRole.MANAGER), async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, string>;
    const ops = Object.entries(updates).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    );
    await prisma.$transaction(ops);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.get('/users', authenticate, requireRole(UserRole.OWNER), async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, phone: true, active: true },
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
