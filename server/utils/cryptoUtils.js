import crypto from "crypto";
import config from "../config/index.js";

/**
 * Generate a cryptographically secure random Request ID
 */
export function generateRequestId() {
  return "req_" + crypto.randomBytes(8).toString("hex");
}

/**
 * Generate official non-sensitive vote receipt reference ID
 * Example: CR26-DSA-98F21
 */
export function generateVoteReference(section = "A") {
  const cleanSec = String(section || "A").toUpperCase().replace(/[^A-Z]/g, "") || "A";
  const hex = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `CR26-DS${cleanSec}-${hex}`;
}

/**
 * Generate a privacy-preserving hash of student ID for the ballot ledger.
 * This ensures individual ballots cannot be mapped back to roll numbers without
 * the server salt, preserving vote secrecy.
 */
export function hashStudentIdForBallot(studentId, electionId) {
  const salt = config.appSecret || "viit-ballot-salt";
  return crypto
    .createHmac("sha256", salt)
    .update(`${studentId}:${electionId}`)
    .digest("hex")
    .substring(0, 24);
}

/**
 * Create a signed JWT-like lightweight session token
 */
export function createSessionToken(payload, secret = config.appSecret, expiresInSeconds = 7200) {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const tokenPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode session token
 */
export function verifySessionToken(token, secret = config.appSecret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Generate HMAC signature for Google Apps Script server-to-server requests
 */
export function signGasRequest(body, secret = config.gasSecret) {
  const timestamp = Date.now();
  const payload = JSON.stringify(body);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}:${payload}`)
    .digest("hex");
  return { timestamp, signature, payload };
}
