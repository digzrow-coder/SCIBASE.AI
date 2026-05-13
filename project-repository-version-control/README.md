# Project Repository and Version Control

Self-contained MVP module for issue #10. It models scientific project repositories with structured sections, typed artifacts, commits, diffs, forks, merge requests, reproducibility checks, citation metadata, and archive manifests.

## Capabilities

- Creates repositories with required scientific sections: manuscript, data, code, notebooks, results, protocols, and metadata.
- Validates typed artifacts and ensures files live inside expected repository sections.
- Creates commit records with parent links, artifact manifests, timestamps, and manifest hashes.
- Computes commit diffs for added, modified, and removed scientific artifacts.
- Creates forks and merge requests with mergeability signals.
- Runs reproducibility checks for data, code/notebooks, metadata, and manifest integrity.
- Emits schema.org citation metadata for repository releases.
- Exports archive manifests for reproducible downloads or long-term preservation.

## Usage

```bash
cd project-repository-version-control
npm test
```

```js
import {
  createProjectRepository,
  createArtifact,
  createCommit,
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

console.log(repository);
console.log(runReproducibilityChecks(commit));
```

## Requirement Mapping

| Issue requirement | Implementation |
| --- | --- |
| Scientific project structure | `createProjectRepository()` enforces manuscript, data, code, notebooks, results, protocols, and metadata sections. |
| Artifact storage | `createArtifact()` validates file type, section path, content hash, size, and metadata. |
| Version control | `createCommit()` records parent commit IDs, artifact manifests, timestamps, and manifest hashes. |
| Diffs | `diffCommits()` reports added, modified, and removed files. |
| Forks | `createFork()` models repository forks from a source commit. |
| Merge requests | `createMergeRequest()` records source/target commits, diffs, status, and mergeability. |
| Reproducibility checks | `runReproducibilityChecks()` verifies data, code/notebook, metadata, and manifest presence. |
| Citations and exports | `createCitationMetadata()` and `exportRepositoryArchive()` emit schema.org citation data and archive manifests. |

## Verification

The test suite covers repository structure, artifact validation, commits, diffs, forks, merge requests, reproducibility checks, citation metadata, and archive exports.
