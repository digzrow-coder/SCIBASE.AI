import assert from "node:assert/strict"
import test from "node:test"
import { createUserProjectDemoServer } from "../src/server.js"
import {
  archiveProjectSpace,
  calculateResearcherMetrics,
  canAccessObject,
  canAccessProject,
  canPerformProjectAction,
  createAnonymousUser,
  createInvitation,
  createDemoUserProjectWorkspace,
  createProjectSpace,
  createResearcherProfile,
  createUserAccount,
  exportProjectAuditLog,
  grantProjectRole,
  linkExternalIdentity,
  recordAuditEvent,
  recordProfileActivity,
  setObjectPolicy,
} from "../src/userProjectManagement.js"

test("creates user accounts with MFA and links external identities", () => {
  const account = createUserAccount({
    user_id: "user_1",
    email: "Ada@Example.edu",
    password_hash: "argon2id$hash",
    two_factor_enabled: true,
  })
  const linked = linkExternalIdentity({
    account,
    provider: "ORCID",
    provider_user_id: "0000-0002-1825-0097",
    metadata: { publications_synced: 12 },
  })
  const saml = linkExternalIdentity({
    account: linked,
    provider: "saml",
    provider_user_id: "ada@example.edu",
    institution: "Example University",
  })

  assert.equal(account.email, "ada@example.edu")
  assert.equal(account.two_factor_enabled, true)
  assert.equal(saml.linked_identities.length, 2)
  assert.equal(saml.linked_identities[1].institution, "Example University")
  assert.throws(
    () => linkExternalIdentity({ account, provider: "saml", provider_user_id: "missing-institution" }),
    /requires institution/,
  )
})

test("creates a runnable demo workspace with access checks and metrics", () => {
  const workspace = createDemoUserProjectWorkspace()

  assert.equal(workspace.account.two_factor_enabled, true)
  assert.equal(workspace.account.linked_identities.length, 2)
  assert.equal(workspace.project.title, "Single-cell atlas")
  assert.equal(workspace.access_checks.owner_can_update, true)
  assert.equal(workspace.access_checks.reviewer_can_download_restricted_dataset, false)
  assert.equal(workspace.audit_log.length, 2)
  assert.ok(workspace.metrics.reputation_score > 0)
})

test("serves the demo workspace over the local API", async () => {
  const server = createUserProjectDemoServer()
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address()

  try {
    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`)
    assert.equal(healthResponse.status, 200)
    assert.equal((await healthResponse.json()).status, "ok")

    const pageResponse = await fetch(`http://127.0.0.1:${port}/`)
    const pageHtml = await pageResponse.text()
    assert.equal(pageResponse.status, 200)
    assert.match(pageHtml, /User & Project Management/)

    const workspaceResponse = await fetch(`http://127.0.0.1:${port}/demo-workspace`)
    const workspace = await workspaceResponse.json()

    assert.equal(workspaceResponse.status, 200)
    assert.equal(workspace.project.project_id, "project_atlas")
    assert.equal(workspace.access_checks.institutional_reader_can_access, true)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
})

test("supports anonymous users for public browsing or peer review", () => {
  const anonymous = createAnonymousUser({
    anonymous_id: "anon_review_1",
    scope: "open-peer-review",
    expires_at: "2026-06-01T00:00:00.000Z",
  })

  assert.equal(anonymous.anonymous, true)
  assert.equal(anonymous.scope, "open-peer-review")
})

test("creates researcher profiles and records activity feeds", () => {
  const profile = createResearcherProfile({
    user_id: "user_1",
    name: "Ada Researcher",
    institution: "Example University",
    fields: ["Biology", "Biology"],
    bio: "Studies reproducible single-cell workflows.",
    keywords: ["single-cell", "reproducibility"],
    public_mode: false,
    orcid_sync: {
      orcid_id: "0000-0002-1825-0097",
      affiliations: ["Example University"],
    },
  })
  const withActivity = recordProfileActivity(profile, {
    type: "project",
    target_id: "project_1",
    summary: "Created single-cell atlas workspace",
    created_at: "2026-05-14T01:00:00.000Z",
  })

  assert.deepEqual(profile.fields, ["Biology"])
  assert.equal(profile.public_mode, false)
  assert.equal(withActivity.activity[0].summary, "Created single-cell atlas workspace")
})

test("creates scientific project spaces with documents, code, data, discussions, and metadata", () => {
  const project = createProjectSpace({
    project_id: "project_1",
    title: "Single-cell atlas",
    owner_id: "user_1",
    visibility: "institutional-only",
    documents: [{ document_id: "doc_1", title: "Methods", format: "markdown", path: "docs/methods.md" }],
    code: [{ code_id: "code_1", name: "Pipeline", path: "src/pipeline.py" }],
    datasets: [{ dataset_id: "data_1", name: "Raw counts", path: "data/counts.parquet" }],
    discussions: [{ discussion_id: "disc_1", title: "Review thread", comment_count: 2 }],
    metadata: { field: "genomics" },
    citations: [{ doi: "10.1234/example" }],
    collaborators: ["user_2"],
    funding_sources: ["NIH"],
    institutions: ["Example University"],
  })

  assert.equal(project.documents[0].format, "markdown")
  assert.equal(project.code[0].path, "src/pipeline.py")
  assert.equal(project.datasets[0].name, "Raw counts")
  assert.equal(project.discussions[0].comment_count, 2)
  assert.throws(
    () =>
      createProjectSpace({
        project_id: "bad",
        title: "Bad",
        owner_id: "user_1",
        documents: [{ document_id: "doc", title: "Doc", format: "docx", path: "doc.docx" }],
      }),
    /Unsupported document format/,
  )
})

test("evaluates project visibility for public, private, institutional, and invitation-only spaces", () => {
  const institutional = createProjectSpace({
    project_id: "project_1",
    title: "Institutional study",
    owner_id: "owner",
    visibility: "institutional-only",
    institutions: ["Example University"],
  })
  const privateProject = createProjectSpace({
    project_id: "project_2",
    title: "Private study",
    owner_id: "owner",
    visibility: "private",
  })
  const invitedProject = createProjectSpace({
    project_id: "project_3",
    title: "Invite study",
    owner_id: "owner",
    visibility: "invitation-only",
  })
  const role = grantProjectRole({ project_id: "project_2", user_id: "owner", role: "owner" })
  const invitation = createInvitation({
    invitation_id: "invite_1",
    project_id: "project_3",
    email: "external@example.org",
    invited_by: "owner",
    expires_at: "2026-06-01T00:00:00.000Z",
  })

  assert.equal(
    canAccessProject({
      project: institutional,
      actor: { user_id: "reader", institution: "Example University" },
    }),
    true,
  )
  assert.equal(canAccessProject({ project: privateProject, actor: { user_id: "owner" }, roleAssignments: [role] }), true)
  assert.equal(canAccessProject({ project: privateProject, actor: { user_id: "stranger" }, roleAssignments: [role] }), false)
  assert.equal(
    canAccessProject({
      project: invitedProject,
      actor: { user_id: "external", email: "external@example.org" },
      invitations: [invitation],
      now: "2026-05-15T00:00:00.000Z",
    }),
    true,
  )
})

test("assigns role-based permissions and object-level policies", () => {
  const project = createProjectSpace({
    project_id: "project_1",
    title: "Controlled dataset",
    owner_id: "owner",
    datasets: [{ dataset_id: "data_1", name: "Sensitive data", path: "data/sensitive.csv" }],
  })
  const contributor = grantProjectRole({ project_id: "project_1", user_id: "user_2", role: "contributor" })
  const reviewer = grantProjectRole({ project_id: "project_1", user_id: "user_3", role: "reviewer" })
  const restricted = setObjectPolicy(project, {
    object_id: "data_1",
    object_type: "dataset",
    allowed_roles: ["owner", "admin"],
    permissions: ["dataset:download"],
  })

  assert.equal(canPerformProjectAction(contributor, "code:write"), true)
  assert.equal(canPerformProjectAction(reviewer, "code:write"), false)
  assert.equal(canAccessObject({ project: restricted, object_id: "data_1", roleAssignment: contributor, permission: "dataset:download" }), false)
})

test("creates invitations with expiration and read-only controls", () => {
  const invitation = createInvitation({
    invitation_id: "invite_1",
    project_id: "project_1",
    email: "Reviewer@Journal.org",
    invited_by: "owner",
    role: "reviewer",
    read_only: true,
    expires_at: "2026-06-01T00:00:00.000Z",
  })

  assert.equal(invitation.email, "reviewer@journal.org")
  assert.equal(invitation.read_only, true)
  assert.equal(invitation.role, "reviewer")
})

test("exports ordered project audit logs and archives projects", () => {
  let events = []
  events = recordAuditEvent(events, {
    audit_id: "audit_2",
    project_id: "project_1",
    actor_id: "admin",
    action: "member.invite",
    target_id: "invite_1",
    created_at: "2026-05-14T02:00:00.000Z",
  })
  events = recordAuditEvent(events, {
    audit_id: "audit_1",
    project_id: "project_1",
    actor_id: "owner",
    action: "project.create",
    target_id: "project_1",
    created_at: "2026-05-14T01:00:00.000Z",
  })
  const project = createProjectSpace({ project_id: "project_1", title: "Archive me", owner_id: "owner" })
  const archived = archiveProjectSpace(project, {
    archived_by: "owner",
    reason: "Completed manuscript submission",
    archived_at: "2026-05-14T03:00:00.000Z",
  })

  assert.deepEqual(
    exportProjectAuditLog({ project_id: "project_1", events }).map((event) => event.audit_id),
    ["audit_1", "audit_2"],
  )
  assert.equal(archived.archived, true)
  assert.equal(archived.archive_event.reason, "Completed manuscript submission")
})

test("calculates citation and reputation metrics", () => {
  const metrics = calculateResearcherMetrics({
    publications: [{ doi: "10.1234/one" }, { doi: "10.1234/two" }],
    projects: [
      { downloads: 100, forks: 4 },
      { downloads: 50, forks: 2 },
    ],
    peer_reviews: [{ id: "review_1" }],
    endorsements: [{ id: "endorsement_1" }, { id: "endorsement_2" }],
    reproducibility_attempts: [{ status: "passed" }, { status: "failed" }, { status: "passed" }],
  })

  assert.equal(metrics.downloads, 150)
  assert.equal(metrics.forks, 6)
  assert.equal(metrics.reproducibility_score, 0.667)
  assert.equal(metrics.reputation_score, 29.17)
})
