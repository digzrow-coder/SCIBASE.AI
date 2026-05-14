"use strict";

const sampleProject = require("./sample-project.json");
const {
  buildAssistantSuiteReport,
  validateAssistantSuiteReport,
} = require("./engine");

const report = buildAssistantSuiteReport(sampleProject);
const validation = validateAssistantSuiteReport(report);

console.log("AI research assistant readiness demo");
console.log(`Project: ${report.project.title}`);
console.log(`Peer review score: ${report.peerReview.score}`);
console.log(`Reproducibility confidence: ${report.reproducibility.confidence}`);
console.log(`Top gap: ${report.researchGaps[0].topic}`);
console.log(`Actions: ${report.actions.length}`);
console.log(`Validation: ${validation.valid ? "passed" : validation.errors.join(", ")}`);
console.log(`Digest: ${report.digest}`);
