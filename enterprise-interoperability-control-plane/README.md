# Enterprise Interoperability Control Plane

Self-contained milestone for SCIBASE issue #19, "Enterprise Tooling".

The module models the enterprise operations layer an institution needs before connecting SCIBASE to internal systems:

- admin dashboard metrics for projects, departments, AI reviews, storage, and reproducibility coverage;
- compliance evidence reports for institutional policies;
- secure API/integration catalog for downstream systems;
- HMAC-signed webhook events for project and compliance updates;
- export package manifests for journal, repository, and funder targets.

It is dependency-free CommonJS and can be run directly with Node.

## Run

```bash
node enterprise-interoperability-control-plane/test.js
node enterprise-interoperability-control-plane/demo.js
```

Optional browser demo recording:

```bash
npm install playwright --no-save --no-package-lock
node enterprise-interoperability-control-plane/record-demo.js
```

## Requirement Mapping

| Issue #19 capability | Implementation |
| --- | --- |
| Admin dashboards | `buildAdminDashboard()` reports project counts, private projects, storage, AI reviews, reproducibility coverage, and department breakdowns. |
| Compliance tracking | `evaluateCompliance()` compares each project against institutional policy requirements. |
| Secure REST/API integrations | `buildApiCatalog()` exposes integration systems, auth modes, endpoints, event types, and readiness. |
| Webhook support | `createWebhookEvent()` creates deterministic webhook payloads with HMAC signatures and event headers. |
| Export pipelines | `buildExportPackage()` creates target-specific export manifests for repository, journal, and DataCite-style systems. |
| Metadata preservation | Export manifests carry DOI, ORCID, funding, files, semantic version, and package digest. |
| Enterprise control plane | `buildEnterpriseControlPlane()` combines dashboard, compliance, API catalog, exports, webhooks, and digest for review. |

## Files

- `control-plane.js` - core enterprise control-plane logic.
- `sample-institution.json` - institutional fixture.
- `demo.js` - CLI demo.
- `test.js` - dependency-free tests.
- `demo.html` - browser workflow demo.
- `record-demo.js` - Playwright recorder.
