import localStore from "../db/localStore.js";
import supabaseServer from "../db/supabaseClient.js";
import auditService, { AuditActions } from "./auditService.js";
import config from "../config/index.js";
import gasClient from "../db/gasClient.js";

export const ElectionState = {
  UPCOMING: "UPCOMING",
  LIVE: "LIVE",
  PAUSED: "PAUSED",
  CLOSED: "CLOSED",
};

export const ResultsVisibility = {
  HIDDEN: "HIDDEN",
  ADMIN_ONLY: "ADMIN_ONLY",
  LIVE: "LIVE",
};

// Default election shape when nothing exists in DB yet
const DEFAULT_ELECTION = (electionId) => ({
  election_id: electionId,
  id: electionId,
  name: config.institution.electionName,
  status: ElectionState.LIVE,
  results_visibility: ResultsVisibility.LIVE,
  start_time: new Date().toISOString(),
  end_time: null,
});

export const electionService = {
  // ---------------------------------------------------------------------------
  // READ: Supabase-first, local store fallback
  // ---------------------------------------------------------------------------

  async getElection(electionId = "CR2026") {
    if (supabaseServer) {
      try {
        const { data, error } = await supabaseServer
          .from("elections")
          .select("*")
          .eq("id", electionId)
          .maybeSingle();
        if (!error && data) {
          return {
            election_id: data.id,
            id: data.id,
            name: data.name,
            status: data.status,
            results_visibility: data.results_visibility,
            start_time: data.start_time,
            end_time: data.end_time,
          };
        }
      } catch (e) {
        console.warn("[ElectionService] Supabase getElection failed:", e.message);
      }
    }
    return localStore.getElection(electionId) || DEFAULT_ELECTION(electionId);
  },

  async getStatus(electionId = "CR2026") {
    const el = await this.getElection(electionId);
    return el.status || ElectionState.LIVE;
  },

  async isLive(electionId = "CR2026") {
    return (await this.getStatus(electionId)) === ElectionState.LIVE;
  },

  async getPublicConfig(electionId = "CR2026") {
    const el = await this.getElection(electionId);
    return {
      electionId: el.election_id || el.id,
      name: el.name || config.institution.electionName,
      status: el.status || ElectionState.LIVE,
      resultsVisibility: el.results_visibility || ResultsVisibility.LIVE,
      startTime: el.start_time,
      endTime: el.end_time,
      department: config.institution.department,
      institution: config.institution.name,
      sections: config.institution.sections,
      totalExpectedStudents: config.institution.totalExpectedStudents,
      serverTime: new Date().toISOString(),
    };
  },

  // ---------------------------------------------------------------------------
  // WRITE: Upsert to Supabase first, local store as secondary cache
  // ---------------------------------------------------------------------------

  async _upsertElection(electionId, updates) {
    const current = await this.getElection(electionId);
    const merged = { ...current, ...updates, id: electionId };

    if (supabaseServer) {
      try {
        const { data, error } = await supabaseServer
          .from("elections")
          .upsert({
            id: electionId,
            name: merged.name || config.institution.electionName,
            status: merged.status,
            results_visibility: merged.results_visibility,
            start_time: merged.start_time,
            end_time: merged.end_time || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "id" })
          .select()
          .single();

        if (!error && data) {
          // Also update local cache
          localStore.updateElection(electionId, updates);
          return { election_id: data.id, ...data };
        }
        if (error) console.warn("[ElectionService] Supabase upsert error:", error.message);
      } catch (e) {
        console.warn("[ElectionService] Supabase upsert failed:", e.message);
      }
    }

    // Fallback local update only
    return localStore.updateElection(electionId, updates) || merged;
  },

  async startElection(electionId = "CR2026", adminUser = "admin", requestId = "start") {
    const updated = await this._upsertElection(electionId, {
      status: ElectionState.LIVE,
      start_time: new Date().toISOString(),
    });

    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: adminUser,
      action: AuditActions.ELECTION_STARTED,
      status: "SUCCESS",
      metadata: { electionId, status: ElectionState.LIVE },
    });

    if (gasClient.isConfigured()) {
      gasClient.syncElectionStatusToGas(electionId, ElectionState.LIVE).catch(() => {});
    }

    return updated;
  },

  async pauseElection(electionId = "CR2026", adminUser = "admin", requestId = "pause") {
    const updated = await this._upsertElection(electionId, {
      status: ElectionState.PAUSED,
    });

    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: adminUser,
      action: AuditActions.ELECTION_PAUSED,
      status: "SUCCESS",
      metadata: { electionId, status: ElectionState.PAUSED },
    });

    if (gasClient.isConfigured()) {
      gasClient.syncElectionStatusToGas(electionId, ElectionState.PAUSED).catch(() => {});
    }

    return updated;
  },

  async resumeElection(electionId = "CR2026", adminUser = "admin", requestId = "resume") {
    const updated = await this._upsertElection(electionId, {
      status: ElectionState.LIVE,
    });

    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: adminUser,
      action: AuditActions.ELECTION_RESUMED,
      status: "SUCCESS",
      metadata: { electionId, status: ElectionState.LIVE },
    });

    if (gasClient.isConfigured()) {
      gasClient.syncElectionStatusToGas(electionId, ElectionState.LIVE).catch(() => {});
    }

    return updated;
  },

  async closeElection(electionId = "CR2026", adminUser = "admin", requestId = "close") {
    const updated = await this._upsertElection(electionId, {
      status: ElectionState.CLOSED,
      end_time: new Date().toISOString(),
    });

    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: adminUser,
      action: AuditActions.ELECTION_CLOSED,
      status: "SUCCESS",
      metadata: { electionId, status: ElectionState.CLOSED },
    });

    if (gasClient.isConfigured()) {
      gasClient.syncElectionStatusToGas(electionId, ElectionState.CLOSED).catch(() => {});
    }

    return updated;
  },

  async updateResultsVisibility(visibility, electionId = "CR2026", adminUser = "admin", requestId = "vis") {
    if (!Object.values(ResultsVisibility).includes(visibility)) {
      throw new Error(`Invalid results visibility: ${visibility}`);
    }

    const updated = await this._upsertElection(electionId, {
      results_visibility: visibility,
    });

    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: adminUser,
      action: AuditActions.ADMIN_ACTION,
      status: "SUCCESS",
      metadata: { action: "UPDATE_RESULTS_VISIBILITY", visibility },
    });

    return updated;
  },
};

export default electionService;
