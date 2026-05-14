import http from "node:http"
import { fileURLToPath } from "node:url"
import { createDemoEnterpriseWorkspace } from "./enterprise.js"

const DEFAULT_PORT = 4318

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(payload, null, 2))
}

function sendHtml(response, html) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
  response.end(html)
}

function renderDemoPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SCIBASE Enterprise Tooling Demo</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 28px; line-height: 1.15; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    button { border: 0; border-radius: 6px; background: #334155; color: white; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel { background: white; border: 1px solid #d9dfeb; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(20, 30, 50, .06); }
    .wide { grid-column: 1 / -1; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .card { border-left: 4px solid #334155; background: #f8fafc; border-radius: 6px; padding: 10px 12px; }
    .muted { color: #607089; font-size: 13px; }
    .metric { display: inline-block; border: 1px solid #cbd5e1; border-radius: 999px; padding: 6px 10px; margin: 0 8px 8px 0; background: #f8fafc; }
    pre { margin: 0; max-height: 280px; overflow: auto; background: #101828; color: #d6e4ff; padding: 12px; border-radius: 6px; font-size: 12px; }
    @media (max-width: 820px) { main { padding: 18px; } header, .grid, .cards { display: grid; grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Enterprise Tooling</h1>
        <div class="muted">Live browser proof: SAML org profile, RBAC, admin dashboard, compliance, integrations, audit log, productivity.</div>
      </div>
      <button id="refresh" type="button">Run Demo API</button>
    </header>
    <section class="grid">
      <div class="panel"><h2 id="org">Loading...</h2><div id="domains"></div></div>
      <div class="panel"><h2>Dashboard</h2><div id="dashboard"></div></div>
      <div class="panel wide"><h2>Roles & Integrations</h2><div class="cards" id="cards"></div></div>
      <div class="panel"><h2>Compliance & Audit</h2><div id="audit"></div></div>
      <div class="panel"><h2>Raw API Payload</h2><pre id="payload"></pre></div>
    </section>
  </main>
  <script>
    async function loadDemo() {
      const response = await fetch("/demo-enterprise");
      const data = await response.json();
      document.getElementById("org").textContent = data.organization.name;
      document.getElementById("domains").innerHTML = data.organization.domains.map((domain) => '<span class="metric">' + domain + '</span>').join("") + '<div class="muted">' + data.organization.saml_entity_id + '</div>';
      document.getElementById("dashboard").innerHTML = Object.entries(data.dashboard).filter(([, value]) => typeof value !== "object").map(([key, value]) => '<span class="metric">' + key.replaceAll("_", " ") + ': <strong>' + value + '</strong></span>').join("");
      document.getElementById("cards").innerHTML = [...data.roles, ...data.integrations].map((item) => '<div class="card"><strong>' + (item.role || item.provider) + '</strong><div>' + (item.user_id || item.type) + '</div><div class="muted">' + (item.permissions || item.scopes || []).join(", ") + '</div></div>').join("");
      document.getElementById("audit").innerHTML = [...data.compliance, ...data.audit_log].map((item) => '<div class="card"><strong>' + (item.mandate || item.action) + '</strong><div class="muted">' + (item.requirement || item.actor_id + " -> " + item.target_id) + '</div></div>').join("");
      document.getElementById("payload").textContent = JSON.stringify(data, null, 2);
    }
    document.getElementById("refresh").addEventListener("click", loadDemo);
    loadDemo();
  </script>
</body>
</html>`;
}

export function createEnterpriseDemoServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")
    if (request.method === "GET" && url.pathname === "/") return sendHtml(response, renderDemoPage())
    if (request.method === "GET" && url.pathname === "/health") return sendJson(response, 200, { status: "ok", service: "enterprise-tooling" })
    if (request.method === "GET" && url.pathname === "/demo-enterprise") return sendJson(response, 200, createDemoEnterpriseWorkspace())
    sendJson(response, 404, { error: "Not found", routes: ["GET /", "GET /health", "GET /demo-enterprise"] })
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT)
  createEnterpriseDemoServer().listen(port, () => {
    console.log(`Enterprise tooling demo listening on http://localhost:${port}`)
  })
}
