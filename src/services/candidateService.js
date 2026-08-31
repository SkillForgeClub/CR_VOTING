import { DEFAULT_CANDIDATES } from "./candidateDefaults.js";

export { DEFAULT_CANDIDATES };

export const candidateService = {
  _cache: [],

  async fetchCandidates(section = "ALL") {
    try {
      const url = section && section !== "ALL" ? `/api/v1/candidates?section=${section}` : "/api/v1/candidates";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.candidates)) {
          if (section === "ALL" || !section) {
            this._cache = data.candidates;
          }
          return data.candidates;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch candidates from server:", e);
    }
    return this.getCandidatesBySection(section);
  },

  getAllCandidates() {
    return this._cache.length > 0 ? this._cache : DEFAULT_CANDIDATES;
  },

  getCandidatesBySection(section = "A") {
    const all = this.getAllCandidates();
    return all.filter((c) => (c.section || "A").toUpperCase() === section.toUpperCase() && c.isActive !== false);
  },

  getCandidateById(id) {
    const all = this.getAllCandidates();
    return all.find((c) => String(c.id || c.candidate_id) === String(id)) || null;
  },

  // Admin APIs
  async addCandidate(candidateData, adminToken = "") {
    const token = adminToken || sessionStorage.getItem("viit_admin_token") || "";
    const res = await fetch("/api/v1/admin/candidates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(candidateData),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to create candidate.");
    }
    await this.fetchCandidates();
    return data.candidate;
  },

  async toggleCandidateActive(id, adminToken = "") {
    const token = adminToken || sessionStorage.getItem("viit_admin_token") || "";
    const res = await fetch(`/api/v1/admin/candidates/${id}/toggle`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to toggle candidate status.");
    }
    await this.fetchCandidates();
    return data.candidate;
  },

  async deleteCandidate(id, adminToken = "") {
    const token = adminToken || sessionStorage.getItem("viit_admin_token") || "";
    const res = await fetch(`/api/v1/admin/candidates/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to delete candidate.");
    }
    await this.fetchCandidates();
    return true;
  },
};

export default candidateService;
