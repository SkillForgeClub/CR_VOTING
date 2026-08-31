import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  electionMode: process.env.ELECTION_MODE || "TEST",
  appSecret: process.env.APP_SECRET || "viit-cr-election-2026-secret-key-skillforge-data-science",
  adminSecret: process.env.ADMIN_AUTH_SECRET || "viit-cr-admin-super-secret-key-2026",
  
  // Google Apps Script Integration
  gasUrl: process.env.GOOGLE_APPS_SCRIPT_URL || "",
  gasSecret: process.env.GOOGLE_APPS_SCRIPT_SECRET || "viit_apps_script_hmac_secret_2026",

  // Student Auth Configuration
  studentAuthMode: process.env.STUDENT_AUTH_MODE || "DIRECT_ROSTER",

  // Institution Metadata
  institution: {
    name: "Vignan's Institute of Information Technology",
    shortName: "VIIT",
    department: "Department of Data Science",
    clubName: "SkillForge Club",
    electionName: "VIIT CR ELECTIONS 2026",
    electionId: "CR2026",
    sections: ["A", "B", "C", "D"],
    totalExpectedStudents: 250,
  },

  // Admin Initial Accounts
  admins: [
    {
      id: "admin-super-1",
      username: process.env.ADMIN_DEFAULT_USER || "admin",
      password: process.env.ADMIN_DEFAULT_PASS || "admin@viit2026",
      role: "SUPER_ADMIN",
      name: "Chief Returning Officer (HOD / Faculty)",
    },
    {
      id: "admin-test-1",
      username: process.env.ADMIN_TEST_USER || "test",
      password: process.env.ADMIN_TEST_PASS || "Test@123",
      role: "ELECTION_ADMIN",
      name: "Test Presiding Officer",
    },
    {
      id: "admin-officer-1",
      username: "election_officer",
      password: process.env.ADMIN_OFFICER_PASS || "officer@viit2026",
      role: "ELECTION_ADMIN",
      name: "SkillForge Presiding Officer",
    },
    {
      id: "admin-observer-1",
      username: "observer",
      password: process.env.ADMIN_OBSERVER_PASS || "observer@viit2026",
      role: "OBSERVER",
      name: "Department Faculty Observer",
    }
  ]
};

export default config;
