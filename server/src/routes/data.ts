import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Optional shared-secret gate. If APP_SYNC_TOKEN is set, every request must send
// it as `x-sync-token`. If unset, the API is open (fine for an internal tool on a
// trusted network; set the token for anything public).
router.use((req: Request, res: Response, next) => {
  const need = process.env.APP_SYNC_TOKEN;
  if (!need || req.headers['x-sync-token'] === need) return next();
  res.status(401).json({ error: 'unauthorized' });
});

// GET /api/data → { [table]: data } for every table (one-shot hydrate).
router.get('/', async (_req: Request, res: Response) => {
  const rows = await prisma.store.findMany();
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = r.data;
  res.json(out);
});

// GET /api/data/:key → one table's data (or null).
router.get('/:key', async (req: Request, res: Response) => {
  const row = await prisma.store.findUnique({ where: { key: req.params.key } });
  res.json(row?.data ?? null);
});

// PUT /api/data/:key → replace one table's data. Body is the array (or { data }).
router.put('/:key', async (req: Request, res: Response) => {
  const data = (req.body && typeof req.body === 'object' && 'data' in req.body) ? req.body.data : req.body;
  await prisma.store.upsert({
    where: { key: req.params.key },
    update: { data },
    create: { key: req.params.key, data },
  });
  res.json({ ok: true });
});

export default router;
