-- Snapshot the two match views into Delta tables. Views stay the source of truth;
-- these exist so the frontend and Genie get fast, stable reads without re-scoring.
-- Re-run scripts/load.py (or `python scripts/dbsql.py --file sql/03_materialize.sql`) to refresh.

CREATE OR REPLACE TABLE workspace.jobsearch.matches_positions
COMMENT 'Materialized snapshot of v_student_position_matches. Refresh with sql/03_materialize.sql.'
AS SELECT *, current_timestamp() AS scored_at FROM workspace.jobsearch.v_student_position_matches;

CREATE OR REPLACE TABLE workspace.jobsearch.matches_people
COMMENT 'Materialized snapshot of v_student_people_matches. Refresh with sql/03_materialize.sql.'
AS SELECT *, current_timestamp() AS scored_at FROM workspace.jobsearch.v_student_people_matches;

-- Convenience: one row per student with their top 5 people and top 5 positions, for the home screen.
CREATE OR REPLACE VIEW workspace.jobsearch.v_student_home
COMMENT 'Home-screen payload per student: top 5 people to reach out to and top 5 positions, as arrays of structs.'
AS
WITH tp AS (
  SELECT student_id, collect_list(struct(person_name, company, title, hook, match_score)) AS top_people
  FROM (SELECT *, row_number() OVER (PARTITION BY student_id ORDER BY match_score DESC) AS rn
        FROM workspace.jobsearch.matches_people)
  WHERE rn <= 5 GROUP BY student_id
),
tj AS (
  SELECT student_id, collect_list(struct(title, company, type, opens_on, window_status, match_score)) AS top_positions
  FROM (SELECT *, row_number() OVER (PARTITION BY student_id ORDER BY match_score DESC) AS rn
        FROM workspace.jobsearch.matches_positions WHERE window_status <> 'closed')
  WHERE rn <= 5 GROUP BY student_id
)
SELECT s.id AS student_id, s.name, s.school, s.grad_year, s.target_verticals, tp.top_people, tj.top_positions
FROM workspace.jobsearch.students s
LEFT JOIN tp ON tp.student_id = s.id
LEFT JOIN tj ON tj.student_id = s.id;
