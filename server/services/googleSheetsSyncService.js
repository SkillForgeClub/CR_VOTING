const fetch = globalThis.fetch;

export function parseGoogleSheetCsv(csvText) {
  if (!csvText || typeof csvText !== "string") {
    return { error: "INVALID_INPUT", message: "CSV text is empty or invalid." };
  }

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { error: "NO_DATA", message: "CSV file must contain a header and at least one student row." };
  }

  // Helper to split CSV row respecting quotes
  const parseRow = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ""));
    return result;
  };

  const header = parseRow(lines[0]).map((h) => h.toLowerCase().trim());
  const rollIdx = header.findIndex((h) => h.includes("roll"));
  const nameIdx = header.findIndex((h) => h.includes("name"));
  const secIdx = header.findIndex((h) => h.includes("sec"));
  const emailIdx = header.findIndex((h) => h.includes("email"));
  const eligIdx = header.findIndex((h) => h.includes("elig"));

  if (rollIdx === -1 || nameIdx === -1) {
    return { error: "MISSING_COLUMNS", message: "CSV must contain 'roll_number' (or Roll) and 'name' columns." };
  }

  const parsedStudents = [];
  const invalidRows = [];
  const seenRolls = new Set();
  const seenEmails = new Set();
  const duplicateRows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    const rawRoll = cols[rollIdx] || "";
    const rawName = cols[nameIdx] || "";
    const rawSection = secIdx >= 0 ? cols[secIdx] : "A";
    const rawEmail = emailIdx >= 0 ? cols[emailIdx] : "";
    const rawEligible = eligIdx >= 0 ? cols[eligIdx] : "true";

    const roll = rawRoll.trim().toUpperCase();
    const name = rawName.trim();
    let section = (rawSection || "A").trim().toUpperCase();
    if (!["A", "B", "C", "D"].includes(section)) {
      section = "INVALID";
    }

    if (!roll || !name || section === "INVALID") {
      invalidRows.push({ rowNumber: i + 1, roll, name, section, reason: "Missing roll/name or invalid section" });
      continue;
    }

    if (seenRolls.has(roll)) {
      duplicateRows.push({ rowNumber: i + 1, roll, name, reason: "Duplicate roll number in sheet" });
      continue;
    }

    seenRolls.add(roll);

    let email = rawEmail.trim().toLowerCase();
    if (!email) {
      email = `${roll.toLowerCase()}@viit.ac.in`;
    }

    let eligible = true;
    if (rawEligible.toLowerCase() === "false" || rawEligible === "0" || rawEligible.toLowerCase() === "no") {
      eligible = false;
    }

    parsedStudents.push({
      roll_number: roll,
      name,
      section,
      email,
      eligible,
    });
  }

  return {
    success: true,
    totalRows: lines.length - 1,
    parsedStudents,
    invalidRows,
    duplicateRows,
  };
}

export const googleSheetsSyncService = {
  /**
   * Fetch sheet contents from public URL or Apps Script URL
   */
  async fetchRosterFromUrl(sheetUrl) {
    if (!sheetUrl) {
      throw new Error("Google Sheet URL or web app URL is required.");
    }

    let fetchUrl = sheetUrl;

    // ── Convert any known Google Sheets URL format to a public CSV export ──

    // 1. pubhtml → pub?output=csv
    if (sheetUrl.includes("/pubhtml")) {
      fetchUrl = sheetUrl.replace(/\/pubhtml(\?.*)?$/, "/pub?output=csv");
    }
    // 2. Standard edit URL → export CSV (requires sheet to be publicly shared)
    else if (sheetUrl.includes("docs.google.com/spreadsheets/d/") && !sheetUrl.includes("pub?output=csv") && !sheetUrl.includes("/export")) {
      const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        const gidMatch = sheetUrl.match(/[?&]gid=(\d+)/);
        const gid = gidMatch ? `&gid=${gidMatch[1]}` : "";
        fetchUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/pub?output=csv${gid}`;
      }
    }

    let text;
    let contentType;
    try {
      const res = await fetch(fetchUrl, {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; VIIT-ElectionSync/1.0)",
          "Accept": "text/csv,text/plain,*/*",
        },
      });

      if (!res.ok) {
        throw new Error(
          `Google Sheets returned HTTP ${res.status} (${res.statusText}). ` +
          `Make sure the sheet is shared publicly ("Anyone with the link → Viewer") and published via File → Share → Publish to web → CSV.`
        );
      }

      contentType = res.headers.get("content-type") || "";
      text = await res.text();
    } catch (err) {
      if (err.message && err.message.startsWith("Google Sheets returned")) throw err;
      throw new Error(
        `Network error fetching Google Sheet: ${err.message}. ` +
        `Please ensure the sheet is published as CSV via File → Share → Publish to web.`
      );
    }

    // Detect if Google returned an HTML login/redirect page instead of CSV
    if (
      contentType.includes("text/html") ||
      text.trim().startsWith("<!DOCTYPE") ||
      text.trim().startsWith("<html")
    ) {
      throw new Error(
        "Google returned an HTML page instead of CSV data. " +
        "The sheet must be publicly published: open the sheet → File → Share → Publish to web → select 'Comma-separated values (.csv)' → Publish. " +
        "Then use the published CSV link here."
      );
    }

    // If response is JSON (Apps Script Web App output format)
    if (contentType.includes("application/json") || text.trim().startsWith("{")) {
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json.students)) {
          return {
            success: true,
            totalRows: json.students.length,
            parsedStudents: json.students.map((s) => ({
              roll_number: (s.roll_number || s.rollNumber || "").trim().toUpperCase(),
              name: (s.name || "").trim(),
              section: (s.section || "A").trim().toUpperCase(),
              email: (s.email || `${(s.roll_number || s.rollNumber || "").toLowerCase()}@viit.ac.in`),
              eligible: s.eligible !== false,
            })),
            invalidRows: [],
            duplicateRows: [],
          };
        }
      } catch (e) {}
    }

    // Default: parse as CSV
    return parseGoogleSheetCsv(text);
  },


  /**
   * Generate Synchronization Preview against current Supabase/authoritative roster
   */
  generatePreview(parsedResult, existingStudents = []) {
    if (!parsedResult || !parsedResult.success) {
      return parsedResult;
    }

    const incoming = parsedResult.parsedStudents;
    const existingMap = new Map();
    existingStudents.forEach((s) => {
      existingMap.set(s.roll_number.toUpperCase(), s);
    });

    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let invalidCount = parsedResult.invalidRows.length;
    let duplicateCount = parsedResult.duplicateRows.length;

    const syncDetails = incoming.map((st) => {
      const existing = existingMap.get(st.roll_number);
      if (!existing) {
        newCount++;
        return { ...st, status: "NEW", has_voted: false };
      }

      // Check if fields changed
      const isNameDiff = existing.name !== st.name;
      const isSecDiff = (existing.section || "").toUpperCase() !== st.section;
      const isEmailDiff = (existing.email || "").toLowerCase() !== st.email.toLowerCase();
      const isEligDiff = existing.eligible !== st.eligible;

      if (isNameDiff || isSecDiff || isEmailDiff || isEligDiff) {
        updatedCount++;
        return {
          ...st,
          status: "UPDATED",
          has_voted: existing.voted || existing.has_voted || false,
          voted_at: existing.voted_at,
          changes: {
            name: isNameDiff ? { old: existing.name, new: st.name } : null,
            section: isSecDiff ? { old: existing.section, new: st.section } : null,
            eligible: isEligDiff ? { old: existing.eligible, new: st.eligible } : null,
          },
        };
      }

      unchangedCount++;
      return {
        ...st,
        status: "UNCHANGED",
        has_voted: existing.voted || existing.has_voted || false,
        voted_at: existing.voted_at,
      };
    });

    // Detect removed/deactivated students
    const incomingRolls = new Set(incoming.map((s) => s.roll_number));
    const deactivatedStudents = existingStudents
      .filter((s) => !incomingRolls.has(s.roll_number.toUpperCase()))
      .map((s) => ({
        roll_number: s.roll_number,
        name: s.name,
        section: s.section,
        status: "DEACTIVATED",
        has_voted: s.voted || s.has_voted || false,
      }));

    return {
      success: true,
      summary: {
        totalFound: parsedResult.totalRows,
        validStudents: incoming.length,
        newCount,
        updatedCount,
        unchangedCount,
        deactivatedCount: deactivatedStudents.length,
        invalidCount,
        duplicateCount,
      },
      previewList: [...syncDetails, ...deactivatedStudents],
      invalidRows: parsedResult.invalidRows,
      duplicateRows: parsedResult.duplicateRows,
    };
  },
};

export default googleSheetsSyncService;
