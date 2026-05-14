# Project Repository and Version Control

Self-contained MVP module for issue #10. It models scientific project repositories with structured sections, typed artifacts, commits, semantic tags, branches, diffs, forks, merge requests, in-browser editor metadata, revision timelines, reproducibility pipelines, citation metadata, API exports, and archive manifests.

## Capabilities

- Creates repositories with required scientific sections: manuscript, data, code, notebooks, results, protocols, and metadata.
- Validates typed artifacts and ensures files live inside expected repository sections.
- Creates commit records with parent links, artifact manifests, timestamps, and manifest hashes.
- Creates semantic version tags and branch heads for parallel experiments or preprint releases.
- Computes commit diffs for added, modified, and removed scientific artifacts.
- Creates forks and merge requests with mergeability signals.
- Describes inline editor sessions for Markdown, LaTeX, CSV, JSON, Jupyter, Python, R, and Julia.
- Builds visual revision timeline data from commits and release tags.
- Runs reproducibility checks for data, code/notebooks, metadata, manifest integrity, and pipeline readiness.
- Emits schema.org citation metadata for repository releases.
- Exports REST endpoint metadata and archive manifests for reproducible downloads or long-term preservation.

## Usage

```bash
cd project-repository-version-control
npm test
npm run demo
npm run serve
```

```js
import {
  createProjectRepository,
  createArtifact,
  createCommit,
  createReproducibilityPipeline,
  runReproducibilityChecks,
} from "./src/repository.js";

const repository = createProjectRepository({
  repository_id: "repo_1",
  title: "Catalyst Study",
  owner_id: "user_1",
});

const artifact = createArtifact({
  artifact_id: "data_1",
  path: "data/measurements.csv",
  type: "csv",
  content: "sample,value\nA,1\n",
});

const commit = createCommit({
  commit_id: "commit_1",
  author_id: "user_1",
  message: "Add dataset",
  artifacts: [artifact],
});

const pipeline = createReproducibilityPipeline({
  pipeline_id: "pipeline_1",
  entrypoint: "code/run_analysis.py",
  environment: "Dockerfile",
});

console.log(repository);
console.log(runReproducibilityChecks(commit, pipeline));
```

## Runnable Demo

`npm run demo` prints a complete scientific repository workspace with required
sections, typed artifacts, two commits, branch/tag metadata, diff output, fork
and merge-request records, editor metadata, reproducibility checks, citation
metadata, REST export links, and archive manifest.

`npm run serve` starts a dependency-free local demo API:

- `GET /`
- `GET /health`
- `GET /demo-repository`

Example:

```bash
open http://localhost:4310/
curl http://localhost:4310/demo-repository
```

## Requirement Mapping

| Issue requirement | Implementation |
| --- | --- |
| Scientific project structure | `createProjectRepository()` enforces manuscript, data, code, notebooks, results, protocols, and metadata sections. |
| Artifact storage | `createArtifact()` validates file type, section path, content hash, size, and metadata. |
| Version control | `createCommit()` records parent commit IDs, artifact manifests, timestamps, and manifest hashes. |
| Git LFS-style large file tracking | `createArtifact()` marks large artifacts with `lfs_pointer`. |
| Branching and semantic versions | `createBranch()` and `createSemanticTag()` model experiment branches and semantic release tags. |
| Diffs | `diffCommits()` reports added, modified, and removed files. |
| Forks | `createFork()` models repository forks from a source commit. |
| Merge requests | `createMergeRequest()` records source/target commits, diffs, status, and mergeability. |
| In-browser editors and rich diffs | `createEditorSession()` describes Markdown, LaTeX, CSV, JSON, Jupyter, Python, R, and Julia editors plus rich-data diff support. |
| Visual revision timeline | `createRevisionTimeline()` builds ordered timeline records with tags and artifact counts. |
| Reproducibility checks | `createReproducibilityPipeline()` and `runReproducibilityChecks()` verify data, code/notebook, metadata, manifest, and pipeline readiness. |
| Citations and exports | `createCitationMetadata()`, `createProgrammaticExport()`, and `exportRepositoryArchive()` emit schema.org citation data, REST endpoints, and archive manifests. |
| Local reviewer demo | `npm run demo` and `npm run serve` expose a complete repository/version-control workflow. |

## Verification

The test suite covers repository structure, artifact validation, LFS pointers, commits, branches, semantic tags, diffs, forks, merge requests, editor sessions, revision timelines, reproducibility pipelines, citation metadata, REST export metadata, and archive exports.
