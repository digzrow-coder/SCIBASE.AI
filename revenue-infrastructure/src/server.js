import http from "node:http"
import { fileURLToPath } from "node:url"
import { createDemoRevenueWorkspace } from "./revenue.js"

const DEFAULT_PORT = 4315

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
  <title>SCIBASE Revenue Infrastructure Demo</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 28px; line-height: 1.15; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    button { border: 0; border-radius: 6px; background: #0b5cad; color: white; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel { background: white; border: 1px solid #d9dfeb; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(20, 30, 50, .06); }
    .wide { grid-column: 1 / -1; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .card { border-left: 4px solid #0b5cad; background: #f3f8ff; border-radius: 6px; padding: 10px 12px; }
    .muted { color: #607089; font-size: 13px; }
    .metric { display: inline-block; border: 1px solid #c5d9f2; border-radius: 999px; padding: 6px 10px; margin: 0 8px 8px 0; background: #f3f8ff; }
    pre { margin: 0; max-height: 280px; overflow: auto; background: #101828; color: #d6e4ff; padding: 12px; border-radius: 6px; font-size: 12px; }
    @media (max-width: 820px) { main { padding: 18px; } header, .grid, .cards { display: grid; grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Revenue Infrastructure</h1>
        <div class="muted">Live browser proof: SaaS plans, subscriptions, usage meters, invoices, licensing snapshots, revenue health.</div>
      </div>
      <button id="refresh" type="button">Run Demo API</button>
    </header>
    <section class="grid">
      <div class="panel wide"><h2>Plans</h2><div class="cards" id="plans"></div></div>
      <div class="panel"><h2>Revenue Health</h2><div id="health"></div></div>
      <div class="panel"><h2>Invoices</h2><div id="invoices"></div></div>
      <div class="panel"><h2>Licensing Snapshot</h2><div id="licensing"></div></div>
      <div class="panel"><h2>Raw API Payload</h2><pre id="payload"></pre></div>
    </section>
  </main>
  <script>
    async function loadDemo() {
      const response = await fetch("/demo-revenue");
      const data = await response.json();
      document.getElementById("plans").innerHTML = data.plans.map((plan) => '<div class="card"><strong>' + plan.name + '</strong><div>$' + plan.monthly_price + '/mo</div><div class="muted">' + plan.features.join(", ") + '</div></div>').join("");
      document.getElementById("health").innerHTML = Object.entries(data.revenue_health).map(([key, value]) => '<span class="metric">' + key.replaceAll("_", " ") + ': <strong>' + value + '</strong></span>').join("");
      document.getElementById("invoices").innerHTML = data.invoices.map((invoice) => '<div class="card"><strong>' + invoice.invoice_id + '</strong><div>Total: $' + invoice.total + '</div><div class="muted">' + invoice.provider + ' - ' + invoice.status + '</div></div>').join("");
      document.getElementById("licensing").innerHTML = '<div class="card"><strong>Products</strong><div>' + data.licensing_snapshot.licenseable_products.join(", ") + '</div><div class="muted">Average reproducibility: ' + data.licensing_snapshot.metrics.average_reproducibility + '</div></div>';
      document.getElementById("payload").textContent = JSON.stringify(data, null, 2);
    }
    document.getElementById("refresh").addEventListener("click", loadDemo);
    loadDemo();
  </script>
</body>
</html>`;
}

export function createRevenueDemoServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")

    if (request.method === "GET" && url.pathname === "/") {
      sendHtml(response, renderDemoPage())
      return
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "revenue-infrastructure" })
      return
    }

    if (request.method === "GET" && url.pathname === "/demo-revenue") {
      sendJson(response, 200, createDemoRevenueWorkspace())
      return
    }

    sendJson(response, 404, {
      error: "Not found",
      routes: ["GET /", "GET /health", "GET /demo-revenue"],
    })
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT)
  createRevenueDemoServer().listen(port, () => {
    console.log(`Revenue infrastructure demo listening on http://localhost:${port}`)
  })
}
