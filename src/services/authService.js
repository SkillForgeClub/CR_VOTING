/**
 * Authentication Service for Student Verification & Administrator Access
 * Communicates with authoritative Node.js backend
 */
const STUDENT_TOKEN_KEY = "viit_student_token";
const STUDENT_DATA_KEY = "viit_student_data";
const ADMIN_TOKEN_KEY = "viit_admin_token";
const ADMIN_DATA_KEY = "viit_admin_data";

export const authService = {
  // Student Session Management
  setStudentSession(token, studentData) {
    if (token) sessionStorage.setItem(STUDENT_TOKEN_KEY, token);
    if (studentData) sessionStorage.setItem(STUDENT_DATA_KEY, JSON.stringify(studentData));
  },

  getStudentToken() {
    return sessionStorage.getItem(STUDENT_TOKEN_KEY) || "";
  },

  getStudentSession() {
    const raw = sessionStorage.getItem(STUDENT_DATA_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  clearStudentSession() {
    sessionStorage.removeItem(STUDENT_TOKEN_KEY);
    sessionStorage.removeItem(STUDENT_DATA_KEY);
    sessionStorage.removeItem("studentDetails");
    sessionStorage.removeItem("selectedCandidate");
  },

  /**
   * Authenticate student with backend
   */
  async studentLogin({ rollNumber, name, section }) {
    const res = await fetch("/api/v1/auth/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollNumber, name, section }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to verify student credentials.");
    }

    this.setStudentSession(data.token, data.student);
    return data;
  },

  // Admin Session Management
  setAdminSession(token, adminData) {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    if (adminData) sessionStorage.setItem(ADMIN_DATA_KEY, JSON.stringify(adminData));
  },

  getAdminToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
  },

  getAdminSession() {
    const raw = sessionStorage.getItem(ADMIN_DATA_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  isAdminAuthenticated() {
    return Boolean(this.getAdminToken());
  },

  async adminLogin(username, password) {
    try {
      const res = await fetch("/api/v1/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.message || "Invalid administrator credentials." };
      }

      this.setAdminSession(data.token, data.admin);
      return { success: true, admin: data.admin, token: data.token };
    } catch (err) {
      return { success: false, message: err.message || "Network error while authenticating." };
    }
  },

  async adminLogout() {
    const token = this.getAdminToken();
    try {
      if (token) {
        fetch("/api/v1/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } catch (e) {}
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_DATA_KEY);
  },
};

export default authService;
