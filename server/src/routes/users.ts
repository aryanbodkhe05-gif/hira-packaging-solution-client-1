import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Users & Roles is for Developer + Owner only — enforced on the server.
router.use(authenticate, requireRole(UserRole.DEVELOPER, UserRole.OWNER));

const PUBLIC_SELECT = { id: true, name: true, username: true, role: true, active: true, createdAt: true } as const;

// Roles an admin may assign through the UI — never DEVELOPER.
const assignableRole = z
  .nativeEnum(UserRole)
  .refine((r) => r !== UserRole.DEVELOPER, 'Developer is not an assignable role');
const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  role: assignableRole,
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});
const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: assignableRole.optional(),
  active: z.boolean().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

// "Amit Sharma" -> "amitsharma"; append a number if taken (amitsharma2, …).
async function generateUsername(name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
  let candidate = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    n += 1;
    candidate = `${base}${n}`;
  }
  return candidate;
}

// List — DEVELOPER accounts are never exposed.
router.get('/', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { role: { not: UserRole.DEVELOPER } },
    select: PUBLIC_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users });
});

// Create — backend generates username + default password (username+role), or
// accepts a custom password. Plaintext credentials are returned exactly once.
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, role, password } = createSchema.parse(req.body);
    const username = await generateUsername(name);
    const plainPassword = password ?? `${username}${role.toLowerCase()}`;
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const user = await prisma.user.create({
      data: { name, username, role, passwordHash },
      select: PUBLIC_SELECT,
    });

    // The only time plaintext leaves the server — admin hands it to the user.
    res.status(201).json({ user, credentials: { username, password: plainPassword } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0]?.message ?? 'Invalid input' });
      return;
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper: load a non-developer user or 404 (developer accounts are invisible).
async function loadManageable(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role === UserRole.DEVELOPER) return null;
  return user;
}

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const patch = updateSchema.parse(req.body);
    const target = await loadManageable(req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const data: { name?: string; role?: UserRole; active?: boolean; passwordHash?: string } = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.role !== undefined) data.role = patch.role;
    if (patch.active !== undefined) data.active = patch.active;

    let credentials: { username: string; password: string } | undefined;
    if (patch.password !== undefined) {
      data.passwordHash = await bcrypt.hash(patch.password, 10);
      credentials = { username: target.username, password: patch.password };
    }

    const user = await prisma.user.update({ where: { id: target.id }, data, select: PUBLIC_SELECT });
    res.json({ user, credentials });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0]?.message ?? 'Invalid input' });
      return;
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const target = await loadManageable(req.params.id);
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  await prisma.user.delete({ where: { id: target.id } });
  res.json({ ok: true });
});

export default router;
