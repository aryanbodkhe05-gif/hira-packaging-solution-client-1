import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OrderStatus, AlertType, AlertChannel } from '@prisma/client';
import { format } from 'date-fns';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { sendWhatsApp } from '../whatsapp/client';
import { templates } from '../whatsapp/templates';
import { emitAlert } from '../lib/socket';

const router = Router();

function generateOrderId(): string {
  const date = format(new Date(), 'yyyyMMdd');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PKG-${date}-${rand}`;
}

// ── GET all orders ────────────────────────────────────────────────────────────
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, clientId, search, from, to, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (from || to) {
      where.deliveryDate = {};
      if (from) (where.deliveryDate as Record<string, unknown>).gte = new Date(from as string);
      if (to) (where.deliveryDate as Record<string, unknown>).lte = new Date(to as string);
    }
    if (search) {
      (where as Record<string, unknown>).OR = [
        { orderId: { contains: search as string, mode: 'insensitive' } },
        { productType: { contains: search as string, mode: 'insensitive' } },
        { client: { name: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: { client: { select: { id: true, name: true, phone: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.order.count({ where }),
    ]);

    // Mark overdue
    const now = new Date();
    const enriched = orders.map((o: typeof orders[number]) => ({
      ...o,
      isOverdue: o.status !== OrderStatus.DISPATCHED && o.deliveryDate < now,
    }));

    res.json({ orders: enriched, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── GET dashboard stats ───────────────────────────────────────────────────────
router.get('/stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));

    const [pending, inProduction, dispatched, overdue, ready] = await Promise.all([
      prisma.order.count({ where: { status: OrderStatus.RECEIVED } }),
      prisma.order.count({ where: { status: OrderStatus.IN_PRODUCTION } }),
      prisma.order.count({ where: { status: OrderStatus.DISPATCHED, dispatchedAt: { gte: todayStart } } }),
      prisma.order.count({
        where: {
          status: { not: OrderStatus.DISPATCHED },
          deliveryDate: { lt: new Date() },
        },
      }),
      prisma.order.count({ where: { status: OrderStatus.READY } }),
    ]);

    res.json({ pending, inProduction, dispatched, overdue, ready });
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── GET single order ──────────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        jobs: { include: { machine: true } },
        invoices: true,
      },
    });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(order);
  } catch {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ── POST create order ─────────────────────────────────────────────────────────
const createOrderSchema = z.object({
  clientId: z.string(),
  productType: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().default('units'),
  deliveryDate: z.string(),
  notes: z.string().optional(),
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const order = await prisma.order.create({
      data: {
        orderId: generateOrderId(),
        clientId: data.clientId,
        productType: data.productType,
        quantity: data.quantity,
        unit: data.unit,
        deliveryDate: new Date(data.deliveryDate),
        notes: data.notes,
        status: OrderStatus.RECEIVED,
      },
      include: { client: true },
    });
    res.status(201).json(order);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ── PATCH update order status ─────────────────────────────────────────────────
const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  trackingNumber: z.string().optional(),
});

router.patch('/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, trackingNumber } = updateStatusSchema.parse(req.body);

    const existing = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { client: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const updateData: Record<string, unknown> = { status };
    if (status === OrderStatus.DISPATCHED) updateData.dispatchedAt = new Date();
    if (status === OrderStatus.READY) updateData.readyAt = new Date();

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: updateData,
      include: { client: true },
    });

    // Auto WhatsApp on dispatch
    if (status === OrderStatus.DISPATCHED && existing.client.phone) {
      const companySetting = await prisma.setting.findUnique({ where: { key: 'company_name' } });
      const companyName = companySetting?.value ?? 'PackFlow';

      const message = templates.orderDispatched(
        order.client.name,
        order.orderId,
        trackingNumber ?? '',
        order.deliveryDate,
        companyName
      );

      if (order.client.phone) {
        await sendWhatsApp(order.client.phone, message);
      }
    }

    res.json(order);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ── GET clients ────────────────────────────────────────────────────────────────
router.get('/clients/all', authenticate, async (_req: Request, res: Response) => {
  try {
    const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
    res.json(clients);
  } catch {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// ── POST create client ─────────────────────────────────────────────────────────
router.post('/clients', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, phone, email, address, gstNumber } = req.body;
    const client = await prisma.client.create({
      data: { name, phone, email, address, gstNumber },
    });
    res.status(201).json(client);
  } catch {
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// ── Check and flag overdue orders (called by cron) ────────────────────────────
export async function checkOverdueOrders() {
  const overdueOrders = await prisma.order.findMany({
    where: {
      status: { not: OrderStatus.DISPATCHED },
      deliveryDate: { lt: new Date() },
    },
    include: { client: true },
  });

  for (const order of overdueOrders) {
    const existing = await prisma.alert.findFirst({
      where: {
        type: AlertType.OVERDUE_ORDER,
        message: { contains: order.orderId },
        sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (existing) continue;

    const message = `⏰ OVERDUE ORDER ${order.orderId} — ${order.client.name}. Due: ${format(order.deliveryDate, 'dd MMM yyyy')}. Status: ${order.status.replace('_', ' ')}`;

    const alert = await prisma.alert.create({
      data: {
        type: AlertType.OVERDUE_ORDER,
        title: `Overdue: ${order.orderId}`,
        message,
        channel: AlertChannel.BOTH,
      },
    });

    emitAlert({ id: alert.id, type: alert.type, title: alert.title, message: alert.message, channel: alert.channel, sentAt: alert.sentAt });
  }
}

export default router;
