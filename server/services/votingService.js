import databaseAdapter from "../db/databaseAdapter.js";
import localStore from "../db/localStore.js";
import studentService from "./studentService.js";
import auditService, { AuditActions } from "./auditService.js";
import gasClient from "../db/gasClient.js";

export const votingService = {
  /**
   * Process and record a vote with strict concurrency, idempotency, and eligibility checks.
   *
   * @param {Object} params
   * @param {string} params.studentId - Authenticated student ID from verified server session
   * @param {string} params.candidateId - Selected candidate ID
   * @param {string} params.electionId - Target election ID
   * @param {string} params.requestId - Unique client idempotency key (e.g. req_uuid)
   * @param {string} [params.ipAddress] - Request IP
   * @param {string} [params.userAgent] - Request User Agent
   * @returns {Promise<Object>} Safe ballot receipt
   */
  async castVote({ studentId, rollNumber, candidateId, electionId = "CR2026", requestId, ipAddress, userAgent }) {
    if (!studentId) {
      throw { status: 401, code: "AUTH_REQUIRED", message: "Authentication required to cast ballot." };
    }
    if (!candidateId) {
      throw { status: 400, code: "INVALID_CANDIDATE", message: "Candidate selection is required." };
    }
    if (!requestId) {
      throw { status: 400, code: "MISSING_REQUEST_ID", message: "A unique request ID / idempotency key is required." };
    }

    // Execute atomic vote transaction through Database Adapter (Supabase PostgreSQL RPC or ACID Store)
    const receipt = await databaseAdapter.castVote({
      studentId,
      rollNumber,
      candidateId,
      electionId,
      requestId,
      ipAddress,
      userAgent,
    });

    // Optional asynchronous background sync to institutional Google Sheets if configured
    if (gasClient.isConfigured()) {
      gasClient.syncVoteToGas({
        election_id: electionId,
        student_id: studentId,
        candidate_id: candidateId,
        ref_id: receipt.voteReference,
        student_name: receipt.student?.name,
        roll_number: receipt.student?.rollNumber,
        section: receipt.student?.section,
        timestamp: receipt.isoTimestamp || new Date().toISOString(),
      }).catch((err) => {
        console.warn("[VotingService] Google Apps Script sync warning:", err.message);
      });
    }

    return receipt;
  },

  getAllVotes(electionId = "CR2026") {
    return localStore.getAllVotes(electionId);
  },

  hasStudentVoted(rollNumber) {
    const student = studentService.getStudentByRoll(rollNumber);
    return Boolean(student && student.voted);
  },

  async resetTestVotes(adminUser = "admin", requestId = "reset") {
    const result = await databaseAdapter.resetTestVotes("CR2026", adminUser);
    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: adminUser,
      action: AuditActions.ADMIN_ACTION,
      status: "SUCCESS",
      metadata: { action: "RESET_TEST_VOTES" },
    });
    return result;
  },
};

export default votingService;
