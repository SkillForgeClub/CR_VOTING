-- Migration 2: Row Level Security (RLS) Policies (Production Hardened)

ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Elections
DROP POLICY IF EXISTS "Public can view elections" ON elections;
CREATE POLICY "Public can view elections"
    ON elections FOR SELECT
    TO anon, authenticated
    USING (true);

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

-- Candidates
DROP POLICY IF EXISTS "Public can view active candidates" ON candidates;
CREATE POLICY "Public can view active candidates"
    ON candidates FOR SELECT
    TO anon, authenticated
    USING (active = true);

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

-- Students
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

DROP POLICY IF EXISTS "Deny direct student record update" ON students;
CREATE POLICY "Deny direct student record update"
    ON students FOR UPDATE
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

-- Votes (Protected Immutable Ledger)
DROP POLICY IF EXISTS "Deny direct client vote insertion" ON votes;
CREATE POLICY "Deny direct client vote insertion"
    ON votes FOR INSERT
    TO anon, authenticated
    WITH CHECK (false);

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

-- Vote Requests (Idempotency Engine)
DROP POLICY IF EXISTS "Manage vote requests" ON vote_requests;
CREATE POLICY "Manage vote requests"
    ON vote_requests FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

-- Admins
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

-- Audit Logs
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

DROP POLICY IF EXISTS "Insert audit logs" ON audit_logs;
CREATE POLICY "Insert audit logs"
    ON audit_logs FOR INSERT
    TO anon, authenticated
    WITH CHECK (false);
