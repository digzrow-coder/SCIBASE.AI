# Enterprise Tooling

Self-contained MVP module for issue #19. It models institutional controls for university, research institute, and enterprise R&D customers: organization profiles, admin dashboards, role-based permissions, compliance tracking, integrations, audit logs, and productivity reports.

## Capabilities

- Creates institution profiles with verified domains, departments, SAML identity metadata, and allowed OAuth providers.
- Assigns enterprise roles for owners, admins, department admins, lab managers, researchers, and auditors.
- Maps roles to permission sets for project, billing, compliance, integration, and user-management actions.
- Builds admin dashboards with project counts, public/private visibility, active users, usage totals, and compliance status.
- Tracks funder and institutional compliance records with evidence links and due dates.
- Defines integration manifests for SAML, OAuth, LMS, repository, webhook, and data-warehouse connections.
- Exports ordered audit logs for governance and security review.
- Produces department-level productivity reports across projects, peer reviews, and AI reviews.

## Usage

```bash
cd enterprise-tooling
npm test
```

```js
import {
  createOrganizationProfile,
  assignEnterpriseRole,
  buildAdminDashboard,
} from "./src/enterprise.js";

const organization = createOrganizationProfile({
  organization_id: "org_1",
  name: "Example University",
  domains: ["example.edu"],
  departments: [{ department_id: "bio", name: "Biology" }],
  saml_entity_id: "https://idp.example.edu/saml",
});

const admin = assignEnterpriseRole({
  user_id: "user_1",
  organization_id: organization.organization_id,
  role: "admin",
});

console.log(admin.permissions);
console.log(buildAdminDashboard({ projects: [], users: [], usage_events: [] }));
```

## Requirement Mapping

| Issue requirement | Implementation |
| --- | --- |
| Organization admin dashboards | `buildAdminDashboard()` summarizes projects, users, usage, and compliance. |
| Contributor analytics and productivity metrics | `buildProductivityReport()` groups project, peer-review, and AI-review activity by department. |
| Usage stats | Dashboard usage totals cover storage and compute consumption. |
| Compliance tracking | `createComplianceRecord()` stores mandates, requirements, evidence links, statuses, and due dates. |
| Institutional identity | `createOrganizationProfile()` supports SAML entity metadata, verified domains, and OAuth providers. |
| Role-based access controls | `assignEnterpriseRole()` and `canPerform()` map roles to project, billing, compliance, integration, and user-management permissions. |
| Integrations | `buildIntegrationManifest()` models SAML, OAuth, LMS, repository, webhook, and data-warehouse connections. |
| Audit logs | `exportAuditLog()` emits organization-filtered, time-ordered audit events. |

## Verification

The test suite covers organization profiles, RBAC permissions, dashboards, compliance records, integration manifests, audit logs, and department productivity reports.
