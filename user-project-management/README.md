# User & Project Management

Self-contained MVP module for issue #11. It models identity, researcher profiles, scientific project spaces, role-based access, object-level controls, invitations, audit history, and reputation metrics without external services or API keys.

## Capabilities

- Creates email/password identities with optional two-factor configuration.
- Links external identities for ORCID, Google, GitHub, LinkedIn, and institutional SAML.
- Stores researcher profiles with affiliation, fields, keywords, publication/grant sync metadata, activity, and public/private modes.
- Creates scientific workspaces with documents, code, datasets, discussion threads, citations, funding sources, linked institutions, and collaborators.
- Evaluates project visibility for public, private, institutional-only, and invitation-only spaces.
- Assigns project roles for owner, admin, contributor, reviewer, and viewer.
- Applies object-level policies so code, data, documents, and discussions can each have different access rules.
- Issues time-limited or read-only external invitations.
- Exports ordered audit logs for access, membership, object-policy, and archive events.
- Calculates citation and reputation metrics from downloads, forks, endorsements, reproducibility, reviews, and publications.

## Usage

```bash
cd user-project-management
npm test
npm run demo
npm run serve
```

```js
import {
  createUserAccount,
  createResearcherProfile,
  createProjectSpace,
  grantProjectRole,
  canAccessProject,
} from "./src/userProjectManagement.js";

const user = createUserAccount({
  user_id: "user_1",
  email: "ada@example.edu",
  password_hash: "argon2id$example",
  two_factor_enabled: true,
});

const profile = createResearcherProfile({
  user_id: user.user_id,
  name: "Ada Researcher",
  institution: "Example University",
  fields: ["computational biology"],
});

const project = createProjectSpace({
  project_id: "project_1",
  title: "Single-cell atlas",
  visibility: "institutional-only",
  owner_id: user.user_id,
  institutions: ["Example University"],
});

const owner = grantProjectRole({ project_id: project.project_id, user_id: user.user_id, role: "owner" });

console.log(profile.public_mode);
console.log(canAccessProject({ project, actor: { user_id: user.user_id, institution: "Example University" }, roleAssignments: [owner] }));
```

## Runnable Demo

`npm run demo` prints a complete demo workspace with identity, ORCID/SAML
account linking, researcher profile activity, project assets, RBAC,
object-level dataset policy, invitation, audit log, access checks, and
reputation metrics.

`npm run serve` starts a local dependency-free demo API:

- `GET /health`
- `GET /demo-workspace`

Example:

```bash
curl http://localhost:4311/demo-workspace
```

## Requirement Mapping

| Issue requirement | Implementation |
| --- | --- |
| Email/password login with 2FA | `createUserAccount()` stores password hash metadata and `two_factor_enabled`. |
| OAuth integrations | `linkExternalIdentity()` supports ORCID, Google, GitHub, and LinkedIn providers. |
| Institutional SAML login | `linkExternalIdentity()` supports SAML identities with institution metadata. |
| Account linking | `linkExternalIdentity()` appends verified external identities to an account. |
| Anonymous user mode | `createAnonymousUser()` creates scoped anonymous review/browsing identities. |
| Researcher profiles | `createResearcherProfile()` stores name, institution, field, bio, keywords, photo, ORCID sync, publications, grants, and visibility mode. |
| Activity feeds | `recordProfileActivity()` maintains recent projects, reviews, and collaborations. |
| Citation and reputation metrics | `calculateResearcherMetrics()` computes downloads, forks, endorsements, publication count, review count, and reproducibility score. |
| Project spaces | `createProjectSpace()` stores documents, code, datasets, discussion threads, metadata, citations, collaborators, funding, and institutions. |
| Markdown/LaTeX/Jupyter authoring | Project documents carry a `format` field validated against those authoring formats. |
| Visibility settings | `canAccessProject()` evaluates public, private, institutional-only, and invitation-only projects. |
| Role-based access | `grantProjectRole()` and `canPerformProjectAction()` support Owner, Admin, Contributor, Reviewer, and Viewer permissions. |
| Custom sharing | `createInvitation()` supports external collaborators, expiration, and read-only flags. |
| Fine-grained object-level control | `setObjectPolicy()` and `canAccessObject()` apply per-object read/write/download permissions. |
| Project audit log | `recordAuditEvent()` and `exportProjectAuditLog()` emit ordered access and change history. |
| Archive management | `archiveProjectSpace()` marks spaces archived and records the archive reason. |
| Local reviewer demo | `npm run demo` and `npm run serve` expose a complete user/project governance workspace. |

## Verification

The test suite covers identity creation, external account linking, anonymous users, researcher profiles, project workspaces, visibility checks, RBAC, object-level policies, invitations, audit logs, archive state, and reputation metrics.
