import assert from "node:assert/strict";
import test from "node:test";
import { createEditorDemoServer } from "../src/server.js";
import {
  addInlineComment,
  addNotebookCell,
  addSuggestion,
  addTask,
  autosaveDocument,
  buildEditorManifest,
  createCollaborationSession,
  createDemoEditorWorkspace,
  createResearchDocument,
  joinSession,
  lockSection,
  restoreVersion,
  updateCursor,
} from "../src/editor.js";

const collaborators = [
  { id: "u_alice", name: "Alice", role: "owner" },
  { id: "u_bob", name: "Bob", role: "reviewer" },
];

test("creates a scientific document with markdown, LaTeX, citations, and references", () => {
  const document = createResearchDocument({
    title: "Genome Assembly Draft",
    body: "See [fig:workflow]. Inline model $y = mx + b$.\n\n```python\nprint('ok')\n```",
    citations: [{ id: "smith2026", title: "Assembly Methods", doi: "10.1000/test" }],
    collaborators,
    createdAt: "2026-05-13T08:00:00.000Z",
  });

  assert.equal(document.format, "markdown");
  assert.equal(document.equations[0], "y = mx + b");
  assert.deepEqual(document.references, [{ type: "fig", id: "workflow" }]);
  assert.equal(document.codeBlocks[0].language, "python");
  assert.equal(document.citations[0].bibtexKey, "smith2026");
  assert.equal(document.versions.length, 1);
});

test("creates a runnable demo workspace with editor state and manifest", () => {
  const workspace = createDemoEditorWorkspace();

  assert.equal(workspace.document.title, "Genome Assembly Draft");
  assert.equal(workspace.session.users.length, 2);
  assert.equal(workspace.session.comments.length, 1);
  assert.equal(workspace.session.suggestions.length, 1);
  assert.equal(workspace.manifest.supports.latex, true);
  assert.equal(workspace.manifest.supports.jupyter, true);
  assert.equal(workspace.manifest.counts.tasks, 1);
});

test("serves the demo workspace over the local API", async () => {
  const server = createEditorDemoServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(healthResponse.status, 200);
    assert.equal((await healthResponse.json()).status, "ok");

    const pageResponse = await fetch(`http://127.0.0.1:${port}/`);
    const pageHtml = await pageResponse.text();
    assert.equal(pageResponse.status, 200);
    assert.match(pageHtml, /Real-time Collaborative Research Editor/);

    const workspaceResponse = await fetch(`http://127.0.0.1:${port}/demo-workspace`);
    const workspace = await workspaceResponse.json();

    assert.equal(workspaceResponse.status, 200);
    assert.equal(workspace.document.title, "Genome Assembly Draft");
    assert.equal(workspace.manifest.supports.livePresence, true);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("tracks real-time presence, cursors, locks, comments, and suggestions", () => {
  const document = createResearchDocument({ title: "Draft", collaborators });
  const session = createCollaborationSession(document);

  joinSession(session, { id: "u_cara", name: "Cara", role: "contributor" });
  updateCursor(session, "u_cara", { section: "methods", offset: 42 });
  lockSection(session, "u_cara", "final-figure", "Freeze accepted plot");
  const comment = addInlineComment(session, {
    userId: "u_bob",
    anchor: "methods:p3",
    body: "Please clarify sample size.",
  });
  const suggestion = addSuggestion(session, {
    userId: "u_cara",
    anchor: "abstract:s1",
    original: "fast",
    replacement: "statistically robust",
  });

  assert.equal(session.users.get("u_cara").cursor.offset, 42);
  assert.equal(session.locks.get("final-figure").reason, "Freeze accepted plot");
  assert.equal(comment.status, "open");
  assert.equal(suggestion.status, "pending");
  assert.equal(session.events.length, 5);
});

test("adds executable notebook cells with inline review metadata", () => {
  const document = createResearchDocument({ title: "Notebook Draft", collaborators });
  const withCell = addNotebookCell(document, {
    language: "python",
    source: "df.describe()",
    outputs: [{ type: "table", rows: 5 }],
    comments: [{ userId: "u_bob", body: "Check missing values." }],
    status: "completed",
  });

  assert.equal(withCell.notebook.kernel, "python");
  assert.equal(withCell.notebook.cells[0].outputs[0].type, "table");
  assert.equal(withCell.notebook.cells[0].comments[0].body, "Check missing values.");
});

test("autosaves versions and restores a prior snapshot", () => {
  const document = createResearchDocument({
    title: "Versioned Draft",
    body: "Initial content",
    collaborators,
  });
  const firstVersion = document.versions[0].id;
  const updated = autosaveDocument(document, {
    body: "Updated content with [sec:methods]",
    updatedAt: "2026-05-13T09:00:00.000Z",
  });
  const restored = restoreVersion(updated, firstVersion);

  assert.equal(updated.versions.length, 2);
  assert.deepEqual(updated.references, [{ type: "sec", id: "methods" }]);
  assert.equal(restored.body, "Initial content");
  assert.equal(restored.versions.length, 3);
});

test("builds a manifest covering editor capabilities and inline task workflow", () => {
  let document = createResearchDocument({
    title: "Manifest Draft",
    body: "$E = mc^2$",
    citations: [{ id: "einstein1905", title: "Relativity" }],
    collaborators,
  });
  document = addNotebookCell(document, { source: "plot(results)" });
  const session = createCollaborationSession(document);
  addInlineComment(session, { userId: "u_bob", anchor: "intro:p1", body: "Needs citation." });
  addTask(session, {
    title: "Resolve reviewer note",
    anchor: "intro:p1",
    assigneeId: "u_alice",
    dueAt: "2026-05-20",
  });

  const manifest = buildEditorManifest(document, session);

  assert.equal(manifest.supports.markdown, true);
  assert.equal(manifest.supports.latex, true);
  assert.equal(manifest.supports.citations, true);
  assert.equal(manifest.supports.jupyter, true);
  assert.equal(manifest.supports.inlineTasks, true);
  assert.equal(manifest.counts.tasks, 1);
});
