/**
 * The SQL Statement Execution API, as a function.
 *
 * Free Edition is serverless-only and has no JDBC/ODBC story worth carrying in
 * a Next app, so REST is the transport — the same one databricks/scripts/dbsql.py
 * uses. Two facts from that script shape this: rows arrive POSITIONALLY (zip
 * them with the manifest to get names), and a statement can come back still
 * running, so we poll.
 *
 * Everything user-supplied goes through `parameters`. Resume text especially:
 * concatenating it into SQL would be an injection hole opened by a file upload.
 */

export interface SqlParam { name: string; value: string }

interface StatementResponse {
  statement_id?: string;
  status?: { state?: string; error?: { message?: string } };
  manifest?: { schema?: { columns?: { name: string }[] } };
  result?: { data_array?: string[][] };
}

export interface DatabricksConfig { host: string; token: string; warehouseId: string }

/** Reads the same variables the people provider and databricks/ scripts use. */
export function databricksConfig(): DatabricksConfig {
  const host = process.env.DATABRICKS_HOST?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const token = process.env.DATABRICKS_TOKEN;
  const warehouseId =
    process.env.DATABRICKS_WAREHOUSE_ID ?? process.env.DATABRICKS_HTTP_PATH?.split("/").pop();
  if (!host || !token || !warehouseId) {
    throw new Error(
      "Databricks needs DATABRICKS_HOST, DATABRICKS_TOKEN and DATABRICKS_WAREHOUSE_ID (or DATABRICKS_HTTP_PATH)",
    );
  }
  return { host, token, warehouseId };
}

export interface SqlOptions {
  /** Statement-level wait. ai_query on a 70B model can exceed the 50s cap. */
  waitTimeout?: string;
  /** How long to keep polling after the initial wait, in ms. */
  pollForMs?: number;
  config?: DatabricksConfig;
}

/** Runs a statement and returns rows as objects keyed by column name. */
export async function query(
  statement: string,
  parameters: SqlParam[] = [],
  opts: SqlOptions = {},
): Promise<Record<string, unknown>[]> {
  const cfg = opts.config ?? databricksConfig();
  const base = `https://${cfg.host}/api/2.0/sql/statements`;
  const headers = {
    authorization: `Bearer ${cfg.token}`,
    "content-type": "application/json",
  };

  let body = await post<StatementResponse>(base, headers, {
    warehouse_id: cfg.warehouseId,
    statement,
    parameters,
    wait_timeout: opts.waitTimeout ?? "30s",
    disposition: "INLINE",
    format: "JSON_ARRAY",
  });

  // PENDING/RUNNING means the wait elapsed, not that anything is wrong.
  const deadline = Date.now() + (opts.pollForMs ?? 120_000);
  while ((body.status?.state === "PENDING" || body.status?.state === "RUNNING") && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(`${base}/${body.statement_id}`, { headers });
    if (!res.ok) throw new Error(`Databricks poll failed: ${res.status} ${await res.text()}`);
    body = (await res.json()) as StatementResponse;
  }

  if (body.status?.state !== "SUCCEEDED") {
    throw new Error(
      `Databricks statement ${body.status?.state ?? "unknown"}: ${body.status?.error?.message ?? ""}`.trim(),
    );
  }

  const columns = body.manifest?.schema?.columns?.map((c) => c.name) ?? [];
  return (body.result?.data_array ?? []).map((values) => {
    const row: Record<string, unknown> = {};
    columns.forEach((name, i) => (row[name] = values[i]));
    return row;
  });
}

async function post<T>(url: string, headers: Record<string, string>, payload: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`Databricks query failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * The model behind ai_query. Free Edition carries no Claude endpoints; of the
 * pay-per-token models it does host, Llama 3.3 70B follows instructions best,
 * which is what databricks/docs/databricks_notes.md settled on and what the
 * existing skill-gap and resume-tailoring views already use.
 */
export const AI_QUERY_MODEL =
  process.env.DATABRICKS_MODEL ?? "databricks-meta-llama-3-3-70b-instruct";
