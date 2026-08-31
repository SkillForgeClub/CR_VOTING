import express from "express";
import electionService from "../services/electionService.js";
import resultsService from "../services/resultsService.js";
import { apiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

/**
 * GET /api/v1/election/status
 */
router.get("/status", apiLimiter, (req, res) => {
  const status = electionService.getStatus();
  const config = electionService.getPublicConfig();
  res.json({
    success: true,
    status,
    ...config,
  });
});

/**
 * GET /api/v1/election/config
 */
router.get("/config", apiLimiter, (req, res) => {
  const config = electionService.getPublicConfig();
  res.json({
    success: true,
    ...config,
  });
});

/**
 * GET /api/v1/election/results
 * Public / Student results endpoint (governed by results_visibility)
 */
router.get("/results", apiLimiter, (req, res) => {
  const results = resultsService.getResults("CR2026", null);
  res.json({
    success: true,
    ...results,
  });
});

export default router;
