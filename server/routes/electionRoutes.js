import express from "express";
import electionService from "../services/electionService.js";
import resultsService from "../services/resultsService.js";
import { apiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

/**
 * GET /api/v1/election/status
 */
router.get("/status", apiLimiter, async (req, res, next) => {
  try {
    const [status, config] = await Promise.all([
      electionService.getStatus(),
      electionService.getPublicConfig(),
    ]);
    res.json({
      success: true,
      status,
      ...config,
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/election/config
 */
router.get("/config", apiLimiter, async (req, res, next) => {
  try {
    const config = await electionService.getPublicConfig();
    res.json({
      success: true,
      ...config,
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/election/results
 * Public / Student results endpoint (governed by results_visibility)
 */
router.get("/results", apiLimiter, async (req, res, next) => {
  try {
    const results = await resultsService.getResults("CR2026", null);
    res.json({
      success: true,
      ...results,
    });
  } catch (err) { next(err); }
});

export default router;
