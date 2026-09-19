#!/usr/bin/env python3
"""
Create the Vector Search endpoint + delta-sync index over positions.description.

    python scripts/create_vector_index.py          # create if missing, then print status
    python scripts/create_vector_index.py --wait   # poll until the index is ready (or 20 min)

Needs DATABRICKS_HOST and DATABRICKS_TOKEN. Source table must have delta.enableChangeDataFeed=true
(set in sql/00_schema.sql).
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dbsql import Databricks  # noqa: E402

ENDPOINT = "connect-vs"
INDEX = "workspace.jobsearch.positions_index"
SOURCE = "workspace.jobsearch.positions"
EMBED_MODEL = "databricks-gte-large-en"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wait", action="store_true")
    args = ap.parse_args()
    db = Databricks()

    try:
        db.get(f"/api/2.0/vector-search/endpoints/{ENDPOINT}")
        print(f"endpoint {ENDPOINT}: exists")
    except RuntimeError as e:
        if "404" not in str(e):
            raise
        db.post("/api/2.0/vector-search/endpoints", {"name": ENDPOINT, "endpoint_type": "STANDARD"})
        print(f"endpoint {ENDPOINT}: created")

    try:
        db.get(f"/api/2.0/vector-search/indexes/{INDEX}")
        print(f"index {INDEX}: exists")
    except RuntimeError as e:
        if "404" not in str(e):
            raise
        db.post("/api/2.0/vector-search/indexes", {
            "name": INDEX, "endpoint_name": ENDPOINT, "primary_key": "id", "index_type": "DELTA_SYNC",
            "delta_sync_index_spec": {
                "source_table": SOURCE, "pipeline_type": "TRIGGERED",
                "embedding_source_columns": [{"name": "description", "embedding_model_endpoint_name": EMBED_MODEL}],
            },
        })
        print(f"index {INDEX}: created")

    deadline = time.time() + 20 * 60
    while True:
        st = db.get(f"/api/2.0/vector-search/indexes/{INDEX}").get("status", {})
        print(f"  {st.get('detailed_state')} — {st.get('message', '')}")
        if st.get("ready") or not args.wait or time.time() > deadline:
            break
        time.sleep(30)


if __name__ == "__main__":
    main()
