import config from "../config/index.js";
import { signGasRequest } from "../utils/cryptoUtils.js";
import localStore from "./localStore.js";

/**
 * Google Apps Script Web App Client
 * Handles authenticated server-to-server communication with Google Sheets
 */
export class GasClient {
  constructor() {
    this.gasUrl = config.gasUrl;
    this.gasSecret = config.gasSecret;
  }

  isConfigured() {
    return Boolean(this.gasUrl && this.gasUrl.startsWith("https://script.google.com"));
  }

  async execute(action, payload = {}) {
    if (!this.isConfigured()) {
      // Return null to signify fallback to local transactional store
      return null;
    }

    try {
      const signed = signGasRequest({ action, payload, electionId: config.institution.electionId }, this.gasSecret);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(this.gasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signed.signature,
          "X-Timestamp": String(signed.timestamp),
        },
        body: JSON.stringify({
          action,
          payload,
          timestamp: signed.timestamp,
          signature: signed.signature,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Google Apps Script returned HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.warn(`[GasClient] Apps Script sync failed for action "${action}":`, err.message);
      // Let local store handle as fallback
      return null;
    }
  }

  async syncVoteToGas(voteData) {
    if (!this.isConfigured()) return null;
    return this.execute("RECORD_VOTE", voteData);
  }

  async syncElectionStatusToGas(electionId, status) {
    if (!this.isConfigured()) return null;
    return this.execute("UPDATE_ELECTION_STATUS", { electionId, status });
  }

  async syncCandidateToGas(candidate) {
    if (!this.isConfigured()) return null;
    return this.execute("UPSERT_CANDIDATE", { candidate });
  }
}

export const gasClient = new GasClient();
export default gasClient;
