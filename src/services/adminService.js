import authService from "./authService";

export const adminService = {
  getAuthHeaders() {
    const token = authService.getAdminToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  },

  async fetchDashboard() {
    try {
      const res = await fetch("/api/v1/admin/dashboard", {
        headers: this.getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn("Failed to fetch admin dashboard from server:", e);
    }
    return null;
  },

  async fetchAuditLogs(limit = 100) {
    try {
      const res = await fetch(`/api/v1/admin/audit-logs?limit=${limit}`, {
        headers: this.getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.logs || [];
      }
    } catch (e) {}
    return [];
  },

  async fetchStudents({ query = "", section = "ALL", page = 1, limit = 50 }) {
    try {
      const url = `/api/v1/admin/students?query=${encodeURIComponent(query)}&section=${section}&page=${page}&limit=${limit}`;
      const res = await fetch(url, {
        headers: this.getAuthHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return { success: false, students: [] };
  },

  async importStudentsCsv(csvData) {
    const res = await fetch("/api/v1/admin/students/import", {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ csvData }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to import student roster CSV.");
    }
    return data;
  },

  async generateSyncPreview({ sheetUrl, csvData }) {
    const res = await fetch("/api/v1/admin/roster/sync-preview", {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ sheetUrl, csvData }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to generate roster sync preview.");
    }
    return data;
  },

  async confirmRosterSync(studentsList) {
    const res = await fetch("/api/v1/admin/roster/sync-confirm", {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ studentsList }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to confirm student roster sync.");
    }
    return data;
  },

  async resetTestVotes() {
    const res = await fetch("/api/v1/admin/reset-votes", {
      method: "POST",
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to reset test ballots.");
    }
    return data;
  },

  async fetchDatabaseStatus() {
    try {
      const res = await fetch("/api/v1/admin/database-status", {
        headers: this.getAuthHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return { success: false, database: null };
  },

  exportVotesCsv() {
    const token = authService.getAdminToken();
    window.location.href = `/api/v1/admin/export/csv?token=${token}`;
  },
};

export default adminService;
