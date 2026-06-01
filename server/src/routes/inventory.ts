import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { StockLogType, AlertType, AlertChannel } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { sendWhatsApp } from '../whatsapp/client';
import { templates } from '../whatsapp/templates';
import { emitAlert } from '../lib/socket';
import { subDays, startOfDay, endOfDay } from 'date-fns';

const router = Router();

// ── GET all materials ─────────────────────────────────────────────────────────
router.get('/materials', authenticate, async (_req: Request, res: Response) => {
  try {
    const materials = await prisma.material.findMany({
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        vendorMaterials: {
          include: { vendor: { select: { id: true, name: true, phone: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(materials);
  } catch {
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// ── GET single material with logs ─────────────────────────────────────────────
router.get('/materials/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: true,
        stockLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }
    res.json(material);
  } catch {
    res.status(500).json({ error: 'Failed to fetch material' });
  }
});

// ── POST create material ──────────────────────────────────────────────────────
const createMaterialSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  currentStock: z.number().min(0).default(0),
  reorderThreshold: z.number().min(0).default(100),
  supplierId: z.string().optional(),
});

router.post('/materials', authenticate, async (req: Request, res: Response) => {
  try {
    const data = createMaterialSchema.parse(req.body);
    const material = await prisma.material.create({ data });
    res.status(201).json(material);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to create material' });
  }
});

// ── PATCH update material (threshold etc.) ────────────────────────────────────
router.patch('/materials/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { reorderThreshold, name, unit, supplierId } = req.body;
    const material = await prisma.material.update({
      where: { id: req.params.id },
      data: { reorderThreshold, name, unit, supplierId },
    });
    res.json(material);
  } catch {
    res.status(500).json({ error: 'Failed to update material' });
  }
});

// ── POST stock-in ─────────────────────────────────────────────────────────────
const stockLogSchema = z.object({
  materialId: z.string(),
  quantity: z.number().positive(),
  notes: z.string().optional(),
  staffName: z.string().min(1),
});

router.post('/stock/in', authenticate, async (req: Request, res: Response) => {
  try {
    const data = stockLogSchema.parse(req.body);

    const material = await prisma.material.findUnique({ where: { id: data.materialId } });
    if (!material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    const [log, updated] = await prisma.$transaction([
      prisma.stockLog.create({
        data: {
          materialId: data.materialId,
          type: StockLogType.IN,
          quantity: data.quantity,
          notes: data.notes,
          staffName: data.staffName,
          staffId: req.user?.userId,
        },
      }),
      prisma.material.update({
        where: { id: data.materialId },
        data: { currentStock: { increment: data.quantity } },
        include: { supplier: true },
      }),
    ]);

    res.status(201).json({ log, material: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to log stock in' });
  }
});

// ── POST stock-out ────────────────────────────────────────────────────────────
router.post('/stock/out', authenticate, async (req: Request, res: Response) => {
  try {
    const data = stockLogSchema.parse(req.body);

    const material = await prisma.material.findUnique({
      where: { id: data.materialId },
      include: { supplier: true },
    });
    if (!material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }
    if (material.currentStock < data.quantity) {
      res.status(400).json({ error: 'Insufficient stock' });
      return;
    }

    const newStock = material.currentStock - data.quantity;

    const [log, updated] = await prisma.$transaction([
      prisma.stockLog.create({
        data: {
          materialId: data.materialId,
          type: StockLogType.OUT,
          quantity: data.quantity,
          notes: data.notes,
          staffName: data.staffName,
          staffId: req.user?.userId,
        },
      }),
      prisma.material.update({
        where: { id: data.materialId },
        data: { currentStock: newStock },
        include: { supplier: true },
      }),
    ]);

    // Check low stock threshold
    if (newStock <= material.reorderThreshold) {
      await triggerLowStockAlert(updated);
    }

    res.status(201).json({ log, material: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to log stock out' });
  }
});

// ── GET stock logs (with filters) ─────────────────────────────────────────────
router.get('/logs', authenticate, async (req: Request, res: Response) => {
  try {
    const { materialId, type, days = '30', page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {};
    if (materialId) where.materialId = materialId;
    if (type) where.type = type;
    if (days) {
      where.createdAt = { gte: subDays(new Date(), parseInt(days as string)) };
    }

    const [logs, total] = await prisma.$transaction([
      prisma.stockLog.findMany({
        where,
        include: { material: { select: { name: true, unit: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.stockLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ── GET stock history chart data (last 30 days) ───────────────────────────────
router.get('/chart/:materialId', authenticate, async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;
    const days = 30;
    const chartData: { date: string; in: number; out: number; balance: number }[] = [];

    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const start = startOfDay(date);
      const end = endOfDay(date);

      const [inLogs, outLogs] = await Promise.all([
        prisma.stockLog.aggregate({
          where: { materialId, type: StockLogType.IN, createdAt: { gte: start, lte: end } },
          _sum: { quantity: true },
        }),
        prisma.stockLog.aggregate({
          where: { materialId, type: StockLogType.OUT, createdAt: { gte: start, lte: end } },
          _sum: { quantity: true },
        }),
      ]);

      chartData.push({
        date: date.toISOString().split('T')[0],
        in: inLogs._sum.quantity ?? 0,
        out: outLogs._sum.quantity ?? 0,
        balance: 0, // will be computed on frontend or we can do running sum
      });
    }

    // Compute running balance from current stock backwards
    let runningStock = material.currentStock;
    for (let i = chartData.length - 1; i >= 0; i--) {
      chartData[i].balance = runningStock;
      runningStock = runningStock - chartData[i].in + chartData[i].out;
    }

    res.json({ material, chartData });
  } catch {
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

// ── Helper: trigger low stock alert ──────────────────────────────────────────
async function triggerLowStockAlert(material: {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  reorderThreshold: number;
  supplier?: { name: string; phone: string } | null;
}) {
  const supplierName = material.supplier?.name ?? 'Unknown';
  const supplierPhone = material.supplier?.phone ?? 'N/A';

  const message = templates.lowStock(
    material.name,
    material.currentStock,
    material.unit,
    material.reorderThreshold,
    supplierName,
    supplierPhone
  );

  const alertRecord = await prisma.alert.create({
    data: {
      type: AlertType.LOW_STOCK,
      title: `Low Stock: ${material.name}`,
      message,
      channel: AlertChannel.BOTH,
    },
  });

  // Emit in-app alert
  emitAlert({
    id: alertRecord.id,
    type: alertRecord.type,
    title: alertRecord.title,
    message: alertRecord.message,
    channel: alertRecord.channel,
    sentAt: alertRecord.sentAt,
  });

  // Check setting before sending WhatsApp
  const setting = await prisma.setting.findUnique({ where: { key: 'alert_whatsapp_low_stock' } });
  if (setting?.value === 'true') {
    const groupSetting = await prisma.setting.findUnique({ where: { key: 'alert_group_whatsapp' } });
    if (groupSetting?.value) {
      await sendWhatsApp(groupSetting.value, message);
    }
  }
}

export default router;
