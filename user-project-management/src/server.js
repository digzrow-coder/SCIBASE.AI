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

export function createUserProjectDemoServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")

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
      routes: ["GET /health", "GET /demo-workspace"],
    })
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT)
  createUserProjectDemoServer().listen(port, () => {
    console.log(`User/project management demo API listening on http://localhost:${port}`)
  })
}
