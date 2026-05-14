"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  addArtifact,
  buildSubmissionPackage,
  createWorkspace,
  digest,
  normalizeChallenge,
  validateSubmissionPackage,
} = require("./package-builder");

const challenge = JSON.parse(fs.readFileSync(path.join(__dirname, "sample-challenge.json"), "utf8"));

function buildCompleteWorkspace() {
  const workspace = createWorkspace({
    challenge,
    team: {
      id: "team-test",
      displayName: "Test Lab",
      members: ["A. Researcher", "B. Scientist"],
    },
    participationMode: "anonymous",
  });

  for (const phase of challenge.phases) {
    for (const deliverable of phase.deliverables.filter((item) => item.required !== false)) {
      addArtifact(workspace, {
        phaseId: phase.id,
        deliverableId: deliverable.id,
        title: `${deliverable.title} artifact`,
        type: deliverable.acceptedTypes[0],
        content: `${phase.id}:${deliverable.id}:content`,
      });
    }
  }

  return workspace;
}

{
  const normalized = normalizeChallenge(challenge);
  assert.equal(normalized.id, "bio-marker-rna-seq-2026");
  assert.equal(normalized.visibility, "private");
  assert.equal(normalized.ndaRequired, true);
  assert.equal(normalized.phases.length, 3);
}

{
  const workspace = buildCompleteWorkspace();
  const manifest = buildSubmissionPackage(workspace);
  const validation = validateSubmissionPackage(manifest);

  assert.equal(manifest.readyForSponsorReview, true);
  assert.equal(validation.valid, true);
  assert.equal(manifest.team.displayName, "Anonymous team");
  assert.equal(manifest.team.members.length, 0);
  assert.equal(manifest.artifacts.length, 6);
  assert.equal(manifest.phaseSummary.every((phase) => phase.complete), true);
}

{
  const workspace = createWorkspace({
    challenge,
    team: {
      id: "team-incomplete",
      displayName: "Incomplete Lab",
      members: ["C. Scientist"],
    },
  });

  addArtifact(workspace, {
    phaseId: "proposal",
    deliverableId: "research-plan",
    title: "Research plan",
    content: "Only one artifact is not enough.",
  });

  const manifest = buildSubmissionPackage(workspace);
  const validation = validateSubmissionPackage(manifest);

  assert.equal(manifest.readyForSponsorReview, false);
  assert.equal(manifest.missingRequired.length, 5);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /missing 5 required deliverable/);
}

{
  const first = digest({ b: 2, a: 1 });
  const second = digest({ a: 1, b: 2 });
  assert.equal(first, second);
}

console.log("scientific-submission-package-builder tests passed");
