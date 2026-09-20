-- The real openings: the Summer 2027 Internships Directory (Google Sheet export, 2026-09-19), 6,600+
-- postings, plus what roles in each of its categories typically ask for — the directory carries no
-- posting text, so category_requirements stands in for it and the UI says so.
-- Rows: data/seed/internships.jsonl (COPY INTO via the volume) and data/category_requirements.json
-- (inserted by scripts/load.py).

CREATE TABLE IF NOT EXISTS workspace.jobsearch.internships (
  id STRING NOT NULL COMMENT 'Directory row id, e.g. i00001',
  category STRING COMMENT 'Directory category, e.g. Software Engineering, Quantitative Trading / Research',
  company STRING COMMENT 'Employer as the directory writes it',
  title STRING COMMENT 'Role title',
  location STRING COMMENT 'City, State, Country as the directory writes it',
  just_posted BOOLEAN COMMENT 'Flagged Just Posted in the directory at export time',
  apply_url STRING COMMENT 'Live application URL (Greenhouse, Workday, Lever, ...)'
) USING DELTA
COMMENT 'Summer 2027 Internships Directory (Google Sheet export, 2026-09-19): 6,600+ real internship postings. No description, requirements or dates in the source.';

TRUNCATE TABLE workspace.jobsearch.internships;
COPY INTO workspace.jobsearch.internships
FROM (SELECT id, category, company, title, location, CAST(just_posted AS BOOLEAN) AS just_posted, apply_url
      FROM '/Volumes/workspace/jobsearch/seed/internships.jsonl')
FILEFORMAT = JSON
COPY_OPTIONS ('force' = 'true');

CREATE TABLE IF NOT EXISTS workspace.jobsearch.category_requirements (
  category STRING NOT NULL COMMENT 'Directory category, exactly as internships.category',
  vertical STRING NOT NULL COMMENT 'swe | consulting | finance | accounting | engineering | operations | business | design | science | other',
  requirement STRING NOT NULL COMMENT 'What roles in this category typically ask for',
  kind STRING NOT NULL COMMENT 'skill | certification | degree | experience',
  required BOOLEAN COMMENT 'true = usually a hard requirement'
) USING DELTA
COMMENT 'Typical requirements per directory category. The directory carries no posting text, so this stands in for it; the UI says so.';
