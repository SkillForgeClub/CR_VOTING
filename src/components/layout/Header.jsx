import { Link, useLocation } from "react-router-dom";
import CollegeLogo from "../branding/CollegeLogo";
import SkillForgeLogo from "../branding/SkillForgeLogo";
import BRAND from "../../config/branding";
import electionService, { ElectionState } from "../../services/electionService";
import { useEffect, useState } from "react";

export function Header() {
  const location = useLocation();
  const [electionStatus, setElectionStatus] = useState(ElectionState.LIVE);

  useEffect(() => {
    setElectionStatus(electionService.getElectionStatus());
  }, [location.pathname]);

  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <header className="inst-header">
      <div className="inst-header-inner">
        {/* =========================================================
            1. MOBILE HEADER LAYOUT (< 768px)
            Structure:
            Row 1: [College Logo]            [SkillForge Logo]
            Row 2: VIIT CR ELECTIONS 2026
            Row 3: Department of Data Science
            Row 4: [● ELECTION LIVE] + [Nav Links]
            ========================================================= */}
        <div className="mobile-header-stack">
          {/* Top Row: Logos */}
          <div className="mobile-header-row-logos">
            <Link to="/" aria-label="VIIT College Home">
              <CollegeLogo size="sm" />
            </Link>
            <Link to="/" aria-label="SkillForge Club Home">
              <SkillForgeLogo size="sm" />
            </Link>
          </div>

          {/* Row 2 & 3: Election Name & Department */}
          <Link to="/" className="mobile-header-title-block" aria-label="Go to Election Portal Home">
            <div className="mobile-header-title">{BRAND.electionName}</div>
            <div className="mobile-header-dept">{BRAND.department}</div>
          </Link>

          {/* Row 4: Status Indicator & Navigation */}
          <div className="mobile-header-subbar">
            {/* Status Pill */}
            {electionStatus === ElectionState.LIVE && (
              <div className="status-pill live">
                <span className="pulse-dot" />
                <span>ELECTION LIVE</span>
              </div>
            )}
            {electionStatus === ElectionState.PAUSED && (
              <div className="status-pill paused">
                <span>⏸️ PAUSED</span>
              </div>
            )}
            {electionStatus === ElectionState.CLOSED && (
              <div className="status-pill closed">
                <span>🔒 CLOSED</span>
              </div>
            )}

            {/* Quick Navigation Links */}
            <nav className="inst-nav-actions" aria-label="Mobile Navigation">
              <Link
                to="/"
                className={`inst-nav-link ${location.pathname === "/" ? "active" : ""}`}
              >
                Home
              </Link>
              <Link
                to="/login"
                className={`inst-nav-link ${location.pathname === "/login" || location.pathname === "/vote" ? "active" : ""}`}
              >
                Vote
              </Link>
              <Link
                to="/admin-login"
                className={`inst-nav-link ${isAdmin ? "active" : ""}`}
                style={isAdmin ? { background: "var(--color-accent-subtle)", color: "var(--color-accent)" } : {}}
              >
                Admin
              </Link>
            </nav>
          </div>
        </div>

        {/* =========================================================
            2. DESKTOP HEADER LAYOUT (>= 768px)
            Sleek horizontal institutional bar
            ========================================================= */}
        <div className="desktop-header-row">
          {/* Left: College Logo + Portal Identity */}
          <Link to="/" className="inst-logo-group" aria-label="VIIT CR Election Portal Home">
            <CollegeLogo size="md" />
            <div className="inst-divider" />
            <div className="inst-portal-title">
              <h1>{BRAND.electionName}</h1>
              <span>{BRAND.department}</span>
            </div>
          </Link>

          {/* Center: Live Status Indicator */}
          <div>
            {electionStatus === ElectionState.LIVE && (
              <div className="status-pill live">
                <span className="pulse-dot" />
                <span>ELECTION LIVE</span>
              </div>
            )}
            {electionStatus === ElectionState.PAUSED && (
              <div className="status-pill paused">
                <span>⏸️ Voting Paused</span>
              </div>
            )}
            {electionStatus === ElectionState.CLOSED && (
              <div className="status-pill closed">
                <span>🔒 Election Closed</span>
              </div>
            )}
          </div>

          {/* Right: Navigation + SkillForge Logo */}
          <div className="inst-nav-actions">
            <nav style={{ display: "flex", alignItems: "center", gap: "6px" }} aria-label="Desktop Navigation">
              <Link
                to="/"
                className={`inst-nav-link ${location.pathname === "/" ? "active" : ""}`}
              >
                Home
              </Link>
              <Link
                to="/login"
                className={`inst-nav-link ${location.pathname === "/login" || location.pathname === "/vote" ? "active" : ""}`}
              >
                Cast Ballot
              </Link>
              <Link
                to="/admin-login"
                className={`inst-nav-link ${isAdmin ? "active" : ""}`}
                style={isAdmin ? { background: "var(--color-accent-subtle)", color: "var(--color-accent)" } : {}}
              >
                Admin Panel
              </Link>
            </nav>

            <div className="inst-divider" />
            <Link to="/" aria-label="SkillForge Club">
              <SkillForgeLogo size="md" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
