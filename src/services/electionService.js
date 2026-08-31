import BRAND from "../config/branding";

export const ElectionState = {
  UPCOMING: "UPCOMING",
  LIVE: "LIVE",
  PAUSED: "PAUSED",
  CLOSED: "CLOSED",
};

export const electionService = {
  // In-memory cache
  _cachedStatus: ElectionState.LIVE,
  _cachedConfig: null,

  async fetchStatus() {
    try {
      const res = await fetch("/api/v1/election/status");
      if (res.ok) {
        const data = await res.json();
        if (data.status) {
          this._cachedStatus = data.status;
          this._cachedConfig = data;
          return data.status;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch authoritative election status from server:", e);
    }
    return this._cachedStatus;
  },

  getElectionStatus() {
    return this._cachedStatus;
  },

  async fetchConfig() {
    try {
      const res = await fetch("/api/v1/election/config");
      if (res.ok) {
        const data = await res.json();
        this._cachedConfig = data;
        this._cachedStatus = data.status || ElectionState.LIVE;
        return data;
      }
    } catch (e) {}

    return this.getElectionConfig();
  },

  getElectionConfig() {
    if (this._cachedConfig) return this._cachedConfig;
    return {
      title: BRAND.electionName,
      department: BRAND.department,
      institution: BRAND.institutionName,
      status: this._cachedStatus,
      totalEligible: BRAND.totalStudentsExpected,
      googleSheetUrl: "https://docs.google.com/spreadsheets/d/147f7dJ-EvmrKCCIL8_55mXGmsg_gOkyDaXM1Ae40Jcc/edit",
      sections: BRAND.sections,
      autoCloseAt: "17:00",
    };
  },

  async setElectionStatus(newStatus, adminToken = "") {
    const endpoint =
      newStatus === ElectionState.LIVE
        ? "/api/v1/admin/election/resume"
        : newStatus === ElectionState.PAUSED
        ? "/api/v1/admin/election/pause"
        : newStatus === ElectionState.CLOSED
        ? "/api/v1/admin/election/close"
        : "/api/v1/admin/election/start";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken || sessionStorage.getItem("viit_admin_token") || ""}`,
        },
      });
      const data = await res.json();
      if (data.success && data.status) {
        this._cachedStatus = data.status;
        return true;
      }
    } catch (e) {
      console.warn("Error updating election state on server:", e);
    }
    return false;
  },
};

export default electionService;
