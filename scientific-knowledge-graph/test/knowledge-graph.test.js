import assert from "node:assert/strict"
import test from "node:test"
import {
  buildEntityPage,
  buildKnowledgeGraph,
  createEntity,
  createRelationship,
  exportGraphJsonLd,
  extractScientificEntities,
  recommendRelatedEntities,
  searchGraph,
} from "../src/knowledge-graph.js"

test("extracts scientific entities from uploaded research text", () => {
  const entities = extractScientificEntities({
    document_id: "doc_1",
    title: "CRISPR screen with Python notebooks",
    text: "The dataset was analyzed with Python, NumPy, Jupyter, and RNA-seq. See DOI 10.1234/ABC.DEF.",
  })

  assert.ok(entities.some((entity) => entity.entity_id === "method_crispr"))
  assert.ok(entities.some((entity) => entity.entity_id === "software_python"))
  assert.ok(entities.some((entity) => entity.type === "doi"))
  assert.equal(new Set(entities.map((entity) => entity.entity_id)).size, entities.length)
})

test("creates typed entities and rejects unsupported types", () => {
  const entity = createEntity({
    type: "concept",
    label: "Graph Neural Networks",
    aliases: ["GNN"],
    ontology_refs: ["https://example.org/ontology/gnn"],
    source_ids: ["doc_2"],
  })

  assert.equal(entity.entity_id, "concept_graph_neural_networks")
  assert.equal(entity.schema_org["@context"], "https://schema.org")
  assert.throws(() => createEntity({ type: "unknown", label: "Bad" }), /Unsupported entity type/)
})

test("builds graph nodes, edges, and statistics", () => {
  const concept = createEntity({ type: "concept", label: "Catalyst", source_ids: ["doc_1"] })
  const method = createEntity({ type: "method", label: "Mass spectrometry", source_ids: ["doc_1"] })
  const software = createEntity({ type: "software", label: "Python", source_ids: ["doc_1"] })
  const graph = buildKnowledgeGraph({
    entities: [concept, method, software],
    relationships: [
      createRelationship({
        source_id: concept.entity_id,
        target_id: method.entity_id,
        type: "measured_by",
        evidence_id: "doc_1:line_12",
        weight: 0.9,
      }),
      createRelationship({
        source_id: concept.entity_id,
        target_id: software.entity_id,
        type: "analyzed_with",
        evidence_id: "doc_1:line_18",
        weight: 0.5,
      }),
      createRelationship({
        source_id: "missing",
        target_id: software.entity_id,
        type: "ignored",
        evidence_id: "doc_1",
      }),
    ],
  })

  assert.equal(graph.stats.entity_count, 3)
  assert.equal(graph.stats.relationship_count, 2)
  assert.deepEqual(graph.stats.entity_types, ["concept", "method", "software"])
})

test("searches graph and recommends related entities", () => {
  const graph = buildKnowledgeGraph({
    entities: [
      createEntity({ type: "concept", label: "RNA Sequencing", aliases: ["RNA-seq"] }),
      createEntity({ type: "software", label: "Python" }),
      createEntity({ type: "software", label: "Jupyter" }),
    ],
    relationships: [
      createRelationship({
        source_id: "concept_rna_sequencing",
        target_id: "software_python",
        type: "analyzed_with",
        evidence_id: "doc_1",
        weight: 0.8,
      }),
      createRelationship({
        source_id: "concept_rna_sequencing",
        target_id: "software_jupyter",
        type: "documented_in",
        evidence_id: "doc_1",
        weight: 0.4,
      }),
    ],
  })

  assert.equal(searchGraph(graph, "rna")[0].entity_id, "concept_rna_sequencing")
  assert.equal(searchGraph(graph, "python", { type: "software" })[0].entity_id, "software_python")
  const recommendations = recommendRelatedEntities(graph, "concept_rna_sequencing")
  assert.deepEqual(
    recommendations.map((item) => item.entity.entity_id),
    ["software_python", "software_jupyter"],
  )
})

test("builds entity pages and exports JSON-LD graph data", () => {
  const graph = buildKnowledgeGraph({
    entities: [
      createEntity({ type: "dataset", label: "Cancer Cohort" }),
      createEntity({ type: "doi", label: "10.5555/example" }),
    ],
    relationships: [
      createRelationship({
        source_id: "dataset_cancer_cohort",
        target_id: "doi_10_5555_example",
        type: "cited_by",
        evidence_id: "doc_3",
      }),
    ],
  })

  const page = buildEntityPage(graph, "dataset_cancer_cohort")
  const jsonLd = exportGraphJsonLd(graph)

  assert.equal(page.relationships.length, 1)
  assert.equal(page.linked_data["@type"], "Thing")
  assert.equal(jsonLd["@graph"].length, 2)
  assert.equal(jsonLd.relationships[0].name, "cited_by")
})
