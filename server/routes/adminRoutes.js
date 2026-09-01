import express from "express";
import { requireAdminAuth, requireAdminRole } from "../middleware/authMiddleware.js";
import { validateCandidateInput } from "../middleware/validate.js";
import resultsService from "../services/resultsService.js";
import candidateService from "../services/candidateService.js";
import electionService from "../services/electionService.js";
import studentService from "../services/studentService.js";
import auditService from "../services/auditService.js";
import votingService from "../services/votingService.js";
import localStore from "../db/localStore.js";
import databaseAdapter from "../db/databaseAdapter.js";

import googleSheetsSyncService from "../services/googleSheetsSyncService.js";

const router = express.Router();

// Apply admin authentication to all admin routes
router.use(requireAdminAuth);

/**
 * GET /api/v1/admin/dashboard
 */
router.get("/dashboard", async (req, res) => {
  const metrics = await resultsService.getDashboardMetrics("CR2026", req.admin.role);
  const election = electionService.getElection("CR2026");
  const rosterSummary = await studentService.getRosterSummary();

  res.json({
    success: true,
    metrics,
    election,
    rosterSummary,
    admin: req.admin,
  });
});

/**
 * GET /api/v1/admin/results
 */
router.get("/results", async (req, res) => {
  const results = await resultsService.getResults("CR2026", req.admin.role);
  res.json({
    success: true,
    ...results,
  });
});

/**
 * GET /api/v1/admin/students
 */
router.get("/students", async (req, res, next) => {
  try {
    const { query, section, page, limit } = req.query;
    const result = await studentService.searchStudents({
      query: query || "",
      section: section || "ALL",
      page: parseInt(page || "1", 10),
      limit: parseInt(limit || "50", 10),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/students/import
 * Requires SUPER_ADMIN or ELECTION_ADMIN
 */
router.post("/students/import", requireAdminRole(["SUPER_ADMIN", "ELECTION_ADMIN"]), async (req, res, next) => {
  try {
    const { csvData } = req.body;
    const result = await studentService.importCsvRoster(csvData, req.admin.username, req.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/roster/sync-preview
 * Generate synchronization preview diff from Google Sheet URL or raw CSV
 */
router.post("/roster/sync-preview", requireAdminRole(["SUPER_ADMIN", "ELECTION_ADMIN"]), async (req, res, next) => {
  try {
    const { sheetUrl, csvData } = req.body;
    let parsedResult;

    if (sheetUrl) {
      parsedResult = await googleSheetsSyncService.fetchRosterFromUrl(sheetUrl);
    } else if (csvData) {
      parsedResult = googleSheetsSyncService.parseGoogleSheetCsv(csvData);
    } else {
      return res.status(400).json({ success: false, message: "Either sheetUrl or csvData must be provided." });
    }

    if (parsedResult.error) {
      return res.status(400).json({ success: false, ...parsedResult });
    }

    const existingStudents = await databaseAdapter.getAllStudents();
    const preview = googleSheetsSyncService.generatePreview(parsedResult, existingStudents);

    res.json(preview);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/roster/sync-confirm
 * Confirm sync and apply updates to authoritative roster without clearing vote history
 */
router.post("/roster/sync-confirm", requireAdminRole(["SUPER_ADMIN", "ELECTION_ADMIN"]), async (req, res, next) => {
  try {
    const { studentsList } = req.body;
    if (!Array.isArray(studentsList) || studentsList.length === 0) {
      return res.status(400).json({ success: false, message: "Confirmed student list cannot be empty." });
    }

    const election = await electionService.getElection("CR2026");
    if (election && election.status === "LIVE" && !["SUPER_ADMIN", "ELECTION_ADMIN"].includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        code: "LIVE_ELECTION_RESTRICTION",
        message: "Roster modifications during LIVE election require administrator authorization.",
      });
    }

    const result = await studentService.syncRosterFromParsed(studentsList, req.admin.username, req.id);
    res.json({
      success: true,
      message: `Roster synchronization complete. ${result.count} students synchronized.`,
      count: result.count,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/candidates
 */
router.get("/candidates", async (req, res, next) => {
  try {
    const candidates = await candidateService.getAllCandidates("CR2026", true);
    res.json({
      success: true,
      candidates,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/candidates
 */
router.post("/candidates", requireAdminRole(["SUPER_ADMIN", "ELECTION_ADMIN"]), validateCandidateInput, async (req, res, next) => {
  try {
    const created = await candidateService.createCandidate(req.body, req.admin.username, req.id);
    res.status(201).json({ success: true, candidate: created });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/admin/candidates/:id
 */
router.patch("/candidates/:id", requireAdminRole(["SUPER_ADMIN", "ELECTION_ADMIN"]), async (req, res, next) => {
  try {
    const updated = await candidateService.updateCandidate(req.params.id, req.body, req.admin.username, req.id);
    res.json({ success: true, candidate: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/candidates/:id/toggle
 */
router.post("/candidates/:id/toggle", requireAdminRole(["SUPER_ADMIN", "ELECTION_ADMIN"]), async (req, res, next) => {
  try {
    const updated = await candidateService.toggleCandidateActive(req.params.id, req.admin.username, req.id);
    res.json({ success: true, candidate: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/admin/candidates/:id
 */
router.delete("/candidates/:id", requireAdminRole(["SUPER_ADMIN"]), async (req, res, next) => {
  try {
    const success = await candidateService.deleteCandidate(req.params.id, req.admin.username, req.id);
    res.json({ success });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/election/start
 */
router.post("/election/start", requireAdminRole(["SUPER_ADMIN", "ELECTION_ADMIN"]), async (req, res, next) => {
  try {
    const election = await electionService.startElection("CR2026", req.admin.username, req.id);
    res.json({ success: true, status: election.status, election });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/election/pause
 */
router.post("/election/pause", requireAdminRole(["SUPER_ADMIN", "ELECTION_ADMIN"]), async (req, res, next) => {
  try {
    const election = await electionService.pauseElection("CR2026", req.admin.username, req.id);
    res.json({ success: true, status: election.status, election });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/election/resume
 */
router.post("/election/resume", requireAdminRole(["SUPER_ADMIN", "ELECTION_ADMIN"]), async (req, res, next) => {
  try {
    const election = await electionService.resumeElection("CR2026", req.admin.username, req.id);
    res.json({ success: true, status: election.status, election });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/election/close
 */
router.post("/election/close", requireAdminRole(["SUPER_ADMIN"]), async (req, res, next) => {
  try {
    const election = await electionService.closeElection("CR2026", req.admin.username, req.id);
    res.json({ success: true, status: election.status, election });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/election/visibility
 */
router.post("/election/visibility", requireAdminRole(["SUPER_ADMIN"]), async (req, res, next) => {
  try {
    const { visibility } = req.body;
    const election = await electionService.updateResultsVisibility(visibility, "CR2026", req.admin.username, req.id);
    res.json({ success: true, results_visibility: election.results_visibility, election });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/audit-logs
 */
router.get("/audit-logs", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || "100", 10);
    const action = req.query.action || null;
    const logs = await auditService.getLogs(limit, action);
    res.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/reset-votes
 * Strictly for test mode or authorized SUPER_ADMIN
 */
router.post("/reset-votes", requireAdminRole(["SUPER_ADMIN"]), async (req, res, next) => {
  try {
    await votingService.resetTestVotes(req.admin.username, req.id);
    res.json({
      success: true,
      message: "All recorded test ballots and voter flags have been reset.",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/database-status
 * Check live database status (Supabase PostgreSQL / RLS / RPC status)
 */
router.get("/database-status", (req, res) => {
  const dbInfo = databaseAdapter.getDatabaseInfo();
  res.json({
    success: true,
    database: dbInfo,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/admin/export/csv
 * Export official ballots to CSV format — sourced from Supabase
 */
router.get("/export/csv", async (req, res, next) => {
  try {
    // Fetch votes from Supabase with student and candidate names
    let votes = [];
    if (databaseAdapter.isSupabaseActive()) {
      const supabaseServer = (await import("../db/supabaseClient.js")).default;
      const { data: sbVotes } = await supabaseServer
        .from("votes")
        .select("vote_reference, created_at, section, student_id, candidate_id")
        .eq("election_id", "CR2026")
        .order("created_at", { ascending: true });

      if (sbVotes && sbVotes.length > 0) {
        const studentIds = [...new Set(sbVotes.map((v) => v.student_id))];
        const candidateIds = [...new Set(sbVotes.map((v) => v.candidate_id))];
        const [{ data: stuRows }, { data: candRows }] = await Promise.all([
          supabaseServer.from("students").select("id, name, roll_number").in("id", studentIds),
          supabaseServer.from("candidates").select("id, name").in("id", candidateIds),
        ]);
        const stuMap = Object.fromEntries((stuRows || []).map((s) => [s.id, s]));
        const candMap = Object.fromEntries((candRows || []).map((c) => [c.id, c]));
        votes = sbVotes.map((v) => ({
          ref_id: v.vote_reference,
          timestamp: v.created_at,
          roll_number: stuMap[v.student_id]?.roll_number || "—",
          student_name: stuMap[v.student_id]?.name || "Unknown",
          section: v.section,
          candidate_name: candMap[v.candidate_id]?.name || "Unknown",
          candidate_id: v.candidate_id,
        }));
      }
    } else {
      votes = localStore.getAllVotes("CR2026");
    }

    const headers = ["Reference ID", "Timestamp", "Roll Number", "Student Name", "Section", "Candidate Voted", "Candidate ID"];
    const rows = votes.map((v) => [
      `"${v.ref_id || ""}"`,
      `"${v.timestamp || ""}"`,
      `"${v.roll_number || ""}"`,
      `"${v.student_name || ""}"`,
      `"${v.section || ""}"`,
      `"${v.candidate_name || ""}"`,
      `"${v.candidate_id || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="VIIT_CR_Election_Ballots_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err) { next(err); }
});

export default router;
