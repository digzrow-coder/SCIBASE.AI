"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  addArtifact,
  buildSubmissionPackage,
  createWorkspace,
  validateSubmissionPackage,
} = require("./package-builder");

const challenge = JSON.parse(fs.readFileSync(path.join(__dirname, "sample-challenge.json"), "utf8"));

const workspace = createWorkspace({
  challenge,
  team: {
    id: "team-epsilon",
    displayName: "Epsilon Lab",
    members: ["Ada Chen", "Noor Patel"],
  },
  participationMode: "anonymous",
});

for (const artifact of [
  {
    phaseId: "proposal",
    deliverableId: "research-plan",
    title: "Biomarker discovery plan",
    type: "markdown",
    summary: "Hypothesis, cohorts, preprocessing, and validation method.",
    content: "Plan: QC cells, normalize counts, rank markers, validate with held-out patient groups.",
  },
  {
    phaseId: "proposal",
    deliverableId: "risk-register",
    title: "Risk register",
    type: "json",
    summary: "Bias, leakage, and privacy risks with mitigations.",
    content: { risks: ["batch effects", "patient leakage", "small cohort"], mitigations: ["stratified split", "audit"] },
  },
  {
    phaseId: "prototype",
    deliverableId: "notebook",
    title: "Prototype notebook",
    type: "ipynb",
    summary: "Executable single-cell workflow notebook.",
    content: "notebook cells: load -> qc -> normalize -> rank_genes_groups -> validate",
  },
  {
    phaseId: "prototype",
    deliverableId: "dataset-manifest",
    title: "Dataset manifest",
    type: "json",
    summary: "Input files, hashes, schema, and privacy constraints.",
    content: { files: [{ name: "cells.h5ad", sha256: "example-hash" }], schema: "AnnData" },
  },
  {
    phaseId: "final",
    deliverableId: "whitepaper",
    title: "Final whitepaper",
    type: "markdown",
    summary: "Biomarker results and reproducibility instructions.",
    content: "Final report with top candidate markers, confidence intervals, and failure modes.",
  },
  {
    phaseId: "final",
    deliverableId: "model-card",
    title: "Model card",
    type: "json",
    summary: "Model intent, limitations, and validation cohort details.",
    content: { intendedUse: "research triage", limitations: ["not diagnostic"], validation: "held-out cohort" },
  },
]) {
  addArtifact(workspace, artifact);
}

const manifest = buildSubmissionPackage(workspace);
const validation = validateSubmissionPackage(manifest);

console.log("Scientific submission package demo");
console.log(`Workspace: ${workspace.workspaceId}`);
console.log(`Challenge: ${manifest.challenge.title}`);
console.log(`Anonymous package: ${manifest.team.displayName}`);
console.log(`Artifacts: ${manifest.artifacts.length}`);
console.log(`Ready for sponsor review: ${manifest.readyForSponsorReview}`);
console.log(`Validation: ${validation.valid ? "passed" : "failed"}`);
console.log(`Reproducibility digest: ${manifest.reproducibilityDigest}`);

if (!validation.valid) {
  console.error(validation.errors.join("\n"));
  process.exitCode = 1;
}
