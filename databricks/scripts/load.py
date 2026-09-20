#!/usr/bin/env python3
"""
End-to-end loader: schema -> upload seed files to the UC volume -> COPY INTO -> views.

    export DATABRICKS_HOST=https://<workspace>.cloud.databricks.com
    export DATABRICKS_TOKEN=<personal access token>     # never commit this
    python scripts/load.py [--skip-generate] [--views-only]

Falls back to batched INSERT ... VALUES if the Files API / Volumes are unavailable.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dbsql import Databricks  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "data" / "seed"
SQL = ROOT / "sql"
VOLUME = "/Volumes/workspace/jobsearch/seed"

TABLES = ["companies", "people", "positions", "position_requirements", "students", "connection_paths"]

# Column order + SQL type used only by the INSERT fallback.
FALLBACK_COLUMNS = {
    "companies": ["id", "name", "vertical", "size", "hq", "careers_url"],
    "people": ["id", "name", "email", "headline", "company", "company_id", "title", "school", "major", "grad_year",
               "function", "industry", "seniority", "hometown", "high_school", "clubs", "communities", "interests",
               "projects", "education", "roles", "posts", "events", "vertical", "location", "openness_to_chat", "linkedin_url",
               "photo_url"],
    "positions": ["id", "company_id", "title", "type", "vertical", "location", "opens_on", "closes_on",
                  "target_grad_years", "description", "posted_url"],
    "position_requirements": ["position_id", "requirement", "kind", "required"],
    "students": ["id", "name", "email", "school", "major", "grad_year", "target_verticals", "target_companies", "skills",
                 "certifications", "interests", "projects", "hometown", "high_school", "clubs", "communities", "events",
                 "resume_text", "questionnaire_answers", "photo_url", "created_at"],
    "connection_paths": ["student_id", "person_id", "path_type", "strength", "detail"],
}
DATE_COLS = {"opens_on", "closes_on"}
TS_COLS = {"created_at"}


def sql_literal(v, col: str) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, dict):
        return "named_struct(" + ", ".join(f"'{k}', {sql_literal(x, k)}" for k, x in v.items()) + ")"
    if isinstance(v, list):
        if not v:
            return "array()"
        if all(isinstance(x, int) for x in v):
            return "array(" + ", ".join(str(x) for x in v) + ")"
        return "array(" + ", ".join(sql_literal(x, col) for x in v) + ")"
    s = str(v).replace("\\", "\\\\").replace("'", "\\'")
    if col in DATE_COLS:
        return f"DATE'{s}'"
    if col in TS_COLS:
        return f"TIMESTAMP'{s}'"
    return f"'{s}'"


def insert_fallback(db: Databricks, table: str, batch: int = 200) -> None:
    cols = FALLBACK_COLUMNS[table]
    rows = [json.loads(l) for l in (SEED / f"{table}.jsonl").open(encoding="utf-8")]
    db.sql(f"TRUNCATE TABLE workspace.jobsearch.{table}")
    for i in range(0, len(rows), batch):
        chunk = rows[i:i + batch]
        values = ",\n".join("(" + ", ".join(sql_literal(r.get(c), c) for c in cols) + ")" for r in chunk)
        db.sql(f"INSERT INTO workspace.jobsearch.{table} ({', '.join(cols)}) VALUES\n{values}")
    print(f"    {table}: {len(rows)} rows via INSERT")


def load_learning_catalog(db: Databricks) -> None:
    """The catalog is small and hand-written, so it is inserted from its JSON rather than staged in the volume."""
    rows = json.loads((ROOT / "data" / "learning_catalog.json").read_text(encoding="utf-8"))
    cols = ["id", "requirement", "kind", "title", "provider", "cost_usd", "hours", "weeks", "format", "url", "note"]
    db.sql("TRUNCATE TABLE workspace.jobsearch.learning_catalog")
    values = ",\n".join("(" + ", ".join(sql_literal(r.get(c), c) for c in cols) + ")" for r in rows)
    db.sql(f"INSERT INTO workspace.jobsearch.learning_catalog ({', '.join(cols)}) VALUES\n{values}")
    print(f"    learning_catalog: {len(rows)} rows")


def load_category_requirements(db: Databricks) -> None:
    cats = json.loads((ROOT / "data" / "category_requirements.json").read_text(encoding="utf-8"))
    rows = [(c["category"], c["vertical"], r["requirement"], r["kind"], r["required"]) for c in cats for r in c["requirements"]]
    db.sql("TRUNCATE TABLE workspace.jobsearch.category_requirements")
    values = ",\n".join("(" + ", ".join(sql_literal(v, "x") for v in row) + ")" for row in rows)
    db.sql(f"INSERT INTO workspace.jobsearch.category_requirements (category, vertical, requirement, kind, required) VALUES\n{values}")
    print(f"    category_requirements: {len(rows)} rows over {len(cats)} categories")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-generate", action="store_true", help="don't re-run data/generate_mock.py")
    ap.add_argument("--views-only", action="store_true", help="only (re)create views in sql/02_views.sql")
    ap.add_argument("--force-insert", action="store_true", help="skip the volume path, use INSERT fallback")
    args = ap.parse_args()

    db = Databricks()
    print(f"host: {db.host}  warehouse: {db.warehouse_id}")

    if args.views_only:
        print("views")
        db.sql_file(str(SQL / "02_views.sql"))
        print("materialized match tables")
        db.sql_file(str(SQL / "03_materialize.sql"))
        print("ok")
        return

    if not args.skip_generate:
        print("generating seed data")
        subprocess.run([sys.executable, str(ROOT / "data" / "generate_mock.py")], check=True)

    print("schema")
    db.sql_file(str(SQL / "00_schema.sql"))

    loaded_via_volume = False
    if not args.force_insert:
        try:
            print("uploading seed files to volume")
            for t in TABLES:
                db.upload(str(SEED / f"{t}.jsonl"), f"{VOLUME}/{t}.jsonl")
                print(f"    {t}.jsonl")
            print("COPY INTO")
            db.sql_file(str(SQL / "01_load.sql"))
            loaded_via_volume = True
        except Exception as e:  # noqa: BLE001 - we want to fall back on any failure
            print(f"  volume path failed, falling back to INSERT: {str(e)[:300]}")

    if not loaded_via_volume:
        print("INSERT fallback")
        for t in TABLES:
            insert_fallback(db, t)

    print("views")
    db.sql_file(str(SQL / "02_views.sql"))
    print("materialized match tables")
    db.sql_file(str(SQL / "03_materialize.sql"))
    print("plan agent: catalog, tool function, run log")
    db.sql_file(str(SQL / "04_agent.sql"))
    load_learning_catalog(db)
    print("openings directory: internships + category requirements")
    db.upload(str(SEED / "internships.jsonl"), f"{VOLUME}/internships.jsonl")
    db.sql_file(str(SQL / "05_directory.sql"))
    load_category_requirements(db)
    print("demo session store")
    db.sql_file(str(SQL / "06_sessions.sql"))

    print("row counts")
    for t in TABLES + ["internships", "learning_catalog"]:
        n = db.sql(f"SELECT count(*) FROM workspace.jobsearch.{t}")["rows"][0][0]
        print(f"    {t:24s} {n}")
    print("ok")


if __name__ == "__main__":
    main()
