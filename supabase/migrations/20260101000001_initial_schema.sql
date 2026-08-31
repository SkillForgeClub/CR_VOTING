-- Migration 1: Initial Schema
-- Tables: elections, students, candidates, votes, vote_requests, admins, audit_logs

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS elections (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    department VARCHAR(150) NOT NULL DEFAULT 'Department of Data Science',
    institution VARCHAR(255) NOT NULL DEFAULT 'Vignan''s Institute of Information Technology',
    status VARCHAR(20) NOT NULL DEFAULT 'LIVE' CHECK (status IN ('UPCOMING', 'LIVE', 'PAUSED', 'CLOSED')),
    results_visibility VARCHAR(20) NOT NULL DEFAULT 'ADMIN_ONLY' CHECK (results_visibility IN ('HIDDEN', 'ADMIN_ONLY', 'LIVE')),
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID,
    roll_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    section VARCHAR(10) NOT NULL CHECK (section IN ('A', 'B', 'C', 'D')),
    eligible BOOLEAN NOT NULL DEFAULT true,
    has_voted BOOLEAN NOT NULL DEFAULT false,
    voted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_roll_number ON students (UPPER(roll_number));
CREATE INDEX IF NOT EXISTS idx_students_auth_user_id ON students (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_students_section ON students (section);
CREATE INDEX IF NOT EXISTS idx_students_eligible ON students (eligible);
CREATE INDEX IF NOT EXISTS idx_students_has_voted ON students (has_voted);

CREATE TABLE IF NOT EXISTS candidates (
    id VARCHAR(50) PRIMARY KEY,
    election_id VARCHAR(50) NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    roll_number VARCHAR(20) NOT NULL,
    section VARCHAR(10) NOT NULL CHECK (section IN ('A', 'B', 'C', 'D')),
    photo_url TEXT,
    symbol VARCHAR(50) NOT NULL,
    symbol_name VARCHAR(100) NOT NULL DEFAULT 'Official Symbol',
    tagline VARCHAR(255),
    manifesto TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidates_election ON candidates (election_id);
CREATE INDEX IF NOT EXISTS idx_candidates_section ON candidates (section);
CREATE INDEX IF NOT EXISTS idx_candidates_active ON candidates (active);

CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id VARCHAR(50) NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id),
    candidate_id VARCHAR(50) NOT NULL REFERENCES candidates(id),
    section VARCHAR(10) NOT NULL CHECK (section IN ('A', 'B', 'C', 'D')),
    vote_reference VARCHAR(50) UNIQUE NOT NULL,
    request_id VARCHAR(100) UNIQUE,
    ip_hash VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_student_vote_per_election UNIQUE (election_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_election ON votes (election_id);
CREATE INDEX IF NOT EXISTS idx_votes_student ON votes (student_id);
CREATE INDEX IF NOT EXISTS idx_votes_candidate ON votes (candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_section ON votes (section);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_reference ON votes (vote_reference);
CREATE INDEX IF NOT EXISTS idx_votes_request_id ON votes (request_id);

CREATE TABLE IF NOT EXISTS vote_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(100) UNIQUE NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id),
    election_id VARCHAR(50) NOT NULL REFERENCES elections(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
    vote_id UUID REFERENCES votes(id),
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vote_requests_req_id ON vote_requests (request_id);
CREATE INDEX IF NOT EXISTS idx_vote_requests_student ON vote_requests (student_id);

CREATE TABLE IF NOT EXISTS admins (
    id VARCHAR(50) PRIMARY KEY,
    auth_user_id UUID,
    role VARCHAR(50) NOT NULL DEFAULT 'ELECTION_ADMIN' CHECK (role IN ('SUPER_ADMIN', 'ELECTION_ADMIN', 'OBSERVER')),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admins_auth_user ON admins (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins (email);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id VARCHAR(100),
    actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('STUDENT', 'ADMIN', 'SYSTEM')),
    action VARCHAR(100) NOT NULL,
    request_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (created_at DESC);
