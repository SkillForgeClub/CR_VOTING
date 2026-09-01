import { Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import BRAND from "../config/branding";
import electionService, { ElectionState } from "../services/electionService";
import { useEffect, useState } from "react";

export function Home() {
  const [electionStatus, setElectionStatus] = useState(ElectionState.LIVE);

  useEffect(() => {
    electionService.fetchStatus().then((status) => {
      if (status) setElectionStatus(status);
    });
  }, []);

  return (
    <PageContainer>
      <div style={{ width: "100%", maxWidth: "860px", margin: "0 auto" }}>
        
        {/* =========================================================
            MOBILE-FIRST HERO SECTION
            - Direct on page background (no huge nested card wrapper)
            - High priority CTA within first phone viewport
            ========================================================= */}
        <section
          style={{
            textAlign: "center",
            paddingBlock: "clamp(12px, 3vw, 24px)",
            paddingInline: "0",
            marginBottom: "24px",
          }}
        >
          {/* Department Badge */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--color-primary-subtle)",
                color: "var(--color-primary)",
                border: "1px solid rgba(37, 99, 235, 0.2)",
                padding: "4px 12px",
                borderRadius: "var(--radius-full)",
                fontSize: "clamp(0.75rem, 2.5vw, 0.82rem)",
                fontWeight: 700,
                letterSpacing: "0.02em",
                maxWidth: "100%",
                wordBreak: "break-word",
              }}
            >
              <span>🏛️</span>
              <span>{BRAND.department}</span>
            </div>
          </div>

          {/* Responsive Election Heading */}
          <h1
            style={{
              fontSize: "clamp(1.75rem, 6.5vw, 2.75rem)",
              fontWeight: 900,
              color: "var(--color-primary)",
              lineHeight: 1.12,
              marginBottom: "10px",
              letterSpacing: "-0.03em",
              wordBreak: "break-word",
            }}
          >
            {BRAND.electionName}
          </h1>

          {/* Subtitle / Explanation */}
          <p
            style={{
              fontSize: "clamp(0.92rem, 3vw, 1.1rem)",
              fontWeight: 500,
              color: "var(--color-text-secondary)",
              maxWidth: "540px",
              margin: "0 auto 16px auto",
              lineHeight: 1.45,
            }}
          >
            Official Class Representative Election Portal for Sections A, B, C, and D. Cast your vote with confidence and integrity.
          </p>

          {/* Election Status Badge */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            {electionStatus === ElectionState.LIVE && (
              <div className="status-pill live" style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
                <span className="pulse-dot" />
                <span>OFFICIAL BALLOT IS LIVE</span>
              </div>
            )}
            {electionStatus === ElectionState.PAUSED && (
              <div className="status-pill paused" style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
                <span>⏸️ VOTING CURRENTLY PAUSED</span>
              </div>
            )}
            {electionStatus === ElectionState.CLOSED && (
              <div className="status-pill closed" style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
                <span>🔒 ELECTION HAS CONCLUDED</span>
              </div>
            )}
          </div>

          {/* PRIMARY CTA BUTTON (Full width / high visibility within first viewport) */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <Link
              to="/login"
              className="btn-primary"
              style={{
                fontSize: "1.02rem",
                padding: "14px 28px",
                width: "min(100%, 340px)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 4px 14px -2px rgba(30, 58, 138, 0.35)",
              }}
            >
              <span>CAST YOUR VOTE</span>
              <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>→</span>
            </Link>
          </div>
        </section>

        {/* =========================================================
            SECTION SHORTCUTS / OVERVIEW CARDS
            ========================================================= */}
        <section style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-text)" }}>
              Contesting Sections
            </h2>
            <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontWeight: 600 }}>
              Batch of 2026 • 4 Active Sections
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
              gap: "12px",
              width: "100%",
            }}
          >
            {BRAND.sections.map((sec) => (
              <Link
                key={sec}
                to="/login"
                className="inst-card"
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  transition: "var(--transition-fast)",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--color-primary)" }}>
                    Section {sec}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--color-text-muted)" }}>
                    Class Representative
                  </div>
                </div>
                <div
                  style={{
                    background: "var(--color-primary-subtle)",
                    color: "var(--color-primary)",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                  }}
                >
                  →
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* =========================================================
            VOTING GUIDELINES & PROCESS
            ========================================================= */}
        <section className="inst-card" style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <span style={{ fontSize: "1.3rem" }}>📋</span>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-primary)" }}>
              Student Voting Instructions
            </h3>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  background: "var(--color-primary-subtle)",
                  color: "var(--color-primary)",
                  fontWeight: 800,
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                1
              </div>
              <div>
                <h4 style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "2px" }}>
                  Verify Student Identity
                </h4>
                <p style={{ fontSize: "0.84rem", color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
                  Enter your official full name, registered VIIT roll number, and choose your designated section (A, B, C, or D).
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  background: "var(--color-primary-subtle)",
                  color: "var(--color-primary)",
                  fontWeight: 800,
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                2
              </div>
              <div>
                <h4 style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "2px" }}>
                  Review Manifestos &amp; Select
                </h4>
                <p style={{ fontSize: "0.84rem", color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
                  Browse through contesting candidate profiles, view their action agendas, and select your preferred representative.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  background: "var(--color-primary-subtle)",
                  color: "var(--color-primary)",
                  fontWeight: 800,
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                3
              </div>
              <div>
                <h4 style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "2px" }}>
                  Confirm &amp; Receive Digital Receipt
                </h4>
                <p style={{ fontSize: "0.84rem", color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
                  Confirm your selection to cast your immutable ballot and obtain your official digital reference ID receipt.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            ELECTION TIMELINE
            ========================================================= */}
        <section className="inst-card" style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <span style={{ fontSize: "1.3rem" }}>⏱️</span>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-primary)" }}>
              Official Election Timeline
            </h3>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
              gap: "12px",
            }}
          >
            <div
              style={{
                background: "var(--color-surface-muted)",
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                borderLeft: "3px solid var(--color-live)",
              }}
            >
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-live)", textTransform: "uppercase" }}>
                Active Phase
              </span>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, marginTop: "2px" }}>
                Live Ballot Submission
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--color-text-muted)" }}>
                09:00 AM – 04:30 PM
              </div>
            </div>

            <div
              style={{
                background: "var(--color-surface-muted)",
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                borderLeft: "3px solid var(--color-primary)",
              }}
            >
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase" }}>
                Next Phase
              </span>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, marginTop: "2px" }}>
                Presiding Scrutiny &amp; Tally
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--color-text-muted)" }}>
                04:45 PM – 05:30 PM
              </div>
            </div>

            <div
              style={{
                background: "var(--color-surface-muted)",
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                borderLeft: "3px solid var(--color-club)",
              }}
            >
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-club)", textTransform: "uppercase" }}>
                Final Phase
              </span>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, marginTop: "2px" }}>
                Official Results Declaration
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--color-text-muted)" }}>
                06:00 PM IST
              </div>
            </div>
          </div>
        </section>

      </div>
    </PageContainer>
  );
}

export default Home;
