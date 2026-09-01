import localStore from "../db/localStore.js";
import supabaseServer from "../db/supabaseClient.js";
import gasClient from "../db/gasClient.js";

export const AuditActions = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  VOTE_ATTEMPT: "VOTE_ATTEMPT",
  VOTE_ACCEPTED: "VOTE_ACCEPTED",
  DUPLICATE_VOTE_BLOCKED: "DUPLICATE_VOTE_BLOCKED",
  INVALID_CANDIDATE: "INVALID_CANDIDATE",
  SECTION_MISMATCH: "SECTION_MISMATCH",
  ELECTION_NOT_LIVE: "ELECTION_NOT_LIVE",
  ADMIN_LOGIN: "ADMIN_LOGIN",
  ADMIN_ACTION: "ADMIN_ACTION",
  CANDIDATE_CREATED: "CANDIDATE_CREATED",
  CANDIDATE_UPDATED: "CANDIDATE_UPDATED",
  CANDIDATE_DEACTIVATED: "CANDIDATE_DEACTIVATED",
  ELECTION_STARTED: "ELECTION_STARTED",
  ELECTION_PAUSED: "ELECTION_PAUSED",
  ELECTION_RESUMED: "ELECTION_RESUMED",
  ELECTION_CLOSED: "ELECTION_CLOSED",
  RESULTS_VIEWED: "RESULTS_VIEWED",
  ROSTER_IMPORTED: "ROSTER_IMPORTED",
};

export const auditService = {
  log({ requestId, actorType = "STUDENT", actorId = "anonymous", action, status = "SUCCESS", metadata = {} }) {
    // Sanitize sensitive keys from metadata
    const cleanMeta = { ...metadata };
    delete cleanMeta.password;
    delete cleanMeta.passcode;
    delete cleanMeta.token;
    delete cleanMeta.secret;
    delete cleanMeta.otp;

    const entry = {
      request_id: requestId,
      actor_type: actorType,
      actor_id: actorId,
      action,
      status,
      metadata: cleanMeta,
      timestamp: new Date().toISOString(),
    };

    // Primary: Write to Supabase audit_logs table (fire-and-forget — don't block voting)
    if (supabaseServer) {
      supabaseServer.from("audit_logs").insert({
        request_id: requestId,
        actor_user_id: actorId,
        actor_type: actorType,
        action,
        metadata: { status, ...cleanMeta },
        ip_address: cleanMeta.ipAddress || null,
      }).then(({ error }) => {
        if (error) console.warn("[AuditService] Supabase audit log write failed:", error.message);
      }).catch((e) => console.warn("[AuditService] Supabase audit log write exception:", e.message));
    }

    // Secondary: local store as backup
    const localEntry = localStore.addAuditLog(entry);

    // Tertiary: GAS sync
    if (gasClient.isConfigured()) {
      gasClient.execute("RECORD_AUDIT_LOG", localEntry || entry).catch(() => {});
    }

    return localEntry || entry;
  },

  async getLogs(limit = 100, action = null) {
    if (supabaseServer) {
      try {
        let query = supabaseServer
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (action) {
          query = query.eq("action", action);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data.map((log) => ({
            log_id: log.id,
            request_id: log.request_id,
            actor_type: log.actor_type,
            actor_id: log.actor_user_id,
            action: log.action,
            status: log.status,
            metadata: log.metadata || {},
            timestamp: log.created_at,
          }));
        }
      } catch (e) {
        console.warn("[AuditService] Supabase getLogs failed:", e.message);
      }
    }
    return localStore.getAuditLogs(limit, action);
  },
};

export default auditService;
