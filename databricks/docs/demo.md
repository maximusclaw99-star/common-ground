# Live demo queries

Run these in the Databricks SQL editor (or Claude Code via the MCP server). Each one lands a point of the pitch.

## 1. "Here's who you already know" — the thesis in one query

```sql
SELECT person_name, company, title, hook, talking_points, match_score
FROM workspace.jobsearch.v_student_people_matches
WHERE student_id = 's001'
ORDER BY match_score DESC
LIMIT 5;
```

Talk track: the top result went to the same *high school*. `talking_points` lists everything else they share — a club,
a rec league, college football. That's a coffee chat, not a cover letter.

## 1b. The same thing in the app

Set `PEOPLE_PROVIDER=databricks` and open the dashboard as Sam Rivera. Dana Whitfield (Deloitte, Beta Alpha Psi at VT),
Jordan Okafor (Databricks, Consulting Club at VT, wrote about responsible AI 12 days ago), Priya Raman (made the exact
cybersecurity → consulting move), Chris Nakamura (was at the Deloitte Tech Case Competition yesterday). Every rung
of the ladder, from the warehouse.

## 2. "Here's what's in your way, and how to fix it" — AI where it belongs

```sql
SELECT title, company, requirement, advice
FROM workspace.jobsearch.v_skill_gap_advice
WHERE student_id = 's007' AND requirement = 'Security+'
LIMIT 1;
```

Talk track: s007 matches two backend internships on every skill except a required Security+. `ai_query()` inside Databricks explains the path: 2-3 months, ~$400-500. The AI never applies for them, never messages anyone. It tells them what to go learn.

## 3. "Start now, not senior year" — the timeline

```sql
SELECT date_trunc('month', opens_on) AS month, vertical, count(DISTINCT position_id) AS windows_opening
FROM workspace.jobsearch.v_opening_timeline
GROUP BY 1, 2 ORDER BY 1, 2;
```

Talk track: windows for class-of-2028 internships open *this month*. Sophomores who wait until spring have already missed most of them.

## Backup: Genie, live

Open the Genie space *Connect - Student Job Search* and type:

> Which required certifications are students most often missing?

or

> Who are the top 5 people student s003 should reach out to, and why?

## Backup: semantic search

```sql
SELECT id, title, search_score
FROM vector_search(index => 'workspace.jobsearch.positions_index',
                   query_text => 'I want to build things people actually use, small team, lots of ownership',
                   num_results => 5);
```

Talk track: the questionnaire captures intent in the student's own words; Vector Search maps that to roles without keyword matching.

## Backup: resume tailoring

```sql
SELECT title, company, tailored_resume
FROM workspace.jobsearch.tailor_resume('s005', 'j026');
```
