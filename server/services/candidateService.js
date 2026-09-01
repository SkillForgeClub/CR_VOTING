import localStore from "../db/localStore.js";
import databaseAdapter from "../db/databaseAdapter.js";
import auditService, { AuditActions } from "./auditService.js";
import gasClient from "../db/gasClient.js";

export const candidateService = {
  getAllCandidates(electionId = "CR2026", includeInactive = false) {
    const candidates = localStore.getAllCandidates(electionId);
    if (includeInactive) return candidates;
    return candidates.filter((c) => c.active !== false);
  },

  getCandidatesBySection(section = "A", electionId = "CR2026") {
    return localStore.getCandidatesBySection(section, electionId);
  },

  getCandidateById(candidateId) {
    return localStore.getCandidateById(candidateId);
  },

  validateCandidateForVote(candidateId, studentSection, electionId = "CR2026") {
    const cand = this.getCandidateById(candidateId);
    if (!cand) {
      return { valid: false, code: "INVALID_CANDIDATE", message: "Candidate does not exist." };
    }
    if (cand.election_id !== electionId) {
      return { valid: false, code: "INVALID_ELECTION", message: "Candidate is not part of the active election." };
    }
    if (cand.active === false) {
      return { valid: false, code: "INACTIVE_CANDIDATE", message: "Candidate is currently inactive or disqualified." };
    }
    if (cand.section.toUpperCase() !== studentSection.toUpperCase()) {
      return {
        valid: false,
        code: "SECTION_MISMATCH",
        message: `Voter section (${studentSection}) does not match candidate section (${cand.section}).`,
      };
    }
    return { valid: true, candidate: cand };
  },

  async createCandidate(candidateData, adminUser = "admin", requestId = "cand-create") {
    if (!candidateData.name || !candidateData.name.trim()) {
      throw new Error("Candidate name is required.");
    }

    const cleanRoll = (candidateData.roll_number || candidateData.rollNumber || "").trim().toUpperCase();
    const electionId = candidateData.election_id || "CR2026";
    
    // Check if candidate with same roll number already exists
    if (cleanRoll) {
      const existing = localStore
        .getAllCandidates(electionId)
        .find((c) => (c.roll_number || "").toUpperCase() === cleanRoll);
      
      if (existing) {
        return this.updateCandidate(
          existing.candidate_id,
          {
            name: candidateData.name.trim(),
            section: (candidateData.section || existing.section).toUpperCase(),
            symbol: candidateData.symbol || existing.symbol,
            symbol_name: candidateData.symbol_name || candidateData.symbolName || existing.symbol_name,
            tagline: candidateData.tagline || existing.tagline,
            manifesto: candidateData.manifesto || existing.manifesto,
            active: true,
          },
          adminUser,
          requestId
        );
      }
    }

    const created = localStore.addCandidate({
      name: candidateData.name.trim(),
      roll_number: cleanRoll,
      section: (candidateData.section || "A").toUpperCase(),
      election_id: electionId,
      symbol: candidateData.symbol || "🚀",
      symbol_name: candidateData.symbol_name || candidateData.symbolName || "Visionary",
      tagline: candidateData.tagline || "",
      avatar_bg: candidateData.avatar_bg || candidateData.avatarBg || "linear-gradient(135deg, #1e3a8a, #3b82f6)",
      photo_url: candidateData.photo_url || candidateData.photoUrl || "",
      manifesto: candidateData.manifesto || "",
      key_points: candidateData.key_points || candidateData.keyPoints || [],
      active: true,
    });

    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: adminUser,
      action: AuditActions.CANDIDATE_CREATED,
      status: "SUCCESS",
      metadata: { candidateId: created.candidate_id, name: created.name, section: created.section },
    });

    if (gasClient.isConfigured()) {
      gasClient.syncCandidateToGas(created).catch(() => {});
    }

    try {
      await databaseAdapter.syncCandidateToSupabase(created);
    } catch (e) {
      console.warn("[CandidateService] Supabase sync warning:", e.message);
    }

    return created;
  },

  async updateCandidate(candidateId, updates, adminUser = "admin", requestId = "cand-update") {
    const updated = localStore.updateCandidate(candidateId, updates);
    if (!updated) {
      throw new Error(`Candidate with ID ${candidateId} not found.`);
    }

    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: adminUser,
      action: AuditActions.CANDIDATE_UPDATED,
      status: "SUCCESS",
      metadata: { candidateId, updates: Object.keys(updates) },
    });

    if (gasClient.isConfigured()) {
      gasClient.syncCandidateToGas(updated).catch(() => {});
    }

    try {
      await databaseAdapter.syncCandidateToSupabase(updated);
    } catch (e) {
      console.warn("[CandidateService] Supabase sync warning:", e.message);
    }

    return updated;
  },

  async toggleCandidateActive(candidateId, adminUser = "admin", requestId = "cand-toggle") {
    const cand = this.getCandidateById(candidateId);
    if (!cand) throw new Error("Candidate not found.");

    const newActiveState = !cand.active;
    const updated = localStore.updateCandidate(candidateId, { active: newActiveState });

    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: adminUser,
      action: newActiveState ? AuditActions.CANDIDATE_UPDATED : AuditActions.CANDIDATE_DEACTIVATED,
      status: "SUCCESS",
      metadata: { candidateId, active: newActiveState },
    });

    if (updated) {
      try {
        await databaseAdapter.syncCandidateToSupabase(updated);
      } catch (e) {
        console.warn("[CandidateService] Supabase sync warning:", e.message);
      }
    }

    return updated;
  },

  async deleteCandidate(candidateId, adminUser = "admin", requestId = "cand-delete") {
    const cand = this.getCandidateById(candidateId);
    const success = localStore.deleteCandidate(candidateId);

    if (success && cand) {
      auditService.log({
        requestId,
        actorType: "ADMIN",
        actorId: adminUser,
        action: AuditActions.ADMIN_ACTION,
        status: "SUCCESS",
        metadata: { action: "DELETE_CANDIDATE", candidateId, name: cand.name },
      });

      try {
        await databaseAdapter.deleteCandidateFromSupabase(candidateId);
      } catch (e) {
        console.warn("[CandidateService] Supabase delete warning:", e.message);
      }
    }

    return success;
  },
};

export default candidateService;
