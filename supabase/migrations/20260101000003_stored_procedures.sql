-- Migration 3: Stored Procedures / RPC Functions

-- Helper: Generate Unique Tamper-Evident Vote Reference
CREATE OR REPLACE FUNCTION generate_vote_reference(p_section VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    v_random_hex VARCHAR(8);
    v_clean_sec VARCHAR(5);
BEGIN
    v_clean_sec := UPPER(COALESCE(p_section, 'A'));
    v_random_hex := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));
    RETURN 'CR26-DS' || v_clean_sec || '-' || v_random_hex;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE OR REPLACE FUNCTION cast_vote(
    p_student_id UUID DEFAULT NULL,
    p_candidate_id VARCHAR DEFAULT NULL,
    p_election_id VARCHAR DEFAULT 'CR2026',
    p_request_id VARCHAR DEFAULT NULL,
    p_ip_address VARCHAR DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_election RECORD;
    v_student RECORD;
    v_candidate RECORD;
    v_vote_ref VARCHAR(50);
    v_vote_id UUID;
    v_now TIMESTAMPTZ := now();
    v_existing_req RECORD;
    v_receipt JSONB;
BEGIN
    -- Idempotency Check
    IF p_request_id IS NOT NULL THEN
        SELECT * INTO v_existing_req
        FROM vote_requests
        WHERE request_id = p_request_id;

        IF FOUND AND v_existing_req.response_payload IS NOT NULL THEN
            RETURN v_existing_req.response_payload;
        END IF;
    END IF;

    -- Identify Student
    IF auth.uid() IS NOT NULL THEN
        SELECT * INTO v_student
        FROM students
        WHERE auth_user_id = auth.uid()
        FOR UPDATE;
    ELSIF p_student_id IS NOT NULL THEN
        SELECT * INTO v_student
        FROM students
        WHERE id = p_student_id
        FOR UPDATE;
    ELSE
        RAISE EXCEPTION 'AUTH_REQUIRED: Authenticated student session or valid ID is required.' USING ERRCODE = 'P0001';
    END IF;

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND: Student record not found in registered roster.' USING ERRCODE = 'P0002';
    END IF;

    -- Candidate Check
    IF p_candidate_id IS NULL OR TRIM(p_candidate_id) = '' THEN
        RAISE EXCEPTION 'INVALID_CANDIDATE: Candidate selection is required.' USING ERRCODE = 'P0003';
    END IF;

    -- Lock Election Row & Validate Status
    SELECT * INTO v_election
    FROM elections
    WHERE id = p_election_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ELECTION_NOT_FOUND: Election % does not exist.', p_election_id USING ERRCODE = 'P0004';
    END IF;

    IF v_election.status = 'UPCOMING' THEN
        RAISE EXCEPTION 'ELECTION_NOT_STARTED: Election has not started yet.' USING ERRCODE = 'P0005';
    ELSIF v_election.status = 'PAUSED' THEN
        RAISE EXCEPTION 'ELECTION_PAUSED: Election voting is temporarily paused by election officials.' USING ERRCODE = 'P0006';
    ELSIF v_election.status = 'CLOSED' THEN
        RAISE EXCEPTION 'ELECTION_CLOSED: Election voting is closed. No further ballots accepted.' USING ERRCODE = 'P0007';
    ELSIF v_election.status != 'LIVE' THEN
        RAISE EXCEPTION 'ELECTION_NOT_LIVE: Election is currently not accepting votes.' USING ERRCODE = 'P0008';
    END IF;

    -- Student Eligibility
    IF NOT v_student.eligible THEN
        INSERT INTO audit_logs (actor_user_id, actor_type, action, request_id, metadata, ip_address)
        VALUES (v_student.id::text, 'STUDENT', 'VOTE_ATTEMPT', p_request_id, jsonb_build_object('reason', 'INELIGIBLE', 'roll', v_student.roll_number), p_ip_address);

        RAISE EXCEPTION 'STUDENT_NOT_ELIGIBLE: Student % is not eligible to vote in this election.', v_student.roll_number USING ERRCODE = 'P0011';
    END IF;

    -- ONE STUDENT = ONE VOTE Check
    IF v_student.has_voted THEN
        INSERT INTO audit_logs (actor_user_id, actor_type, action, request_id, metadata, ip_address)
        VALUES (v_student.id::text, 'STUDENT', 'DUPLICATE_VOTE_BLOCKED', p_request_id, jsonb_build_object('roll', v_student.roll_number, 'voted_at', v_student.voted_at), p_ip_address);

        RAISE EXCEPTION 'ALREADY_VOTED: Roll number % has already cast an official ballot in this election.', v_student.roll_number USING ERRCODE = 'P0012';
    END IF;

    -- Candidate Verification
    SELECT * INTO v_candidate
    FROM candidates
    WHERE id = p_candidate_id AND election_id = p_election_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_CANDIDATE: Candidate % is not registered for election %.', p_candidate_id, p_election_id USING ERRCODE = 'P0013';
    END IF;

    IF NOT v_candidate.active THEN
        RAISE EXCEPTION 'INVALID_CANDIDATE: Candidate % is currently inactive and cannot receive votes.', v_candidate.name USING ERRCODE = 'P0014';
    END IF;

    -- Section Check
    IF UPPER(v_candidate.section) != UPPER(v_student.section) THEN
        INSERT INTO audit_logs (actor_user_id, actor_type, action, request_id, metadata, ip_address)
        VALUES (v_student.id::text, 'STUDENT', 'INVALID_CANDIDATE', p_request_id, jsonb_build_object('student_sec', v_student.section, 'cand_sec', v_candidate.section), p_ip_address);

        RAISE EXCEPTION 'SECTION_MISMATCH: Student from Section % cannot vote for candidate in Section %.', v_student.section, v_candidate.section USING ERRCODE = 'P0015';
    END IF;

    -- Generate Reference
    v_vote_ref := generate_vote_reference(v_student.section);

    -- Insert Ballot
    INSERT INTO votes (
        election_id,
        student_id,
        candidate_id,
        section,
        vote_reference,
        request_id,
        ip_hash,
        user_agent,
        created_at
    ) VALUES (
        p_election_id,
        v_student.id,
        v_candidate.id,
        v_student.section,
        v_vote_ref,
        p_request_id,
        encode(digest(COALESCE(p_ip_address, 'unknown'), 'sha256'), 'hex'),
        p_user_agent,
        v_now
    ) RETURNING id INTO v_vote_id;

    -- Mark Voted Atomically
    UPDATE students
    SET has_voted = true,
        voted_at = v_now,
        updated_at = v_now
    WHERE id = v_student.id;

    -- Receipt
    v_receipt := jsonb_build_object(
        'success', true,
        'voteReference', v_vote_ref,
        'timestamp', to_char(v_now AT TIME ZONE 'Asia/Kolkata', 'Mon DD, YYYY, HH12:MI:SS AM'),
        'isoTimestamp', v_now,
        'student', jsonb_build_object(
            'name', v_student.name,
            'rollNumber', v_student.roll_number,
            'section', v_student.section
        ),
        'message', 'Your ballot has been officially recorded and sealed.'
    );

    -- Save Idempotency
    IF p_request_id IS NOT NULL THEN
        INSERT INTO vote_requests (request_id, student_id, election_id, status, vote_id, response_payload)
        VALUES (p_request_id, v_student.id, p_election_id, 'COMPLETED', v_vote_id, v_receipt)
        ON CONFLICT (request_id) DO UPDATE SET response_payload = EXCLUDED.response_payload;
    END IF;

    -- Audit Log
    INSERT INTO audit_logs (
        actor_user_id,
        actor_type,
        action,
        request_id,
        metadata,
        ip_address
    ) VALUES (
        v_student.id::text,
        'STUDENT',
        'VOTE_ACCEPTED',
        p_request_id,
        jsonb_build_object('vote_ref', v_vote_ref, 'section', v_student.section),
        p_ip_address
    );

    RETURN v_receipt;
END;
$$;

CREATE OR REPLACE FUNCTION get_election_results(p_election_id VARCHAR DEFAULT 'CR2026')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_eligible INTEGER := 0;
    v_total_voted INTEGER := 0;
    v_turnout_pct NUMERIC(5,2) := 0.00;
    v_candidate_tallies JSONB;
    v_section_breakdown JSONB;
    v_election RECORD;
BEGIN
    SELECT * INTO v_election FROM elections WHERE id = p_election_id;

    SELECT COUNT(*) INTO v_total_eligible FROM students WHERE eligible = true;
    SELECT COUNT(*) INTO v_total_voted FROM students WHERE has_voted = true;

    IF v_total_eligible > 0 THEN
        v_turnout_pct := ROUND((v_total_voted::NUMERIC / v_total_eligible::NUMERIC) * 100, 2);
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'rollNumber', c.roll_number,
            'section', c.section,
            'symbol', c.symbol,
            'symbolName', c.symbol_name,
            'tagline', c.tagline,
            'active', c.active,
            'votesCount', COALESCE(v.vote_count, 0),
            'percentage', CASE 
                WHEN v_total_voted > 0 THEN ROUND((COALESCE(v.vote_count, 0)::NUMERIC / v_total_voted::NUMERIC) * 100, 1)
                ELSE 0.0
            END
        ) ORDER BY COALESCE(v.vote_count, 0) DESC, c.name ASC
    ) INTO v_candidate_tallies
    FROM candidates c
    LEFT JOIN (
        SELECT candidate_id, COUNT(*) as vote_count
        FROM votes
        WHERE election_id = p_election_id
        GROUP BY candidate_id
    ) v ON c.id = v.candidate_id
    WHERE c.election_id = p_election_id;

    SELECT jsonb_object_agg(
        sec.section,
        jsonb_build_object(
            'total', sec.total_students,
            'voted', sec.voted_students,
            'turnoutPercent', CASE 
                WHEN sec.total_students > 0 THEN ROUND((sec.voted_students::NUMERIC / sec.total_students::NUMERIC) * 100, 1)
                ELSE 0.0
            END
        )
    ) INTO v_section_breakdown
    FROM (
        SELECT 
            section,
            COUNT(*) as total_students,
            COUNT(*) FILTER (WHERE has_voted = true) as voted_students
        FROM students
        GROUP BY section
    ) sec;

    RETURN jsonb_build_object(
        'election', jsonb_build_object(
            'id', v_election.id,
            'name', v_election.name,
            'status', v_election.status,
            'resultsVisibility', v_election.results_visibility,
            'startTime', v_election.start_time,
            'endTime', v_election.end_time
        ),
        'metrics', jsonb_build_object(
            'totalEligibleVoters', v_total_eligible,
            'totalVotesCast', v_total_voted,
            'turnoutPercentage', v_turnout_pct,
            'candidateTally', COALESCE(v_candidate_tallies, '[]'::jsonb),
            'sectionBreakdown', COALESCE(v_section_breakdown, '{}'::jsonb)
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION reset_election_test_data(
    p_election_id VARCHAR DEFAULT 'CR2026',
    p_admin_user VARCHAR DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
BEGIN
    DELETE FROM vote_requests WHERE election_id = p_election_id;

    DELETE FROM votes WHERE election_id = p_election_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    UPDATE students
    SET has_voted = false,
        voted_at = NULL,
        updated_at = now();

    INSERT INTO audit_logs (
        actor_user_id,
        actor_type,
        action,
        metadata
    ) VALUES (
        p_admin_user,
        'ADMIN',
        'ADMIN_ACTION',
        jsonb_build_object(
            'action', 'RESET_TEST_VOTES',
            'election_id', p_election_id,
            'deleted_votes', v_deleted_count
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'All test ballots and voter flags have been reset.',
        'deletedVotesCount', v_deleted_count
    );
END;
$$;
