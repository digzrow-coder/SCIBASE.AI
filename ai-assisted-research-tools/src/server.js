import http from "node:http"
import { fileURLToPath } from "node:url"
import { createResearchWorkflowReport } from "./research-tools.js"

const DEFAULT_PORT = 4313

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ""
    request.setEncoding("utf8")
    request.on("data", (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"))
        request.destroy()
      }
    })
    request.on("end", () => {
      try {
        resolve(body.trim() === "" ? {} : JSON.parse(body))
      } catch {
        reject(new Error("Invalid JSON body"))
      }
    })
    request.on("error", reject)
  })
}

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
  <title>SCIBASE AI Research Tools Demo</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 28px; line-height: 1.15; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    button { border: 0; border-radius: 6px; background: #6b4cf6; color: white; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    textarea { width: 100%; min-height: 150px; resize: vertical; border: 1px solid #d9dfeb; border-radius: 6px; padding: 10px; font: inherit; box-sizing: border-box; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel { background: white; border: 1px solid #d9dfeb; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(20, 30, 50, .06); }
    .wide { grid-column: 1 / -1; }
    .item { border-left: 4px solid #6b4cf6; background: #f8f6ff; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; }
    .muted { color: #607089; font-size: 13px; }
    .status { display: inline-block; border: 1px solid #d9dfeb; border-radius: 999px; padding: 5px 9px; background: #fbfcff; }
    pre { margin: 0; max-height: 280px; overflow: auto; background: #101828; color: #d6e4ff; padding: 12px; border-radius: 6px; font-size: 12px; }
    @media (max-width: 820px) { main { padding: 18px; } header, .grid { display: grid; grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>AI-Assisted Research Tools</h1>
        <div class="muted">Live browser proof: summaries, technical checks, citation graph, citation suggestions, peer-review aid, guarded invocation.</div>
      </div>
      <button id="run" type="button">Run Workflow API</button>
    </header>
    <section class="grid">
      <div class="panel">
        <h2>Manuscript Input</h2>
        <textarea id="manuscript">Methods describe a reproducible catalyst dataset collected from three labs. Results show p &lt; 0.01. We prove this method always generalizes to new catalyst families.</textarea>
      </div>
      <div class="panel">
        <h2>Workflow Status</h2>
        <div id="status" class="status">Waiting</div>
        <div id="issues" style="margin-top:12px"></div>
      </div>
      <div class="panel"><h2>Summaries</h2><div id="summaries"></div></div>
      <div class="panel"><h2>Citations & Review Aid</h2><div id="citations"></div></div>
      <div class="panel wide"><h2>Raw API Payload</h2><pre id="payload"></pre></div>
    </section>
  </main>
  <script>
    async function runWorkflow() {
      const response = await fetch("/workflow-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Reusable catalyst dataset",
          manuscript: document.getElementById("manuscript").value,
          discipline: "chemistry",
          library: [
            { id: "ref_catalyst_dataset", title: "Reproducible catalyst datasets", abstract: "Reaction modeling validation." },
            { id: "ref_statistics", title: "Effect sizes and confidence intervals", abstract: "Statistical context for scientific claims." }
          ],
          references: [{ id: "ref_catalyst_dataset", title: "Reproducible catalyst datasets" }],
          citations: [{ source_id: "methods", reference_id: "ref_catalyst_dataset" }]
        })
      });
      const data = await response.json();
      const report = data.report;
      document.getElementById("status").textContent = report.workflow_status;
      document.getElementById("issues").innerHTML = report.technical_issues.map((issue) => '<div class="item"><strong>' + issue.severity + '</strong> ' + issue.message + '</div>').join("");
      document.getElementById("summaries").innerHTML = Object.values(report.summaries).map((summary) => '<div class="item"><strong>' + summary.mode + '</strong><div>' + summary.summary + '</div><div class="muted">Findings: ' + summary.key_findings.join(", ") + '</div></div>').join("");
      document.getElementById("citations").innerHTML = '<div class="item"><strong>Citation graph</strong><div>' + report.citation_graph.citations.length + ' cited, ' + report.citation_graph.uncited_references.length + ' uncited</div></div><div class="item"><strong>Peer review questions</strong><div>' + report.peer_review_aid.review_questions.join("<br>") + '</div></div>';
      document.getElementById("payload").textContent = JSON.stringify(data, null, 2);
    }
    document.getElementById("run").addEventListener("click", runWorkflow);
    runWorkflow();
  </script>
</body>
</html>`;
}

export function createResearchToolsServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")

    if (request.method === "GET" && url.pathname === "/") {
      sendHtml(response, renderDemoPage())
      return
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "ai-assisted-research-tools" })
      return
    }

    if (request.method === "POST" && url.pathname === "/workflow-report") {
      try {
        const input = await readJsonBody(request)
        const report = createResearchWorkflowReport(input)
        sendJson(response, 200, { report })
      } catch (error) {
        sendJson(response, 400, { error: error.message })
      }
      return
    }

    sendJson(response, 404, {
      error: "Not found",
      routes: ["GET /", "GET /health", "POST /workflow-report"],
    })
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT)
  createResearchToolsServer().listen(port, () => {
    console.log(`AI-assisted research tools demo API listening on http://localhost:${port}`)
  })
}
