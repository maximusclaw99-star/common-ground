-- Demo-mode session store. One row per browser (the cg_demo cookie id). The app's in-memory map
-- is per server instance, which on Vercel means a resume uploaded on one instance was invisible
-- on the next request; with DATABRICKS_* set, src/lib/session/demo-persist.ts reads and writes here.
CREATE TABLE IF NOT EXISTS workspace.jobsearch.demo_sessions (
  id STRING NOT NULL COMMENT 'The browser id from the cg_demo cookie',
  student STRING COMMENT 'JSON of StoredStudent: profile, facts, meta, intakeCompletedAt, email, homophilyWeights',
  created_at TIMESTAMP COMMENT 'First seen',
  updated_at TIMESTAMP COMMENT 'Last write'
) USING DELTA
COMMENT 'Demo-mode session store. One row per browser. Replaces the per-instance in-memory map, which loses state across Vercel function instances.';
