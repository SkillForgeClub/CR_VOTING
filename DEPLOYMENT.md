# 🏛️ VIIT CR ELECTIONS 2026 - PRODUCTION DEPLOYMENT & OPERATIONS MANUAL

**Institution:** Vignan's Institute of Information Technology (Autonomous)  
**Department:** Department of Data Science  
**Developed by:** SkillForge Club  
**Architecture:** Node.js Express Backend + React 19 SPA + Supabase PostgreSQL (Cloud) / Embedded ACID Store  

---

## 📑 Table of Contents
1. [Prerequisites & Architecture Overview](#1-prerequisites--architecture-overview)
2. [Database Setup (Supabase PostgreSQL)](#2-database-setup-supabase-postgresql)
3. [Environment Variables Reference](#3-environment-variables-reference)
4. [Deployment Option A: Render (Recommended Fullstack)](#4-deployment-option-a-render-recommended-fullstack)
5. [Deployment Option B: Railway (One-Click)](#5-deployment-option-b-railway-one-click)
6. [Deployment Option C: Docker Container (VPS / AWS / DigitalOcean)](#6-deployment-option-c-docker-container-vps--aws--digitalocean)
7. [Deployment Option D: Vercel (Split Frontend/Serverless)](#7-deployment-option-d-vercel-split-frontendserverless)
8. [Election Day Operations Runbook](#8-election-day-operations-runbook)
9. [Troubleshooting & Health Checks](#9-troubleshooting--health-checks)

---

## 1. Prerequisites & Architecture Overview

The application is structured to run as a single unified production container or Node.js service:
- **Express Backend (`server.js`):** Authoritative API handling student authentication, ballot transaction mutex, cryptographic reference generation, and admin governance.
- **Frontend SPA (`dist/`):** React 19 + Vite compiled bundle served directly by Express in production mode with zero CORS overhead.
- **Dual-Layer Database:** Supabase PostgreSQL for cloud persistence with automatic stored procedure RPCs + local fallback engine for zero downtime.

---

## 2. Database Setup (Supabase PostgreSQL)

### Step 2.1 — Create Supabase Project
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new project named `VIIT-CR-Elections-2026`.
3. Note your **Project URL** (e.g., `https://eifcxmtefuawxbhtfvhb.supabase.co`).

### Step 2.2 — Execute SQL Schema & Policies
In your Supabase **SQL Editor**, execute the migration files located in `supabase/migrations/` in this exact order:

1. **Schema & Tables:** [`supabase/migrations/20260101000001_initial_schema.sql`](supabase/migrations/20260101000001_initial_schema.sql)
2. **Row Level Security (RLS):** [`supabase/migrations/20260101000002_rls_policies.sql`](supabase/migrations/20260101000002_rls_policies.sql)
3. **Stored Procedures & RPCs:** [`supabase/migrations/20260101000003_stored_procedures.sql`](supabase/migrations/20260101000003_stored_procedures.sql)

### Step 2.3 — Copy Keys
From **Project Settings ⚙️ → API**:
- `anon` `public` key → `VITE_SUPABASE_ANON_KEY`
- `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` *(Never expose to browser)*

---

## 3. Environment Variables Reference

Create your production environment variables (see [`.env.example`](.env.example)):

| Variable | Required | Description | Example |
|---|---|---|---|
| `PORT` | Yes | HTTP Port | `3000` |
| `NODE_ENV` | Yes | Node Environment | `production` |
| `ELECTION_MODE` | Yes | Operation Mode | `PRODUCTION` |
| `VITE_SUPABASE_URL` | Yes | Supabase Project URL | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase Public Key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase Backend Secret | `eyJhbGci...` |
| `APP_SECRET` | Yes | JWT Signing Key for Student Tokens | Strong random string (32+ chars) |
| `ADMIN_AUTH_SECRET` | Yes | JWT Signing Key for Admin Tokens | Strong random string (32+ chars) |
| `ADMIN_DEFAULT_USER` | Yes | Default Admin Username | `admin` |
| `ADMIN_DEFAULT_PASS` | Yes | Default Admin Password | Secure strong passcode |

---

## 4. Deployment Option A: Render (Recommended Fullstack)

Render provides the simplest one-click hosting for fullstack Express + React apps.

1. Create a free account at [render.com](https://render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository.
4. Configure the service settings:
   - **Name:** `viit-cr-elections-2026`
   - **Environment:** `Node`
   - **Region:** `Singapore (ap-southeast-1)` or nearest
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node server.js`
   - **Plan:** `Free` or `Starter`
5. In the **Environment Variables** section, add all variables from the [Environment Variables Reference](#3-environment-variables-reference).
6. Click **Create Web Service**. Render will automatically build the React assets and boot the Express backend.

---

## 5. Deployment Option B: Railway (One-Click)

1. Create an account at [railway.app](https://railway.app).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your `cr_voting` repository.
4. Go to **Variables** tab and paste your `.env` variables.
5. In **Settings** → **Build & Deploy**:
   - **Build Command:** `npm run build`
   - **Start Command:** `node server.js`
6. Click **Generate Domain** under **Networking**. Your portal is live with free automatic SSL!

---

## 6. Deployment Option C: Docker Container (VPS / AWS / DigitalOcean)

The repository includes an optimized multi-stage [`Dockerfile`](Dockerfile).

### Build and Run with Docker:

```bash
# 1. Build the production container
docker build -t viit-cr-elections:latest .

# 2. Run container with environment file
docker run -d \
  --name viit-voting-portal \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  viit-cr-elections:latest
```

### Run with Docker Compose (`docker-compose.yml`):

```yaml
version: '3.8'
services:
  voting-app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: always
```

---

## 7. Deployment Option D: Vercel (Split Frontend/Serverless)

If deploying the frontend on Vercel:
1. Connect repo to Vercel.
2. Framework Preset: **Vite**.
3. Root Directory: `./`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Environment Variables.
7. Deploy the Node.js backend (`server.js`) on Render / Railway to handle authoritative API transactions.

---

## 8. Election Day Operations Runbook

### Pre-Election Setup:
1. **Log in to Admin Panel:** Navigate to `https://your-domain.com/admin-login` (User: `admin`).
2. **Sync Official Student Roster:**
   - Go to **⚙️ System Integrations** tab.
   - Publish your Google Sheet (File → Share → Publish to web → CSV).
   - Paste link into **Google Sheet CSV URL** → Click **🔄 SYNC STUDENTS (PREVIEW)**.
   - Verify metrics (Total Students, Sections A, B, C, D) → Click **CONFIRM SYNC**.
3. **Register Contesting Candidates:**
   - Go to **👥 Candidate Roster** tab.
   - Click **+ Add Contesting Candidate** for each contestant (Name, Roll Number, Section, Symbol, Manifesto).
4. **Open Election:**
   - On the top banner, ensure status is set to **● Resume / Live**.

### During Voting:
- Monitor live voter turnout and candidate tallies on the **📊 Overview** dashboard.
- If a temporary disruption occurs, click **⏸️ Pause Voting** to halt new ballots.
- To resume, click **● Resume Voting**.

### Post-Election (Closing & Results):
1. Click **🔒 Close Election** to seal the ballot box permanently.
2. In **Results Visibility**, select **Public / Live** to allow students to view the official outcome.
3. Click **⬇️ Export Official Ballots (CSV)** to download the complete immutable audit register with tamper-evident reference IDs for faculty scrutiny.

---

## 9. Troubleshooting & Health Checks

### Check System Health:
Query the health endpoint:
```bash
curl https://your-domain.com/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "service": "VIIT CR Elections 2026 Authoritative API",
  "electionStatus": "LIVE",
  "totalVotersRegistered": 250,
  "ballotsCast": 142
}
```

### Common Issues & Quick Fixes:

- **"Failed to fetch Google Sheet content"**: Ensure the Google Sheet is published to web as CSV (*File → Share → Publish to web → Comma-separated values (.csv)*).
- **"Duplicate Ballot Rejected (409)"**: The student has already cast their ballot. Duplicate votes are strictly prohibited by the cryptographic ledger.
- **"Database offline"**: The system automatically operates on the embedded ACID store, guaranteeing 100% election uptime without losing votes.
