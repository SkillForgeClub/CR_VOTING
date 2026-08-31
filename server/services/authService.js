import config from "../config/index.js";
import studentService from "./studentService.js";
import auditService, { AuditActions } from "./auditService.js";
import { createSessionToken, verifySessionToken } from "../utils/cryptoUtils.js";

export const authService = {
  /**
   * Authenticate student and issue a signed session token
   */
  async authenticateStudent({ rollNumber, name, section, otp, token, requestId = "auth" }) {
    if (!rollNumber || !name) {
      throw { status: 400, code: "MISSING_CREDENTIALS", message: "Student full name and roll number are required." };
    }

    const cleanRoll = rollNumber.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanSection = (section || "A").trim().toUpperCase();

    // 1. Check Student in Authoritative Roster
    const student = studentService.getStudentByRoll(cleanRoll);
    if (!student) {
      auditService.log({
        requestId,
        actorType: "STUDENT",
        actorId: cleanRoll,
        action: AuditActions.LOGIN_FAILED,
        status: "FAILED",
        metadata: { reason: "NOT_IN_ROSTER", rollNumber: cleanRoll, providedName: cleanName },
      });
      throw {
        status: 404,
        code: "STUDENT_NOT_FOUND",
        message: `Roll number ${cleanRoll} is not found in the official Department of Data Science roster.`,
      };
    }

    // 2. Check Section Match if provided
    if (student.section.toUpperCase() !== cleanSection) {
      throw {
        status: 400,
        code: "SECTION_MISMATCH",
        message: `Registered section for ${cleanRoll} is Section ${student.section}, but Section ${cleanSection} was selected.`,
      };
    }

    // 3. Verify Name Fuzzy / Exact Match
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const rosterNorm = normalize(student.name);
    const inputNorm = normalize(cleanName);

    const nameMatches =
      rosterNorm.includes(inputNorm) ||
      inputNorm.includes(rosterNorm) ||
      cleanName.split(" ").some((part) => student.name.toLowerCase().includes(part.toLowerCase()));

    if (!nameMatches && config.electionMode === "PRODUCTION") {
      throw {
        status: 401,
        code: "NAME_MISMATCH",
        message: "Provided name does not match the departmental records for this roll number.",
      };
    }

    // 4. Eligibility Check
    if (!student.eligible) {
      auditService.log({
        requestId,
        actorType: "STUDENT",
        actorId: cleanRoll,
        action: AuditActions.LOGIN_FAILED,
        status: "BLOCKED",
        metadata: { reason: "NOT_ELIGIBLE", studentId: student.student_id },
      });
      throw {
        status: 403,
        code: "STUDENT_NOT_ELIGIBLE",
        message: "This student account is not eligible to vote in the current election.",
      };
    }

    // 5. Generate Signed Student Session Token (valid for 2 hours)
    const sessionPayload = {
      studentId: student.student_id,
      rollNumber: student.roll_number,
      name: student.name,
      section: student.section,
      role: "STUDENT",
      voted: student.voted,
    };

    const sessionToken = createSessionToken(sessionPayload, config.appSecret, 7200);

    auditService.log({
      requestId,
      actorType: "STUDENT",
      actorId: cleanRoll,
      action: AuditActions.LOGIN_SUCCESS,
      status: "SUCCESS",
      metadata: { studentId: student.student_id, section: student.section, alreadyVoted: student.voted },
    });

    return {
      token: sessionToken,
      student: {
        studentId: student.student_id,
        rollNumber: student.roll_number,
        name: student.name,
        section: student.section,
        eligible: student.eligible,
        voted: student.voted,
        votedAt: student.voted_at,
      },
    };
  },

  /**
   * Authenticate Administrator and issue role-bearing session token
   */
  async authenticateAdmin({ username, password, requestId = "admin-auth" }) {
    if (!username || !password) {
      throw { status: 400, code: "MISSING_CREDENTIALS", message: "Username and password are required." };
    }

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // Check configured admin accounts
    const matchedAdmin = config.admins.find(
      (a) => a.username.toLowerCase() === cleanUser && a.password === cleanPass
    );

    if (!matchedAdmin) {
      auditService.log({
        requestId,
        actorType: "ADMIN",
        actorId: cleanUser,
        action: AuditActions.LOGIN_FAILED,
        status: "FAILED",
        metadata: { username: cleanUser },
      });

      throw {
        status: 401,
        code: "ADMIN_AUTH_FAILED",
        message: "Invalid administrator username or security passcode.",
      };
    }

    const tokenPayload = {
      adminId: matchedAdmin.id,
      username: matchedAdmin.username,
      name: matchedAdmin.name,
      role: matchedAdmin.role, // SUPER_ADMIN, ELECTION_ADMIN, OBSERVER
    };

    const token = createSessionToken(tokenPayload, config.adminSecret, 14400); // 4 hours

    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: matchedAdmin.username,
      action: AuditActions.ADMIN_LOGIN,
      status: "SUCCESS",
      metadata: { role: matchedAdmin.role, name: matchedAdmin.name },
    });

    return {
      token,
      admin: {
        adminId: matchedAdmin.id,
        username: matchedAdmin.username,
        name: matchedAdmin.name,
        role: matchedAdmin.role,
      },
    };
  },

  verifyToken(token, isStaff = false) {
    const secret = isStaff ? config.adminSecret : config.appSecret;
    return verifySessionToken(token, secret);
  },
};

export default authService;
