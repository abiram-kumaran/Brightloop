# Brightloop — Subscription Management & Recurring Billing System

> Built for the Odoo Makeathon (8-hour hackathon). Brightloop is a unified, high-performance subscription lifecycle, recurring billing, and revenue operations platform replacing spreadsheets and disconnected SaaS billing tools.

---

## 1. Quickstart & Zero-Setup Run

Brightloop is configured with a **Dual-Mode Database Architecture**:
- If `DATABASE_URL` is configured, it connects directly to PostgreSQL with high-throughput connection pooling.
- If no external PostgreSQL instance is running, it **automatically runs embedded PostgreSQL via in-process PGlite (WASM)**. Zero external Docker or database dependencies required to run or evaluate!

### Prerequisites
- Node.js 20+
- npm 9+

### Commands

```bash
# 1. Clone the repository and enter Web-app directory
cd Web-app

# 2. Install workspace dependencies
npm install

# 3. Apply database migrations and seed demo accounts
npm run db:migrate
npm run db:seed

# 4. Run the automated test suites (Auth, Catalog, Subscriptions, Billing Engine)
npm run test

# 5. Start the full-stack development environment (Fastify API on :3000, Vite Web on :5173)
npm run dev
```

Visit the application at:
- **Customer Website & Portal**: `http://localhost:5173/`
- **Internal Company Portal**: `http://localhost:5173/company/login`
- **Interactive OpenAPI / Swagger Docs**: `http://localhost:3000/docs`

---

## 2. Demo User Credentials

| Role | Email | Password | Allowed Workspace |
|---|---|---|---|
| **Admin** | `admin@brightloop.com` | `Admin@12345` | `/admin` (Full system configuration, products, plans, staff, taxes, discounts, reports) |
| **Manager** | `manager@brightloop.com` | `Manager@12345` | `/staff` (Operational workspace with credit note & payment approval permissions) |
| **Staff** | `staff@brightloop.com` | `Staff@12345` | `/staff` (Customer onboarding, quotations, subscriptions, payments) |
| **Customer** | `alice@customer.com` | `Customer@12345` | `/portal` (Self-service subscriptions, tax invoices, payment history, support) |

---

## 3. Core Architecture & Architectural Decisions

```
Web-app/
├── apps/
│   ├── api/                    # Fastify 5 + TypeScript Backend REST API
│   │   ├── src/
│   │   │   ├── app.ts          # Fastify app factory with Swagger & Security plugins
│   │   │   ├── config.ts       # Environment parsing & validation
│   │   │   ├── db/             # Dual-mode PG pool & migration/seed runners
│   │   │   └── modules/        # Modular domain slices
│   │   │       ├── auth/       # Argon2/JWT authentication & RBAC guards
│   │   │       ├── catalog/    # Products, variants, plans, tax rules, discounts
│   │   │       ├── subscriptions/ # Quotations & 7-stage state machine
│   │   │       ├── billing/    # Recurring billing engine, idempotency, payments
│   │   │       ├── reports/    # Executive financial KPIs & MRR waterfall
│   │   │       └── support/    # On-premise customer chatbot & ticket escalation
│   └── web/                    # React 19 + Vite 6 + Tailwind CSS Frontend
│       ├── src/
│       │   ├── layouts/        # Distinct layouts (Public, Admin, Staff, Customer)
│       │   ├── pages/          # Full product screens
│       │   └── components/     # Accessible Warm Editorial UI component kit
└── packages/
    └── shared/                 # Shared TypeScript domain contracts, Zod schemas, money/date math
```

### Key Engineering Invariants
1. **Two Distinct Entry Experiences**:
   - The public website (`/`, `/signup`, `/login`) contains zero internal staff/admin links.
   - The company portal (`/company/login`) is shared by Admin and Staff. The user's role is retrieved from trusted backend claims after authentication—never selected via a client-side dropdown.
2. **Paise Integer Arithmetic**:
   - All financial amounts are stored and calculated as 64-bit integer paise (1 INR = 100 paise). Zero floating-point rounding errors (`0.1 + 0.2 !== 0.3`).
3. **GST Engine with State Code Matching**:
   - Automated tax computation determines Intra-State (CGST + SGST) vs Inter-State (IGST) by comparing company supplier state with customer place of supply.
4. **Billing Engine Idempotency**:
   - The recurring billing engine evaluates active subscriptions against their `anchor_day`.
   - Guaranteed composite uniqueness `(subscription_id, period_start)` prevents duplicate invoice generation under cron retries or concurrent executions.
5. **Subscription Lifecycle State Machine**:
   - Enforces strict transitions: `Draft -> Quotation -> Confirmed -> Active -> Paused -> Resumed -> Closed`. Every transition records an immutable audit log entry.
6. **Strict Customer Data Isolation**:
   - Database queries enforce `WHERE customer_id = authenticated_customer_id`, preventing Insecure Direct Object References (IDOR).

---

## 4. Rehearsed 7-Minute Demo Script for Judges

| Time | Persona | Action & Demonstration | Key Engineering Point |
|---|---|---|---|
| **0:00 - 1:00** | **Visitor** | Open `/`. Inspect the Warm Editorial landing page. Note absence of admin/staff links. | Clean dual-door entry design. |
| **1:00 - 2:00** | **Customer** | Sign up new customer at `/signup`. Verify client/server password policy (uppercase, lowercase, special char). Login and land in `/portal`. | Real authentication, argon2/bcrypt password hashing, JWT cookies. |
| **2:00 - 3:00** | **Admin** | Open `/company/login` in incognito window. Log in as `admin@brightloop.com`. Auto-routed to `/admin`. Create Product with +₹560 variant and Monthly Subscription Plan. | Dynamic pricing models without hardcoding; relational schema. |
| **3:00 - 4:00** | **Staff** | Log in as `staff@brightloop.com`. Create a Quotation for the customer. Transition Quotation -> Confirmed -> Active subscription with Stepper UI. | 7-stage state machine with immutable audit trail. |
| **4:00 - 5:00** | **Admin** | In `/admin/invoices`, click **⚡ Run Billing Job**. Choose today's date. Observe generated invoice with GST tax calculation. Re-run to demonstrate **0 duplicate invoices**. | Anchor date recurring billing engine with strict idempotency. |
| **5:00 - 6:00** | **Staff** | Click **Record Pay** on the confirmed invoice. Record ₹5,900 via Bank Transfer. Invoice status transitions to **Paid**. | Immutable payments ledger and automatic reconciliation. |
| **6:00 - 7:00** | **Customer** | Switch back to `/portal`. View updated subscription, invoice, and payment history. Ask the **Virtual Assistant Chatbot** "What is my balance?". | Real-time isolation, customer self-service, on-premise chatbot. |
| **7:00 - 7:30** | **Executive** | Open `/admin/reports`. Inspect live KPI cards (Active Subscriptions, MRR, Collected Revenue, Outstanding Balance) and Overdue Aging. | Executive reporting distinguishing collected cash from invoiced sums. |
