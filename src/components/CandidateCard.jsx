function CandidateCard({ candidate, isSelected, onSelect }) {
  return (
    <div
      className={`candidate-card ${isSelected ? "selected" : ""}`}
      onClick={() => onSelect(candidate)}
      style={{ cursor: "pointer" }}
    >
      <div className="candidate-avatar">
        {candidate.name ? candidate.name.charAt(0).toUpperCase() : "C"}
      </div>

      <h3 className="candidate-name">{candidate.name}</h3>

      {candidate.section && (
        <span className="candidate-tag">Section {candidate.section}</span>
      )}

      {candidate.rollNumber && (
        <span style={{ fontSize: "0.8rem", color: "#718096", marginBottom: "8px" }}>
          Roll: {candidate.rollNumber}
        </span>
      )}

      <p className="candidate-manifesto">
        {candidate.manifesto || "Committed to representing class interests with transparency, discipline, and dedication."}
      </p>

      <button
        type="button"
        className={`cv-button ${isSelected ? "" : "cv-button-outline"}`}
        style={{ width: "100%", marginTop: "auto" }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(candidate);
        }}
      >
        {isSelected ? "Selected ✓" : "Select Candidate"}
      </button>
    </div>
  );
}

export default CandidateCard;
