import assert from "node:assert/strict"
import test from "node:test"
import { createRepositoryDemoServer } from "../src/server.js"
import {
  createArtifact,
  createBranch,
  createCitationMetadata,
  createCommit,
  createDemoRepositoryWorkspace,
  createEditorSession,
  createFork,
  createMergeRequest,
  createProgrammaticExport,
  createProjectRepository,
  createReproducibilityPipeline,
  createRevisionTimeline,
  createSemanticTag,
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

test("creates a runnable demo repository workspace", () => {
  const workspace = createDemoRepositoryWorkspace()

  assert.equal(workspace.repository.repository_id, "repo_catalyst")
  assert.deepEqual(workspace.diff.added, ["notebooks/qc.ipynb"])
  assert.deepEqual(workspace.diff.modified, ["data/measurements.csv"])
  assert.equal(workspace.merge_request.mergeable, true)
  assert.equal(workspace.reproducibility.passed, true)
  assert.equal(workspace.archive.files.length, 4)
})

test("serves the demo repository over the local API", async () => {
  const server = createRepositoryDemoServer()
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address()

  try {
    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`)
    assert.equal(healthResponse.status, 200)
    assert.equal((await healthResponse.json()).status, "ok")

    const workspaceResponse = await fetch(`http://127.0.0.1:${port}/demo-repository`)
    const workspace = await workspaceResponse.json()

    assert.equal(workspaceResponse.status, 200)
    assert.equal(workspace.repository.title, "Catalyst Study")
    assert.equal(workspace.reproducibility.passed, true)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
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
  assert.equal(
    createArtifact({
      artifact_id: "large_model",
      path: "results/model.bin",
      type: "model",
      content: "model",
      lfs_threshold_bytes: 4,
    }).lfs_pointer,
    true,
  )
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

test("creates branches, semantic tags, editor sessions, and revision timelines", () => {
  const repo = createProjectRepository({ repository_id: "repo_1", title: "Catalyst Study", owner_id: "u" })
  const data = createArtifact({ artifact_id: "data", path: "data/a.csv", type: "csv", content: "a\n1\n" })
  const code = createArtifact({ artifact_id: "code", path: "code/a.py", type: "python", content: "print(1)" })
  const base = createCommit({
    commit_id: "c1",
    author_id: "u",
    message: "base",
    artifacts: [data],
    created_at: "2026-05-14T01:00:00.000Z",
  })
  const head = createCommit({
    commit_id: "c2",
    parent_commit_id: "c1",
    author_id: "u",
    message: "analysis",
    artifacts: [data, code],
    created_at: "2026-05-14T02:00:00.000Z",
  })
  const branched = createBranch({ repository: repo, name: "experiment-catalyst", from_commit_id: "c1" })
  const tag = createSemanticTag({
    tag: "preprint-v1.0",
    version: "1.0.0",
    commit_id: "c2",
    doi: "10.1234/scibase.repo.v1",
  })
  const editor = createEditorSession({
    path: "notebooks/analysis.ipynb",
    format: "jupyter",
    user_id: "u",
    base_commit_id: "c2",
  })
  const timeline = createRevisionTimeline({ commits: [head, base], tags: [tag] })

  assert.equal(branched.branches.find((branch) => branch.name === "experiment-catalyst").head_commit_id, "c1")
  assert.equal(tag.version, "1.0.0")
  assert.equal(editor.supports_rich_data_diff, true)
  assert.deepEqual(
    timeline.map((event) => event.commit_id),
    ["c1", "c2"],
  )
  assert.equal(timeline[1].tags[0].tag, "preprint-v1.0")
  assert.throws(
    () => createSemanticTag({ tag: "bad", version: "preprint", commit_id: "c1" }),
    /semantic versioning/,
  )
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

test("runs reproducibility checks and exports citation, API, and archive metadata", () => {
  const repo = createProjectRepository({ repository_id: "repo_1", title: "Catalyst Study", owner_id: "u" })
  const artifacts = [
    createArtifact({ artifact_id: "d", path: "data/a.csv", type: "csv", content: "a\n1\n" }),
    createArtifact({ artifact_id: "c", path: "code/run_analysis.py", type: "python", content: "print(1)" }),
    createArtifact({ artifact_id: "m", path: "metadata/schema.json", type: "json", content: "{}" }),
  ]
  const commit = createCommit({ commit_id: "c1", author_id: "u", message: "reproducible release", artifacts })
  const pipeline = createReproducibilityPipeline({
    pipeline_id: "pipeline_1",
    entrypoint: "code/run_analysis.py",
    environment: "Dockerfile",
    expected_outputs: ["results/figure.png"],
  })
  const checks = runReproducibilityChecks(commit, pipeline)
  const citation = createCitationMetadata({
    repository: repo,
    commit,
    doi: "10.1234/scibase.repo",
    authors: ["Ada Lovelace"],
    keywords: ["catalyst"],
  })
  const apiExport = createProgrammaticExport({
    repository: repo,
    commit,
    base_url: "https://api.scibase.example/v1/",
  })
  const archive = exportRepositoryArchive({ repository: repo, commit })

  assert.equal(checks.passed, true)
  assert.equal(checks.pipeline_id, "pipeline_1")
  assert.equal(citation.identifier, "10.1234/scibase.repo")
  assert.equal(citation.hasPart.length, 3)
  assert.equal(apiExport.rest_api.archive, "https://api.scibase.example/v1/repositories/repo_1/commits/c1/archive")
  assert.equal(archive.files[0].path, "data/a.csv")
})
