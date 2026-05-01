/**
 * CMF (Common Metadata Framework) integration for EMPWR.
 *
 * Calls server/cmf_tracker.py via stdin/stdout JSON protocol.
 * All methods are fire-and-forget — they never block or throw into the caller.
 *
 * When cmflib adds Python 3.12 support, replace the Python bridge with the
 * official cmflib calls while keeping this TypeScript interface unchanged.
 */
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACKER   = path.join(__dirname, 'cmf_tracker.py');

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ExtractionParams {
  model:              string;
  provider:           string;
  textLength:         number;
  sourceType:         'text' | 'file' | 'url' | 'web';
  sourceRef?:         string;
  graphId?:           number;
  graphName?:         string;
  nodeCount:          number;
  linkCount:          number;
  processingTimeMs?:  number;
  hasOntology?:       boolean;
  userId?:            number;
}

export interface EnrichmentParams {
  graphId:            number;
  maxEnrichments?:    number;
  newNodesAdded:      number;
  newLinksAdded:      number;
  enrichmentTimeMs?:  number;
  wikidataApiCalls?:  number;
  userId?:            number;
}

export interface MergeParams {
  inputGraphIds:       number[];
  mergedGraphId:       number;
  mergedGraphName?:    string;
  algorithm:           string;
  similarityThreshold: number;
  originalNodeCount:   number;
  mergedNodeCount:     number;
  unifiedEntities:     number;
  newRelationships:    number;
  processingTimeMs?:   number;
  userId?:             number;
}

export interface OntologyParams {
  ontologyId:         number;
  ontologyName?:      string;
  model:              string;
  provider:           string;
  enrichmentType?:    string;
  classCount?:        number;
  propertyCount?:     number;
  processingTimeMs?:  number;
  userId?:            number;
}

// ─────────────────────────────────────────────────────────
// Core bridge
// ─────────────────────────────────────────────────────────

function callTracker(command: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ command, params });
    const child = execFile('python3', [TRACKER], { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[CMF] Tracker error (${command}):`, err.message, stderr);
        resolve({ ok: false, error: err.message });
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        console.error('[CMF] Invalid JSON from tracker:', stdout);
        resolve({ ok: false, error: 'Invalid tracker output' });
      }
    });
    child.stdin?.write(payload);
    child.stdin?.end();
  });
}

// ─────────────────────────────────────────────────────────
// Public API — logging (fire-and-forget)
// ─────────────────────────────────────────────────────────

async function logExtraction(p: ExtractionParams): Promise<void> {
  callTracker('log_extraction', {
    model:              p.model,
    provider:           p.provider,
    text_length:        p.textLength,
    source_type:        p.sourceType,
    source_ref:         p.sourceRef ?? '',
    graph_id:           p.graphId,
    graph_name:         p.graphName ?? '',
    node_count:         p.nodeCount,
    link_count:         p.linkCount,
    processing_time_ms: p.processingTimeMs,
    has_ontology:       p.hasOntology ?? false,
    user_id:            p.userId,
  }).catch(() => {}); // never propagate
}

async function logEnrichment(p: EnrichmentParams): Promise<void> {
  callTracker('log_enrichment', {
    graph_id:            p.graphId,
    max_enrichments:     p.maxEnrichments ?? 10,
    new_nodes_added:     p.newNodesAdded,
    new_links_added:     p.newLinksAdded,
    enrichment_time_ms:  p.enrichmentTimeMs,
    wikidata_api_calls:  p.wikidataApiCalls,
    user_id:             p.userId,
  }).catch(() => {});
}

async function logMerge(p: MergeParams): Promise<void> {
  callTracker('log_merge', {
    input_graph_ids:      p.inputGraphIds,
    merged_graph_id:      p.mergedGraphId,
    merged_graph_name:    p.mergedGraphName ?? '',
    algorithm:            p.algorithm,
    similarity_threshold: p.similarityThreshold,
    original_node_count:  p.originalNodeCount,
    merged_node_count:    p.mergedNodeCount,
    unified_entities:     p.unifiedEntities,
    new_relationships:    p.newRelationships,
    processing_time_ms:   p.processingTimeMs,
    user_id:              p.userId,
  }).catch(() => {});
}

async function logOntology(p: OntologyParams): Promise<void> {
  callTracker('log_ontology', {
    ontology_id:       p.ontologyId,
    ontology_name:     p.ontologyName ?? '',
    model:             p.model,
    provider:          p.provider,
    enrichment_type:   p.enrichmentType ?? 'generate',
    class_count:       p.classCount,
    property_count:    p.propertyCount,
    processing_time_ms: p.processingTimeMs,
    user_id:           p.userId,
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────
// Public API — queries (return data for REST endpoints)
// ─────────────────────────────────────────────────────────

function queryExecutions(stage?: string, limit = 50) {
  return callTracker('query_executions', { stage, limit });
}

function queryLineage(graphId: number) {
  return callTracker('query_lineage', { graph_id: graphId });
}

function queryStats() {
  return callTracker('query_stats', {});
}

function exportJson() {
  return callTracker('export_json', {});
}

export const cmfService = {
  logExtraction,
  logEnrichment,
  logMerge,
  logOntology,
  queryExecutions,
  queryLineage,
  queryStats,
  exportJson,
};
