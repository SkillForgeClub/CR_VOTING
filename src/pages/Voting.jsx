import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import CandidateCard from "../components/election/CandidateCard";
import CandidateModal from "../components/election/CandidateModal";
import BRAND from "../config/branding";
import authService from "../services/authService";
import candidateService from "../services/candidateService";
import electionService, { ElectionState } from "../services/electionService";
import votingService from "../services/votingService";
import ElectionStatusBanner from "../components/election/ElectionStatusBanner";

export function Voting() {
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [activeSection, setActiveSection] = useState("A");
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [modalCandidate, setModalCandidate] = useState(null);
  const [electionStatus, setElectionStatus] = useState(ElectionState.LIVE);
  const [errorMessage, setErrorMessage] = useState("");
  const [checkingVoted, setCheckingVoted] = useState(true); // block render until Supabase confirms not-voted

  useEffect(() => {
    // Check election status
    electionService.fetchStatus().then((status) => {
      if (status) setElectionStatus(status);
    });

    // Retrieve active student session
    const activeStudent = authService.getStudentSession();
    if (!activeStudent || !activeStudent.rollNumber) {
      navigate("/login");
      return;
    }

    // -----------------------------------------------------------------------
    // CRITICAL: Block the ballot page until we confirm from Supabase that
    // this student has NOT voted. The JWT bakes in voted:false at login time
    // so we CANNOT trust it after voting — we must re-check the database.
    // -----------------------------------------------------------------------
    const token = authService.getStudentToken();
    fetch("/api/v1/auth/student/session", {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.student?.voted) {
          // Already voted — redirect away, never show the ballot
          navigate("/vote-success");
          return;
        }
        // Confirmed: not yet voted — allow the ballot to render
        setCheckingVoted(false);
        setStudent(activeStudent);
        const sec = (activeStudent.section || "A").toUpperCase();
        setActiveSection(sec);
        candidateService.fetchCandidates(sec).then(setCandidates);
      })
      .catch(() => {
        // Network error: allow render but server will block the actual submission
        setCheckingVoted(false);
        setStudent(activeStudent);
        const sec = (activeStudent.section || "A").toUpperCase();
        setActiveSection(sec);
        candidateService.fetchCandidates(sec).then(setCandidates);
      });

    // Check previously selected candidate from sessionStorage
    const savedCand = sessionStorage.getItem("selectedCandidate");
    if (savedCand) {
      try {
        setSelectedCandidate(JSON.parse(savedCand));
      } catch (e) {}
    }
  }, [navigate]);

  const handleSelectCandidate = (candidate) => {
    setSelectedCandidate(candidate);
    sessionStorage.setItem("selectedCandidate", JSON.stringify(candidate));
    setErrorMessage("");
  };

  const handleProceedToConfirmation = () => {
    if (!selectedCandidate) {
      setErrorMessage("Please select one candidate before proceeding to cast your ballot.");
      return;
    }
    navigate("/vote-confirm");
  };

  const handleLogout = () => {
    authService.clearStudentSession();
    sessionStorage.removeItem("selectedCandidate");
    navigate("/login");
  };

  if (checkingVoted) {
    return (
      <PageContainer>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "18px" }}>
          <div style={{ width: "48px", height: "48px", border: "4px solid rgba(99,102,241,0.2)", borderTop: "4px solid #4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "var(--color-text-muted, #64748b)", fontSize: "0.95rem", fontWeight: 500 }}>Verifying voter status…</p>
        </div>
      </PageContainer>
    );
  }

  if (!student) return null;

  return (
    <PageContainer>
      <div style={{ maxWidth: "860px", margin: "0 auto", width: "100%" }}>
        <ElectionStatusBanner status={electionStatus} />

        {/* Top Voter Identity Card (Mobile Responsive Wrap) */}
        <div
          className="inst-card"
          style={{
            marginBottom: "18px",
            padding: "clamp(12px, 3.5vw, 18px)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "var(--radius-full)",
                  background: "var(--color-primary-subtle)",
                  color: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "1rem",
                  flexShrink: 0,
                }}
              >
                👤
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.98rem", fontWeight: 800, color: "var(--color-text)" }}>
                    {student.name}
                  </span>
                  <span
                    style={{
                      background: "var(--color-primary)",
                      color: "#fff",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    Section {student.section}
                  </span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: "2px" }}>
                  Roll: <strong style={{ fontFamily: "var(--font-mono)" }}>{student.rollNumber}</strong> • {BRAND.department}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleLogout}
              style={{
                padding: "6px 12px",
                fontSize: "0.78rem",
                minHeight: "36px",
                marginLeft: "auto",
              }}
            >
              Sign Out / Switch Voter
            </button>
          </div>
        </div>

        {/* Election Title & Section Switcher */}
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h2 style={{ fontSize: "clamp(1.2rem, 4vw, 1.5rem)", fontWeight: 800, color: "var(--color-primary)" }}>
                Select Your Class Representative
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                Contesting candidates for <strong>Section {activeSection}</strong> Class Representative 2026.
              </p>
            </div>

            {/* Section Switcher Chips */}
            <div style={{ display: "flex", gap: "6px" }}>
              {BRAND.sections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={async () => {
                    setActiveSection(sec);
                    const list = await candidateService.fetchCandidates(sec);
                    setCandidates(list);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    minHeight: "36px",
                    border: activeSection === sec ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                    background: activeSection === sec ? "var(--color-primary-subtle)" : "var(--color-surface)",
                    color: activeSection === sec ? "var(--color-primary)" : "var(--color-text-muted)",
                    cursor: "pointer",
                  }}
                >
                  Sec {sec}
                </button>
              ))}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              background: "var(--color-danger-bg)",
              border: "1px solid var(--color-danger-border)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              marginBottom: "16px",
              color: "var(--color-danger)",
              fontSize: "0.86rem",
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Candidate Cards Grid (1 column on mobile) */}
        <div className="candidate-grid">
          {candidates.map((cand) => (
            <CandidateCard
              key={cand.id}
              candidate={cand}
              isSelected={selectedCandidate && String(selectedCandidate.id) === String(cand.id)}
              onSelect={handleSelectCandidate}
              onViewProfile={(c) => setModalCandidate(c)}
            />
          ))}
        </div>

        {candidates.length === 0 && (
          <div
            className="inst-card"
            style={{ textAlign: "center", padding: "36px 16px", color: "var(--color-text-muted)", marginBlock: "16px" }}
          >
            <p style={{ fontSize: "0.9rem" }}>No registered candidates found for Section {activeSection}.</p>
          </div>
        )}

        {/* Sticky Mobile-First Action Bar */}
        <div className="sticky-vote-bar">
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)" }}>
              Selected Candidate
            </div>
            {selectedCandidate ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                <span style={{ fontSize: "1.1rem" }}>{selectedCandidate.symbol || "🗳️"}</span>
                <strong style={{ fontSize: "1rem", color: "var(--color-text)" }}>
                  {selectedCandidate.name}
                </strong>
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  ({selectedCandidate.rollNumber})
                </span>
              </div>
            ) : (
              <div style={{ fontSize: "0.88rem", color: "var(--color-danger)", fontWeight: 600 }}>
                Please tap a candidate card above
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn-primary"
            disabled={!selectedCandidate || electionStatus === ElectionState.CLOSED}
            onClick={handleProceedToConfirmation}
            style={{
              padding: "12px 20px",
              fontSize: "0.92rem",
              width: "100%",
              maxWidth: "340px",
            }}
          >
            <span>Review &amp; Cast Official Ballot</span>
            <span style={{ fontSize: "1.1rem" }}>→</span>
          </button>
        </div>

        {/* Candidate Profile Modal */}
        <CandidateModal
          candidate={modalCandidate}
          isOpen={Boolean(modalCandidate)}
          onClose={() => setModalCandidate(null)}
          onSelect={handleSelectCandidate}
          isSelected={modalCandidate && selectedCandidate && String(modalCandidate.id) === String(selectedCandidate.id)}
        />
      </div>
    </PageContainer>
  );
}

export default Voting;
