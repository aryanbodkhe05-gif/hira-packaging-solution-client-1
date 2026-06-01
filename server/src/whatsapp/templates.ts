import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const IST = 'Asia/Kolkata';

function istDate(date: Date): Date {
  return toZonedTime(date, IST);
}

export const templates = {
  lowStock: (material: string, qty: number, unit: string, threshold: number, supplier: string, phone: string) =>
    `🚨 *LOW STOCK ALERT* — ${material}: ${qty}${unit} remaining (threshold: ${threshold}${unit}).\nReorder from Supplier: ${supplier}. Contact: ${phone}`,

  orderDispatched: (clientName: string, orderId: string, tracking: string, deliveryDate: Date, company: string) =>
    `✅ Namaste ${clientName}, your order *${orderId}* has been dispatched.\nTracking: ${tracking || 'N/A'}. Expected delivery: ${format(istDate(deliveryDate), 'dd MMM yyyy')}.\n— ${company}`,

  dispatchDelay: (orderId: string, clientName: string, hoursReady: number) =>
    `⚠️ ORDER *${orderId}* has been ready for dispatch for *${hoursReady} hours*.\nClient: ${clientName}. Action needed.`,

  machineIdle: (machineName: string, hoursIdle: number, reason: string) =>
    `⚙️ Machine *${machineName}* has been idle for *${hoursIdle} hours*.\nReason logged: ${reason}. Please check.`,

  paymentDue: (clientName: string, invoiceId: string, amount: number) =>
    `🙏 Namaste ${clientName}, invoice *${invoiceId}* for ₹${amount.toLocaleString('en-IN')} is due today. Please arrange payment at your earliest convenience.`,

  paymentOverdue3: (clientName: string, invoiceId: string, amount: number) =>
    `📋 Gentle reminder: Invoice *${invoiceId}* for ₹${amount.toLocaleString('en-IN')} from ${clientName} is 3 days overdue. Kindly clear at the earliest.`,

  paymentOverdue7: (clientName: string, invoiceId: string, amount: number) =>
    `⚠️ *PAYMENT OVERDUE* — Invoice *${invoiceId}* for ₹${amount.toLocaleString('en-IN')} from *${clientName}* is 7+ days overdue. Immediate action required.`,

  poDeliveryDelay: (poId: string, supplier: string, material: string, phone: string) =>
    `📦 PO *${poId}* from *${supplier}* was expected today but not confirmed.\nMaterial: ${material}. Contact: ${phone}`,

  followUpReminder: (company: string, daysSince: number, lastAction: string, phone: string) =>
    `📋 *FOLLOW-UP REMINDER*: ${company} hasn't been contacted in *${daysSince} days*.\nLast action: ${lastAction}. Contact: ${phone}`,

  dailySummary: (data: {
    date: string;
    pendingDispatch: number;
    overdueOrders: number;
    dispatchedYesterday: number;
    lowStockItems: string[];
    outstandingAmount: number;
    outstandingClients: number;
    invoicesDueToday: number;
    newLeads: number;
    followUpsDue: number;
    jobsInProgress: number;
    downtimeEvents: number;
    companyName: string;
  }) => {
    const lowStockList = data.lowStockItems.length > 0
      ? data.lowStockItems.join(', ')
      : 'None ✅';

    return `🏭 *${data.companyName} Daily Report — ${data.date}*

📦 *Orders*
- Pending dispatch: ${data.pendingDispatch} orders
- Overdue: ${data.overdueOrders} orders
- Dispatched today: ${data.dispatchedYesterday} orders

📉 *Inventory*
- Low stock items: ${lowStockList}

💰 *Finance*
- Outstanding: ₹${data.outstandingAmount.toLocaleString('en-IN')} from ${data.outstandingClients} clients
- Invoices due today: ${data.invoicesDueToday}

👥 *CRM*
- New leads: ${data.newLeads}
- Follow-ups due: ${data.followUpsDue}

⚙️ *Production*
- Jobs in progress: ${data.jobsInProgress}
- Downtime events logged: ${data.downtimeEvents}

*Have a productive day! — PackFlow ERP*`;
  },
};
