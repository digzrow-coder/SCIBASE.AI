import http from "node:http"
import { fileURLToPath } from "node:url"
import { createDemoKnowledgeGraphWorkspace } from "./knowledge-graph.js"

const DEFAULT_PORT = 4316

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
  <title>SCIBASE Knowledge Graph Demo</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 28px; line-height: 1.15; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    button { border: 0; border-radius: 6px; background: #4338ca; color: white; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel { background: white; border: 1px solid #d9dfeb; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(20, 30, 50, .06); }
    .wide { grid-column: 1 / -1; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .card { border-left: 4px solid #4338ca; background: #f6f5ff; border-radius: 6px; padding: 10px 12px; }
    .muted { color: #607089; font-size: 13px; }
    .metric { display: inline-block; border: 1px solid #cfcbff; border-radius: 999px; padding: 6px 10px; margin: 0 8px 8px 0; background: #f6f5ff; }
    pre { margin: 0; max-height: 280px; overflow: auto; background: #101828; color: #d6e4ff; padding: 12px; border-radius: 6px; font-size: 12px; }
    @media (max-width: 820px) { main { padding: 18px; } header, .grid, .cards { display: grid; grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Scientific Knowledge Graph</h1>
        <div class="muted">Live browser proof: extraction, graph stats, semantic search, entity pages, recommendations, JSON-LD export.</div>
      </div>
      <button id="refresh" type="button">Run Demo API</button>
    </header>
    <section class="grid">
      <div class="panel"><h2>Graph Stats</h2><div id="stats"></div></div>
      <div class="panel"><h2>Entity Page</h2><div id="entity"></div></div>
      <div class="panel wide"><h2>Nodes</h2><div class="cards" id="nodes"></div></div>
      <div class="panel"><h2>Recommendations</h2><div id="recommendations"></div></div>
      <div class="panel"><h2>Raw API Payload</h2><pre id="payload"></pre></div>
    </section>
  </main>
  <script>
    async function loadDemo() {
      const response = await fetch("/demo-graph");
      const data = await response.json();
      document.getElementById("stats").innerHTML = '<span class="metric">entities: <strong>' + data.graph.stats.entity_count + '</strong></span><span class="metric">relationships: <strong>' + data.graph.stats.relationship_count + '</strong></span><div>' + data.graph.stats.entity_types.map((type) => '<span class="metric">' + type + '</span>').join("") + '</div>';
      document.getElementById("entity").innerHTML = '<div class="card"><strong>' + data.entity_page.entity.label + '</strong><div>' + data.entity_page.relationships.length + ' relationships</div><div class="muted">' + data.entity_page.linked_data.identifier + '</div></div>';
      document.getElementById("nodes").innerHTML = data.graph.nodes.map((node) => '<div class="card"><strong>' + node.label + '</strong><div>' + node.type + '</div><div class="muted">' + node.entity_id + '</div></div>').join("");
      document.getElementById("recommendations").innerHTML = data.recommendations.map((item) => '<div class="card"><strong>' + item.entity.label + '</strong><div>score: ' + item.score + '</div></div>').join("");
      document.getElementById("payload").textContent = JSON.stringify(data, null, 2);
    }
    document.getElementById("refresh").addEventListener("click", loadDemo);
    loadDemo();
  </script>
</body>
</html>`;
}

export function createKnowledgeGraphDemoServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")
    if (request.method === "GET" && url.pathname === "/") return sendHtml(response, renderDemoPage())
    if (request.method === "GET" && url.pathname === "/health") return sendJson(response, 200, { status: "ok", service: "scientific-knowledge-graph" })
    if (request.method === "GET" && url.pathname === "/demo-graph") return sendJson(response, 200, createDemoKnowledgeGraphWorkspace())
    sendJson(response, 404, { error: "Not found", routes: ["GET /", "GET /health", "GET /demo-graph"] })
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT)
  createKnowledgeGraphDemoServer().listen(port, () => {
    console.log(`Knowledge graph demo listening on http://localhost:${port}`)
  })
}
