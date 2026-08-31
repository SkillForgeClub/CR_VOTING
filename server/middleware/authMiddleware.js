import authService from "../services/authService.js";

function extractBearerToken(req) {
  const authHeader = req.headers["authorization"] || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  if (req.headers["x-access-token"]) {
    return req.headers["x-access-token"];
  }
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
}

/**
 * Require valid Student Token
 */
export function requireStudentAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      message: "Student authentication session is required to proceed.",
    });
  }

  const payload = authService.verifyToken(token, false);
  if (!payload || payload.role !== "STUDENT") {
    return res.status(401).json({
      success: false,
      code: "AUTH_INVALID",
      message: "Student session token is expired or invalid. Please re-authenticate.",
    });
  }

  req.student = payload;
  next();
}

/**
 * Require valid Administrator Token
 */
export function requireAdminAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      code: "ADMIN_AUTH_REQUIRED",
      message: "Administrator credentials required for this action.",
    });
  }

  const payload = authService.verifyToken(token, true);
  if (!payload || !payload.role) {
    return res.status(401).json({
      success: false,
      code: "ADMIN_AUTH_INVALID",
      message: "Administrator session has expired or is invalid.",
    });
  }

  req.admin = payload;
  next();
}

/**
 * Enforce role-based access control (RBAC)
 */
export function requireAdminRole(allowedRoles = ["SUPER_ADMIN"]) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        code: "ADMIN_AUTH_REQUIRED",
        message: "Administrator authentication required.",
      });
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: `Your administrator role (${req.admin.role}) does not have permission for this operation. Required: ${allowedRoles.join(
          ", "
        )}.`,
      });
    }

    next();
  };
}
