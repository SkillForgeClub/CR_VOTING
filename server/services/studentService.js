import localStore from "../db/localStore.js";
import supabaseServer from "../db/supabaseClient.js";
import auditService, { AuditActions } from "./auditService.js";
import databaseAdapter from "../db/databaseAdapter.js";

export const studentService = {
  // ---------------------------------------------------------------------------
  // READ: Always Supabase-first, local store fallback (cache warm-up only)
  // ---------------------------------------------------------------------------

  async getStudentByRoll(rollNumber) {
    if (!rollNumber) return null;
    if (supabaseServer) {
      try {
        const { data, error } = await supabaseServer
          .from("students")
          .select("*")
          .eq("roll_number", rollNumber.trim().toUpperCase())
          .maybeSingle();
        if (!error && data) return this._normalizeStudent(data);
      } catch (e) {
        console.warn("[StudentService] Supabase getStudentByRoll failed:", e.message);
      }
    }
    return localStore.getStudentByRoll(rollNumber);
  },

  async getStudentById(studentId) {
    if (!studentId) return null;
    if (supabaseServer) {
      try {
        const { data, error } = await supabaseServer
          .from("students")
          .select("*")
          .eq("id", studentId)
          .maybeSingle();
        if (!error && data) return this._normalizeStudent(data);
      } catch (e) {
        console.warn("[StudentService] Supabase getStudentById failed:", e.message);
      }
    }
    return localStore.getStudentById(studentId);
  },

  async checkEligibility(rollNumber) {
    const student = await this.getStudentByRoll(rollNumber);
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
    const voted = students.filter((s) => s.voted || s.has_voted).length;

    const sections = {};
    for (const s of students) {
      const sec = (s.section || "A").toUpperCase();
      if (!sections[sec]) sections[sec] = { total: 0, voted: 0 };
      sections[sec].total++;
      if (s.voted || s.has_voted) sections[sec].voted++;
    }

    return { total, eligible, voted, sections };
  },

  // ---------------------------------------------------------------------------
  // SEARCH: Supabase-backed pagination/filtering
  // ---------------------------------------------------------------------------

  async searchStudents({ query = "", section = "ALL", page = 1, limit = 50 }) {
    if (supabaseServer) {
      try {
        let sb = supabaseServer.from("students").select("*", { count: "exact" });

        if (section && section !== "ALL") {
          sb = sb.eq("section", section.toUpperCase());
        }

        if (query) {
          const q = query.trim();
          sb = sb.or(`roll_number.ilike.%${q}%,name.ilike.%${q}%,email.ilike.%${q}%`);
        }

        const from = (page - 1) * limit;
        sb = sb.range(from, from + limit - 1).order("roll_number", { ascending: true });

        const { data, error, count } = await sb;
        if (!error && data) {
          return {
            total: count || data.length,
            page,
            limit,
            totalPages: Math.ceil((count || data.length) / limit),
            students: data.map(this._normalizeStudent),
          };
        }
      } catch (e) {
        console.warn("[StudentService] Supabase searchStudents failed:", e.message);
      }
    }

    // Fallback to local store
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
    const paginated = filtered.slice(start, start + limit).map(this._normalizeStudent);
    return { total, page, limit, totalPages: Math.ceil(total / limit), students: paginated };
  },

  // ---------------------------------------------------------------------------
  // WRITE: Upsert directly to Supabase first
  // ---------------------------------------------------------------------------

  async importCsvRoster(csvText, adminUser = "admin", requestId = "import") {
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

    // Primary write: Supabase upsert
    let importedCount = studentsToImport.length;
    if (supabaseServer) {
      try {
        const { error } = await supabaseServer.from("students").upsert(
          studentsToImport.map((s) => ({
            roll_number: s.roll_number,
            name: s.name,
            section: s.section,
            email: s.email,
            eligible: s.eligible,
          })),
          { onConflict: "roll_number", ignoreDuplicates: false }
        );
        if (error) console.warn("[StudentService] Supabase upsert error:", error.message);
      } catch (e) {
        console.warn("[StudentService] Supabase upsert failed:", e.message);
      }
    }

    // Also update local cache
    localStore.importStudents(studentsToImport);

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

  async syncRosterFromParsed(studentsList, adminUser = "admin", requestId = "sheet-sync") {
    if (!Array.isArray(studentsList)) {
      throw new Error("Student list must be an array.");
    }

    let importedCount = studentsList.length;
    if (supabaseServer) {
      try {
        const { error } = await supabaseServer.from("students").upsert(
          studentsList.map((s) => ({
            roll_number: (s.roll_number || s.rollNumber || "").toUpperCase(),
            name: s.name,
            section: (s.section || "A").toUpperCase(),
            email: s.email || `${(s.roll_number || "student").toLowerCase()}@viit.ac.in`,
            eligible: s.eligible !== false,
          })),
          { onConflict: "roll_number", ignoreDuplicates: false }
        );
        if (error) console.warn("[StudentService] Supabase sync upsert error:", error.message);
      } catch (e) {
        console.warn("[StudentService] Supabase sync failed:", e.message);
      }
    }

    localStore.importStudents(studentsList);

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

  // ---------------------------------------------------------------------------
  // Normalize Supabase row → common student shape
  // ---------------------------------------------------------------------------
  _normalizeStudent(s) {
    return {
      student_id: s.id || s.student_id,
      id: s.id || s.student_id,
      roll_number: s.roll_number,
      name: s.name,
      section: s.section,
      email: s.email,
      eligible: s.eligible !== false,
      voted: Boolean(s.has_voted || s.voted),
      voted_at: s.voted_at || null,
    };
  },
};

export default studentService;
