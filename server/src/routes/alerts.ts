import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// ── GET alerts (unread first) ─────────────────────────────────────────────────
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { seen, limit = '50' } = req.query;
    const where: Record<string, unknown> = {};
    if (seen !== undefined) where.seen = seen === 'true';

    const [alerts, unreadCount] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: parseInt(limit as string),
      }),
      prisma.alert.count({ where: { seen: false } }),
    ]);

    res.json({ alerts, unreadCount });
  } catch {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// ── PATCH mark as seen ────────────────────────────────────────────────────────
router.patch('/:id/seen', authenticate, async (req: Request, res: Response) => {
  try {
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: { seen: true },
    });
    res.json(alert);
  } catch {
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// ── PATCH mark all as seen ────────────────────────────────────────────────────
router.patch('/mark-all-seen', authenticate, async (_req: Request, res: Response) => {
  try {
    await prisma.alert.updateMany({ where: { seen: false }, data: { seen: true } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark all as seen' });
  }
});

export default router;
