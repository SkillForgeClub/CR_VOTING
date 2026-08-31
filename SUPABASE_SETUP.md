# Supabase Production Architecture Setup Guide
## VIIT CR ELECTIONS 2026

**Institution:** Vignan's Institute of Information Technology  
**Department:** Department of Data Science  
**Developed by:** SkillForge Club  

---

## 🏛️ Architecture Overview

The production deployment of **VIIT CR Elections 2026** uses **Supabase PostgreSQL** as its primary authoritative database:

```
┌─────────────────────────┐
│ React / Vite Frontend   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Supabase Auth & JWT     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Supabase PostgreSQL DB  │
│ (Tables: students,      │
│  elections, candidates, │
│  votes, audit_logs)     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Row Level Security (RLS)│
│ + Atomic RPC (cast_vote)│
└─────────────────────────┘
```

---

## 🚀 Setup Steps in Supabase Dashboard

### Step 1: Create a Supabase Project
1. Log in to [https://supabase.com](https://supabase.com)
2. Create a new project named: `viit-cr-elections-2026`
3. Set your Database Password and select your preferred region (e.g., `ap-south-1` Mumbai or `ap-southeast-1` Singapore).

### Step 2: Run SQL Migration Scripts
Navigate to the **SQL Editor** in your Supabase dashboard and run the provided SQL scripts in the following order:

1. **`supabase/schema.sql`**
   - Enables `uuid-ossp` and `pgcrypto` extensions.
   - Creates the `elections`, `students`, `candidates`, `votes`, `admins`, and `audit_logs` tables.
   - Sets unique constraints ensuring **One Student = One Vote**.

2. **`supabase/rls.sql`**
   - Enables Row Level Security on all 6 tables.
   - Blocks unauthorized direct table mutations from browser clients.
   - Allows only `cast_vote` RPC procedure to write ballots.

3. **`supabase/rpc.sql`**
   - Installs the `cast_vote()` stored procedure with row-level mutex locking (`FOR UPDATE`).
   - Installs `get_election_results()` and `reset_election_test_data()`.

4. **`supabase/seed.sql`**
   - Populates the official 250 Department of Data Science student roster (Sections A, B, C, D).
   - Inserts candidates with symbols and manifestos.
   - Initializes election `CR2026` in `LIVE` state.

### Step 3: Configure Environment Variables
Copy your project API credentials from **Project Settings > API**:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
```

---

## 🔒 Security & Concurrency Guarantees

- **Airtight RLS:** Even if an attacker attempts direct `INSERT` into the `votes` table via browser DevTools, Supabase Row-Level Security blocks the request.
- **Race Condition Prevention:** The `cast_vote` stored procedure utilizes PostgreSQL `FOR UPDATE` row locking on the `students` row. When 250 students vote simultaneously, any concurrent ballot attempts for the same roll number fail atomically with `409 ALREADY_VOTED`.
- **Tamper-Evident Receipts:** Every vote generates a verifiable reference string (`CR26-DS{sec}-{HEX}`) and records a SHA-256 hash in the immutable audit log.
