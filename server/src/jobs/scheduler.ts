import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendWhatsApp } from '../whatsapp/client';
import { templates } from '../whatsapp/templates';
import { emitAlert } from '../lib/socket';
import { AlertType, AlertChannel, OrderStatus, JobStatus } from '@prisma/client';
import { format, differenceInHours, differenceInDays, isToday } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const IST = 'Asia/Kolkata';

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? null;
}

// ── Daily summary at 08:00 IST ────────────────────────────────────────────────
export function scheduleDailySummary() {
  // Cron: 08:00 IST = 02:30 UTC
  cron.schedule('30 2 * * *', async () => {
    try {
      const ownerNumber = await getSetting('owner_whatsapp');
      if (!ownerNumber) return;

      const now = new Date();
      const todayStart = toZonedTime(new Date(now.getFullYear(), now.getMonth(), now.getDate()), IST);

      const [
        pendingDispatch,
        overdueOrders,
        dispatchedToday,
        _totalMaterials,
        outstandingInvoices,
        invoicesDueToday,
        newLeads,
        followUpsDue,
        jobsInProgress,
        downtimeEvents,
        companySetting,
      ] = await Promise.all([
        prisma.order.count({ where: { status: OrderStatus.READY } }),
        prisma.order.count({ where: { status: { not: OrderStatus.DISPATCHED }, deliveryDate: { lt: now } } }),
        prisma.order.count({ where: { status: OrderStatus.DISPATCHED, dispatchedAt: { gte: todayStart } } }),
        prisma.material.count(),
        prisma.invoice.aggregate({
          where: { status: { in: ['SENT', 'OVERDUE'] } },
          _sum: { totalAmount: true },
          _count: true,
        }),
        prisma.invoice.count({ where: { dueDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) } } }),
        prisma.lead.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.lead.count({ where: { lastContactedAt: { lt: new Date(Date.now() - 3 * 86400000) }, status: { notIn: ['WON', 'LOST'] } } }),
        prisma.job.count({ where: { status: JobStatus.IN_PROGRESS } }),
        prisma.downtimeLog.count({ where: { startTime: { gte: todayStart } } }),
        getSetting('company_name'),
      ]);

      // Build low stock list
      const lowStockList = await prisma.material.findMany({
        where: {},
        select: { name: true, currentStock: true, unit: true, reorderThreshold: true },
      });
      const lowItems = lowStockList
        .filter((m: { currentStock: number; reorderThreshold: number }) => m.currentStock <= m.reorderThreshold)
        .map((m: { name: string; currentStock: number; unit: string }) => `${m.name} (${m.currentStock}${m.unit})`);

      const outstandingCount = outstandingInvoices._count;
      const outstandingAmount = outstandingInvoices._sum.totalAmount ?? 0;

      const message = templates.dailySummary({
        date: format(toZonedTime(now, IST), 'dd MMM yyyy'),
        pendingDispatch,
        overdueOrders,
        dispatchedYesterday: dispatchedToday,
        lowStockItems: lowItems,
        outstandingAmount,
        outstandingClients: outstandingCount,
        invoicesDueToday,
        newLeads,
        followUpsDue,
        jobsInProgress,
        downtimeEvents,
        companyName: companySetting ?? 'PackFlow',
      });

      await sendWhatsApp(ownerNumber, message);
      console.log('✅ Daily summary sent');
    } catch (err) {
      console.error('❌ Daily summary error:', err);
    }
  });
}

// ── Check dispatch delays every 30 mins ──────────────────────────────────────
export function scheduleDispatchDelayCheck() {
  cron.schedule('*/30 * * * *', async () => {
    try {
      const readyOrders = await prisma.order.findMany({
        where: { status: OrderStatus.READY, readyAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } },
        include: { client: true },
      });

      for (const order of readyOrders) {
        if (!order.readyAt) continue;
        const hoursReady = differenceInHours(new Date(), order.readyAt);

        const existing = await prisma.alert.findFirst({
          where: {
            type: AlertType.DISPATCH_DELAY,
            message: { contains: order.orderId },
            sentAt: { gte: new Date(Date.now() - 4 * 3600 * 1000) },
          },
        });
        if (existing) continue;

        const message = templates.dispatchDelay(order.orderId, order.client.name, hoursReady);

        const alert = await prisma.alert.create({
          data: {
            type: AlertType.DISPATCH_DELAY,
            title: `Dispatch Delay: ${order.orderId}`,
            message,
            channel: AlertChannel.BOTH,
          },
        });

        emitAlert({ id: alert.id, type: alert.type, title: alert.title, message: alert.message, channel: alert.channel, sentAt: alert.sentAt });

        const groupNumber = await getSetting('alert_group_whatsapp');
        const whatsappEnabled = await getSetting('alert_whatsapp_dispatch_delay');
        if (groupNumber && whatsappEnabled === 'true') {
          await sendWhatsApp(groupNumber, message);
        }
      }
    } catch (err) {
      console.error('❌ Dispatch delay check error:', err);
    }
  });
}

// ── Check payment reminders daily ────────────────────────────────────────────
export function schedulePaymentReminders() {
  cron.schedule('0 9 * * *', async () => {
    try {
      const today = new Date();

      const overdue = await prisma.invoice.findMany({
        where: { status: { in: ['SENT', 'OVERDUE'] }, paidAt: null },
        include: { client: true },
      });

      for (const inv of overdue) {
        const daysOverdue = differenceInDays(today, inv.dueDate);

        let message = '';
        if (daysOverdue === 0) {
          message = templates.paymentDue(inv.client.name, inv.invoiceNumber, inv.totalAmount);
        } else if (daysOverdue === 3) {
          message = templates.paymentOverdue3(inv.client.name, inv.invoiceNumber, inv.totalAmount);
        } else if (daysOverdue === 7) {
          message = templates.paymentOverdue7(inv.client.name, inv.invoiceNumber, inv.totalAmount);
        }

        if (message && inv.client.phone) {
          await sendWhatsApp(inv.client.phone, message);
          if (daysOverdue > 0) {
            await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'OVERDUE' } });
          }
        }
      }
    } catch (err) {
      console.error('❌ Payment reminder error:', err);
    }
  });
}

// ── Check PO delivery delays hourly ──────────────────────────────────────────
export function schedulePODelayCheck() {
  cron.schedule('0 * * * *', async () => {
    try {
      const overduePOs = await prisma.purchaseOrder.findMany({
        where: {
          status: { in: ['SENT', 'CONFIRMED'] },
          expectedDelivery: { lt: new Date() },
        },
        include: { vendor: true, material: true },
      });

      for (const po of overduePOs) {
        const existing = await prisma.alert.findFirst({
          where: {
            type: AlertType.SYSTEM,
            message: { contains: po.poNumber },
            sentAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
          },
        });
        if (existing) continue;

        const message = templates.poDeliveryDelay(
          po.poNumber,
          po.vendor.name,
          po.material.name,
          po.vendor.phone
        );

        const alert = await prisma.alert.create({
          data: {
            type: AlertType.SYSTEM,
            title: `PO Delay: ${po.poNumber}`,
            message,
            channel: AlertChannel.BOTH,
          },
        });

        emitAlert({ id: alert.id, type: alert.type, title: alert.title, message: alert.message, channel: alert.channel, sentAt: alert.sentAt });

        const groupNumber = await getSetting('alert_group_whatsapp');
        if (groupNumber) await sendWhatsApp(groupNumber, message);
      }
    } catch (err) {
      console.error('❌ PO delay check error:', err);
    }
  });
}

export function startAllJobs() {
  scheduleDailySummary();
  scheduleDispatchDelayCheck();
  schedulePaymentReminders();
  schedulePODelayCheck();
  console.log('⏰ All cron jobs started');
}
