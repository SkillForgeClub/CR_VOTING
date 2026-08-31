import { Link, useLocation } from "react-router-dom";

function Navbar() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <header className="cv-navbar">
      <div className="cv-nav-inner">
        <Link to="/" className="cv-nav-brand">
          <div className="cv-brand-icon">🗳️</div>
          <div className="cv-brand-text">
            <h2>Class Monitor</h2>
            <span>Election Portal</span>
          </div>
        </Link>

        <nav className="cv-nav-links">
          <Link to="/" className={`cv-nav-link ${location.pathname === "/" ? "active" : ""}`}>
            Home
          </Link>
          <Link to="/vote" className={`cv-nav-link ${location.pathname === "/vote" ? "active" : ""}`}>
            Vote Now
          </Link>
          <Link
            to="/admin-login"
            className={`cv-nav-link ${isAdmin ? "admin-badge" : "cv-nav-link"}`}
          >
            Admin Panel
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
