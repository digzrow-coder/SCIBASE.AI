import http from "node:http";
import { fileURLToPath } from "node:url";
import { createDemoHostingWorkspace } from "./hosting.js";

const DEFAULT_PORT = 4317;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response, html) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
}

function renderDemoPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SCIBASE Data Code Hosting Demo</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 28px; line-height: 1.15; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    button { border: 0; border-radius: 6px; background: #7c2d12; color: white; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel { background: white; border: 1px solid #d9dfeb; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(20, 30, 50, .06); }
    .wide { grid-column: 1 / -1; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .card { border-left: 4px solid #7c2d12; background: #fff7ed; border-radius: 6px; padding: 10px 12px; }
    .muted { color: #607089; font-size: 13px; }
    .pill { display: inline-block; border: 1px solid #fed7aa; border-radius: 999px; padding: 6px 10px; margin: 0 8px 8px 0; background: #fff7ed; }
    pre { margin: 0; max-height: 280px; overflow: auto; background: #101828; color: #d6e4ff; padding: 12px; border-radius: 6px; font-size: 12px; }
    @media (max-width: 820px) { main { padding: 18px; } header, .grid, .cards { display: grid; grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Scientific Data & Code Hosting</h1>
        <div class="muted">Live browser proof: artifact records, versions, previews, FAIR checks, execution jobs.</div>
      </div>
      <button id="refresh" type="button">Run Demo API</button>
    </header>
    <section class="grid">
      <div class="panel wide"><h2>Artifacts</h2><div class="cards" id="artifacts"></div></div>
      <div class="panel"><h2>FAIR Status</h2><div id="fair"></div></div>
      <div class="panel"><h2>Execution Jobs</h2><div id="jobs"></div></div>
      <div class="panel"><h2>Previews</h2><div id="previews"></div></div>
      <div class="panel"><h2>Raw API Payload</h2><pre id="payload"></pre></div>
    </section>
  </main>
  <script>
    async function loadDemo() {
      const response = await fetch("/demo-hosting");
      const data = await response.json();
      document.getElementById("artifacts").innerHTML = data.artifacts.map((artifact) => '<div class="card"><strong>' + artifact.filename + '</strong><div>' + artifact.type + '</div><div class="muted">' + artifact.folder + ' - v' + artifact.versions.length + '</div></div>').join("");
      document.getElementById("fair").innerHTML = Object.entries(data.fair.dataset).map(([key, value]) => '<span class="pill">' + key + ': <strong>' + value + '</strong></span>').join("");
      document.getElementById("jobs").innerHTML = data.execution_jobs.map((job) => '<div class="card"><strong>' + job.runtime + '</strong><div>' + job.entrypoint + '</div><div class="muted">' + job.triggers[0].type + '</div></div>').join("");
      document.getElementById("previews").innerHTML = Object.entries(data.previews).map(([key, preview]) => '<div class="card"><strong>' + key + '</strong><div>' + preview.kind + '</div><div class="muted">' + (preview.columns || preview.lines || [preview.filename || preview.alt]).join(", ") + '</div></div>').join("");
      document.getElementById("payload").textContent = JSON.stringify(data, null, 2);
    }
    document.getElementById("refresh").addEventListener("click", loadDemo);
    loadDemo();
  </script>
</body>
</html>`;
}

export function createHostingDemoServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/") return sendHtml(response, renderDemoPage());
    if (request.method === "GET" && url.pathname === "/health") return sendJson(response, 200, { status: "ok", service: "scientific-data-code-hosting" });
    if (request.method === "GET" && url.pathname === "/demo-hosting") return sendJson(response, 200, createDemoHostingWorkspace());
    sendJson(response, 404, { error: "Not found", routes: ["GET /", "GET /health", "GET /demo-hosting"] });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  createHostingDemoServer().listen(port, () => {
    console.log(`Data/code hosting demo listening on http://localhost:${port}`);
  });
}
