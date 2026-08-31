export function CandidateModal({ candidate, isOpen, onClose, onSelect, isSelected }) {
  if (!isOpen || !candidate) return null;

  const initials = candidate.name
    ? candidate.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "CR";

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "14px",
            right: "14px",
            background: "var(--color-surface-muted)",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
            cursor: "pointer",
            color: "var(--color-text-secondary)",
          }}
          aria-label="Close modal"
        >
          &times;
        </button>

        {/* Header Profile Section */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px", paddingRight: "36px" }}>
          <div
            className="candidate-avatar-frame"
            style={{
              width: "60px",
              height: "60px",
              background: candidate.avatarBg || "var(--color-primary)",
              fontSize: "22px",
            }}
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

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>{candidate.name}</h2>
              {candidate.symbol && (
                <span className="candidate-symbol-badge">
                  <span>{candidate.symbol}</span>
                  <span>{candidate.symbolName}</span>
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--color-text-muted)", marginTop: "2px" }}>
              <strong>{candidate.rollNumber}</strong> • <strong>Sec {candidate.section || "A"}</strong>
            </div>
          </div>
        </div>

        {/* Vision Statement */}
        <div
          style={{
            background: "var(--color-primary-subtle)",
            border: "1px solid rgba(37, 99, 235, 0.15)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase", marginBottom: "2px" }}>
            Candidate Tagline
          </div>
          <p style={{ fontSize: "0.88rem", color: "var(--color-text)", fontWeight: 500, lineHeight: 1.4 }}>
            &ldquo;{candidate.tagline || candidate.manifesto}&rdquo;
          </p>
        </div>

        {/* Detailed Manifesto */}
        <div style={{ marginBottom: "16px" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "6px", color: "var(--color-primary)" }}>
            Official Manifesto
          </h4>
          <p style={{ fontSize: "0.86rem", color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
            {candidate.manifesto || "Dedicated to student advocacy, peer support, and active collaboration with faculty."}
          </p>
        </div>

        {/* Key Priorities / Action Points */}
        {candidate.keyPoints && candidate.keyPoints.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "8px", color: "var(--color-text)" }}>
              Key Agenda Points
            </h4>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
              {candidate.keyPoints.map((point, idx) => (
                <li
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    fontSize: "0.84rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <span style={{ color: "var(--color-primary)", fontWeight: 800 }}>•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap", marginTop: "14px", borderTop: "1px solid var(--color-border)", paddingTop: "14px" }}>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: "1 1 120px", minHeight: "44px" }}>
            Close
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onSelect(candidate);
              onClose();
            }}
            style={{ flex: "1 1 160px", minHeight: "44px" }}
          >
            {isSelected ? "✓ Candidate Selected" : "Select Candidate"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CandidateModal;
