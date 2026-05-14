# Research Assistant Readiness Engine

Self-contained milestone for SCIBASE issue #16, "AI-Powered Research Assistant Suite".

The module turns a research project manifest into a deterministic assistant report that combines:

- auto peer-review checks with claim/citation alignment;
- reproducibility confidence and a runnable verification runbook;
- research-gap ranking from corpus signals, project interests, and stated limitations;
- prioritized action queue and weekly digest payload.

It is dependency-free CommonJS so reviewers can run it directly in the current repository without installing a framework.

## Run

```bash
node research-assistant-readiness-engine/test.js
node research-assistant-readiness-engine/demo.js
```

Optional browser demo recording:

```bash
npm install playwright --no-save --no-package-lock
node research-assistant-readiness-engine/record-demo.js
```

## Requirement Mapping

| Issue #16 capability | Implementation |
| --- | --- |
| Auto peer review reports | `analyzePeerReview()` checks claims, methods, citation density, limitations, ethics, and data availability, then emits unresolved reviewer-facing gaps. |
| Claims vs evidence alignment | `claimEvidence` links each claim to its citation or marks it as needing evidence. |
| Reproducibility checker | `checkReproducibility()` verifies entrypoints, notebooks, datasets, dependencies, outputs, seeds, prior attempts, and emits a runbook. |
| Reproducibility confidence score | Deterministic score from required reproducibility checks. |
| Research gap finder | `findResearchGaps()` ranks corpus signals by replication gap, citation momentum, project interests, and limitation overlap. |
| Personalized opportunity feed | `researchGaps` and `weeklyDigestEmail.topActions` prioritize opportunities for the current project. |
| Real-time assistant workflow | `buildAssistantSuiteReport()` combines all signals into an action queue and digest that a UI or notification service can consume. |

## Files

- `engine.js` - core assistant analysis and validation logic.
- `sample-project.json` - computational biology project fixture.
- `demo.js` - CLI demo.
- `test.js` - dependency-free tests.
- `demo.html` - interactive browser demo.
- `record-demo.js` - Playwright video recorder.
