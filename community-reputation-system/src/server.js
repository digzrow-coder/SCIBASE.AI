import http from "node:http"
import { fileURLToPath } from "node:url"
import { createDemoCommunityWorkspace } from "./reputation.js"

const DEFAULT_PORT = 4314

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
  <title>SCIBASE Community Reputation Demo</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 28px; line-height: 1.15; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    button { border: 0; border-radius: 6px; background: #0f766e; color: white; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel { background: white; border: 1px solid #d9dfeb; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(20, 30, 50, .06); }
    .wide { grid-column: 1 / -1; }
    .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .card { border-left: 4px solid #0f766e; background: #f0fdfa; border-radius: 6px; padding: 10px 12px; }
    .muted { color: #607089; font-size: 13px; }
    .pill { display: inline-block; border: 1px solid #bfe4df; border-radius: 999px; padding: 5px 9px; margin: 0 6px 6px 0; background: #f0fdfa; }
    pre { margin: 0; max-height: 280px; overflow: auto; background: #101828; color: #d6e4ff; padding: 12px; border-radius: 6px; font-size: 12px; }
    @media (max-width: 820px) { main { padding: 18px; } header, .grid, .cards { display: grid; grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Community & Reputation System</h1>
        <div class="muted">Live browser proof: peer reviews, inline comments, CRediT contributions, reputation scoring, badges, timelines, leaderboards.</div>
      </div>
      <button id="refresh" type="button">Run Demo API</button>
    </header>
    <section class="grid">
      <div class="panel"><h2>Review Template</h2><div id="template"></div></div>
      <div class="panel"><h2>Leaderboard</h2><div id="leaderboard"></div></div>
      <div class="panel wide"><h2>Reviews & Credits</h2><div class="cards" id="activity"></div></div>
      <div class="panel"><h2>Badges</h2><div id="badges"></div></div>
      <div class="panel"><h2>Raw API Payload</h2><pre id="payload"></pre></div>
    </section>
  </main>
  <script>
    async function loadDemo() {
      const response = await fetch("/demo-community");
      const data = await response.json();
      document.getElementById("template").innerHTML = '<strong>' + data.review_template.discipline + '</strong><div>' + data.review_template.criteria.map((criterion) => '<span class="pill">' + criterion + '</span>').join("") + '</div>';
      document.getElementById("leaderboard").innerHTML = data.leaderboard.map((entry) => '<div class="card"><strong>' + entry.display_name + '</strong><div>Score: ' + entry.reputation_score + '</div><div class="muted">' + entry.badges.join(", ") + '</div></div>').join("");
      document.getElementById("activity").innerHTML = [...data.reviews, ...data.contributions].map((item) => '<div class="card"><strong>' + (item.timeline_event || item.source_type) + '</strong><div>' + (item.target_type || item.roles.join(", ")) + '</div><div class="muted">' + (item.comments?.[0]?.body || item.description) + '</div></div>').join("");
      document.getElementById("badges").innerHTML = Object.entries(data.reputations).map(([name, reputation]) => '<div class="card"><strong>' + name + '</strong><div>Score: ' + reputation.score + '</div><div>' + reputation.badges.map((badge) => '<span class="pill">' + badge + '</span>').join("") + '</div></div>').join("");
      document.getElementById("payload").textContent = JSON.stringify(data, null, 2);
    }
    document.getElementById("refresh").addEventListener("click", loadDemo);
    loadDemo();
  </script>
</body>
</html>`;
}

export function createCommunityDemoServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")

    if (request.method === "GET" && url.pathname === "/") {
      sendHtml(response, renderDemoPage())
      return
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "community-reputation-system" })
      return
    }

    if (request.method === "GET" && url.pathname === "/demo-community") {
      sendJson(response, 200, createDemoCommunityWorkspace())
      return
    }

    sendJson(response, 404, {
      error: "Not found",
      routes: ["GET /", "GET /health", "GET /demo-community"],
    })
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT)
  createCommunityDemoServer().listen(port, () => {
    console.log(`Community reputation demo listening on http://localhost:${port}`)
  })
}
