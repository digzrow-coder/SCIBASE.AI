# AI-Assisted Research Tools

Self-contained MVP module for issue #13. It provides deterministic first-pass research assistance for paper summaries, technical issue checks, citation management, citation suggestions, and peer-review aid generation.

## Capabilities

- Generates abstract-style, executive, and layperson summaries.
- Extracts key findings and implication keywords from project text.
- Checks manuscripts for missing sections, statistical-context gaps, overclaims, and citation gaps.
- Builds citation graphs from references and in-text citation contexts.
- Identifies uncited references and suggests missing citations from a project library.
- Produces peer-review aid reports with questions, strengths, and concerns.
- Creates auditable tool invocation records with guardrails against fabricated citations and unreviewed AI output.

## Usage

```bash
cd ai-assisted-research-tools
npm test
npm run demo
```

```js
import {
  summarizePaper,
  checkTechnicalIssues,
  suggestMissingCitations,
  createResearchWorkflowReport,
} from "./src/research-tools.js";

const manuscript = "Methods describe a reproducible dataset. Results show p < 0.01.";

console.log(summarizePaper({
  title: "Reusable catalyst dataset",
  body: manuscript,
  mode: "executive",
}));

console.log(checkTechnicalIssues({ manuscript }));
console.log(suggestMissingCitations({ manuscript, library: [] }));
console.log(createResearchWorkflowReport({
  title: "Reusable catalyst dataset",
  manuscript,
  library: [],
  references: [],
  citations: [],
}));
```

`npm run demo` prints a complete JSON workflow report containing all three
summary modes, peer-review diagnostics, citation graph data, missing-citation
recommendations, and a guarded tool invocation record.

## Requirement Mapping

| Issue requirement | Implementation |
| --- | --- |
| AI paper summarizer | `summarizePaper()` supports abstract, executive, and layperson modes. |
| Key findings and implications | Summaries include keyword-derived findings and implication terms. |
| Technical issue checking | `checkTechnicalIssues()` detects missing sections, weak statistical context, overclaims, and citation gaps. |
| Citation management | `buildCitationGraph()` connects references to citation contexts and reports uncited references. |
| Missing citation suggestions | `suggestMissingCitations()` ranks library references by manuscript keyword overlap. |
| Peer review aid | `generatePeerReviewAid()` returns summary, review questions, strengths, and concerns. |
| Safe tool execution | `createToolInvocation()` records queued tool runs with guardrails for human review and citation integrity. |
| End-to-end reviewer workflow | `createResearchWorkflowReport()` and `npm run demo` produce one runnable report across the MVP tools. |

## Verification

The test suite covers summaries, issue detection, citation graphs, missing citation suggestions, peer-review aids, and guarded tool invocations.
