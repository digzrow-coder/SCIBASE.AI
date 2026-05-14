import http from "node:http"
import { fileURLToPath } from "node:url"
import { createDemoRepositoryWorkspace } from "./repository.js"

const DEFAULT_PORT = 4310

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  })
  response.end(JSON.stringify(payload, null, 2))
}

function sendHtml(response, html) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
  })
  response.end(html)
}

function renderDemoPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SCIBASE Repository Demo</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 28px; line-height: 1.15; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    button { border: 0; border-radius: 6px; background: #a44512; color: white; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel { background: white; border: 1px solid #d9dfeb; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(20, 30, 50, .06); }
    .wide { grid-column: 1 / -1; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .card { border-left: 4px solid #a44512; background: #fff8f4; border-radius: 6px; padding: 10px 12px; min-height: 70px; }
    .muted { color: #607089; font-size: 13px; }
    .pill { display: inline-block; border: 1px solid #e8cfbf; border-radius: 999px; padding: 5px 9px; margin: 0 6px 6px 0; background: #fff8f4; }
    pre { margin: 0; max-height: 280px; overflow: auto; background: #101828; color: #d6e4ff; padding: 12px; border-radius: 6px; font-size: 12px; }
    @media (max-width: 820px) { main { padding: 18px; } header, .grid, .cards { display: grid; grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Project Repository & Version Control</h1>
        <div class="muted">Live browser proof: repository sections, commits, diffs, forks, merge requests, reproducibility, citation/export metadata.</div>
      </div>
      <button id="refresh" type="button">Run Demo API</button>
    </header>
    <section class="grid">
      <div class="panel"><h2 id="repo">Loading...</h2><div id="sections"></div></div>
      <div class="panel"><h2>Reproducibility</h2><div id="checks"></div></div>
      <div class="panel wide"><h2>Revision Timeline</h2><div class="cards" id="timeline"></div></div>
      <div class="panel"><h2>Diff & Merge Request</h2><div id="merge"></div></div>
      <div class="panel"><h2>Raw API Payload</h2><pre id="payload"></pre></div>
    </section>
  </main>
  <script>
    async function loadDemo() {
      const response = await fetch("/demo-repository");
      const data = await response.json();
      document.getElementById("repo").textContent = data.repository.title + " (" + data.repository.visibility + ")";
      document.getElementById("sections").innerHTML = data.repository.sections.map((section) => '<span class="pill">' + section.name + '</span>').join("");
      document.getElementById("checks").innerHTML = data.reproducibility.checks.map((check) => '<div class="card"><strong>' + check.name + '</strong><div class="muted">passed: ' + check.passed + '</div></div>').join("");
      document.getElementById("timeline").innerHTML = data.timeline.map((event) => '<div class="card"><strong>' + event.commit_id + '</strong><div>' + event.message + '</div><div class="muted">' + event.artifact_count + ' artifacts, tags: ' + event.tags.length + '</div></div>').join("");
      document.getElementById("merge").innerHTML = '<div class="card"><strong>' + data.merge_request.title + '</strong><div>Status: ' + data.merge_request.status + ', mergeable: ' + data.merge_request.mergeable + '</div><div class="muted">Added: ' + data.diff.added.join(", ") + '</div><div class="muted">Modified: ' + data.diff.modified.join(", ") + '</div></div>';
      document.getElementById("payload").textContent = JSON.stringify(data, null, 2);
    }
    document.getElementById("refresh").addEventListener("click", loadDemo);
    loadDemo();
  </script>
</body>
</html>`;
}

export function createRepositoryDemoServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")

    if (request.method === "GET" && url.pathname === "/") {
      sendHtml(response, renderDemoPage())
      return
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "project-repository-version-control" })
      return
    }

    if (request.method === "GET" && url.pathname === "/demo-repository") {
      sendJson(response, 200, createDemoRepositoryWorkspace())
      return
    }

    sendJson(response, 404, {
      error: "Not found",
      routes: ["GET /", "GET /health", "GET /demo-repository"],
    })
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT)
  createRepositoryDemoServer().listen(port, () => {
    console.log(`Repository demo API listening on http://localhost:${port}`)
  })
}
