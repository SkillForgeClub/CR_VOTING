import supabaseServer, { isSupabaseServerConfigured } from "./supabaseClient.js";
import localStore, { electionMutex } from "./localStore.js";
import { generateVoteReference, hashStudentIdForBallot } from "../utils/cryptoUtils.js";

/**
 * Unified Database Adapter for VIIT CR Elections 2026
 * 
 * Supports:
 * 1. Supabase PostgreSQL (Cloud Production Architecture with Row Level Security and Stored Procedure RPCs)
 * 2. Embedded ACID In-Memory Store (Local / Development / Zero-Downtime Fallback)
 */
export const databaseAdapter = {
  isSupabaseActive() {
    return isSupabaseServerConfigured();
  },

  getDatabaseInfo() {
    const isCloud = this.isSupabaseActive();
    return {
      engine: isCloud ? "Supabase PostgreSQL (Cloud Production)" : "Embedded In-Memory ACID Engine (Authoritative Node)",
      isSupabaseConnected: isCloud,
      rlsEnabled: isCloud,
      rpcSupported: isCloud,
      schemaVersion: "2026.1-production",
      targetTables: ["elections", "students", "candidates", "votes", "admins", "audit_logs"],
      totalStudentsRegistered: isCloud ? "PostgreSQL Dynamic Roster" : localStore.getAllStudents().length,
      currentElectionStatus: isCloud ? "Synced with Supabase" : (localStore.getElection("CR2026")?.status || "LIVE"),
    };
  },

  /**
   * Authoritative Atomic Vote Transaction
   */
  async castVote({ studentId, rollNumber, candidateId, electionId = "CR2026", requestId, ipAddress, userAgent }) {
    // Path A: Cloud Supabase PostgreSQL via RPC stored procedure
    if (this.isSupabaseActive()) {
      try {
        // Resolve actual roll number from local student record if available
        const localSt = localStore.getStudentById(studentId) || localStore.getStudentByRoll(rollNumber || studentId);
        const resolvedRoll = localSt?.roll_number || rollNumber || studentId;

        // Look up student UUID in Supabase
        let targetUuid = studentId && studentId.includes("-") ? studentId : null;
        if (!targetUuid && resolvedRoll) {
          const { data: stRow } = await supabaseServer
            .from("students")
            .select("*")
            .eq("roll_number", resolvedRoll.toUpperCase())
            .maybeSingle();

          if (stRow) {
            targetUuid = stRow.id;
          }
        }

        if (targetUuid) {
          // Call authoritative Supabase PostgreSQL RPC function: cast_vote
          const { data, error } = await supabaseServer.rpc("cast_vote", {
            p_student_id: targetUuid,
            p_candidate_id: candidateId,
            p_election_id: electionId,
            p_request_id: requestId,
            p_ip_address: ipAddress || "127.0.0.1",
            p_user_agent: userAgent || "VIIT-Voting-Client",
          });

          if (!error && data) {
            if (localSt) {
              localStore.markStudentVoted(localSt.student_id);
              localStore.recordVoteEntry({
                vote_id: data.voteId || `v_cloud_${Date.now()}`,
                election_id: electionId,
                student_id: localSt.student_id,
                candidate_id: candidateId,
                candidate_name: data.candidate?.name || "",
                roll_number: localSt.roll_number,
                student_name: localSt.name,
                section: localSt.section,
                timestamp: new Date().toISOString(),
                request_id: requestId,
                ref_id: data.voteReference,
              });
            }
            return data;
          }

          if (error) {
            console.warn("[DatabaseAdapter] Supabase RPC cast_vote returned error:", error.message);
            // If it's a validation error from our RPC (e.g., ALREADY_VOTED, STUDENT_NOT_ELIGIBLE), throw it
            // so we don't accidentally bypass it via the local store fallback.
            if (error.code && error.code.startsWith("P0")) {
              throw { 
                status: error.code === "P0012" ? 409 : 403, 
                code: error.code === "P0012" ? "ALREADY_VOTED" : "SUPABASE_RPC_ERROR", 
                message: error.message 
              };
            }
            if (error.message && (error.message.includes("ALREADY_VOTED") || error.message.includes("STUDENT_NOT_ELIGIBLE"))) {
              throw { status: 409, code: "ALREADY_VOTED", message: error.message };
            }
          }
            // If it's a Postgres error (like 42883 gen_random_bytes missing), bypass the broken RPC
            // and perform the insert directly via JS SDK.
            console.warn("[DatabaseAdapter] RPC broken, falling back to JS SDK direct insert...");
            
            const refId = `CR26-DS${(localSt?.section || "A").toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
            
            const { data: insertData, error: insertError } = await supabaseServer.from("votes").insert({
              election_id: electionId,
              student_id: targetUuid,
              candidate_id: candidateId,
              section: localSt?.section || "A",
              vote_reference: refId,
              request_id: requestId,
            }).select().single();
            
            if (insertError) {
              console.error("[DatabaseAdapter] JS SDK insert failed:", insertError);
              throw { status: 500, code: "SUPABASE_INSERT_FAILED", message: insertError.message };
            }

            await supabaseServer.from("students").update({ has_voted: true, voted_at: new Date().toISOString() }).eq("id", targetUuid);
            
            const successData = {
              voteId: insertData.id,
              voteReference: refId,
              candidate: { id: candidateId }
            };

            if (localSt) {
              localStore.markStudentVoted(localSt.student_id);
              localStore.recordVoteEntry({
                vote_id: insertData.id,
                election_id: electionId,
                student_id: localSt.student_id,
                candidate_id: candidateId,
                candidate_name: "", // handled by resultsService join later
                roll_number: localSt.roll_number,
                student_name: localSt.name,
                section: localSt.section,
                timestamp: new Date().toISOString(),
                request_id: requestId,
                ref_id: refId,
              });
            }
            return successData;
          }
        }
      } catch (err) {
        // If we threw a specific business logic error above, rethrow it
        if (err.status) throw err;
        
        console.warn("[DatabaseAdapter] Supabase direct insert failed, falling back to local store:", err.message);
      }
    }

    // Path B: Authoritative Embedded ACID Store with Mutex Lock
    // NOTE: This path should only be hit if Supabase is unavailable.
    // We still do a final Supabase has_voted check here as a safety net.
    const releaseLock = await electionMutex.acquire();
    try {
      // 1. Idempotency check
      const cached = localStore.getProcessedRequest(requestId);
      if (cached && cached.result) {
        return cached.result;
      }

      // 2. Election status
      const election = localStore.getElection(electionId);
      if (!election || election.status !== "LIVE") {
        const state = election ? election.status : "CLOSED";
        throw {
          status: 403,
          code: `ELECTION_${state}`,
          message: state === "PAUSED" ? "Election voting is temporarily paused." : "Election is not live for voting.",
        };
      }

      // 3. Student lookup
      let student = localStore.getStudentById(studentId) || localStore.getStudentByRoll(rollNumber || studentId);
      if (!student) {
        throw { status: 403, code: "STUDENT_NOT_FOUND", message: "Student record not found in registered roster." };
      }

      // CRITICAL SAFETY NET: If Supabase is reachable, always re-check has_voted from the source of truth
      // to prevent double voting after server restarts (local store resets but Supabase persists).
      if (supabaseServer) {
        try {
          const resolvedRoll = student.roll_number || rollNumber;
          const { data: sbCheck } = await supabaseServer
            .from("students")
            .select("has_voted, voted_at")
            .eq("roll_number", resolvedRoll.toUpperCase())
            .maybeSingle();
          if (sbCheck && sbCheck.has_voted) {
            throw {
              status: 409,
              code: "ALREADY_VOTED",
              message: `Roll number ${resolvedRoll} has already cast an official ballot in this election. Duplicate voting is prohibited.`,
            };
          }
        } catch (sbCheckErr) {
          if (sbCheckErr.code === "ALREADY_VOTED") throw sbCheckErr;
          console.warn("[DatabaseAdapter] Supabase has_voted safety check failed:", sbCheckErr.message);
        }
      }

      if (!student.eligible) {
        throw { status: 403, code: "STUDENT_NOT_ELIGIBLE", message: "Student is not marked as eligible to vote." };
      }
      if (student.voted) {
        throw {
          status: 409,
          code: "ALREADY_VOTED",
          message: `Roll number ${student.roll_number} has already cast an official ballot in this election. Duplicate voting is prohibited.`,
        };
      }

      // 4. Candidate lookup
      const candidate = localStore.getCandidateById(candidateId);
      if (!candidate || !candidate.active) {
        throw { status: 400, code: "INVALID_CANDIDATE", message: "Selected candidate is invalid or inactive." };
      }
      if (candidate.section && candidate.section.toUpperCase() !== student.section.toUpperCase()) {
        throw { status: 400, code: "SECTION_MISMATCH", message: `Student from section ${student.section} cannot vote for candidate in section ${candidate.section}.` };
      }

      // 5. Generate Reference & Record
      const voteReference = generateVoteReference(student.section);
      const studentHash = hashStudentIdForBallot(student.student_id, electionId);
      const now = new Date();

      const voteRecord = {
        vote_id: `v_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`,
        election_id: electionId,
        student_id: student.student_id,
        student_hash: studentHash,
        candidate_id: candidate.candidate_id,
        candidate_name: candidate.name,
        roll_number: student.roll_number,
        student_name: student.name,
        section: student.section.toUpperCase(),
        timestamp: now.toISOString(),
        request_id: requestId,
        ref_id: voteReference,
      };

      localStore.recordVoteEntry(voteRecord);
      localStore.markStudentVoted(student.student_id);

      // Persist voted status to Supabase immediately, even in local fallback path
      if (supabaseServer) {
        supabaseServer
          .from("students")
          .update({ has_voted: true, voted_at: now.toISOString(), updated_at: now.toISOString() })
          .eq("roll_number", student.roll_number.toUpperCase())
          .then(({ error }) => {
            if (error) console.warn("[DatabaseAdapter] Failed to sync has_voted to Supabase:", error.message);
            else console.log("[DatabaseAdapter] Synced has_voted=true to Supabase for:", student.roll_number);
          });
      }

      const receipt = {
        success: true,
        voteReference,
        timestamp: now.toLocaleString("en-US", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" }),
        isoTimestamp: now.toISOString(),
        student: {
          name: student.name,
          rollNumber: student.roll_number,
          section: student.section,
        },
        message: "Your ballot has been officially recorded and sealed.",
      };

      localStore.setProcessedRequest(requestId, receipt);
      return receipt;
    } finally {
      releaseLock();
    }
  },

  /**
   * Fetch All Candidates
   */
  async getCandidates(electionId = "CR2026") {
    if (this.isSupabaseActive()) {
      try {
        const { data, error } = await supabaseServer
          .from("candidates")
          .select("*")
          .eq("election_id", electionId)
          .order("name", { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((c) => ({
            id: c.id,
            candidate_id: c.id,
            name: c.name,
            rollNumber: c.roll_number,
            section: c.section,
            symbol: c.symbol,
            symbolName: c.symbol_name,
            tagline: c.tagline,
            manifesto: c.manifesto,
            active: c.active !== undefined ? c.active : (c.is_active !== undefined ? c.is_active : true),
          }));
        }
      } catch (e) {
        console.warn("[DatabaseAdapter] Failed to fetch candidates from Supabase:", e.message);
      }
    }

    return localStore.getAllCandidates(electionId);
  },

  /**
   * Fetch All Registered Students
   */
  async getAllStudents() {
    if (this.isSupabaseActive()) {
      try {
        const { data, error } = await supabaseServer
          .from("students")
          .select("*")
          .order("roll_number", { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((s) => ({
            student_id: s.id,
            id: s.id,
            roll_number: s.roll_number,
            name: s.name,
            section: s.section,
            email: s.email,
            eligible: s.eligible !== undefined ? s.eligible : (s.is_eligible !== undefined ? s.is_eligible : true),
            voted: s.has_voted !== undefined ? s.has_voted : (s.voted || false),
            voted_at: s.voted_at,
          }));
        }
      } catch (e) {
        console.warn("[DatabaseAdapter] Supabase getAllStudents error:", e.message);
      }
    }

    return localStore.getAllStudents();
  },

  /**
   * Fetch Student By Roll Number
   */
  async getStudentByRoll(rollNumber) {
    if (!rollNumber) return null;
    const cleanRoll = rollNumber.trim().toUpperCase();

    if (this.isSupabaseActive()) {
      try {
        const { data, error } = await supabaseServer
          .from("students")
          .select("*")
          .eq("roll_number", cleanRoll)
          .single();

        if (!error && data) {
          return {
            student_id: data.id,
            id: data.id,
            roll_number: data.roll_number,
            name: data.name,
            section: data.section,
            email: data.email,
            eligible: data.eligible !== undefined ? data.eligible : (data.is_eligible !== undefined ? data.is_eligible : true),
            voted: data.has_voted !== undefined ? data.has_voted : (data.voted || false),
            voted_at: data.voted_at,
          };
        }
      } catch (e) {
        console.warn("[DatabaseAdapter] Supabase getStudentByRoll error:", e.message);
      }
    }

    return localStore.getStudentByRoll(cleanRoll);
  },

  /**
   * Synchronize Roster Students to Supabase
   */
  async syncStudentsToSupabase(studentsList) {
    if (!this.isSupabaseActive() || !Array.isArray(studentsList) || studentsList.length === 0) {
      return;
    }

    try {
      const rows = studentsList.map((s) => ({
        roll_number: (s.roll_number || s.rollNumber).trim().toUpperCase(),
        name: s.name.trim(),
        section: (s.section || "A").trim().toUpperCase(),
        email: s.email || `${(s.roll_number || s.rollNumber).trim().toLowerCase()}@viit.ac.in`,
        eligible: s.eligible !== false,
      }));

      const { error } = await supabaseServer
        .from("students")
        .upsert(rows, { onConflict: "roll_number" });

      if (error) {
        console.warn("[DatabaseAdapter] Supabase syncStudents error:", error.message);
      }
    } catch (e) {
      console.warn("[DatabaseAdapter] Supabase syncStudents exception:", e.message);
    }
  },

  /**
   * Synchronize Candidate to Supabase
   */
  async syncCandidateToSupabase(candidate) {
    if (!this.isSupabaseActive() || !candidate) return;

    try {
      await this.ensureElectionExists(candidate.election_id || "CR2026");

      const row = {
        id: candidate.candidate_id || candidate.id,
        election_id: candidate.election_id || "CR2026",
        name: candidate.name,
        roll_number: candidate.roll_number || candidate.rollNumber || "",
        section: (candidate.section || "A").toUpperCase(),
        symbol: candidate.symbol || "🚀",
        symbol_name: candidate.symbol_name || candidate.symbolName || "Official Symbol",
        tagline: candidate.tagline || "",
        manifesto: candidate.manifesto || "",
        photo_url: candidate.photo_url || candidate.photoUrl || "",
        active: candidate.active !== false,
      };

      const { error } = await supabaseServer
        .from("candidates")
        .upsert(row, { onConflict: "id" });

      if (error) {
        console.warn("[DatabaseAdapter] Supabase syncCandidate error:", error.message);
      }
    } catch (e) {
      console.warn("[DatabaseAdapter] Supabase syncCandidate exception:", e.message);
    }
  },

  /**
   * Delete Candidate from Supabase
   */
  async deleteCandidateFromSupabase(candidateId) {
    if (!this.isSupabaseActive() || !candidateId) return;

    try {
      const { error } = await supabaseServer
        .from("candidates")
        .delete()
        .eq("id", candidateId);

      if (error) {
        console.warn("[DatabaseAdapter] Supabase deleteCandidate error:", error.message);
      }
    } catch (e) {
      console.warn("[DatabaseAdapter] Supabase deleteCandidate exception:", e.message);
    }
  },

  /**
   * Ensure Base Election Record Exists in Supabase
   */
  async ensureElectionExists(electionId = "CR2026") {
    if (!this.isSupabaseActive()) return;

    try {
      const election = localStore.getElection(electionId) || {
        election_id: electionId,
        name: "VIIT CR ELECTIONS 2026",
        status: "LIVE",
        results_visibility: "LIVE",
      };

      await supabaseServer.from("elections").upsert({
        id: electionId,
        name: election.name || "VIIT CR ELECTIONS 2026",
        status: election.status || "LIVE",
        results_visibility: election.results_visibility || "LIVE",
        start_time: election.start_time || new Date().toISOString(),
      }, { onConflict: "id" });
    } catch (e) {
      console.warn("[DatabaseAdapter] Supabase ensureElectionExists warning:", e.message);
    }
  },

  /**
   * Reset Test Ballots (Admin Only)
   */
  async resetTestVotes(electionId = "CR2026", adminUser = "admin") {
    let cloudResult = null;
    if (this.isSupabaseActive()) {
      try {
        const { data, error } = await supabaseServer.rpc("reset_election_test_data", {
          p_election_id: electionId,
          p_admin_user: adminUser,
        });
        if (!error && data) cloudResult = data;
      } catch (e) {
        console.warn("[DatabaseAdapter] Supabase reset RPC error:", e.message);
      }
    }

    localStore.resetTestVotes();
    return cloudResult || { success: true };
  },
};

export default databaseAdapter;
