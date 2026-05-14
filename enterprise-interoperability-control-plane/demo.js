"use strict";

const sampleInstitution = require("./sample-institution.json");
const {
  buildEnterpriseControlPlane,
  validateControlPlane,
} = require("./control-plane");

const report = buildEnterpriseControlPlane(sampleInstitution);
const validation = validateControlPlane(report);

console.log("Enterprise interoperability control plane demo");
console.log(`Institution: ${report.institution.name}`);
console.log(`Projects: ${report.dashboard.projectCount}`);
console.log(`Reproducibility coverage: ${report.dashboard.reproducibilityCoverage}%`);
console.log(`API integrations: ${report.apiCatalog.length}`);
console.log(`Webhook events: ${report.webhookEvents.length}`);
console.log(`Ready export targets: ${report.exportPackages.flatMap((pkg) => pkg.readyTargets).join(", ")}`);
console.log(`Validation: ${validation.valid ? "passed" : validation.errors.join(", ")}`);
console.log(`Digest: ${report.digest}`);
