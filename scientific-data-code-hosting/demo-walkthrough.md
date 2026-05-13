# Demo Walkthrough

This is the reviewer walkthrough for the scientific data and code hosting MVP.

## Scenario

A research team uploads `measurements.csv` from an experiment, previews the data, attaches standards metadata, tracks an updated version, and creates a sandboxed notebook execution job.

## Steps

1. Create an artifact record with `createArtifactRecord()`.
   - The module classifies `measurements.csv` as a dataset.
   - It normalizes the folder path.
   - It emits schema.org JSON-LD metadata with identifier, creator, license, keywords, encoding format, URL, and version.

2. Preview the artifact with `buildPreview()`.
   - CSV and TSV files return a table preview.
   - JSON files return key and row summaries.
   - Code files return the first source lines and language.
   - Images return thumbnail metadata.

3. Update the artifact with `addArtifactVersion()`.
   - The module appends a new version.
   - It records checksum and size changes.
   - It provides a diff summary for reproducibility review.

4. Check FAIR status with `fairComplianceReport()`.
   - Findable: identifier and tags exist.
   - Accessible: access policy and URL exist.
   - Interoperable: supported dataset/code format exists.
   - Reusable: license and version history exist.

5. Create a reproducibility job with `createExecutionJob()`.
   - Notebook entrypoints use the `jupyter` runtime.
   - Python, R, and Julia entrypoints infer their corresponding runtimes.
   - Jobs are sandboxed by default with network disabled, resource limits, and either a manual trigger or cron trigger.

## Verification Command

```bash
cd scientific-data-code-hosting
npm test
```

Expected result: 4 passing tests covering metadata, previews, version diffs, FAIR checks, and sandboxed execution jobs.
