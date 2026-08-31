import localStore from "../db/localStore.js";
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

export const electionService = {
  getElection(electionId = "CR2026") {
    const election = localStore.getElection(electionId);
    return election || {
      election_id: "CR2026",
      name: config.institution.electionName,
      status: ElectionState.LIVE,
      results_visibility: ResultsVisibility.LIVE,
      start_time: new Date().toISOString(),
      end_time: null,
    };
  },

  getStatus(electionId = "CR2026") {
    const el = this.getElection(electionId);
    return el.status || ElectionState.LIVE;
  },

  isLive(electionId = "CR2026") {
    return this.getStatus(electionId) === ElectionState.LIVE;
  },

  getPublicConfig(electionId = "CR2026") {
    const el = this.getElection(electionId);
    return {
      electionId: el.election_id,
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

  startElection(electionId = "CR2026", adminUser = "admin", requestId = "start") {
    const updated = localStore.updateElection(electionId, {
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

  pauseElection(electionId = "CR2026", adminUser = "admin", requestId = "pause") {
    const updated = localStore.updateElectionStatus(electionId, ElectionState.PAUSED);

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

  resumeElection(electionId = "CR2026", adminUser = "admin", requestId = "resume") {
    const updated = localStore.updateElectionStatus(electionId, ElectionState.LIVE);

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

  closeElection(electionId = "CR2026", adminUser = "admin", requestId = "close") {
    const updated = localStore.updateElection(electionId, {
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

  updateResultsVisibility(visibility, electionId = "CR2026", adminUser = "admin", requestId = "vis") {
    if (!Object.values(ResultsVisibility).includes(visibility)) {
      throw new Error(`Invalid results visibility: ${visibility}`);
    }

    const updated = localStore.updateElection(electionId, {
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
