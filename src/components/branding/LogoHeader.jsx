import { Link } from "react-router-dom";
import CollegeLogo from "./CollegeLogo";
import SkillForgeLogo from "./SkillForgeLogo";
import BRAND from "../../config/branding";

export function LogoHeader({ showNavLinks = true, size = "md" }) {
  return (
    <div className="inst-header-inner">
      {/* College Logo */}
      <Link to="/" className="inst-logo-group" aria-label="Go to VIIT CR Elections Home">
        <CollegeLogo size={size} />
        <div className="inst-divider" />
        <div className="inst-portal-title">
          <h1>{BRAND.electionName}</h1>
          <span>{BRAND.department}</span>
        </div>
      </Link>

      {/* Right side: SkillForge Club Logo & Quick Navigation */}
      <div className="inst-nav-actions">
        <div className="hidden sm:flex items-center gap-3">
          <SkillForgeLogo size={size} />
        </div>
      </div>
    </div>
  );
}

export default LogoHeader;
