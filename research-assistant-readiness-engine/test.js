"use strict";

const assert = require("node:assert/strict");
const sampleProject = require("./sample-project.json");
const {
  buildAssistantSuiteReport,
  checkReproducibility,
  findResearchGaps,
  normalizeProject,
  validateAssistantSuiteReport,
} = require("./engine");

const project = normalizeProject(sampleProject);

{
  const report = buildAssistantSuiteReport(project);
  assert.equal(report.peerReview.score, 100);
  assert.equal(report.reproducibility.confidence, 100);
  assert.equal(report.researchGaps[0].topic, "CRISPR off-target replication in neurodegenerative single-cell studies");
  assert.equal(validateAssistantSuiteReport(report).valid, true);
}

{
  const incomplete = normalizeProject({
    id: "incomplete",
    manuscript: {
      claims: ["A new method works"],
    },
    reproducibility: {},
    corpusSignals: [],
  });
  const report = buildAssistantSuiteReport(incomplete);
  assert.equal(report.peerReview.score < 60, true);
  assert.equal(report.reproducibility.confidence < 50, true);
  assert.equal(report.actions.some((action) => action.source === "peer-review"), true);
}

{
  const repro = checkReproducibility(project);
  assert.deepEqual(repro.runbook.slice(0, 2), [
    "Install dependencies from package-lock.json",
    "Install dependencies from environment.yml",
  ]);
  assert.equal(repro.latestAttempt.status, "passed");
}

{
  const gaps = findResearchGaps(project);
  assert.equal(gaps.length, 3);
  assert.equal(gaps[0].score > gaps[2].score, true);
}

{
  const a = buildAssistantSuiteReport(project);
  const b = buildAssistantSuiteReport(project);
  assert.equal(a.digest, b.digest);
}

console.log("research-assistant-readiness-engine tests passed");
