import http from "node:http";
import { fileURLToPath } from "node:url";
import { createDemoEditorWorkspace } from "./editor.js";

const DEFAULT_PORT = 4312;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response, html) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
  });
  response.end(html);
}

function renderDemoPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SCIBASE Collaborative Editor Demo</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f8fb; color: #172033; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 28px; line-height: 1.15; }
    button { border: 0; border-radius: 6px; background: #1f6feb; color: white; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, .8fr); gap: 16px; }
    .panel { background: white; border: 1px solid #d9dfeb; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(20, 30, 50, .06); }
    .doc { min-height: 250px; line-height: 1.55; white-space: pre-wrap; }
    .presence { display: flex; gap: 10px; flex-wrap: wrap; }
    .person { border: 1px solid #d9dfeb; border-radius: 999px; padding: 6px 10px; background: #fbfcff; font-size: 14px; }
    .columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .item { border-left: 4px solid #1f6feb; padding: 10px 12px; background: #f7faff; border-radius: 6px; }
    .muted { color: #607089; font-size: 13px; }
    pre { margin: 0; max-height: 260px; overflow: auto; background: #101828; color: #d6e4ff; padding: 12px; border-radius: 6px; font-size: 12px; }
    @media (max-width: 820px) { main { padding: 18px; } header, .grid, .columns { grid-template-columns: 1fr; display: grid; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Real-time Collaborative Research Editor</h1>
        <div class="muted">Live browser proof: document, presence, comments, suggestions, tasks, notebook metadata.</div>
      </div>
      <button id="refresh" type="button">Run Demo API</button>
    </header>
    <section class="grid">
      <div class="panel">
        <h2 id="title">Loading...</h2>
        <div class="muted" id="manifest"></div>
        <div class="doc" id="document"></div>
      </div>
      <aside class="panel">
        <h2>Presence</h2>
        <div class="presence" id="presence"></div>
        <h2>Notebook</h2>
        <div id="notebook"></div>
      </aside>
    </section>
    <section class="columns" style="margin-top:16px">
      <div class="panel"><h2>Review Workflow</h2><div id="review"></div></div>
      <div class="panel"><h2>Raw API Payload</h2><pre id="payload"></pre></div>
    </section>
  </main>
  <script>
    async function loadDemo() {
      const response = await fetch("/demo-workspace");
      const data = await response.json();
      document.getElementById("title").textContent = data.document.title;
      document.getElementById("manifest").textContent = data.manifest.counts.collaborators + " collaborators, " + data.manifest.counts.comments + " comment, " + data.manifest.counts.suggestions + " suggestion, " + data.manifest.counts.tasks + " task";
      document.getElementById("document").textContent = data.document.body;
      document.getElementById("presence").innerHTML = data.session.users.map((user) => '<span class="person" style="border-color:' + user.color + '">' + user.name + ' - ' + user.status + ' @ ' + user.cursor.section + '</span>').join("");
      document.getElementById("notebook").innerHTML = data.document.notebook.cells.map((cell) => '<div class="item"><strong>' + cell.language + '</strong><div class="muted">' + cell.source + '</div><div>' + cell.execution.status + ', ' + cell.outputs.length + ' output</div></div>').join("");
      const reviewItems = [...data.session.comments.map((comment) => "Comment: " + comment.body), ...data.session.suggestions.map((suggestion) => "Suggestion: " + suggestion.original + " -> " + suggestion.replacement), ...data.session.tasks.map((task) => "Task: " + task.title + " (" + task.status + ")")];
      document.getElementById("review").innerHTML = reviewItems.map((item) => '<div class="item">' + item + '</div>').join("");
      document.getElementById("payload").textContent = JSON.stringify(data, null, 2);
    }
    document.getElementById("refresh").addEventListener("click", loadDemo);
    loadDemo();
  </script>
</body>
</html>`;
}

export function createEditorDemoServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "GET" && url.pathname === "/") {
      sendHtml(response, renderDemoPage());
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "real-time-collaborative-editor" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/demo-workspace") {
      sendJson(response, 200, createDemoEditorWorkspace());
      return;
    }

    sendJson(response, 404, {
      error: "Not found",
      routes: ["GET /", "GET /health", "GET /demo-workspace"],
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  createEditorDemoServer().listen(port, () => {
    console.log(`Real-time editor demo API listening on http://localhost:${port}`);
  });
}
