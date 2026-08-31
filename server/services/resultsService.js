import localStore from "../db/localStore.js";
import candidateService from "./candidateService.js";
import electionService, { ResultsVisibility } from "./electionService.js";
import config from "../config/index.js";

export const resultsService = {
  getResults(electionId = "CR2026", userRole = null) {
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

    const allStudents = localStore.getAllStudents();
    const allCandidates = localStore.getAllCandidates(electionId);
    const votes = localStore.getAllVotes(electionId);

    const totalEligible = allStudents.filter((s) => s.eligible).length;
    const totalVotes = votes.length;
    const turnoutPercentage = totalEligible > 0 ? ((totalVotes / totalEligible) * 100).toFixed(1) : "0.0";
    const remainingEligible = Math.max(0, totalEligible - totalVotes);

    // Section Breakdown
    const sections = config.institution.sections || ["A", "B", "C", "D"];
    const sectionStats = sections.map((sec) => {
      const secStudents = allStudents.filter((s) => (s.section || "A").toUpperCase() === sec && s.eligible);
      const secVotes = votes.filter((v) => (v.section || "A").toUpperCase() === sec);
      const capacity = secStudents.length || 60;
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
      const candVotes = votes.filter((v) => v.candidate_id === cand.candidate_id);
      const voteCount = candVotes.length;
      const pctOfTotal = totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : "0.0";

      // Calculate percentage within candidate's own section
      const sectionTotalVotes = votes.filter((v) => (v.section || "A").toUpperCase() === cand.section.toUpperCase()).length;
      const pctOfSection = sectionTotalVotes > 0 ? ((voteCount / sectionTotalVotes) * 100).toFixed(1) : "0.0";

      return {
        candidate_id: cand.candidate_id,
        name: cand.name,
        roll_number: cand.roll_number,
        section: cand.section,
        symbol: cand.symbol,
        symbol_name: cand.symbol_name,
        avatar_bg: cand.avatar_bg,
        photo_url: cand.photo_url,
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

  getDashboardMetrics(electionId = "CR2026", userRole = "SUPER_ADMIN") {
    const results = this.getResults(electionId, userRole);
    const recentVotes = localStore
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

    return {
      ...results,
      recentVotes,
    };
  },
};

export default resultsService;
