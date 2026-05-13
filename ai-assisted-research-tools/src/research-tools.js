const SUMMARY_MODES = new Set(["abstract", "executive", "layperson"])

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`)
  return value.trim()
}

function sentences(text) {
  return requireString(text, "text")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function words(text) {
  return text.toLowerCase().match(/[a-z][a-z0-9-]+/g) ?? []
}

function topKeywords(text, limit = 8) {
  const stop = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "using", "were", "was", "are"])
  const counts = new Map()
  for (const word of words(text)) {
    if (stop.has(word) || word.length < 4) continue
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([word]) => word)
}

export function summarizePaper({ title, abstract = "", body = "", mode = "abstract", max_sentences = 3 }) {
  if (!SUMMARY_MODES.has(mode)) throw new Error(`Unsupported summary mode: ${mode}`)
  const source = `${requireString(title, "title")}. ${abstract} ${body}`
  const allSentences = sentences(source)
  const keywords = topKeywords(source, 6)
  const selected = allSentences
    .map((sentence) => ({
      sentence,
      score: keywords.reduce((score, keyword) => score + (sentence.toLowerCase().includes(keyword) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max_sentences)
    .map((item) => item.sentence)

  const prefix =
    mode === "layperson"
      ? "In plain language"
      : mode === "executive"
        ? "Decision-ready summary"
        : "Abstract-style summary"

  return {
    mode,
    title,
    summary: `${prefix}: ${selected.join(" ")}`,
    key_findings: keywords.slice(0, 4),
    implications: keywords.slice(4, 6),
  }
}

export function checkTechnicalIssues({ manuscript, required_sections = ["methods", "results", "limitations"] }) {
  const text = requireString(manuscript, "manuscript")
  const lower = text.toLowerCase()
  const findings = []

  for (const section of required_sections) {
    if (!lower.includes(section.toLowerCase())) {
      findings.push({ severity: "high", type: "missing-section", message: `Missing ${section} section` })
    }
  }
  if (/\bp\s*[<=>]\s*0\.0[0-9]\b/i.test(text) && !/effect size|confidence interval|ci\b/i.test(text)) {
    findings.push({
      severity: "medium",
      type: "statistics-context",
      message: "Statistical significance appears without effect size or confidence interval context",
    })
  }
  if (/we prove|definitive|always|never/i.test(text) && !/limitation|uncertain|future work/i.test(text)) {
    findings.push({
      severity: "medium",
      type: "overclaim",
      message: "Strong claims should be balanced with limitations or uncertainty",
    })
  }
  if ((text.match(/\[[0-9]+\]|\([A-Z][A-Za-z-]+,\s*\d{4}\)/g) ?? []).length === 0) {
    findings.push({ severity: "low", type: "citation-gap", message: "No citations detected in manuscript text" })
  }

  return findings
}

export function buildCitationGraph({ references = [], citations = [] }) {
  const referenceMap = new Map(
    references.map((reference) => [requireString(reference.id, "reference.id"), { ...reference }]),
  )
  const edges = citations
    .filter((citation) => referenceMap.has(citation.reference_id))
    .map((citation) => ({
      source_id: requireString(citation.source_id, "citation.source_id"),
      reference_id: requireString(citation.reference_id, "citation.reference_id"),
      context: citation.context ?? "",
    }))
  return {
    references: [...referenceMap.values()],
    citations: edges,
    uncited_references: [...referenceMap.keys()].filter((id) => !edges.some((edge) => edge.reference_id === id)),
  }
}

export function suggestMissingCitations({ manuscript, library = [] }) {
  const keys = topKeywords(manuscript, 12)
  return library
    .map((reference) => ({
      reference,
      score: keys.reduce((score, keyword) => {
        const haystack = `${reference.title} ${reference.abstract ?? ""}`.toLowerCase()
        return score + (haystack.includes(keyword) ? 1 : 0)
      }, 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.reference.title.localeCompare(b.reference.title))
    .slice(0, 5)
}

export function generatePeerReviewAid({ manuscript, discipline = "general" }) {
  const issueFindings = checkTechnicalIssues({ manuscript })
  const manuscriptSentences = sentences(manuscript)
  return {
    discipline,
    summary: summarizePaper({
      title: `${discipline} manuscript`,
      body: manuscript,
      mode: "executive",
      max_sentences: 2,
    }).summary,
    review_questions: [
      "Are the core claims directly supported by the results?",
      "Are methods detailed enough for reproduction?",
      "Are limitations and threats to validity explicit?",
    ],
    strengths: manuscriptSentences.filter((sentence) => /reproduc|dataset|method|validation/i.test(sentence)).slice(0, 3),
    concerns: issueFindings,
  }
}

export function createToolInvocation({ tool, input, user_id, project_id }) {
  const allowed = new Set(["summarizer", "technical-checker", "citation-suggester", "peer-review-aid"])
  if (!allowed.has(tool)) throw new Error(`Unsupported tool: ${tool}`)
  return {
    invocation_id: `${tool}_${Date.now()}`,
    tool,
    user_id: requireString(user_id, "user_id"),
    project_id: requireString(project_id, "project_id"),
    input,
    status: "queued",
    guardrails: ["no fabricated citations", "surface uncertainty", "require human review"],
  }
}
