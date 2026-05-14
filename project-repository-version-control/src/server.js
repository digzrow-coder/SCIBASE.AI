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

export function createRepositoryDemoServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")

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
      routes: ["GET /health", "GET /demo-repository"],
    })
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT)
  createRepositoryDemoServer().listen(port, () => {
    console.log(`Repository demo API listening on http://localhost:${port}`)
  })
}
