import localStore from "../db/localStore.js";
import databaseAdapter from "../db/databaseAdapter.js";
import supabaseServer from "../db/supabaseClient.js";
import auditService, { AuditActions } from "./auditService.js";
import gasClient from "../db/gasClient.js";

export const candidateService = {
  // ---------------------------------------------------------------------------
  // READ: via databaseAdapter (already Supabase-backed)
  // ---------------------------------------------------------------------------

  async getAllCandidates(electionId = "CR2026", includeInactive = false) {
    const candidates = await databaseAdapter.getCandidates(electionId);
    if (includeInactive) return candidates;
    return candidates.filter((c) => c.active !== false);
  },

  async getCandidatesBySection(section = "A", electionId = "CR2026") {
    const candidates = await this.getAllCandidates(electionId, false);
    return candidates.filter((c) => (c.section || "").toUpperCase() === section.toUpperCase());
  },

  // getCandidateById: Supabase first, local store fallback
  async getCandidateById(candidateId) {
    if (!candidateId) return null;
    if (supabaseServer) {
      try {
        const { data, error } = await supabaseServer
          .from("candidates")
          .select("*")
          .eq("id", candidateId)
          .maybeSingle();
        if (!error && data) {
          return {
            id: data.id,
            candidate_id: data.id,
            election_id: data.election_id,
            name: data.name,
            roll_number: data.roll_number,
            rollNumber: data.roll_number,
            section: data.section,
            symbol: data.symbol,
            symbol_name: data.symbol_name,
            symbolName: data.symbol_name,
            tagline: data.tagline,
            manifesto: data.manifesto,
            photo_url: data.photo_url || "",
            active: data.active !== false,
          };
        }
      } catch (e) {
        console.warn("[CandidateService] Supabase getCandidateById failed:", e.message);
      }
    }
    return localStore.getCandidateById(candidateId) || null;
  },

  async validateCandidateForVote(candidateId, studentSection, electionId = "CR2026") {
    const cand = await this.getCandidateById(candidateId);
    if (!cand) {
      return { valid: false, code: "INVALID_CANDIDATE", message: "Candidate does not exist." };
    }
    if (cand.election_id && cand.election_id !== electionId) {
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

  // ---------------------------------------------------------------------------
  // CREATE: Supabase-first
  // ---------------------------------------------------------------------------

  async createCandidate(candidateData, adminUser = "admin", requestId = "cand-create") {
    if (!candidateData.name || !candidateData.name.trim()) {
      throw new Error("Candidate name is required.");
    }

    const cleanRoll = (candidateData.roll_number || candidateData.rollNumber || "").trim().toUpperCase();
    const electionId = candidateData.election_id || "CR2026";

    // Check if candidate with same roll number already exists
    if (cleanRoll) {
      const allCands = await databaseAdapter.getCandidates(electionId);
      const existing = allCands.find((c) => (c.roll_number || c.rollNumber || "").toUpperCase() === cleanRoll);

      if (existing) {
        return this.updateCandidate(
          existing.candidate_id || existing.id,
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

    const candidateId = `cand-${Date.now()}`;
    const newCandidate = {
      id: candidateId,
      election_id: electionId,
      name: candidateData.name.trim(),
      roll_number: cleanRoll,
      section: (candidateData.section || "A").toUpperCase(),
      symbol: candidateData.symbol || "🚀",
      symbol_name: candidateData.symbol_name || candidateData.symbolName || "Visionary",
      tagline: candidateData.tagline || "",
      photo_url: candidateData.photo_url || candidateData.photoUrl || "",
      manifesto: candidateData.manifesto || "",
      active: true,
    };

    // Primary: Insert into Supabase
    if (supabaseServer) {
      try {
        const { data, error } = await supabaseServer
          .from("candidates")
          .insert(newCandidate)
          .select()
          .single();
        if (error) console.warn("[CandidateService] Supabase insert error:", error.message);
        else if (data) {
          // Return normalized shape with candidate_id
          const created = { ...data, candidate_id: data.id, rollNumber: data.roll_number, symbolName: data.symbol_name };

          auditService.log({
            requestId,
            actorType: "ADMIN",
            actorId: adminUser,
            action: AuditActions.CANDIDATE_CREATED,
            status: "SUCCESS",
            metadata: { candidateId: data.id, name: data.name, section: data.section },
          });

          if (gasClient.isConfigured()) gasClient.syncCandidateToGas(created).catch(() => {});
          return created;
        }
      } catch (e) {
        console.warn("[CandidateService] Supabase insert exception:", e.message);
      }
    }

    // Fallback: local store
    const created = localStore.addCandidate({
      ...newCandidate,
      avatar_bg: candidateData.avatar_bg || candidateData.avatarBg || "linear-gradient(135deg, #1e3a8a, #3b82f6)",
      key_points: candidateData.key_points || candidateData.keyPoints || [],
    });

    auditService.log({
      requestId,
      actorType: "ADMIN",
      actorId: adminUser,
      action: AuditActions.CANDIDATE_CREATED,
      status: "SUCCESS",
      metadata: { candidateId: created.candidate_id, name: created.name, section: created.section },
    });

    if (gasClient.isConfigured()) gasClient.syncCandidateToGas(created).catch(() => {});
    return created;
  },

  // ---------------------------------------------------------------------------
  // UPDATE: Supabase-first
  // ---------------------------------------------------------------------------

  async updateCandidate(candidateId, updates, adminUser = "admin", requestId = "cand-update") {
    if (supabaseServer) {
      try {
        const supabaseUpdates = {};
        if (updates.name !== undefined) supabaseUpdates.name = updates.name;
        if (updates.section !== undefined) supabaseUpdates.section = updates.section;
        if (updates.symbol !== undefined) supabaseUpdates.symbol = updates.symbol;
        if (updates.symbol_name !== undefined) supabaseUpdates.symbol_name = updates.symbol_name;
        if (updates.symbolName !== undefined) supabaseUpdates.symbol_name = updates.symbolName;
        if (updates.tagline !== undefined) supabaseUpdates.tagline = updates.tagline;
        if (updates.manifesto !== undefined) supabaseUpdates.manifesto = updates.manifesto;
        if (updates.active !== undefined) supabaseUpdates.active = updates.active;
        if (updates.photo_url !== undefined) supabaseUpdates.photo_url = updates.photo_url;
        supabaseUpdates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseServer
          .from("candidates")
          .update(supabaseUpdates)
          .eq("id", candidateId)
          .select()
          .single();

        if (error) console.warn("[CandidateService] Supabase update error:", error.message);
        else if (data) {
          const updated = { ...data, candidate_id: data.id, rollNumber: data.roll_number, symbolName: data.symbol_name };

          auditService.log({
            requestId, actorType: "ADMIN", actorId: adminUser,
            action: AuditActions.CANDIDATE_UPDATED, status: "SUCCESS",
            metadata: { candidateId, updates: Object.keys(updates) },
          });

          if (gasClient.isConfigured()) gasClient.syncCandidateToGas(updated).catch(() => {});
          return updated;
        }
      } catch (e) {
        console.warn("[CandidateService] Supabase update exception:", e.message);
      }
    }

    // Fallback: local store
    const updated = localStore.updateCandidate(candidateId, updates);
    if (!updated) throw new Error(`Candidate with ID ${candidateId} not found.`);

    auditService.log({
      requestId, actorType: "ADMIN", actorId: adminUser,
      action: AuditActions.CANDIDATE_UPDATED, status: "SUCCESS",
      metadata: { candidateId, updates: Object.keys(updates) },
    });

    if (gasClient.isConfigured()) gasClient.syncCandidateToGas(updated).catch(() => {});
    return updated;
  },

  // ---------------------------------------------------------------------------
  // TOGGLE ACTIVE: Supabase-first
  // ---------------------------------------------------------------------------

  async toggleCandidateActive(candidateId, adminUser = "admin", requestId = "cand-toggle") {
    const cand = await this.getCandidateById(candidateId);
    if (!cand) throw new Error("Candidate not found.");

    const newActiveState = !cand.active;
    return this.updateCandidate(candidateId, { active: newActiveState }, adminUser, requestId);
  },

  // ---------------------------------------------------------------------------
  // DELETE: Supabase-first
  // ---------------------------------------------------------------------------

  async deleteCandidate(candidateId, adminUser = "admin", requestId = "cand-delete") {
    const cand = await this.getCandidateById(candidateId);

    if (supabaseServer) {
      try {
        const { error } = await supabaseServer
          .from("candidates")
          .delete()
          .eq("id", candidateId);

        if (error) console.warn("[CandidateService] Supabase delete error:", error.message);
        else {
          if (cand) {
            auditService.log({
              requestId, actorType: "ADMIN", actorId: adminUser,
              action: AuditActions.ADMIN_ACTION, status: "SUCCESS",
              metadata: { action: "DELETE_CANDIDATE", candidateId, name: cand.name },
            });
          }
          localStore.deleteCandidate(candidateId);
          return true;
        }
      } catch (e) {
        console.warn("[CandidateService] Supabase delete exception:", e.message);
      }
    }

    // Fallback: local store
    const success = localStore.deleteCandidate(candidateId);
    if (success && cand) {
      auditService.log({
        requestId, actorType: "ADMIN", actorId: adminUser,
        action: AuditActions.ADMIN_ACTION, status: "SUCCESS",
        metadata: { action: "DELETE_CANDIDATE", candidateId, name: cand.name },
      });
    }
    return success;
  },
};

export default candidateService;
