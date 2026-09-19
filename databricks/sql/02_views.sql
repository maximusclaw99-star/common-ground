-- Matching logic. All scoring lives here so the frontend never re-implements it.
-- Scores are 0-100-ish; treat them as ranks, not probabilities.

-- ---------------------------------------------------------------------------
-- 1. Student -> position fit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW workspace.jobsearch.v_student_position_matches
COMMENT 'Every (student, position) pair in a vertical the student targets, scored on vertical fit, grad-year eligibility, skill overlap, certification coverage, and application-window timing. reasons[] explains the score in plain English.'
AS
WITH reqs AS (
  SELECT position_id,
         collect_set(CASE WHEN kind = 'skill'         THEN requirement END) AS req_skills,
         collect_set(CASE WHEN kind = 'certification' THEN requirement END) AS req_certs,
         collect_set(CASE WHEN kind = 'certification' AND required THEN requirement END) AS req_certs_hard
  FROM workspace.jobsearch.position_requirements
  GROUP BY position_id
),
base AS (
  SELECT s.id AS student_id, s.name AS student_name, s.school, s.grad_year, s.target_verticals,
         coalesce(s.skills,         CAST(array() AS ARRAY<STRING>)) AS skills,
         coalesce(s.certifications, CAST(array() AS ARRAY<STRING>)) AS certifications,
         p.id AS position_id, p.title, p.type, p.vertical, p.location, p.opens_on, p.closes_on, p.target_grad_years,
         c.name AS company, c.id AS company_id,
         coalesce(r.req_skills,     CAST(array() AS ARRAY<STRING>)) AS req_skills,
         coalesce(r.req_certs,      CAST(array() AS ARRAY<STRING>)) AS req_certs,
         coalesce(r.req_certs_hard, CAST(array() AS ARRAY<STRING>)) AS req_certs_hard
  FROM workspace.jobsearch.students s
  JOIN workspace.jobsearch.positions p ON array_contains(s.target_verticals, p.vertical)
  JOIN workspace.jobsearch.companies c ON c.id = p.company_id
  LEFT JOIN reqs r ON r.position_id = p.id
),
scored AS (
  SELECT *,
    CASE WHEN element_at(target_verticals, 1) = vertical THEN 40 ELSE 25 END        AS vertical_pts,
    CASE WHEN array_contains(target_grad_years, grad_year) THEN 20 ELSE 0 END       AS grad_pts,
    size(array_intersect(skills, req_skills))                                        AS skills_matched,
    size(req_skills)                                                                 AS skills_total,
    size(array_intersect(certifications, req_certs))                                 AS certs_matched,
    size(req_certs)                                                                  AS certs_total,
    array_except(req_certs_hard, certifications)                                     AS missing_required_certs,
    datediff(opens_on, current_date())                                               AS days_until_open,
    CASE WHEN current_date() BETWEEN opens_on AND closes_on                          THEN 'open'
         WHEN opens_on > current_date() AND datediff(opens_on, current_date()) <= 60 THEN 'opens_soon'
         WHEN opens_on > current_date()                                              THEN 'upcoming'
         ELSE 'closed' END                                                           AS window_status
  FROM base
)
SELECT student_id, student_name, position_id, title, company, company_id, type, vertical, location,
       opens_on, closes_on, window_status, days_until_open,
       round(vertical_pts + grad_pts
             + CASE WHEN skills_total = 0 THEN 15 ELSE 25.0 * skills_matched / skills_total END
             + CASE WHEN certs_total  = 0 THEN 5  ELSE 10.0 * certs_matched  / certs_total  END
             + CASE window_status WHEN 'open' THEN 5 WHEN 'opens_soon' THEN 5 WHEN 'upcoming' THEN 2 ELSE -20 END
             - CASE WHEN size(missing_required_certs) > 0 THEN 10 ELSE 0 END, 1)   AS match_score,
       skills_matched, skills_total, certs_matched, certs_total, missing_required_certs,
       filter(array(
         CASE WHEN element_at(target_verticals, 1) = vertical
              THEN concat('Primary target vertical: ', vertical)
              ELSE concat('Secondary vertical: ', vertical) END,
         CASE WHEN array_contains(target_grad_years, grad_year)
              THEN concat('Targets your class of ', CAST(grad_year AS STRING))
              ELSE concat('Not aimed at the class of ', CAST(grad_year AS STRING)) END,
         CASE WHEN skills_total > 0
              THEN concat(CAST(skills_matched AS STRING), '/', CAST(skills_total AS STRING), ' listed skills: ',
                          array_join(array_intersect(skills, req_skills), ', ')) END,
         CASE WHEN size(missing_required_certs) > 0
              THEN concat('Missing required certification: ', array_join(missing_required_certs, ', ')) END,
         CASE window_status
              WHEN 'open'       THEN 'Applications open now'
              WHEN 'opens_soon' THEN concat('Opens in ', CAST(days_until_open AS STRING), ' days')
              WHEN 'upcoming'   THEN concat('Opens ', CAST(opens_on AS STRING))
              ELSE 'Application window closed' END
       ), x -> x IS NOT NULL)                                                        AS reasons
FROM scored;

-- ---------------------------------------------------------------------------
-- 2. Student -> person: who to actually talk to, and what to say
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW workspace.jobsearch.v_student_people_matches
COMMENT 'People each student has a real human path to, ranked by combined hook strength, openness to chat, and whether the person works at a company hiring in the student vertical. hook is display-ready text for the opener; talking_points lists every shared thing.'
AS
WITH agg AS (
  SELECT student_id, person_id,
         collect_set(path_type)                                                                    AS path_types,
         max_by(path_type, strength)                                                               AS best_path_type,
         max_by(detail, strength)                                                                  AS best_detail,
         array_sort(collect_list(concat(path_type, ': ', coalesce(detail, ''))))                   AS all_hooks,
         -- noisy-or: multiple weak hooks add up but never exceed 1
         1 - aggregate(collect_list(strength), CAST(1.0 AS DOUBLE), (acc, x) -> acc * (1 - x))   AS path_strength
  FROM workspace.jobsearch.connection_paths
  GROUP BY student_id, person_id
),
target_companies AS (
  SELECT s.id AS student_id, collect_set(p.company_id) AS company_ids
  FROM workspace.jobsearch.students s
  JOIN workspace.jobsearch.positions p ON array_contains(s.target_verticals, p.vertical)
  GROUP BY s.id
)
SELECT s.id AS student_id, s.name AS student_name,
       pe.id AS person_id, pe.name AS person_name, pe.headline, pe.company, pe.company_id, pe.title,
       pe.school, pe.grad_year AS person_grad_year, pe.location, pe.linkedin_url, pe.openness_to_chat,
       a.path_types, a.best_path_type, round(a.path_strength, 3) AS path_strength,
       array_contains(t.company_ids, pe.company_id) AS at_target_company,
       round(100 * a.path_strength * (0.6 + 0.4 * pe.openness_to_chat)
             + CASE WHEN array_contains(t.company_ids, pe.company_id) THEN 15 ELSE 0 END, 1) AS match_score,
       CASE a.best_path_type
         WHEN 'same_high_school'         THEN concat('You both went to ', a.best_detail)
         WHEN 'same_club'                THEN concat('You were both in ', a.best_detail, CASE WHEN pe.school = s.school THEN concat(' at ', s.school) ELSE '' END)
         WHEN 'same_community'           THEN concat('You were both in ', a.best_detail)
         WHEN 'alumni_at_target_company' THEN concat(s.school, ' alum now at ', pe.company, ', which is hiring in ', pe.vertical)
         WHEN 'same_event'               THEN concat('You were both at ', a.best_detail, ' this week')
         WHEN 'shared_interest'          THEN concat('You are both into ', a.best_detail)
         WHEN 'same_school'              THEN concat('Fellow ', s.school, ' alum, class of ', CAST(pe.grad_year AS STRING))
         WHEN 'same_hometown'            THEN concat('Also from ', a.best_detail)
         WHEN 'same_major'               THEN concat('Also studied ', a.best_detail, ' at ', s.school)
       END AS hook,
       -- every hook, not just the best: the UI can show "and also..." lines
       a.all_hooks AS talking_points
FROM agg a
JOIN workspace.jobsearch.students s  ON s.id  = a.student_id
JOIN workspace.jobsearch.people   pe ON pe.id = a.person_id
LEFT JOIN target_companies t ON t.student_id = s.id;

-- ---------------------------------------------------------------------------
-- 3. Skill gaps: what stands between a student and a role they'd otherwise fit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW workspace.jobsearch.v_skill_gaps
COMMENT 'For each student and each position they score >= 50 on, the skills and certifications the posting lists that the student does not have. required=true rows are hard blockers. This is the input to the AI skill-gap advisor.'
AS
SELECT m.student_id, m.student_name, m.position_id, m.title, m.company, m.vertical, m.match_score,
       r.requirement, r.kind, r.required, m.opens_on, m.window_status
FROM workspace.jobsearch.v_student_position_matches m
JOIN workspace.jobsearch.position_requirements r ON r.position_id = m.position_id
JOIN workspace.jobsearch.students s ON s.id = m.student_id
WHERE r.kind IN ('skill', 'certification')
  AND NOT array_contains(coalesce(s.skills,         CAST(array() AS ARRAY<STRING>)), r.requirement)
  AND NOT array_contains(coalesce(s.certifications, CAST(array() AS ARRAY<STRING>)), r.requirement)
  AND m.match_score >= 50;

-- ---------------------------------------------------------------------------
-- 4. Opening timeline: when the windows the student cares about open
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW workspace.jobsearch.v_opening_timeline
COMMENT 'Upcoming and open application windows per student for positions scoring >= 45, soonest first. Feeds the timeline UI and "start early" nudges.'
AS
SELECT student_id, student_name, position_id, title, company, type, vertical, location,
       opens_on, closes_on, window_status, days_until_open, match_score
FROM workspace.jobsearch.v_student_position_matches
WHERE window_status IN ('open', 'opens_soon', 'upcoming')
  AND match_score >= 45
ORDER BY student_id, opens_on;

-- ---------------------------------------------------------------------------
-- 5. AI-assisted views. The ONLY places an LLM touches the product.
--    Each row is one model call, so always filter by student_id when querying.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW workspace.jobsearch.v_skill_gap_advice
COMMENT 'AI advice (Databricks ai_query, Llama 3.3 70B) on how to close each hard-required skill gap. One model call per row: filter by student_id. Never suggests skipping the requirement or automating outreach.'
AS
SELECT student_id, student_name, position_id, title, company, requirement, kind, match_score,
       ai_query(
         'databricks-meta-llama-3-3-70b-instruct',
         concat('A college student wants the role "', title, '" at ', company, '. ',
                'The posting lists "', requirement, '" (', kind, ') as required and the student does not have it yet. ',
                'In 2-3 plain sentences, tell them concretely how to close this gap: what to study or do, a realistic timeline, ',
                'and approximate cost if any. Do not suggest applying anyway, and do not suggest any automated outreach.')
       ) AS advice
FROM workspace.jobsearch.v_skill_gaps
WHERE required;

-- On-demand resume tailoring as a table function: SELECT * FROM workspace.jobsearch.tailor_resume('s001', 'j026')
CREATE OR REPLACE FUNCTION workspace.jobsearch.tailor_resume(p_student_id STRING, p_position_id STRING)
RETURNS TABLE (student_id STRING, position_id STRING, title STRING, company STRING, tailored_resume STRING)
COMMENT 'Rewrites the student resume to emphasize what this position asks for. Uses Databricks ai_query (Llama 3.3 70B). Never fabricates experience.'
RETURN
  SELECT s.id, p.id, p.title, c.name,
         ai_query(
           'databricks-meta-llama-3-3-70b-instruct',
           concat('You are helping a college student tailor their resume for a specific role. ',
                  'Rewrite the resume below so it leads with what this posting values, reorders skills to match, and tightens wording. ',
                  'HARD RULES: do not invent experience, skills, or certifications the student does not list; keep it under 250 words; plain text only; output ONLY the resume with no commentary, notes, or explanation of your changes.\n\n',
                  'ROLE: ', p.title, ' at ', c.name, '\nDESCRIPTION: ', p.description,
                  '\nREQUIREMENTS: ', coalesce((SELECT array_join(collect_list(concat(requirement, CASE WHEN required THEN ' (required)' ELSE '' END)), '; ')
                                               FROM workspace.jobsearch.position_requirements r WHERE r.position_id = p.id), 'none listed'),
                  '\n\nSTUDENT RESUME:\n', s.resume_text)
         )
  FROM workspace.jobsearch.students s
  JOIN workspace.jobsearch.positions p ON p.id = p_position_id
  JOIN workspace.jobsearch.companies c ON c.id = p.company_id
  WHERE s.id = p_student_id;

CREATE OR REPLACE VIEW workspace.jobsearch.v_tailored_resume
COMMENT 'AI-tailored resume for each student top-scoring open or upcoming position. One model call per row: filter by student_id. Uses ai_query (Llama 3.3 70B); instructed never to fabricate experience.'
AS
WITH top1 AS (
  SELECT student_id, position_id
  FROM (SELECT student_id, position_id,
               row_number() OVER (PARTITION BY student_id ORDER BY match_score DESC, opens_on) AS rn
        FROM workspace.jobsearch.v_student_position_matches
        WHERE window_status <> 'closed')
  WHERE rn = 1
)
SELECT t.student_id, s.name AS student_name, t.position_id, p.title, c.name AS company,
       ai_query(
         'databricks-meta-llama-3-3-70b-instruct',
         concat('You are helping a college student tailor their resume for a specific role. ',
                'Rewrite the resume below so it leads with what this posting values, reorders skills to match, and tightens wording. ',
                'HARD RULES: do not invent experience, skills, or certifications the student does not list; keep it under 250 words; plain text only; output ONLY the resume with no commentary, notes, or explanation of your changes.\n\n',
                'ROLE: ', p.title, ' at ', c.name, '\nDESCRIPTION: ', p.description,
                '\n\nSTUDENT RESUME:\n', s.resume_text)
       ) AS tailored_resume
FROM top1 t
JOIN workspace.jobsearch.students  s ON s.id = t.student_id
JOIN workspace.jobsearch.positions p ON p.id = t.position_id
JOIN workspace.jobsearch.companies c ON c.id = p.company_id;

-- ---------------------------------------------------------------------------
-- 6. The provider view. Exactly the Person shape src/lib/affinity/types.ts
--    expects, so src/lib/people/databricks.ts is a straight column read.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW workspace.jobsearch.v_people_provider
COMMENT 'People in the shape the web app Person type expects (src/lib/affinity/types.ts). Read by src/lib/people/databricks.ts. Nested columns come back from the Statement API as JSON strings.'
AS
SELECT id,
       name                AS full_name,
       email,
       headline,
       linkedin_url        AS profile_url,
       company             AS current_company,
       title               AS current_title,
       function            AS current_function,
       industry            AS current_industry,
       seniority           AS current_seniority,
       location,
       hometown,
       high_school,
       coalesce(communities, CAST(array() AS ARRAY<STRING>)) AS communities,
       coalesce(education,   CAST(array() AS ARRAY<STRUCT<school: STRING, degree: STRING, field: STRING, startYear: INT, endYear: INT, activities: ARRAY<STRING>>>)) AS education,
       coalesce(roles,       CAST(array() AS ARRAY<STRUCT<company: STRING, title: STRING, function: STRING, industry: STRING, seniority: STRING, startYear: INT, endYear: INT, clients: ARRAY<STRING>, programs: ARRAY<STRING>>>)) AS roles,
       coalesce(interests,   CAST(array() AS ARRAY<STRING>)) AS interests,
       coalesce(projects,    CAST(array() AS ARRAY<STRING>)) AS projects,
       coalesce(posts,       CAST(array() AS ARRAY<STRUCT<id: STRING, kind: STRING, title: STRING, excerpt: STRING, topics: ARRAY<STRING>, url: STRING, publishedAt: STRING>>)) AS posts,
       coalesce(events,      CAST(array() AS ARRAY<STRUCT<name: STRING, kind: STRING, date: STRING, org: STRING>>)) AS events,
       openness_to_chat,
       vertical,
       photo_url
FROM workspace.jobsearch.people;
