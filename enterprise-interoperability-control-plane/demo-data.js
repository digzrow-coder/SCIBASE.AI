window.SCIBASE_CONTROL_PLANE_REPORT = {
  "institution": {
    "id": "northstar-research-office",
    "name": "Northstar Research Office"
  },
  "dashboard": {
    "projectCount": 2,
    "privateProjectCount": 1,
    "reproducibilityCoverage": 50,
    "aiReviewsGenerated": 10,
    "storageGb": 60,
    "projectsByDepartment": {
      "Materials Science": 1,
      "Neuroscience": 1
    }
  },
  "compliance": [
    {
      "projectId": "alzheimers-cell-atlas",
      "compliant": true,
      "missing": [],
      "tags": [
        "GRANT-TRACKED",
        "OPEN-SCIENCE"
      ]
    },
    {
      "projectId": "battery-materials-protocols",
      "compliant": false,
      "missing": [
        "data-availability",
        "reproducibility"
      ],
      "tags": [
        "DOCTORAL-WORK"
      ]
    }
  ],
  "apiCatalog": [
    {
      "id": "dspace-sync",
      "system": "DSpace",
      "auth": "oauth-client",
      "endpoints": [
        "GET /projects",
        "POST /exports"
      ],
      "eventTypes": [
        "project.published",
        "project.compliance_evaluated"
      ],
      "status": "ready"
    },
    {
      "id": "canvas-notify",
      "system": "Canvas LMS",
      "auth": "signed-webhook",
      "endpoints": [
        "POST /webhooks/research-output"
      ],
      "eventTypes": [
        "project.created",
        "review.completed"
      ],
      "status": "ready"
    }
  ],
  "exportPackages": [
    {
      "projectId": "alzheimers-cell-atlas",
      "title": "Alzheimer's Cell Atlas",
      "version": "v0.1.0",
      "targets": [
        {
          "id": "zenodo",
          "system": "Zenodo",
          "format": "zenodo-bundle",
          "ready": true,
          "requiredMetadata": [
            "doi",
            "orcid",
            "funding"
          ],
          "missingMetadata": []
        },
        {
          "id": "journal-jats",
          "system": "Journal Submission",
          "format": "jats",
          "ready": true,
          "requiredMetadata": [
            "doi",
            "orcid"
          ],
          "missingMetadata": []
        },
        {
          "id": "datacite",
          "system": "DataCite",
          "format": "datacite",
          "ready": true,
          "requiredMetadata": [
            "doi",
            "funding"
          ],
          "missingMetadata": []
        }
      ],
      "files": [
        "manuscript/main.md",
        "data/manifest.tsv",
        "results/figures.zip"
      ],
      "metadata": {
        "doi": "10.5555/scibase.demo.001",
        "orcid": "0000-0002-1825-0097",
        "funding": "NSF-OPEN-2026"
      },
      "packageDigest": "5d0ceef1260564ab6b81149c9b8337d3e88dac8c0c35caf07d756000cf165980",
      "readyTargets": [
        "zenodo",
        "journal-jats",
        "datacite"
      ]
    },
    {
      "projectId": "battery-materials-protocols",
      "title": "Battery Materials Protocols",
      "version": "v0.1.0",
      "targets": [
        {
          "id": "zenodo",
          "system": "Zenodo",
          "format": "zenodo-bundle",
          "ready": false,
          "requiredMetadata": [
            "doi",
            "orcid",
            "funding"
          ],
          "missingMetadata": [
            "orcid"
          ]
        },
        {
          "id": "journal-jats",
          "system": "Journal Submission",
          "format": "jats",
          "ready": false,
          "requiredMetadata": [
            "doi",
            "orcid"
          ],
          "missingMetadata": [
            "orcid"
          ]
        },
        {
          "id": "datacite",
          "system": "DataCite",
          "format": "datacite",
          "ready": true,
          "requiredMetadata": [
            "doi",
            "funding"
          ],
          "missingMetadata": []
        }
      ],
      "files": [
        "protocols/synthesis.md",
        "metadata.json"
      ],
      "metadata": {
        "doi": "10.5555/scibase.demo.002",
        "funding": "HORIZON-EU-DEMO"
      },
      "packageDigest": "4eeccf38ccf96e8a21e678ab171bea8d75c1b37c9a12227c31848c88b3c1e3a0",
      "readyTargets": [
        "datacite"
      ]
    }
  ],
  "webhookEvents": [
    {
      "id": "70a11209d3fcca17",
      "institutionId": "northstar-research-office",
      "eventType": "project.compliance_evaluated",
      "projectId": "alzheimers-cell-atlas",
      "payload": {
        "compliant": true,
        "reproducibilityScore": 92
      },
      "createdAt": "2026-05-15T00:00:00.000Z",
      "signature": "56bd4362a9e820677987dc101ed3b74049c88d65ed2b7d7e2e872d173299ab63",
      "headers": {
        "x-scibase-event": "project.compliance_evaluated",
        "x-scibase-signature": "sha256=56bd4362a9e820677987dc101ed3b74049c88d65ed2b7d7e2e872d173299ab63"
      }
    },
    {
      "id": "75e94ec51b5ed0d4",
      "institutionId": "northstar-research-office",
      "eventType": "project.compliance_evaluated",
      "projectId": "battery-materials-protocols",
      "payload": {
        "compliant": false,
        "reproducibilityScore": 76
      },
      "createdAt": "2026-05-15T00:00:00.000Z",
      "signature": "f886adb602022a81e59c3b1c3e6ef5f2f612cd79464e8ff7a0612ca445040b3c",
      "headers": {
        "x-scibase-event": "project.compliance_evaluated",
        "x-scibase-signature": "sha256=f886adb602022a81e59c3b1c3e6ef5f2f612cd79464e8ff7a0612ca445040b3c"
      }
    }
  ],
  "digest": "421b4cf84232a7f37080fae351e511b81ba6f10bdf33f4ca56549c8041f2a24a"
};
