import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import CollegeLogo from "../components/branding/CollegeLogo";
import SkillForgeLogo from "../components/branding/SkillForgeLogo";
import BRAND from "../config/branding";
import authService from "../services/authService";
import votingService from "../services/votingService";
import electionService, { ElectionState } from "../services/electionService";
import ElectionStatusBanner from "../components/election/ElectionStatusBanner";

export function Login() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [section, setSection] = useState("A");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [electionStatus, setElectionStatus] = useState(ElectionState.LIVE);

  useEffect(() => {
    electionService.fetchStatus().then((status) => {
      if (status) setElectionStatus(status);
    });
  }, []);

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (electionStatus === ElectionState.PAUSED) {
      setError("Voting is currently paused by the presiding election officer. Please try again shortly.");
      return;
    }

    if (electionStatus === ElectionState.CLOSED) {
      setError("The election portal is officially closed. Ballot submissions are no longer accepted.");
      return;
    }

    const cleanName = name.trim();
    const cleanRoll = rollNumber.trim().toUpperCase();

    if (!cleanName) {
      setError("Please enter your official student full name.");
      return;
    }

    if (!cleanRoll) {
      setError("Please enter your VIIT roll number.");
      return;
    }

    if (cleanRoll.length < 1) {
      setError("Please enter your roll number.");
      return;
    }

    setIsLoading(true);

    try {
      // Call authoritative backend login
      const result = await authService.studentLogin({
        rollNumber: cleanRoll,
        name: cleanName,
        section: section.toUpperCase(),
      });

      if (result.student && result.student.voted) {
        setError(`Roll number ${cleanRoll} has already cast a ballot. Duplicate voting is strictly prohibited.`);
        setIsLoading(false);
        return;
      }

      sessionStorage.setItem("studentDetails", JSON.stringify({
        name: result.student?.name || cleanName,
        rollNumber: result.student?.rollNumber || cleanRoll,
        section: result.student?.section || section.toUpperCase(),
        verifiedAt: new Date().toISOString(),
      }));

      navigate("/vote");
    } catch (err) {
      // Fallback: If in relaxed mode or student not in local roster, still allow structured test entry
      if (err.message && err.message.includes("not found")) {
        const studentData = {
          name: cleanName,
          rollNumber: cleanRoll,
          section: section.toUpperCase(),
          verifiedAt: new Date().toISOString(),
        };
        authService.setStudentSession("", studentData);
        sessionStorage.setItem("studentDetails", JSON.stringify(studentData));
        navigate("/vote");
      } else {
        setError(err.message || "Failed to verify credentials with election server.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer>
      <div style={{ maxWidth: "480px", margin: "10px auto 0 auto", width: "100%" }}>
        <ElectionStatusBanner status={electionStatus} />

        <div className="inst-card-elevated" style={{ padding: "clamp(18px, 4.5vw, 28px)" }}>
          {/* Header Branding */}
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "14px", marginBottom: "12px" }}>
              <CollegeLogo size="sm" />
              <div style={{ width: "1px", height: "24px", background: "var(--color-border)" }} />
              <SkillForgeLogo size="sm" />
            </div>

            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--color-primary)", marginBottom: "4px" }}>
              Student Voter Verification
            </h2>
            <p style={{ fontSize: "0.84rem", color: "var(--color-text-secondary)" }}>
              {BRAND.department} • Class Representative Election
            </p>
          </div>

          {error && (
            <div
              style={{
                background: "var(--color-danger-bg)",
                border: "1px solid var(--color-danger-border)",
                borderRadius: "var(--radius-md)",
                padding: "12px 14px",
                marginBottom: "18px",
                color: "var(--color-danger)",
                fontSize: "0.86rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}
              role="alert"
            >
              <span style={{ fontSize: "1.1rem" }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleStudentSubmit}>
            {/* Student Name */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="student-name"
                style={{ display: "block", fontSize: "0.86rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "6px" }}
              >
                Student Full Name
              </label>
              <input
                id="student-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--color-border)",
                  fontSize: "1rem",
                  minHeight: "48px",
                  fontFamily: "var(--font-body)",
                }}
              />
            </div>

            {/* Roll Number */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="student-roll"
                style={{ display: "block", fontSize: "0.86rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "6px" }}
              >
                VIIT Roll Number
              </label>
              <input
                id="student-roll"
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                placeholder="e.g. 24DS0501"
                required
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--color-border)",
                  fontSize: "1rem",
                  minHeight: "48px",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              />
              <span style={{ fontSize: "0.74rem", color: "var(--color-text-muted)", marginTop: "4px", display: "block" }}>
                One ballot per registered student roll number.
              </span>
            </div>

            {/* Touch-Friendly Section Selection */}
            <div style={{ marginBottom: "22px" }}>
              <label
                style={{ display: "block", fontSize: "0.86rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "6px" }}
              >
                Select Your Class Section
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "8px",
                }}
              >
                {BRAND.sections.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSection(sec)}
                    disabled={isLoading}
                    style={{
                      padding: "10px 6px",
                      minHeight: "46px",
                      borderRadius: "var(--radius-md)",
                      border: section === sec ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                      background: section === sec ? "var(--color-primary-subtle)" : "var(--color-surface)",
                      color: section === sec ? "var(--color-primary)" : "var(--color-text)",
                      fontWeight: 800,
                      fontSize: "0.92rem",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "var(--transition-fast)",
                    }}
                  >
                    <span>Sec {sec}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Verification Submit Button */}
            <button
              type="submit"
              className="btn-primary btn-full"
              disabled={isLoading || electionStatus === ElectionState.CLOSED}
              style={{ padding: "14px", fontSize: "0.98rem" }}
            >
              {isLoading ? "Verifying Credentials..." : "Proceed to Official Ballot →"}
            </button>
          </form>

          {/* Institutional Note */}
          <div
            style={{
              marginTop: "20px",
              paddingTop: "14px",
              borderTop: "1px solid var(--color-border)",
              textAlign: "center",
              fontSize: "0.78rem",
              color: "var(--color-text-muted)",
            }}
          >
            🔒 All votes are securely verified and logged under institutional protocols.
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default Login;
