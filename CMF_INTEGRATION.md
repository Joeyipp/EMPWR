# CMF Integration Analysis — EMPWR × HewlettPackard/cmf

> **Repository:** [github.com/HewlettPackard/cmf](https://github.com/HewlettPackard/cmf)
> **CMF Docs:** [hewlettpackard.github.io/cmf](https://hewlettpackard.github.io/cmf/)

---

## Overview

The [Common Metadata Framework (CMF)](https://github.com/HewlettPackard/cmf) is a metadata tracking and lineage system for ML pipelines. It versions artifacts by content hash, tracks execution parameters and provenance, and provides a distributed push/pull sync model (similar to Git) for collaborative metadata sharing.

EMPWR is a Knowledge Graph lifecycle platform with multiple processing pipelines (extraction, enrichment, merging, ontology generation). The two systems are a natural fit: CMF's pipeline/lineage model maps directly onto EMPWR's KG lifecycle stages.

---

## Why Integrate CMF into EMPWR?

| Without CMF | With CMF |
|---|---|
| Graphs stored but no formal provenance beyond `dataSource` field | Every graph is a versioned artifact with a content hash |
| No way to reproduce an exact graph from its source | Full parameter capture (model, threshold, provider) per execution |
| Graph merging loses track of which inputs contributed what | Formal lineage: input graph A + B → merged graph C |
| No way to compare two runs of the same extraction | Execution diff: same text with GPT-4o vs Mistral-Large |
| Team members cannot share pipeline metadata | `cmf metadata push/pull` for distributed collaboration |
| No audit trail of Wikidata enrichment runs | Every enrichment logged with entity count, latency |

---

## EMPWR Pipeline → CMF Mapping

CMF organises metadata around three concepts: **Pipeline** → **Context (Stage)** → **Execution (Run)**. EMPWR's existing lifecycle maps cleanly onto these.

```
EMPWR KG Lifecycle                   CMF Equivalent
─────────────────────────────────────────────────────────────────
"knowledge_graph_pipeline"           Pipeline
  ├── Ingestion                   →  Context: "ingestion"
  │     text / file / URL         →  Input Dataset artifact
  ├── Extraction                  →  Context: "extraction"
  │     spaCy / OpenAI / Mistral  →  Execution (model, params)
  │     knowledge graph JSON      →  Output Dataset artifact
  ├── Enrichment (Wikidata)       →  Context: "enrichment"
  │     enriched graph JSON       →  Output Dataset artifact
  ├── Merging                     →  Context: "merging"
  │     algorithm, threshold      →  Execution parameters
  │     merged graph JSON         →  Output Dataset artifact
  └── Ontology Generation         →  Context: "ontology"
        prompt, model             →  Execution parameters
        ontology JSON             →  Output Dataset artifact
```

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    EMPWR Express Server                  │
│                                                          │
│  routes.ts ──► CMF Service (cmf-service.ts)             │
│                      │                                   │
│                       └──► cmf_tracker.py  (Python)     │
│                                  │                       │
│                                  ▼                       │
│                           cmflib (Python)                │
│                                  │                       │
│                    ┌─────────────┴──────────────┐        │
│                    ▼                            ▼        │
│             Local MLMD DB              CMF Server        │
│             (mlmd.db)                  (optional)        │
└─────────────────────────────────────────────────────────┘
```

The Node.js server calls a lightweight Python bridge (`server/cmf_tracker.py`) via child process — the same pattern already used for spaCy. The bridge wraps `cmflib` calls and accepts JSON over stdin/stdout.

---

## Integration Points in EMPWR

### 1. Text / File / URL Extraction  (`POST /api/process-text`, `/api/extract/*`)

**What to log:**
- Input artifact: raw text, file path, or URL (hashed by content)
- Execution params: `model`, `provider`, `text_length`, `has_ontology_constraints`
- Output artifact: generated knowledge graph JSON
- Metrics: `node_count`, `link_count`, `processing_time_ms`

```python
# cmf_tracker.py — extraction stage
context = cmf.create_context("extraction", {"source_type": "text"})
execution = cmf.create_execution("ExtractKnowledgeGraph", {
    "model": "gpt-4o",
    "provider": "openai",
    "text_length": 4200,
    "has_ontology": False,
})
cmf.log_dataset("inputs/source_text.txt", "input")
cmf.log_dataset("outputs/graph_42.json", "output")
cmf.log_execution_metrics("ExtractMetrics", {
    "node_count": 18,
    "link_count": 24,
    "processing_time_ms": 3400,
})
```

---

### 2. Wikidata Enrichment  (`POST /api/enrich-graph`)

**What to log:**
- Input artifact: pre-enrichment graph
- Execution params: `max_enrichments`, `wikidata_timeout_ms`
- Output artifact: enriched graph
- Metrics: `new_nodes_added`, `new_links_added`, `enrichment_time_ms`, `wikidata_api_calls`

```python
context = cmf.create_context("enrichment", {"source": "wikidata"})
execution = cmf.create_execution("WikidataEnrichment", {
    "max_enrichments": 10,
    "timeout_ms": 10000,
})
cmf.log_dataset("inputs/graph_42.json", "input")
cmf.log_dataset("outputs/graph_42_enriched.json", "output")
cmf.log_execution_metrics("EnrichmentMetrics", {
    "new_nodes_added": 6,
    "new_links_added": 14,
    "enrichment_time_ms": 2100,
    "wikidata_api_calls": 31,
})
```

---

### 3. Graph Merging  (`POST /api/graphs/merge`)

**What to log:**
- Input artifacts: all source graph IDs
- Execution params: `algorithm`, `similarity_threshold`, `input_graph_count`
- Output artifact: merged graph
- Metrics: `original_node_count`, `merged_node_count`, `unified_entities`, `new_relationships`

```python
context = cmf.create_context("merging", {"algorithm": "string-similarity"})
execution = cmf.create_execution("MergeGraphs", {
    "algorithm": "string-similarity",
    "similarity_threshold": 0.8,
    "input_graph_count": 3,
})
for gid in [42, 43, 44]:
    cmf.log_dataset(f"inputs/graph_{gid}.json", "input")
cmf.log_dataset("outputs/merged_graph_45.json", "output")
cmf.log_execution_metrics("MergeMetrics", {
    "original_node_count": 87,
    "merged_node_count": 61,
    "unified_entities": 26,
    "new_relationships": 9,
})
```

---

### 4. Ontology Generation  (`POST /api/ontologies/generate`, `/enrich`)

**What to log:**
- Input: prompt text artifact
- Execution params: `model`, `provider`, `enrichment_type`
- Output: ontology JSON artifact
- Metrics: `class_count`, `property_count`, `depth`

---

## Implementation Plan

### Step 1 — Install cmflib

```bash
pip3 install cmflib --break-system-packages
```

### Step 2 — Initialise CMF in the project

```bash
cd /home/user/EMPWR
cmf init local --path ./data/cmf-store --git-remote-url https://github.com/Joeyipp/EMPWR.git
```

This creates a local MLMD SQLite database at `data/cmf-store/mlmd`.

### Step 3 — Python bridge (`server/cmf_tracker.py`)

A lightweight Python script that reads a JSON command from stdin and calls the appropriate `cmflib` API. Called from `server/cmf-service.ts` via Node.js `child_process`.

### Step 4 — TypeScript CMF service (`server/cmf-service.ts`)

A thin async wrapper around the Python bridge, providing typed methods:

```typescript
// server/cmf-service.ts (proposed)
export const cmfService = {
  logExtraction(params: ExtractionParams): Promise<void>,
  logEnrichment(params: EnrichmentParams): Promise<void>,
  logMerge(params: MergeParams): Promise<void>,
  logOntologyGeneration(params: OntologyParams): Promise<void>,
}
```

### Step 5 — Hook into existing routes

Add CMF logging calls after each successful pipeline result — non-blocking (fire-and-forget) so they never affect API response time:

```typescript
// Inside POST /api/process-text, after graph is created:
cmfService.logExtraction({ model, nodeCount, linkCount, ... }).catch(console.error);
```

### Step 6 — (Optional) Run CMF Server for team collaboration

```bash
docker run -p 8080:8080 hewlettpackard/cmf-server
```

Then push local metadata:
```bash
cmf metadata push -p knowledge_graph_pipeline
```

---

## What the CMF Lineage View Would Look Like

```
source_article.txt ──[ExtractKnowledgeGraph]──► graph_42.json
                                                      │
                                          [WikidataEnrichment]
                                                      │
                                                      ▼
                             graph_42_enriched.json ──┐
                                                      │
                             graph_43.json ───────────┼──[MergeGraphs]──► merged_45.json
                                                      │
                             graph_44.json ───────────┘
```

This lineage is queryable:
```python
from cmflib import cmfquery
q = cmfquery.CmfQuery("./data/cmf-store/mlmd")
df = q.get_all_executions_in_stage("extraction")
```

And browsable in CMF's web UI, including D3.js lineage graph visualizations — complementing EMPWR's own graph explorer.

---

## MCP Server Integration (Bonus)

CMF ships with an [MCP server](https://hewlettpackard.github.io/cmf/mcp/) that lets AI assistants (Claude, Copilot, Cursor) query pipeline metadata using natural language. Once CMF is running, you could ask:

> *"Which model produced the most nodes per extraction run this week?"*
> *"Show me the lineage of merged graph 45."*
> *"Which graphs were enriched from Wikipedia sources?"*

This pairs naturally with EMPWR's own AI assistant panel.

---

## Summary of Benefits

| Capability | EMPWR Gains |
|---|---|
| **Artifact versioning** | Every graph version identified by content hash — reproducible and diffable |
| **Full lineage** | Trace any graph back to its exact source document and model run |
| **Execution comparison** | Compare GPT-4o vs. Mistral extractions on the same input |
| **Reproducibility** | Replay any graph generation with the exact same parameters |
| **Team collaboration** | `cmf metadata push/pull` to share pipeline history across team members |
| **Natural language queries** | CMF MCP server enables AI-powered metadata exploration |
| **Audit trail** | Compliance-ready record of all data transformations |
