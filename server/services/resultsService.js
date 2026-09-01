import localStore from "../db/localStore.js";
import databaseAdapter from "../db/databaseAdapter.js";
import supabaseServer from "../db/supabaseClient.js";
import candidateService from "./candidateService.js";
import electionService, { ResultsVisibility } from "./electionService.js";
import config from "../config/index.js";

export const resultsService = {
  async getResults(electionId = "CR2026", userRole = null) {
    const election = electionService.getElection(electionId);
    const visibility = election.results_visibility || ResultsVisibility.LIVE;

    const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ELECTION_ADMIN" || userRole === "OBSERVER";

    // Privacy & Visibility enforcement
    if (visibility === ResultsVisibility.HIDDEN && !isAdmin) {
      return {
        visibility: ResultsVisibility.HIDDEN,
        status: election.status,
        message: "Election results are currently sealed and will be published upon official conclusion.",
      };
    }

    if (visibility === ResultsVisibility.ADMIN_ONLY && !isAdmin) {
      return {
        visibility: ResultsVisibility.ADMIN_ONLY,
        status: election.status,
        message: "Election results are restricted to authorized scrutiny officers.",
      };
    }

    const [allStudents, rawCandidates] = await Promise.all([
      databaseAdapter.getAllStudents(),
      databaseAdapter.getCandidates(electionId),
    ]);
    
    // Deduplicate candidates by roll_number / id, keeping only active candidates
    const candidateMap = new Map();
    for (const cand of rawCandidates) {
      if (cand.active === false) continue;
      const key = (cand.roll_number || cand.name).toUpperCase();
      if (!candidateMap.has(key)) {
        candidateMap.set(key, cand);
      }
    }
    const allCandidates = Array.from(candidateMap.values());

    // Fetch votes from Supabase (authoritative) — local store resets on server restart
    let votes = [];
    if (databaseAdapter.isSupabaseActive() && supabaseServer) {
      try {
        const { data: sbVotes } = await supabaseServer
          .from("votes")
          .select("id, student_id, candidate_id, section, vote_reference, created_at, request_id")
          .eq("election_id", electionId);
        if (sbVotes && sbVotes.length > 0) {
          votes = sbVotes.map(v => ({
            vote_id: v.id,
            student_id: v.student_id,
            candidate_id: v.candidate_id,
            section: v.section,
            ref_id: v.vote_reference,
            timestamp: v.created_at,
            request_id: v.request_id,
          }));
        }
      } catch (e) {
        console.warn("[ResultsService] Failed to fetch votes from Supabase, falling back to local store:", e.message);
        votes = localStore.getAllVotes(electionId);
      }
    } else {
      votes = localStore.getAllVotes(electionId);
    }

    const totalEligible = allStudents.filter((s) => s.eligible).length;
    const totalVotes = votes.length;
    const turnoutPercentage = totalEligible > 0 ? ((totalVotes / totalEligible) * 100).toFixed(1) : "0.0";
    const remainingEligible = Math.max(0, totalEligible - totalVotes);

    // Section Breakdown - only include sections that have at least 1 registered student
    const allSections = config.institution.sections || ["A", "B", "C", "D"];
    const activeStudentSections = new Set(allStudents.filter(s => s.eligible).map(s => (s.section || "A").toUpperCase()));
    const sections = allSections.filter(sec => activeStudentSections.has(sec));
    const sectionStats = sections.map((sec) => {
      const secStudents = allStudents.filter((s) => (s.section || "A").toUpperCase() === sec && s.eligible);
      const secVotes = votes.filter((v) => (v.section || "A").toUpperCase() === sec);
      const capacity = secStudents.length;
      const count = secVotes.length;
      const pct = capacity > 0 ? ((count / capacity) * 100).toFixed(1) : "0.0";
      return {
        section: sec,
        votes: count,
        total: capacity,
        percentage: Number(pct),
      };
    });

    // Candidate Tally
    const candidateTally = allCandidates.map((cand) => {
      const candVotes = votes.filter((v) => v.candidate_id === (cand.candidate_id || cand.id));
      const voteCount = candVotes.length;
      const pctOfTotal = totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : "0.0";

      // Calculate percentage within candidate's own section
      const sectionTotalVotes = votes.filter((v) => (v.section || "A").toUpperCase() === cand.section.toUpperCase()).length;
      const pctOfSection = sectionTotalVotes > 0 ? ((voteCount / sectionTotalVotes) * 100).toFixed(1) : "0.0";

      return {
        candidate_id: cand.candidate_id || cand.id,
        name: cand.name,
        roll_number: cand.roll_number || cand.rollNumber,
        section: cand.section,
        symbol: cand.symbol,
        symbol_name: cand.symbol_name || cand.symbolName,
        avatar_bg: cand.avatar_bg || "linear-gradient(135deg, #1e3a8a, #3b82f6)",
        photo_url: cand.photo_url || "",
        active: cand.active,
        votesReceived: voteCount,
        percentageOfTotal: Number(pctOfTotal),
        percentageOfSection: Number(pctOfSection),
      };
    });

    // Sort by votes descending
    candidateTally.sort((a, b) => b.votesReceived - a.votesReceived);

    return {
      visibility,
      status: election.status,
      totalEligible,
      totalVotes,
      remainingEligible,
      turnoutPercentage: Number(turnoutPercentage),
      sectionStats,
      candidateTally,
      activeCandidatesCount: allCandidates.filter((c) => c.active !== false).length,
      lastUpdated: new Date().toISOString(),
    };
  },

  async getDashboardMetrics(electionId = "CR2026", userRole = "SUPER_ADMIN") {
    const results = await this.getResults(electionId, userRole);

    // Pull recent votes from Supabase (authoritative) if available
    let recentVotes = [];
    if (databaseAdapter.isSupabaseActive() && supabaseServer) {
      try {
        const { data: sbVotes } = await supabaseServer
          .from("votes")
          .select("vote_reference, created_at, section, request_id, student_id, candidate_id")
          .eq("election_id", electionId)
          .order("created_at", { ascending: false })
          .limit(15);

        if (sbVotes && sbVotes.length > 0) {
          // Enrich with student/candidate names
          const studentIds = [...new Set(sbVotes.map(v => v.student_id))];
          const candidateIds = [...new Set(sbVotes.map(v => v.candidate_id))];

          const [{ data: stuRows }, { data: candRows }] = await Promise.all([
            supabaseServer.from("students").select("id, name, roll_number").in("id", studentIds),
            supabaseServer.from("candidates").select("id, name").in("id", candidateIds),
          ]);

          const stuMap = Object.fromEntries((stuRows || []).map(s => [s.id, s]));
          const candMap = Object.fromEntries((candRows || []).map(c => [c.id, c]));

          recentVotes = sbVotes.map(v => ({
            refId: v.vote_reference,
            timestamp: v.created_at,
            rollNumber: stuMap[v.student_id]?.roll_number || "—",
            name: stuMap[v.student_id]?.name || "Unknown",
            section: v.section,
            candidateName: candMap[v.candidate_id]?.name || "Unknown",
          }));
        }
      } catch (e) {
        console.warn("[ResultsService] Failed to fetch recent votes from Supabase:", e.message);
        recentVotes = localStore
          .getAllVotes(electionId)
          .slice(-15)
          .reverse()
          .map((v) => ({
            refId: v.ref_id,
            timestamp: v.timestamp,
            rollNumber: v.roll_number,
            name: v.student_name,
            section: v.section,
            candidateName: v.candidate_name,
          }));
      }
    } else {
      recentVotes = localStore
        .getAllVotes(electionId)
        .slice(-15)
        .reverse()
        .map((v) => ({
          refId: v.ref_id,
          timestamp: v.timestamp,
          rollNumber: v.roll_number,
          name: v.student_name,
          section: v.section,
          candidateName: v.candidate_name,
        }));
    }

    return {
      ...results,
      recentVotes,
    };
  },
};

export default resultsService;
