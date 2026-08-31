# VIIT CR ELECTIONS 2026

**Vignan's Institute of Information Technology**  
**Department of Data Science**  
*Designed & Developed by SkillForge Club*

Production Class Representative (CR) Election System for ~250 students across Sections A, B, C, and D.

---

## 🏛️ Architecture Overview

The system uses an authoritative **Supabase PostgreSQL** database architecture with strict Row Level Security (RLS) and atomic database stored procedures (`cast_vote`).

```
                    GOOGLE SHEETS
             (Institutional Student Roster)
                          │
                          ▼
                 Admin Sync Button
                          │
                Validation & Preview
                          │
                          ▼
                      SUPABASE
                (PostgreSQL Database)
      ┌───────────────────┼───────────────────┐
      │                   │                   │
  Students           Candidates           Elections
      │                   │                   │
      └───────────────────┼───────────────────┘
                          │
                        Votes
                          │
                      Audit Logs
```

- **Frontend**: React + Vite (Institutional Mobile-First UI)
- **Backend**: Express / Authoritative Node Engine with Supabase Client & Local ACID Engine Fallback
- **Database**: Supabase PostgreSQL with RLS, stored procedure RPCs, and `UNIQUE(election_id, student_id)` constraint
- **Roster Management**: Synchronized from institutional Google Sheets with live preview diffing

---

## 🚀 Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables** (`.env`):
   ```env
   PORT=3000
   NODE_ENV=production

   # Frontend Public Credentials
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>

   # Server-Side Secrets (NEVER exposed to frontend)
   SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
   APP_SECRET=<your-jwt-secret>
   ADMIN_AUTH_SECRET=<your-admin-secret>
   ```

3. **Deploy Supabase Migrations**:
   Execute SQL scripts in order:
   - `supabase/migrations/20260101000001_initial_schema.sql`
   - `supabase/migrations/20260101000002_rls_policies.sql`
   - `supabase/migrations/20260101000003_stored_procedures.sql`

4. **Run Server**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

---

## 🛡️ Security & One-Student-One-Vote Mutex

- Database constraint `UNIQUE(election_id, student_id)` guarantees 1 student = 1 vote.
- Atomic `cast_vote` RPC stored procedure handles ballot verification and marks `has_voted = true` in a single transaction.
- Idempotency ensured via `request_id` keys.
- Concurrent voting protected by atomic mutex locks.
