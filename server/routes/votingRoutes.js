import express from "express";
import votingService from "../services/votingService.js";
import { voteLimiter } from "../middleware/rateLimiter.js";
import { requireStudentAuth } from "../middleware/authMiddleware.js";
import { validateVoteRequest } from "../middleware/validate.js";
import studentService from "../services/studentService.js";

const router = express.Router();

/**
 * POST /api/v1/votes
 * Official, authenticated atomic voting transaction
 */
router.post("/", voteLimiter, requireStudentAuth, validateVoteRequest, async (req, res, next) => {
  try {
    const { candidateId, electionId, requestId } = req.body;
    const studentId = req.student.studentId;

    const receipt = await votingService.castVote({
      studentId: req.student.studentId,
      rollNumber: req.student.rollNumber,
      candidateId,
      electionId: electionId || "CR2026",
      requestId: requestId || req.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json(receipt);
  } catch (err) {
    next(err);
  }
});

/**
 * Legacy API compatibility route: POST /api/vote
 * If legacy frontend calls this directly with rollNumber, authenticate student internally and cast safely
 */
export async function legacyVoteHandler(req, res, next) {
  try {
    const { rollNumber, candidateId, refId } = req.body || {};
    if (!rollNumber) {
      return res.status(400).json({ success: false, code: "MISSING_ROLL", message: "Student roll number is required." });
    }

    const student = studentService.getStudentByRoll(rollNumber);
    if (!student) {
      return res.status(404).json({ success: false, code: "STUDENT_NOT_FOUND", message: "Student roll number not registered." });
    }

    const receipt = await votingService.castVote({
      studentId: student.student_id,
      candidateId: candidateId || req.body.candidateName,
      electionId: "CR2026",
      requestId: refId || req.id,
    });

    res.json({
      success: true,
      message: "Vote recorded successfully",
      vote: {
        refId: receipt.voteReference,
        timestamp: receipt.timestamp,
        rollNumber: student.roll_number,
        name: student.name,
        section: student.section,
      },
    });
  } catch (err) {
    next(err);
  }
}

export default router;
