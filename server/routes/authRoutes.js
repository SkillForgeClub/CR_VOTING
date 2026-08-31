import express from "express";
import authService from "../services/authService.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { requireStudentAuth, requireAdminAuth } from "../middleware/authMiddleware.js";
import studentService from "../services/studentService.js";

const router = express.Router();

/**
 * POST /api/v1/auth/student/login
 */
router.post("/student/login", authLimiter, async (req, res, next) => {
  try {
    const { rollNumber, name, section, otp, token } = req.body || {};
    const result = await authService.authenticateStudent({
      rollNumber,
      name,
      section,
      otp,
      token,
      requestId: req.id,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/auth/student/session
 */
router.get("/student/session", requireStudentAuth, (req, res) => {
  const student = studentService.getStudentById(req.student.studentId);
  if (!student) {
    return res.status(404).json({ success: false, code: "STUDENT_NOT_FOUND", message: "Student record missing." });
  }

  res.json({
    success: true,
    student: {
      studentId: student.student_id,
      rollNumber: student.roll_number,
      name: student.name,
      section: student.section,
      eligible: student.eligible,
      voted: student.voted,
      votedAt: student.voted_at,
    },
  });
});

/**
 * POST /api/v1/auth/admin/login
 */
router.post("/admin/login", authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await authService.authenticateAdmin({
      username,
      password,
      requestId: req.id,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/auth/admin/session
 */
router.get("/admin/session", requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    admin: req.admin,
  });
});

/**
 * POST /api/v1/auth/logout
 */
router.post("/logout", (req, res) => {
  res.json({ success: true, message: "Session successfully terminated." });
});

export default router;
