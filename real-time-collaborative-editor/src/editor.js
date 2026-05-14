import crypto from "node:crypto";

const ROLES = new Set(["owner", "admin", "contributor", "reviewer", "viewer"]);
const EDIT_ROLES = new Set(["owner", "admin", "contributor"]);

export function createResearchDocument(input) {
  const now = input.createdAt ?? new Date().toISOString();
  const body = input.body ?? "";
  const document = {
    id: input.id ?? `doc_${hash(`${input.title}:${now}`).slice(0, 10)}`,
    title: input.title,
    format: input.format ?? "markdown",
    body,
    citations: normalizeCitations(input.citations ?? []),
    references: extractCrossReferences(body),
    equations: extractLatexEquations(body),
    codeBlocks: extractCodeBlocks(body),
    template: input.template ?? "research-article",
    mode: input.mode ?? "markdown",
    collaborators: normalizeCollaborators(input.collaborators ?? []),
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...document,
    versions: [createSnapshot(document, "Initial draft", now)],
    autosave: {
      enabled: true,
      intervalMs: input.autosaveIntervalMs ?? 15000,
      lastSavedAt: now,
      localCacheKey: `scibase:${document.id}:draft`,
    },
  };
}

export function createCollaborationSession(document, input = {}) {
  const users = new Map();
  for (const collaborator of document.collaborators) {
    users.set(collaborator.id, {
      ...collaborator,
      cursor: null,
      status: "offline",
      lockedSections: [],
    });
  }

  return {
    id: input.id ?? `session_${hash(document.id).slice(0, 10)}`,
    documentId: document.id,
    users,
    comments: [],
    suggestions: [],
    tasks: [],
    chat: [],
    locks: new Map(),
    events: [],
  };
}

export function joinSession(session, user, cursor = { section: "body", offset: 0 }) {
  assertRole(user.role);
  session.users.set(user.id, {
    ...user,
    cursor,
    status: "active",
    lockedSections: [],
  });
  session.events.push(event("presence.joined", user.id, { cursor }));
  return session;
}

export function updateCursor(session, userId, cursor) {
  const user = requireUser(session, userId);
  user.cursor = cursor;
  user.status = "active";
  session.events.push(event("presence.cursor", userId, { cursor }));
  return session;
}

export function lockSection(session, userId, sectionId, reason = "Final review") {
  const user = requireUser(session, userId);
  assertCanEdit(user);
  if (session.locks.has(sectionId)) {
    throw new Error(`Section ${sectionId} is already locked`);
  }
  session.locks.set(sectionId, {
    sectionId,
    userId,
    reason,
    lockedAt: new Date().toISOString(),
  });
  user.lockedSections.push(sectionId);
  session.events.push(event("section.locked", userId, { sectionId, reason }));
  return session;
}

export function addInlineComment(session, input) {
  const user = requireUser(session, input.userId);
  const comment = {
    id: input.id ?? `comment_${hash(`${input.userId}:${input.anchor}:${input.body}`).slice(0, 10)}`,
    userId: user.id,
    anchor: input.anchor,
    body: input.body,
    status: "open",
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  session.comments.push(comment);
  session.events.push(event("comment.created", user.id, { commentId: comment.id }));
  return comment;
}

export function addSuggestion(session, input) {
  const user = requireUser(session, input.userId);
  assertCanEdit(user);
  const suggestion = {
    id: input.id ?? `suggestion_${hash(`${input.anchor}:${input.replacement}`).slice(0, 10)}`,
    userId: user.id,
    anchor: input.anchor,
    original: input.original,
    replacement: input.replacement,
    rationale: input.rationale ?? "Suggested edit",
    status: "pending",
  };
  session.suggestions.push(suggestion);
  session.events.push(event("suggestion.created", user.id, { suggestionId: suggestion.id }));
  return suggestion;
}

export function addNotebookCell(document, input) {
  const notebook = document.notebook ?? { kernel: input.kernel ?? "python", cells: [] };
  const cell = {
    id: input.id ?? `cell_${notebook.cells.length + 1}`,
    language: input.language ?? notebook.kernel,
    source: input.source,
    outputs: input.outputs ?? [],
    comments: input.comments ?? [],
    execution: {
      status: input.status ?? "idle",
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
    },
  };

  return {
    ...document,
    notebook: {
      ...notebook,
      cells: [...notebook.cells, cell],
    },
  };
}

export function autosaveDocument(document, patch, note = "Autosave") {
  const updated = {
    ...document,
    ...patch,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  };
  return {
    ...updated,
    references: extractCrossReferences(updated.body),
    equations: extractLatexEquations(updated.body),
    codeBlocks: extractCodeBlocks(updated.body),
    versions: [...document.versions, createSnapshot(updated, note, updated.updatedAt)],
    autosave: {
      ...document.autosave,
      lastSavedAt: updated.updatedAt,
    },
  };
}

export function restoreVersion(document, versionId) {
  const snapshot = document.versions.find((version) => version.id === versionId);
  if (!snapshot) {
    throw new Error(`Version ${versionId} was not found`);
  }
  return autosaveDocument(
    document,
    {
      body: snapshot.body,
      title: snapshot.title,
      updatedAt: new Date().toISOString(),
    },
    `Restored ${snapshot.label}`,
  );
}

export function addTask(session, input) {
  const assignee = requireUser(session, input.assigneeId);
  const task = {
    id: input.id ?? `task_${hash(`${input.anchor}:${input.title}`).slice(0, 10)}`,
    title: input.title,
    anchor: input.anchor,
    assigneeId: assignee.id,
    dueAt: input.dueAt,
    status: input.status ?? "open",
  };
  session.tasks.push(task);
  session.events.push(event("task.created", input.assigneeId, { taskId: task.id }));
  return task;
}

export function buildEditorManifest(document, session) {
  return {
    documentId: document.id,
    title: document.title,
    format: document.format,
    supports: {
      markdown: true,
      latex: document.equations.length > 0,
      citations: document.citations.length > 0,
      jupyter: Boolean(document.notebook?.cells.length),
      wysiwygToggle: true,
      livePresence: session.users.size > 0,
      autosave: document.autosave.enabled,
      versionRestore: document.versions.length > 0,
      inlineTasks: session.tasks.length > 0,
    },
    counts: {
      collaborators: session.users.size,
      comments: session.comments.length,
      suggestions: session.suggestions.length,
      versions: document.versions.length,
      notebookCells: document.notebook?.cells.length ?? 0,
      tasks: session.tasks.length,
    },
  };
}

export function createDemoEditorWorkspace() {
  let document = createResearchDocument({
    title: "Genome Assembly Draft",
    body:
      "See [fig:workflow]. Inline model $y = mx + b$.\n\n```python\nprint('quality-control')\n```",
    citations: [{ id: "smith2026", title: "Assembly Methods", doi: "10.1000/test" }],
    collaborators: [
      { id: "u_alice", name: "Alice", role: "owner" },
      { id: "u_bob", name: "Bob", role: "reviewer" },
    ],
    createdAt: "2026-05-13T08:00:00.000Z",
  });
  document = addNotebookCell(document, {
    language: "python",
    source: "df.describe()",
    outputs: [{ type: "table", rows: 5 }],
    comments: [{ userId: "u_bob", body: "Check missing values." }],
    status: "completed",
  });

  const session = createCollaborationSession(document);
  joinSession(session, { id: "u_alice", name: "Alice", role: "owner" }, { section: "abstract", offset: 12 });
  joinSession(session, { id: "u_bob", name: "Bob", role: "reviewer" }, { section: "methods", offset: 48 });
  addInlineComment(session, {
    userId: "u_bob",
    anchor: "methods:p2",
    body: "Please clarify the sampling method.",
  });
  addSuggestion(session, {
    userId: "u_alice",
    anchor: "abstract:s1",
    original: "fast",
    replacement: "statistically robust",
  });
  addTask(session, {
    title: "Resolve reviewer note",
    anchor: "methods:p2",
    assigneeId: "u_alice",
    dueAt: "2026-05-20",
  });

  return {
    document,
    session: serializeSession(session),
    manifest: buildEditorManifest(document, session),
  };
}

function serializeSession(session) {
  return {
    ...session,
    users: [...session.users.values()],
    locks: [...session.locks.values()],
  };
}

function normalizeCollaborators(collaborators) {
  return collaborators.map((collaborator) => {
    assertRole(collaborator.role);
    return {
      id: collaborator.id,
      name: collaborator.name,
      role: collaborator.role,
      color: collaborator.color ?? colorFor(collaborator.id),
    };
  });
}

function normalizeCitations(citations) {
  return citations.map((citation) => ({
    id: citation.id,
    title: citation.title,
    authors: citation.authors ?? [],
    doi: citation.doi ?? null,
    bibtexKey: citation.bibtexKey ?? citation.id,
  }));
}

function extractLatexEquations(body) {
  const equations = [];
  for (const match of body.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+)\$/g)) {
    equations.push((match[1] ?? match[2]).trim());
  }
  return equations;
}

function extractCrossReferences(body) {
  const refs = [];
  for (const match of body.matchAll(/\[(fig|table|eq|sec):([a-z0-9_-]+)\]/gi)) {
    refs.push({ type: match[1].toLowerCase(), id: match[2] });
  }
  return refs;
}

function extractCodeBlocks(body) {
  const blocks = [];
  for (const match of body.matchAll(/```(\w+)?\n([\s\S]*?)```/g)) {
    blocks.push({ language: match[1] ?? "text", source: match[2].trim() });
  }
  return blocks;
}

function createSnapshot(document, label, createdAt) {
  return {
    id: `version_${hash(`${document.id}:${label}:${document.body}`).slice(0, 12)}`,
    label,
    title: document.title,
    body: document.body,
    checksum: hash(document.body),
    createdAt,
  };
}

function requireUser(session, userId) {
  const user = session.users.get(userId);
  if (!user) {
    throw new Error(`Unknown collaborator ${userId}`);
  }
  return user;
}

function assertRole(role) {
  if (!ROLES.has(role)) {
    throw new Error(`Unsupported collaborator role ${role}`);
  }
}

function assertCanEdit(user) {
  if (!EDIT_ROLES.has(user.role)) {
    throw new Error(`${user.role} cannot edit this document`);
  }
}

function event(type, userId, payload) {
  return {
    type,
    userId,
    payload,
    createdAt: new Date().toISOString(),
  };
}

function colorFor(value) {
  return `#${hash(value).slice(0, 6)}`;
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
