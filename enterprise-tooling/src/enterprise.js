const ROLES = new Set(["owner", "admin", "department-admin", "lab-manager", "researcher", "auditor"])
const PERMISSIONS = new Set([
  "project:read",
  "project:write",
  "project:archive",
  "billing:read",
  "billing:write",
  "compliance:read",
  "compliance:write",
  "integration:manage",
  "user:manage",
])

const ROLE_PERMISSIONS = {
  owner: [...PERMISSIONS],
  admin: [
    "project:read",
    "project:write",
    "project:archive",
    "billing:read",
    "compliance:read",
    "compliance:write",
    "integration:manage",
    "user:manage",
  ],
  "department-admin": ["project:read", "project:write", "compliance:read", "user:manage"],
  "lab-manager": ["project:read", "project:write", "compliance:read"],
  researcher: ["project:read", "project:write"],
  auditor: ["project:read", "billing:read", "compliance:read"],
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`)
  }
  return value.trim()
}

function nonNegative(value, field) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be non-negative`)
  return Number(value.toFixed(2))
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}

export function createOrganizationProfile({
  organization_id,
  name,
  domains = [],
  departments = [],
  saml_entity_id,
  allowed_oauth_providers = ["orcid", "google", "github", "linkedin"],
}) {
  return {
    organization_id: requireString(organization_id, "organization_id"),
    name: requireString(name, "name"),
    domains: domains.map((domain) => requireString(domain, "domain").toLowerCase()),
    departments: departments.map((department) => ({
      department_id: requireString(department.department_id, "department.department_id"),
      name: requireString(department.name, "department.name"),
      cost_center: department.cost_center ?? null,
    })),
    saml_entity_id: saml_entity_id ? requireString(saml_entity_id, "saml_entity_id") : null,
    allowed_oauth_providers,
  }
}

export function assignEnterpriseRole({ user_id, organization_id, role, scope = "organization" }) {
  if (!ROLES.has(role)) throw new Error(`Unsupported enterprise role: ${role}`)
  return {
    user_id: requireString(user_id, "user_id"),
    organization_id: requireString(organization_id, "organization_id"),
    role,
    scope: requireString(scope, "scope"),
    permissions: ROLE_PERMISSIONS[role],
  }
}

export function canPerform(roleAssignment, permission) {
  if (!PERMISSIONS.has(permission)) throw new Error(`Unsupported permission: ${permission}`)
  return roleAssignment.permissions.includes(permission)
}

export function buildAdminDashboard({
  projects = [],
  users = [],
  usage_events = [],
  compliance_records = [],
} = {}) {
  const privateProjects = projects.filter((project) => project.visibility === "private").length
  const publicProjects = projects.filter((project) => project.visibility === "public").length
  const activeUsers = users.filter((user) => user.status === "active").length
  const storageGb = nonNegative(sum(usage_events.map((event) => event.storage_gb ?? 0)), "storage_gb")
  const computeHours = nonNegative(sum(usage_events.map((event) => event.compute_hours ?? 0)), "compute_hours")
  const complianceOpen = compliance_records.filter((record) => record.status !== "resolved").length

  return {
    project_count: projects.length,
    private_projects: privateProjects,
    public_projects: publicProjects,
    active_users: activeUsers,
    inactive_users: users.length - activeUsers,
    usage: { storage_gb: storageGb, compute_hours: computeHours },
    compliance: {
      total_records: compliance_records.length,
      open_records: complianceOpen,
      resolved_records: compliance_records.length - complianceOpen,
    },
  }
}

export function createComplianceRecord({
  record_id,
  project_id,
  mandate,
  requirement,
  status = "open",
  evidence = [],
  due_date,
}) {
  return {
    record_id: requireString(record_id, "record_id"),
    project_id: requireString(project_id, "project_id"),
    mandate: requireString(mandate, "mandate"),
    requirement: requireString(requirement, "requirement"),
    status: requireString(status, "status"),
    evidence: evidence.map((item) => ({
      type: requireString(item.type, "evidence.type"),
      url: requireString(item.url, "evidence.url"),
    })),
    due_date: requireString(due_date, "due_date"),
  }
}

export function buildIntegrationManifest({
  integration_id,
  provider,
  type,
  scopes = [],
  webhook_url,
  field_mappings = {},
}) {
  const supportedTypes = new Set(["saml", "oauth", "webhook", "lms", "repository", "data-warehouse"])
  if (!supportedTypes.has(type)) throw new Error(`Unsupported integration type: ${type}`)
  return {
    integration_id: requireString(integration_id, "integration_id"),
    provider: requireString(provider, "provider"),
    type,
    scopes: scopes.map((scope) => requireString(scope, "scope")),
    webhook_url: webhook_url ? requireString(webhook_url, "webhook_url") : null,
    field_mappings,
    status: "configured",
  }
}

export function exportAuditLog({ organization_id, events = [] }) {
  return events
    .filter((event) => event.organization_id === organization_id)
    .map((event) => ({
      audit_id: requireString(event.audit_id, "event.audit_id"),
      organization_id,
      actor_id: requireString(event.actor_id, "event.actor_id"),
      action: requireString(event.action, "event.action"),
      target_id: requireString(event.target_id, "event.target_id"),
      created_at: requireString(event.created_at, "event.created_at"),
      metadata: event.metadata ?? {},
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function buildProductivityReport({ projects = [], peer_reviews = [], ai_reviews = [] } = {}) {
  const byDepartment = {}
  for (const project of projects) {
    const department = project.department ?? "unassigned"
    const bucket = byDepartment[department] ?? {
      projects: 0,
      public_projects: 0,
      peer_reviews: 0,
      ai_reviews: 0,
    }
    bucket.projects += 1
    if (project.visibility === "public") bucket.public_projects += 1
    byDepartment[department] = bucket
  }

  for (const review of peer_reviews) {
    const department = review.department ?? "unassigned"
    byDepartment[department] ??= { projects: 0, public_projects: 0, peer_reviews: 0, ai_reviews: 0 }
    byDepartment[department].peer_reviews += 1
  }
  for (const review of ai_reviews) {
    const department = review.department ?? "unassigned"
    byDepartment[department] ??= { projects: 0, public_projects: 0, peer_reviews: 0, ai_reviews: 0 }
    byDepartment[department].ai_reviews += 1
  }

  return Object.entries(byDepartment)
    .map(([department, metrics]) => ({ department, ...metrics }))
    .sort((a, b) => b.projects - a.projects || a.department.localeCompare(b.department))
}

export function createDemoEnterpriseWorkspace() {
  const organization = createOrganizationProfile({
    organization_id: "org_example",
    name: "Example University",
    domains: ["example.edu"],
    departments: [
      { department_id: "biology", name: "Biology", cost_center: "BIO-100" },
      { department_id: "physics", name: "Physics", cost_center: "PHY-200" },
    ],
    saml_entity_id: "https://idp.example.edu/saml",
  })
  const roles = [
    assignEnterpriseRole({ user_id: "owner_ada", organization_id: organization.organization_id, role: "owner" }),
    assignEnterpriseRole({ user_id: "admin_grace", organization_id: organization.organization_id, role: "admin" }),
    assignEnterpriseRole({ user_id: "auditor_lin", organization_id: organization.organization_id, role: "auditor" }),
  ]
  const compliance = [
    createComplianceRecord({
      record_id: "comp_nih",
      project_id: "project_atlas",
      mandate: "NIH Data Management and Sharing Policy",
      requirement: "Dataset must be deposited in an approved repository.",
      evidence: [{ type: "repository", url: "https://example.edu/datasets/project_atlas" }],
      due_date: "2026-06-01",
    }),
  ]
  const projects = [
    { project_id: "project_atlas", visibility: "private", department: "biology" },
    { project_id: "project_quantum", visibility: "public", department: "physics" },
    { project_id: "project_methods", visibility: "public", department: "biology" },
  ]
  const users = [
    { user_id: "owner_ada", status: "active" },
    { user_id: "admin_grace", status: "active" },
    { user_id: "auditor_lin", status: "inactive" },
  ]
  const usage_events = [
    { storage_gb: 120.5, compute_hours: 44 },
    { storage_gb: 30.25, compute_hours: 12 },
  ]
  const integrations = [
    buildIntegrationManifest({
      integration_id: "int_saml",
      provider: "Example IdP",
      type: "saml",
      scopes: ["sso:read"],
      webhook_url: "https://scibase.example.edu/webhooks/saml",
    }),
    buildIntegrationManifest({
      integration_id: "int_canvas",
      provider: "Canvas LMS",
      type: "lms",
      scopes: ["courses:read", "assignments:write"],
      field_mappings: { course_id: "project.department" },
    }),
  ]
  const audit_log = exportAuditLog({
    organization_id: organization.organization_id,
    events: [
      {
        audit_id: "audit_invite",
        organization_id: organization.organization_id,
        actor_id: "admin_grace",
        action: "user.invite",
        target_id: "researcher_new",
        created_at: "2026-05-14T01:00:00.000Z",
      },
      {
        audit_id: "audit_integration",
        organization_id: organization.organization_id,
        actor_id: "owner_ada",
        action: "integration.configure",
        target_id: "int_saml",
        created_at: "2026-05-14T02:00:00.000Z",
      },
    ],
  })

  return {
    organization,
    roles,
    dashboard: buildAdminDashboard({ projects, users, usage_events, compliance_records: compliance }),
    compliance,
    integrations,
    audit_log,
    productivity: buildProductivityReport({
      projects,
      peer_reviews: [{ department: "biology" }, { department: "physics" }],
      ai_reviews: [{ department: "biology" }, { department: "biology" }],
    }),
  }
}
