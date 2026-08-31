import express from "express";
import candidateService from "../services/candidateService.js";
import { apiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

/**
 * GET /api/v1/candidates
 * Query params: ?section=A&electionId=CR2026
 */
router.get("/", apiLimiter, (req, res) => {
  const { section, electionId } = req.query;
  const currentElectionId = electionId || "CR2026";

  let candidates;
  if (section && section !== "ALL") {
    candidates = candidateService.getCandidatesBySection(section, currentElectionId);
  } else {
    candidates = candidateService.getAllCandidates(currentElectionId, false);
  }

  res.json({
    success: true,
    count: candidates.length,
    candidates: candidates.map((c) => ({
      id: c.candidate_id,
      candidate_id: c.candidate_id,
      election_id: c.election_id,
      name: c.name,
      rollNumber: c.roll_number,
      roll_number: c.roll_number,
      section: c.section,
      symbol: c.symbol,
      symbolName: c.symbol_name,
      symbol_name: c.symbol_name,
      tagline: c.tagline,
      avatarBg: c.avatar_bg,
      avatar_bg: c.avatar_bg,
      photoUrl: c.photo_url,
      photo_url: c.photo_url,
      manifesto: c.manifesto,
      keyPoints: c.key_points || [],
      key_points: c.key_points || [],
      isActive: c.active,
      active: c.active,
    })),
  });
});

/**
 * GET /api/v1/candidates/:id
 */
router.get("/:id", apiLimiter, (req, res) => {
  const cand = candidateService.getCandidateById(req.params.id);
  if (!cand) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Candidate not found." });
  }

  res.json({
    success: true,
    candidate: {
      id: cand.candidate_id,
      candidate_id: cand.candidate_id,
      name: cand.name,
      rollNumber: cand.roll_number,
      section: cand.section,
      symbol: cand.symbol,
      symbolName: cand.symbol_name,
      tagline: cand.tagline,
      manifesto: cand.manifesto,
      keyPoints: cand.key_points || [],
      avatarBg: cand.avatar_bg,
      photoUrl: cand.photo_url,
      active: cand.active,
    },
  });
});

export default router;
