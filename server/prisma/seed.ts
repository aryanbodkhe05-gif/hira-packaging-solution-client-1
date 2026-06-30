import { PrismaClient, UserRole, StockLogType, OrderStatus, MachineStatus, JobStatus, JobPriority, LeadStatus, LeadSource, InvoiceStatus, POStatus, AlertType, AlertChannel } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays, subDays, subHours } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding PackFlow ERP...');

  // ── Users ──────────────────────────────────────────────────────────────────
  // Hidden Developer account — full access, never shown in Users & Roles.
  // ⚠️ This plaintext seed password is for first-deploy only — ROTATE IT after.
  await prisma.user.upsert({
    where: { username: 'aryanbodkhe' },
    update: {},
    create: {
      name: 'Aryan Bodkhe',
      username: 'aryanbodkhe',
      passwordHash: await bcrypt.hash('aryandeveloper', 10),
      role: UserRole.DEVELOPER,
    },
  });

  const hashedPassword = await bcrypt.hash('packflow123', 10);

  const owner = await prisma.user.upsert({
    where: { username: 'rajeshkumar' },
    update: {},
    create: { name: 'Rajesh Kumar', username: 'rajeshkumar', passwordHash: hashedPassword, role: UserRole.OWNER },
  });

  const manager = await prisma.user.upsert({
    where: { username: 'priyasharma' },
    update: {},
    create: { name: 'Priya Sharma', username: 'priyasharma', passwordHash: hashedPassword, role: UserRole.MANAGER },
  });

  const staff1 = await prisma.user.upsert({
    where: { username: 'amitsingh' },
    update: {},
    create: { name: 'Amit Singh', username: 'amitsingh', passwordHash: hashedPassword, role: UserRole.STAFF },
  });

  console.log('✅ Users created (developer: aryanbodkhe / aryandeveloper)');

  // ── Vendors ────────────────────────────────────────────────────────────────
  const vendor1 = await prisma.vendor.upsert({
    where: { id: 'vendor-1' },
    update: {},
    create: {
      id: 'vendor-1',
      name: 'Bharat Paper Mills',
      contactName: 'Suresh Patel',
      phone: '+912245678901',
      email: 'supplies@bharatpaper.com',
      address: 'MIDC, Nagpur, Maharashtra',
      rating: 4.5,
      paymentTerms: 'Net 30',
    },
  });

  const vendor2 = await prisma.vendor.upsert({
    where: { id: 'vendor-2' },
    update: {},
    create: {
      id: 'vendor-2',
      name: 'Ink Masters Pvt. Ltd.',
      contactName: 'Deepak Mehta',
      phone: '+912267890123',
      email: 'orders@inkmasters.co.in',
      address: 'Andheri East, Mumbai',
      rating: 4.0,
      paymentTerms: 'Net 15',
    },
  });

  const vendor3 = await prisma.vendor.upsert({
    where: { id: 'vendor-3' },
    update: {},
    create: {
      id: 'vendor-3',
      name: 'Plastex India',
      contactName: 'Ramesh Gupta',
      phone: '+912289012345',
      email: 'sales@plastexindia.com',
      address: 'Vapi, Gujarat',
      rating: 3.8,
      paymentTerms: 'Net 45',
    },
  });

  console.log('✅ Vendors created');

  // ── Materials ──────────────────────────────────────────────────────────────
  const paperRoll = await prisma.material.upsert({
    where: { id: 'mat-1' },
    update: {},
    create: {
      id: 'mat-1',
      name: 'Paper Roll',
      unit: 'kg',
      currentStock: 480,
      reorderThreshold: 500,
      supplierId: vendor1.id,
    },
  });

  const ink = await prisma.material.upsert({
    where: { id: 'mat-2' },
    update: {},
    create: {
      id: 'mat-2',
      name: 'Printing Ink',
      unit: 'litre',
      currentStock: 85,
      reorderThreshold: 50,
      supplierId: vendor2.id,
    },
  });

  const adhesive = await prisma.material.upsert({
    where: { id: 'mat-3' },
    update: {},
    create: {
      id: 'mat-3',
      name: 'Adhesive',
      unit: 'kg',
      currentStock: 35,
      reorderThreshold: 40,
      supplierId: vendor3.id,
    },
  });

  const plasticFilm = await prisma.material.upsert({
    where: { id: 'mat-4' },
    update: {},
    create: {
      id: 'mat-4',
      name: 'Plastic Film',
      unit: 'roll',
      currentStock: 120,
      reorderThreshold: 80,
      supplierId: vendor3.id,
    },
  });

  const corrugatedSheet = await prisma.material.upsert({
    where: { id: 'mat-5' },
    update: {},
    create: {
      id: 'mat-5',
      name: 'Corrugated Sheet',
      unit: 'sheet',
      currentStock: 2200,
      reorderThreshold: 1000,
      supplierId: vendor1.id,
    },
  });

  // VendorMaterial pricing
  await prisma.vendorMaterial.upsert({
    where: { vendorId_materialId: { vendorId: vendor1.id, materialId: paperRoll.id } },
    update: {},
    create: { vendorId: vendor1.id, materialId: paperRoll.id, pricePerUnit: 45, leadTimeDays: 5, reliability: 4.5, isDefault: true },
  });
  await prisma.vendorMaterial.upsert({
    where: { vendorId_materialId: { vendorId: vendor2.id, materialId: ink.id } },
    update: {},
    create: { vendorId: vendor2.id, materialId: ink.id, pricePerUnit: 320, leadTimeDays: 3, reliability: 4.0, isDefault: true },
  });
  await prisma.vendorMaterial.upsert({
    where: { vendorId_materialId: { vendorId: vendor3.id, materialId: adhesive.id } },
    update: {},
    create: { vendorId: vendor3.id, materialId: adhesive.id, pricePerUnit: 180, leadTimeDays: 7, reliability: 3.8, isDefault: true },
  });
  await prisma.vendorMaterial.upsert({
    where: { vendorId_materialId: { vendorId: vendor3.id, materialId: plasticFilm.id } },
    update: {},
    create: { vendorId: vendor3.id, materialId: plasticFilm.id, pricePerUnit: 2200, leadTimeDays: 10, reliability: 3.8, isDefault: true },
  });

  console.log('✅ Materials & vendors created');

  // ── Stock Logs (last 30 days) ──────────────────────────────────────────────
  const stockEntries = [
    { materialId: paperRoll.id, type: StockLogType.IN, quantity: 1000, notes: 'Monthly stock', staffName: 'Amit Singh', daysAgo: 28 },
    { materialId: paperRoll.id, type: StockLogType.OUT, quantity: 250, notes: 'Production batch #1', staffName: 'Amit Singh', daysAgo: 25 },
    { materialId: paperRoll.id, type: StockLogType.OUT, quantity: 180, notes: 'Production batch #2', staffName: 'Priya Sharma', daysAgo: 20 },
    { materialId: paperRoll.id, type: StockLogType.OUT, quantity: 90, notes: 'Production batch #3', staffName: 'Amit Singh', daysAgo: 10 },
    { materialId: ink.id, type: StockLogType.IN, quantity: 200, notes: 'Bulk purchase', staffName: 'Priya Sharma', daysAgo: 15 },
    { materialId: ink.id, type: StockLogType.OUT, quantity: 115, notes: 'Various orders', staffName: 'Amit Singh', daysAgo: 5 },
    { materialId: adhesive.id, type: StockLogType.IN, quantity: 100, notes: 'Emergency restock', staffName: 'Priya Sharma', daysAgo: 20 },
    { materialId: adhesive.id, type: StockLogType.OUT, quantity: 65, notes: 'Production', staffName: 'Amit Singh', daysAgo: 8 },
    { materialId: plasticFilm.id, type: StockLogType.IN, quantity: 200, notes: 'Regular order', staffName: 'Priya Sharma', daysAgo: 22 },
    { materialId: plasticFilm.id, type: StockLogType.OUT, quantity: 80, notes: 'Shrink wrap orders', staffName: 'Amit Singh', daysAgo: 12 },
    { materialId: corrugatedSheet.id, type: StockLogType.IN, quantity: 5000, notes: 'Large consignment', staffName: 'Priya Sharma', daysAgo: 30 },
    { materialId: corrugatedSheet.id, type: StockLogType.OUT, quantity: 2800, notes: 'Carton box production', staffName: 'Amit Singh', daysAgo: 7 },
  ];

  for (const entry of stockEntries) {
    await prisma.stockLog.create({
      data: {
        materialId: entry.materialId,
        type: entry.type,
        quantity: entry.quantity,
        notes: entry.notes,
        staffName: entry.staffName,
        staffId: entry.staffName === 'Amit Singh' ? staff1.id : manager.id,
        createdAt: subDays(new Date(), entry.daysAgo),
      },
    });
  }

  console.log('✅ Stock logs created');

  // ── Clients ────────────────────────────────────────────────────────────────
  const clients = [
    { id: 'client-1', name: 'Reliance Retail Ltd.', phone: '+912234567890', email: 'procurement@relianceretail.in', gstNumber: '27AAACR5055K1ZU' },
    { id: 'client-2', name: 'BigBasket Foods', phone: '+912256789012', email: 'orders@bigbasket.com', gstNumber: '29AABCB4418H1ZM' },
    { id: 'client-3', name: 'D-Mart Avenues', phone: '+912278901234', email: 'packaging@dmart.in', gstNumber: '27AAECA3715J1ZA' },
    { id: 'client-4', name: 'Haldiram Snacks Pvt.', phone: '+912290123456', email: 'supply@haldirams.com', gstNumber: '07AAACH3462K1ZG' },
    { id: 'client-5', name: 'Mother Dairy', phone: '+911112345678', email: 'packaging@motherdairy.com', gstNumber: '07AAACM4849Q1ZV' },
  ];

  for (const client of clients) {
    await prisma.client.upsert({
      where: { id: client.id },
      update: {},
      create: client,
    });
  }

  console.log('✅ Clients created');

  // ── Orders ─────────────────────────────────────────────────────────────────
  const orderData = [
    { id: 'order-1', orderId: 'PKG-20260525-0001', clientId: 'client-1', productType: 'Corrugated Carton Box', quantity: 5000, deliveryDate: subDays(new Date(), 2), status: OrderStatus.READY, readyAt: subDays(new Date(), 3) },
    { id: 'order-2', orderId: 'PKG-20260526-0001', clientId: 'client-2', productType: 'Poly Bag 1kg', quantity: 20000, deliveryDate: addDays(new Date(), 2), status: OrderStatus.IN_PRODUCTION },
    { id: 'order-3', orderId: 'PKG-20260526-0002', clientId: 'client-3', productType: 'Printed Paper Bag', quantity: 10000, deliveryDate: addDays(new Date(), 5), status: OrderStatus.RECEIVED },
    { id: 'order-4', orderId: 'PKG-20260520-0001', clientId: 'client-4', productType: 'Snack Pouch 200g', quantity: 50000, deliveryDate: subDays(new Date(), 5), status: OrderStatus.DISPATCHED, dispatchedAt: subDays(new Date(), 4) },
    { id: 'order-5', orderId: 'PKG-20260527-0001', clientId: 'client-5', productType: 'Milk Pouch 500ml', quantity: 100000, deliveryDate: addDays(new Date(), 7), status: OrderStatus.QC_CHECK },
    { id: 'order-6', orderId: 'PKG-20260515-0001', clientId: 'client-1', productType: 'Heavy Duty Box', quantity: 2000, deliveryDate: subDays(new Date(), 10), status: OrderStatus.DISPATCHED, dispatchedAt: subDays(new Date(), 8) },
    { id: 'order-7', orderId: 'PKG-20260528-0001', clientId: 'client-2', productType: 'Shopping Bag', quantity: 15000, deliveryDate: subDays(new Date(), 1), status: OrderStatus.IN_PRODUCTION },
  ];

  for (const order of orderData) {
    await prisma.order.upsert({
      where: { id: order.id },
      update: {},
      create: {
        id: order.id,
        orderId: order.orderId,
        clientId: order.clientId,
        productType: order.productType,
        quantity: order.quantity,
        deliveryDate: order.deliveryDate,
        status: order.status,
        readyAt: order.readyAt,
        dispatchedAt: order.dispatchedAt,
        createdAt: subDays(new Date(), 10),
      },
    });
  }

  console.log('✅ Orders created');

  // ── Machines ───────────────────────────────────────────────────────────────
  const machines = [
    { id: 'machine-1', name: 'Flexo Press #1', type: 'Flexographic Printing', capacity: '5000 sqm/day', status: MachineStatus.ACTIVE },
    { id: 'machine-2', name: 'Die Cutter #1', type: 'Die Cutting', capacity: '8000 units/day', status: MachineStatus.IDLE },
    { id: 'machine-3', name: 'Laminator #1', type: 'Lamination', capacity: '3000 sqm/day', status: MachineStatus.ACTIVE },
    { id: 'machine-4', name: 'Corrugator #1', type: 'Corrugation', capacity: '2 tons/day', status: MachineStatus.MAINTENANCE },
  ];

  for (const machine of machines) {
    await prisma.machine.upsert({
      where: { id: machine.id },
      update: {},
      create: {
        ...machine,
        lastMaintenanceAt: subDays(new Date(), 30),
        nextMaintenanceAt: addDays(new Date(), 60),
      },
    });
  }

  // ── Jobs ───────────────────────────────────────────────────────────────────
  await prisma.job.upsert({
    where: { id: 'job-1' },
    update: {},
    create: {
      id: 'job-1',
      orderId: 'order-2',
      machineId: 'machine-1',
      priority: JobPriority.HIGH,
      startTime: subHours(new Date(), 3),
      expectedEnd: addDays(new Date(), 1),
      status: JobStatus.IN_PROGRESS,
    },
  });
  await prisma.job.upsert({
    where: { id: 'job-2' },
    update: {},
    create: {
      id: 'job-2',
      orderId: 'order-5',
      machineId: 'machine-3',
      priority: JobPriority.NORMAL,
      startTime: subHours(new Date(), 5),
      expectedEnd: addDays(new Date(), 2),
      status: JobStatus.QC_PENDING,
    },
  });

  console.log('✅ Machines & Jobs created');

  // ── Leads ──────────────────────────────────────────────────────────────────
  const leadsData = [
    { companyName: 'ITC Packaging', contactPerson: 'Ankit Verma', phone: '+912245678900', source: LeadSource.TRADE_SHOW, status: LeadStatus.INTERESTED, productInterest: 'Corrugated boxes', estimatedOrderSize: 500000 },
    { companyName: 'Amul Dairy', contactPerson: 'Vinod Shah', phone: '+912267890100', source: LeadSource.REFERRAL, status: LeadStatus.PROPOSAL_SENT, productInterest: 'Milk pouches', estimatedOrderSize: 2000000 },
    { companyName: 'Parle Products', contactPerson: 'Sunil Bakshi', phone: '+912289012300', source: LeadSource.COLD_CALL, status: LeadStatus.NEW, productInterest: 'Biscuit packaging', estimatedOrderSize: 750000 },
    { companyName: 'Patanjali Ayurved', contactPerson: 'Ravi Shankar', phone: '+912290123400', source: LeadSource.WEBSITE, status: LeadStatus.CONTACTED, productInterest: 'Product boxes', estimatedOrderSize: 300000 },
    { companyName: 'Britannia Industries', contactPerson: 'Pooja Nair', phone: '+911112345670', source: LeadSource.TRADE_SHOW, status: LeadStatus.WON, productInterest: 'Flexible packaging', estimatedOrderSize: 1200000 },
  ];

  for (const lead of leadsData) {
    await prisma.lead.create({
      data: {
        ...lead,
        lastContactedAt: subDays(new Date(), Math.floor(Math.random() * 7) + 1),
      },
    });
  }

  console.log('✅ Leads created');

  // ── Invoices ───────────────────────────────────────────────────────────────
  const inv1 = await prisma.invoice.upsert({
    where: { id: 'inv-1' },
    update: {},
    create: {
      id: 'inv-1',
      invoiceNumber: 'INV-20260520-0001',
      orderId: 'order-4',
      clientId: 'client-4',
      subtotal: 125000,
      gstRate: 18,
      gstAmount: 22500,
      totalAmount: 147500,
      dueDate: subDays(new Date(), 10),
      status: InvoiceStatus.OVERDUE,
    },
  });

  const inv2 = await prisma.invoice.upsert({
    where: { id: 'inv-2' },
    update: {},
    create: {
      id: 'inv-2',
      invoiceNumber: 'INV-20260515-0001',
      orderId: 'order-6',
      clientId: 'client-1',
      subtotal: 86000,
      gstRate: 18,
      gstAmount: 15480,
      totalAmount: 101480,
      dueDate: addDays(new Date(), 5),
      status: InvoiceStatus.SENT,
    },
  });

  console.log('✅ Invoices created');

  // ── Alerts ─────────────────────────────────────────────────────────────────
  await prisma.alert.createMany({
    data: [
      { type: AlertType.LOW_STOCK, title: 'Low Stock: Paper Roll', message: '🚨 LOW STOCK — Paper Roll: 480kg remaining (~2 days est.)', channel: AlertChannel.BOTH, seen: false },
      { type: AlertType.LOW_STOCK, title: 'Low Stock: Adhesive', message: '🚨 LOW STOCK — Adhesive: 35kg remaining (~1 day est.)', channel: AlertChannel.BOTH, seen: false },
      { type: AlertType.OVERDUE_ORDER, title: 'Overdue Order: PKG-20260528-0001', message: '⏰ OVERDUE ORDER PKG-20260528-0001 — BigBasket Foods. Due: Yesterday. Status: In Production', channel: AlertChannel.BOTH, seen: false },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Alerts created');

  // ── Purchase Orders ────────────────────────────────────────────────────────
  await prisma.purchaseOrder.upsert({
    where: { id: 'po-1' },
    update: {},
    create: {
      id: 'po-1',
      poNumber: 'PO-20260601-0001',
      vendorId: vendor1.id,
      materialId: paperRoll.id,
      quantity: 2000,
      unit: 'kg',
      pricePerUnit: 45,
      totalAmount: 90000,
      expectedDelivery: addDays(new Date(), 5),
      status: POStatus.DRAFT,
    },
  });

  // ── Settings ───────────────────────────────────────────────────────────────
  const settings = [
    { key: 'company_name', value: 'PackFlow Industries Pvt. Ltd.' },
    { key: 'company_gst', value: '27AADCP6099M1Z3' },
    { key: 'company_address', value: 'Plot 12, MIDC Industrial Area, Nagpur, Maharashtra - 440028' },
    { key: 'owner_whatsapp', value: '+919876543210' },
    { key: 'alert_group_whatsapp', value: '+919876543210' },
    { key: 'working_hours_start', value: '09:00' },
    { key: 'working_hours_end', value: '18:00' },
    { key: 'daily_summary_time', value: '08:00' },
    { key: 'alert_whatsapp_low_stock', value: 'true' },
    { key: 'alert_whatsapp_overdue_order', value: 'true' },
    { key: 'alert_whatsapp_machine_down', value: 'true' },
    { key: 'alert_whatsapp_payment_default', value: 'true' },
    { key: 'alert_whatsapp_dispatch_delay', value: 'true' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log('✅ Settings created');
  console.log('\n🎉 Seed complete! Login with: owner@packflow.in / packflow123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
