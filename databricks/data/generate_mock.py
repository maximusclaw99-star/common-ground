#!/usr/bin/env python3
"""
Deterministic mock-data generator for Common Ground.

Everything here is synthetic. People, schools' club names, and URLs are fabricated (URLs point at
example.com). Company names are a mix of fictional employers and the two real hackathon sponsors,
Deloitte and Databricks, because the demo student targets them. Re-running with the same SEED
produces byte-identical output.

The point of this data is coffee-chat talking points. Every person carries the small, nameable
things the affinity ladder (src/lib/affinity) scores on: high school, hometown, student orgs,
communities (ROTC, Eagle Scouts, a church, a rec league), specific interests, projects, named
programmes and clients, a recent post, a recent event, and a seniority rung.

Outputs newline-delimited JSON (one file per table) into data/seed/. JSONL rather than CSV because
most columns are arrays or arrays of structs, which Databricks COPY INTO ingests natively.

Usage:
    python databricks/data/generate_mock.py            # writes databricks/data/seed/*.jsonl
    python databricks/data/generate_mock.py --seed 7   # different but still deterministic
"""
from __future__ import annotations

import argparse
import json
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from faker import Faker

SEED = 20260919  # hackathon kickoff date; keep stable so teammates get the same data
TODAY = date(2026, 9, 19)
NOW = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)  # matches src/lib/affinity/__fixtures__/cast.ts NOW

OUT_DIR = Path(__file__).resolve().parent / "seed"

# --------------------------------------------------------------------------- #
# Reference pools
# --------------------------------------------------------------------------- #

VERTICALS = ["swe", "consulting", "finance"]

# School -> student orgs. Names are chosen to resolve in src/lib/affinity/aliases.ts where possible.
SCHOOLS = {
    "Virginia Tech": ["Beta Alpha Psi", "Consulting Club", "VT Hackers", "Hokie Investment Group", "Marching Band",
                      "Club Rowing", "Women in Computing"],
    "UT Austin": ["Texas Rocketry", "Longhorn Consulting Group", "Texas Investment Club", "Women in CS", "Hack Texas"],
    "Georgia Tech": ["Yellow Jacket Robotics", "GT Consulting Club", "Wreck Ventures", "HackGT", "Ramblin' Trading"],
    "UIUC": ["Illini Solar Car", "Illinois Business Consulting", "Illini Quant", "HackIllinois", "ACM @ UIUC"],
    "University of Michigan": ["Michigan Hackers", "Wolverine Consulting", "Michigan Investment Banking Club", "MHacks", "Solar Car Team"],
    "Purdue": ["Purdue Space Program", "Boilermaker Consulting", "Purdue Finance Club", "b01lers CTF", "Purdue Grand Prix"],
    "UC Berkeley": ["Cal Hacks", "Berkeley Consulting", "Haas Investment Group", "Blueprint", "Cal Formula Racing"],
    "Carnegie Mellon University": ["ScottyLabs", "Tartan Consulting", "Tartan Capital", "CMU Robotics Club", "Women in Finance"],
    "NYU": ["Tech@NYU", "Stern Consulting Group", "NYU Quant Club", "HackNYU", "Sales & Trading Society"],
    "University of Virginia": ["HooHacks", "Virginia Consulting Group", "McIntire Investment Institute", "Cavalier Robotics", "Women in CS"],
    "University of Pennsylvania": ["PennApps", "Wharton Consulting Club", "Wharton Investment & Trading Group", "Penn Robotics", "Dining Philosophers"],
}
# Orgs that exist at more than one school (Greek letters, honour societies) — the strongest tier-2 hooks.
CROSS_SCHOOL_ORGS = ["Beta Alpha Psi", "Alpha Kappa Psi", "Delta Sigma Pi", "Society of Women Engineers",
                     "National Society of Black Engineers", "Tau Beta Pi", "Phi Beta Kappa"]

MAJORS = {
    "swe": ["Computer Science", "Electrical & Computer Engineering", "Data Science", "Software Engineering", "Mathematics"],
    "consulting": ["Business Information Technology", "Economics", "Industrial Engineering", "Information Systems", "Public Policy",
                   "Business Administration"],
    "finance": ["Finance", "Economics", "Mathematics", "Accounting", "Statistics"],
}

# Hometown -> high schools. The high school is the sharper hook: "Deep Run" beats "Richmond".
HOMETOWNS = {
    "Richmond, VA": ["Deep Run High School", "Maggie L. Walker Governor's School", "Godwin High School"],
    "Arlington, VA": ["Washington-Liberty High School", "Yorktown High School"],
    "Fairfax, VA": ["Thomas Jefferson High School for Science and Technology", "Fairfax High School"],
    "Roanoke, VA": ["Patrick Henry High School", "Cave Spring High School"],
    "Austin, TX": ["Westlake High School", "LASA High School", "Anderson High School"],
    "Houston, TX": ["Bellaire High School", "Memorial High School"],
    "Dallas, TX": ["Highland Park High School", "Plano West Senior High"],
    "Atlanta, GA": ["Walton High School", "Grady High School"],
    "Chicago, IL": ["Whitney Young Magnet High School", "Lane Tech"],
    "Naperville, IL": ["Naperville North High School", "Naperville Central High School"],
    "Detroit, MI": ["Cass Technical High School", "Renaissance High School"],
    "Ann Arbor, MI": ["Huron High School", "Pioneer High School"],
    "Indianapolis, IN": ["Carmel High School", "North Central High School"],
    "San Jose, CA": ["Lynbrook High School", "Leland High School"],
    "Pittsburgh, PA": ["Taylor Allderdice High School", "Fox Chapel Area High School"],
    "Philadelphia, PA": ["Central High School", "Masterman"],
    "Brooklyn, NY": ["Brooklyn Tech", "Midwood High School"],
    "Charlotte, NC": ["Myers Park High School", "Ardrey Kell High School"],
    "Nashville, TN": ["Hume-Fogg", "Montgomery Bell Academy"],
    "Denver, CO": ["East High School", "Cherry Creek High School"],
    "Seattle, WA": ["Garfield High School", "Roosevelt High School"],
    "Minneapolis, MN": ["Southwest High School", "Edina High School"],
}

# Non-school life. Tier 5 on the ladder.
COMMUNITIES = ["Army ROTC", "Air Force ROTC", "Eagle Scouts", "Girl Scouts Gold Award", "FIRST Robotics alumni",
               "St. Mark's youth group", "Young Life", "Habitat for Humanity", "volunteer EMT", "Big Brothers Big Sisters",
               "community theater", "adult rec soccer league", "church choir", "Model UN alumni", "high school debate",
               "Boys & Girls Club volunteer", "Special Olympics coach", "4-H"]

# Concrete interests, not fields. Tier 7 needs "Formula 1", not "sports".
INTERESTS = ["Formula 1", "sourdough baking", "marathon training", "chess", "Go (the board game)", "vintage synthesizers",
             "rock climbing", "fantasy football", "birdwatching", "3D printing", "Dungeons & Dragons", "K-pop",
             "gravel cycling", "home espresso", "backcountry skiing", "salsa dancing", "woodworking", "trail running",
             "poker", "film photography", "fly fishing", "Premier League", "board game design", "urban sketching",
             "college football", "houseplants", "mechanical keyboards", "responsible AI", "public-sector technology",
             "open-source data tools", "personal finance", "pickleball"]

PROJECTS = ["built a fantasy-football lineup optimizer", "restored a '92 Miata", "runs a newsletter on fintech regulation",
            "maintains an open-source CLI for CSV cleanup", "organizes a monthly board-game night", "built a home weather station",
            "wrote a Chrome extension for split bills", "runs a small Etsy woodworking shop", "coaches a youth soccer team",
            "built a responsible-AI checklist for public-sector clients", "made a podcast about first-gen college students",
            "keeps a sourdough starter named Gary", "built a Databricks dashboard for campus energy use",
            "wrote a Security+ study guide for classmates", "maps every taco truck in Austin"]

# Fictional employers plus the two sponsors. (Name, size, vertical.)
COMPANIES = {
    "swe": [
        ("Databricks", "large"), ("Northwind Systems", "large"), ("Lattice Labs", "mid"), ("Halcyon Cloud", "large"),
        ("Quillsoft", "small"), ("Orbital Dynamics", "mid"), ("Ferrite AI", "small"), ("Brightline Software", "mid"),
        ("Kestrel Networks", "large"), ("Tidewater Robotics", "small"), ("Meridian Data", "mid"), ("Vantage Mobility", "large"),
        ("Sable Security", "small"), ("Cobalt Health Tech", "mid"), ("Argent Payments", "large"), ("Skyline Devices", "mid"),
        ("Granite Infrastructure", "large"), ("Nimbus Analytics", "mid"), ("Redwood Platforms", "large"),
    ],
    "consulting": [
        ("Deloitte", "large"), ("Ashford & Grey", "large"), ("Beacon Strategy Partners", "large"), ("Corvid Advisory", "mid"),
        ("Delta Ridge Consulting", "large"), ("Eastgate Partners", "mid"), ("Foxglove Advisory", "small"),
        ("Harbor Point Consulting", "large"), ("Ironwood Strategy", "mid"), ("Juniper Public Sector", "mid"),
        ("Keystone Operations Group", "small"), ("Acme Analytics", "small"),
    ],
    "finance": [
        ("Atlas Capital Partners", "large"), ("Blackstone Ridge", "large"), ("Carraway Asset Management", "mid"),
        ("Dunmore Securities", "large"), ("Everest Quant", "small"), ("Falcon Point Trading", "mid"),
        ("Greystone Investment Bank", "large"), ("Harlow Private Equity", "mid"), ("Ivory Tower Ventures", "small"),
        ("Jetstream Fintech", "mid"),
    ],
}

# Named internal programmes and public-sector / enterprise clients. Tier 4.
PROGRAMS = {
    "Deloitte": ["Deloitte Analyst Program", "Deloitte Tech Case Competition", "Deloitte Cyber Academy"],
    "Databricks": ["Databricks University", "Databricks Solutions Architect Bootcamp"],
    "Acme Analytics": ["Acme Analytics Summer Program"],
}
CLIENTS = {
    "consulting": ["CMS", "Department of Veterans Affairs", "State of Texas DMV", "USDA", "a Fortune 100 retailer",
                   "Virginia Department of Health", "IRS", "a top-5 US bank"],
    "swe": ["a Fortune 100 retailer", "a top-5 US bank", "CMS"],
    "finance": ["a sovereign wealth fund", "a mid-cap healthcare roll-up"],
}

TITLES = {
    "swe": [("Software Engineer", "engineering"), ("Senior Software Engineer", "engineering"), ("Engineering Manager", "engineering"),
            ("Staff Engineer", "engineering"), ("Site Reliability Engineer", "engineering"), ("Data Engineer", "data"),
            ("ML Engineer", "machine learning"), ("Product Manager", "product"), ("Security Engineer", "cybersecurity"),
            ("Solutions Architect", "solutions"), ("University Recruiter", "recruiting")],
    "consulting": [("Analyst", "consulting"), ("Consultant", "consulting"), ("Senior Consultant", "consulting"),
                   ("Manager", "consulting"), ("Senior Manager, Technology Consulting", "consulting"),
                   ("Director", "consulting"), ("Partner", "consulting"), ("Technology Analyst", "consulting"),
                   ("Cyber Risk Consultant", "cybersecurity"), ("Campus Recruiting Lead", "recruiting")],
    "finance": [("Analyst", "investment banking"), ("Associate", "investment banking"), ("Vice President", "investment banking"),
                ("Director", "investment banking"), ("Managing Director", "investment banking"),
                ("Quantitative Researcher", "quant"), ("Trader", "trading"), ("Campus Recruiter", "recruiting")],
}
INDUSTRY = {"swe": "software", "consulting": "professional services", "finance": "financial services"}

# Matches TITLE_LADDER in src/lib/affinity/predicates.ts, most-senior-first.
SENIORITY_RULES = [
    (("chief", "cto", "ceo", "cfo", "coo", "president"), "executive"), (("partner",), "partner"),
    (("vice president", "vp", "head of"), "vp"), (("director",), "director"),
    (("senior manager",), "senior_manager"), (("manager",), "manager"),
    (("senior associate", "senior consultant", "senior analyst", "senior software engineer", "senior engineer", "staff engineer"), "senior_associate"),
    (("associate", "consultant"), "associate"),
    (("analyst", "engineer", "scientist", "developer", "architect", "researcher", "trader", "recruiter"), "analyst"),
    (("intern",), "intern"),
]


def seniority_of(title: str) -> str | None:
    t = title.lower()
    for keys, level in SENIORITY_RULES:
        if any(k in t for k in keys):
            return level
    return None


LOCATIONS = ["New York, NY", "San Francisco, CA", "Austin, TX", "Chicago, IL", "Seattle, WA", "Boston, MA",
             "Atlanta, GA", "Washington, DC", "Dallas, TX", "Arlington, VA", "Remote"]

POST_TEMPLATES = [
    ("article", "What I wish I knew before my first {vertical} internship", ["career advice", "internships"]),
    ("post", "Notes from {event}: three things that surprised me", ["recruiting", "events"]),
    ("talk", "Lightning talk at {event} on {interest}", ["{interest}"]),
    ("article", "Responsible AI in public-sector delivery: a field checklist", ["responsible AI", "public sector"]),
    ("post", "We're hiring {title}s at {company} — happy to chat with students", ["hiring", "{company}"]),
    ("podcast", "Guest on 'First Gen, First Job' about breaking into {vertical}", ["first-gen", "{vertical}"]),
    ("paper", "Measuring drift in production ML at {company}", ["machine learning", "MLOps"]),
]

EVENTS = [
    ("Deloitte Tech Case Competition", "case_competition", "Deloitte"),
    ("HackGT", "conference", "Georgia Tech"),
    ("Data + AI Summit", "conference", "Databricks"),
    ("Virginia Tech Fall Career Fair", "career_fair", "Virginia Tech"),
    ("UT Austin Engineering Expo", "career_fair", "UT Austin"),
    ("Grace Hopper Celebration", "conference", "AnitaB.org"),
    ("Deloitte Cyber Careers Webinar", "webinar", "Deloitte"),
    ("Databricks Campus Office Hours", "recruiting_event", "Databricks"),
    ("Michigan Ross Consulting Night", "recruiting_event", "University of Michigan"),
    ("NYU Stern Finance Forum", "recruiting_event", "NYU"),
]

POSITION_TEMPLATES = {
    "swe": [
        ("Software Engineering Intern", "internship"), ("Backend Engineer Intern", "internship"), ("ML Engineering Intern", "internship"),
        ("Security Engineering Intern", "internship"), ("Data Engineering Intern", "internship"), ("Solutions Architect Intern", "internship"),
        ("New Grad Software Engineer", "full_time"), ("New Grad Site Reliability Engineer", "full_time"),
        ("Undergraduate Research Assistant - Systems", "research"), ("Applied ML Research Intern", "research"),
    ],
    "consulting": [
        ("Summer Business Analyst", "internship"), ("Technology Consulting Intern", "internship"), ("Cyber Risk Intern", "internship"),
        ("Public Sector Analyst Intern", "internship"), ("Technology Analyst (New Grad)", "full_time"), ("Business Analyst (New Grad)", "full_time"),
        ("Operations Research Intern", "research"),
    ],
    "finance": [
        ("Investment Banking Summer Analyst", "internship"), ("Sales & Trading Summer Analyst", "internship"),
        ("Quantitative Research Intern", "internship"), ("Asset Management Summer Analyst", "internship"),
        ("Private Equity Analyst Intern", "internship"), ("Investment Banking Analyst (New Grad)", "full_time"),
        ("Quant Research Assistant", "research"),
    ],
}

SKILLS = {
    "swe": ["Python", "Java", "C++", "Go", "TypeScript", "React", "SQL", "AWS", "Docker", "Kubernetes", "Linux",
            "Git", "REST APIs", "Distributed Systems", "Machine Learning", "PyTorch", "Spark", "Terraform", "Rust"],
    "consulting": ["Excel modeling", "PowerPoint", "SQL", "Case interviews", "Stakeholder management", "Market sizing",
                   "Process mapping", "Tableau", "Python", "Financial modeling", "Public speaking", "Project management"],
    "finance": ["Excel modeling", "Financial modeling", "DCF valuation", "Bloomberg Terminal", "SQL", "Python",
                "Accounting", "Statistics", "VBA", "Options pricing", "R", "Pitch decks"],
}
CERTS = {
    "swe": ["AWS Solutions Architect Associate", "Security+", "CKA (Kubernetes)", "Google Cloud Associate Engineer",
            "Terraform Associate", "Databricks Data Engineer Associate"],
    "consulting": ["PMP", "Lean Six Sigma Green Belt", "Tableau Desktop Specialist", "Databricks Data Analyst Associate", "Security+"],
    "finance": ["CFA Level I", "Bloomberg Market Concepts", "FMVA", "Series 79 (SIE)", "Databricks Data Analyst Associate"],
}
REQUIREMENTS = {
    "swe": [("Python", "skill", 0.8), ("Java", "skill", 0.5), ("SQL", "skill", 0.6), ("Git", "skill", 0.9), ("AWS", "skill", 0.5),
            ("Docker", "skill", 0.4), ("Distributed Systems", "skill", 0.3), ("Security+", "certification", 0.7),
            ("AWS Solutions Architect Associate", "certification", 0.5), ("CKA (Kubernetes)", "certification", 0.4),
            ("BS in Computer Science or related", "degree", 0.9), ("Prior internship or shipped project", "experience", 0.5),
            ("Machine Learning", "skill", 0.4), ("Databricks Data Engineer Associate", "certification", 0.4), ("Spark", "skill", 0.5)],
    "consulting": [("Excel modeling", "skill", 0.9), ("PowerPoint", "skill", 0.9), ("Case interviews", "skill", 0.7), ("SQL", "skill", 0.4),
                   ("Market sizing", "skill", 0.5), ("Stakeholder management", "skill", 0.4), ("Lean Six Sigma Green Belt", "certification", 0.4),
                   ("Tableau Desktop Specialist", "certification", 0.4), ("PMP", "certification", 0.3), ("Security+", "certification", 0.5),
                   ("Bachelor's in business, economics, or engineering", "degree", 0.9), ("Prior leadership role in a student org", "experience", 0.6),
                   ("Databricks Data Analyst Associate", "certification", 0.4)],
    "finance": [("Excel modeling", "skill", 0.95), ("Financial modeling", "skill", 0.9), ("DCF valuation", "skill", 0.7),
                ("Bloomberg Terminal", "skill", 0.5), ("Accounting", "skill", 0.6), ("Python", "skill", 0.4), ("CFA Level I", "certification", 0.5),
                ("Bloomberg Market Concepts", "certification", 0.6), ("FMVA", "certification", 0.4), ("Series 79 (SIE)", "certification", 0.3),
                ("Bachelor's in finance, economics, or math", "degree", 0.9), ("Prior finance internship", "experience", 0.5),
                ("Statistics", "skill", 0.5), ("Databricks Data Analyst Associate", "certification", 0.3)],
}

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def pick(rng: random.Random, seq, k: int) -> list:
    k = max(0, min(k, len(seq)))
    return rng.sample(list(seq), k)


def iso_days_ago(days: float) -> str:
    return (NOW - timedelta(days=days)).isoformat().replace("+00:00", "Z")


def slug(s: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-")


def make_post(rng: random.Random, i: int, ctx: dict) -> dict:
    kind, title, topics = rng.choice(POST_TEMPLATES)
    fill = lambda s: s.format(**ctx)  # noqa: E731
    return {
        "id": f"post-{i:04d}",
        "kind": kind,
        "title": fill(title),
        "excerpt": None,
        "topics": [fill(t) for t in topics],
        "url": f"https://www.example.com/posts/{i:04d}",
        "publishedAt": iso_days_ago(rng.uniform(1, 40)),  # tier 8 decays over ~30 days; some are stale on purpose
    }


def make_event(rng: random.Random, days_ago: float | None = None, which=None) -> dict:
    name, kind, org = which or rng.choice(EVENTS)
    return {"name": name, "kind": kind, "date": iso_days_ago(days_ago if days_ago is not None else rng.uniform(0.5, 9)), "org": org}


# --------------------------------------------------------------------------- #
# Generators
# --------------------------------------------------------------------------- #


def gen_companies(rng: random.Random) -> list[dict]:
    rows, cid = [], 1
    for vertical, names in COMPANIES.items():
        for name, size in names:
            rows.append({"id": f"c{cid:03d}", "name": name, "vertical": vertical, "size": size,
                         "hq": rng.choice(LOCATIONS[:-1]), "careers_url": f"https://careers.example.com/{slug(name)}"})
            cid += 1
    return rows


def person_row(rng: random.Random, fake: Faker, pid: str, company: dict, *, school: str, grad_year: int,
               title: str | None = None, hometown: str | None = None, high_school: str | None = None,
               clubs: list[str] | None = None, communities: list[str] | None = None, interests: list[str] | None = None,
               projects: list[str] | None = None, prior_roles: list[dict] | None = None, programs: list[str] | None = None,
               clients: list[str] | None = None, posts: list[dict] | None = None, events: list[dict] | None = None,
               major: str | None = None, name: str | None = None, openness: float | None = None) -> dict:
    vertical = company["vertical"]
    title, function = (title, next((f for t, f in TITLES[vertical] if t == title), vertical)) if title else rng.choice(TITLES[vertical])
    hometown = hometown or rng.choice(list(HOMETOWNS))
    high_school = high_school or rng.choice(HOMETOWNS[hometown])
    major = major or rng.choice(MAJORS[vertical])
    name = name or fake.name()
    clubs = clubs if clubs is not None else pick(rng, SCHOOLS[school], rng.choice([1, 1, 2])) + (
        [rng.choice(CROSS_SCHOOL_ORGS)] if rng.random() < 0.25 else [])
    communities = communities if communities is not None else pick(rng, COMMUNITIES, rng.choice([0, 1, 1, 2]))
    interests = interests if interests is not None else pick(rng, INTERESTS, rng.randint(2, 4))
    projects = projects if projects is not None else pick(rng, PROJECTS, rng.choice([0, 1, 1, 2]))
    programs = programs if programs is not None else (pick(rng, PROGRAMS.get(company["name"], []), 1) if rng.random() < 0.6 else [])
    clients = clients if clients is not None else (pick(rng, CLIENTS[vertical], rng.choice([0, 1, 2])) if vertical != "finance" or rng.random() < 0.3 else [])

    start_current = max(grad_year, rng.randint(grad_year, min(grad_year + 8, 2026)))
    current_role = {"company": company["name"], "title": title, "function": function, "industry": INDUSTRY[vertical],
                    "seniority": seniority_of(title), "startYear": start_current, "endYear": None,
                    "clients": clients, "programs": programs}
    roles = (prior_roles or []) + [current_role]
    if prior_roles is None and start_current > grad_year and rng.random() < 0.6:
        pv = rng.choice(VERTICALS)
        pcomp = rng.choice(COMPANIES[pv])[0]
        ptitle, pfunc = rng.choice([t for t in TITLES[pv] if seniority_of(t[0]) in ("analyst", "associate", "intern")] or TITLES[pv])
        roles.insert(0, {"company": pcomp, "title": ptitle, "function": pfunc, "industry": INDUSTRY[pv],
                         "seniority": seniority_of(ptitle), "startYear": grad_year, "endYear": start_current,
                         "clients": [], "programs": pick(rng, PROGRAMS.get(pcomp, []), 1) if rng.random() < 0.5 else []})

    ctx = {"vertical": vertical, "event": rng.choice(EVENTS)[0], "interest": interests[0], "title": title,
           "company": company["name"]}
    posts = posts if posts is not None else ([make_post(rng, int(pid[1:]), ctx)] if rng.random() < 0.3 else [])
    events = events if events is not None else ([make_event(rng)] if rng.random() < 0.35 else [])

    return {
        "id": pid, "name": name,
        "headline": f"{title} at {company['name']} | {school} '{str(grad_year)[2:]}",
        "company": company["name"], "company_id": company["id"], "title": title,
        "function": function, "industry": INDUSTRY[vertical], "seniority": seniority_of(title),
        "school": school, "major": major, "grad_year": grad_year,
        "hometown": hometown, "high_school": high_school,
        "clubs": clubs, "communities": communities, "interests": interests, "projects": projects,
        "education": [{"school": school, "degree": "BS", "field": major, "startYear": grad_year - 4, "endYear": grad_year,
                       "activities": clubs}],
        "roles": roles, "posts": posts, "events": events,
        "vertical": vertical, "location": rng.choice(LOCATIONS),
        "openness_to_chat": openness if openness is not None else round(rng.betavariate(3, 2), 2),
        "linkedin_url": f"https://www.example.com/in/{slug(name)}-{pid}",
    }


def gen_people(rng: random.Random, fake: Faker, companies: list[dict], n: int) -> list[dict]:
    rows = []
    schools = list(SCHOOLS)
    for i in range(1, n + 1):
        rows.append(person_row(rng, fake, f"p{i:04d}", rng.choice(companies), school=rng.choice(schools),
                               grad_year=rng.randint(2012, 2025)))
    return rows


def plant_sam_rivera_cast(rng: random.Random, fake: Faker, companies: list[dict]) -> list[dict]:
    """
    People engineered around the demo student in src/lib/session/demo-store.ts (Sam Rivera, Virginia Tech,
    Richmond VA, Deep Run HS, Army ROTC, Beta Alpha Psi, Consulting Club, targets Deloitte + Databricks,
    cybersecurity -> consulting). One or two per ladder rung so his dashboard has a hook on every tier.
    """
    by_name = {c["name"]: c for c in companies}
    deloitte, databricks, acme = by_name["Deloitte"], by_name["Databricks"], by_name["Acme Analytics"]
    vt = "Virginia Tech"
    out = []
    P = lambda pid, comp, **kw: out.append(person_row(rng, fake, pid, comp, **kw))  # noqa: E731

    # Tier 2: same school + same org.
    P("p9001", deloitte, school=vt, grad_year=2018, title="Manager", name="Dana Whitfield", hometown="Roanoke, VA",
      clubs=["Beta Alpha Psi", "Club Rowing"], programs=["Deloitte Analyst Program"], clients=["CMS"], openness=0.92)
    P("p9002", databricks, school=vt, grad_year=2021, title="Solutions Architect", name="Jordan Okafor", hometown="Fairfax, VA",
      clubs=["Consulting Club", "VT Hackers"], programs=["Databricks University"], interests=["responsible AI", "gravel cycling", "chess"],
      posts=[{"id": "post-9002", "kind": "article", "title": "Responsible AI in public-sector delivery: a field checklist",
              "excerpt": None, "topics": ["responsible AI", "public sector"], "url": "https://www.example.com/posts/9002",
              "publishedAt": iso_days_ago(12)}], openness=0.9)
    # Tier 3: same school + made the cybersecurity -> consulting jump.
    P("p9003", deloitte, school=vt, grad_year=2016, title="Senior Manager, Technology Consulting", name="Priya Raman",
      hometown="Arlington, VA", clubs=["Marching Band"],
      prior_roles=[{"company": "MITRE", "title": "Cybersecurity Analyst", "function": "cybersecurity", "industry": "defense",
                    "seniority": "analyst", "startYear": 2016, "endYear": 2019, "clients": [], "programs": []}],
      programs=["Deloitte Cyber Academy"], clients=["Department of Veterans Affairs"], openness=0.8)
    # Tier 4: shared employer (Acme Analytics) and shared client (CMS).
    P("p9004", deloitte, school="University of Virginia", grad_year=2019, title="Consultant", name="Marcus Bell",
      hometown="Charlotte, NC",
      prior_roles=[{"company": "Acme Analytics", "title": "Data Analyst", "function": "analytics", "industry": None,
                    "seniority": "analyst", "startYear": 2019, "endYear": 2023, "clients": ["CMS"], "programs": ["Acme Analytics Summer Program"]}],
      clients=["CMS", "IRS"], openness=0.85)
    # Tier 5: same high school; same hometown; same community.
    P("p9005", databricks, school="Georgia Tech", grad_year=2020, title="Software Engineer", name="Lena Park",
      hometown="Richmond, VA", high_school="Deep Run High School", communities=["Young Life"],
      interests=["Formula 1", "sourdough baking"], openness=0.88)
    P("p9006", deloitte, school="UT Austin", grad_year=2017, title="Cyber Risk Consultant", name="Tomás Herrera",
      hometown="Austin, TX", communities=["Army ROTC", "Eagle Scouts"], interests=["public-sector technology", "fly fishing"],
      programs=["Deloitte Cyber Academy"], openness=0.75)
    P("p9007", by_name["Juniper Public Sector"], school="NYU", grad_year=2015, title="Manager", name="Aisha Rahman",
      hometown="Richmond, VA", high_school="Godwin High School", communities=["Habitat for Humanity"], openness=0.7)
    # Tier 7: a specific shared interest (responsible AI for public-sector clients).
    P("p9008", deloitte, school="University of Michigan", grad_year=2014, title="Director", name="Owen Castellano",
      hometown="Detroit, MI", interests=["responsible AI", "public-sector technology", "backcountry skiing"],
      projects=["built a responsible-AI checklist for public-sector clients"], clients=["USDA"], openness=0.6)
    # Tier 8: a fresh, engageable post (3 days old).
    P("p9009", databricks, school="UIUC", grad_year=2019, title="ML Engineer", name="Grace Lindqvist", hometown="Naperville, IL",
      posts=[{"id": "post-9009", "kind": "talk", "title": "Lightning talk at Data + AI Summit on measuring drift in public-sector ML",
              "excerpt": None, "topics": ["responsible AI", "MLOps"], "url": "https://www.example.com/posts/9009",
              "publishedAt": iso_days_ago(3)}], openness=0.82)
    # Tier 9: same event yesterday (Deloitte Tech Case Competition), and a career-fair from the same week.
    P("p9010", deloitte, school="Purdue", grad_year=2022, title="Analyst", name="Chris Nakamura", hometown="Indianapolis, IN",
      events=[make_event(rng, 1, ("Deloitte Tech Case Competition", "case_competition", "Deloitte"))],
      programs=["Deloitte Analyst Program"], openness=0.95)
    P("p9011", databricks, school="Carnegie Mellon University", grad_year=2023, title="University Recruiter", name="Sofia Almeida",
      hometown="Pittsburgh, PA", events=[make_event(rng, 4, ("Virginia Tech Fall Career Fair", "career_fair", "Virginia Tech"))],
      openness=0.97)
    # Tier 10: exactly one step ahead (associate -> Sam targets analyst).
    P("p9012", deloitte, school="University of Pennsylvania", grad_year=2023, title="Consultant", name="Ethan Moreau",
      hometown="Philadelphia, PA", programs=["Deloitte Analyst Program"], openness=0.78)
    # Tier 11-13 filler at target companies so the list has an honest bottom.
    P("p9013", databricks, school="UC Berkeley", grad_year=2011, title="Engineering Manager", name="Rachel Stein",
      hometown="San Jose, CA", communities=[], interests=["houseplants"], projects=[], posts=[], events=[], openness=0.4)
    P("p9014", deloitte, school="NYU", grad_year=2009, title="Partner", name="Victor Adeyemi", hometown="Brooklyn, NY",
      communities=[], interests=["Premier League"], projects=[], posts=[], events=[], openness=0.3)
    return out


def gen_positions(rng: random.Random, companies: list[dict], n: int) -> list[dict]:
    quotas = {"swe": n // 2, "consulting": n // 4, "finance": n - n // 2 - n // 4}
    rows, pid = [], 1
    for vertical, quota in quotas.items():
        comps = [c for c in companies if c["vertical"] == vertical]
        for _ in range(quota):
            company = rng.choice(comps)
            title, ptype = rng.choice(POSITION_TEMPLATES[vertical])
            offset = rng.randint(3, 150) if ptype == "internship" else rng.randint(90, 300) if ptype == "full_time" else rng.randint(3, 360)
            opens_on = TODAY + timedelta(days=offset)
            closes_on = opens_on + timedelta(days=rng.randint(21, 90))
            target = ([2027, 2028] if rng.random() < 0.7 else [2028, 2029]) if ptype == "internship" else [2027] if ptype == "full_time" else [2027, 2028, 2029]
            location = rng.choice(LOCATIONS)
            rows.append({
                "id": f"j{pid:03d}", "company_id": company["id"], "title": title, "type": ptype, "vertical": vertical,
                "location": location, "opens_on": opens_on.isoformat(), "closes_on": closes_on.isoformat(),
                "target_grad_years": target,
                "description": (f"{company['name']} is hiring a {title} ({ptype.replace('_', ' ')}) based in {location}. "
                                f"Join the {vertical} team on high-impact work with direct mentorship. "
                                f"We favor candidates who reach out to current team members before applying."),
                "posted_url": f"https://jobs.example.com/{company['id']}/{pid:03d}",
            })
            pid += 1
    rng.shuffle(rows)
    return rows


def gen_requirements(rng: random.Random, positions: list[dict]) -> list[dict]:
    rows = []
    for pos in positions:
        pool = REQUIREMENTS[pos["vertical"]]
        chosen = [c for c in pick(rng, pool, rng.randint(3, 5)) if c[1] != "degree"] + [c for c in pool if c[1] == "degree"][:1]
        for req, kind, p_required in chosen:
            rows.append({"position_id": pos["id"], "requirement": req, "kind": kind, "required": rng.random() < p_required})
    return rows


def gen_students(rng: random.Random, fake: Faker, n: int) -> list[dict]:
    rows = []
    schools = list(SCHOOLS)
    for i in range(1, n + 1):
        school = rng.choice(schools)
        primary = rng.choices(VERTICALS, weights=[0.5, 0.25, 0.25])[0]
        targets = [primary] + ([rng.choice([v for v in VERTICALS if v != primary])] if rng.random() < 0.3 else [])
        major = rng.choice(MAJORS[primary])
        grad_year = rng.choice([2027, 2027, 2028, 2028, 2029])
        skills = pick(rng, SKILLS[primary], rng.randint(3, 7))
        certs = pick(rng, CERTS[primary], rng.choice([0, 0, 0, 1, 1, 2]))
        interests = pick(rng, INTERESTS, rng.randint(2, 4))
        clubs = pick(rng, SCHOOLS[school], rng.choice([1, 2, 2, 3])) + ([rng.choice(CROSS_SCHOOL_ORGS)] if rng.random() < 0.3 else [])
        communities = pick(rng, COMMUNITIES, rng.choice([0, 1, 1, 2]))
        projects = pick(rng, PROJECTS, rng.choice([0, 1, 1]))
        hometown = rng.choice(list(HOMETOWNS))
        high_school = rng.choice(HOMETOWNS[hometown])
        target_companies = [c[0] for c in pick(rng, COMPANIES[primary], 2)]
        events = [make_event(rng)] if rng.random() < 0.5 else []
        name = fake.name()
        resume = (
            f"{name}\n{school} - B.S. {major}, expected {grad_year}\n\n"
            f"SKILLS: {', '.join(skills)}\nCERTIFICATIONS: {', '.join(certs) if certs else 'None yet'}\n"
            f"ACTIVITIES: {', '.join(clubs + communities)}\n\n"
            f"EXPERIENCE\n- {rng.choice(['Teaching assistant', 'Club project lead', 'Part-time developer', 'Research assistant', 'Campus ambassador'])}, "
            f"{school} ({grad_year - 2}-present): built and shipped a {rng.choice(['dashboard', 'mobile app', 'trading simulator', 'case competition deck', 'data pipeline'])} "
            f"used by {rng.randint(20, 400)} students.\n"
            + (f"- Project: {projects[0]}.\n" if projects else "")
            + f"- Interested in {', '.join(interests)}."
        )
        questionnaire = {
            "what_kind_of_work": rng.choice(["Building things people actually use", "Solving messy business problems", "Markets and numbers",
                                             "Research with real-world impact", "Something where I can learn fast"]),
            "target_verticals": targets, "target_companies": target_companies,
            "preferred_locations": pick(rng, LOCATIONS, 2),
            "hometown": hometown, "high_school": high_school, "communities": communities,
            "dream_company_traits": rng.choice(["Small team, lots of ownership", "Big brand on the resume", "Mission-driven", "Fast promotion track"]),
            "internship_or_full_time": "internship" if grad_year >= 2028 else rng.choice(["internship", "full_time"]),
            "comfortable_reaching_out_cold": rng.choice(["yes", "a little", "not really"]),
            "input_mode": rng.choice(["dictation", "typed"]),
        }
        rows.append({
            "id": f"s{i:03d}", "name": name, "email": f"{name.split()[0].lower()}.{i:03d}@student.example.edu",
            "school": school, "major": major, "grad_year": grad_year, "target_verticals": targets, "target_companies": target_companies,
            "skills": skills, "certifications": certs, "interests": interests, "projects": projects,
            "hometown": hometown, "high_school": high_school, "clubs": clubs, "communities": communities, "events": events,
            "resume_text": resume, "questionnaire_answers": json.dumps(questionnaire),
            "created_at": datetime(2026, 8, rng.randint(15, 31), rng.randint(8, 22), rng.randint(0, 59), tzinfo=timezone.utc).isoformat(),
        })
    return rows


def plant_demo_story(rng: random.Random, students: list[dict], people: list[dict], positions: list[dict],
                     requirements: list[dict], companies: list[dict]) -> dict:
    """Heroes (s001-s005) get a same-school+club+hometown path to someone at a hiring company; gap students
    (s006-s010) match a position on every skill but lack one required certification."""
    comp_by_id = {c["id"]: c for c in companies}
    story = {"heroes": [], "gaps": [], "sam_rivera_cast": [p["id"] for p in people if p["id"].startswith("p9")]}
    for s in students[:5]:
        vertical = s["target_verticals"][0]
        cands = sorted([p for p in positions if p["vertical"] == vertical and s["grad_year"] in p["target_grad_years"]], key=lambda p: p["opens_on"])
        pos = cands[0]
        person = rng.choice([p for p in people if p["company_id"] == pos["company_id"] and not p["id"].startswith("p9")] or [rng.choice(people)])
        person.update(company_id=pos["company_id"], company=comp_by_id[pos["company_id"]]["name"], vertical=vertical,
                      school=s["school"], major=s["major"], hometown=s["hometown"], high_school=s["high_school"])
        shared_club = s["clubs"][0]
        person["clubs"] = [shared_club] + [c for c in person["clubs"] if c != shared_club][:1]
        person["education"][0].update(school=s["school"], field=s["major"], activities=person["clubs"])
        person["roles"][-1].update(company=person["company"])
        if s["communities"]:
            person["communities"] = [s["communities"][0]] + person["communities"][:1]
        person["interests"] = [s["interests"][0]] + person["interests"][:2]
        person["openness_to_chat"] = round(rng.uniform(0.8, 0.98), 2)
        person["headline"] = f"{person['title']} at {person['company']} | {person['school']} '{str(person['grad_year'])[2:]}"
        story["heroes"].append({"student": s["id"], "person": person["id"], "company": person["company"],
                                "shared_club": shared_club, "shared_high_school": s["high_school"], "position": pos["id"]})
    for s in students[5:10]:
        vertical = s["target_verticals"][0]
        pos = rng.choice([p for p in positions if p["vertical"] == vertical and s["grad_year"] in p["target_grad_years"]])
        reqs = [r for r in requirements if r["position_id"] == pos["id"]]
        cert_reqs = [r for r in reqs if r["kind"] == "certification"]
        if not cert_reqs:
            requirements.append({"position_id": pos["id"], "requirement": rng.choice(CERTS[vertical]), "kind": "certification", "required": True})
            cert_reqs = [requirements[-1]]
        gap = cert_reqs[0]
        gap["required"] = True
        s["certifications"] = [c for c in s["certifications"] if c != gap["requirement"]]
        for r in reqs:
            if r["kind"] == "skill" and r["requirement"] not in s["skills"]:
                s["skills"].append(r["requirement"])
        story["gaps"].append({"student": s["id"], "position": pos["id"], "missing_certification": gap["requirement"]})
    return story


PATH_WEIGHTS = {  # base strength per hook type; the view combines them with noisy-OR
    "same_club": 0.85, "same_high_school": 0.9, "same_community": 0.8, "alumni_at_target_company": 0.7,
    "shared_employer": 0.7, "same_event": 0.6, "shared_interest": 0.55, "same_school": 0.5, "same_hometown": 0.35, "same_major": 0.25,
}


def gen_connection_paths(students: list[dict], people: list[dict], positions: list[dict]) -> list[dict]:
    """One row per (student, person, hook). Kept granular so the UI can say exactly *why*."""
    companies_by_vertical: dict[str, set[str]] = {}
    for p in positions:
        companies_by_vertical.setdefault(p["vertical"], set()).add(p["company_id"])
    rows = []
    add = lambda s, p, t, d=None: rows.append({"student_id": s["id"], "person_id": p["id"], "path_type": t, "strength": PATH_WEIGHTS[t], "detail": d})  # noqa: E731
    for s in students:
        target_companies = set().union(*(companies_by_vertical.get(v, set()) for v in s["target_verticals"]))
        s_clubs, s_comm, s_int = set(s["clubs"]), set(s["communities"]), set(s["interests"])
        s_events = {e["name"] for e in s["events"]}
        for p in people:
            if p["school"] == s["school"]:
                add(s, p, "same_school")
                for club in sorted(s_clubs & set(p["clubs"])):
                    add(s, p, "same_club", club)
                if p["company_id"] in target_companies:
                    add(s, p, "alumni_at_target_company", p["company"])
                if p["major"] == s["major"]:
                    add(s, p, "same_major", s["major"])
            else:
                for club in sorted(s_clubs & set(p["clubs"]) & set(CROSS_SCHOOL_ORGS)):
                    add(s, p, "same_club", club)
            if p["high_school"] == s["high_school"]:
                add(s, p, "same_high_school", s["high_school"])
            elif p["hometown"] == s["hometown"]:
                add(s, p, "same_hometown", s["hometown"])
            for c in sorted(s_comm & set(p["communities"])):
                add(s, p, "same_community", c)
            for i in sorted(s_int & set(p["interests"])):
                add(s, p, "shared_interest", i)
            for e in sorted(s_events & {e["name"] for e in p["events"]}):
                add(s, p, "same_event", e)
    return rows


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--students", type=int, default=60)
    ap.add_argument("--people", type=int, default=300)
    ap.add_argument("--positions", type=int, default=120)
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    fake = Faker("en_US")
    Faker.seed(args.seed)

    companies = gen_companies(rng)
    people = gen_people(rng, fake, companies, args.people) + plant_sam_rivera_cast(rng, fake, companies)
    positions = gen_positions(rng, companies, args.positions)
    requirements = gen_requirements(rng, positions)
    students = gen_students(rng, fake, args.students)
    story = plant_demo_story(rng, students, people, positions, requirements, companies)
    paths = gen_connection_paths(students, people, positions)

    args.out.mkdir(parents=True, exist_ok=True)
    for name, rows in [("companies", companies), ("people", people), ("positions", positions),
                       ("position_requirements", requirements), ("students", students), ("connection_paths", paths)]:
        write_jsonl(args.out / f"{name}.jsonl", rows)
        print(f"{name:24s} {len(rows):6d} rows")
    (args.out / "demo_story.json").write_text(json.dumps(story, indent=2) + "\n")
    print(f"seed={args.seed}; demo story: {len(story['heroes'])} heroes, {len(story['gaps'])} gap students, "
          f"{len(story['sam_rivera_cast'])} people planted around Sam Rivera")


if __name__ == "__main__":
    main()
