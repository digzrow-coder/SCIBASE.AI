import assert from "node:assert/strict"
import test from "node:test"
import { createResearchToolsServer } from "../src/server.js"
import {
  buildCitationGraph,
  checkTechnicalIssues,
  createResearchWorkflowReport,
  createToolInvocation,
  generatePeerReviewAid,
  suggestMissingCitations,
  summarizePaper,
} from "../src/research-tools.js"

test("generates summaries in supported modes with findings", () => {
  const summary = summarizePaper({
    title: "Reusable catalyst dataset",
    abstract: "We introduce a catalyst dataset for reproducible reaction modeling.",
    body: "The dataset improves catalyst screening. The method validates reaction outcomes with held-out experiments.",
    mode: "executive",
  })

  assert.equal(summary.mode, "executive")
  assert.ok(summary.summary.startsWith("Decision-ready summary"))
  assert.ok(summary.key_findings.includes("catalyst"))
  assert.throws(() => summarizePaper({ title: "x", body: "y", mode: "bad" }), /Unsupported summary mode/)
})

test("detects manuscript technical issues", () => {
  const findings = checkTechnicalIssues({
    manuscript: "Introduction. We prove this method always works. Results show p < 0.01.",
  })

  assert.ok(findings.some((finding) => finding.type === "missing-section" && finding.message.includes("methods")))
  assert.ok(findings.some((finding) => finding.type === "statistics-context"))
  assert.ok(findings.some((finding) => finding.type === "overclaim"))
  assert.ok(findings.some((finding) => finding.type === "citation-gap"))
})

test("builds citation graphs and reports uncited references", () => {
  const graph = buildCitationGraph({
    references: [
      { id: "ref_1", title: "Catalyst screening" },
      { id: "ref_2", title: "Dataset validation" },
    ],
    citations: [{ source_id: "section_1", reference_id: "ref_1", context: "Prior catalyst work" }],
  })

  assert.equal(graph.citations.length, 1)
  assert.deepEqual(graph.uncited_references, ["ref_2"])
})

test("suggests missing citations by manuscript-library overlap", () => {
  const suggestions = suggestMissingCitations({
    manuscript: "The catalyst dataset supports reproducible reaction modeling and validation.",
    library: [
      { id: "ref_1", title: "Reproducible catalyst datasets", abstract: "Reaction modeling validation." },
      { id: "ref_2", title: "Astronomy telescope survey", abstract: "Galaxy imaging." },
    ],
  })

  assert.equal(suggestions[0].reference.id, "ref_1")
  assert.ok(suggestions[0].score > 0)
})

test("generates peer review aid with questions and concerns", () => {
  const aid = generatePeerReviewAid({
    discipline: "chemistry",
    manuscript:
      "Methods describe a reproducible dataset. Results show p < 0.01. We prove this catalyst method always works.",
  })

  assert.equal(aid.discipline, "chemistry")
  assert.equal(aid.review_questions.length, 3)
  assert.ok(aid.concerns.length > 0)
})

test("creates guarded tool invocation records", () => {
  const invocation = createToolInvocation({
    tool: "summarizer",
    input: { title: "Paper" },
    user_id: "user_1",
    project_id: "project_1",
  })

  assert.equal(invocation.status, "queued")
  assert.ok(invocation.guardrails.includes("no fabricated citations"))
  assert.throws(
    () => createToolInvocation({ tool: "unknown", input: {}, user_id: "user_1", project_id: "project_1" }),
    /Unsupported tool/,
  )
})

test("creates a full research workflow report", () => {
  const report = createResearchWorkflowReport({
    title: "Reusable catalyst dataset",
    abstract: "We introduce a catalyst dataset for reaction modeling.",
    manuscript:
      "Methods describe a reproducible dataset. Results show p < 0.01. We prove this catalyst method always works.",
    discipline: "chemistry",
    library: [
      { id: "ref_1", title: "Reproducible catalyst datasets", abstract: "Reaction modeling validation." },
      { id: "ref_2", title: "Astronomy survey", abstract: "Galaxy imaging." },
    ],
    references: [{ id: "ref_1", title: "Reproducible catalyst datasets" }],
    citations: [{ source_id: "methods", reference_id: "ref_1" }],
  })

  assert.equal(report.title, "Reusable catalyst dataset")
  assert.ok(report.summaries.abstract.summary.startsWith("Abstract-style summary"))
  assert.ok(report.summaries.executive.summary.startsWith("Decision-ready summary"))
  assert.ok(report.summaries.layperson.summary.startsWith("In plain language"))
  assert.ok(report.technical_issues.some((finding) => finding.type === "statistics-context"))
  assert.equal(report.citation_graph.citations.length, 1)
  assert.equal(report.missing_citation_suggestions[0].reference.id, "ref_1")
  assert.equal(report.peer_review_aid.discipline, "chemistry")
  assert.equal(report.workflow_status, "needs-author-review")
})

test("serves workflow reports over the local demo API", async () => {
  const server = createResearchToolsServer()
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address()

  try {
    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`)
    assert.equal(healthResponse.status, 200)
    assert.equal((await healthResponse.json()).status, "ok")

    const pageResponse = await fetch(`http://127.0.0.1:${port}/`)
    const pageHtml = await pageResponse.text()
    assert.equal(pageResponse.status, 200)
    assert.match(pageHtml, /AI-Assisted Research Tools/)

    const workflowResponse = await fetch(`http://127.0.0.1:${port}/workflow-report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Reusable catalyst dataset",
        manuscript: "Methods describe a reproducible dataset. Results show p < 0.01.",
        library: [],
        references: [],
        citations: [],
      }),
    })
    const payload = await workflowResponse.json()

    assert.equal(workflowResponse.status, 200)
    assert.equal(payload.report.title, "Reusable catalyst dataset")
    assert.ok(payload.report.summaries.abstract.summary.startsWith("Abstract-style summary"))
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
})
