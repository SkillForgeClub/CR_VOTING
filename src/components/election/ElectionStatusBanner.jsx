import { ElectionState } from "../../services/electionService";

export function ElectionStatusBanner({ status }) {
  if (status === ElectionState.LIVE) return null;

  if (status === ElectionState.PAUSED) {
    return (
      <div
        style={{
          background: "var(--color-warning-bg)",
          border: "1px solid var(--color-warning-border)",
          borderRadius: "var(--radius-md)",
          padding: "14px 18px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          color: "var(--color-warning)",
        }}
      >
        <span style={{ fontSize: "1.3rem" }}>⏸️</span>
        <div>
          <strong style={{ display: "block", fontSize: "0.95rem" }}>Voting is Temporarily Paused</strong>
          <span style={{ fontSize: "0.84rem" }}>
            The presiding election officers have temporarily paused voting activities. Please standby or contact your faculty coordinator.
          </span>
        </div>
      </div>
    );
  }

  if (status === ElectionState.CLOSED) {
    return (
      <div
        style={{
          background: "var(--color-danger-bg)",
          border: "1px solid var(--color-danger-border)",
          borderRadius: "var(--radius-md)",
          padding: "14px 18px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          color: "var(--color-danger)",
        }}
      >
        <span style={{ fontSize: "1.3rem" }}>🔒</span>
        <div>
          <strong style={{ display: "block", fontSize: "0.95rem" }}>Official Election Has Closed</strong>
          <span style={{ fontSize: "0.84rem" }}>
            The voting window for the Class Representative Election has concluded. Official results will be published by the Department.
          </span>
        </div>
      </div>
    );
  }

  if (status === ElectionState.UPCOMING) {
    return (
      <div
        style={{
          background: "var(--color-primary-subtle)",
          border: "1px solid rgba(37, 99, 235, 0.2)",
          borderRadius: "var(--radius-md)",
          padding: "14px 18px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          color: "var(--color-primary)",
        }}
      >
        <span style={{ fontSize: "1.3rem" }}>🕒</span>
        <div>
          <strong style={{ display: "block", fontSize: "0.95rem" }}>Upcoming Election Window</strong>
          <span style={{ fontSize: "0.84rem" }}>
            The ballot is currently configured for preview. Voting will officially commence per the institutional schedule.
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export default ElectionStatusBanner;
