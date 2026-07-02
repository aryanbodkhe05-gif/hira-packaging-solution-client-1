import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import dataRouter from './routes/data';
import { prisma } from './lib/prisma';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

// In the combined deployment the API + SPA share an origin (no CORS needed);
// CORS is only for local dev where Vite runs on :5173.
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json({ limit: '10mb' })); // data blobs can be sizeable

// ── API ───────────────────────────────────────────────────────────────────────
app.use('/api/data', dataRouter);
// Health reports whether the shared database is reachable (so you can tell
// "app up but DB down" from a full outage).
app.get('/api/health', async (_req, res) => {
  let db = false;
  try { await prisma.$queryRaw`SELECT 1`; db = true; } catch { /* db down */ }
  res.json({ status: 'ok', db, timestamp: new Date().toISOString() });
});

// ── Static client (combined service) ──────────────────────────────────────────
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Hira ERP server running on port ${PORT}`));

export default app;
