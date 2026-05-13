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

export function createArtifact({ artifact_id, path, type, content, metadata = {} }) {
  if (!ALLOWED_FILE_TYPES.has(type)) throw new Error(`Unsupported artifact type: ${type}`)
  const normalizedPath = requireString(path, "path").replace(/\\/g, "/")
  const topLevel = normalizedPath.split("/")[0]
  if (!REQUIRED_SECTIONS.includes(topLevel)) throw new Error(`Artifact path must live under a repository section: ${topLevel}`)
  return {
    artifact_id: requireString(artifact_id, "artifact_id"),
    path: normalizedPath,
    type,
    content_hash: hashContent(requireString(content, "content")),
    bytes: Buffer.byteLength(content),
    metadata,
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

export function runReproducibilityChecks(commit) {
  const paths = new Set(commit.artifacts.map((artifact) => artifact.path))
  const hasData = [...paths].some((path) => path.startsWith("data/"))
  const hasCode = [...paths].some((path) => path.startsWith("code/") || path.startsWith("notebooks/"))
  const hasMetadata = [...paths].some((path) => path.startsWith("metadata/"))
  return {
    commit_id: commit.commit_id,
    checks: [
      { name: "data-present", passed: hasData },
      { name: "code-or-notebook-present", passed: hasCode },
      { name: "metadata-present", passed: hasMetadata },
      { name: "manifest-hash-present", passed: Boolean(commit.manifest_hash) },
    ],
    passed: hasData && hasCode && hasMetadata && Boolean(commit.manifest_hash),
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
