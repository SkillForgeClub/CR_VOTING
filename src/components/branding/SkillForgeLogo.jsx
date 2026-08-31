import { useState } from "react";
import BRAND from "../../config/branding";

export function SkillForgeLogo({ size = "md", className = "" }) {
  const [imgError, setImgError] = useState(false);

  // Height mappings matching user specifications:
  // Mobile: ~32-44px, Desktop: ~40-52px
  const heights = {
    sm: "40px",
    md: "48px",
    lg: "58px",
    hero: "clamp(42px, 9vw, 58px)",
  };

  const currentHeight = heights[size] || heights.md;

  if (imgError) {
    return (
      <div
        className={`inst-logo-fallback ${className}`}
        style={{
          height: currentHeight,
          padding: "0 10px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(2, 132, 199, 0.08)",
          border: "1px solid rgba(2, 132, 199, 0.3)",
          borderRadius: "var(--radius-md)",
          color: "var(--color-club)",
          fontWeight: 800,
          fontSize: "0.85rem",
        }}
        title={BRAND.developerOrg}
      >
        <span style={{ fontSize: "1.1rem" }}>⚡</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ lineHeight: 1.1, fontSize: "0.82rem", fontWeight: 800 }}>SKILLFORGE</div>
          <div style={{ fontSize: "0.62rem", color: "var(--color-text-muted)", fontWeight: 600 }}>Club</div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={BRAND.clubLogo}
      alt={`${BRAND.developerOrg} Logo`}
      className={`inst-logo-img ${className}`}
      style={{
        height: currentHeight,
        width: "auto",
        maxWidth: "min(100%, 180px)",
        objectFit: "contain",
        display: "block",
      }}
      onError={() => setImgError(true)}
      loading="eager"
    />
  );
}

export default SkillForgeLogo;
