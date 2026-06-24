# LeadCRM

A SaaS-based Progressive Web CRM system for lead management and workflow automation.

Built for IT solutions providers, security firms, and telecom agencies. Multi-tenant, RBAC-enforced, and designed to scale from a capstone project to a real SaaS product.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, Tailwind CSS v4, ShadCN, Chart.js |
| Backend | Node.js, Express.js, Prisma ORM |
| Database | PostgreSQL |
| Auth | NextAuth.js + JWT + RBAC |
| Integrations | Gmail API, PayMongo |
| Monorepo | Turborepo + npm workspaces |

---

## Project Structure

```
leadcrm/
├── frontend/      ← Next.js 15 SPA — CRM + Admin portals
├── backend/       ← Express.js API — domain-driven modules
├── shared/        ← @leadcrm/shared — types, RBAC, contracts, Zod schemas
├── infrastructure/← Docker, Nginx, deployment scripts
└── docs/          ← Architecture, API spec, project documentation
```

See [docs/STRUCTURE.md](./docs/STRUCTURE.md) for the complete folder map.

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- npm 9+

### 1. Clone and install

```bash
git clone https://github.com/your-org/leadcrm.git
cd leadcrm
npm install
```

### 2. Set up environment variables

```bash
# Frontend
cp frontend/.env.local.example frontend/.env.local

# Backend
cp backend/.env.example backend/.env
# Edit backend/.env — set DATABASE_URL, JWT_SECRET, etc.
```

### 3. Run database migrations

```bash
cd backend
npx prisma migrate dev
npx ts-node prisma/seed.ts
```

### 4. Start development

```bash
# From the monorepo root — starts all packages
npm run dev

# Or start frontend only
cd frontend && npm run dev

# Or start backend only
cd backend && npm run dev
```

Frontend runs at `http://localhost:3000`
Backend runs at `http://localhost:4000`

---

## Development Status

| Package | Status |
|---|---|
| Frontend | ✅ Active — full SPA with localStorage data layer |
| Backend | 🔲 Scaffolded — structure complete, DB integration pending |
| Shared | ✅ Complete — types, RBAC constants, contracts, validation |

---

## Portal Access

| Portal | URL | Who |
|---|---|---|
| CRM Portal | `http://localhost:3000` | Client Admin, Sales Rep, Viewer, Technician |
| Admin Portal | `http://localhost:3000` (role-based routing) | System Admin only |

---

## Key Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Project Structure](./docs/STRUCTURE.md)
- [Portal Separation](./docs/PORTAL-SEPARATION.md)
- [API Spec](./docs/API.md)
- [Capstone Documentation](./docs/capstone-documentation.md)

---

## Team

Mica Pauline P. Calingo · Nicolette Lei Marc T. Cuison · Reymark J. Panes · Julie Ann C. Tiron

Adviser: Dexter B. Oseña — STI College Global City
