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

export function createResearchToolsServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")

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
      routes: ["GET /health", "POST /workflow-report"],
    })
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT)
  createResearchToolsServer().listen(port, () => {
    console.log(`AI-assisted research tools demo API listening on http://localhost:${port}`)
  })
}
