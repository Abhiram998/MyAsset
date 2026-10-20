# MyAsset — Full-Stack Intelligent Asset Management Platform

An enterprise-grade, real-time asset tracking, dispatch, and lifecycle management platform built with Vanilla HTML/CSS/JavaScript, Node.js, Express, and SQLite.

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- Node.js (v18.x or later recommended)
- npm (v9.x or later)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Abhiram998/MyAsset.git
cd MyAsset
npm install
```

### 3. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Configure your `.env` settings as needed:
```env
PORT=3000
NODE_ENV=development
COOKIE_SECRET=change_this_to_a_secure_random_secret_in_production
DB_PATH=./server/db/myasset.sqlite
```

### 4. Running the Application
Start the backend and frontend dev server:
```bash
npm start
```
The server will automatically apply SQLite database migrations from `server/db/migrations/` and launch the application on [http://localhost:3000](http://localhost:3000).

### 5. Running Automated Tests
Run the end-to-end integration test suite:
```bash
npm test
```

---

## 👥 Pre-Configured Test Credentials

| Role | Email | Password | Primary Interface / Features |
|---|---|---|---|
| **Admin** | `admin@test.com` | `password123` | Full administrative control, user/role management, settings, audit trail |
| **Operations Manager** | `ops@test.com` | `password123` | Asset register, global checkouts, alerts resolution, analytics & CSV export |
| **Site / Crew Supervisor** | `supervisor@test.com` | `password123` | Zone stationed inventory, crew assignments, task dispatch |
| **Maintenance Staff** | `maintenance@test.com` | `password123` | Diagnostics, service scheduling, maintenance requests & work orders |
| **Field Worker** | `field@test.com` | `password123` | Mobile field portal (`field.html`), assigned equipment check-in, task lifecycle |

---

## 🏗️ Architecture & Technology Stack

- **Frontend:** Vanilla HTML5, CSS3 with modern design tokens (`tokens.css`), responsive layout, native JavaScript ES6+ fetch API.
- **Backend:** Node.js, Express REST API prefix (`/api/v1/`).
- **Database:** SQLite with `better-sqlite3`, WAL mode, foreign key enforcement, transaction integrity, and migration runner.
- **Authentication:** Session JWT in HTTP-Only, SameSite strict cookies, bcrypt password hashing.
- **Authorization:** Strict 5-role Role-Based Access Control (RBAC), organization isolation, zone-based scoping, and worker task isolation.

---

## 📁 Repository Structure

```text
├── client/                     # Frontend client application
│   ├── css/tokens.css          # Design system tokens and styling
│   ├── js/                     # Client application scripts (shell.js, etc.)
│   └── pages/                  # Production HTML5 application pages
│       ├── overview.html       # Executive analytics dashboard
│       ├── assets.html         # Equipment register, filters, drawer, CSV export
│       ├── asset-details.html  # Dynamic asset timeline, assignments, maintenance
│       ├── assignments.html    # Checkouts, active assignments, conflict check
│       ├── employees.html      # Crew directory and zone linking
│       ├── locations.html      # Job sites, zones, and stationed asset counts
│       ├── maintenance.html    # Service scheduling and diagnostic metrics
│       ├── requests.html       # Maintenance requests and approval queue
│       ├── alerts.html         # Real-time alert center and resolution
│       ├── activity.html       # Immutable system audit trail
│       ├── reports.html        # Aggregated BI metrics and CSV downloads
│       ├── settings.html       # Company profile and planned RFID configuration
│       ├── field.html          # Mobile worker view with task transitions
│       ├── admin.html          # User administration and role editor
│       └── login.html          # Authentication portal
├── server/                     # Backend Express REST API
│   ├── controllers/            # Route controllers
│   ├── db/                     # Database connection, schema migrations, and seeds
│   │   ├── migrations/         # SQL migration files executed automatically
│   │   └── seed/               # Initial seed data
│   ├── middleware/             # Auth, role authorization, rate limiter
│   ├── repositories/           # Database access layer (parameterized SQL)
│   ├── routes/                 # Express API routes (/api/v1/*)
│   ├── services/               # Business logic, conflict checks, transactions
│   └── server.js               # Express application entry point
├── tests/                      # Automated test suites
│   └── api.test.js             # 16-suite end-to-end integration and security test
├── docs/                       # Project architecture blueprints and specifications
└── screenshots/                # Rendered application screenshot library
```

---

## ☁️ Vercel Cloud Deployment

MyAsset is configured for zero-configuration Git deployment on Vercel:
- **Serverless Entrypoint:** `api/index.js` wraps the Express backend.
- **Static Edge Delivery:** `vercel.json` configures edge caching for `/pages/*`, `/css/*`, and `/js/*`.
- **Database Persistence:** Managed PostgreSQL (Neon / Vercel Postgres / Supabase) via `POSTGRES_URL`.
- **Migration & Export Tools:**
  - `npm run db:export:pg`: Safely extracts SQLite records into a PostgreSQL SQL import script.
  - `npm run db:migrate:pg`: Applies `001_postgres_schema.sql` to your remote PostgreSQL instance.

For the step-by-step setup guide and environment variable reference, see [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md).

---

## 📜 Documentation Reference
- `docs/VERCEL_DEPLOYMENT.md` — Complete Vercel deployment, PostgreSQL configuration, and security guide.
- `docs/MyAsset_UIUX_Architecture_Spec.md` — Complete UI/UX specification, role definitions, and sitemap.
- `chat_transcript.md` — Historical project record and engineering milestones.
- `uploads/` — Design blueprints and reference documentation.
