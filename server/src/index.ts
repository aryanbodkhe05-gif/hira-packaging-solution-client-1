import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { initSocket } from './lib/socket';
import { startAllJobs } from './jobs/scheduler';

import authRouter from './routes/auth';
import inventoryRouter from './routes/inventory';
import ordersRouter from './routes/orders';
import alertsRouter from './routes/alerts';
import settingsRouter from './routes/settings';

const app = express();
const httpServer = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Init Socket.io ────────────────────────────────────────────────────────────
initSocket(httpServer, CLIENT_URL);

// ── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`🚀 PackFlow ERP server running on port ${PORT}`);
  startAllJobs();
});

export default app;
