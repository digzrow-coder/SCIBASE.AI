"use strict";

const crypto = require("node:crypto");

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeList(value) {
  return Array.isArray(value) ? value.map(normalizeText).filter(Boolean) : [];
}

function normalizeProject(project) {
  if (!project || typeof project !== "object") {
    throw new Error("Project must be an object");
  }

  const manuscript = project.manuscript || {};
  const reproducibility = project.reproducibility || {};

  return {
    id: normalizeText(project.id || "project"),
    title: normalizeText(project.title || "Untitled research project"),
    domain: normalizeText(project.domain || "general science"),
    manuscript: {
      abstract: normalizeText(manuscript.abstract),
      claims: normalizeList(manuscript.claims),
      methods: normalizeList(manuscript.methods),
      citations: normalizeList(manuscript.citations),
      limitations: normalizeList(manuscript.limitations),
      ethicsStatement: normalizeText(manuscript.ethicsStatement),
      dataAvailability: normalizeText(manuscript.dataAvailability),
    },
    reproducibility: {
      codeEntrypoints: normalizeList(reproducibility.codeEntrypoints),
      notebooks: normalizeList(reproducibility.notebooks),
      datasets: normalizeList(reproducibility.datasets),
      dependencyFiles: normalizeList(reproducibility.dependencyFiles),
      expectedOutputs: normalizeList(reproducibility.expectedOutputs),
      randomSeeds: normalizeList(reproducibility.randomSeeds),
      priorAttempts: Array.isArray(reproducibility.priorAttempts) ? reproducibility.priorAttempts : [],
    },
    interests: normalizeList(project.interests),
    corpusSignals: Array.isArray(project.corpusSignals) ? project.corpusSignals : [],
  };
}

function scoreFromChecks(checks) {
  const passed = checks.filter((check) => check.passed).length;
  return Math.round((passed / checks.length) * 100);
}

function analyzePeerReview(project) {
  const checks = [
    {
      id: "claims-present",
      passed: project.manuscript.claims.length > 0,
      severity: "high",
      message: "Manuscript includes explicit scientific claims",
    },
    {
      id: "methods-present",
      passed: project.manuscript.methods.length > 0,
      severity: "high",
      message: "Methods are described for reviewer inspection",
    },
    {
      id: "citation-density",
      passed: project.manuscript.citations.length >= Math.max(2, project.manuscript.claims.length),
      severity: "medium",
      message: "Claims have enough citation context",
    },
    {
      id: "limitations-present",
      passed: project.manuscript.limitations.length > 0,
      severity: "medium",
      message: "Limitations are disclosed",
    },
    {
      id: "ethics-statement",
      passed: project.manuscript.ethicsStatement.length > 0,
      severity: "high",
      message: "Ethics statement is available when reviewers check compliance",
    },
    {
      id: "data-availability",
      passed: project.manuscript.dataAvailability.length > 0,
      severity: "high",
      message: "Data availability statement is present",
    },
  ];

  const unresolved = checks.filter((check) => !check.passed);
  const claimEvidence = project.manuscript.claims.map((claim, index) => ({
    claim,
    linkedCitation: project.manuscript.citations[index] || null,
    evidenceStatus: project.manuscript.citations[index] ? "linked" : "needs-citation",
  }));

  return {
    score: scoreFromChecks(checks),
    checks,
    unresolved,
    claimEvidence,
    reviewSummary:
      unresolved.length === 0
        ? "Ready for internal peer review"
        : `${unresolved.length} reviewer-facing gaps need attention`,
  };
}

function checkReproducibility(project) {
  const repro = project.reproducibility;
  const checks = [
    {
      id: "entrypoints",
      passed: repro.codeEntrypoints.length > 0 || repro.notebooks.length > 0,
      severity: "high",
      message: "Runnable code or notebooks are declared",
    },
    {
      id: "dependencies",
      passed: repro.dependencyFiles.length > 0,
      severity: "high",
      message: "Dependency lock or environment files are available",
    },
    {
      id: "datasets",
      passed: repro.datasets.length > 0,
      severity: "high",
      message: "Input datasets are listed",
    },
    {
      id: "outputs",
      passed: repro.expectedOutputs.length > 0,
      severity: "medium",
      message: "Expected outputs are documented",
    },
    {
      id: "seeds",
      passed: repro.randomSeeds.length > 0,
      severity: "medium",
      message: "Random seeds or deterministic controls are recorded",
    },
  ];

  const confidence = scoreFromChecks(checks);
  const latestAttempt = repro.priorAttempts
    .slice()
    .sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")))[0];

  return {
    confidence,
    checks,
    latestAttempt: latestAttempt || null,
    runbook: [
      ...repro.dependencyFiles.map((file) => `Install dependencies from ${file}`),
      ...repro.datasets.map((dataset) => `Fetch dataset ${dataset}`),
      ...repro.codeEntrypoints.map((entrypoint) => `Run ${entrypoint}`),
      ...repro.notebooks.map((notebook) => `Execute notebook ${notebook}`),
      ...repro.expectedOutputs.map((output) => `Compare output ${output}`),
    ],
  };
}

function findResearchGaps(project) {
  const limitationTerms = project.manuscript.limitations.flatMap((limitation) =>
    limitation
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 4),
  );

  return project.corpusSignals
    .map((signal) => {
      const topic = normalizeText(signal.topic);
      const terms = topic.toLowerCase().split(/[^a-z0-9]+/);
      const limitationOverlap = terms.filter((term) => limitationTerms.includes(term)).length;
      const interestOverlap = project.interests.filter((interest) =>
        topic.toLowerCase().includes(interest.toLowerCase()),
      ).length;
      const replicationGap = Number(signal.replicationGap || 0);
      const citationMomentum = Number(signal.citationMomentum || 0);
      const score = replicationGap * 3 + citationMomentum + limitationOverlap * 8 + interestOverlap * 5;

      return {
        topic,
        rationale: normalizeText(signal.rationale || "Corpus signal requires follow-up"),
        score,
        signals: {
          replicationGap,
          citationMomentum,
          limitationOverlap,
          interestOverlap,
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}

function buildAssistantSuiteReport(rawProject, options = {}) {
  const project = normalizeProject(rawProject);
  const peerReview = analyzePeerReview(project);
  const reproducibility = checkReproducibility(project);
  const researchGaps = findResearchGaps(project);

  const actions = [
    ...peerReview.unresolved.map((check) => ({
      priority: check.severity === "high" ? "high" : "medium",
      source: "peer-review",
      action: check.message,
    })),
    ...reproducibility.checks
      .filter((check) => !check.passed)
      .map((check) => ({
        priority: check.severity === "high" ? "high" : "medium",
        source: "reproducibility",
        action: check.message,
      })),
    ...researchGaps.slice(0, Number(options.maxGaps || 3)).map((gap) => ({
      priority: gap.score >= 20 ? "high" : "medium",
      source: "research-gap",
      action: `Investigate ${gap.topic}`,
    })),
  ].sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1));

  const report = {
    project: {
      id: project.id,
      title: project.title,
      domain: project.domain,
    },
    generatedAt: options.generatedAt || "2026-05-15T00:00:00.000Z",
    peerReview,
    reproducibility,
    researchGaps,
    actions,
  };

  return {
    ...report,
    digest: digest(report),
    weeklyDigestEmail: {
      subject: `Research assistant digest: ${project.title}`,
      headline: `${peerReview.reviewSummary}; reproducibility confidence ${reproducibility.confidence}%`,
      topActions: actions.slice(0, 5),
    },
  };
}

function validateAssistantSuiteReport(report) {
  const errors = [];
  if (!report.project || !report.project.id) errors.push("project metadata is missing");
  if (!report.peerReview || !Array.isArray(report.peerReview.checks)) errors.push("peer-review checks are missing");
  if (!report.reproducibility || !Array.isArray(report.reproducibility.runbook)) {
    errors.push("reproducibility runbook is missing");
  }
  if (!Array.isArray(report.researchGaps)) errors.push("research-gap feed is missing");
  if (!Array.isArray(report.actions)) errors.push("prioritized action queue is missing");
  if (!report.digest || report.digest.length !== 64) errors.push("report digest is invalid");

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  stableStringify,
  digest,
  normalizeProject,
  analyzePeerReview,
  checkReproducibility,
  findResearchGaps,
  buildAssistantSuiteReport,
  validateAssistantSuiteReport,
};
