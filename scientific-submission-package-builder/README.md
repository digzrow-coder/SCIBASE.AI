# Scientific Submission Package Builder

This module implements the submission-engine part of the Scientific Bounty System from issue #18. It focuses on a solver team's private workspace, deliverable packaging, reproducibility hashes, anonymous submissions, and audit evidence for sponsor review.

## Scope

- Challenge phases with required deliverables and accepted artifact types
- Private or public challenge metadata
- Named or anonymous solver team submission packages
- Artifact hashing for code, notebooks, datasets, whitepapers, and model cards
- Phase completion summaries
- Missing-deliverable detection before sponsor review
- Audit digest and reproducibility digest for arbitration and payout readiness

This is intentionally separate from the existing challenge intake, review scoring, and arbitration submissions. It covers the handoff between solver workspaces and sponsor evaluation.

## Files

- `package-builder.js` - dependency-free package builder library
- `sample-challenge.json` - example biotech challenge with proposal, prototype, and final phases
- `demo.js` - creates a complete anonymous submission package
- `demo.html` - browser demo for the package builder workflow
- `record-demo.js` - Playwright script used to record the demo video
- `test.js` - focused regression tests using Node's built-in `assert`

## Run

```bash
node scientific-submission-package-builder/test.js
node scientific-submission-package-builder/demo.js
```

Optional demo recording:

```bash
npx -p playwright node scientific-submission-package-builder/record-demo.js
```

Expected demo output includes:

- workspace id
- challenge title
- anonymous team display
- artifact count
- sponsor-review readiness
- reproducibility digest

## Requirement Mapping

| Issue #18 requirement | Implementation |
| --- | --- |
| Secure, private project space for each challenge submission team | `createWorkspace()` records challenge visibility, team identity, participation mode, and audit log |
| Full access to code, data, documents, notebooks, execution | `addArtifact()` accepts typed artifacts such as `ipynb`, `json`, `markdown`, and documents |
| Version control and audit logs for reproducibility | Artifact content hashes plus `auditDigest` and `reproducibilityDigest` |
| Built-in submission package builder | `buildSubmissionPackage()` emits a sponsor-review manifest |
| Anonymous or named participation | Anonymous packages redact member names while preserving a team id |
| Multi-phase challenges | `phaseSummary` tracks proposal, prototype, and final phase completion |
| Standardized evaluation dashboard input | Manifest includes complete artifacts, missing deliverables, phase status, and review readiness |
| IP management options | Challenge `ipPolicy` is carried into the package manifest |

## Review Notes

The package is deterministic. The same challenge and artifacts produce the same reproducibility digest, which lets reviewers verify that a submitted package has not drifted between arbitration, sponsor review, and payout.
