import http from "node:http"
import { fileURLToPath } from "node:url"
import { createDemoUserProjectWorkspace } from "./userProjectManagement.js"

const DEFAULT_PORT = 4311

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
  <title>SCIBASE User Project Demo</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 28px; line-height: 1.15; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    button { border: 0; border-radius: 6px; background: #176f47; color: white; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel { background: white; border: 1px solid #d9dfeb; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(20, 30, 50, .06); }
    .wide { grid-column: 1 / -1; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .card { border-left: 4px solid #176f47; background: #f5fbf7; border-radius: 6px; padding: 10px 12px; min-height: 70px; }
    .muted { color: #607089; font-size: 13px; }
    .checks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .check { padding: 8px 10px; border-radius: 6px; background: #eef8f2; border: 1px solid #cfe8da; }
    pre { margin: 0; max-height: 280px; overflow: auto; background: #101828; color: #d6e4ff; padding: 12px; border-radius: 6px; font-size: 12px; }
    @media (max-width: 820px) { main { padding: 18px; } header, .grid, .cards, .checks { display: grid; grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>User & Project Management</h1>
        <div class="muted">Live browser proof: identity, ORCID/SAML links, RBAC, invitations, object policies, audit log, reputation metrics.</div>
      </div>
      <button id="refresh" type="button">Run Demo API</button>
    </header>
    <section class="grid">
      <div class="panel"><h2 id="project">Loading...</h2><div id="identity"></div></div>
      <div class="panel"><h2>Access Checks</h2><div class="checks" id="checks"></div></div>
      <div class="panel wide"><h2>Workspace Assets</h2><div class="cards" id="assets"></div></div>
      <div class="panel"><h2>Audit Log</h2><div id="audit"></div></div>
      <div class="panel"><h2>Raw API Payload</h2><pre id="payload"></pre></div>
    </section>
  </main>
  <script>
    async function loadDemo() {
      const response = await fetch("/demo-workspace");
      const data = await response.json();
      document.getElementById("project").textContent = data.project.title + " (" + data.project.visibility + ")";
      document.getElementById("identity").innerHTML = '<strong>' + data.profile.name + '</strong><div class="muted">' + data.profile.institution + ' - MFA ' + (data.account.two_factor_enabled ? 'enabled' : 'disabled') + '</div><div>' + data.account.linked_identities.map((id) => id.provider.toUpperCase()).join(" + ") + '</div><div class="muted">Reputation score: ' + data.metrics.reputation_score + '</div>';
      document.getElementById("checks").innerHTML = Object.entries(data.access_checks).map(([key, value]) => '<div class="check">' + key.replaceAll("_", " ") + ': <strong>' + value + '</strong></div>').join("");
      const assets = [...data.project.documents, ...data.project.code, ...data.project.datasets, ...data.project.discussions];
      document.getElementById("assets").innerHTML = assets.map((asset) => '<div class="card"><strong>' + (asset.title || asset.name) + '</strong><div class="muted">' + (asset.path || asset.discussion_id) + '</div></div>').join("");
      document.getElementById("audit").innerHTML = data.audit_log.map((event) => '<div class="card"><strong>' + event.action + '</strong><div class="muted">' + event.actor_id + ' -> ' + event.target_id + '</div></div>').join("");
      document.getElementById("payload").textContent = JSON.stringify(data, null, 2);
    }
    document.getElementById("refresh").addEventListener("click", loadDemo);
    loadDemo();
  </script>
</body>
</html>`;
}

export function createUserProjectDemoServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")

    if (request.method === "GET" && url.pathname === "/") {
      sendHtml(response, renderDemoPage())
      return
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "user-project-management" })
      return
    }

    if (request.method === "GET" && url.pathname === "/demo-workspace") {
      sendJson(response, 200, createDemoUserProjectWorkspace())
      return
    }

    sendJson(response, 404, {
      error: "Not found",
      routes: ["GET /", "GET /health", "GET /demo-workspace"],
    })
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT)
  createUserProjectDemoServer().listen(port, () => {
    console.log(`User/project management demo API listening on http://localhost:${port}`)
  })
}
