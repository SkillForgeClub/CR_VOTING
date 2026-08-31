import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import CollegeLogo from "../components/branding/CollegeLogo";
import SkillForgeLogo from "../components/branding/SkillForgeLogo";
import BRAND from "../config/branding";
import authService from "../services/authService";
import votingService from "../services/votingService";
import electionService, { ElectionState } from "../services/electionService";

export function VoteConfirm() {
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Verify election status
    const status = electionService.getElectionStatus();
    if (status === ElectionState.CLOSED) {
      navigate("/");
      return;
    }

    const currentStudent = authService.getStudentSession();
    if (!currentStudent || !currentStudent.rollNumber) {
      navigate("/login");
      return;
    }

    // Check if already voted
    if (votingService.hasStudentVoted(currentStudent.rollNumber)) {
      navigate("/login");
      return;
    }

    const savedCand = sessionStorage.getItem("selectedCandidate");
    if (!savedCand) {
      navigate("/vote");
      return;
    }

    try {
      setStudent(currentStudent);
      setCandidate(JSON.parse(savedCand));
    } catch (e) {
      navigate("/vote");
    }
  }, [navigate]);

  const handleFinalVoteSubmission = async () => {
    if (isSubmitting || !student || !candidate) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const voteReceipt = await votingService.submitVote({
        candidateId: candidate.id || candidate.candidate_id,
        rollNumber: student.rollNumber,
        candidateName: candidate.name,
        section: student.section,
      });

      // Save receipt to session for success page
      sessionStorage.setItem("latestVoteReceipt", JSON.stringify(voteReceipt));
      sessionStorage.removeItem("selectedCandidate");

      navigate("/vote-success");
    } catch (err) {
      setErrorMessage(err.message || "Failed to submit ballot. Please retry.");
      setIsSubmitting(false);
    }
  };

  if (!student || !candidate) {
    return null;
  }

  const initials = candidate.name
    ? candidate.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "CR";

  return (
    <PageContainer>
      <div style={{ maxWidth: "520px", margin: "10px auto 0 auto", width: "100%" }}>
        <div className="inst-card-elevated" style={{ padding: "clamp(18px, 4vw, 26px)" }}>
          {/* Institutional Header */}
          <div style={{ textAlign: "center", marginBottom: "20px", borderBottom: "1px solid var(--color-border)", paddingBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              <CollegeLogo size="sm" />
              <div style={{ width: "1px", height: "20px", background: "var(--color-border)" }} />
              <SkillForgeLogo size="sm" />
            </div>

            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--color-primary)" }}>
              Confirm Your Ballot Selection
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--color-text-secondary)" }}>
              {BRAND.electionName} • {BRAND.department}
            </p>
          </div>

          {errorMessage && (
            <div
              style={{
                background: "var(--color-danger-bg)",
                border: "1px solid var(--color-danger-border)",
                borderRadius: "var(--radius-md)",
                padding: "12px 14px",
                marginBottom: "16px",
                color: "var(--color-danger)",
                fontSize: "0.86rem",
              }}
              role="alert"
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Voter Summary Box */}
          <div
            style={{
              background: "var(--color-surface-muted)",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              marginBottom: "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                Voter
              </div>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--color-text)" }}>
                {student.name}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                Roll &amp; Section
              </div>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--color-primary)", fontFamily: "var(--font-mono)" }}>
                {student.rollNumber} (Sec {student.section})
              </div>
            </div>
          </div>

          {/* Chosen Candidate Spotlight Box */}
          <div
            style={{
              border: "2px solid var(--color-primary-light)",
              background: "linear-gradient(180deg, #f0f7ff 0%, #ffffff 100%)",
              borderRadius: "var(--radius-lg)",
              padding: "16px",
              marginBottom: "20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.74rem", fontWeight: 800, textTransform: "uppercase", color: "var(--color-primary)", letterSpacing: "0.04em", marginBottom: "12px" }}>
              Your Selected Candidate
            </div>

            <div
              className="candidate-avatar-frame"
              style={{
                width: "72px",
                height: "72px",
                background: candidate.avatarBg || "var(--color-primary)",
                fontSize: "26px",
                margin: "0 auto 12px auto",
              }}
            >
              {candidate.photoUrl ? (
                <img
                  src={candidate.photoUrl}
                  alt={candidate.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text)", marginBottom: "4px" }}>
              {candidate.name}
            </h3>

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              {candidate.symbol && (
                <span className="candidate-symbol-badge">
                  <span>{candidate.symbol}</span>
                  <span>{candidate.symbolName}</span>
                </span>
              )}
              <span style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                Roll: {candidate.rollNumber} • Sec {candidate.section || "A"}
              </span>
            </div>

            {candidate.tagline && (
              <p style={{ fontSize: "0.84rem", color: "var(--color-text-secondary)", fontStyle: "italic", maxWidth: "380px", margin: "0 auto" }}>
                &ldquo;{candidate.tagline}&rdquo;
              </p>
            )}
          </div>

          {/* Legal / Institutional Warning */}
          <div
            style={{
              background: "var(--color-warning-bg)",
              border: "1px solid var(--color-warning-border)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.82rem",
              color: "var(--color-warning)",
            }}
          >
            <span>⚠️</span>
            <span>
              <strong>Final Action:</strong> Once cast, your ballot is sealed and cannot be changed or resubmitted.
            </span>
          </div>

          {/* Action CTAs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              type="button"
              className="btn-primary btn-full"
              disabled={isSubmitting}
              onClick={handleFinalVoteSubmission}
              style={{
                padding: "14px",
                fontSize: "1rem",
                background: "var(--color-primary)",
              }}
            >
              {isSubmitting ? "Sealing & Submitting Ballot..." : "✓ Confirm & Cast Official Ballot"}
            </button>

            <Link
              to="/vote"
              className="btn-secondary btn-full"
              style={{ textAlign: "center" }}
            >
              ← Change Selection / Go Back
            </Link>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default VoteConfirm;
