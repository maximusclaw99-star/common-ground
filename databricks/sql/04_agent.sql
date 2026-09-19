-- The plan agent's warehouse side: the learning catalog it reads as a tool, the UC function that
-- exposes it, and the table every run writes its trace to. Rows for the catalog come from
-- data/learning_catalog.json (loaded by scripts/load.py); the same file is bundled into the app
-- so mock mode answers identically.

CREATE TABLE IF NOT EXISTS workspace.jobsearch.learning_catalog (
  id STRING NOT NULL COMMENT 'Catalog id',
  requirement STRING NOT NULL COMMENT 'The posting requirement this closes, matching position_requirements.requirement',
  kind STRING NOT NULL COMMENT 'certification | course',
  title STRING NOT NULL COMMENT 'Name of the certification or course',
  provider STRING NOT NULL COMMENT 'Who issues or teaches it',
  cost_usd INT COMMENT 'Approximate all-in cost in USD; 0 = free',
  hours INT COMMENT 'Typical hours of study or coursework',
  weeks INT COMMENT 'Realistic calendar weeks for a full-time student',
  format STRING COMMENT 'exam | online course | bootcamp | book',
  url STRING COMMENT 'Where to start',
  note STRING COMMENT 'One line of honest advice about it'
) USING DELTA
COMMENT 'How to close a posting requirement: real certifications and courses with approximate cost and time. Read by the plan agent as a tool. Costs are approximate as of 2026.';

CREATE OR REPLACE FUNCTION workspace.jobsearch.learning_options(p_requirement STRING)
RETURNS TABLE (id STRING, title STRING, provider STRING, kind STRING, cost_usd INT, hours INT, weeks INT, format STRING, url STRING, note STRING)
COMMENT 'Agent tool: certifications and courses that close one posting requirement, cheapest-and-fastest first. Backed by learning_catalog.'
RETURN SELECT id, title, provider, kind, cost_usd, hours, weeks, format, url, note
       FROM workspace.jobsearch.learning_catalog
       WHERE lower(requirement) = lower(p_requirement)
       ORDER BY cost_usd, weeks;

CREATE TABLE IF NOT EXISTS workspace.jobsearch.agent_runs (
  run_id STRING NOT NULL COMMENT 'One agent run',
  started_at TIMESTAMP COMMENT 'When the run started',
  student_email STRING COMMENT 'Who asked (demo: sam.rivera@vt.edu)',
  position_id STRING COMMENT 'The opening the plan targets',
  model STRING COMMENT 'Databricks model endpoint used',
  steps INT COMMENT 'Tool calls made',
  duration_ms INT COMMENT 'Wall time',
  trace STRING COMMENT 'JSON array of {step, tool, args, summary, ms}',
  plan STRING COMMENT 'JSON of the final plan',
  fabrications INT COMMENT 'How many invented facts the check caught in the resume rewrite (0 is the goal)'
) USING DELTA
COMMENT 'Every run of the plan agent, with its full tool trace. Open this in Genie to ask what the agent did.';
