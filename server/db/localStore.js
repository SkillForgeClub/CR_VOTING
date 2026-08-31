import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateSeedStudents, SEED_SETTINGS, SEED_ELECTIONS, SEED_CANDIDATES } from "./seedData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_PATH = path.join(__dirname, "..", "..", "db", "election_store.json");

/**
 * Async Mutex for atomic write transactions
 */
class AsyncMutex {
  constructor() {
    this._queue = [];
    this._locked = false;
  }

  async acquire() {
    return new Promise((resolve) => {
      if (!this._locked) {
        this._locked = true;
        resolve(this._createReleaser());
      } else {
        this._queue.push(resolve);
      }
    });
  }

  _createReleaser() {
    return () => {
      if (this._queue.length > 0) {
        const next = this._queue.shift();
        next(this._createReleaser());
      } else {
        this._locked = false;
      }
    };
  }
}

export const electionMutex = new AsyncMutex();

class LocalStore {
  constructor() {
    this.data = {
      settings: [],
      elections: [],
      students: [],
      candidates: [],
      votes: [],
      audit_logs: [],
      processed_requests: {}, // requestId -> response for idempotency
    };
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    try {
      const dbDir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, "utf8");
        const parsed = JSON.parse(raw);
        // Valid store: must have elections array (even if students/candidates are empty)
        if (parsed && Array.isArray(parsed.elections)) {
          this.data = parsed;
          // Ensure all expected keys exist
          if (!this.data.students) this.data.students = [];
          if (!this.data.candidates) this.data.candidates = [];
          if (!this.data.votes) this.data.votes = [];
          if (!this.data.audit_logs) this.data.audit_logs = [];
          if (!this.data.processed_requests) this.data.processed_requests = {};
          if (!this.data.settings) this.data.settings = [];
          this.initialized = true;
          return;
        }
      }
    } catch (e) {
      console.warn("[LocalStore] Failed to read store from disk, seeding fresh:", e.message);
    }

    // Seed defaults
    this.data = {
      settings: [...SEED_SETTINGS],
      elections: [...SEED_ELECTIONS],
      students: generateSeedStudents(),
      candidates: [...SEED_CANDIDATES],
      votes: [],
      audit_logs: [],
      processed_requests: {},
    };

    this.persist();
    this.initialized = true;
  }

  persist() {
    try {
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.data, null, 2), "utf8");
    } catch (e) {
      // Memory fallback if filesystem restricted
    }
  }

  // --- Settings ---
  getSettings() {
    this.init();
    return this.data.settings;
  }

  getSetting(key) {
    this.init();
    const item = this.data.settings.find((s) => s.key === key);
    return item ? item.value : null;
  }

  setSetting(key, value, description = "") {
    this.init();
    const existing = this.data.settings.find((s) => s.key === key);
    if (existing) {
      existing.value = String(value);
      if (description) existing.description = description;
    } else {
      this.data.settings.push({ key, value: String(value), description });
    }
    this.persist();
    return true;
  }

  // --- Elections ---
  getElection(electionId = "CR2026") {
    this.init();
    let election = this.data.elections.find((e) => e.election_id === electionId) || this.data.elections[0];
    if (!election) {
      election = {
        election_id: electionId || "CR2026",
        name: "VIIT Department of Data Science CR Elections 2026",
        status: "LIVE",
        results_visibility: "LIVE",
        start_time: new Date().toISOString(),
        end_time: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.data.elections.push(election);
      this.persist();
    }
    return election;
  }

  updateElectionStatus(electionId, newStatus) {
    this.init();
    let election = this.data.elections.find((e) => e.election_id === electionId) || this.data.elections[0];
    if (!election) {
      election = {
        election_id: electionId || "CR2026",
        name: "VIIT Department of Data Science CR Elections 2026",
        status: newStatus,
        results_visibility: "LIVE",
        start_time: new Date().toISOString(),
        end_time: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.data.elections.push(election);
    } else {
      election.status = newStatus;
      election.updated_at = new Date().toISOString();
    }
    this.persist();
    return election;
  }

  updateElection(electionId, updates) {
    this.init();
    let election = this.data.elections.find((e) => e.election_id === electionId) || this.data.elections[0];
    if (!election) {
      election = {
        election_id: electionId || "CR2026",
        name: "VIIT Department of Data Science CR Elections 2026",
        status: "LIVE",
        results_visibility: "LIVE",
        start_time: new Date().toISOString(),
        end_time: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...updates,
      };
      this.data.elections.push(election);
    } else {
      Object.assign(election, updates, { updated_at: new Date().toISOString() });
    }
    this.persist();
    return election;
  }

  // --- Students ---
  getAllStudents() {
    this.init();
    return this.data.students;
  }

  getStudentByRoll(rollNumber) {
    this.init();
    if (!rollNumber) return null;
    const clean = rollNumber.trim().toUpperCase();
    return this.data.students.find((s) => s.roll_number && s.roll_number.toUpperCase() === clean) || null;
  }

  getStudentById(studentId) {
    this.init();
    if (!studentId) return null;
    return this.data.students.find((s) => s.student_id === studentId) || null;
  }

  markStudentVoted(studentId) {
    this.init();
    const student = this.data.students.find((s) => s.student_id === studentId);
    if (student) {
      student.voted = true;
      student.voted_at = new Date().toISOString();
      student.updated_at = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  }

  importStudents(studentList) {
    this.init();
    let imported = 0;
    for (const item of studentList) {
      if (!item.roll_number || !item.name) continue;
      const cleanRoll = item.roll_number.trim().toUpperCase();
      const existingIdx = this.data.students.findIndex((s) => s.roll_number.toUpperCase() === cleanRoll);
      const record = {
        student_id: item.student_id || `S${String(this.data.students.length + 1).padStart(4, "0")}`,
        roll_number: cleanRoll,
        name: item.name.trim(),
        email: item.email ? item.email.trim().toLowerCase() : `${cleanRoll.toLowerCase()}@viit.ac.in`,
        section: (item.section || "A").toUpperCase(),
        eligible: item.eligible !== false && item.eligible !== "FALSE",
        voted: item.voted === true || item.voted === "TRUE",
        voted_at: item.voted_at || null,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        this.data.students[existingIdx] = { ...this.data.students[existingIdx], ...record };
      } else {
        this.data.students.push(record);
      }
      imported++;
    }
    this.persist();
    return imported;
  }

  // --- Candidates ---
  getAllCandidates(electionId = "CR2026") {
    this.init();
    return this.data.candidates.filter((c) => !electionId || c.election_id === electionId);
  }

  getCandidatesBySection(section = "A", electionId = "CR2026") {
    this.init();
    const cleanSec = section.trim().toUpperCase();
    return this.data.candidates.filter(
      (c) =>
        (!electionId || c.election_id === electionId) &&
        c.section.toUpperCase() === cleanSec &&
        c.active !== false
    );
  }

  getCandidateById(candidateId) {
    this.init();
    return this.data.candidates.find((c) => c.candidate_id === candidateId) || null;
  }

  addCandidate(candidateData) {
    this.init();
    const newCand = {
      candidate_id: candidateData.candidate_id || `cand-${Date.now()}`,
      election_id: candidateData.election_id || "CR2026",
      name: candidateData.name.trim(),
      roll_number: (candidateData.roll_number || "").trim().toUpperCase(),
      section: (candidateData.section || "A").toUpperCase(),
      symbol: candidateData.symbol || "🌟",
      symbol_name: candidateData.symbol_name || "Vision",
      tagline: candidateData.tagline || "",
      avatar_bg: candidateData.avatar_bg || "linear-gradient(135deg, #1e3a8a, #3b82f6)",
      photo_url: candidateData.photo_url || "",
      manifesto: candidateData.manifesto || "",
      key_points: Array.isArray(candidateData.key_points) ? candidateData.key_points : [],
      active: candidateData.active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.candidates.push(newCand);
    this.persist();
    return newCand;
  }

  updateCandidate(candidateId, updates) {
    this.init();
    const cand = this.data.candidates.find((c) => c.candidate_id === candidateId);
    if (cand) {
      Object.assign(cand, updates, { updated_at: new Date().toISOString() });
      this.persist();
      return cand;
    }
    return null;
  }

  deleteCandidate(candidateId) {
    this.init();
    const idx = this.data.candidates.findIndex((c) => c.candidate_id === candidateId);
    if (idx >= 0) {
      this.data.candidates.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  // --- Votes & Idempotency ---
  getAllVotes(electionId = "CR2026") {
    this.init();
    return this.data.votes.filter((v) => !electionId || v.election_id === electionId);
  }

  getProcessedRequest(requestId) {
    this.init();
    if (!requestId) return null;
    return this.data.processed_requests[requestId] || null;
  }

  setProcessedRequest(requestId, result) {
    this.init();
    if (!requestId) return;
    this.data.processed_requests[requestId] = {
      result,
      timestamp: new Date().toISOString(),
    };
    this.persist();
  }

  recordVoteEntry(voteEntry) {
    this.init();
    this.data.votes.push(voteEntry);
    this.persist();
    return voteEntry;
  }

  // --- Audit Logs ---
  addAuditLog({ request_id, actor_type, actor_id, action, status, metadata = {} }) {
    this.init();
    const entry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      request_id: request_id || "system",
      actor_type: actor_type || "STUDENT", // STUDENT | ADMIN | SYSTEM
      actor_id: actor_id || "anonymous",
      action,
      status, // SUCCESS | FAILED | REJECTED | BLOCKED
      metadata: typeof metadata === "object" ? JSON.stringify(metadata) : String(metadata),
    };
    this.data.audit_logs.push(entry);
    // Keep max 5000 in memory
    if (this.data.audit_logs.length > 5000) {
      this.data.audit_logs.shift();
    }
    this.persist();
    return entry;
  }

  getAuditLogs(limit = 100, filterAction = null) {
    this.init();
    let logs = [...this.data.audit_logs];
    if (filterAction) {
      logs = logs.filter((l) => l.action === filterAction);
    }
    return logs.reverse().slice(0, limit);
  }

  // --- Reset for Testing ---
  resetTestVotes() {
    this.init();
    this.data.votes = [];
    this.data.processed_requests = {};
    for (const student of this.data.students) {
      student.voted = false;
      student.voted_at = null;
    }
    this.persist();
    return true;
  }
}

export const localStore = new LocalStore();
localStore.init();
export default localStore;
