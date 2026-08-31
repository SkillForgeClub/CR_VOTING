import localStore from "../db/localStore.js";
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
    // Sanitization: Ensure no sensitive keys exist in metadata
    const cleanMeta = { ...metadata };
    delete cleanMeta.password;
    delete cleanMeta.passcode;
    delete cleanMeta.token;
    delete cleanMeta.secret;
    delete cleanMeta.otp;

    const entry = localStore.addAuditLog({
      request_id: requestId,
      actor_type: actorType,
      actor_id: actorId,
      action,
      status,
      metadata: cleanMeta,
    });

    // Fire-and-forget sync to Google Apps Script if configured
    if (gasClient.isConfigured()) {
      gasClient.execute("RECORD_AUDIT_LOG", entry).catch(() => {});
    }

    return entry;
  },

  getLogs(limit = 100, action = null) {
    return localStore.getAuditLogs(limit, action);
  },
};

export default auditService;
