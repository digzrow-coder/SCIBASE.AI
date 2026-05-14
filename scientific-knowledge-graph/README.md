# Scientific Knowledge Graph

Self-contained MVP module for issue #17. It turns uploaded research text into typed scientific entities, relationships, searchable graph data, entity pages, recommendations, and JSON-LD linked data exports.

## Capabilities

- Extracts scientific entities from uploaded papers, datasets, notebooks, and protocols.
- Supports concepts, authors, affiliations, DOIs, software, instruments, methods, and datasets.
- Emits schema.org-style linked data for every entity.
- Creates typed relationships with evidence references and weights.
- Builds graph nodes, edges, counts, and entity-type statistics.
- Searches entities by label or alias with optional type filters.
- Recommends related entities from relationship weights.
- Builds entity pages with relationship context, recommendations, and linked data.
- Exports a JSON-LD graph payload for downstream search and semantic integrations.

## Usage

```bash
cd scientific-knowledge-graph
npm test
npm run demo
npm run serve
```

```js
import {
  extractScientificEntities,
  buildKnowledgeGraph,
  createRelationship,
  searchGraph,
} from "./src/knowledge-graph.js";

const entities = extractScientificEntities({
  document_id: "doc_1",
  title: "RNA-seq analysis with Python",
  text: "The dataset was analyzed with Python and Jupyter. DOI 10.1234/example.",
});

const graph = buildKnowledgeGraph({
  entities,
  relationships: [
    createRelationship({
      source_id: "dataset_dataset",
      target_id: "software_python",
      type: "analyzed_with",
      evidence_id: "doc_1",
    }),
  ],
});

console.log(searchGraph(graph, "python"));
```

## Runnable Demo

`npm run demo` prints a complete knowledge graph workspace with extracted
entities, relationships, graph stats, semantic search results, entity page
data, recommendations, and JSON-LD export output.

`npm run serve` starts a dependency-free local browser/API demo:

- `GET /`
- `GET /health`
- `GET /demo-graph`

Example:

```bash
open http://localhost:4316/
curl http://localhost:4316/demo-graph
```

## Requirement Mapping

| Issue requirement | Implementation |
| --- | --- |
| Entity extraction | `extractScientificEntities()` identifies DOIs, software, methods, instruments, and datasets from research text. |
| Structured entity model | `createEntity()` validates typed entities and stores aliases, ontology refs, sources, and linked data. |
| Scientific relationships | `createRelationship()` records typed edges with evidence IDs and weights. |
| Knowledge graph build | `buildKnowledgeGraph()` emits nodes, valid edges, counts, and entity-type statistics. |
| Navigation/search | `searchGraph()` supports query and type filters. |
| Recommendations | `recommendRelatedEntities()` ranks related nodes by edge weight. |
| Entity pages | `buildEntityPage()` collects relationships, recommendations, and JSON-LD for an entity. |
| Linked data exports | `exportGraphJsonLd()` produces schema.org-compatible graph output. |
| Local reviewer demo | `npm run demo` and `npm run serve` expose the full knowledge-graph workflow. |

## Verification

The test suite covers entity extraction, typed entity validation, graph construction, search/filtering, recommendations, entity pages, and JSON-LD exports.
