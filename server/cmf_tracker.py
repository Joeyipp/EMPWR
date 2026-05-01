#!/usr/bin/env python3
"""
CMF-compatible pipeline lineage tracker for EMPWR.

Uses SQLite directly (mirrors MLMD schema concepts) since cmflib requires
Python <=3.11 and this system runs Python 3.12. The database format is
designed to be forward-compatible with cmflib once a supported Python version
is available.

Called from server/cmf-service.ts via stdin/stdout JSON protocol:
  Input:  {"command": "log_extraction", "params": {...}}
  Output: {"ok": true, "id": 42} or {"ok": false, "error": "..."}
"""

import sqlite3
import json
import sys
import os
import hashlib
import time
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = os.environ.get(
    "CMF_DB_PATH",
    str(Path(__file__).parent.parent / "data" / "cmf-store" / "mlmd.db")
)

PIPELINE_NAME = "knowledge_graph_pipeline"


# ─────────────────────────────────────────────────────────
# Database bootstrap
# ─────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS pipelines (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT UNIQUE NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pipeline_id INTEGER REFERENCES pipelines(id),
    name        TEXT NOT NULL,
    UNIQUE(pipeline_id, name)
);

CREATE TABLE IF NOT EXISTS executions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    stage_id    INTEGER REFERENCES stages(id),
    name        TEXT NOT NULL,
    state       TEXT DEFAULT 'RUNNING',   -- RUNNING | COMPLETE | FAILED
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    duration_ms INTEGER,
    properties  TEXT DEFAULT '{}'         -- JSON
);

CREATE TABLE IF NOT EXISTS artifacts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    type         TEXT NOT NULL,           -- 'graph' | 'ontology' | 'source_text' | 'source_file' | 'source_url'
    name         TEXT NOT NULL,
    uri          TEXT,                    -- logical path or URL
    content_hash TEXT,                   -- SHA-256 of content
    size_bytes   INTEGER,
    created_at   TEXT NOT NULL,
    properties   TEXT DEFAULT '{}'        -- JSON
);

CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id INTEGER REFERENCES executions(id),
    artifact_id  INTEGER REFERENCES artifacts(id),
    type         TEXT NOT NULL,           -- 'INPUT' | 'OUTPUT'
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id INTEGER REFERENCES executions(id),
    name         TEXT NOT NULL,
    value        REAL,
    str_value    TEXT,
    created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_exec  ON events(execution_id);
CREATE INDEX IF NOT EXISTS idx_events_art   ON events(artifact_id);
CREATE INDEX IF NOT EXISTS idx_metrics_exec ON metrics(execution_id);
"""


def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


# ─────────────────────────────────────────────────────────
# Core helpers
# ─────────────────────────────────────────────────────────

def ensure_pipeline(conn) -> int:
    cur = conn.execute(
        "INSERT OR IGNORE INTO pipelines (name, created_at) VALUES (?, ?)",
        (PIPELINE_NAME, now_iso())
    )
    conn.commit()
    row = conn.execute("SELECT id FROM pipelines WHERE name=?", (PIPELINE_NAME,)).fetchone()
    return row["id"]


def ensure_stage(conn, pipeline_id: int, stage_name: str) -> int:
    conn.execute(
        "INSERT OR IGNORE INTO stages (pipeline_id, name) VALUES (?, ?)",
        (pipeline_id, stage_name)
    )
    conn.commit()
    row = conn.execute(
        "SELECT id FROM stages WHERE pipeline_id=? AND name=?",
        (pipeline_id, stage_name)
    ).fetchone()
    return row["id"]


def create_execution(conn, stage_id: int, name: str, props: dict) -> int:
    cur = conn.execute(
        "INSERT INTO executions (stage_id, name, started_at, properties) VALUES (?, ?, ?, ?)",
        (stage_id, name, now_iso(), json.dumps(props))
    )
    conn.commit()
    return cur.lastrowid


def complete_execution(conn, exec_id: int, duration_ms: int = None):
    conn.execute(
        "UPDATE executions SET state='COMPLETE', ended_at=?, duration_ms=? WHERE id=?",
        (now_iso(), duration_ms, exec_id)
    )
    conn.commit()


def create_artifact(conn, type_: str, name: str, uri: str = None,
                    content: str = None, properties: dict = None) -> int:
    content_hash = sha256(content) if content else None
    size = len(content.encode()) if content else None
    cur = conn.execute(
        "INSERT INTO artifacts (type, name, uri, content_hash, size_bytes, created_at, properties) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (type_, name, uri, content_hash, size, now_iso(), json.dumps(properties or {}))
    )
    conn.commit()
    return cur.lastrowid


def link_artifact(conn, exec_id: int, artifact_id: int, direction: str):
    conn.execute(
        "INSERT INTO events (execution_id, artifact_id, type, created_at) VALUES (?, ?, ?, ?)",
        (exec_id, artifact_id, direction, now_iso())
    )
    conn.commit()


def log_metric(conn, exec_id: int, name: str, value):
    if isinstance(value, (int, float)):
        conn.execute(
            "INSERT INTO metrics (execution_id, name, value, created_at) VALUES (?, ?, ?, ?)",
            (exec_id, name, float(value), now_iso())
        )
    else:
        conn.execute(
            "INSERT INTO metrics (execution_id, name, str_value, created_at) VALUES (?, ?, ?, ?)",
            (exec_id, name, str(value), now_iso())
        )
    conn.commit()


# ─────────────────────────────────────────────────────────
# Pipeline stage handlers
# ─────────────────────────────────────────────────────────

def handle_log_extraction(params: dict) -> dict:
    conn = get_conn()
    pid  = ensure_pipeline(conn)
    sid  = ensure_stage(conn, pid, "extraction")

    props = {
        "model":            params.get("model", "unknown"),
        "provider":         params.get("provider", "unknown"),
        "text_length":      params.get("text_length", 0),
        "has_ontology":     params.get("has_ontology", False),
        "source_type":      params.get("source_type", "text"),
        "user_id":          params.get("user_id"),
        "graph_id":         params.get("graph_id"),
    }
    exec_id = create_execution(conn, sid, "ExtractKnowledgeGraph", props)

    # Input artifact
    source_type = params.get("source_type", "text")
    source_ref  = params.get("source_ref", "")
    in_art = create_artifact(
        conn, f"source_{source_type}",
        f"source_{source_type}_{exec_id}",
        uri=source_ref,
        content=source_ref,
        properties={"source_type": source_type}
    )
    link_artifact(conn, exec_id, in_art, "INPUT")

    # Output artifact (knowledge graph)
    graph_id = params.get("graph_id")
    graph_json = json.dumps(params.get("graph_summary", {}))
    out_art = create_artifact(
        conn, "graph",
        f"graph_{graph_id}",
        uri=f"empwr://graphs/{graph_id}",
        content=graph_json,
        properties={"graph_id": graph_id, "graph_name": params.get("graph_name", "")}
    )
    link_artifact(conn, exec_id, out_art, "OUTPUT")

    # Metrics
    for key in ["node_count", "link_count", "processing_time_ms"]:
        if key in params:
            log_metric(conn, exec_id, key, params[key])

    complete_execution(conn, exec_id, params.get("processing_time_ms"))
    conn.close()
    return {"ok": True, "execution_id": exec_id, "artifact_id": out_art}


def handle_log_enrichment(params: dict) -> dict:
    conn = get_conn()
    pid  = ensure_pipeline(conn)
    sid  = ensure_stage(conn, pid, "enrichment")

    props = {
        "source":           "wikidata",
        "max_enrichments":  params.get("max_enrichments", 10),
        "graph_id":         params.get("graph_id"),
        "user_id":          params.get("user_id"),
    }
    exec_id = create_execution(conn, sid, "WikidataEnrichment", props)

    graph_id = params.get("graph_id")

    # Input: original graph
    in_art = create_artifact(conn, "graph", f"graph_{graph_id}_pre_enrich",
                             uri=f"empwr://graphs/{graph_id}",
                             properties={"graph_id": graph_id, "phase": "pre_enrichment"})
    link_artifact(conn, exec_id, in_art, "INPUT")

    # Output: enriched graph
    out_art = create_artifact(conn, "graph", f"graph_{graph_id}_enriched",
                              uri=f"empwr://graphs/{graph_id}",
                              properties={"graph_id": graph_id, "phase": "enriched"})
    link_artifact(conn, exec_id, out_art, "OUTPUT")

    for key in ["new_nodes_added", "new_links_added", "enrichment_time_ms", "wikidata_api_calls"]:
        if key in params:
            log_metric(conn, exec_id, key, params[key])

    complete_execution(conn, exec_id, params.get("enrichment_time_ms"))
    conn.close()
    return {"ok": True, "execution_id": exec_id, "artifact_id": out_art}


def handle_log_merge(params: dict) -> dict:
    conn = get_conn()
    pid  = ensure_pipeline(conn)
    sid  = ensure_stage(conn, pid, "merging")

    props = {
        "algorithm":            params.get("algorithm", "string-similarity"),
        "similarity_threshold": params.get("similarity_threshold", 0.8),
        "input_graph_count":    len(params.get("input_graph_ids", [])),
        "user_id":              params.get("user_id"),
        "merged_graph_id":      params.get("merged_graph_id"),
    }
    exec_id = create_execution(conn, sid, "MergeGraphs", props)

    # Input artifacts: all source graphs
    for gid in params.get("input_graph_ids", []):
        art = create_artifact(conn, "graph", f"graph_{gid}",
                              uri=f"empwr://graphs/{gid}",
                              properties={"graph_id": gid})
        link_artifact(conn, exec_id, art, "INPUT")

    # Output: merged graph
    mgid = params.get("merged_graph_id")
    out_art = create_artifact(conn, "graph", f"graph_{mgid}_merged",
                              uri=f"empwr://graphs/{mgid}",
                              properties={"graph_id": mgid, "graph_name": params.get("merged_graph_name", "")})
    link_artifact(conn, exec_id, out_art, "OUTPUT")

    for key in ["original_node_count", "merged_node_count", "unified_entities",
                "new_relationships", "processing_time_ms"]:
        if key in params:
            log_metric(conn, exec_id, key, params[key])

    complete_execution(conn, exec_id, params.get("processing_time_ms"))
    conn.close()
    return {"ok": True, "execution_id": exec_id, "artifact_id": out_art}


def handle_log_ontology(params: dict) -> dict:
    conn = get_conn()
    pid  = ensure_pipeline(conn)
    sid  = ensure_stage(conn, pid, "ontology")

    props = {
        "model":          params.get("model", "unknown"),
        "provider":       params.get("provider", "unknown"),
        "enrichment_type": params.get("enrichment_type", "generate"),
        "user_id":        params.get("user_id"),
        "ontology_id":    params.get("ontology_id"),
    }
    exec_id = create_execution(conn, sid, "OntologyGeneration", props)

    oid = params.get("ontology_id")
    out_art = create_artifact(conn, "ontology", f"ontology_{oid}",
                              uri=f"empwr://ontologies/{oid}",
                              properties={"ontology_id": oid, "name": params.get("ontology_name", "")})
    link_artifact(conn, exec_id, out_art, "OUTPUT")

    for key in ["class_count", "property_count", "processing_time_ms"]:
        if key in params:
            log_metric(conn, exec_id, key, params[key])

    complete_execution(conn, exec_id, params.get("processing_time_ms"))
    conn.close()
    return {"ok": True, "execution_id": exec_id, "artifact_id": out_art}


# ─────────────────────────────────────────────────────────
# Query handlers (for the REST inspection endpoints)
# ─────────────────────────────────────────────────────────

def handle_query_executions(params: dict) -> dict:
    conn = get_conn()
    stage = params.get("stage")
    limit = params.get("limit", 50)

    if stage:
        rows = conn.execute("""
            SELECT e.*, s.name as stage_name
            FROM executions e JOIN stages s ON e.stage_id = s.id
            WHERE s.name = ? ORDER BY e.started_at DESC LIMIT ?
        """, (stage, limit)).fetchall()
    else:
        rows = conn.execute("""
            SELECT e.*, s.name as stage_name
            FROM executions e JOIN stages s ON e.stage_id = s.id
            ORDER BY e.started_at DESC LIMIT ?
        """, (limit,)).fetchall()

    result = []
    for r in rows:
        rec = dict(r)
        rec["properties"] = json.loads(rec["properties"] or "{}")
        # Attach metrics
        metrics = conn.execute(
            "SELECT name, value, str_value FROM metrics WHERE execution_id=?", (r["id"],)
        ).fetchall()
        rec["metrics"] = {m["name"]: m["value"] if m["value"] is not None else m["str_value"]
                          for m in metrics}
        # Attach artifact IDs
        arts = conn.execute(
            "SELECT artifact_id, type FROM events WHERE execution_id=?", (r["id"],)
        ).fetchall()
        rec["artifacts"] = [{"artifact_id": a["artifact_id"], "type": a["type"]} for a in arts]
        result.append(rec)

    conn.close()
    return {"ok": True, "executions": result, "count": len(result)}


def handle_query_lineage(params: dict) -> dict:
    """Return full lineage for a graph ID."""
    conn = get_conn()
    graph_id = params.get("graph_id")

    # Find all artifacts for this graph
    art_rows = conn.execute(
        "SELECT * FROM artifacts WHERE uri=? OR uri LIKE ?",
        (f"empwr://graphs/{graph_id}", f"empwr://graphs/{graph_id}%")
    ).fetchall()

    lineage = []
    for art in art_rows:
        events = conn.execute(
            "SELECT e.*, ev.type as event_type, s.name as stage_name "
            "FROM events ev JOIN executions e ON ev.execution_id = e.id "
            "JOIN stages s ON e.stage_id = s.id "
            "WHERE ev.artifact_id=?", (art["id"],)
        ).fetchall()
        for ev in events:
            rec = dict(ev)
            rec["properties"] = json.loads(rec.get("properties") or "{}")
            metrics = conn.execute(
                "SELECT name, value, str_value FROM metrics WHERE execution_id=?", (ev["id"],)
            ).fetchall()
            rec["metrics"] = {m["name"]: m["value"] if m["value"] is not None else m["str_value"]
                              for m in metrics}
            lineage.append(rec)

    conn.close()
    return {"ok": True, "graph_id": graph_id, "lineage": lineage}


def handle_query_stats(params: dict) -> dict:
    conn = get_conn()
    stats = {}

    for stage in ["extraction", "enrichment", "merging", "ontology"]:
        row = conn.execute("""
            SELECT COUNT(*) as count,
                   AVG(duration_ms) as avg_duration_ms
            FROM executions e JOIN stages s ON e.stage_id = s.id
            WHERE s.name = ?
        """, (stage,)).fetchone()
        stats[stage] = {
            "execution_count": row["count"],
            "avg_duration_ms": round(row["avg_duration_ms"] or 0, 1),
        }

    # Top metrics
    for metric in ["node_count", "link_count", "new_nodes_added", "unified_entities"]:
        row = conn.execute(
            "SELECT SUM(value) as total, AVG(value) as avg FROM metrics WHERE name=?", (metric,)
        ).fetchone()
        stats[f"total_{metric}"] = int(row["total"] or 0)
        stats[f"avg_{metric}"]   = round(row["avg"] or 0, 1)

    artifact_count = conn.execute("SELECT COUNT(*) as c FROM artifacts").fetchone()["c"]
    stats["total_artifacts"] = artifact_count

    conn.close()
    return {"ok": True, "stats": stats}


def handle_export_json(params: dict) -> dict:
    conn = get_conn()
    executions = conn.execute(
        "SELECT e.*, s.name as stage_name FROM executions e JOIN stages s ON e.stage_id=s.id"
    ).fetchall()
    artifacts  = conn.execute("SELECT * FROM artifacts").fetchall()
    events     = conn.execute("SELECT * FROM events").fetchall()
    metrics    = conn.execute("SELECT * FROM metrics").fetchall()

    export = {
        "pipeline":   PIPELINE_NAME,
        "exported_at": now_iso(),
        "executions": [dict(r) | {"properties": json.loads(r["properties"] or "{}")} for r in executions],
        "artifacts":  [dict(r) | {"properties": json.loads(r["properties"] or "{}")} for r in artifacts],
        "events":     [dict(r) for r in events],
        "metrics":    [dict(r) for r in metrics],
    }
    conn.close()
    return {"ok": True, "export": export}


# ─────────────────────────────────────────────────────────
# Entry point — stdin/stdout JSON protocol
# ─────────────────────────────────────────────────────────

HANDLERS = {
    "log_extraction":   handle_log_extraction,
    "log_enrichment":   handle_log_enrichment,
    "log_merge":        handle_log_merge,
    "log_ontology":     handle_log_ontology,
    "query_executions": handle_query_executions,
    "query_lineage":    handle_query_lineage,
    "query_stats":      handle_query_stats,
    "export_json":      handle_export_json,
}

if __name__ == "__main__":
    try:
        payload = json.loads(sys.stdin.read())
        command = payload.get("command")
        params  = payload.get("params", {})

        if command not in HANDLERS:
            print(json.dumps({"ok": False, "error": f"Unknown command: {command}"}))
            sys.exit(1)

        result = HANDLERS[command](params)
        print(json.dumps(result))
    except Exception as e:
        import traceback
        print(json.dumps({"ok": False, "error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)
