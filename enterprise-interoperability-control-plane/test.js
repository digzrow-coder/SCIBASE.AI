"use strict";

const assert = require("node:assert/strict");
const sampleInstitution = require("./sample-institution.json");
const {
  buildAdminDashboard,
  buildEnterpriseControlPlane,
  buildExportPackage,
  createWebhookEvent,
  normalizeInstitution,
  signPayload,
  validateControlPlane,
} = require("./control-plane");

const institution = normalizeInstitution(sampleInstitution);

{
  const dashboard = buildAdminDashboard(institution);
  assert.equal(dashboard.projectCount, 2);
  assert.equal(dashboard.privateProjectCount, 1);
  assert.equal(dashboard.reproducibilityCoverage, 50);
  assert.equal(dashboard.projectsByDepartment.Neuroscience, 1);
}

{
  const event = createWebhookEvent({
    institution,
    eventType: "project.published",
    projectId: "alzheimers-cell-atlas",
    payload: { target: "zenodo" },
    secret: "test-secret",
  });
  assert.equal(event.signature, signPayload({
    id: event.id,
    institutionId: event.institutionId,
    eventType: event.eventType,
    projectId: event.projectId,
    payload: event.payload,
    createdAt: event.createdAt,
  }, "test-secret"));
  assert.match(event.headers["x-scibase-signature"], /^sha256=/);
}

{
  const exportPackage = buildExportPackage(institution, "alzheimers-cell-atlas");
  assert.deepEqual(exportPackage.readyTargets, ["zenodo", "journal-jats", "datacite"]);
  assert.equal(exportPackage.packageDigest.length, 64);
}

{
  const exportPackage = buildExportPackage(institution, "battery-materials-protocols");
  assert.deepEqual(exportPackage.readyTargets, ["datacite"]);
  assert.equal(exportPackage.targets.find((target) => target.id === "zenodo").ready, false);
}

{
  const report = buildEnterpriseControlPlane(institution);
  assert.equal(validateControlPlane(report).valid, true);
  assert.equal(report.compliance.find((entry) => entry.projectId === "battery-materials-protocols").compliant, false);
  assert.equal(report.digest, buildEnterpriseControlPlane(institution).digest);

  const tamperedReport = structuredClone(report);
  tamperedReport.dashboard.projectCount = 99;
  assert.equal(validateControlPlane(tamperedReport).valid, false);

  const badWebhookReport = structuredClone(report);
  badWebhookReport.webhookEvents[0].headers["x-scibase-signature"] = "sha256=bad";
  assert.equal(validateControlPlane(badWebhookReport).valid, false);
}

console.log("enterprise-interoperability-control-plane tests passed");
