import localStore from "../db/localStore.js";
import databaseAdapter from "../db/databaseAdapter.js";
import auditService, { AuditActions } from "./auditService.js";

export const studentService = {
  getStudentByRoll(rollNumber) {
    if (!rollNumber) return null;
    return localStore.getStudentByRoll(rollNumber);
  },

  getStudentById(studentId) {
    if (!studentId) return null;
    return localStore.getStudentById(studentId);
  },

  checkEligibility(rollNumber) {
    const student = this.getStudentByRoll(rollNumber);
    if (!student) {
      return { eligible: false, reason: "STUDENT_NOT_FOUND", message: "Student roll number is not registered in the departmental roster." };
    }
    if (!student.eligible) {
      return { eligible: false, reason: "NOT_ELIGIBLE", message: "Student is marked as not eligible to vote in this election." };
    }
    if (student.voted) {
      return { eligible: false, reason: "ALREADY_VOTED", message: `Roll number ${student.roll_number} has already cast a ballot.` };
    }
    return { eligible: true, student };
  },

  async getRosterSummary() {
    const students = await databaseAdapter.getAllStudents();
    const total = students.length;
    const eligible = students.filter((s) => s.eligible).length;
    const voted = students.filter((s) => s.voted).length;

    const sections = {
      A: { total: 0, voted: 0 },
      B: { total: 0, voted: 0 },
      C: { total: 0, voted: 0 },
      D: { total: 0, voted: 0 },
    };

    for (const s of students) {
      const sec = (s.section || "A").toUpperCase();
      if (!sections[sec]) sections[sec] = { total: 0, voted: 0 };
      sections[sec].total++;
      if (s.voted) sections[sec].voted++;
    }

    return { total, eligible, voted, sections };
  },

  // Admin-only search and list
  searchStudents({ query = "", section = "ALL", page = 1, limit = 50 }) {
    const all = localStore.getAllStudents();
    let filtered = all;

    if (section && section !== "ALL") {
      filtered = filtered.filter((s) => (s.section || "A").toUpperCase() === section.toUpperCase());
    }

    if (query) {
      const q = query.toLowerCase().trim();
      filtered = filtered.filter(
        (s) =>
          s.roll_number.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.email && s.email.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = filtered.slice(start, end).map((s) => ({
      student_id: s.student_id,
      roll_number: s.roll_number,
      name: s.name,
      section: s.section,
      eligible: s.eligible,
      voted: s.voted,
      voted_at: s.voted_at,
    }));

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      students: paginated,
    };
  },

  importCsvRoster(csvText, adminUser = "admin", requestId = "import") {
    if (!csvText || typeof csvText !== "string") {
      throw new Error("Invalid CSV content provided.");
    }

    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error("CSV file must contain a header row and at least one student row.");
    }

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const rollIdx = header.findIndex((h) => h.includes("roll"));
    const nameIdx = header.findIndex((h) => h.includes("name"));
    const secIdx = header.findIndex((h) => h.includes("sec"));
    const emailIdx = header.findIndex((h) => h.includes("email"));
    const eligIdx = header.findIndex((h) => h.includes("elig"));

    if (rollIdx === -1 || nameIdx === -1) {
      throw new Error("CSV must include columns for 'roll_number' and 'name'.");
    }

    const studentsToImport = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const roll = cols[rollIdx];
      const name = cols[nameIdx];
      if (!roll || !name) continue;

      studentsToImport.push({
        roll_number: roll.toUpperCase(),
        name,
        section: secIdx >= 0 && cols[secIdx] ? cols[secIdx].toUpperCase() : "A",
        email: emailIdx >= 0 && cols[emailIdx] ? cols[emailIdx] : `${roll.toLowerCase()}@viit.ac.in`,
        eligible: eligIdx >= 0 ? cols[eligIdx].toLowerCase() !== "false" && cols[eligIdx] !== "0" : true,
      });
    }

    const importedCount = localStore.importStudents(studentsToImport);

    // Asynchronously synchronize to Supabase PostgreSQL if active
    databaseAdapter.syncStudentsToSupabase(studentsToImport).catch((e) => {
      console.warn("[StudentService] Supabase sync warning:", e.message);
    });

    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: adminUser,
      action: AuditActions.ROSTER_IMPORTED,
      status: "SUCCESS",
      metadata: { importedCount, totalRowsProcessed: lines.length - 1 },
    });

    return { success: true, count: importedCount };
  },

  syncRosterFromParsed(studentsList, adminUser = "admin", requestId = "sheet-sync") {
    if (!Array.isArray(studentsList)) {
      throw new Error("Student list must be an array.");
    }

    const importedCount = localStore.importStudents(studentsList);

    // Asynchronously synchronize to Supabase PostgreSQL if active
    databaseAdapter.syncStudentsToSupabase(studentsList).catch((e) => {
      console.warn("[StudentService] Supabase sync warning:", e.message);
    });

    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: adminUser,
      action: "ROSTER_SYNC_GOOGLE_SHEETS",
      status: "SUCCESS",
      metadata: { importedCount, totalSynced: studentsList.length },
    });

    return { success: true, count: importedCount };
  },
};

export default studentService;
