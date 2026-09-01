import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import CollegeLogo from "../components/branding/CollegeLogo";
import SkillForgeLogo from "../components/branding/SkillForgeLogo";
import BRAND from "../config/branding";
import authService from "../services/authService";

/* ─── Celebration Popup ─────────────────────────────────────────────────────── */
function CelebrationPopup({ studentName, onDismiss }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);

  // Confetti engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#1e3a8a", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444"];
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 8 + 4,
      d: Math.random() * 120 + 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngle: 0,
      tiltAngleInc: Math.random() * 0.07 + 0.05,
      shape: Math.random() > 0.5 ? "circle" : "rect",
    }));

    let angle = 0;
    let frameId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      angle += 0.01;
      particles.forEach((p, i) => {
        p.tiltAngle += p.tiltAngleInc;
        p.y += (Math.cos(angle + p.d) + 2.5) * 1.4;
        p.tilt = Math.sin(p.tiltAngle) * 12;
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.85;
        if (p.shape === "circle") {
          ctx.arc(p.x + p.tilt, p.y, p.r, 0, 2 * Math.PI);
        } else {
          ctx.fillRect(p.x + p.tilt - p.r / 2, p.y - p.r / 2, p.r, p.r * 1.6);
        }
        ctx.fill();
        if (p.y > canvas.height) {
          particles[i] = { ...particles[i], y: -10, x: Math.random() * canvas.width };
        }
      });
      frameId = requestAnimationFrame(draw);
    }
    draw();
    animRef.current = frameId;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(frameId); window.removeEventListener("resize", resize); };
  }, []);

  const handleDismiss = () => {
    setClosing(true);
    setTimeout(() => { setVisible(false); onDismiss(); }, 450);
  };

  useEffect(() => {
    const timer = setTimeout(handleDismiss, 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        animation: closing ? "fadeOut 0.4s ease forwards" : "fadeIn 0.35s ease",
      }}
    >
      {/* Confetti canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}
      />

      {/* Popup card */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          background: "linear-gradient(145deg, #0f172a 0%, #1e293b 100%)",
          border: "1.5px solid rgba(99,102,241,0.35)",
          borderRadius: "24px",
          padding: "clamp(28px, 6vw, 48px) clamp(24px, 5vw, 40px)",
          maxWidth: "420px",
          width: "90vw",
          textAlign: "center",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 60px rgba(99,102,241,0.18)",
          animation: closing ? "scaleOut 0.4s ease forwards" : "popIn 0.45s cubic-bezier(0.175,0.885,0.32,1.275)",
        }}
      >
        {/* Pulsing success emblem */}
        <div
          style={{
            width: "88px",
            height: "88px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "42px",
            margin: "0 auto 20px auto",
            boxShadow: "0 0 0 10px rgba(16,185,129,0.12), 0 0 0 20px rgba(16,185,129,0.06)",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          ✓
        </div>

        {/* Stars row */}
        <div style={{ fontSize: "22px", marginBottom: "12px", letterSpacing: "6px" }}>🎉 🗳️ 🎉</div>

        <h2
          style={{
            fontSize: "clamp(1.4rem, 4vw, 1.9rem)",
            fontWeight: 900,
            background: "linear-gradient(90deg, #a5f3fc, #818cf8, #34d399)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "10px",
            lineHeight: 1.2,
          }}
        >
          Vote Cast Successfully!
        </h2>

        <p style={{ fontSize: "0.95rem", color: "#cbd5e1", lineHeight: 1.6, marginBottom: "6px" }}>
          Well done,{" "}
          <strong style={{ color: "#f0f9ff", fontWeight: 700 }}>
            {studentName || "Student"}
          </strong>
          !
        </p>
        <p style={{ fontSize: "0.87rem", color: "#94a3b8", marginBottom: "22px" }}>
          Your ballot has been sealed and recorded in the official ledger. Your voice shapes the future of your class!
        </p>

        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(16,185,129,0.12)",
            border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: "999px",
            padding: "6px 16px",
            fontSize: "0.78rem",
            color: "#6ee7b7",
            fontWeight: 600,
            marginBottom: "24px",
          }}
        >
          <span>🔒</span> Cryptographically Sealed · VIIT Official Record
        </div>

        <button
          onClick={handleDismiss}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: "12px",
            border: "none",
            background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.97rem",
            cursor: "pointer",
            transition: "opacity 0.2s",
            boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          View My Ballot Receipt →
        </button>

        {/* Auto-dismiss progress bar */}
        <div
          style={{
            marginTop: "16px",
            height: "3px",
            borderRadius: "3px",
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "100%",
              background: "linear-gradient(90deg, #4f46e5, #34d399)",
              transformOrigin: "left",
              animation: "shrink 4s linear forwards",
            }}
          />
        </div>
        <p style={{ fontSize: "0.72rem", color: "#475569", marginTop: "6px" }}>Auto-dismisses in a moment…</p>
      </div>

      <style>{`
        @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
        @keyframes fadeOut  { from { opacity:1 } to { opacity:0 } }
        @keyframes popIn    { from { transform:scale(0.7) translateY(20px);opacity:0 } to { transform:scale(1) translateY(0);opacity:1 } }
        @keyframes scaleOut { from { transform:scale(1);opacity:1 } to { transform:scale(0.85) translateY(-10px);opacity:0 } }
        @keyframes pulse    { 0%,100%{box-shadow:0 0 0 10px rgba(16,185,129,0.12),0 0 0 20px rgba(16,185,129,0.06)} 50%{box-shadow:0 0 0 16px rgba(16,185,129,0.18),0 0 0 30px rgba(16,185,129,0.04)} }
        @keyframes shrink   { from { transform:scaleX(1) } to { transform:scaleX(0) } }
      `}</style>
    </div>
  );
}

/* ─── Main VoteSuccess Page ─────────────────────────────────────────────────── */
export function VoteSuccess() {
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showPopup, setShowPopup] = useState(true);

  useEffect(() => {
    const rawReceipt = sessionStorage.getItem("latestVoteReceipt");
    if (rawReceipt) {
      try {
        setReceipt(JSON.parse(rawReceipt));
      } catch (e) {}
    } else {
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
    <>
      {/* ── Celebration Popup ── */}
      {showPopup && (
        <CelebrationPopup
          studentName={receipt.name}
          onDismiss={() => setShowPopup(false)}
        />
      )}

      {/* ── Receipt Page ── */}
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
    </>
  );
}

export default VoteSuccess;
