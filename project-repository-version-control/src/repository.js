const REQUIRED_SECTIONS = ["manuscript", "data", "code", "notebooks", "results", "protocols", "metadata"]
const ALLOWED_FILE_TYPES = new Set([
  "markdown",
  "latex",
  "csv",
  "tsv",
  "json",
  "parquet",
  "python",
  "r",
  "julia",
  "notebook",
  "image",
  "model",
  "protocol",
])
const EDITOR_FORMATS = new Set(["markdown", "latex", "csv", "json", "jupyter", "python", "r", "julia"])

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`)
  return value.trim()
}

function hashContent(content) {
  let hash = 0
  for (let i = 0; i < content.length; i += 1) {
    hash = (hash * 31 + content.charCodeAt(i)) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

export function createProjectRepository({
  repository_id,
  title,
  owner_id,
  visibility = "private",
  license = "CC-BY-4.0",
  sections = REQUIRED_SECTIONS,
}) {
  const normalizedSections = [...new Set(sections.map((section) => requireString(section, "section")))]
  const missing = REQUIRED_SECTIONS.filter((section) => !normalizedSections.includes(section))
  if (missing.length > 0) throw new Error(`Missing required repository sections: ${missing.join(", ")}`)
  return {
    repository_id: requireString(repository_id, "repository_id"),
    title: requireString(title, "title"),
    owner_id: requireString(owner_id, "owner_id"),
    visibility,
    license,
    sections: normalizedSections.map((section) => ({ name: section, path: `${section}/` })),
    branches: [{ name: "main", head_commit_id: null }],
  }
}

export function createArtifact({ artifact_id, path, type, content, metadata = {}, lfs_threshold_bytes = 5_000_000 }) {
  if (!ALLOWED_FILE_TYPES.has(type)) throw new Error(`Unsupported artifact type: ${type}`)
  const normalizedPath = requireString(path, "path").replace(/\\/g, "/")
  const topLevel = normalizedPath.split("/")[0]
  const bytes = Buffer.byteLength(content)
  if (!REQUIRED_SECTIONS.includes(topLevel)) throw new Error(`Artifact path must live under a repository section: ${topLevel}`)
  return {
    artifact_id: requireString(artifact_id, "artifact_id"),
    path: normalizedPath,
    type,
    content_hash: hashContent(requireString(content, "content")),
    bytes,
    lfs_pointer: bytes >= lfs_threshold_bytes,
    metadata,
  }
}

export function createBranch({ repository, name, from_commit_id }) {
  const branch = {
    name: requireString(name, "name"),
    head_commit_id: requireString(from_commit_id, "from_commit_id"),
  }
  return {
    ...repository,
    branches: [...repository.branches.filter((item) => item.name !== branch.name), branch],
  }
}

export function createCommit({
  commit_id,
  parent_commit_id = null,
  author_id,
  message,
  artifacts = [],
  created_at = new Date().toISOString(),
}) {
  return {
    commit_id: requireString(commit_id, "commit_id"),
    parent_commit_id,
    author_id: requireString(author_id, "author_id"),
    message: requireString(message, "message"),
    artifacts,
    created_at,
    manifest_hash: hashContent(JSON.stringify(artifacts.map((artifact) => [artifact.path, artifact.content_hash]).sort())),
  }
}

export function diffCommits(baseCommit, headCommit) {
  const base = new Map(baseCommit.artifacts.map((artifact) => [artifact.path, artifact]))
  const head = new Map(headCommit.artifacts.map((artifact) => [artifact.path, artifact]))
  const added = []
  const modified = []
  const removed = []

  for (const [path, artifact] of head) {
    if (!base.has(path)) added.push(path)
    else if (base.get(path).content_hash !== artifact.content_hash) modified.push(path)
  }
  for (const path of base.keys()) {
    if (!head.has(path)) removed.push(path)
  }

  return { added, modified, removed }
}

export function createSemanticTag({ tag, version, commit_id, doi = null, release_notes = "" }) {
  if (!/^v?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error("version must be semantic versioning compatible")
  }
  return {
    tag: requireString(tag, "tag"),
    version,
    commit_id: requireString(commit_id, "commit_id"),
    doi,
    release_notes,
  }
}

export function createEditorSession({ path, format, user_id, base_commit_id }) {
  const normalizedFormat = requireString(format, "format").toLowerCase()
  if (!EDITOR_FORMATS.has(normalizedFormat)) throw new Error(`Unsupported editor format: ${format}`)
  return {
    path: requireString(path, "path").replace(/\\/g, "/"),
    format: normalizedFormat,
    user_id: requireString(user_id, "user_id"),
    base_commit_id: requireString(base_commit_id, "base_commit_id"),
    supports_inline_diff: true,
    supports_rich_data_diff: ["csv", "json", "jupyter"].includes(normalizedFormat),
  }
}

export function createRevisionTimeline({ commits = [], tags = [] }) {
  const tagsByCommit = new Map()
  for (const tag of tags) {
    const bucket = tagsByCommit.get(tag.commit_id) ?? []
    bucket.push(tag)
    tagsByCommit.set(tag.commit_id, bucket)
  }
  return commits
    .map((commit) => ({
      commit_id: commit.commit_id,
      parent_commit_id: commit.parent_commit_id,
      message: commit.message,
      created_at: commit.created_at,
      artifact_count: commit.artifacts.length,
      tags: tagsByCommit.get(commit.commit_id) ?? [],
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function createFork({ source_repository_id, fork_repository_id, owner_id, source_commit_id }) {
  return {
    repository_id: requireString(fork_repository_id, "fork_repository_id"),
    forked_from: requireString(source_repository_id, "source_repository_id"),
    owner_id: requireString(owner_id, "owner_id"),
    branches: [{ name: "main", head_commit_id: requireString(source_commit_id, "source_commit_id") }],
  }
}

export function createMergeRequest({
  merge_request_id,
  source_repository_id,
  target_repository_id,
  source_commit,
  target_commit,
  title,
  author_id,
}) {
  const diff = diffCommits(target_commit, source_commit)
  return {
    merge_request_id: requireString(merge_request_id, "merge_request_id"),
    source_repository_id: requireString(source_repository_id, "source_repository_id"),
    target_repository_id: requireString(target_repository_id, "target_repository_id"),
    title: requireString(title, "title"),
    author_id: requireString(author_id, "author_id"),
    source_commit_id: source_commit.commit_id,
    target_commit_id: target_commit.commit_id,
    diff,
    status: "open",
    mergeable: diff.removed.length === 0,
  }
}

export function createReproducibilityPipeline({
  pipeline_id,
  entrypoint,
  environment,
  sandbox = "container",
  expected_outputs = [],
} = {}) {
  const normalizedEnvironment = requireString(environment, "environment")
  const supportedEnvironment = normalizedEnvironment === "Dockerfile" || normalizedEnvironment.endsWith(".yml")
  return {
    pipeline_id: requireString(pipeline_id, "pipeline_id"),
    entrypoint: requireString(entrypoint, "entrypoint"),
    environment: normalizedEnvironment,
    sandbox: requireString(sandbox, "sandbox"),
    expected_outputs,
    supported_environment: supportedEnvironment,
  }
}

export function runReproducibilityChecks(commit, pipeline = null) {
  const paths = new Set(commit.artifacts.map((artifact) => artifact.path))
  const hasData = [...paths].some((path) => path.startsWith("data/"))
  const hasCode = [...paths].some((path) => path.startsWith("code/") || path.startsWith("notebooks/"))
  const hasMetadata = [...paths].some((path) => path.startsWith("metadata/"))
  const pipelineReady = pipeline ? pipeline.supported_environment && paths.has(pipeline.entrypoint) : true
  return {
    commit_id: commit.commit_id,
    pipeline_id: pipeline?.pipeline_id ?? null,
    checks: [
      { name: "data-present", passed: hasData },
      { name: "code-or-notebook-present", passed: hasCode },
      { name: "metadata-present", passed: hasMetadata },
      { name: "manifest-hash-present", passed: Boolean(commit.manifest_hash) },
      { name: "pipeline-ready", passed: pipelineReady },
    ],
    passed: hasData && hasCode && hasMetadata && Boolean(commit.manifest_hash) && pipelineReady,
  }
}

export function createCitationMetadata({ repository, commit, doi = null, authors = [], keywords = [] }) {
  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    identifier: doi ?? `${repository.repository_id}:${commit.commit_id}`,
    name: repository.title,
    version: commit.commit_id,
    license: repository.license,
    author: authors.map((author) => ({ "@type": "Person", name: requireString(author, "author") })),
    keywords,
    hasPart: commit.artifacts.map((artifact) => ({
      "@type": "CreativeWork",
      name: artifact.path,
      encodingFormat: artifact.type,
      sha256: artifact.content_hash,
    })),
  }
}

export function exportRepositoryArchive({ repository, commit }) {
  return {
    repository_id: repository.repository_id,
    commit_id: commit.commit_id,
    manifest_hash: commit.manifest_hash,
    files: commit.artifacts.map((artifact) => ({
      path: artifact.path,
      type: artifact.type,
      bytes: artifact.bytes,
      content_hash: artifact.content_hash,
    })),
  }
}

export function createProgrammaticExport({ repository, commit, base_url }) {
  const base = requireString(base_url, "base_url").replace(/\/$/, "")
  return {
    repository_id: repository.repository_id,
    commit_id: commit.commit_id,
    rest_api: {
      repository: `${base}/repositories/${repository.repository_id}`,
      commit: `${base}/repositories/${repository.repository_id}/commits/${commit.commit_id}`,
      files: `${base}/repositories/${repository.repository_id}/commits/${commit.commit_id}/files`,
      archive: `${base}/repositories/${repository.repository_id}/commits/${commit.commit_id}/archive`,
    },
    exports: ["zip", "tar.gz", "json-manifest", "schema.org"],
  }
}

export function createDemoRepositoryWorkspace() {
  const repository = createProjectRepository({
    repository_id: "repo_catalyst",
    title: "Catalyst Study",
    owner_id: "user_ada",
  })
  const dataV1 = createArtifact({
    artifact_id: "data_measurements",
    path: "data/measurements.csv",
    type: "csv",
    content: "sample,value\nA,1\n",
    metadata: { rows: 1 },
  })
  const code = createArtifact({
    artifact_id: "code_analysis",
    path: "code/run_analysis.py",
    type: "python",
    content: "print('analysis')",
  })
  const notebook = createArtifact({
    artifact_id: "notebook_qc",
    path: "notebooks/qc.ipynb",
    type: "notebook",
    content: "{\"cells\":[]}",
  })
  const metadata = createArtifact({
    artifact_id: "metadata_schema",
    path: "metadata/schema.json",
    type: "json",
    content: "{\"schema\":\"v1\"}",
  })
  const baseCommit = createCommit({
    commit_id: "commit_1",
    author_id: "user_ada",
    message: "Initial data release",
    artifacts: [dataV1, code, metadata],
    created_at: "2026-05-14T01:00:00.000Z",
  })
  const dataV2 = createArtifact({
    artifact_id: "data_measurements",
    path: "data/measurements.csv",
    type: "csv",
    content: "sample,value\nA,2\n",
    metadata: { rows: 1 },
  })
  const headCommit = createCommit({
    commit_id: "commit_2",
    parent_commit_id: baseCommit.commit_id,
    author_id: "user_ada",
    message: "Add notebook and update measurements",
    artifacts: [dataV2, code, notebook, metadata],
    created_at: "2026-05-14T02:00:00.000Z",
  })
  const branchRepository = createBranch({
    repository,
    name: "experiment-catalyst",
    from_commit_id: baseCommit.commit_id,
  })
  const tag = createSemanticTag({
    tag: "preprint-v1.0",
    version: "1.0.0",
    commit_id: headCommit.commit_id,
    doi: "10.1234/scibase.repo.v1",
  })
  const fork = createFork({
    source_repository_id: repository.repository_id,
    fork_repository_id: "repo_catalyst_fork",
    owner_id: "user_bob",
    source_commit_id: baseCommit.commit_id,
  })
  const mergeRequest = createMergeRequest({
    merge_request_id: "mr_notebook",
    source_repository_id: fork.repository_id,
    target_repository_id: repository.repository_id,
    source_commit: headCommit,
    target_commit: baseCommit,
    title: "Add quality-control notebook",
    author_id: "user_bob",
  })
  const pipeline = createReproducibilityPipeline({
    pipeline_id: "pipeline_1",
    entrypoint: "code/run_analysis.py",
    environment: "Dockerfile",
    expected_outputs: ["results/figure.png"],
  })

  return {
    repository: branchRepository,
    commits: [baseCommit, headCommit],
    diff: diffCommits(baseCommit, headCommit),
    tag,
    editor_session: createEditorSession({
      path: "notebooks/qc.ipynb",
      format: "jupyter",
      user_id: "user_ada",
      base_commit_id: headCommit.commit_id,
    }),
    timeline: createRevisionTimeline({ commits: [baseCommit, headCommit], tags: [tag] }),
    fork,
    merge_request: mergeRequest,
    reproducibility: runReproducibilityChecks(headCommit, pipeline),
    citation: createCitationMetadata({
      repository,
      commit: headCommit,
      doi: "10.1234/scibase.repo",
      authors: ["Ada Researcher"],
      keywords: ["catalyst", "reproducibility"],
    }),
    api_export: createProgrammaticExport({
      repository,
      commit: headCommit,
      base_url: "https://api.scibase.example/v1/",
    }),
    archive: exportRepositoryArchive({ repository, commit: headCommit }),
  }
}
