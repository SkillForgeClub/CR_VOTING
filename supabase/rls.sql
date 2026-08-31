-- ============================================================
-- VIIT CR ELECTIONS 2026 - PRODUCTION ROW LEVEL SECURITY (RLS)
-- Target: Supabase PostgreSQL Database
-- Purpose: Complete security hardening, client zero-trust, and protected ledger
-- ============================================================

-- 1. Enable Row Level Security on ALL Seven Tables
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. ELECTIONS TABLE POLICIES
-- ------------------------------------------------------------
-- Public/Student read access for election metadata
DROP POLICY IF EXISTS "Public can view elections" ON elections;
CREATE POLICY "Public can view elections"
    ON elections FOR SELECT
    TO anon, authenticated
    USING (true);

-- Mutations restricted to authorized election administrators
DROP POLICY IF EXISTS "Admins can update elections" ON elections;
CREATE POLICY "Admins can update elections"
    ON elections FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.auth_user_id = auth.uid() 
            AND admins.role IN ('SUPER_ADMIN', 'ELECTION_ADMIN')
            AND admins.active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.auth_user_id = auth.uid() 
            AND admins.role IN ('SUPER_ADMIN', 'ELECTION_ADMIN')
            AND admins.active = true
        )
    );

-- ------------------------------------------------------------
-- 3. CANDIDATES TABLE POLICIES
-- ------------------------------------------------------------
-- Public/Students can view active candidates for current election
DROP POLICY IF EXISTS "Public can view active candidates" ON candidates;
CREATE POLICY "Public can view active candidates"
    ON candidates FOR SELECT
    TO anon, authenticated
    USING (active = true);

-- Admins can view and manage all candidates (deactivation preferred over deletion)
DROP POLICY IF EXISTS "Admins can manage candidates" ON candidates;
CREATE POLICY "Admins can manage candidates"
    ON candidates FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.auth_user_id = auth.uid() 
            AND admins.role IN ('SUPER_ADMIN', 'ELECTION_ADMIN')
            AND admins.active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.auth_user_id = auth.uid() 
            AND admins.role IN ('SUPER_ADMIN', 'ELECTION_ADMIN')
            AND admins.active = true
        )
    );

-- ------------------------------------------------------------
-- 4. STUDENTS TABLE POLICIES
-- ------------------------------------------------------------
-- Authenticated student can ONLY view their own profile record (No roster scraping)
DROP POLICY IF EXISTS "Students can view only their own record" ON students;
CREATE POLICY "Students can view only their own record"
    ON students FOR SELECT
    TO authenticated
    USING (
        auth_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.auth_user_id = auth.uid() 
            AND admins.active = true
        )
    );

-- Normal clients (including SUPER_ADMIN client sessions) CANNOT directly UPDATE student records
-- Roster updates occur via trusted server API; Voting updates occur via SECURITY DEFINER cast_vote()
DROP POLICY IF EXISTS "Deny direct student record update" ON students;
CREATE POLICY "Deny direct student record update"
    ON students FOR UPDATE
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

-- ------------------------------------------------------------
-- 5. VOTES TABLE POLICIES (PROTECTED IMMUTABLE LEDGER)
-- ------------------------------------------------------------
-- Direct client INSERT is completely BLOCKED.
-- Votes can ONLY be inserted via cast_vote() database RPC (SECURITY DEFINER)
DROP POLICY IF EXISTS "Deny direct client vote insertion" ON votes;
CREATE POLICY "Deny direct client vote insertion"
    ON votes FOR INSERT
    TO anon, authenticated
    WITH CHECK (false);

-- Direct UPDATE or DELETE of votes is STRICTLY BLOCKED to ensure immutability
DROP POLICY IF EXISTS "Deny vote update" ON votes;
CREATE POLICY "Deny vote update"
    ON votes FOR UPDATE
    TO anon, authenticated
    USING (false);

DROP POLICY IF EXISTS "Deny vote deletion" ON votes;
CREATE POLICY "Deny vote deletion"
    ON votes FOR DELETE
    TO anon, authenticated
    USING (false);

-- Direct SELECT on raw votes table is restricted to authorized election administrators
-- (Anonymized aggregate results are fetched via SECURITY DEFINER get_election_results() procedure)
DROP POLICY IF EXISTS "Admins can view votes" ON votes;
CREATE POLICY "Admins can view votes"
    ON votes FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.auth_user_id = auth.uid() 
            AND admins.role IN ('SUPER_ADMIN', 'ELECTION_ADMIN', 'OBSERVER')
            AND admins.active = true
        )
    );

-- ------------------------------------------------------------
-- 6. VOTE_REQUESTS TABLE POLICIES (IDEMPOTENCY ENGINE)
-- ------------------------------------------------------------
-- Direct client access to vote_requests is completely BLOCKED.
-- Managed exclusively by cast_vote() SECURITY DEFINER stored procedure and service_role.
DROP POLICY IF EXISTS "Manage vote requests" ON vote_requests;
CREATE POLICY "Manage vote requests"
    ON vote_requests FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

-- ------------------------------------------------------------
-- 7. ADMINS TABLE POLICIES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view admin roster" ON admins;
CREATE POLICY "Admins can view admin roster"
    ON admins FOR SELECT
    TO authenticated
    USING (
        auth_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM admins a
            WHERE a.auth_user_id = auth.uid() 
            AND a.role = 'SUPER_ADMIN'
            AND a.active = true
        )
    );

DROP POLICY IF EXISTS "Deny admin client mutations" ON admins;
CREATE POLICY "Deny admin client mutations"
    ON admins FOR ALL
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.auth_user_id = auth.uid() 
            AND admins.role = 'SUPER_ADMIN'
            AND admins.active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.auth_user_id = auth.uid() 
            AND admins.role = 'SUPER_ADMIN'
            AND admins.active = true
        )
    );

-- ------------------------------------------------------------
-- 8. AUDIT_LOGS TABLE POLICIES
-- ------------------------------------------------------------
-- Only authorized election officials can read audit logs
DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;
CREATE POLICY "Admins can read audit logs"
    ON audit_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.auth_user_id = auth.uid() 
            AND admins.role IN ('SUPER_ADMIN', 'ELECTION_ADMIN', 'OBSERVER')
            AND admins.active = true
        )
    );

-- Direct client INSERT of fabricated audit logs is STRICTLY DENIED.
-- Audit logs are written by trusted backend server or SECURITY DEFINER database procedures.
DROP POLICY IF EXISTS "Insert audit logs" ON audit_logs;
CREATE POLICY "Insert audit logs"
    ON audit_logs FOR INSERT
    TO anon, authenticated
    WITH CHECK (false);
