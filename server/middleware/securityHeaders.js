import { generateRequestId } from "../utils/cryptoUtils.js";

/**
 * Security headers middleware
 */
export function securityHeaders(req, res, next) {
  // Attach unique Request ID to each incoming request
  req.id = req.headers["x-request-id"] || generateRequestId();
  res.setHeader("X-Request-Id", req.id);

  // Hardening headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  next();
}

/**
 * Global Error Handler
 */
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.message || "An unexpected server error occurred.";

  if (status >= 500) {
    console.error(`[CR_ERROR] ${req.method} ${req.originalUrl} [${req.id}]:`, err);
  }

  res.status(status).json({
    success: false,
    code,
    message,
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });
}
