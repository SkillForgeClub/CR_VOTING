import authService from "./authService";

export const votingService = {
  /**
   * Submit an official ballot to the server
   */
  async submitVote({ candidateId, rollNumber, candidateName, section }) {
    const studentToken = authService.getStudentToken();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      // 1. Primary path: Authenticated /api/v1/votes
      const res = await fetch("/api/v1/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: studentToken ? `Bearer ${studentToken}` : "",
        },
        body: JSON.stringify({
          candidateId,
          electionId: "CR2026",
          requestId,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        throw new Error(data.message || "Failed to submit ballot.");
      }

      // Mark locally as voted in current session
      const studentSession = authService.getStudentSession();
      if (studentSession) {
        studentSession.voted = true;
        studentSession.votedAt = data.isoTimestamp || new Date().toISOString();
        authService.setStudentSession(studentToken, studentSession);
      }

      const receipt = {
        refId: data.voteReference || `CR26-DS${section || "A"}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        timestamp: data.timestamp || new Date().toLocaleString(),
        rollNumber: (data.student && data.student.rollNumber) || rollNumber,
        name: (data.student && data.student.name) || (studentSession && studentSession.name) || "Student",
        section: (data.student && data.student.section) || section || "A",
      };

      sessionStorage.setItem("last_vote_receipt", JSON.stringify(receipt));
      return { success: true, refId: receipt.refId, ...receipt };
    } catch (err) {
      // Fallback: If 401 (token missing), try legacy endpoint with rollNumber if available
      if (rollNumber) {
        try {
          const fallbackRes = await fetch("/api/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rollNumber,
              candidateId,
              candidateName,
              section,
              refId: requestId,
            }),
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackRes.ok && fallbackData.success) {
            const receipt = {
              refId: fallbackData.vote?.refId || requestId,
              timestamp: fallbackData.vote?.timestamp || new Date().toLocaleString(),
              rollNumber,
              candidateName,
              section: section || "A",
            };
            sessionStorage.setItem("last_vote_receipt", JSON.stringify(receipt));
            return { success: true, refId: receipt.refId, ...receipt };
          }
        } catch (e) {}
      }

      throw err;
    }
  },

  /**
   * Check if student has already voted in the current session
   * Used by VoteConfirm to prevent duplicate submissions
   */
  hasStudentVoted(rollNumber) {
    try {
      const studentSession = authService.getStudentSession();
      if (studentSession && studentSession.voted) return true;
      const raw = sessionStorage.getItem("last_vote_receipt");
      if (!raw) return false;
      const receipt = JSON.parse(raw);
      return receipt && receipt.rollNumber === rollNumber;
    } catch (e) {
      return false;
    }
  },

  getRecentVotes() {
    const raw = sessionStorage.getItem("last_vote_receipt");
    return raw ? [JSON.parse(raw)] : [];
  },
};

export default votingService;
