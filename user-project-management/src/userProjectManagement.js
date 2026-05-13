const IDENTITY_PROVIDERS = new Set(["orcid", "google", "github", "linkedin", "saml"])
const VISIBILITIES = new Set(["public", "private", "institutional-only", "invitation-only"])
const ROLES = new Set(["owner", "admin", "contributor", "reviewer", "viewer"])
const DOCUMENT_FORMATS = new Set(["markdown", "latex", "jupyter"])
const PROJECT_ACTIONS = new Set([
  "project:read",
  "project:update",
  "project:archive",
  "member:invite",
  "member:manage",
  "document:write",
  "code:write",
  "dataset:download",
  "review:write",
])

const ROLE_PERMISSIONS = {
  owner: [...PROJECT_ACTIONS],
  admin: [
    "project:read",
    "project:update",
    "member:invite",
    "member:manage",
    "document:write",
    "code:write",
    "dataset:download",
    "review:write",
  ],
  contributor: ["project:read", "document:write", "code:write", "dataset:download"],
  reviewer: ["project:read", "review:write"],
  viewer: ["project:read"],
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`)
  }
  return value.trim()
}

function requireDate(value, field) {
  const text = requireString(value, field)
  if (Number.isNaN(Date.parse(text))) throw new Error(`${field} must be an ISO date`)
  return text
}

function uniqueStrings(values, field) {
  return [...new Set((values ?? []).map((value) => requireString(value, field)))]
}

function nonNegative(value, field) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be non-negative`)
  return Number(value)
}

function normalizeDocument(document) {
  const format = requireString(document.format, "document.format").toLowerCase()
  if (!DOCUMENT_FORMATS.has(format)) throw new Error(`Unsupported document format: ${format}`)
  return {
    document_id: requireString(document.document_id, "document.document_id"),
    title: requireString(document.title, "document.title"),
    format,
    path: requireString(document.path, "document.path"),
  }
}

function normalizeAsset(asset, prefix) {
  return {
    [`${prefix}_id`]: requireString(asset[`${prefix}_id`], `${prefix}.${prefix}_id`),
    name: requireString(asset.name, `${prefix}.name`),
    path: requireString(asset.path, `${prefix}.path`),
  }
}

export function createUserAccount({
  user_id,
  email,
  password_hash,
  two_factor_enabled = false,
  status = "active",
  linked_identities = [],
} = {}) {
  return {
    user_id: requireString(user_id, "user_id"),
    email: requireString(email, "email").toLowerCase(),
    password_hash: requireString(password_hash, "password_hash"),
    two_factor_enabled: Boolean(two_factor_enabled),
    status: requireString(status, "status"),
    linked_identities: linked_identities.map((identity) => linkExternalIdentity({ account: { linked_identities: [] }, ...identity }).linked_identities[0]),
  }
}

export function createAnonymousUser({ anonymous_id, scope = "public-browsing", expires_at } = {}) {
  return {
    user_id: requireString(anonymous_id, "anonymous_id"),
    anonymous: true,
    scope: requireString(scope, "scope"),
    expires_at: expires_at ? requireDate(expires_at, "expires_at") : null,
  }
}

export function linkExternalIdentity({
  account,
  provider,
  provider_user_id,
  verified = true,
  institution,
  metadata = {},
} = {}) {
  const normalizedProvider = requireString(provider, "provider").toLowerCase()
  if (!IDENTITY_PROVIDERS.has(normalizedProvider)) throw new Error(`Unsupported identity provider: ${provider}`)
  if (normalizedProvider === "saml" && !institution) throw new Error("SAML identity requires institution")

  const identity = {
    provider: normalizedProvider,
    provider_user_id: requireString(provider_user_id, "provider_user_id"),
    verified: Boolean(verified),
    institution: institution ? requireString(institution, "institution") : null,
    metadata,
  }

  const existing = account.linked_identities ?? []
  const withoutDuplicate = existing.filter(
    (item) => !(item.provider === identity.provider && item.provider_user_id === identity.provider_user_id),
  )

  return {
    ...account,
    linked_identities: [...withoutDuplicate, identity],
  }
}

export function createResearcherProfile({
  user_id,
  name,
  institution,
  fields = [],
  bio = "",
  keywords = [],
  photo_url,
  public_mode = true,
  orcid_sync = {},
  publications = [],
  grants = [],
  activity = [],
} = {}) {
  return {
    user_id: requireString(user_id, "user_id"),
    name: requireString(name, "name"),
    institution: requireString(institution, "institution"),
    fields: uniqueStrings(fields, "field"),
    bio,
    keywords: uniqueStrings(keywords, "keyword"),
    photo_url: photo_url ? requireString(photo_url, "photo_url") : null,
    public_mode: Boolean(public_mode),
    orcid_sync: {
      orcid_id: orcid_sync.orcid_id ?? null,
      last_synced_at: orcid_sync.last_synced_at ?? null,
      affiliations: orcid_sync.affiliations ?? [],
    },
    publications,
    grants,
    activity,
  }
}

export function recordProfileActivity(profile, { type, target_id, summary, created_at } = {}) {
  const activity = {
    type: requireString(type, "type"),
    target_id: requireString(target_id, "target_id"),
    summary: requireString(summary, "summary"),
    created_at: requireDate(created_at, "created_at"),
  }
  return {
    ...profile,
    activity: [activity, ...(profile.activity ?? [])].slice(0, 50),
  }
}

export function calculateResearcherMetrics({
  publications = [],
  projects = [],
  peer_reviews = [],
  endorsements = [],
  reproducibility_attempts = [],
} = {}) {
  const downloads = projects.reduce((total, project) => total + nonNegative(project.downloads ?? 0, "project.downloads"), 0)
  const forks = projects.reduce((total, project) => total + nonNegative(project.forks ?? 0, "project.forks"), 0)
  const successfulAttempts = reproducibility_attempts.filter((attempt) => attempt.status === "passed").length
  const reproducibility_score =
    reproducibility_attempts.length === 0 ? 0 : Number((successfulAttempts / reproducibility_attempts.length).toFixed(3))

  return {
    publication_count: publications.length,
    review_count: peer_reviews.length,
    downloads,
    forks,
    endorsements: endorsements.length,
    reproducibility_score,
    reputation_score: Number(
      (publications.length * 5 + peer_reviews.length * 2 + endorsements.length * 3 + downloads * 0.01 + forks * 0.5 + reproducibility_score * 10).toFixed(2),
    ),
  }
}

export function createProjectSpace({
  project_id,
  title,
  owner_id,
  visibility = "private",
  documents = [],
  code = [],
  datasets = [],
  discussions = [],
  metadata = {},
  citations = [],
  collaborators = [],
  funding_sources = [],
  institutions = [],
} = {}) {
  const normalizedVisibility = requireString(visibility, "visibility")
  if (!VISIBILITIES.has(normalizedVisibility)) throw new Error(`Unsupported visibility: ${visibility}`)

  return {
    project_id: requireString(project_id, "project_id"),
    title: requireString(title, "title"),
    owner_id: requireString(owner_id, "owner_id"),
    visibility: normalizedVisibility,
    archived: false,
    documents: documents.map(normalizeDocument),
    code: code.map((asset) => normalizeAsset(asset, "code")),
    datasets: datasets.map((asset) => normalizeAsset(asset, "dataset")),
    discussions: discussions.map((discussion) => ({
      discussion_id: requireString(discussion.discussion_id, "discussion.discussion_id"),
      title: requireString(discussion.title, "discussion.title"),
      comment_count: nonNegative(discussion.comment_count ?? 0, "discussion.comment_count"),
    })),
    metadata,
    citations,
    collaborators,
    funding_sources,
    institutions: uniqueStrings(institutions, "institution"),
    object_policies: [],
  }
}

export function archiveProjectSpace(project, { archived_by, reason, archived_at } = {}) {
  return {
    ...project,
    archived: true,
    archive_event: {
      archived_by: requireString(archived_by, "archived_by"),
      reason: requireString(reason, "reason"),
      archived_at: requireDate(archived_at, "archived_at"),
    },
  }
}

export function grantProjectRole({ project_id, user_id, role, scope = "project" } = {}) {
  if (!ROLES.has(role)) throw new Error(`Unsupported project role: ${role}`)
  return {
    project_id: requireString(project_id, "project_id"),
    user_id: requireString(user_id, "user_id"),
    role,
    scope: requireString(scope, "scope"),
    permissions: ROLE_PERMISSIONS[role],
  }
}

export function canPerformProjectAction(roleAssignment, action) {
  if (!PROJECT_ACTIONS.has(action)) throw new Error(`Unsupported project action: ${action}`)
  return (roleAssignment?.permissions ?? []).includes(action)
}

export function createInvitation({
  invitation_id,
  project_id,
  email,
  invited_by,
  role = "viewer",
  read_only = true,
  expires_at,
} = {}) {
  if (!ROLES.has(role)) throw new Error(`Unsupported invitation role: ${role}`)
  return {
    invitation_id: requireString(invitation_id, "invitation_id"),
    project_id: requireString(project_id, "project_id"),
    email: requireString(email, "email").toLowerCase(),
    invited_by: requireString(invited_by, "invited_by"),
    role,
    read_only: Boolean(read_only),
    expires_at: requireDate(expires_at, "expires_at"),
    status: "pending",
  }
}

export function canAccessProject({ project, actor, roleAssignments = [], invitations = [], now = new Date().toISOString() } = {}) {
  if (project.visibility === "public") return true
  if (!actor) return false

  const hasRole = roleAssignments.some(
    (assignment) => assignment.project_id === project.project_id && assignment.user_id === actor.user_id && canPerformProjectAction(assignment, "project:read"),
  )
  if (hasRole) return true

  if (project.visibility === "institutional-only") {
    return Boolean(actor.institution && project.institutions.includes(actor.institution))
  }

  if (project.visibility === "invitation-only") {
    return invitations.some(
      (invitation) =>
        invitation.project_id === project.project_id &&
        invitation.email === actor.email?.toLowerCase() &&
        invitation.status === "pending" &&
        invitation.expires_at >= now,
    )
  }

  return false
}

export function setObjectPolicy(project, { object_id, object_type, allowed_roles = [], permissions = [] } = {}) {
  const policy = {
    object_id: requireString(object_id, "object_id"),
    object_type: requireString(object_type, "object_type"),
    allowed_roles: allowed_roles.map((role) => {
      if (!ROLES.has(role)) throw new Error(`Unsupported policy role: ${role}`)
      return role
    }),
    permissions: uniqueStrings(permissions, "permission"),
  }
  return {
    ...project,
    object_policies: [...(project.object_policies ?? []).filter((item) => item.object_id !== policy.object_id), policy],
  }
}

export function canAccessObject({ project, object_id, roleAssignment, permission } = {}) {
  const policy = (project.object_policies ?? []).find((item) => item.object_id === object_id)
  if (!policy) return canPerformProjectAction(roleAssignment, permission)
  return policy.allowed_roles.includes(roleAssignment?.role) && policy.permissions.includes(permission)
}

export function recordAuditEvent(events, { audit_id, project_id, actor_id, action, target_id, created_at, metadata = {} } = {}) {
  return [
    ...(events ?? []),
    {
      audit_id: requireString(audit_id, "audit_id"),
      project_id: requireString(project_id, "project_id"),
      actor_id: requireString(actor_id, "actor_id"),
      action: requireString(action, "action"),
      target_id: requireString(target_id, "target_id"),
      created_at: requireDate(created_at, "created_at"),
      metadata,
    },
  ]
}

export function exportProjectAuditLog({ project_id, events = [] } = {}) {
  const id = requireString(project_id, "project_id")
  return events
    .filter((event) => event.project_id === id)
    .map((event) => ({ ...event }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}
