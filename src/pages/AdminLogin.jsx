import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import CollegeLogo from "../components/branding/CollegeLogo";
import SkillForgeLogo from "../components/branding/SkillForgeLogo";
import BRAND from "../config/branding";
import authService from "../services/authService";

export function AdminLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await authService.adminLogin(identifier, passcode);
      if (result.success) {
        setLoading(false);
        navigate("/admin");
      } else {
        setError(result.message || "Invalid administrator credentials.");
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || "Failed to authenticate administrator.");
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div style={{ maxWidth: "440px", margin: "10px auto 0 auto", width: "100%" }}>
        <div className="inst-card-elevated" style={{ padding: "clamp(18px, 4.5vw, 28px)" }}>
          {/* Institutional Header */}
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <CollegeLogo size="sm" />
              <div style={{ width: "1px", height: "20px", background: "var(--color-border)" }} />
              <SkillForgeLogo size="sm" />
            </div>

            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-full)",
                background: "var(--color-accent-subtle)",
                color: "var(--color-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 10px auto",
                fontSize: "1.2rem",
              }}
            >
              🛡️
            </div>

            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--color-primary)", marginBottom: "4px" }}>
              Election Administration
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--color-text-secondary)" }}>
              Presiding Officer &amp; Faculty Scrutiny Console
            </p>
          </div>

          {error && (
            <div
              style={{
                background: "var(--color-danger-bg)",
                border: "1px solid var(--color-danger-border)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                marginBottom: "16px",
                color: "var(--color-danger)",
                fontSize: "0.86rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}
              role="alert"
            >
              <span style={{ fontSize: "1rem" }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="admin-user"
                style={{ display: "block", fontSize: "0.86rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "6px" }}
              >
                Officer ID / Username
              </label>
              <input
                id="admin-user"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. test or admin"
                required
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--color-border)",
                  fontSize: "1rem",
                  minHeight: "48px",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                htmlFor="admin-pass"
                style={{ display: "block", fontSize: "0.86rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "6px" }}
              >
                Security Passcode
              </label>
              <input
                id="admin-pass"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--color-border)",
                  fontSize: "1rem",
                  minHeight: "48px",
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary btn-full"
              disabled={loading}
              style={{
                padding: "14px",
                fontSize: "0.98rem",
                background: "var(--color-accent)",
                borderColor: "var(--color-accent)",
              }}
            >
              {loading ? "Authenticating..." : "Access Election Console →"}
            </button>
          </form>

          <div style={{ marginTop: "18px", textAlign: "center", fontSize: "0.82rem" }}>
            <Link to="/" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
              ← Return to Student Ballot Portal
            </Link>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default AdminLogin;
