import crypto from "node:crypto";
import path from "node:path";

const DATASET_EXTENSIONS = new Set([".csv", ".tsv", ".xlsx", ".json", ".parquet"]);
const CODE_EXTENSIONS = new Set([".py", ".r", ".jl", ".ipynb", ".js", ".ts"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

export function classifyArtifact(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (DATASET_EXTENSIONS.has(ext)) return "dataset";
  if (CODE_EXTENSIONS.has(ext)) return "code";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return "supplement";
}

export function createArtifactRecord(input) {
  const now = input.createdAt ?? new Date().toISOString();
  const checksum = sha256(input.content ?? "");
  const artifact = {
    id: input.id ?? `artifact_${checksum.slice(0, 12)}`,
    filename: input.filename,
    folder: normalizeFolder(input.folder ?? "/"),
    type: classifyArtifact(input.filename),
    checksum,
    sizeBytes: Buffer.byteLength(input.content ?? ""),
    license: input.license ?? "CC-BY-4.0",
    access: input.access ?? "private",
    tags: [...new Set(input.tags ?? [])].sort(),
    createdAt: now,
    versions: [
      {
        version: 1,
        checksum,
        sizeBytes: Buffer.byteLength(input.content ?? ""),
        createdAt: now,
        note: input.note ?? "Initial upload",
      },
    ],
  };

  return {
    ...artifact,
    metadata: buildMetadata({ ...input, artifact }),
  };
}

export function addArtifactVersion(artifact, input) {
  const checksum = sha256(input.content ?? "");
  const previous = artifact.versions.at(-1);
  const version = {
    version: previous.version + 1,
    checksum,
    sizeBytes: Buffer.byteLength(input.content ?? ""),
    createdAt: input.createdAt ?? new Date().toISOString(),
    note: input.note ?? "Updated artifact",
    diff: diffSummary(previous, {
      checksum,
      sizeBytes: Buffer.byteLength(input.content ?? ""),
    }),
  };

  return {
    ...artifact,
    checksum,
    sizeBytes: version.sizeBytes,
    versions: [...artifact.versions, version],
  };
}

export function buildPreview(artifact, content) {
  if (artifact.type === "dataset") {
    return previewDataset(artifact.filename, content);
  }
  if (artifact.type === "code") {
    return {
      kind: "code",
      language: path.extname(artifact.filename).slice(1) || "text",
      lines: content.split(/\r?\n/).slice(0, 20),
    };
  }
  if (artifact.type === "image") {
    return {
      kind: "thumbnail",
      alt: `${artifact.filename} preview`,
      checksum: artifact.checksum,
    };
  }
  return {
    kind: "download",
    filename: artifact.filename,
    sizeBytes: artifact.sizeBytes,
  };
}

export function createExecutionJob(input) {
  const runtime = input.runtime ?? inferRuntime(input.entrypoint);
  return {
    id: input.id ?? `job_${sha256(`${input.artifactId}:${input.entrypoint}`).slice(0, 12)}`,
    artifactId: input.artifactId,
    entrypoint: input.entrypoint,
    runtime,
    sandbox: {
      network: false,
      cpuLimit: input.cpuLimit ?? "2 vCPU",
      memoryLimit: input.memoryLimit ?? "4 GiB",
      timeoutSeconds: input.timeoutSeconds ?? 900,
    },
    triggers: input.schedule
      ? [{ type: "cron", expression: input.schedule }]
      : [{ type: "manual", label: "Run analysis" }],
  };
}

export function fairComplianceReport(artifact) {
  return {
    findable: Boolean(artifact.metadata.identifier && artifact.tags.length > 0),
    accessible: Boolean(artifact.access && artifact.metadata.url),
    interoperable: ["dataset", "code"].includes(artifact.type) && Boolean(artifact.metadata.encodingFormat),
    reusable: Boolean(artifact.license && artifact.metadata.license && artifact.versions.length > 0),
  };
}

function buildMetadata(input) {
  const { artifact } = input;
  const identifier = input.doi ?? `urn:scibase:${artifact.id}`;
  return {
    "@context": "https://schema.org",
    "@type": artifact.type === "dataset" ? "Dataset" : "SoftwareSourceCode",
    identifier,
    name: input.title ?? artifact.filename,
    description: input.description ?? `Research artifact ${artifact.filename}`,
    creator: input.creator ?? "Unknown researcher",
    license: artifact.license,
    keywords: artifact.tags,
    encodingFormat: path.extname(artifact.filename).slice(1) || "binary",
    dateCreated: artifact.createdAt,
    url: input.url ?? `https://scibase.ai/artifacts/${artifact.id}`,
    version: artifact.versions.at(-1).version,
  };
}

function previewDataset(filename, content) {
  if (filename.endsWith(".json")) {
    const parsed = JSON.parse(content);
    return {
      kind: "json",
      keys: Object.keys(Array.isArray(parsed) ? parsed[0] ?? {} : parsed).slice(0, 20),
      rows: Array.isArray(parsed) ? parsed.length : 1,
    };
  }

  const rows = content.trim().split(/\r?\n/).map((row) => row.split(filename.endsWith(".tsv") ? "\t" : ","));
  return {
    kind: "table",
    columns: rows[0] ?? [],
    sampleRows: rows.slice(1, 6),
    totalRows: Math.max(rows.length - 1, 0),
  };
}

function inferRuntime(entrypoint) {
  const ext = path.extname(entrypoint).toLowerCase();
  if (ext === ".r") return "r";
  if (ext === ".jl") return "julia";
  if (ext === ".ipynb") return "jupyter";
  return "python";
}

function diffSummary(previous, next) {
  return {
    checksumChanged: previous.checksum !== next.checksum,
    sizeDeltaBytes: next.sizeBytes - previous.sizeBytes,
  };
}

function normalizeFolder(folder) {
  const normalized = `/${folder}`.replaceAll("\\", "/").replace(/\/+/g, "/");
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
