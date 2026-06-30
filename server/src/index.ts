import 'dotenv/config';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from './lib/prisma';
import authRouter from './routes/auth';
import usersRouter from './routes/users';

// ── Required secret — refuse to start without it (never fall back to a default) ──
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start.');
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

// ── Middleware ────────────────────────────────────────────────────────────────
// In the combined deployment the API and SPA share an origin (no CORS needed);
// CORS with credentials is only for local dev where Vite runs on :5173.
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Static client (combined service) ──────────────────────────────────────────
// Serve the built SPA and fall back to index.html for client-side routes so
// deep links / refreshes work. /api/* is excluded from the fallback.
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ── Bootstrap the hidden Developer account if it doesn't exist ─────────────────
// Runs on every boot so a fresh prod DB always has a developer login. Credentials
// can be overridden via env (recommended) and SHOULD be rotated after deploy.
async function ensureDeveloper() {
  const username = (process.env.DEV_USERNAME ?? 'aryanbodkhe').toLowerCase();
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return;
  const passwordHash = await bcrypt.hash(process.env.DEV_PASSWORD ?? 'aryandeveloper', 10);
  await prisma.user.create({
    data: { name: process.env.DEV_NAME ?? 'Aryan Bodkhe', username, passwordHash, role: UserRole.DEVELOPER },
  });
  console.log(`🔑 Seeded developer account "${username}" (rotate the password after deploy)`);
}

app.listen(PORT, async () => {
  await ensureDeveloper().catch((e) => console.error('Developer bootstrap failed:', e));
  console.log(`🚀 PackFlow ERP server running on port ${PORT}`);
});

export default app;
