import { useState } from "react";
import BRAND from "../../config/branding";

export function CollegeLogo({ size = "md", className = "" }) {
  const [currentSrc, setCurrentSrc] = useState(BRAND.collegeLogo);
  const [imgError, setImgError] = useState(false);

  // Height mappings matching user specifications:
  // Mobile: ~36-48px, Desktop: ~48-60px
  const heights = {
    sm: "44px",
    md: "52px",
    lg: "64px",
    hero: "clamp(46px, 10vw, 68px)",
  };

  const currentHeight = heights[size] || heights.md;

  const handleImageError = () => {
    if (currentSrc === BRAND.collegeLogo && BRAND.collegeLogoSvg) {
      setCurrentSrc(BRAND.collegeLogoSvg);
    } else {
      setImgError(true);
    }
  };

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
          background: "var(--color-primary-subtle)",
          border: "1px solid rgba(37, 99, 235, 0.2)",
          borderRadius: "var(--radius-md)",
          color: "var(--color-primary)",
          fontWeight: 800,
          fontSize: "0.85rem",
        }}
        title={BRAND.institutionName}
      >
        <span style={{ fontSize: "1.1rem" }}>🏛️</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ lineHeight: 1.1, fontSize: "0.85rem", fontWeight: 800 }}>VIIT</div>
          <div style={{ fontSize: "0.62rem", color: "var(--color-text-muted)", fontWeight: 600 }}>Data Science</div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={`${BRAND.institutionName} Logo`}
      className={`inst-logo-img ${className}`}
      style={{
        height: currentHeight,
        width: "auto",
        maxWidth: "min(100%, 220px)",
        objectFit: "contain",
        display: "block",
      }}
      onError={handleImageError}
      loading="eager"
    />
  );
}

export default CollegeLogo;
