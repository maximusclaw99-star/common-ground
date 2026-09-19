#!/usr/bin/env python3
"""
Deterministic mock-data generator for Common Ground — the Virginia Tech edition.

Every person is a synthetic Hokie: a Virginia Tech graduate now at a top accounting, consulting,
software/tech or finance employer, carrying the small nameable things a coffee chat runs on. Clubs
come from the real Gobbler Connect list (data/vt_clubs_raw.txt): every student organization gets a
couple of alumni, so a VT resume that names any of them finds a hook. Employer names are real
firms; the people, emails (@<firm>.example.com) and photos are not.

Outputs newline-delimited JSON (one file per table) into data/seed/. Re-running with the same SEED
produces byte-identical output.

    python databricks/data/generate_mock.py
    python databricks/data/generate_mock.py --per-club 3
"""
from __future__ import annotations

import argparse
import json
import random
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from faker import Faker

SEED = 20260919
TODAY = date(2026, 9, 19)
NOW = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)  # matches src/lib/affinity/__fixtures__/cast.ts NOW

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE / "seed"
CLUBS_FILE = HERE / "vt_clubs_raw.txt"
PORTRAITS_DIR = HERE.parents[1] / "public" / "people"

SCHOOL = "Virginia Tech"
SCHOOL_LONG = "Virginia Polytechnic Institute and State University"

# --------------------------------------------------------------------------- #
# Reference pools
# --------------------------------------------------------------------------- #

VERTICALS = ["swe", "consulting", "finance", "accounting"]
VERTICAL_WEIGHTS = [0.35, 0.25, 0.2, 0.2]

# Real employers, synthetic people. (name, size)
COMPANIES = {
    "accounting": [
        ("Deloitte", "large"), ("PwC", "large"), ("EY", "large"), ("KPMG", "large"), ("Grant Thornton", "mid"),
        ("RSM US", "mid"), ("BDO USA", "mid"), ("Baker Tilly", "mid"), ("Forvis Mazars", "mid"), ("CohnReznick", "small"),
    ],
    "consulting": [
        ("McKinsey & Company", "large"), ("Boston Consulting Group", "large"), ("Bain & Company", "large"),
        ("Accenture", "large"), ("Booz Allen Hamilton", "large"), ("Guidehouse", "mid"), ("Huron Consulting", "mid"),
        ("Oliver Wyman", "mid"), ("Capgemini", "large"), ("RTI International", "mid"), ("ICF", "mid"), ("CGI Federal", "mid"),
    ],
    "swe": [
        ("Google", "large"), ("Microsoft", "large"), ("Amazon", "large"), ("Apple", "large"), ("Meta", "large"),
        ("Databricks", "large"), ("NVIDIA", "large"), ("Salesforce", "large"), ("Oracle", "large"), ("Palantir", "mid"),
        ("Stripe", "mid"), ("Datadog", "mid"), ("Cloudflare", "mid"), ("MongoDB", "mid"), ("Anthropic", "mid"),
        ("Figma", "mid"), ("Vercel", "small"), ("Scale AI", "mid"), ("Snowflake", "large"), ("Leidos", "large"),
        ("Lockheed Martin", "large"), ("Northrop Grumman", "large"), ("Capital One", "large"), ("Discord", "mid"),
        ("Reddit", "mid"), ("Twilio", "mid"), ("Elastic", "mid"), ("Samsara", "mid"), ("Instacart", "mid"),
    ],
    "finance": [
        ("Goldman Sachs", "large"), ("JPMorgan Chase", "large"), ("Morgan Stanley", "large"), ("Bank of America", "large"),
        ("Citi", "large"), ("Wells Fargo", "large"), ("BlackRock", "large"), ("Vanguard", "large"), ("Fidelity Investments", "large"),
        ("Truist", "large"), ("Robinhood", "mid"), ("Affirm", "mid"), ("Chime", "mid"), ("Evercore", "mid"),
        ("Lazard", "mid"), ("Carlyle", "mid"), ("Capital One", "large"),
    ],
}

TITLES = {
    "accounting": [("Audit Associate", "audit"), ("Audit Senior", "audit"), ("Audit Manager", "audit"), ("Tax Associate", "tax"),
                   ("Tax Senior", "tax"), ("Tax Manager", "tax"), ("Advisory Associate", "advisory"), ("Senior Manager", "audit"),
                   ("Partner", "audit"), ("Forensic Accountant", "forensics"), ("Campus Recruiter", "recruiting")],
    "consulting": [("Analyst", "consulting"), ("Consultant", "consulting"), ("Senior Consultant", "consulting"), ("Manager", "consulting"),
                   ("Senior Manager, Technology Consulting", "consulting"), ("Director", "consulting"), ("Partner", "consulting"),
                   ("Technology Analyst", "consulting"), ("Cyber Risk Consultant", "cybersecurity"), ("Strategy Associate", "strategy"),
                   ("Campus Recruiting Lead", "recruiting")],
    "swe": [("Software Engineer", "engineering"), ("Senior Software Engineer", "engineering"), ("Engineering Manager", "engineering"),
            ("Staff Engineer", "engineering"), ("Site Reliability Engineer", "engineering"), ("Data Engineer", "data"),
            ("ML Engineer", "machine learning"), ("Product Manager", "product"), ("Security Engineer", "cybersecurity"),
            ("Solutions Architect", "solutions"), ("Systems Engineer", "engineering"), ("University Recruiter", "recruiting")],
    "finance": [("Analyst", "investment banking"), ("Associate", "investment banking"), ("Vice President", "investment banking"),
                ("Director", "investment banking"), ("Managing Director", "investment banking"), ("Quantitative Researcher", "quant"),
                ("Trader", "trading"), ("Portfolio Analyst", "asset management"), ("Credit Analyst", "credit"), ("Campus Recruiter", "recruiting")],
}
INDUSTRY = {"swe": "software", "consulting": "professional services", "finance": "financial services", "accounting": "professional services"}

MAJORS = {
    "accounting": ["Accounting and Information Systems", "Accounting and Information Systems", "Finance", "Business Information Technology"],
    "consulting": ["Business Information Technology", "Management", "Marketing", "Industrial and Systems Engineering", "Economics", "Public Policy"],
    "finance": ["Finance", "Economics", "Accounting and Information Systems", "Mathematics", "Statistics"],
    "swe": ["Computer Science", "Computer Engineering", "Electrical Engineering", "Computational Modeling and Data Analytics",
            "Aerospace Engineering", "Mechanical Engineering", "Industrial and Systems Engineering", "Cybersecurity Management and Analytics"],
}

# Hometown -> high schools. Virginia-heavy because the pool is Hokies.
HOMETOWNS = {
    "Richmond, VA": ["Deep Run High School", "Maggie L. Walker Governor's School", "Godwin High School", "Freeman High School"],
    "Arlington, VA": ["Washington-Liberty High School", "Yorktown High School", "Wakefield High School"],
    "Fairfax, VA": ["Thomas Jefferson High School for Science and Technology", "Fairfax High School", "Robinson Secondary"],
    "Alexandria, VA": ["T.C. Williams High School", "West Potomac High School"],
    "Ashburn, VA": ["Stone Bridge High School", "Broad Run High School", "Briar Woods High School"],
    "Leesburg, VA": ["Loudoun County High School", "Heritage High School"],
    "Chantilly, VA": ["Chantilly High School", "Westfield High School"],
    "Vienna, VA": ["James Madison High School", "Oakton High School"],
    "McLean, VA": ["Langley High School", "McLean High School"],
    "Virginia Beach, VA": ["Cox High School", "First Colonial High School", "Ocean Lakes High School"],
    "Norfolk, VA": ["Maury High School", "Granby High School"],
    "Chesapeake, VA": ["Hickory High School", "Grassfield High School"],
    "Charlottesville, VA": ["Albemarle High School", "Western Albemarle High School"],
    "Roanoke, VA": ["Patrick Henry High School", "Cave Spring High School", "Hidden Valley High School"],
    "Blacksburg, VA": ["Blacksburg High School"],
    "Lynchburg, VA": ["E.C. Glass High School", "Jefferson Forest High School"],
    "Harrisonburg, VA": ["Harrisonburg High School"],
    "Fredericksburg, VA": ["Stafford High School", "Riverbend High School", "Colonial Forge High School"],
    "Williamsburg, VA": ["Jamestown High School", "Lafayette High School"],
    "Winchester, VA": ["John Handley High School"],
    "Bethesda, MD": ["Walt Whitman High School", "Bethesda-Chevy Chase High School"],
    "Rockville, MD": ["Richard Montgomery High School", "Thomas S. Wootton High School"],
    "Charlotte, NC": ["Myers Park High School", "Ardrey Kell High School"],
    "Raleigh, NC": ["Enloe High School", "Broughton High School"],
    "Atlanta, GA": ["Walton High School", "Lambert High School"],
    "Philadelphia, PA": ["Central High School", "Masterman"],
    "Brooklyn, NY": ["Brooklyn Tech", "Midwood High School"],
    "Austin, TX": ["Westlake High School", "LASA High School"],
    "Chicago, IL": ["Whitney Young Magnet High School", "New Trier High School"],
    "Nashville, TN": ["Hume-Fogg", "Montgomery Bell Academy"],
}

COMMUNITIES = ["Army ROTC", "Air Force ROTC", "Navy ROTC", "Virginia Tech Corps of Cadets", "Eagle Scouts", "Girl Scouts Gold Award",
               "FIRST Robotics alumni", "St. Mark's youth group", "Young Life", "Habitat for Humanity", "volunteer EMT",
               "Big Brothers Big Sisters", "community theater", "adult rec soccer league", "church choir", "Model UN alumni",
               "high school debate", "Boys & Girls Club volunteer", "Special Olympics coach", "4-H", "Virginia Governor's School alumni",
               "Blacksburg Volunteer Fire Department"]

INTERESTS = ["Formula 1", "sourdough baking", "marathon training", "chess", "Go (the board game)", "vintage synthesizers",
             "rock climbing", "fantasy football", "birdwatching", "3D printing", "Dungeons & Dragons", "K-pop", "gravel cycling",
             "home espresso", "backcountry skiing", "salsa dancing", "woodworking", "trail running", "poker", "film photography",
             "fly fishing", "Premier League", "board game design", "urban sketching", "Hokie football", "houseplants",
             "mechanical keyboards", "responsible AI", "public-sector technology", "open-source data tools", "personal finance",
             "pickleball", "Appalachian Trail section hiking", "bluegrass guitar", "New River kayaking", "craft beer", "ACC basketball"]

PROJECTS = ["built a fantasy-football lineup optimizer", "restored a '92 Miata", "runs a newsletter on fintech regulation",
            "maintains an open-source CLI for CSV cleanup", "organizes a monthly board-game night", "built a home weather station",
            "wrote a Chrome extension for split bills", "runs a small Etsy woodworking shop", "coaches a youth soccer team",
            "built a responsible-AI checklist for public-sector clients", "made a podcast about first-gen college students",
            "keeps a sourdough starter named Gary", "built a Databricks dashboard for campus energy use",
            "wrote a Security+ study guide for classmates", "maps every hiking trail within an hour of Blacksburg",
            "built a CPA exam flashcard app", "runs the alumni pickup soccer group in Arlington"]

PROGRAMS = {
    "Deloitte": ["Deloitte Analyst Program", "Deloitte Tech Case Competition", "Deloitte Cyber Academy", "Deloitte Audit Innovation Campus Challenge"],
    "PwC": ["PwC Start Internship", "PwC Challenge Case Competition"], "EY": ["EY Launch Internship", "EY Discover Program"],
    "KPMG": ["KPMG Global Internship Program", "KPMG Ideation Challenge"],
    "Databricks": ["Databricks University", "Databricks Solutions Architect Bootcamp"],
    "Accenture": ["Accenture Student Leadership Conference"], "Booz Allen Hamilton": ["Booz Allen Summer Games"],
    "Capital One": ["Capital One Technology Development Program", "Capital One Analyst Development Program"],
    "Goldman Sachs": ["Goldman Sachs Possibilities Summit"], "JPMorgan Chase": ["JPMorgan Code for Good", "Winning Women Program"],
    "Amazon": ["Amazon Propel Program"], "Microsoft": ["Microsoft Explore Program"], "Google": ["Google STEP Internship"],
    "McKinsey & Company": ["McKinsey Forward", "McKinsey Insight Program"], "Boston Consulting Group": ["BCG Growing Future Leaders"],
    "Bain & Company": ["Bain Building Entrepreneurial Leaders"],
}
CLIENTS = {
    "consulting": ["CMS", "Department of Veterans Affairs", "Virginia DMV", "USDA", "a Fortune 100 retailer", "Virginia Department of Health",
                   "IRS", "a top-5 US bank", "Department of Defense", "Fairfax County Public Schools"],
    "accounting": ["a Fortune 500 manufacturer", "a regional hospital system", "a mid-cap SaaS company", "a federal agency", "a REIT"],
    "swe": ["a Fortune 100 retailer", "a top-5 US bank", "CMS", "Department of Defense"],
    "finance": ["a sovereign wealth fund", "a mid-cap healthcare roll-up", "a Virginia utility"],
}

SENIORITY_RULES = [
    (("chief", "cto", "ceo", "cfo", "coo", "president"), "executive"), (("partner", "managing director"), "partner"),
    (("vice president", "vp", "head of"), "vp"), (("director",), "director"),
    (("senior manager",), "senior_manager"), (("manager",), "manager"),
    (("senior associate", "senior consultant", "senior analyst", "senior software engineer", "senior engineer", "staff engineer",
      "audit senior", "tax senior"), "senior_associate"),
    (("associate", "consultant"), "associate"),
    (("analyst", "engineer", "scientist", "developer", "architect", "researcher", "trader", "recruiter", "accountant"), "analyst"),
    (("intern",), "intern"),
]


def seniority_of(title: str) -> str | None:
    t = title.lower()
    for keys, level in SENIORITY_RULES:
        if any(k in t for k in keys):
            return level
    return None


LOCATIONS = ["Arlington, VA", "Washington, DC", "McLean, VA", "Reston, VA", "Richmond, VA", "New York, NY", "Charlotte, NC",
             "Atlanta, GA", "Chicago, IL", "Seattle, WA", "San Francisco, CA", "Austin, TX", "Boston, MA", "Remote"]

POST_TEMPLATES = [
    ("article", "What I wish I knew before my first {vertical} internship", ["career advice", "internships"]),
    ("post", "Notes from {event}: three things that surprised me", ["recruiting", "events"]),
    ("talk", "Lightning talk at {event} on {interest}", ["{interest}"]),
    ("article", "Responsible AI in public-sector delivery: a field checklist", ["responsible AI", "public sector"]),
    ("post", "We're hiring {title}s at {company} — happy to chat with Hokies", ["hiring", "{company}"]),
    ("podcast", "Guest on 'First Gen, First Job' about breaking into {vertical}", ["first-gen", "{vertical}"]),
    ("paper", "Measuring drift in production ML at {company}", ["machine learning", "MLOps"]),
    ("post", "Back in Blacksburg for the career fair this week — come say hi at the {company} table", ["recruiting", "Virginia Tech"]),
]

EVENTS = [
    ("Deloitte Tech Case Competition", "case_competition", "Deloitte"),
    ("Virginia Tech Fall Career Fair", "career_fair", "Virginia Tech"),
    ("Virginia Tech Engineering Expo", "career_fair", "Virginia Tech"),
    ("Pamplin Business Horizons Career Fair", "career_fair", "Virginia Tech"),
    ("Data + AI Summit", "conference", "Databricks"),
    ("Grace Hopper Celebration", "conference", "AnitaB.org"),
    ("Deloitte Cyber Careers Webinar", "webinar", "Deloitte"),
    ("Databricks Campus Office Hours", "recruiting_event", "Databricks"),
    ("KPMG Ideation Challenge", "case_competition", "KPMG"),
    ("Capital One Hokie Alumni Night", "recruiting_event", "Capital One"),
    ("VTHacks", "conference", "Virginia Tech"),
]

POSITION_TEMPLATES = {
    "swe": [("Software Engineering Intern", "internship"), ("Backend Engineer Intern", "internship"), ("ML Engineering Intern", "internship"),
            ("Security Engineering Intern", "internship"), ("Data Engineering Intern", "internship"), ("Solutions Architect Intern", "internship"),
            ("New Grad Software Engineer", "full_time"), ("New Grad Site Reliability Engineer", "full_time"),
            ("Undergraduate Research Assistant - Systems", "research"), ("Applied ML Research Intern", "research")],
    "consulting": [("Summer Business Analyst", "internship"), ("Technology Consulting Intern", "internship"), ("Cyber Risk Intern", "internship"),
                   ("Public Sector Analyst Intern", "internship"), ("Technology Analyst (New Grad)", "full_time"), ("Business Analyst (New Grad)", "full_time"),
                   ("Operations Research Intern", "research")],
    "finance": [("Investment Banking Summer Analyst", "internship"), ("Sales & Trading Summer Analyst", "internship"),
                ("Quantitative Research Intern", "internship"), ("Asset Management Summer Analyst", "internship"),
                ("Private Equity Analyst Intern", "internship"), ("Investment Banking Analyst (New Grad)", "full_time"),
                ("Quant Research Assistant", "research")],
    "accounting": [("Audit Intern", "internship"), ("Tax Intern", "internship"), ("Advisory Intern", "internship"),
                   ("Forensic Accounting Intern", "internship"), ("Audit Associate (New Grad)", "full_time"), ("Tax Associate (New Grad)", "full_time"),
                   ("Accounting Research Assistant", "research")],
}

SKILLS = {
    "swe": ["Python", "Java", "C++", "Go", "TypeScript", "React", "SQL", "AWS", "Docker", "Kubernetes", "Linux", "Git", "REST APIs",
            "Distributed Systems", "Machine Learning", "PyTorch", "Spark", "Terraform", "Rust"],
    "consulting": ["Excel modeling", "PowerPoint", "SQL", "Case interviews", "Stakeholder management", "Market sizing", "Process mapping",
                   "Tableau", "Python", "Financial modeling", "Public speaking", "Project management"],
    "finance": ["Excel modeling", "Financial modeling", "DCF valuation", "Bloomberg Terminal", "SQL", "Python", "Accounting", "Statistics",
                "VBA", "Options pricing", "R", "Pitch decks"],
    "accounting": ["Excel modeling", "Accounting", "Audit", "Tax", "GAAP", "Financial statements", "QuickBooks", "SAP", "Alteryx",
                   "Tableau", "SQL", "Data analytics"],
}
CERTS = {
    "swe": ["AWS Solutions Architect Associate", "Security+", "CKA (Kubernetes)", "Google Cloud Associate Engineer", "Terraform Associate",
            "Databricks Data Engineer Associate"],
    "consulting": ["PMP", "Lean Six Sigma Green Belt", "Tableau Desktop Specialist", "Databricks Data Analyst Associate", "Security+"],
    "finance": ["CFA Level I", "Bloomberg Market Concepts", "FMVA", "SIE", "Databricks Data Analyst Associate"],
    "accounting": ["CPA (in progress)", "CPA", "CMA", "CFE", "Microsoft Excel Expert", "Alteryx Designer Core"],
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
                ("Bloomberg Market Concepts", "certification", 0.6), ("FMVA", "certification", 0.4), ("SIE", "certification", 0.3),
                ("Bachelor's in finance, economics, or math", "degree", 0.9), ("Prior finance internship", "experience", 0.5),
                ("Statistics", "skill", 0.5), ("Databricks Data Analyst Associate", "certification", 0.3)],
    "accounting": [("Excel modeling", "skill", 0.95), ("Accounting", "skill", 0.9), ("GAAP", "skill", 0.6), ("Financial statements", "skill", 0.7),
                   ("Data analytics", "skill", 0.4), ("Alteryx", "skill", 0.3), ("CPA (in progress)", "certification", 0.7),
                   ("CPA", "certification", 0.3), ("CFE", "certification", 0.2), ("Microsoft Excel Expert", "certification", 0.3),
                   ("150 credit hours toward CPA eligibility", "degree", 0.8), ("Bachelor's in accounting", "degree", 0.9),
                   ("Prior accounting internship or VITA volunteer work", "experience", 0.5)],
}

# --------------------------------------------------------------------------- #
# The club list
# --------------------------------------------------------------------------- #

# Gobbler Connect lists administrative units alongside student organizations. A person cannot have
# been "in" the Registrar's office as a club, so those are dropped before anyone gets assigned.
ADMIN_UNIT = re.compile(
    r"^(Office|Department|Division|Dean of|Dining|Cook Counseling|Schiffert|Services for|Student Conduct|Student Success|"
    r"Global Education|Cranwell|Cultural and Community|New Student|Career and Professional|Recreational Sports|Center for the Arts|"
    r"Hokie Wellness|College of|Contractual|Kevin T\. Crofton|Institute for Critical|Hume Center|Fraternity & Sorority Life|"
    r"Class Programs|Sexual Violence|Interfaith Initiative|First-Generation Student Success|Integrated Health|Discovery Lab|"
    r"Bradley Study|The Center|Virginia Tech Emergency|Virginia Tech Office|Virginia Tech Athletics|Design$|Women’s, Gender|"
    r"Graduate and Professional|Black Graduate|African Graduate|Global Engineering|International Archive|Panhellenic Council|"
    r"United Council|Black Organizations Council|Council of International|Sustainable Dining|VT Engage)",
    re.I,
)

CLUB_VERTICAL = [
    (re.compile(r"accounting|fraud|alpfa|naba|beta alpha psi", re.I), "accounting"),
    (re.compile(r"consult|management society|marketing|women in business|phi chi theta|alpha kappa psi|delta sigma pi|pi sigma epsilon|"
                r"phi gamma nu|debate|model united nations|mock trial|public relations|hospitality|property management|women's network", re.I), "consulting"),
    (re.compile(r"financ|invest|fintech|actuarial|real estate|commodity|forecasting|alternative investments|economics", re.I), "finance"),
    (re.compile(r"comput|code|cyber|software|robot|engineer|data|\bai\b|developer|hacker|game development|quantum|semiconductor|rocket|"
                r"\bsae\b|drone|ieee|aircraft|aeronautic|solar|autonomous|nanoscience|physics|math|astro|3d printed|machworks|iron bird|"
                r"design build fly|human powered|wind turbine|hybrid electric|autoboat|bolt|neurotech|women in computing|colorstack|girls who code", re.I), "swe"),
]


def load_clubs() -> list[dict]:
    seen: set[str] = set()
    clubs = []
    for raw in CLUBS_FILE.read_text(encoding="utf-8").splitlines():
        name = raw.strip().lstrip("▪").strip()
        if not name:
            continue
        key = re.sub(r"\s+", " ", name.lower())
        if key in seen or ADMIN_UNIT.search(name):
            continue
        seen.add(key)
        vertical = next((v for rx, v in CLUB_VERTICAL if rx.search(name)), None)
        clubs.append({"name": name, "vertical": vertical})
    return clubs


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def pick(rng: random.Random, seq, k: int) -> list:
    k = max(0, min(k, len(seq)))
    return rng.sample(list(seq), k)


def iso_days_ago(days: float) -> str:
    return (NOW - timedelta(days=days)).isoformat().replace("+00:00", "Z")


def slug(s: str) -> str:
    return re.sub(r"-+", "-", "".join(c if c.isalnum() else "-" for c in s.lower())).strip("-")


def ascii_name(s: str) -> str:
    table = str.maketrans("éáíóúñ", "eaioun")
    return re.sub(r"[^a-z]", "", s.lower().translate(table))


class Portraits:
    """Whatever public/people holds, per gender, handed out as evenly as possible."""

    def __init__(self, rng: random.Random):
        self.pool: dict[str, list[str]] = {}
        for gender in ("men", "women"):
            files = sorted(p.name for p in PORTRAITS_DIR.glob(f"ai-{gender}-*.jpg")) + \
                    sorted(p.name for p in PORTRAITS_DIR.glob(f"{gender}-*.jpg"))
            if not files:  # generator must work before portraits exist
                files = [f"{gender}-{i}.jpg" for i in range(100)]
            rng.shuffle(files)
            self.pool[gender] = files
        self.cursor = {"men": 0, "women": 0}

    def next(self, gender: str) -> str:
        files = self.pool[gender]
        name = files[self.cursor[gender] % len(files)]
        self.cursor[gender] += 1
        return f"/people/{name}"


def gendered_name(rng: random.Random, fake: Faker) -> tuple[str, str]:
    gender = rng.choice(["men", "women"])
    first = fake.first_name_male() if gender == "men" else fake.first_name_female()
    return f"{first} {fake.last_name()}", gender


def email_for(name: str, company: str) -> str:
    parts = name.split()
    first, last = ascii_name(parts[0]), ascii_name(parts[-1])
    return f"{first}.{last}@{slug(company)}.example.com"


def make_post(rng: random.Random, i: int, ctx: dict) -> dict:
    kind, title, topics = rng.choice(POST_TEMPLATES)
    fill = lambda s: s.format(**ctx)  # noqa: E731
    return {"id": f"post-{i:04d}", "kind": kind, "title": fill(title), "excerpt": None, "topics": [fill(t) for t in topics],
            "url": f"https://www.example.com/posts/{i:04d}", "publishedAt": iso_days_ago(rng.uniform(1, 40))}


def make_event(rng: random.Random, days_ago: float | None = None, which=None) -> dict:
    name, kind, org = which or rng.choice(EVENTS)
    return {"name": name, "kind": kind, "date": iso_days_ago(days_ago if days_ago is not None else rng.uniform(0.5, 9)), "org": org}


# --------------------------------------------------------------------------- #
# Generators
# --------------------------------------------------------------------------- #


def gen_companies(rng: random.Random) -> list[dict]:
    rows, cid, seen = [], 1, set()
    for vertical, names in COMPANIES.items():
        for name, size in names:
            if name in seen:  # Capital One sits in two verticals; one row
                continue
            seen.add(name)
            rows.append({"id": f"c{cid:03d}", "name": name, "vertical": vertical, "size": size,
                         "hq": rng.choice(LOCATIONS[:-1]), "careers_url": f"https://careers.example.com/{slug(name)}"})
            cid += 1
    return rows


def person_row(rng: random.Random, fake: Faker, portraits: Portraits, pid: str, company: dict, *, grad_year: int,
               vertical: str | None = None, title: str | None = None, hometown: str | None = None, high_school: str | None = None,
               clubs: list[str] | None = None, communities: list[str] | None = None, interests: list[str] | None = None,
               projects: list[str] | None = None, prior_roles: list[dict] | None = None, programs: list[str] | None = None,
               clients: list[str] | None = None, posts: list[dict] | None = None, events: list[dict] | None = None,
               major: str | None = None, name: str | None = None, gender: str | None = None, openness: float | None = None,
               school: str = SCHOOL) -> dict:
    vertical = vertical or company["vertical"]
    title, function = (title, next((f for t, f in TITLES[vertical] if t == title), vertical)) if title else rng.choice(TITLES[vertical])
    hometown = hometown or rng.choice(list(HOMETOWNS))
    high_school = high_school or rng.choice(HOMETOWNS[hometown])
    major = major or rng.choice(MAJORS[vertical])
    if name is None:
        name, gender = gendered_name(rng, fake)
    gender = gender or rng.choice(["men", "women"])
    clubs = clubs if clubs is not None else []
    communities = communities if communities is not None else pick(rng, COMMUNITIES, rng.choice([0, 1, 1, 2]))
    interests = interests if interests is not None else pick(rng, INTERESTS, rng.randint(2, 4))
    projects = projects if projects is not None else pick(rng, PROJECTS, rng.choice([0, 1, 1, 2]))
    programs = programs if programs is not None else (pick(rng, PROGRAMS.get(company["name"], []), 1) if rng.random() < 0.6 else [])
    clients = clients if clients is not None else (pick(rng, CLIENTS[vertical], rng.choice([0, 1, 2])) if rng.random() < 0.7 else [])

    start_current = max(grad_year, rng.randint(grad_year, min(grad_year + 8, 2026)))
    current_role = {"company": company["name"], "title": title, "function": function, "industry": INDUSTRY[vertical],
                    "seniority": seniority_of(title), "startYear": start_current, "endYear": None, "clients": clients, "programs": programs}
    roles = (prior_roles or []) + [current_role]
    if prior_roles is None and start_current > grad_year and rng.random() < 0.6:
        pv = rng.choice(VERTICALS)
        pcomp = rng.choice(COMPANIES[pv])[0]
        ptitle, pfunc = rng.choice([t for t in TITLES[pv] if seniority_of(t[0]) in ("analyst", "associate", "intern")] or TITLES[pv])
        roles.insert(0, {"company": pcomp, "title": ptitle, "function": pfunc, "industry": INDUSTRY[pv], "seniority": seniority_of(ptitle),
                         "startYear": grad_year, "endYear": start_current, "clients": [],
                         "programs": pick(rng, PROGRAMS.get(pcomp, []), 1) if rng.random() < 0.5 else []})

    ctx = {"vertical": vertical, "event": rng.choice(EVENTS)[0], "interest": interests[0], "title": title, "company": company["name"]}
    posts = posts if posts is not None else ([make_post(rng, int(re.sub(r"\D", "", pid)), ctx)] if rng.random() < 0.3 else [])
    events = events if events is not None else ([make_event(rng)] if rng.random() < 0.35 else [])

    return {
        "id": pid, "name": name, "email": email_for(name, company["name"]),
        "headline": f"{title} at {company['name']} | {school} '{str(grad_year)[2:]}",
        "company": company["name"], "company_id": company["id"], "title": title,
        "function": function, "industry": INDUSTRY[vertical], "seniority": seniority_of(title),
        "school": school, "major": major, "grad_year": grad_year,
        "hometown": hometown, "high_school": high_school,
        "clubs": clubs, "communities": communities, "interests": interests, "projects": projects,
        "education": [{"school": rng.choice([school, SCHOOL_LONG]) if school == SCHOOL else school, "degree": "BS", "field": major,
                       "startYear": grad_year - 4, "endYear": grad_year, "activities": clubs}],
        "roles": roles, "posts": posts, "events": events,
        "vertical": vertical, "location": rng.choice(LOCATIONS),
        "openness_to_chat": openness if openness is not None else round(rng.betavariate(3, 2), 2),
        "linkedin_url": f"https://www.example.com/in/{slug(name)}-{pid}",
        "photo_url": portraits.next(gender),
    }


def gen_people(rng: random.Random, fake: Faker, portraits: Portraits, companies: list[dict], clubs: list[dict], per_club: int) -> list[dict]:
    """A couple of alumni per club. Each person's anchor club decides their vertical when the club implies one."""
    by_vertical = {v: [c for c in companies if c["vertical"] == v] for v in VERTICALS}
    by_vertical["finance"].append(next(c for c in companies if c["name"] == "Capital One"))
    size_weight = {"large": 3.0, "mid": 1.5, "small": 1.0}  # the big names should show up most
    rows, pid = [], 1
    for club in clubs:
        for _ in range(per_club):
            vertical = club["vertical"] or rng.choices(VERTICALS, weights=VERTICAL_WEIGHTS)[0]
            pool = by_vertical[vertical]
            company = rng.choices(pool, weights=[size_weight[c["size"]] for c in pool])[0]
            extra = [c["name"] for c in pick(rng, [c for c in clubs if c is not club], rng.choice([0, 1, 1, 2]))]
            rows.append(person_row(rng, fake, portraits, f"p{pid:04d}", company, grad_year=rng.randint(2012, 2025),
                                   vertical=vertical, clubs=[club["name"]] + extra))
            pid += 1
    return rows


def plant_sam_rivera_cast(rng: random.Random, fake: Faker, portraits: Portraits, companies: list[dict]) -> list[dict]:
    """
    People engineered around the demo student in src/lib/session/demo-store.ts (Sam Rivera, Virginia Tech,
    Richmond VA, Deep Run HS, Army ROTC, Beta Alpha Psi, Consulting Club, targets Deloitte + Databricks,
    cybersecurity -> consulting). One or two per ladder rung so the dashboard has a hook on every tier.
    """
    by_name = {c["name"]: c for c in companies}
    deloitte, databricks, capone = by_name["Deloitte"], by_name["Databricks"], by_name["Capital One"]
    out = []
    P = lambda pid, comp, **kw: out.append(person_row(rng, fake, portraits, pid, comp, **kw))  # noqa: E731

    P("p9001", deloitte, grad_year=2018, vertical="accounting", title="Audit Manager", name="Dana Whitfield", gender="women", hometown="Roanoke, VA",
      clubs=["Beta Alpha Psi", "Virginia Tech Crew Team"], programs=["Deloitte Analyst Program"], clients=["CMS"], openness=0.92)
    P("p9002", databricks, grad_year=2021, vertical="swe", title="Solutions Architect", name="Jordan Okafor", gender="men", hometown="Fairfax, VA",
      clubs=["The Consulting Group at Virginia Tech", "Cyber Security Club at Virginia Tech"], programs=["Databricks University"],
      interests=["responsible AI", "gravel cycling", "chess"],
      posts=[{"id": "post-9002", "kind": "article", "title": "Responsible AI in public-sector delivery: a field checklist", "excerpt": None,
              "topics": ["responsible AI", "public sector"], "url": "https://www.example.com/posts/9002", "publishedAt": iso_days_ago(12)}], openness=0.9)
    P("p9003", deloitte, grad_year=2016, vertical="consulting", title="Senior Manager, Technology Consulting", name="Priya Raman", gender="women",
      hometown="Arlington, VA", clubs=["Marching Virginians"],
      prior_roles=[{"company": "MITRE", "title": "Cybersecurity Analyst", "function": "cybersecurity", "industry": "defense",
                    "seniority": "analyst", "startYear": 2016, "endYear": 2019, "clients": [], "programs": []}],
      programs=["Deloitte Cyber Academy"], clients=["Department of Veterans Affairs"], openness=0.8)
    P("p9004", deloitte, grad_year=2019, vertical="consulting", title="Consultant", name="Marcus Bell", gender="men", hometown="Charlotte, NC",
      school="University of Virginia",
      prior_roles=[{"company": "Acme Analytics", "title": "Data Analyst", "function": "analytics", "industry": None, "seniority": "analyst",
                    "startYear": 2019, "endYear": 2023, "clients": ["CMS"], "programs": ["Acme Analytics Summer Program"]}],
      clients=["CMS", "IRS"], openness=0.85)
    P("p9005", databricks, grad_year=2020, vertical="swe", title="Software Engineer", name="Lena Park", gender="women", hometown="Richmond, VA",
      high_school="Deep Run High School", communities=["Young Life"], interests=["Formula 1", "sourdough baking"], clubs=["Hokie Activities Board"], openness=0.88)
    P("p9006", deloitte, grad_year=2017, vertical="consulting", title="Cyber Risk Consultant", name="Tomás Herrera", gender="men", hometown="Austin, TX",
      communities=["Army ROTC", "Eagle Scouts"], interests=["public-sector technology", "fly fishing"], clubs=["Virginia Tech Corps of Cadets"],
      programs=["Deloitte Cyber Academy"], openness=0.75)
    P("p9007", by_name["Guidehouse"], grad_year=2015, vertical="consulting", title="Manager", name="Aisha Rahman", gender="women", hometown="Richmond, VA",
      high_school="Godwin High School", communities=["Habitat for Humanity"], clubs=["Habitat for Humanity at Virginia Tech"], openness=0.7)
    P("p9008", deloitte, grad_year=2014, vertical="consulting", title="Director", name="Owen Castellano", gender="men", hometown="Vienna, VA",
      interests=["responsible AI", "public-sector technology", "backcountry skiing"], projects=["built a responsible-AI checklist for public-sector clients"],
      clients=["USDA"], clubs=["Debate Team at Virginia Tech"], openness=0.6)
    P("p9009", databricks, grad_year=2019, vertical="swe", title="ML Engineer", name="Grace Lindqvist", gender="women", hometown="Ashburn, VA",
      clubs=["Women in Data Science At Virginia Tech"],
      posts=[{"id": "post-9009", "kind": "talk", "title": "Lightning talk at Data + AI Summit on measuring drift in public-sector ML", "excerpt": None,
              "topics": ["responsible AI", "MLOps"], "url": "https://www.example.com/posts/9009", "publishedAt": iso_days_ago(3)}], openness=0.82)
    P("p9010", deloitte, grad_year=2022, vertical="consulting", title="Analyst", name="Chris Nakamura", gender="men", hometown="Chantilly, VA",
      clubs=["180 Degrees Consulting at Virginia Tech"], events=[make_event(rng, 1, ("Deloitte Tech Case Competition", "case_competition", "Deloitte"))],
      programs=["Deloitte Analyst Program"], openness=0.95)
    P("p9011", databricks, grad_year=2023, vertical="swe", title="University Recruiter", name="Sofia Almeida", gender="women", hometown="Leesburg, VA",
      clubs=["Hokie Ambassadors", "Student Alumni Associates of the Virginia Tech Alumni Association"],
      events=[make_event(rng, 4, ("Virginia Tech Fall Career Fair", "career_fair", "Virginia Tech"))], openness=0.97)
    P("p9012", deloitte, grad_year=2023, vertical="consulting", title="Consultant", name="Ethan Moreau", gender="men", hometown="McLean, VA",
      clubs=["Alpha Kappa Psi"], programs=["Deloitte Analyst Program"], openness=0.78)
    P("p9013", databricks, grad_year=2011, vertical="swe", title="Engineering Manager", name="Rachel Stein", gender="women", hometown="Bethesda, MD",
      communities=[], interests=["houseplants"], projects=[], posts=[], events=[], clubs=[], openness=0.4)
    P("p9014", capone, grad_year=2009, vertical="finance", title="Managing Director", name="Victor Adeyemi", gender="men", hometown="Brooklyn, NY",
      communities=[], interests=["Premier League"], projects=[], posts=[], events=[], clubs=[], openness=0.3)
    return out


def gen_positions(rng: random.Random, companies: list[dict], n: int) -> list[dict]:
    quotas = {"swe": int(n * 0.4), "consulting": int(n * 0.25), "finance": int(n * 0.15)}
    quotas["accounting"] = n - sum(quotas.values())
    rows, pid = [], 1
    for vertical, quota in quotas.items():
        comps = [c for c in companies if c["vertical"] == vertical] + ([next(c for c in companies if c["name"] == "Capital One")] if vertical == "finance" else [])
        for _ in range(quota):
            company = rng.choice(comps)
            title, ptype = rng.choice(POSITION_TEMPLATES[vertical])
            offset = rng.randint(3, 150) if ptype == "internship" else rng.randint(90, 300) if ptype == "full_time" else rng.randint(3, 360)
            opens_on = TODAY + timedelta(days=offset)
            closes_on = opens_on + timedelta(days=rng.randint(21, 90))
            target = ([2027, 2028] if rng.random() < 0.7 else [2028, 2029]) if ptype == "internship" else [2027] if ptype == "full_time" else [2027, 2028, 2029]
            location = rng.choice(LOCATIONS)
            rows.append({"id": f"j{pid:03d}", "company_id": company["id"], "title": title, "type": ptype, "vertical": vertical, "location": location,
                         "opens_on": opens_on.isoformat(), "closes_on": closes_on.isoformat(), "target_grad_years": target,
                         "description": (f"{company['name']} is hiring a {title} ({ptype.replace('_', ' ')}) based in {location}. "
                                         f"Join the {vertical} team on high-impact work with direct mentorship. "
                                         f"We favor candidates who reach out to current team members before applying."),
                         "posted_url": f"https://jobs.example.com/{company['id']}/{pid:03d}"})
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


def gen_students(rng: random.Random, fake: Faker, portraits: Portraits, clubs: list[dict], n: int) -> list[dict]:
    rows = []
    club_names = [c["name"] for c in clubs]
    for i in range(1, n + 1):
        primary = rng.choices(VERTICALS, weights=VERTICAL_WEIGHTS)[0]
        targets = [primary] + ([rng.choice([v for v in VERTICALS if v != primary])] if rng.random() < 0.3 else [])
        major = rng.choice(MAJORS[primary])
        grad_year = rng.choice([2027, 2027, 2028, 2028, 2029])
        skills = pick(rng, SKILLS[primary], rng.randint(3, 7))
        certs = pick(rng, CERTS[primary], rng.choice([0, 0, 0, 1, 1, 2]))
        interests = pick(rng, INTERESTS, rng.randint(2, 4))
        my_clubs = pick(rng, club_names, rng.choice([1, 2, 2, 3]))
        communities = pick(rng, COMMUNITIES, rng.choice([0, 1, 1, 2]))
        projects = pick(rng, PROJECTS, rng.choice([0, 1, 1]))
        hometown = rng.choice(list(HOMETOWNS))
        high_school = rng.choice(HOMETOWNS[hometown])
        target_companies = [c[0] for c in pick(rng, COMPANIES[primary], 2)]
        events = [make_event(rng)] if rng.random() < 0.5 else []
        name, gender = gendered_name(rng, fake)
        resume = (f"{name}\n{SCHOOL} - B.S. {major}, expected {grad_year}\n\nSKILLS: {', '.join(skills)}\n"
                  f"CERTIFICATIONS: {', '.join(certs) if certs else 'None yet'}\nACTIVITIES: {', '.join(my_clubs + communities)}\n\n"
                  f"EXPERIENCE\n- {rng.choice(['Teaching assistant', 'Club project lead', 'Part-time developer', 'Research assistant', 'Campus ambassador'])}, "
                  f"{SCHOOL} ({grad_year - 2}-present): built and shipped a "
                  f"{rng.choice(['dashboard', 'mobile app', 'trading simulator', 'case competition deck', 'data pipeline'])} used by {rng.randint(20, 400)} students.\n"
                  + (f"- Project: {projects[0]}.\n" if projects else "") + f"- Interested in {', '.join(interests)}.")
        questionnaire = {"what_kind_of_work": rng.choice(["Building things people actually use", "Solving messy business problems", "Markets and numbers",
                                                          "Research with real-world impact", "Something where I can learn fast"]),
                         "target_verticals": targets, "target_companies": target_companies, "preferred_locations": pick(rng, LOCATIONS, 2),
                         "hometown": hometown, "high_school": high_school, "communities": communities,
                         "dream_company_traits": rng.choice(["Small team, lots of ownership", "Big brand on the resume", "Mission-driven", "Fast promotion track"]),
                         "internship_or_full_time": "internship" if grad_year >= 2028 else rng.choice(["internship", "full_time"]),
                         "comfortable_reaching_out_cold": rng.choice(["yes", "a little", "not really"]), "input_mode": rng.choice(["dictation", "typed"])}
        rows.append({"id": f"s{i:03d}", "name": name, "email": f"{ascii_name(name.split()[0])}{i:03d}@vt.example.edu", "school": SCHOOL, "major": major,
                     "grad_year": grad_year, "target_verticals": targets, "target_companies": target_companies, "skills": skills,
                     "certifications": certs, "interests": interests, "projects": projects, "hometown": hometown, "high_school": high_school,
                     "clubs": my_clubs, "communities": communities, "events": events, "resume_text": resume,
                     "questionnaire_answers": json.dumps(questionnaire), "photo_url": portraits.next(gender),
                     "created_at": datetime(2026, 8, rng.randint(15, 31), rng.randint(8, 22), rng.randint(0, 59), tzinfo=timezone.utc).isoformat()})
    return rows


def plant_demo_story(rng: random.Random, students: list[dict], people: list[dict], positions: list[dict], requirements: list[dict],
                     companies: list[dict]) -> dict:
    """Heroes (s001-s005) get a same-club + same-hometown path to someone at a hiring company; gap students (s006-s010)
    match a position on every skill but lack one required certification."""
    comp_by_id = {c["id"]: c for c in companies}
    story = {"heroes": [], "gaps": [], "sam_rivera_cast": [p["id"] for p in people if p["id"].startswith("p9")]}
    for s in students[:5]:
        vertical = s["target_verticals"][0]
        cands = sorted([p for p in positions if p["vertical"] == vertical and s["grad_year"] in p["target_grad_years"]], key=lambda p: p["opens_on"])
        pos = cands[0]
        person = rng.choice([p for p in people if p["company_id"] == pos["company_id"] and not p["id"].startswith("p9")] or [rng.choice(people)])
        person.update(company_id=pos["company_id"], company=comp_by_id[pos["company_id"]]["name"], vertical=vertical, major=s["major"],
                      hometown=s["hometown"], high_school=s["high_school"])
        shared_club = s["clubs"][0]
        person["clubs"] = [shared_club] + [c for c in person["clubs"] if c != shared_club][:1]
        person["education"][0].update(field=s["major"], activities=person["clubs"])
        person["roles"][-1].update(company=person["company"])
        person["email"] = email_for(person["name"], person["company"])
        if s["communities"]:
            person["communities"] = [s["communities"][0]] + person["communities"][:1]
        person["interests"] = [s["interests"][0]] + person["interests"][:2]
        person["openness_to_chat"] = round(rng.uniform(0.8, 0.98), 2)
        person["headline"] = f"{person['title']} at {person['company']} | {SCHOOL} '{str(person['grad_year'])[2:]}"
        story["heroes"].append({"student": s["id"], "person": person["id"], "company": person["company"], "shared_club": shared_club,
                                "shared_high_school": s["high_school"], "position": pos["id"]})
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


PATH_WEIGHTS = {"same_club": 0.85, "same_high_school": 0.9, "same_community": 0.8, "alumni_at_target_company": 0.7, "shared_employer": 0.7,
                "same_event": 0.6, "shared_interest": 0.55, "same_school": 0.5, "same_hometown": 0.35, "same_major": 0.25}


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
    ap.add_argument("--per-club", type=int, default=2, help="alumni generated per student organization")
    ap.add_argument("--positions", type=int, default=160)
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    fake = Faker("en_US")
    Faker.seed(args.seed)
    portraits = Portraits(rng)

    clubs = load_clubs()
    companies = gen_companies(rng)
    people = gen_people(rng, fake, portraits, companies, clubs, args.per_club) + plant_sam_rivera_cast(rng, fake, portraits, companies)
    positions = gen_positions(rng, companies, args.positions)
    requirements = gen_requirements(rng, positions)
    students = gen_students(rng, fake, portraits, clubs, args.students)
    story = plant_demo_story(rng, students, people, positions, requirements, companies)
    paths = gen_connection_paths(students, people, positions)

    args.out.mkdir(parents=True, exist_ok=True)
    for name, rows in [("companies", companies), ("people", people), ("positions", positions), ("position_requirements", requirements),
                       ("students", students), ("connection_paths", paths)]:
        write_jsonl(args.out / f"{name}.jsonl", rows)
        print(f"{name:24s} {len(rows):6d} rows")
    (args.out / "demo_story.json").write_text(json.dumps(story, indent=2) + "\n")
    (args.out / "vt_clubs.json").write_text(json.dumps(clubs, indent=1) + "\n")
    photos = {p["photo_url"] for p in people}
    print(f"seed={args.seed}; {len(clubs)} clubs x {args.per_club}; {len(photos)} distinct portraits over {len(people)} people; "
          f"demo story: {len(story['heroes'])} heroes, {len(story['gaps'])} gap students, {len(story['sam_rivera_cast'])} planted around Sam Rivera")


if __name__ == "__main__":
    main()
