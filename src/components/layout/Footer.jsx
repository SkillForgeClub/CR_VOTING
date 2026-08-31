import BRAND from "../../config/branding";

export function Footer() {
  return (
    <footer className="inst-footer">
      <div className="inst-footer-inner">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
          <strong>{BRAND.electionName}</strong>
          <span>•</span>
          <span>{BRAND.electionSubtitle}</span>
        </div>

        <div className="inst-footer-creds">
          {BRAND.department} • {BRAND.institutionName}
        </div>

        <div className="inst-footer-copy">
          Designed &amp; Developed for Official Elections by <strong>{BRAND.developerOrg}</strong> &copy; {BRAND.year}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
