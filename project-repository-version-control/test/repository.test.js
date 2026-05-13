import assert from "node:assert/strict"
import test from "node:test"
import {
  createArtifact,
  createCitationMetadata,
  createCommit,
  createFork,
  createMergeRequest,
  createProjectRepository,
  diffCommits,
  exportRepositoryArchive,
  runReproducibilityChecks,
} from "../src/repository.js"

test("creates repositories with required scientific sections", () => {
  const repo = createProjectRepository({
    repository_id: "repo_1",
    title: "Catalyst Study",
    owner_id: "user_1",
  })

  assert.deepEqual(
    repo.sections.map((section) => section.name),
    ["manuscript", "data", "code", "notebooks", "results", "protocols", "metadata"],
  )
  assert.throws(
    () => createProjectRepository({ repository_id: "bad", title: "Bad", owner_id: "u", sections: ["data"] }),
    /Missing required repository sections/,
  )
})

test("creates typed artifacts inside repository sections", () => {
  const artifact = createArtifact({
    artifact_id: "artifact_1",
    path: "data/measurements.csv",
    type: "csv",
    content: "sample,value\nA,1\n",
    metadata: { rows: 1 },
  })

  assert.equal(artifact.path, "data/measurements.csv")
  assert.equal(artifact.bytes, 17)
  assert.throws(
    () => createArtifact({ artifact_id: "bad", path: "tmp/file.txt", type: "markdown", content: "x" }),
    /repository section/,
  )
})

test("creates commits and diffs scientific artifacts", () => {
  const dataV1 = createArtifact({ artifact_id: "data_1", path: "data/a.csv", type: "csv", content: "a\n1\n" })
  const codeV1 = createArtifact({ artifact_id: "code_1", path: "code/analyze.py", type: "python", content: "print(1)" })
  const dataV2 = createArtifact({ artifact_id: "data_1", path: "data/a.csv", type: "csv", content: "a\n2\n" })
  const meta = createArtifact({ artifact_id: "meta_1", path: "metadata/schema.json", type: "json", content: "{}" })
  const base = createCommit({ commit_id: "c1", author_id: "u", message: "initial", artifacts: [dataV1, codeV1] })
  const head = createCommit({ commit_id: "c2", parent_commit_id: "c1", author_id: "u", message: "update", artifacts: [dataV2, codeV1, meta] })

  assert.notEqual(base.manifest_hash, head.manifest_hash)
  assert.deepEqual(diffCommits(base, head), {
    added: ["metadata/schema.json"],
    modified: ["data/a.csv"],
    removed: [],
  })
})

test("creates forks and merge requests with mergeability signals", () => {
  const data = createArtifact({ artifact_id: "data", path: "data/a.csv", type: "csv", content: "a\n1\n" })
  const code = createArtifact({ artifact_id: "code", path: "code/a.py", type: "python", content: "print(1)" })
  const base = createCommit({ commit_id: "c1", author_id: "u1", message: "base", artifacts: [data] })
  const head = createCommit({ commit_id: "c2", author_id: "u2", message: "add code", artifacts: [data, code] })
  const fork = createFork({
    source_repository_id: "repo_1",
    fork_repository_id: "repo_2",
    owner_id: "u2",
    source_commit_id: "c1",
  })
  const mr = createMergeRequest({
    merge_request_id: "mr_1",
    source_repository_id: fork.repository_id,
    target_repository_id: "repo_1",
    source_commit: head,
    target_commit: base,
    title: "Add analysis script",
    author_id: "u2",
  })

  assert.equal(fork.forked_from, "repo_1")
  assert.equal(mr.mergeable, true)
  assert.deepEqual(mr.diff.added, ["code/a.py"])
})

test("runs reproducibility checks and exports citation/archive metadata", () => {
  const repo = createProjectRepository({ repository_id: "repo_1", title: "Catalyst Study", owner_id: "u" })
  const artifacts = [
    createArtifact({ artifact_id: "d", path: "data/a.csv", type: "csv", content: "a\n1\n" }),
    createArtifact({ artifact_id: "c", path: "notebooks/analysis.ipynb", type: "notebook", content: "{}" }),
    createArtifact({ artifact_id: "m", path: "metadata/schema.json", type: "json", content: "{}" }),
  ]
  const commit = createCommit({ commit_id: "c1", author_id: "u", message: "reproducible release", artifacts })
  const checks = runReproducibilityChecks(commit)
  const citation = createCitationMetadata({
    repository: repo,
    commit,
    doi: "10.1234/scibase.repo",
    authors: ["Ada Lovelace"],
    keywords: ["catalyst"],
  })
  const archive = exportRepositoryArchive({ repository: repo, commit })

  assert.equal(checks.passed, true)
  assert.equal(citation.identifier, "10.1234/scibase.repo")
  assert.equal(citation.hasPart.length, 3)
  assert.equal(archive.files[0].path, "data/a.csv")
})
