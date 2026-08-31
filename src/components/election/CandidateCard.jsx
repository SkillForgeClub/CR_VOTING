export function CandidateCard({ candidate, isSelected, onSelect, onViewProfile }) {
  const initials = candidate.name
    ? candidate.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "CR";

  return (
    <div
      className={`candidate-box ${isSelected ? "selected" : ""}`}
      onClick={() => onSelect(candidate)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(candidate);
        }
      }}
      aria-label={`Select candidate ${candidate.name}`}
    >
      <div className="candidate-header-row">
        {/* Candidate Avatar / Photo */}
        <div
          className="candidate-avatar-frame"
          style={{ background: candidate.avatarBg || "var(--color-primary)" }}
        >
          {candidate.photoUrl ? (
            <img
              src={candidate.photoUrl}
              alt={candidate.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
            <h3 className="candidate-name-title">{candidate.name}</h3>
            {candidate.symbol && (
              <span className="candidate-symbol-badge" title={candidate.symbolName || "Election Symbol"}>
                <span>{candidate.symbol}</span>
                <span style={{ fontSize: "0.72rem" }}>{candidate.symbolName}</span>
              </span>
            )}
          </div>

          <div className="candidate-meta-line">
            <strong>{candidate.rollNumber}</strong> • <span>Section {candidate.section || "A"}</span>
          </div>
        </div>
      </div>

      {/* Tagline / Manifesto Preview */}
      <p className="candidate-tagline">
        {candidate.tagline || candidate.manifesto || "Dedicated to active student advocacy and peer support."}
      </p>

      {/* Action Row */}
      <div className="candidate-action-row">
        <button
          type="button"
          className="btn-profile-link"
          onClick={(e) => {
            e.stopPropagation();
            if (onViewProfile) onViewProfile(candidate);
          }}
        >
          View Manifesto
        </button>

        <div className="btn-select-indicator">
          {isSelected ? (
            <>
              <span style={{ fontWeight: 800 }}>✓</span>
              <span>SELECTED</span>
            </>
          ) : (
            <>
              <span style={{ opacity: 0.7 }}>○</span>
              <span>Select Candidate</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CandidateCard;
