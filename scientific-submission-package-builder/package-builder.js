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

function requireString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function normalizeChallenge(challenge) {
  if (!challenge || typeof challenge !== "object") {
    throw new Error("challenge must be an object");
  }

  const phases = Array.isArray(challenge.phases) ? challenge.phases : [];
  if (phases.length === 0) {
    throw new Error("challenge.phases must include at least one phase");
  }

  const normalizedPhases = phases.map((phase, index) => ({
    id: requireString(phase.id || `phase-${index + 1}`, `phases[${index}].id`),
    title: requireString(phase.title, `phases[${index}].title`),
    deliverables: (phase.deliverables || []).map((deliverable, deliverableIndex) => ({
      id: requireString(
        deliverable.id || `${phase.id || `phase-${index + 1}`}-deliverable-${deliverableIndex + 1}`,
        `phases[${index}].deliverables[${deliverableIndex}].id`,
      ),
      title: requireString(deliverable.title, `phases[${index}].deliverables[${deliverableIndex}].title`),
      required: deliverable.required !== false,
      acceptedTypes: Array.isArray(deliverable.acceptedTypes) ? deliverable.acceptedTypes : ["any"],
    })),
  }));

  return {
    id: requireString(challenge.id, "challenge.id"),
    title: requireString(challenge.title, "challenge.title"),
    visibility: challenge.visibility === "private" ? "private" : "public",
    ndaRequired: Boolean(challenge.ndaRequired),
    ipPolicy: challenge.ipPolicy || "solver-retains-until-paid",
    phases: normalizedPhases,
    evaluationCriteria: Array.isArray(challenge.evaluationCriteria) ? challenge.evaluationCriteria : [],
  };
}

function createWorkspace({ challenge, team, participationMode = "named" }) {
  const normalizedChallenge = normalizeChallenge(challenge);
  const normalizedTeam = {
    id: requireString(team && team.id, "team.id"),
    displayName: requireString(team && team.displayName, "team.displayName"),
    members: Array.isArray(team && team.members) ? team.members.map((member) => requireString(member, "team.members[]")) : [],
  };

  return {
    workspaceId: digest({
      challengeId: normalizedChallenge.id,
      teamId: normalizedTeam.id,
      createdFor: "scientific-submission-package-builder",
    }).slice(0, 16),
    challenge: normalizedChallenge,
    team: normalizedTeam,
    participationMode: participationMode === "anonymous" ? "anonymous" : "named",
    createdAt: new Date("2026-05-15T00:00:00.000Z").toISOString(),
    artifacts: [],
    auditLog: [
      {
        type: "workspace.created",
        actor: "system",
        at: new Date("2026-05-15T00:00:00.000Z").toISOString(),
        summary: `Workspace created for ${normalizedChallenge.id}`,
      },
    ],
  };
}

function addArtifact(workspace, artifact) {
  const phaseId = requireString(artifact.phaseId, "artifact.phaseId");
  const deliverableId = requireString(artifact.deliverableId, "artifact.deliverableId");
  const title = requireString(artifact.title, "artifact.title");
  const content = artifact.content || artifact.summary || title;
  const artifactRecord = {
    id: artifact.id || digest({ phaseId, deliverableId, title, content }).slice(0, 12),
    phaseId,
    deliverableId,
    title,
    type: artifact.type || "document",
    summary: artifact.summary || "",
    contentHash: digest(content),
    license: artifact.license || "challenge-default",
    submittedAt: artifact.submittedAt || new Date("2026-05-15T00:00:00.000Z").toISOString(),
  };

  workspace.artifacts.push(artifactRecord);
  workspace.auditLog.push({
    type: "artifact.added",
    actor: artifact.actor || "submitter",
    at: artifactRecord.submittedAt,
    summary: `${artifactRecord.title} added for ${phaseId}/${deliverableId}`,
    contentHash: artifactRecord.contentHash,
  });

  return artifactRecord;
}

function requiredDeliverables(challenge) {
  return challenge.phases.flatMap((phase) =>
    phase.deliverables
      .filter((deliverable) => deliverable.required)
      .map((deliverable) => ({
        phaseId: phase.id,
        deliverableId: deliverable.id,
        title: deliverable.title,
      })),
  );
}

function buildSubmissionPackage(workspace) {
  const required = requiredDeliverables(workspace.challenge);
  const submittedKeys = new Set(workspace.artifacts.map((artifact) => `${artifact.phaseId}:${artifact.deliverableId}`));
  const missingRequired = required.filter(
    (deliverable) => !submittedKeys.has(`${deliverable.phaseId}:${deliverable.deliverableId}`),
  );

  const phaseSummary = workspace.challenge.phases.map((phase) => {
    const phaseArtifacts = workspace.artifacts.filter((artifact) => artifact.phaseId === phase.id);
    const requiredForPhase = phase.deliverables.filter((deliverable) => deliverable.required);
    return {
      phaseId: phase.id,
      title: phase.title,
      artifactCount: phaseArtifacts.length,
      requiredCount: requiredForPhase.length,
      complete: requiredForPhase.every((deliverable) =>
        phaseArtifacts.some((artifact) => artifact.deliverableId === deliverable.id),
      ),
    };
  });

  const publicTeam =
    workspace.participationMode === "anonymous"
      ? { id: workspace.team.id, displayName: "Anonymous team", members: [] }
      : workspace.team;

  const manifest = {
    packageVersion: "1.0.0",
    challenge: {
      id: workspace.challenge.id,
      title: workspace.challenge.title,
      visibility: workspace.challenge.visibility,
      ndaRequired: workspace.challenge.ndaRequired,
      ipPolicy: workspace.challenge.ipPolicy,
    },
    team: publicTeam,
    phaseSummary,
    artifacts: workspace.artifacts,
    missingRequired,
    auditDigest: digest(workspace.auditLog),
    reproducibilityDigest: digest({
      challenge: workspace.challenge,
      artifacts: workspace.artifacts,
      phaseSummary,
    }),
    readyForSponsorReview: missingRequired.length === 0,
  };

  return manifest;
}

function validateSubmissionPackage(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== "object") {
    return { valid: false, errors: ["manifest must be an object"] };
  }

  if (!manifest.challenge || !manifest.challenge.id) {
    errors.push("challenge id is required");
  }

  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    errors.push("at least one artifact is required");
  }

  for (const artifact of manifest.artifacts || []) {
    for (const field of ["id", "phaseId", "deliverableId", "contentHash"]) {
      if (!artifact[field]) {
        errors.push(`artifact ${artifact.id || "(unknown)"} is missing ${field}`);
      }
    }
  }

  if (Array.isArray(manifest.missingRequired) && manifest.missingRequired.length > 0) {
    errors.push(`missing ${manifest.missingRequired.length} required deliverable(s)`);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  addArtifact,
  buildSubmissionPackage,
  createWorkspace,
  digest,
  normalizeChallenge,
  stableStringify,
  validateSubmissionPackage,
};
