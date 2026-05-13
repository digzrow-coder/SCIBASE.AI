# Scientific Data and Code Hosting

Self-contained MVP module for issue #14. It models the first production slice of a scientific artifact hosting layer: structured uploads, standards metadata, version history, previews, FAIR checks, and sandboxed execution jobs.

## Capabilities

- Classifies uploaded research artifacts as datasets, code, images, or supplementary files.
- Generates JSON-LD/schema.org-style metadata with persistent identifiers, licenses, creators, tags, and encoding formats.
- Tracks artifact versions with checksum and size diffs for reproducibility review.
- Produces metadata-aware previews for CSV, TSV, JSON, code, images, and generic downloads.
- Builds sandboxed execution job manifests for notebooks, Python, R, and Julia workflows.
- Reports FAIR compliance signals for findability, accessibility, interoperability, and reuse.

## Usage

```bash
cd scientific-data-code-hosting
npm test
```

```js
import {
  createArtifactRecord,
  buildPreview,
  createExecutionJob,
  fairComplianceReport,
} from "./src/hosting.js";

const artifact = createArtifactRecord({
  filename: "measurements.csv",
  content: "sample,temperature\nA,21.3\n",
  tags: ["thermodynamics", "sensor"],
  creator: "SCIBASE Lab",
  access: "public",
});

console.log(artifact.metadata);
console.log(buildPreview(artifact, "sample,temperature\nA,21.3\n"));
console.log(createExecutionJob({ artifactId: artifact.id, entrypoint: "analysis.ipynb" }));
console.log(fairComplianceReport(artifact));
```

## Demo

See [demo-walkthrough.md](demo-walkthrough.md) for a reviewer-ready walkthrough of the upload, preview, versioning, metadata, FAIR compliance, and execution-job flow.

## Requirement Mapping

| Issue requirement | Implementation |
| --- | --- |
| Major scientific file types | `classifyArtifact()` covers datasets, code, images, and supplementary files. |
| Folder organization | `createArtifactRecord()` normalizes folder paths. |
| Metadata-aware previews | `buildPreview()` supports table, JSON, code, thumbnail, and download previews. |
| Upload versioning and diffing | `addArtifactVersion()` records checksums, sizes, notes, timestamps, and diffs. |
| JSON-LD/schema.org/DataCite-style metadata | `buildMetadata()` emits schema context, identifiers, creators, license, keywords, format, URL, and version. |
| FAIR compliance | `fairComplianceReport()` checks findable, accessible, interoperable, and reusable criteria. |
| Tags for scientific keywords | Artifact records deduplicate and sort tags. |
| Executable environments | `createExecutionJob()` builds runtime and sandbox manifests for Python, R, Julia, and notebooks. |
| Compute triggers | Execution jobs include manual "Run analysis" or cron triggers. |
| Tests | `test/hosting.test.js` covers metadata, previews, versions, FAIR checks, and execution jobs. |
