# 🏭 Hira Packaging Solution

> A premium ERP system built for Indian PP (polypropylene) packaging manufacturing businesses. Unified operations dashboard with real-time alerts, WhatsApp automation, and live production tracking — including PP fabric (tape) production and loom management.

![Hira Packaging Solution](https://img.shields.io/badge/Hira-Packaging-3131B5?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMyAxMGgzTDkgM3Y2SDZsNyAxMVYxM3oiLz48L3N2Zz4=)
![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

---

## 🌐 Live Demo

> **Live URL:** https://aryanbodkhe05-gif.github.io/hira-packaging-solution-client-1/
>
> Runs entirely in the browser (data stored in localStorage). If you've opened an
> older build, use **Master → Settings → Reset to Demo Data** and hard-refresh.

---

## 💻 Local Preview

> **Localhost URL:** http://localhost:5173/
>
> Start it with `cd client && npm install && npm run dev`, then open the URL above.
>
> Handy routes:
> - Dashboard — http://localhost:5173/
> - PP Fabric Production — http://localhost:5173/pp-fabric
> - Loom Production — http://localhost:5173/loom
>
> No login required — the app opens straight to the dashboard (data is stored locally in your browser).

---

## ✨ Features

### 8 Integrated Modules

| Module | Status | Description |
|--------|--------|-------------|
| 📦 **Inventory Tracker** | ✅ Live | Raw material stock management, reorder alerts, 30-day history chart |
| 🛒 **Order Management** | ✅ Live | Full order pipeline — Received → In Production → QC → Ready → Dispatched |
| 🚚 **Dispatch Tracker** | 🔨 Building | One-click dispatch + auto WhatsApp to clients |
| ⚙️ **Production Monitor** | 🔨 Building | Machine registry, job queue, downtime logging |
| 👥 **Sales CRM** | 🔨 Building | Lead pipeline with follow-up reminders |
| 💰 **Finance & Billing** | 🔨 Building | GST invoices, payment aging, P&L |
| 🏢 **Vendor & Purchase** | 🔨 Building | PO automation, supplier comparison |
| 🔔 **Alert Engine** | ✅ Live | Real-time cross-module alerts via Socket.io + WhatsApp |

### Key Capabilities
- 🔴 **Real-time alerts** — Socket.io live notifications with sound + red badge counter
- 📱 **WhatsApp automation** — Twilio-powered messages for low stock, dispatch, payments
- 🌙 **Premium dark UI** — Glass-morphism cards, IST live clock, collapsible sidebar
- 📊 **Stock history charts** — 30-day bar charts using Recharts
- 🔐 **JWT auth** — Role-based access: Owner, Manager, Staff
- ⏰ **Cron jobs** — Daily 8 AM WhatsApp summary, overdue checks, payment reminders

---

## 🖥️ Screenshots

### Dashboard
The owner dashboard shows real-time stats across all modules — orders in pipeline, low stock alerts, unread notifications, and quick action shortcuts.

### Inventory Tracker (Module 1)
Full raw material management with:
- Color-coded stock level progress bars (green → orange → red)
- One-click Stock In / Stock Out modals with staff attribution
- Critical stock banner with pulsing animation + auto WhatsApp alert
- 30-day stock history bar chart per material
- Expandable rows showing supplier pricing & lead times

### Order Management (Module 2)
- Auto-generated Order IDs (`PKG-20260601-0001` format)
- Status pipeline with color-coded badges
- Overdue orders auto-flagged in red
- WhatsApp dispatch confirmation sent to client automatically

---

## 🛠️ Tech Stack

### Frontend
| Tech | Purpose |
|------|---------|
| React 18 + Vite | UI framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling + design system |
| Recharts | Stock history charts |
| Socket.io-client | Real-time alerts |
| React Router v6 | Navigation |
| Lucide React | Icons |
| React Hot Toast | Notifications |

### Backend
| Tech | Purpose |
|------|---------|
| Node.js + Express | REST API server |
| TypeScript | Type safety |
| Prisma ORM | Database access |
| PostgreSQL | Primary database |
| Socket.io | Real-time WebSocket |
| node-cron | Scheduled jobs |
| Twilio | WhatsApp Business API |
| JWT + bcrypt | Authentication |
| Zod | Request validation |

---

## 🗄️ Database Schema

14 Prisma models covering all 8 modules:

```
User · Material · StockLog · Client · Order
Machine · Job · DowntimeLog · Lead · Invoice
Vendor · VendorMaterial · PurchaseOrder · Alert · Setting
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (any version)
- npm

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/aryanbodkhe05-gif/packflow-erp.git
cd packflow-erp
```

**2. Install all dependencies**
```bash
# Install client dependencies
cd client && npm install

# Install server dependencies
cd ../server && npm install
```

**3. Configure environment**
```bash
cd server
cp .env.example .env
```

Edit `server/.env`:
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:YOUR_PORT/packflow_erp"
JWT_SECRET="your-secret-key"
PORT=3001
CLIENT_URL="http://localhost:5173"
```

**4. Set up the database**
```bash
cd server
npx prisma migrate dev --name init
# This also runs the seed automatically
```

**5. Start the servers**

Terminal 1 — Backend:
```bash
cd server
npm run dev
# → 🚀 PackFlow ERP server running on port 3001
```

Terminal 2 — Frontend:
```bash
cd client
npm run dev
# → http://localhost:5173
```

**6. Open in browser**

👉 **http://localhost:5173**

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@packflow.in | packflow123 |
| Manager | manager@packflow.in | packflow123 |
| Staff | staff1@packflow.in | packflow123 |

---

## 📁 Folder Structure

```
packflow-erp/
├── client/                    # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── layout/        # Sidebar, Topbar, AppLayout
│       │   └── ui/            # Badge, Modal, StatCard, etc.
│       ├── context/           # AuthContext, AlertContext
│       ├── hooks/             # useLiveClock
│       ├── lib/               # api.ts, utils.ts
│       ├── pages/             # All page components
│       └── types/             # TypeScript types
│
├── server/                    # Express + Prisma backend
│   ├── prisma/
│   │   ├── schema.prisma      # 14 database models
│   │   └── seed.ts            # Demo data seeder
│   └── src/
│       ├── jobs/              # node-cron scheduled jobs
│       ├── lib/               # Prisma client, Socket.io
│       ├── middleware/        # JWT auth
│       ├── routes/            # API route handlers
│       └── whatsapp/          # Templates + Twilio client
│
└── README.md
```

---

## 📱 WhatsApp Automation Templates

The system sends automated WhatsApp messages for:

- 🚨 **Low Stock** — when material drops below reorder threshold
- ✅ **Order Dispatched** — confirmation to client with tracking
- ⚠️ **Dispatch Delay** — if order ready > 24h without shipping
- 💸 **Payment Reminders** — Day 0, Day 3, Day 7 overdue
- 📦 **PO Delays** — when supplier delivery is late
- 🏭 **Daily Summary** — 8:00 AM IST report to owner

---

## 🎨 Design System

```
Primary Blue:     #3131B5
Deep Navy:        #1A1A70
Dark Background:  #0E0E3A
Accent Light:     #5E5EE8
Success Green:    #12B76A
Muted Gray:       #8888AA

Fonts: Inter (UI) + JetBrains Mono (metrics/IDs)
Cards: Glass-morphism with backdrop-blur
```

---

## 🗺️ Roadmap

- [x] Module 1 — Inventory Tracker
- [x] Module 2 — Order Management
- [x] Module 8 — Alert Engine (real-time)
- [ ] Module 3 — Dispatch Tracker
- [ ] Module 4 — Production Monitor
- [ ] Module 5 — Sales CRM
- [ ] Module 6 — Finance & Billing (PDF invoices)
- [ ] Module 7 — Vendor & Purchase Automation
- [ ] Module 9 — WhatsApp Daily Summary
- [ ] Settings Page (company info, thresholds, staff)
- [ ] Mobile responsive polish

---

## 👤 Author

**Aryan Bodkhe**
- GitHub: [@aryanbodkhe05-gif](https://github.com/aryanbodkhe05-gif)

---

*Built with ❤️ for Indian manufacturing businesses*
