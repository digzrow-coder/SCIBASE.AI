import assert from "node:assert/strict";
import { test } from "node:test";
import { createHostingDemoServer } from "../src/server.js";
import {
  addArtifactVersion,
  buildPreview,
  createArtifactRecord,
  createDemoHostingWorkspace,
  createExecutionJob,
  fairComplianceReport,
} from "../src/hosting.js";

test("creates dataset records with standards metadata and FAIR status", () => {
  const artifact = createArtifactRecord({
    filename: "measurements.csv",
    folder: "experiments/run-42",
    title: "Run 42 measurements",
    content: "sample,temperature\nA,21.3\nB,20.9\n",
    tags: ["thermodynamics", "sensor", "sensor"],
    creator: "SCIBASE Lab",
    doi: "10.0000/scibase.run42",
    access: "public",
  });

  assert.equal(artifact.type, "dataset");
  assert.equal(artifact.folder, "/experiments/run-42/");
  assert.deepEqual(artifact.tags, ["sensor", "thermodynamics"]);
  assert.equal(artifact.metadata["@type"], "Dataset");
  assert.equal(artifact.metadata.identifier, "10.0000/scibase.run42");
  assert.deepEqual(fairComplianceReport(artifact), {
    findable: true,
    accessible: true,
    interoperable: true,
    reusable: true,
  });
});

test("builds metadata-aware previews for tabular datasets", () => {
  const artifact = createArtifactRecord({
    filename: "subjects.tsv",
    content: "id\tcohort\n1\tcontrol\n2\ttreatment\n",
  });

  assert.deepEqual(buildPreview(artifact, "id\tcohort\n1\tcontrol\n2\ttreatment\n"), {
    kind: "table",
    columns: ["id", "cohort"],
    sampleRows: [
      ["1", "control"],
      ["2", "treatment"],
    ],
    totalRows: 2,
  });
});

test("tracks version diffs for reproducible artifact updates", () => {
  const artifact = createArtifactRecord({
    filename: "analysis.py",
    content: "print('v1')\n",
  });
  const updated = addArtifactVersion(artifact, {
    content: "print('v2')\nprint('done')\n",
    note: "Add completion marker",
    createdAt: "2026-05-13T00:00:00.000Z",
  });

  assert.equal(updated.versions.length, 2);
  assert.equal(updated.versions[1].version, 2);
  assert.equal(updated.metadata.version, 2);
  assert.equal(updated.versions[1].diff.checksumChanged, true);
  assert.equal(updated.versions[1].diff.sizeDeltaBytes > 0, true);
});

test("creates sandboxed execution jobs with manual and scheduled triggers", () => {
  const manualJob = createExecutionJob({
    artifactId: "artifact_abc",
    entrypoint: "analysis.ipynb",
  });
  const scheduledJob = createExecutionJob({
    artifactId: "artifact_def",
    entrypoint: "pipeline.R",
    schedule: "0 3 * * 1",
    memoryLimit: "8 GiB",
  });

  assert.equal(manualJob.runtime, "jupyter");
  assert.equal(manualJob.sandbox.network, false);
  assert.deepEqual(manualJob.triggers, [{ type: "manual", label: "Run analysis" }]);
  assert.equal(scheduledJob.runtime, "r");
  assert.equal(scheduledJob.sandbox.memoryLimit, "8 GiB");
  assert.deepEqual(scheduledJob.triggers, [{ type: "cron", expression: "0 3 * * 1" }]);
});

test("creates and serves a runnable hosting demo workspace", async () => {
  const workspace = createDemoHostingWorkspace();
  assert.equal(workspace.artifacts.length, 3);
  assert.equal(workspace.previews.dataset.kind, "table");
  assert.equal(workspace.fair.dataset.reusable, true);
  assert.equal(workspace.execution_jobs.length, 2);

  const server = createHostingDemoServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const pageResponse = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(pageResponse.status, 200);
    assert.match(await pageResponse.text(), /Scientific Data & Code Hosting/);

    const workspaceResponse = await fetch(`http://127.0.0.1:${port}/demo-hosting`);
    const payload = await workspaceResponse.json();
    assert.equal(workspaceResponse.status, 200);
    assert.equal(payload.artifacts[0].filename, "measurements.csv");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
