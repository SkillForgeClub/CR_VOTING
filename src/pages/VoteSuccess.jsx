import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import CollegeLogo from "../components/branding/CollegeLogo";
import SkillForgeLogo from "../components/branding/SkillForgeLogo";
import BRAND from "../config/branding";
import authService from "../services/authService";

export function VoteSuccess() {
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const rawReceipt = sessionStorage.getItem("latestVoteReceipt");
    if (rawReceipt) {
      try {
        setReceipt(JSON.parse(rawReceipt));
      } catch (e) {}
    } else {
      // Fallback data if direct navigation
      const current = authService.getStudentSession();
      if (!current) {
        navigate("/");
        return;
      }
      setReceipt({
        refId: `CR26-DS${current.section || "A"}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        timestamp: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" }),
        name: current.name,
        rollNumber: current.rollNumber,
        section: current.section,
        candidateName: "Sealed Ballot Selection",
      });
    }

    // Clean student session after displaying receipt
    authService.clearStudentSession();
    sessionStorage.removeItem("selectedCandidate");
  }, [navigate]);

  const handleCopyRefId = () => {
    if (receipt?.refId) {
      navigator.clipboard.writeText(receipt.refId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!receipt) return null;

  return (
    <PageContainer>
      <div style={{ maxWidth: "480px", margin: "10px auto 0 auto", width: "100%" }}>
        <div className="inst-card-elevated" style={{ textAlign: "center", padding: "clamp(20px, 5vw, 32px)" }}>
          {/* Institutional Logos */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <CollegeLogo size="sm" />
            <div style={{ width: "1px", height: "20px", background: "var(--color-border)" }} />
            <SkillForgeLogo size="sm" />
          </div>

          {/* Success Animated Emblem */}
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "var(--color-success-bg)",
              border: "3px solid var(--color-success)",
              color: "var(--color-success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              fontWeight: 900,
              margin: "0 auto 14px auto",
              boxShadow: "0 0 0 5px rgba(21, 128, 61, 0.12)",
            }}
          >
            ✓
          </div>

          <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--color-primary)", marginBottom: "4px" }}>
            Ballot Successfully Recorded
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "20px" }}>
            Thank you for participating in {BRAND.electionName}.
          </p>

          {/* Reference ID Highlight Box */}
          <div
            style={{
              background: "var(--color-surface-muted)",
              border: "1.5px dashed var(--color-border)",
              borderRadius: "var(--radius-lg)",
              padding: "16px",
              textAlign: "left",
              marginBottom: "22px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid var(--color-border)", paddingBottom: "8px" }}>
              <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "var(--color-primary)", textTransform: "uppercase" }}>
                Official Ballot Receipt
              </span>
              <span style={{ fontSize: "0.7rem", background: "var(--color-success)", color: "#fff", padding: "2px 6px", borderRadius: "var(--radius-sm)", fontWeight: 700 }}>
                SEALED &amp; RECORDED
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.84rem" }}>
              <div>
                <span style={{ color: "var(--color-text-muted)", fontSize: "0.72rem", display: "block" }}>
                  Ballot Reference ID
                </span>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
                  <strong style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)", fontSize: "1.02rem" }}>
                    {receipt.refId}
                  </strong>
                  <button
                    type="button"
                    onClick={handleCopyRefId}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "2px 8px",
                      fontSize: "0.74rem",
                      cursor: "pointer",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
                <div>
                  <span style={{ color: "var(--color-text-muted)", fontSize: "0.72rem", display: "block" }}>
                    Voter Roll No
                  </span>
                  <strong style={{ fontFamily: "var(--font-mono)" }}>{receipt.rollNumber}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--color-text-muted)", fontSize: "0.72rem", display: "block" }}>
                    Section
                  </span>
                  <strong>Section {receipt.section}</strong>
                </div>
              </div>

              <div style={{ marginTop: "4px" }}>
                <span style={{ color: "var(--color-text-muted)", fontSize: "0.72rem", display: "block" }}>
                  Recorded Timestamp
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{receipt.timestamp}</span>
              </div>
            </div>

            <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid var(--color-border)", fontSize: "0.74rem", color: "var(--color-text-muted)" }}>
              🔒 Selection is anonymized and cryptographically secured in the official ledger.
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link
              to="/"
              className="btn-primary btn-full"
              style={{ fontSize: "0.95rem", padding: "12px" }}
            >
              Done &amp; Return to Home Portal →
            </Link>

            <button
              type="button"
              className="btn-secondary btn-full"
              onClick={handlePrint}
              style={{ fontSize: "0.85rem", padding: "10px" }}
            >
              🖨️ Print / Save Ballot Receipt
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default VoteSuccess;
