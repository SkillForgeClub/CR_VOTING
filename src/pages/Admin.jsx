import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import BRAND from "../config/branding";
import authService from "../services/authService";
import adminService from "../services/adminService";
import candidateService from "../services/candidateService";
import electionService, { ElectionState } from "../services/electionService";
import votingService from "../services/votingService";

export function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'candidates' | 'audit' | 'settings'
  const [metrics, setMetrics] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [votes, setVotes] = useState([]);
  const [electionStatus, setElectionStatus] = useState(ElectionState.LIVE);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState("ALL");
  const [gSheetUrl, setGSheetUrl] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [dbStatus, setDbStatus] = useState(null);

  // Sync Preview State
  const [syncPreview, setSyncPreview] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Candidate Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCandName, setNewCandName] = useState("");
  const [newCandRoll, setNewCandRoll] = useState("");
  const [newCandSection, setNewCandSection] = useState("A");
  const [newCandSymbol, setNewCandSymbol] = useState("🚀");
  const [newCandSymbolName, setNewCandSymbolName] = useState("Rocket");
  const [newCandTagline, setNewCandTagline] = useState("");
  const [newCandManifesto, setNewCandManifesto] = useState("");

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [dash, dbInfo] = await Promise.all([
        adminService.fetchDashboard(),
        adminService.fetchDatabaseStatus(),
      ]);

      if (dbInfo && dbInfo.database) {
        setDbStatus(dbInfo.database);
      }

      if (dash && dash.metrics) {
        setMetrics(dash.metrics);
        const fullCandidatesList = await candidateService.fetchCandidates();
        setCandidates(fullCandidatesList);
        setVotes(dash.metrics.recentVotes || []);
        if (dash.election?.status) setElectionStatus(dash.election.status);
      } else {
        const c = await candidateService.fetchCandidates();
        setCandidates(c);
      }
    } catch (e) {
      console.warn("Failed to load dashboard data:", e);
    }
    setGSheetUrl(localStorage.getItem("googleSheetWebAppUrl") || "");
    setIsLoading(false);
  };

  useEffect(() => {
    if (!authService.isAdminAuthenticated()) {
      navigate("/admin-login");
      return;
    }
    refreshData();
  }, [navigate]);

  const handleStatusChange = async (newStatus) => {
    await electionService.setElectionStatus(newStatus);
    setElectionStatus(newStatus);
    setStatusMessage(`Election state transitioned to: ${newStatus}`);
    await refreshData();
    setTimeout(() => setStatusMessage(""), 4000);
  };

  const handleToggleCandidate = async (id) => {
    try {
      await candidateService.toggleCandidateActive(id);
      await refreshData();
    } catch (e) {
      setStatusMessage(e.message);
    }
  };

  const handleDeleteCandidate = async (id, name) => {
    if (window.confirm(`Are you sure you want to remove candidate "${name}"?`)) {
      try {
        await candidateService.deleteCandidate(id);
        await refreshData();
      } catch (e) {
        setStatusMessage(e.message);
      }
    }
  };

  const handleAddCandidateSubmit = async (e) => {
    e.preventDefault();
    if (!newCandName.trim()) return;

    try {
      await candidateService.addCandidate({
        name: newCandName,
        rollNumber: newCandRoll,
        section: newCandSection,
        symbol: newCandSymbol,
        symbolName: newCandSymbolName,
        tagline: newCandTagline,
        manifesto: newCandManifesto,
      });

      setIsAddModalOpen(false);
      setNewCandName("");
      setNewCandRoll("");
      setNewCandTagline("");
      setNewCandManifesto("");
      await refreshData();
    } catch (err) {
      setStatusMessage(err.message || "Failed to add candidate.");
    }
  };

  const handleSaveGSheet = (e) => {
    e.preventDefault();
    localStorage.setItem("googleSheetWebAppUrl", gSheetUrl.trim());
    setStatusMessage("Google Sheets Web App Integration URL saved successfully!");
    setTimeout(() => setStatusMessage(""), 4000);
  };

  const handleGenerateSyncPreview = async () => {
    if (!gSheetUrl.trim()) {
      setSyncError("Please provide a valid Google Sheet URL or Apps Script Web App URL.");
      return;
    }

    setIsSyncing(true);
    setSyncError("");
    try {
      const previewData = await adminService.generateSyncPreview({ sheetUrl: gSheetUrl.trim() });
      setSyncPreview(previewData);
      setShowSyncModal(true);
    } catch (err) {
      setSyncError(err.message || "Failed to fetch student roster from Google Sheets.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmSync = async () => {
    if (!syncPreview || !syncPreview.previewList) return;

    setIsSyncing(true);
    setSyncError("");
    try {
      const validStudentsToSync = syncPreview.previewList
        .filter((s) => s.status !== "DEACTIVATED")
        .map((s) => ({
          roll_number: s.roll_number,
          name: s.name,
          section: s.section,
          email: s.email,
          eligible: s.eligible !== false,
        }));

      const res = await adminService.confirmRosterSync(validStudentsToSync);
      setStatusMessage(`✅ Student Roster Synchronized Successfully! (${res.count} students updated)`);
      setShowSyncModal(false);
      setSyncPreview(null);
      await refreshData();
      setTimeout(() => setStatusMessage(""), 5000);
    } catch (err) {
      setSyncError(err.message || "Failed to commit student roster sync.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCSV = () => {
    adminService.exportVotesCsv();
  };

  const handleResetVotes = async () => {
    if (window.confirm("⚠️ WARNING: This will clear all recorded test votes. This action cannot be undone. Proceed?")) {
      try {
        await adminService.resetTestVotes();
        await refreshData();
        setStatusMessage("All recorded ballots have been reset.");
        setTimeout(() => setStatusMessage(""), 4000);
      } catch (e) {
        setStatusMessage(e.message || "Failed to reset votes.");
      }
    }
  };

  const handleLogout = () => {
    authService.adminLogout();
    navigate("/admin-login");
  };

  // Filtered audit list
  const filteredVotes = useMemo(() => {
    return votes.filter((v) => {
      const matchSection = selectedSectionFilter === "ALL" || (v.section || "A").toUpperCase() === selectedSectionFilter;
      const matchQuery =
        !searchTerm ||
        (v.name && v.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.rollNumber && v.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.refId && v.refId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.candidateName && v.candidateName.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchSection && matchQuery;
    });
  }, [votes, selectedSectionFilter, searchTerm]);

  // Mobile-aware tab labels
  const TABS = [
    { id: "overview",   icon: "📊", label: "Live Overview & Tally",  short: "Overview" },
    { id: "candidates", icon: "👥", label: "Candidate Roster",        short: "Candidates" },
    { id: "audit",      icon: "📋", label: "Voter Audit Register",    short: "Audit" },
    { id: "settings",   icon: "⚙️", label: "System Integrations",    short: "System" },
  ];

  return (
    <PageContainer>
      {/* ── Mobile-responsive global styles injected inline ── */}
      <style>{`
        @media (max-width: 640px) {
          .admin-header-title { font-size: 1.05rem !important; }
          .admin-header-subtitle { display: none; }
          .admin-tab-label-full { display: none; }
          .admin-tab-label-short { display: inline; }
          .admin-tab-bar { position: sticky; bottom: 0; z-index: 50; background: var(--color-surface); border-top: 2px solid var(--color-border); border-bottom: none !important; padding: 6px 0 env(safe-area-inset-bottom,0) 0; margin: 0 -16px; margin-top: 16px; box-shadow: 0 -4px 20px rgba(0,0,0,0.1); }
          .admin-tab-btn { flex: 1; flex-direction: column !important; padding: 8px 4px !important; font-size: 0.72rem !important; gap: 2px !important; border-radius: 8px !important; }
          .admin-tab-icon { font-size: 1.25rem; display: block; }
          .admin-status-btns { justify-content: stretch !important; }
          .admin-status-btns button { flex: 1; min-width: 0; font-size: 0.78rem !important; padding: 8px 6px !important; }
          .admin-kpi-grid { grid-template-columns: 1fr 1fr !important; }
          .admin-cand-table thead { display: none; }
          .admin-cand-table tr { display: block; border: 1px solid var(--color-border); border-radius: 10px; margin-bottom: 10px; padding: 10px; }
          .admin-cand-table td { display: flex; justify-content: space-between; align-items: center; padding: 5px 0 !important; border: none !important; font-size: 0.83rem; }
          .admin-cand-table td::before { content: attr(data-label); font-weight: 700; font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; margin-right: 8px; white-space: nowrap; }
          .admin-results-table thead { display: none; }
          .admin-results-table tr { display: block; border: 1px solid var(--color-border); border-radius: 10px; margin-bottom: 10px; padding: 10px; }
          .admin-results-table td { display: flex; justify-content: space-between; align-items: center; padding: 5px 0 !important; border: none !important; font-size: 0.83rem; }
          .admin-results-table td::before { content: attr(data-label); font-weight: 700; font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; margin-right: 8px; white-space: nowrap; }
          .admin-audit-table thead { display: none; }
          .admin-audit-table tr { display: block; border: 1px solid var(--color-border); border-radius: 10px; margin-bottom: 10px; padding: 10px; }
          .admin-audit-table td { display: flex; justify-content: space-between; align-items: center; padding: 5px 0 !important; border: none !important; font-size: 0.82rem; }
          .admin-audit-table td::before { content: attr(data-label); font-weight: 700; font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; margin-right: 8px; white-space: nowrap; }
        }
        @media (min-width: 641px) {
          .admin-tab-label-full { display: inline; }
          .admin-tab-label-short { display: none; }
          .admin-tab-icon { display: none; }
        }
      `}</style>

      <div style={{ maxWidth: "1140px", margin: "0 auto" }}>
        {/* Top Officer Header */}
        <div
          className="inst-card"
          style={{
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            background: "linear-gradient(135deg, #172554 0%, #1e3a8a 100%)",
            color: "#ffffff",
            padding: "clamp(14px,3vw,22px)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.3rem" }}>🛡️</span>
              <h2 className="admin-header-title" style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ffffff", lineHeight: 1.2 }}>
                Election Control &amp; Scrutiny Console
              </h2>
            </div>
            <p className="admin-header-subtitle" style={{ fontSize: "0.82rem", opacity: 0.85, marginTop: "4px" }}>
              {BRAND.electionName} • {BRAND.department}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={refreshData}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.82rem",
                whiteSpace: "nowrap",
              }}
            >
              🔄 Refresh Data
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: "#b91c1c",
                color: "#ffffff",
                border: "none",
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.82rem",
                whiteSpace: "nowrap",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Global State Switcher Bar */}
        <div
          className="inst-card"
          style={{
            marginBottom: "20px",
            borderLeft: "4px solid var(--color-primary)",
            padding: "clamp(12px,3vw,20px)",
          }}
        >
          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.05em" }}>
              Official Election Status
            </span>
            <div style={{ marginTop: "4px" }}>
              <span style={{ fontSize: "1.05rem", fontWeight: 800 }}>
                Current State: <span style={{ color: "var(--color-primary)" }}>{electionStatus}</span>
              </span>
            </div>
          </div>

          <div className="admin-status-btns" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => handleStatusChange(ElectionState.LIVE)}
              style={{
                padding: "9px 14px",
                borderRadius: "var(--radius-md)",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                border: "1px solid var(--color-live)",
                background: electionStatus === ElectionState.LIVE ? "var(--color-live)" : "var(--color-live-bg)",
                color: electionStatus === ElectionState.LIVE ? "#ffffff" : "var(--color-live)",
                whiteSpace: "nowrap",
              }}
            >
              ● Resume / Live
            </button>

            <button
              type="button"
              onClick={() => handleStatusChange(ElectionState.PAUSED)}
              style={{
                padding: "9px 14px",
                borderRadius: "var(--radius-md)",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                border: "1px solid var(--color-warning)",
                background: electionStatus === ElectionState.PAUSED ? "var(--color-warning)" : "var(--color-warning-bg)",
                color: electionStatus === ElectionState.PAUSED ? "#ffffff" : "var(--color-warning)",
                whiteSpace: "nowrap",
              }}
            >
              ⏸️ Pause Voting
            </button>

            <button
              type="button"
              onClick={() => handleStatusChange(ElectionState.CLOSED)}
              style={{
                padding: "9px 14px",
                borderRadius: "var(--radius-md)",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                border: "1px solid var(--color-danger)",
                background: electionStatus === ElectionState.CLOSED ? "var(--color-danger)" : "var(--color-danger-bg)",
                color: electionStatus === ElectionState.CLOSED ? "#ffffff" : "var(--color-danger)",
                whiteSpace: "nowrap",
              }}
            >
              🔒 Close Election
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            style={{
              background: "var(--color-success-bg)",
              border: "1px solid var(--color-success-border)",
              color: "var(--color-success)",
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              marginBottom: "20px",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            ✓ {statusMessage}
          </div>
        )}

        {/* Tab Navigation — sticky bottom on mobile, inline on desktop */}
        <div
          className="admin-tab-bar"
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "20px",
            borderBottom: "2px solid var(--color-border)",
            paddingBottom: "8px",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="admin-tab-btn"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 16px",
                borderRadius: "var(--radius-md)",
                border: "none",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: "pointer",
                background: activeTab === tab.id ? "var(--color-primary)" : "transparent",
                color: activeTab === tab.id ? "#ffffff" : "var(--color-text-secondary)",
                transition: "var(--transition-fast)",
                whiteSpace: "nowrap",
              }}
            >
              <span className="admin-tab-icon">{tab.icon}</span>
              <span className="admin-tab-label-full">{tab.icon} {tab.label}</span>
              <span className="admin-tab-label-short">{tab.short}</span>
            </button>
          ))}
        </div>

        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === "overview" && metrics && (
          <div>
            {/* KPI Summary Cards */}
            <div
              className="admin-kpi-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "14px",
                marginBottom: "24px",
              }}
            >
              <div className="inst-card">
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                  Eligible Voters
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--color-primary)", marginTop: "4px" }}>
                  {metrics.totalEligible}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                  250 Registered Students (Dept of DS)
                </div>
              </div>

              <div className="inst-card">
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                  Ballots Recorded
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--color-primary)", marginTop: "4px" }}>
                  {metrics.totalVotes}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--color-success)", fontWeight: 600 }}>
                  {metrics.remainingEligible} pending votes
                </div>
              </div>

              <div className="inst-card">
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                  Voter Turnout Rate
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--color-live)", marginTop: "4px" }}>
                  {metrics.turnoutPercentage}%
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                  Dept-wide participation
                </div>
              </div>

              <div className="inst-card">
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                  Active Candidates
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--color-text)", marginTop: "4px" }}>
                  {metrics.activeCandidatesCount}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                  Across Sections A, B, C, D
                </div>
              </div>
            </div>

            {/* Section Progress Bars */}
            <div className="inst-card" style={{ marginBottom: "28px" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "16px", color: "var(--color-primary)" }}>
                Section-Wise Turnout Breakdown
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
                {metrics.sectionStats.map((sec) => (
                  <div key={sec.section} style={{ background: "var(--color-surface-muted)", padding: "16px", borderRadius: "var(--radius-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontWeight: 700 }}>
                      <span>Section {sec.section}</span>
                      <span>
                        {sec.votes} / {sec.total} ({sec.percentage}%)
                      </span>
                    </div>
                    <div style={{ height: "8px", background: "var(--color-border)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, sec.percentage)}%`,
                          background: "var(--color-primary)",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Candidate Live Vote Count Table */}
            <div className="inst-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--color-primary)" }}>
                  Candidate Live Results &amp; Vote Count
                </h3>
                <button type="button" className="btn-secondary" onClick={handleExportCSV} style={{ padding: "6px 12px", fontSize: "0.82rem" }}>
                  📥 Export Ballots CSV
                </button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="audit-table admin-results-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Candidate Name</th>
                      <th>Roll Number</th>
                      <th>Section</th>
                      <th>Votes Cast</th>
                      <th>Vote Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.candidateTally.map((cand, idx) => (
                      <tr key={cand.candidate_id || cand.id || idx}>
                        <td data-label="Rank">
                          <strong>#{idx + 1}</strong>
                        </td>
                        <td data-label="Candidate">
                          <div style={{ fontWeight: 700 }}>{cand.name}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>{cand.tagline || cand.symbol_name}</div>
                        </td>
                        <td data-label="Roll No" style={{ fontFamily: "var(--font-mono)" }}>{cand.roll_number || cand.rollNumber}</td>
                        <td data-label="Section">
                          <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>Sec {cand.section}</span>
                        </td>
                        <td data-label="Votes">
                          <strong style={{ fontSize: "1.1rem", color: "var(--color-primary)" }}>
                            {cand.votesReceived}
                          </strong>
                        </td>
                        <td data-label="Vote Share">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{cand.percentageOfTotal}%</span>
                            <div style={{ width: "60px", height: "6px", background: "var(--color-border)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.min(100, cand.percentageOfTotal)}%`, background: "var(--color-primary)" }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: CANDIDATE ROSTER ================= */}
        {activeTab === "candidates" && (
          <div className="inst-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--color-primary)" }}>
                  Registered Candidates Roster
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                  Manage contesting candidates for all sections
                </p>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsAddModalOpen(true)}
                style={{ padding: "8px 16px", fontSize: "0.88rem" }}
              >
                + Add Contesting Candidate
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="audit-table admin-cand-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Roll No</th>
                    <th>Section</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.id}>
                      <td data-label="Candidate">
                        <div style={{ fontWeight: 700 }}>{c.name}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>{c.tagline}</div>
                      </td>
                      <td data-label="Roll No" style={{ fontFamily: "var(--font-mono)" }}>{c.rollNumber}</td>
                      <td data-label="Section">Section {c.section}</td>
                      <td data-label="Status">
                        {c.isActive !== false ? (
                          <span style={{ color: "var(--color-success)", fontWeight: 700, fontSize: "0.8rem" }}>
                            ● Active
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)", fontWeight: 700, fontSize: "0.8rem" }}>
                            ○ Deactivated
                          </span>
                        )}
                      </td>
                      <td data-label="Actions">
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => handleToggleCandidate(c.id || c.candidate_id)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--color-border)",
                              background: "var(--color-surface)",
                              fontSize: "0.78rem",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {c.active !== false && c.isActive !== false ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCandidate(c.id || c.candidate_id, c.name)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--color-danger-border)",
                              background: "var(--color-danger-bg)",
                              color: "var(--color-danger)",
                              fontSize: "0.78rem",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 3: AUDIT LOG ================= */}
        {activeTab === "audit" && (
          <div className="inst-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--color-primary)" }}>
                  Official Voter Audit Register
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                  Total Recorded Ballots: {votes.length}
                </p>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={handleExportCSV}
                style={{ padding: "8px 16px", fontSize: "0.88rem" }}
              >
                📥 Download Full CSV Register
              </button>
            </div>

            {/* Filter controls */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "18px", flexWrap: "wrap" }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Roll No, Name, Reference ID..."
                style={{
                  flex: 1,
                  minWidth: "220px",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--color-border)",
                  fontSize: "0.9rem",
                }}
              />

              <select
                value={selectedSectionFilter}
                onChange={(e) => setSelectedSectionFilter(e.target.value)}
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--color-border)",
                  fontSize: "0.9rem",
                  background: "var(--color-surface)",
                }}
              >
                <option value="ALL">All Sections</option>
                {BRAND.sections.map((s) => (
                  <option key={s} value={s}>
                    Section {s}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="audit-table admin-audit-table">
                <thead>
                  <tr>
                    <th>Reference ID</th>
                    <th>Timestamp</th>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Section</th>
                    <th>Candidate Voted</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVotes.map((v, i) => (
                    <tr key={i}>
                      <td data-label="Ref ID" style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-primary)" }}>
                        {v.refId || `CR26-DS-${i + 100}`}
                      </td>
                      <td data-label="Timestamp" style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                        {v.timestamp || "Official"}
                      </td>
                      <td data-label="Roll No" style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                        {v.rollNumber}
                      </td>
                      <td data-label="Name">{v.name}</td>
                      <td data-label="Section">
                        <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>
                          Sec {v.section || "A"}
                        </span>
                      </td>
                      <td data-label="Voted For">
                        <span style={{ fontWeight: 600 }}>{v.candidateName}</span>
                      </td>
                    </tr>
                  ))}
                  {filteredVotes.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--color-text-muted)" }}>
                        No ballot records match your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 4: SETTINGS & INTEGRATIONS ================= */}
        {activeTab === "settings" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            {/* Database & Security Architecture Card */}
            <div className="inst-card" style={{ gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <h3 style={{ fontSize: "1.18rem", fontWeight: 800, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>🗄️</span> Primary Database &amp; Security Architecture
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                    Production Target: <strong>Supabase PostgreSQL + RLS + Database RPC</strong>
                  </p>
                </div>
                <div style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: dbStatus?.isSupabaseConnected ? "rgba(16, 185, 129, 0.12)" : "rgba(37, 99, 235, 0.12)",
                  color: dbStatus?.isSupabaseConnected ? "#059669" : "#2563EB",
                  border: `1px solid ${dbStatus?.isSupabaseConnected ? "rgba(16, 185, 129, 0.3)" : "rgba(37, 99, 235, 0.3)"}`,
                }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "currentColor" }}></span>
                  {dbStatus?.engine || "Authoritative Database Engine"}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                <div style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Row Level Security</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--color-primary)", marginTop: "4px" }}>
                    {dbStatus?.rlsEnabled ? "🛡️ Enforced (RLS Active)" : "🛡️ Schema Defined (rls.sql)"}
                  </div>
                </div>

                <div style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Atomic Voting RPC</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--color-primary)", marginTop: "4px" }}>
                    ⚡ cast_vote() Procedure
                  </div>
                </div>

                <div style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Registered Roster</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--color-primary)", marginTop: "4px" }}>
                    👥 {dbStatus?.totalStudentsRegistered || "250"} Students (Sec A, B, C, D)
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "0.82rem", color: "var(--color-text-secondary)", lineHeight: 1.6, background: "rgba(0,0,0,0.02)", padding: "12px 14px", borderRadius: "var(--radius-sm)", borderLeft: "3px solid var(--color-primary)" }}>
                <strong>Database Security Note:</strong> Direct browser writes to the database are strictly blocked by Row Level Security. All official ballots are processed through atomic database transactions preventing duplicate voting and race conditions.
              </div>
            </div>

            {/* Google Sheets Student Roster Sync Card */}
            <div className="inst-card">
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "8px", color: "var(--color-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>📊</span> Google Sheets Student Roster Synchronizer
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "16px", lineHeight: 1.5 }}>
                Sync institutional student roster directly from Google Sheets or Apps Script. Generates a non-destructive preview before committing updates to Supabase PostgreSQL.
              </p>

              <form onSubmit={(e) => e.preventDefault()}>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>
                    Google Sheet CSV / Apps Script Web App URL
                  </label>
                  <input
                    type="url"
                    value={gSheetUrl}
                    onChange={(e) => setGSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/... or Apps Script Web App URL"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1.5px solid var(--color-border)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                {syncError && (
                  <div style={{ padding: "10px", background: "#fef2f2", color: "#991b1b", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", marginBottom: "12px" }}>
                    {syncError}
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button type="button" onClick={handleSaveGSheet} className="btn-secondary" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
                    Save URL
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateSyncPreview}
                    disabled={isSyncing}
                    className="btn-primary"
                    style={{ padding: "8px 18px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    {isSyncing ? "Fetching Roster..." : "🔄 SYNC STUDENTS (PREVIEW)"}
                  </button>
                </div>
              </form>
            </div>

            {/* Danger Zone: Reset Database */}
            <div className="inst-card" style={{ border: "1px solid var(--color-danger-border)" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "8px", color: "var(--color-danger)" }}>
                Election Maintenance &amp; Reset
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "16px", lineHeight: 1.5 }}>
                Reset test votes before commencing the live official student election window.
              </p>

              <button
                type="button"
                className="btn-danger"
                onClick={handleResetVotes}
              >
                ⚠️ Reset All Recorded Ballots
              </button>
            </div>
          </div>
        )}

        {/* Modal: Add Candidate */}
        {isAddModalOpen && (
          <div className="modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "16px", color: "var(--color-primary)" }}>
                Register New Contesting Candidate
              </h3>

              <form onSubmit={handleAddCandidateSubmit}>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "4px" }}>
                    Candidate Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newCandName}
                    onChange={(e) => setNewCandName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    style={{ width: "100%", padding: "10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "4px" }}>
                      Roll Number
                    </label>
                    <input
                      type="text"
                      required
                      value={newCandRoll}
                      onChange={(e) => setNewCandRoll(e.target.value.toUpperCase())}
                      placeholder="24DS0501"
                      style={{ width: "100%", padding: "10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "4px" }}>
                      Section
                    </label>
                    <select
                      value={newCandSection}
                      onChange={(e) => setNewCandSection(e.target.value)}
                      style={{ width: "100%", padding: "10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "#fff" }}
                    >
                      {BRAND.sections.map((s) => (
                        <option key={s} value={s}>
                          Section {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "4px" }}>
                    Tagline / Campaign Slogan
                  </label>
                  <input
                    type="text"
                    value={newCandTagline}
                    onChange={(e) => setNewCandTagline(e.target.value)}
                    placeholder="Short campaign punchline"
                    style={{ width: "100%", padding: "10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}
                  />
                </div>

                <div style={{ marginBottom: "18px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "4px" }}>
                    Manifesto Summary
                  </label>
                  <textarea
                    value={newCandManifesto}
                    onChange={(e) => setNewCandManifesto(e.target.value)}
                    placeholder="Detailed commitments and priorities for the class"
                    rows={3}
                    style={{ width: "100%", padding: "10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontFamily: "inherit" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Register Candidate
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Student Roster Synchronization Preview */}
        {showSyncModal && syncPreview && (
          <div className="modal-backdrop" onClick={() => setShowSyncModal(false)}>
            <div className="modal-content" style={{ maxWidth: "800px", width: "92%" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-primary)" }}>
                  STUDENT ROSTER SYNC PREVIEW
                </h3>
                <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", fontWeight: 700 }}>
                  Source: Google Sheets
                </span>
              </div>

              {/* Sync Summary Metrics Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "8px", marginBottom: "16px" }}>
                <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "var(--color-bg)", textAlign: "center", border: "1px solid var(--color-border)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Total Found</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{syncPreview.summary?.totalFound || 0}</div>
                </div>
                <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "#f0fdf4", color: "#166534", textAlign: "center", border: "1px solid #bbf7d0" }}>
                  <div style={{ fontSize: "0.75rem" }}>New</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{syncPreview.summary?.newCount || 0}</div>
                </div>
                <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "#eff6ff", color: "#1e40af", textAlign: "center", border: "1px solid #bfdbfe" }}>
                  <div style={{ fontSize: "0.75rem" }}>Updated</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{syncPreview.summary?.updatedCount || 0}</div>
                </div>
                <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "#f8fafc", color: "#475569", textAlign: "center", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem" }}>Unchanged</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{syncPreview.summary?.unchangedCount || 0}</div>
                </div>
                <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "#fff7ed", color: "#9a3412", textAlign: "center", border: "1px solid #fed7aa" }}>
                  <div style={{ fontSize: "0.75rem" }}>Deactivated</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{syncPreview.summary?.deactivatedCount || 0}</div>
                </div>
                <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "#fef2f2", color: "#991b1b", textAlign: "center", border: "1px solid #fecaca" }}>
                  <div style={{ fontSize: "0.75rem" }}>Invalid</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{syncPreview.summary?.invalidCount || 0}</div>
                </div>
                <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "#fef2f2", color: "#991b1b", textAlign: "center", border: "1px solid #fecaca" }}>
                  <div style={{ fontSize: "0.75rem" }}>Duplicates</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{syncPreview.summary?.duplicateCount || 0}</div>
                </div>
              </div>

              {/* Notice regarding vote history protection */}
              <div style={{ fontSize: "0.82rem", background: "#f0f9ff", borderLeft: "3px solid #0284c7", padding: "8px 12px", borderRadius: "4px", marginBottom: "16px", color: "#0369a1" }}>
                🔒 <strong>Vote Protection Rule:</strong> Existing voting flags (<code>has_voted</code>, <code>voted_at</code>) will NOT be cleared or reset during roster synchronization.
              </div>

              {syncError && (
                <div style={{ padding: "10px", background: "#fef2f2", color: "#991b1b", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", marginBottom: "12px", border: "1px solid #fecaca" }}>
                  ⚠️ {syncError}
                </div>
              )}

              {/* Roster Table Preview */}
              <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", marginBottom: "16px" }}>
                <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--color-bg)", textAlign: "left" }}>
                      <th style={{ padding: "8px 12px" }}>Roll Number</th>
                      <th style={{ padding: "8px 12px" }}>Student Name</th>
                      <th style={{ padding: "8px 12px" }}>Section</th>
                      <th style={{ padding: "8px 12px" }}>Status</th>
                      <th style={{ padding: "8px 12px" }}>Voted Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncPreview.previewList?.slice(0, 100).map((st, idx) => (
                      <tr key={idx} style={{ borderTop: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{st.roll_number}</td>
                        <td style={{ padding: "8px 12px" }}>{st.name}</td>
                        <td style={{ padding: "8px 12px", fontWeight: 700 }}>{st.section}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "99px",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            background: st.status === "NEW" ? "#dcfce7" : st.status === "UPDATED" ? "#dbeafe" : st.status === "DEACTIVATED" ? "#ffedd5" : "#f1f5f9",
                            color: st.status === "NEW" ? "#15803d" : st.status === "UPDATED" ? "#1d4ed8" : st.status === "DEACTIVATED" ? "#c2410c" : "#64748b",
                          }}>
                            {st.status}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {st.has_voted ? "✅ Voted" : "⏳ Pending"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowSyncModal(false)} disabled={isSyncing}>
                  CANCEL
                </button>
                <button type="button" className="btn-primary" onClick={handleConfirmSync} disabled={isSyncing} style={{ padding: "10px 20px" }}>
                  {isSyncing ? "Synchronizing Supabase..." : "CONFIRM SYNC"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

export default Admin;
