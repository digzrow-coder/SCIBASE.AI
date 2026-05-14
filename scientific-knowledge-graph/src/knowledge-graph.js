const ENTITY_TYPES = new Set([
  "concept",
  "author",
  "affiliation",
  "doi",
  "software",
  "instrument",
  "method",
  "dataset",
])

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`)
  return value.trim()
}

function slug(value) {
  return requireString(value, "value").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}

function uniqueBy(items, key) {
  const seen = new Set()
  return items.filter((item) => {
    const value = key(item)
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

export function extractScientificEntities({ document_id, title = "", text }) {
  const sourceText = requireString(`${title}\n${text}`, "text")
  const entities = []

  for (const match of sourceText.matchAll(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/gi)) {
    entities.push(createEntity({ type: "doi", label: match[0], source_ids: [document_id] }))
  }
  for (const match of sourceText.matchAll(/\b(Python|R|Julia|MATLAB|TensorFlow|PyTorch|NumPy|SciPy|Jupyter)\b/g)) {
    entities.push(createEntity({ type: "software", label: match[0], source_ids: [document_id] }))
  }
  for (const match of sourceText.matchAll(/\b(RNA-seq|CRISPR|mass spectrometry|Bayesian inference|finite element analysis|molecular dynamics)\b/gi)) {
    entities.push(createEntity({ type: "method", label: match[0], source_ids: [document_id] }))
  }
  for (const match of sourceText.matchAll(/\b(dataset|cohort|assay|spectrometer|microscope|sequencer)\b/gi)) {
    const type = ["spectrometer", "microscope", "sequencer"].includes(match[0].toLowerCase()) ? "instrument" : "dataset"
    entities.push(createEntity({ type, label: match[0], source_ids: [document_id] }))
  }

  return uniqueBy(entities, (entity) => entity.entity_id)
}

export function createEntity({ type, label, source_ids = [], ontology_refs = [], aliases = [] }) {
  if (!ENTITY_TYPES.has(type)) throw new Error(`Unsupported entity type: ${type}`)
  const normalizedLabel = requireString(label, "label")
  return {
    entity_id: `${type}_${slug(normalizedLabel)}`,
    type,
    label: normalizedLabel,
    aliases: aliases.map((alias) => requireString(alias, "alias")),
    ontology_refs: ontology_refs.map((ref) => requireString(ref, "ontology_ref")),
    source_ids: source_ids.map((id) => requireString(id, "source_id")),
    schema_org: {
      "@context": "https://schema.org",
      "@type": type === "doi" ? "ScholarlyArticle" : "Thing",
      name: normalizedLabel,
      identifier: `${type}:${normalizedLabel}`,
    },
  }
}

export function createRelationship({ source_id, target_id, type, evidence_id, weight = 1 }) {
  if (!Number.isFinite(weight) || weight <= 0) throw new Error("weight must be positive")
  return {
    relationship_id: `${requireString(type, "type")}_${requireString(source_id, "source_id")}_${requireString(target_id, "target_id")}`,
    source_id,
    target_id,
    type,
    evidence_id: requireString(evidence_id, "evidence_id"),
    weight: Number(weight.toFixed(3)),
  }
}

export function buildKnowledgeGraph({ entities = [], relationships = [] } = {}) {
  const entityMap = new Map(entities.map((entity) => [entity.entity_id, entity]))
  const validRelationships = relationships.filter(
    (relationship) => entityMap.has(relationship.source_id) && entityMap.has(relationship.target_id),
  )
  return {
    nodes: [...entityMap.values()],
    edges: uniqueBy(validRelationships, (relationship) => relationship.relationship_id),
    stats: {
      entity_count: entityMap.size,
      relationship_count: validRelationships.length,
      entity_types: [...new Set([...entityMap.values()].map((entity) => entity.type))].sort(),
    },
  }
}

export function searchGraph(graph, query, { type } = {}) {
  const needle = requireString(query, "query").toLowerCase()
  return graph.nodes.filter((node) => {
    const labels = [node.label, ...node.aliases].map((value) => value.toLowerCase())
    return (!type || node.type === type) && labels.some((label) => label.includes(needle))
  })
}

export function recommendRelatedEntities(graph, entity_id, { limit = 5 } = {}) {
  const scores = new Map()
  for (const edge of graph.edges) {
    if (edge.source_id === entity_id) scores.set(edge.target_id, (scores.get(edge.target_id) ?? 0) + edge.weight)
    if (edge.target_id === entity_id) scores.set(edge.source_id, (scores.get(edge.source_id) ?? 0) + edge.weight)
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, score]) => ({ entity: graph.nodes.find((node) => node.entity_id === id), score: Number(score.toFixed(3)) }))
}

export function buildEntityPage(graph, entity_id) {
  const entity = graph.nodes.find((node) => node.entity_id === entity_id)
  if (!entity) throw new Error(`Entity not found: ${entity_id}`)
  const relationships = graph.edges.filter((edge) => edge.source_id === entity_id || edge.target_id === entity_id)
  return {
    entity,
    relationships,
    recommendations: recommendRelatedEntities(graph, entity_id),
    linked_data: entity.schema_org,
  }
}

export function exportGraphJsonLd(graph) {
  return {
    "@context": "https://schema.org",
    "@graph": graph.nodes.map((node) => node.schema_org),
    relationships: graph.edges.map((edge) => ({
      "@type": "PropertyValue",
      name: edge.type,
      value: `${edge.source_id} -> ${edge.target_id}`,
      evidence: edge.evidence_id,
    })),
  }
}

export function createDemoKnowledgeGraphWorkspace() {
  const entities = [
    ...extractScientificEntities({
      document_id: "doc_crispr",
      title: "CRISPR screen with Python notebooks",
      text: "The dataset was analyzed with Python, NumPy, Jupyter, and RNA-seq. See DOI 10.1234/CRISPR.DATA.",
    }),
    createEntity({ type: "author", label: "Ada Researcher", aliases: ["A. Researcher"], source_ids: ["doc_crispr"] }),
    createEntity({ type: "affiliation", label: "Example University", source_ids: ["doc_crispr"] }),
  ]
  const relationships = [
    createRelationship({
      source_id: "dataset_dataset",
      target_id: "software_python",
      type: "analyzed_with",
      evidence_id: "doc_crispr:methods",
      weight: 0.9,
    }),
    createRelationship({
      source_id: "method_crispr",
      target_id: "dataset_dataset",
      type: "produces",
      evidence_id: "doc_crispr:abstract",
      weight: 0.75,
    }),
    createRelationship({
      source_id: "software_jupyter",
      target_id: "method_rna_seq",
      type: "documents",
      evidence_id: "doc_crispr:notebook",
      weight: 0.6,
    }),
    createRelationship({
      source_id: "author_ada_researcher",
      target_id: "affiliation_example_university",
      type: "affiliated_with",
      evidence_id: "doc_crispr:metadata",
      weight: 1,
    }),
  ]
  const graph = buildKnowledgeGraph({ entities, relationships })
  return {
    graph,
    search_results: {
      python: searchGraph(graph, "python"),
      methods: searchGraph(graph, "seq", { type: "method" }),
    },
    entity_page: buildEntityPage(graph, "dataset_dataset"),
    recommendations: recommendRelatedEntities(graph, "dataset_dataset"),
    json_ld: exportGraphJsonLd(graph),
  }
}
