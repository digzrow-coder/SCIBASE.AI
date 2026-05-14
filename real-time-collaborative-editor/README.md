# Real-Time Collaborative Research Editor

This module is a compact MVP for SCIBASE issue #12. It models a browser-based research editor that can coordinate scientific documents, notebook cells, comments, suggestions, live presence, section locks, autosave history, and task anchors without depending on a specific frontend framework.

## Capabilities

- Creates Markdown-first research documents with LaTeX equation extraction.
- Tracks cross references such as figures, tables, equations, and sections.
- Normalizes citation metadata for BibTeX, DOI, Zotero, or EndNote-style records.
- Supports WYSIWYG and Markdown mode metadata for editor toggles.
- Embeds Jupyter-style notebook cells with execution status, outputs, and review comments.
- Manages live collaborators, cursor positions, presence status, and section locks.
- Captures inline comments, proposed text replacements, and review suggestions.
- Maintains autosave snapshots with checksums and restores named versions.
- Links inline tasks to document sections, reviewers, and deadlines.
- Builds an editor manifest that a UI can use to enable rich scientific formatting, collaboration, version history, notebook support, and task workflow features.

## Files

- `src/editor.js` contains the editor/session domain functions.
- `src/demo.js` prints a complete demo workspace for reviewer inspection.
- `src/server.js` exposes a dependency-free local demo UI and API.
- `test/editor.test.js` covers the expected workflows.
- `package.json` runs the Node test suite.

## Example

```js
import {
  addInlineComment,
  buildEditorManifest,
  createCollaborationSession,
  createResearchDocument,
  joinSession,
} from "./src/editor.js";

const document = createResearchDocument({
  title: "Genome Assembly Draft",
  body: "See [fig:workflow]. Inline equation $y = mx + b$.",
  citations: [{ id: "smith2026", title: "Assembly Methods" }],
  collaborators: [{ id: "u_alice", name: "Alice", role: "owner" }],
});

const session = createCollaborationSession(document);
joinSession(session, { id: "u_bob", name: "Bob", role: "reviewer" });
addInlineComment(session, {
  userId: "u_bob",
  anchor: "methods:p2",
  body: "Please clarify the sampling method.",
});

console.log(buildEditorManifest(document, session));
```

## Runnable Demo

```bash
npm run demo
npm run serve
```

`npm run demo` prints a complete editor workspace with a scientific document,
two active collaborators, notebook output, comments, suggestions, tasks, and
the UI capability manifest.

`npm run serve` starts a local demo API:

- `GET /`
- `GET /health`
- `GET /demo-workspace`

Example:

```bash
open http://localhost:4312/
curl http://localhost:4312/demo-workspace
```

## Verification

```bash
npm test
```
