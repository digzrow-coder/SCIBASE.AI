import assert from "node:assert/strict"
import test from "node:test"
import {
  assignEnterpriseRole,
  buildAdminDashboard,
  buildIntegrationManifest,
  buildProductivityReport,
  canPerform,
  createComplianceRecord,
  createOrganizationProfile,
  exportAuditLog,
} from "../src/enterprise.js"

test("creates institutional profiles with SAML and department metadata", () => {
  const profile = createOrganizationProfile({
    organization_id: "org_1",
    name: "Example University",
    domains: ["Example.edu"],
    departments: [{ department_id: "bio", name: "Biology", cost_center: "CC-100" }],
    saml_entity_id: "https://idp.example.edu/saml",
  })

  assert.equal(profile.domains[0], "example.edu")
  assert.equal(profile.departments[0].cost_center, "CC-100")
  assert.equal(profile.saml_entity_id, "https://idp.example.edu/saml")
})

test("assigns role-based enterprise permissions", () => {
  const admin = assignEnterpriseRole({
    user_id: "user_1",
    organization_id: "org_1",
    role: "admin",
  })
  const researcher = assignEnterpriseRole({
    user_id: "user_2",
    organization_id: "org_1",
    role: "researcher",
  })

  assert.equal(canPerform(admin, "integration:manage"), true)
  assert.equal(canPerform(researcher, "integration:manage"), false)
  assert.throws(
    () => assignEnterpriseRole({ user_id: "u", organization_id: "o", role: "unknown" }),
    /Unsupported enterprise role/,
  )
})

test("builds admin dashboards from projects, users, usage, and compliance", () => {
  const dashboard = buildAdminDashboard({
    projects: [
      { project_id: "p1", visibility: "public" },
      { project_id: "p2", visibility: "private" },
    ],
    users: [
      { user_id: "u1", status: "active" },
      { user_id: "u2", status: "inactive" },
      { user_id: "u3", status: "active" },
    ],
    usage_events: [
      { storage_gb: 12.5, compute_hours: 3 },
      { storage_gb: 2.5, compute_hours: 7 },
    ],
    compliance_records: [
      { status: "open" },
      { status: "resolved" },
    ],
  })

  assert.equal(dashboard.project_count, 2)
  assert.equal(dashboard.private_projects, 1)
  assert.equal(dashboard.active_users, 2)
  assert.deepEqual(dashboard.usage, { storage_gb: 15, compute_hours: 10 })
  assert.equal(dashboard.compliance.open_records, 1)
})

test("creates compliance records and integration manifests", () => {
  const compliance = createComplianceRecord({
    record_id: "comp_1",
    project_id: "project_1",
    mandate: "NIH Data Management and Sharing Policy",
    requirement: "Dataset must be deposited in an approved repository.",
    evidence: [{ type: "repository", url: "https://example.edu/datasets/project_1" }],
    due_date: "2026-06-01",
  })
  const manifest = buildIntegrationManifest({
    integration_id: "int_1",
    provider: "Canvas LMS",
    type: "lms",
    scopes: ["courses:read", "assignments:write"],
    webhook_url: "https://scibase.example.edu/webhooks/canvas",
    field_mappings: { course_id: "project.department" },
  })

  assert.equal(compliance.evidence[0].type, "repository")
  assert.equal(manifest.status, "configured")
  assert.equal(manifest.field_mappings.course_id, "project.department")
})

test("exports ordered audit logs for an organization", () => {
  const logs = exportAuditLog({
    organization_id: "org_1",
    events: [
      {
        audit_id: "audit_2",
        organization_id: "org_1",
        actor_id: "admin",
        action: "project.archive",
        target_id: "p2",
        created_at: "2026-05-13T12:00:00.000Z",
      },
      {
        audit_id: "audit_1",
        organization_id: "org_1",
        actor_id: "owner",
        action: "user.invite",
        target_id: "user_4",
        created_at: "2026-05-13T10:00:00.000Z",
      },
      {
        audit_id: "audit_3",
        organization_id: "org_2",
        actor_id: "owner",
        action: "ignored",
        target_id: "x",
        created_at: "2026-05-13T09:00:00.000Z",
      },
    ],
  })

  assert.deepEqual(
    logs.map((log) => log.audit_id),
    ["audit_1", "audit_2"],
  )
})

test("builds department productivity reports", () => {
  const report = buildProductivityReport({
    projects: [
      { project_id: "p1", department: "biology", visibility: "public" },
      { project_id: "p2", department: "biology", visibility: "private" },
      { project_id: "p3", department: "physics", visibility: "public" },
    ],
    peer_reviews: [{ department: "biology" }, { department: "physics" }],
    ai_reviews: [{ department: "biology" }, { department: "biology" }],
  })

  assert.equal(report[0].department, "biology")
  assert.equal(report[0].projects, 2)
  assert.equal(report[0].peer_reviews, 1)
  assert.equal(report[0].ai_reviews, 2)
})
