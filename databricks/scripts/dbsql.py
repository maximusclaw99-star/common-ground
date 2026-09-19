#!/usr/bin/env python3
"""
Tiny Databricks client: SQL Statement Execution API + Files API. Stdlib only.

Reads DATABRICKS_HOST and DATABRICKS_TOKEN from the environment. Never logs the token.

    python scripts/dbsql.py "SELECT count(*) FROM workspace.jobsearch.students"
    python scripts/dbsql.py --file sql/00_schema.sql
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


class Databricks:
    def __init__(self) -> None:
        host = os.environ.get("DATABRICKS_HOST", "").strip().rstrip("/")
        token = os.environ.get("DATABRICKS_TOKEN", "").strip()
        if not host or not token:
            sys.exit("Set DATABRICKS_HOST (https://<workspace>.cloud.databricks.com) and DATABRICKS_TOKEN. See .env.example.")
        if not host.startswith("http"):
            host = "https://" + host
        self.host = host
        self._auth = {"Authorization": "Bearer " + token}
        self.warehouse_id = os.environ.get("DATABRICKS_WAREHOUSE_ID") or self._first_warehouse()

    # -- HTTP -------------------------------------------------------------- #
    def _req(self, method: str, path: str, body: bytes | None = None, content_type: str = "application/json") -> dict:
        req = urllib.request.Request(self.host + path, data=body, method=method)
        for k, v in self._auth.items():
            req.add_header(k, v)
        if body is not None:
            req.add_header("Content-Type", content_type)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")
            raise RuntimeError(f"{method} {path} -> HTTP {e.code}: {detail[:800]}") from None

    def get(self, path: str) -> dict:
        return self._req("GET", path)

    def post(self, path: str, payload: dict) -> dict:
        return self._req("POST", path, json.dumps(payload).encode())

    # -- Warehouses --------------------------------------------------------- #
    def _first_warehouse(self) -> str:
        whs = self.get("/api/2.0/sql/warehouses").get("warehouses", [])
        if not whs:
            sys.exit("No SQL warehouse found. Free Edition ships with 'Serverless Starter Warehouse'; check the SQL Warehouses page.")
        return whs[0]["id"]

    # -- SQL ---------------------------------------------------------------- #
    def sql(self, statement: str, timeout_s: int = 300) -> dict:
        """Run one statement, poll to completion, return {'columns': [...], 'rows': [[...]]}."""
        resp = self.post("/api/2.0/sql/statements", {
            "warehouse_id": self.warehouse_id,
            "statement": statement,
            "wait_timeout": "30s",
            "disposition": "INLINE",
            "format": "JSON_ARRAY",
        })
        sid = resp["statement_id"]
        deadline = time.time() + timeout_s
        while resp["status"]["state"] in ("PENDING", "RUNNING"):
            if time.time() > deadline:
                raise TimeoutError(f"statement {sid} still {resp['status']['state']} after {timeout_s}s")
            time.sleep(1.5)
            resp = self.get(f"/api/2.0/sql/statements/{sid}")
        state = resp["status"]["state"]
        if state != "SUCCEEDED":
            err = resp["status"].get("error", {})
            raise RuntimeError(f"{state}: {err.get('error_code', '')} {err.get('message', '')}\n  statement: {statement[:300]}")
        cols = [c["name"] for c in resp.get("manifest", {}).get("schema", {}).get("columns", [])]
        rows = resp.get("result", {}).get("data_array", [])
        return {"columns": cols, "rows": rows}

    def sql_file(self, path: str, echo: bool = True) -> None:
        """Run every ';'-terminated statement in a file, in order. Skips comment-only lines."""
        for i, stmt in enumerate(split_statements(open(path, encoding="utf-8").read()), 1):
            first_line = next((l for l in stmt.splitlines() if l.strip() and not l.strip().startswith("--")), stmt)
            if echo:
                print(f"  [{i:02d}] {first_line.strip()[:90]}", flush=True)
            self.sql(stmt)

    # -- Files API (UC Volumes) ---------------------------------------------- #
    def upload(self, local_path: str, volume_path: str) -> None:
        """PUT a local file to /Volumes/<catalog>/<schema>/<volume>/<file>."""
        with open(local_path, "rb") as f:
            body = f.read()
        quoted = urllib.parse.quote(volume_path)
        self._req("PUT", f"/api/2.0/fs/files{quoted}?overwrite=true", body, content_type="application/octet-stream")


def split_statements(sql_text: str) -> list[str]:
    stmts, buf = [], []
    for line in sql_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        buf.append(line)
        if stripped.endswith(";"):
            stmt = "\n".join(buf).strip().rstrip(";").strip()
            if stmt:
                stmts.append(stmt)
            buf = []
    tail = "\n".join(buf).strip().rstrip(";").strip()
    if tail:
        stmts.append(tail)
    return stmts


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("statement", nargs="?", help="SQL to run")
    ap.add_argument("--file", help="run every statement in this .sql file")
    args = ap.parse_args()
    db = Databricks()
    if args.file:
        print(f"running {args.file} on warehouse {db.warehouse_id}")
        db.sql_file(args.file)
        print("ok")
        return
    if not args.statement:
        ap.error("give a statement or --file")
    out = db.sql(args.statement)
    if out["columns"]:
        print("\t".join(out["columns"]))
    for r in out["rows"]:
        print("\t".join("" if v is None else str(v) for v in r))


if __name__ == "__main__":
    main()
