import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./server/config/index.js";
import { securityHeaders, errorHandler } from "./server/middleware/securityHeaders.js";
import authRoutes from "./server/routes/authRoutes.js";
import electionRoutes from "./server/routes/electionRoutes.js";
import candidateRoutes from "./server/routes/candidateRoutes.js";
import votingRoutes, { legacyVoteHandler } from "./server/routes/votingRoutes.js";
import adminRoutes from "./server/routes/adminRoutes.js";
import localStore from "./server/db/localStore.js";
import databaseAdapter from "./server/db/databaseAdapter.js";
import gasClient from "./server/db/gasClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port || 3000;

// Security & Parsing Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(securityHeaders);

// Initialize authoritative data store & provision cloud DB if active
localStore.init();
databaseAdapter.ensureElectionExists("CR2026").catch(() => {});

// --- Production API v1 Routes ---
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/election", electionRoutes);
app.use("/api/v1/candidates", candidateRoutes);
app.use("/api/v1/votes", votingRoutes);
app.use("/api/v1/admin", adminRoutes);

// --- Health Check Endpoint ---
app.get(["/health", "/api/health", "/api/v1/health"], (req, res) => {
  const election = localStore.getElection("CR2026");
  const votes = localStore.getAllVotes("CR2026");
  const students = localStore.getAllStudents();

  res.json({
    status: "ok",
    service: "VIIT CR Elections 2026 Authoritative API",
    institution: config.institution.name,
    department: config.institution.department,
    electionStatus: election ? election.status : "LIVE",
    electionMode: config.electionMode,
    totalVotersRegistered: students.length,
    ballotsCast: votes.length,
    gasConfigured: gasClient.isConfigured(),
    timestamp: new Date().toISOString(),
  });
});

// --- Legacy Endpoint Compatibility Wrappers ---
app.get("/api/votes", (req, res) => {
  const votes = localStore.getAllVotes("CR2026");
  res.json({
    success: true,
    count: votes.length,
    votes: votes.map((v) => ({
      id: v.vote_id,
      refId: v.ref_id,
      timestamp: v.timestamp,
      rollNumber: v.roll_number,
      name: v.student_name,
      section: v.section,
      candidateName: v.candidate_name,
    })),
  });
});

app.post("/api/vote", legacyVoteHandler);

// Global Error Handler
app.use(errorHandler);

// Development & Production Static / Vite Hosting
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn("[Server] Vite dev server module not loaded, serving static files.");
      const distPath = path.join(__dirname, "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`=======================================================`);
    console.log(`🏛️  VIIT CR ELECTIONS 2026 - PRODUCTION BACKEND READY`);
    console.log(`📍 Host: http://0.0.0.0:${PORT}`);
    console.log(`📊 Mode: ${config.electionMode} | Auth: ${config.studentAuthMode}`);
    console.log(`🔒 One Student = One Vote Mutex: ACTIVE`);
    console.log(`=======================================================`);
  });
}

startServer();
