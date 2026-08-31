/**
 * Input sanitization and validation helpers
 */
export function sanitizeString(val, maxLen = 255) {
  if (typeof val !== "string") return "";
  return val
    .trim()
    .slice(0, maxLen)
    .replace(/[<>]/g, ""); // strip script-like tags
}

export function validateVoteRequest(req, res, next) {
  const { candidateId, electionId, requestId } = req.body || {};

  if (!candidateId || typeof candidateId !== "string") {
    return res.status(400).json({
      success: false,
      code: "INVALID_CANDIDATE",
      message: "Valid candidate selection is required.",
    });
  }

  if (!requestId || typeof requestId !== "string" || requestId.length < 5) {
    return res.status(400).json({
      success: false,
      code: "MISSING_REQUEST_ID",
      message: "A unique client request ID is required for idempotent ballot submission.",
    });
  }

  req.body.candidateId = sanitizeString(candidateId, 100);
  req.body.electionId = sanitizeString(electionId || "CR2026", 50);
  req.body.requestId = sanitizeString(requestId, 100);
  next();
}

export function validateCandidateInput(req, res, next) {
  const { name, section, rollNumber, roll_number, symbol, symbolName, symbol_name, tagline, manifesto } = req.body || {};

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Candidate name must be at least 2 characters.",
    });
  }

  const validSections = ["A", "B", "C", "D"];
  const sec = (section || "A").trim().toUpperCase();
  if (!validSections.includes(sec)) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Candidate section must be one of: A, B, C, D.",
    });
  }

  req.body.name = sanitizeString(name, 100);
  req.body.section = sec;
  req.body.roll_number = sanitizeString(roll_number || rollNumber || "", 30).toUpperCase();
  req.body.symbol = sanitizeString(symbol || "🚀", 10);
  req.body.symbol_name = sanitizeString(symbol_name || symbolName || "Vision", 50);
  req.body.tagline = sanitizeString(tagline || "", 255);
  req.body.manifesto = sanitizeString(manifesto || "", 2000);
  next();
}
