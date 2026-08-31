import config from "../config/index.js";

/**
 * Student roster is NOT seeded with mock data.
 * Load real students via Admin → Settings → Google Sheets Roster Sync.
 */
export function generateSeedStudents() {
  return [];
}

export const SEED_SETTINGS = [
  { key: "ELECTION_NAME", value: "VIIT CR Elections 2026", description: "Official Title" },
  { key: "COLLEGE_NAME", value: "Vignan's Institute of Information Technology", description: "Institution Name" },
  { key: "DEPARTMENT", value: "Department of Data Science", description: "Academic Department" },
  { key: "CLUB_NAME", value: "SkillForge Club", description: "Organizing Body" },
  { key: "CURRENT_ELECTION_ID", value: "CR2026", description: "Active Election Unique Identifier" },
  { key: "RESULTS_VISIBILITY", value: "LIVE", description: "HIDDEN | ADMIN_ONLY | LIVE" },
  { key: "ALLOW_RETEST", value: "TRUE", description: "Allow test reset in dev environment" }
];

export const SEED_ELECTIONS = [
  {
    election_id: "CR2026",
    name: "VIIT Department of Data Science CR Elections 2026",
    status: "UPCOMING", // Set to LIVE via Admin panel when ready
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 86400000).toISOString(),
    results_visibility: "LIVE",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

/**
 * Candidates are NOT seeded with mock data.
 * Add real candidates via Admin → Candidate Roster → "+ Add Contesting Candidate".
 */
export const SEED_CANDIDATES = [];
