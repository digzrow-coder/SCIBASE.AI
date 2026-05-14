"use strict";

const crypto = require("node:crypto");

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
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

function signPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeInstitution(input) {
  if (!input || typeof input !== "object") throw new Error("Institution payload is required");
  return {
    id: String(input.id || "institution"),
    name: String(input.name || "Unnamed institution"),
    projects: list(input.projects),
    integrations: list(input.integrations),
    exportTargets: list(input.exportTargets),
    compliancePolicies: list(input.compliancePolicies),
  };
}

function buildAdminDashboard(institution) {
  const projects = institution.projects;
  const privateProjects = projects.filter((project) => project.visibility === "private").length;
  const reproducible = projects.filter((project) => Number(project.reproducibilityScore || 0) >= 80).length;
  const aiReviews = projects.reduce((sum, project) => sum + Number(project.aiReviews || 0), 0);
  const storageGb = projects.reduce((sum, project) => sum + Number(project.storageGb || 0), 0);
  const departments = new Map();

  for (const project of projects) {
    const key = project.department || "Unassigned";
    departments.set(key, (departments.get(key) || 0) + 1);
  }

  return {
    projectCount: projects.length,
    privateProjectCount: privateProjects,
    reproducibilityCoverage: projects.length === 0 ? 0 : Math.round((reproducible / projects.length) * 100),
    aiReviewsGenerated: aiReviews,
    storageGb,
    projectsByDepartment: Object.fromEntries([...departments.entries()].sort()),
  };
}

function evaluateCompliance(institution) {
  return institution.projects.map((project) => {
    const missing = institution.compliancePolicies
      .filter((policy) => !list(project.compliance).includes(policy.id))
      .map((policy) => policy.id);
    return {
      projectId: project.id,
      compliant: missing.length === 0,
      missing,
      tags: list(project.tags),
    };
  });
}

function buildApiCatalog(institution) {
  return institution.integrations.map((integration) => ({
    id: integration.id,
    system: integration.system,
    auth: integration.auth || "api-key",
    endpoints: list(integration.endpoints),
    eventTypes: list(integration.eventTypes),
    status: integration.enabled === false ? "disabled" : "ready",
  }));
}

function createWebhookEvent({ institution, eventType, projectId, payload, secret }) {
  const event = {
    id: digest({ eventType, projectId, payload }).slice(0, 16),
    institutionId: institution.id,
    eventType,
    projectId,
    payload,
    createdAt: "2026-05-15T00:00:00.000Z",
  };
  return {
    ...event,
    signature: signPayload(event, secret),
    headers: {
      "x-scibase-event": event.eventType,
      "x-scibase-signature": `sha256=${signPayload(event, secret)}`,
    },
  };
}

function buildExportPackage(institution, projectId) {
  const project = institution.projects.find((candidate) => candidate.id === projectId);
  if (!project) throw new Error(`Unknown project: ${projectId}`);

  const targets = institution.exportTargets.map((target) => ({
    id: target.id,
    system: target.system,
    format: target.format,
    ready: list(project.exportFormats).includes(target.format),
    requiredMetadata: list(target.requiredMetadata),
    missingMetadata: list(target.requiredMetadata).filter((field) => !project.metadata || !project.metadata[field]),
  }));

  const manifest = {
    projectId: project.id,
    title: project.title,
    version: project.version || "v0.1.0",
    targets,
    files: list(project.files),
    metadata: project.metadata || {},
  };

  return {
    ...manifest,
    packageDigest: digest(manifest),
    readyTargets: targets.filter((target) => target.ready && target.missingMetadata.length === 0).map((target) => target.id),
  };
}

function buildEnterpriseControlPlane(rawInstitution, options = {}) {
  const institution = normalizeInstitution(rawInstitution);
  const dashboard = buildAdminDashboard(institution);
  const compliance = evaluateCompliance(institution);
  const apiCatalog = buildApiCatalog(institution);
  const exportPackages = institution.projects.map((project) => buildExportPackage(institution, project.id));
  const webhookEvents = institution.projects.map((project) =>
    createWebhookEvent({
      institution,
      eventType: "project.compliance_evaluated",
      projectId: project.id,
      payload: {
        compliant: compliance.find((entry) => entry.projectId === project.id).compliant,
        reproducibilityScore: project.reproducibilityScore || 0,
      },
      secret: options.webhookSecret || "local-demo-secret",
    }),
  );

  const report = {
    institution: {
      id: institution.id,
      name: institution.name,
    },
    dashboard,
    compliance,
    apiCatalog,
    exportPackages,
    webhookEvents,
  };

  return {
    ...report,
    digest: digest(report),
  };
}

function validateControlPlane(report) {
  const errors = [];
  if (!report.dashboard) errors.push("admin dashboard is missing");
  if (!Array.isArray(report.compliance)) errors.push("compliance report is missing");
  if (!Array.isArray(report.apiCatalog)) errors.push("API catalog is missing");
  if (!Array.isArray(report.exportPackages)) errors.push("export packages are missing");
  if (!Array.isArray(report.webhookEvents)) errors.push("webhook events are missing");
  if (!report.digest || report.digest.length !== 64) errors.push("digest is invalid");
  if (report.digest && report.digest.length === 64) {
    const { digest: reportDigest, ...signedReport } = report;
    if (digest(signedReport) !== reportDigest) errors.push("digest does not match report payload");
  }
  for (const event of Array.isArray(report.webhookEvents) ? report.webhookEvents : []) {
    if (!event.signature || event.signature.length !== 64) {
      errors.push(`webhook signature is invalid for ${event.projectId || "unknown project"}`);
      continue;
    }
    if (!event.headers || event.headers["x-scibase-signature"] !== `sha256=${event.signature}`) {
      errors.push(`webhook signature header does not match for ${event.projectId || "unknown project"}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  stableStringify,
  digest,
  signPayload,
  normalizeInstitution,
  buildAdminDashboard,
  evaluateCompliance,
  buildApiCatalog,
  createWebhookEvent,
  buildExportPackage,
  buildEnterpriseControlPlane,
  validateControlPlane,
};
