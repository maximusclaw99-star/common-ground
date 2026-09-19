-- Load seed JSONL from the UC volume into Delta tables.
-- Re-runnable: truncate, then COPY INTO with force=true so already-seen files reload.
-- Files land in the volume via scripts/load.py (Databricks Files API).

TRUNCATE TABLE workspace.jobsearch.companies;
COPY INTO workspace.jobsearch.companies
FROM (SELECT id, name, vertical, size, hq, careers_url
      FROM '/Volumes/workspace/jobsearch/seed/companies.jsonl')
FILEFORMAT = JSON
COPY_OPTIONS ('force' = 'true');

TRUNCATE TABLE workspace.jobsearch.people;
COPY INTO workspace.jobsearch.people
FROM (SELECT id, name, headline, company, company_id, title, school, major,
             CAST(grad_year AS INT) AS grad_year,
             function, industry, seniority, hometown, high_school,
             CAST(clubs AS ARRAY<STRING>) AS clubs,
             CAST(communities AS ARRAY<STRING>) AS communities,
             CAST(interests AS ARRAY<STRING>) AS interests,
             CAST(projects AS ARRAY<STRING>) AS projects,
             -- JSON inference sorts struct fields alphabetically, so rebuild each struct in DDL order.
             transform(education, e -> named_struct('school', CAST(e.school AS STRING), 'degree', CAST(e.degree AS STRING),
                                                    'field', CAST(e.field AS STRING), 'startYear', CAST(e.startYear AS INT),
                                                    'endYear', CAST(e.endYear AS INT),
                                                    'activities', CAST(e.activities AS ARRAY<STRING>))) AS education,
             transform(roles, r -> named_struct('company', CAST(r.company AS STRING), 'title', CAST(r.title AS STRING),
                                                'function', CAST(r.function AS STRING), 'industry', CAST(r.industry AS STRING),
                                                'seniority', CAST(r.seniority AS STRING), 'startYear', CAST(r.startYear AS INT),
                                                'endYear', CAST(r.endYear AS INT), 'clients', CAST(r.clients AS ARRAY<STRING>),
                                                'programs', CAST(r.programs AS ARRAY<STRING>))) AS roles,
             transform(posts, p -> named_struct('id', CAST(p.id AS STRING), 'kind', CAST(p.kind AS STRING),
                                                'title', CAST(p.title AS STRING), 'excerpt', CAST(p.excerpt AS STRING),
                                                'topics', CAST(p.topics AS ARRAY<STRING>), 'url', CAST(p.url AS STRING),
                                                'publishedAt', CAST(p.publishedAt AS STRING))) AS posts,
             transform(events, e -> named_struct('name', CAST(e.name AS STRING), 'kind', CAST(e.kind AS STRING),
                                                 'date', CAST(e.date AS STRING), 'org', CAST(e.org AS STRING))) AS events,
             vertical, location,
             CAST(openness_to_chat AS DOUBLE) AS openness_to_chat, linkedin_url, photo_url
      FROM '/Volumes/workspace/jobsearch/seed/people.jsonl')
FILEFORMAT = JSON
COPY_OPTIONS ('force' = 'true');

TRUNCATE TABLE workspace.jobsearch.positions;
COPY INTO workspace.jobsearch.positions
FROM (SELECT id, company_id, title, type, vertical, location,
             CAST(opens_on AS DATE) AS opens_on, CAST(closes_on AS DATE) AS closes_on,
             CAST(target_grad_years AS ARRAY<INT>) AS target_grad_years,
             description, posted_url
      FROM '/Volumes/workspace/jobsearch/seed/positions.jsonl')
FILEFORMAT = JSON
COPY_OPTIONS ('force' = 'true');

TRUNCATE TABLE workspace.jobsearch.position_requirements;
COPY INTO workspace.jobsearch.position_requirements
FROM (SELECT position_id, requirement, kind, CAST(required AS BOOLEAN) AS required
      FROM '/Volumes/workspace/jobsearch/seed/position_requirements.jsonl')
FILEFORMAT = JSON
COPY_OPTIONS ('force' = 'true');

TRUNCATE TABLE workspace.jobsearch.students;
COPY INTO workspace.jobsearch.students
FROM (SELECT id, name, email, school, major, CAST(grad_year AS INT) AS grad_year,
             CAST(target_verticals AS ARRAY<STRING>) AS target_verticals,
             CAST(target_companies AS ARRAY<STRING>) AS target_companies,
             CAST(skills AS ARRAY<STRING>) AS skills,
             CAST(certifications AS ARRAY<STRING>) AS certifications,
             CAST(interests AS ARRAY<STRING>) AS interests,
             CAST(projects AS ARRAY<STRING>) AS projects,
             hometown, high_school,
             CAST(clubs AS ARRAY<STRING>) AS clubs,
             CAST(communities AS ARRAY<STRING>) AS communities,
             transform(events, e -> named_struct('name', CAST(e.name AS STRING), 'kind', CAST(e.kind AS STRING),
                                                 'date', CAST(e.date AS STRING), 'org', CAST(e.org AS STRING))) AS events,
             resume_text, questionnaire_answers, photo_url,
             CAST(created_at AS TIMESTAMP) AS created_at
      FROM '/Volumes/workspace/jobsearch/seed/students.jsonl')
FILEFORMAT = JSON
COPY_OPTIONS ('force' = 'true');

TRUNCATE TABLE workspace.jobsearch.connection_paths;
COPY INTO workspace.jobsearch.connection_paths
FROM (SELECT student_id, person_id, path_type, CAST(strength AS DOUBLE) AS strength, detail
      FROM '/Volumes/workspace/jobsearch/seed/connection_paths.jsonl')
FILEFORMAT = JSON
COPY_OPTIONS ('force' = 'true');
