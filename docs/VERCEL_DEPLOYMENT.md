# MyAsset — Vercel Deployment & Production Operations Guide

This guide details the complete deployment architecture and operational procedure for deploying **MyAsset** to **Vercel** with full data persistence.

---

## 1. Architectural Overview

```
                                      ┌───────────────────────────────────────────────┐
                                      │              Vercel Edge Network              │
                                      └──────────────────────┬────────────────────────┘
                                                             │
                              ┌──────────────────────────────┴──────────────────────────────┐
                              │                                                             │
                  Static Web Assets (/pages, /css, /js)                      API Requests (/api/v1/*, /api/*)
                              │                                                             │
                              ▼                                                             ▼
                   Vercel CDN Edge Cache                                      Vercel Serverless Function
               (Instant delivery, 0ms compute)                                    (`api/index.js`)
                                                                                            │
                                                                                            ▼
                                                                                   Express Application
                                                                                  (`server/server.js`)
                                                                                            │
                                                                                            ▼
                                                                                Managed PostgreSQL Database
                                                                               (Neon / Vercel Postgres)
```

### Key Differences: Local Development vs. Vercel Production
| Feature | Local Development | Vercel Production Deployment |
| :--- | :--- | :--- |
| **Server Runtime** | Persistent Node.js process (`npm start`) | Ephemeral Serverless Functions (`api/index.js`) |
| **Frontend Serving** | Express static middleware (`../client`) | Vercel CDN Edge Network (configured in `vercel.json`) |
| **Database Engine** | SQLite3 (`better-sqlite3` WAL) | Managed PostgreSQL (Neon / Vercel Postgres / Supabase) |
| **Database File** | `server/db/myasset.sqlite` (writable) | Remote connection via connection pooler (`DATABASE_URL`) |
| **HTTPS & Security** | HTTP (`http://localhost:3000`) | Edge SSL/TLS with HttpOnly, secure cookies & CSP |

---

## 2. Why SQLite Cannot Be Used as Production Persistence on Vercel

Vercel Functions execute inside serverless sandbox environments (AWS Lambda containers):
1. **Read-Only Root Filesystem**: The deployment bundle is mounted read-only (`EROFS`).
2. **Ephemeral `/tmp` Directory**: While `/tmp` is writable, it is discarded whenever the function scales to zero or rotates containers. Any SQLite database stored in `/tmp` will suffer from catastrophic data loss across cold starts and concurrent instances.
3. **Native C++ Module Mismatch**: `better-sqlite3` relies on native binaries compiled for the local architecture.

**The Solution:**
Production persistence uses a serverless-compatible managed PostgreSQL database (e.g., Vercel Postgres / Neon / Supabase). The repository includes complete PostgreSQL DDL migrations and data extraction scripts.

### 2.1 Node.js Engine Pinning (`20.x`) & Build Compatibility
When deploying to Vercel without a specified engine, Vercel defaults to Node.js `24.x`. In Node 24, V8 C++ API changes deprecate and remove legacy type conversion methods, causing older native modules (`better-sqlite3@9.6.0`) to fail compilation during `npm install`.

To guarantee build and runtime compatibility:
1. `package.json` specifies `"engines": { "node": "20.x" }` to pin Vercel builds and Serverless Functions to the stable Node.js 20 LTS runtime.
2. `better-sqlite3` is upgraded to `^11.8.1`, which contains prebuilt Linux x64 binaries and updated V8 bindings, preventing any native compilation errors.

---

## 3. Required Environment Variables

Configure these in the Vercel Dashboard under **Settings > Environment Variables**:

| Variable | Environment | Example / Value | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Production, Preview | `production` | Enables production security, secure cookies, and trusted proxy |
| `COOKIE_SECRET` | Production, Preview | `random_64_char_secret_string` | High-entropy key used to sign JWT authentication cookies |
| `POSTGRES_URL` | Production, Preview | `postgres://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require` | Managed PostgreSQL connection string (auto-set by Vercel Postgres) |
| `DATABASE_URL` | Production, Preview | Same as `POSTGRES_URL` | Fallback connection string alias |
| `ALLOWED_ORIGIN` | Production | `https://your-domain.vercel.app` (or blank) | Enforces CORS origin restrictions |

---

## 4. Step-by-Step Vercel Deployment Instructions

### Step 1: Provision Managed PostgreSQL
Choose one of the following recommended providers:
- **Option A: Vercel Postgres (Recommended - 1-Click)**
  1. Open your project in the [Vercel Dashboard](https://vercel.com/dashboard).
  2. Click the **Storage** tab.
  3. Select **Create Database** > **Postgres** (powered by Neon).
  4. Follow the prompt to connect the database to your project.
  5. Vercel automatically populates `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, etc., into your project environment variables.
- **Option B: Neon Serverless Postgres**
  1. Create a free project at [neon.tech](https://neon.tech).
  2. Copy the pooled connection string (`postgres://...sslmode=require`).
  3. Add it as `POSTGRES_URL` in Vercel **Settings > Environment Variables**.

### Step 2: Initialize Database Schema
Run the PostgreSQL schema migration against your managed database:
- **Via Vercel / Neon SQL Editor**:
  1. Open the Neon SQL Editor or Vercel Storage query tab.
  2. Copy the contents of [`server/db/migrations_pg/001_postgres_schema.sql`](file:///c:/Users/abhir/Downloads/myasset_full_chat_updated/myasset_full_chat/myasset_full_chat/final_project/server/db/migrations_pg/001_postgres_schema.sql).
  3. Execute the script. It creates all 24 tables, indexes, constraints, and default roles.
- **Or via Local CLI (if `POSTGRES_URL` is set in `.env`)**:
  ```bash
  npm run db:migrate:pg
  ```

### Step 3: (Optional) Export & Migrate Existing SQLite Data
If you have local assets, assignments, or employees you wish to preserve in production:
1. Run the safe data export script:
   ```bash
   npm run db:export:pg
   ```
2. This generates `server/db/export_to_postgres.sql`.
3. Open the file, review the records, and execute it against your PostgreSQL database using the Neon SQL Editor or `psql`:
   ```bash
   psql "$POSTGRES_URL" -f server/db/export_to_postgres.sql
   ```

### Step 4: Import Project into Vercel
1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New... > Project**.
3. Select the repository: `https://github.com/Abhiram998/MyAsset.git` (`Abhiram998/MyAsset`).
4. In **Project Settings**:
   - **Framework Preset**: Other
   - **Root Directory**: `final_project` (or root `./` depending on repository structure)
   - **Build Command**: Leave default (empty)
   - **Output Directory**: Leave default (empty)
5. Add the Environment Variables from Section 3 (`COOKIE_SECRET`, `NODE_ENV=production`, `POSTGRES_URL`).
6. Click **Deploy**.

---

## 5. Verifying the Deployment

Once the deployment completes:
1. **Health Check**:
   Visit `https://<your-project>.vercel.app/api/health`.
   Expected response: `{"status":"ok","timestamp":"..."}`
2. **Documentation Check**:
   Visit `https://<your-project>.vercel.app/api/docs`.
   Expected response: OpenAPI 3.0 specification JSON.
3. **Frontend Page Load**:
   Visit `https://<your-project>.vercel.app/pages/login.html`.
   Ensure styles (`tokens.css`), scripts, and images load without 404s.
4. **Authentication Test**:
   Log in with a seeded administrator or operational user. Verify that the session cookie (`token`) is set with `HttpOnly`, `Secure`, and `SameSite=Strict` attributes.
5. **Asset & Task Persistence**:
   Create a test asset and assign a task. Refresh the page and open in an incognito window to verify records persist across separate serverless function invocations.

---

## 6. Local Development Continuation

Local development continues to use SQLite without any external dependency:
```bash
# Start local server
npm start

# Run automated integration tests
npm test

# Create safe online backup of local SQLite
npm run db:backup
```
All 18 test suites remain 100% green.
