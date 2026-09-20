#!/usr/bin/env python3
"""
Create (or re-create) the Genie space over workspace.jobsearch via the Genie API.

    python scripts/create_genie_space.py            # creates, prints the space URL
    python scripts/create_genie_space.py --replace  # deletes an existing space with the same title first

Needs DATABRICKS_HOST and DATABRICKS_TOKEN. The serialized_space format was learned from
GET /api/2.0/genie/spaces/{id}?include_serialized_space=true on the workspace's starter space.
Gotchas: data_sources.tables must be sorted by identifier, and every question/instruction
needs an `id` of 32 lowercase hex characters (uuid4().hex) and each list must be sorted by id.
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dbsql import Databricks  # noqa: E402

TITLE = "Connect - Student Job Search"
SCHEMA = "workspace.jobsearch."

TABLES = sorted([
    "students", "people", "companies", "positions", "position_requirements", "connection_paths",
    "matches_positions", "matches_people", "v_skill_gaps", "v_opening_timeline",
    "internships", "category_requirements", "learning_catalog", "agent_runs",
])

SAMPLE_QUESTIONS = [
    "Who are the top 5 people student s001 should reach out to, and why?",
    "Which students have a same_club connection to someone at a company hiring in their vertical?",
    "What internships open in the next 30 days for class of 2028 SWE students?",
    "Which required certifications are students most often missing?",
    "For student s007, which positions score above 75 and what is missing?",
    "How many positions per vertical open each month over the next year?",
    "Which companies have the most alumni connections to UT Austin students?",
    "List students with no connection path stronger than 0.5 to anyone at a target company.",
    "How many Summer 2027 internships are there per category, and how many are just posted?",
    "Which companies in the internships directory have the most software engineering postings?",
    "What did the plan agent recommend most often, and how many fabrications did the check catch?",
]

TEXT_INSTRUCTIONS = [
    "* This is a student job-search product built on real human connections; all data is mock.\n",
    "* Verticals are exactly: swe, consulting, finance.\n",
    "* 'Connections' or 'hooks' means rows in connection_paths; strongest path_type is same_club, then alumni_at_target_company, same_school, same_hometown, same_major.\n",
    "* Use matches_people for ranked people per student (match_score, hook) and matches_positions for ranked positions per student (match_score, reasons, window_status).\n",
    "* window_status values: open, opens_soon (within 60 days), upcoming, closed. Application timing questions use positions.opens_on / closes_on.\n",
    "* 'Skill gaps' means v_skill_gaps; required = true rows are hard blockers.\n",
    "* Always include student name and id together, and person name with company.\n",
    "* internships is the real Summer 2027 directory (6,600+ postings, no dates or requirements in the source); category_requirements is what each category typically asks for; learning_catalog is how to close a requirement; agent_runs is every run of the plan agent with its tool trace.\n",
    "* Never suggest automated outreach or mass applications; the product is about human conversations.",
]

EXAMPLE_SQLS = [
    ("Who are the top 5 people student s001 should reach out to, and why?",
     f"SELECT person_name, company, title, hook, match_score\nFROM {SCHEMA}matches_people\nWHERE student_id = 's001'\nORDER BY match_score DESC\nLIMIT 5;"),
    ("Which required certifications are students most often missing?",
     f"SELECT requirement, COUNT(DISTINCT student_id) AS students_missing\nFROM {SCHEMA}v_skill_gaps\nWHERE kind = 'certification' AND required\nGROUP BY requirement\nORDER BY students_missing DESC;"),
    ("What internships open in the next 30 days for class of 2028 SWE students?",
     f"SELECT DISTINCT p.title, c.name AS company, p.opens_on, p.closes_on\nFROM {SCHEMA}positions p JOIN {SCHEMA}companies c ON c.id = p.company_id\n"
     "WHERE p.type = 'internship' AND p.vertical = 'swe' AND array_contains(p.target_grad_years, 2028)\n"
     "  AND p.opens_on BETWEEN current_date() AND date_add(current_date(), 30)\nORDER BY p.opens_on;"),
]


def _with_ids(items: list[dict]) -> list[dict]:
    """Attach a 32-hex id to each item and sort by it; the API requires both."""
    out = [{"id": uuid.uuid4().hex, **it} for it in items]
    return sorted(out, key=lambda d: d["id"])


def serialized_space() -> str:
    space = {
        "version": 2,
        "config": {"sample_questions": _with_ids([{"question": [q]} for q in SAMPLE_QUESTIONS])},
        "data_sources": {"tables": [{"identifier": SCHEMA + t} for t in TABLES]},
        "instructions": {
            "text_instructions": _with_ids([{"content": TEXT_INSTRUCTIONS}]),
            "example_question_sqls": _with_ids([{"question": [q], "sql": [s]} for q, s in EXAMPLE_SQLS]),
        },
    }
    return json.dumps(space)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--replace", action="store_true")
    args = ap.parse_args()
    db = Databricks()

    existing = [s for s in db.get("/api/2.0/genie/spaces").get("spaces", []) if s.get("title") == TITLE]
    if existing and not args.replace:
        s = existing[0]
        print(f"already exists: {db.host}/genie/rooms/{s['space_id']}  (use --replace to recreate)")
        return
    for s in existing:
        db._req("DELETE", f"/api/2.0/genie/spaces/{s['space_id']}")
        print(f"deleted old space {s['space_id']}")

    resp = db.post("/api/2.0/genie/spaces", {
        "title": TITLE,
        "description": "Ask in plain English about students, the people they have real human paths to, "
                       "open positions and timelines, and skill gaps. Mock data for the Deloitte x Databricks hackathon.",
        "warehouse_id": db.warehouse_id,
        "serialized_space": serialized_space(),
    })
    print(f"created: {db.host}/genie/rooms/{resp['space_id']}")


if __name__ == "__main__":
    main()
