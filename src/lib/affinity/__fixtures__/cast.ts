import { EMPTY_FACTS, type StudentProfile } from "@/lib/ai/schemas";
import type { Person, ScorableStudent } from "../types";

/**
 * One student and eleven people, each engineered so that their PRIMARY tier is
 * exactly one in-scope rung of the ladder. The ordering test and the demo both
 * read this file, which is deliberate: if the demo drifts, the test breaks.
 */

/** Every date here is relative to this, so the fixtures never age. */
export const NOW = Date.parse("2026-09-19T12:00:00Z");
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const profile: StudentProfile = {
  full_name: "Sam Rivera",
  school: "Virginia Tech",
  grad_date: "2027-05-15",
  work_auth: "US citizen",
  skills: ["Python", "SQL", "Tableau"],
  coursework: [{ code: "BIT 3484", title: "Business Intelligence", grade: "A", term: "Fall 2026" }],
  experience: [{
    employer: "Acme Analytics", title: "Data Intern", start: "2026-06", end: "2026-08",
    location: "Roanoke, VA", bullets: ["Built dashboards for a federal client"],
  }],
  projects: [{ name: "Campus Energy Dashboard", summary: "Usage visualisation", skills: ["Tableau"] }],
  targets: { roles: ["Technology Analyst"], locations: ["Washington, DC"], industries: ["Consulting"] },
  affinity: {
    school_raw: "Virginia Polytechnic Institute and State University",
    majors: ["Business Information Technology"], minors: [],
    student_orgs: ["Consulting Club"], greek: ["Beta Alpha Psi"],
    case_competitions: ["Deloitte Tech Case Competition"], programs: [],
    prior_employers: ["Acme Analytics"], clients_and_programs: ["CMS"],
    certifications_in_progress: ["Security+"], clearance: "Public Trust",
  },
  uncertainties: [],
};

export const student: ScorableStudent = {
  profile,
  facts: {
    ...EMPTY_FACTS,
    school_canonical: "Virginia Tech",
    school_grad_year: "2027-05-15",
    majors: ["Business Information Technology"],
    student_orgs: ["Consulting Club"],
    greek: ["Beta Alpha Psi"],
    case_competitions: ["Deloitte Tech Case Competition"],
    prior_employers: ["Acme Analytics"],
    clients_and_programs: ["CMS"],
    hometown: "Richmond, VA",
    high_school: "Deep Run High School",
    communities: ["Army ROTC"],
    technical_domains: ["responsible AI deployment for public-sector clients"],
    interests: ["AI"],
    events: [{ name: "Deloitte Tech Case Competition", kind: "case_competition", date: iso(1), org: "Deloitte" }],
    target_companies: ["Deloitte", "Databricks"],
    target_roles: ["Technology Analyst"],
    target_function: "consulting",
    target_seniority: "analyst",
    desired_transition: { from: "cybersecurity", to: "consulting" },
    certifications_in_progress: ["Security+"],
  },
};

/** Defaults so each fixture below states only what makes it interesting. */
const base = (id: string, fullName: string): Person => ({
  id, fullName, headline: null, profileUrl: null,
  currentCompany: "", currentTitle: "", currentFunction: null,
  currentIndustry: null, currentSeniority: null,
  location: null, hometown: null, highSchool: null, communities: [],
  education: [], roles: [], interests: [], projects: [], posts: [], events: [],
  source: "fixture", fetchedAt: iso(0),
});

/** Tier 2 — same university AND the same organisation. */
export const p2: Person = {
  ...base("p2", "Dana Whitfield"),
  currentCompany: "Deloitte", currentTitle: "Audit Manager",
  currentFunction: "audit", currentSeniority: "manager",
  education: [{
    school: "Virginia Polytechnic Institute and State University",
    degree: "BS", field: "Accounting", startYear: 2014, endYear: 2018,
    activities: ["Beta Alpha Psi", "Intramural Soccer"],
  }],
  roles: [{
    company: "Deloitte", title: "Audit Manager", function: "audit", industry: null,
    seniority: "manager", startYear: 2018, endYear: null, clients: [], programs: [],
  }],
};

/** Tier 3 — same university AND they already made the student's exact jump. */
export const p3: Person = {
  ...base("p3", "Priya Raman"),
  currentCompany: "Accenture", currentTitle: "Senior Manager, Technology Consulting",
  currentFunction: "consulting", currentSeniority: "senior_manager",
  education: [{
    school: "Virginia Tech", degree: "BS", field: "Computer Science",
    startYear: 2012, endYear: 2016, activities: ["Marching Band"],
  }],
  roles: [
    { company: "MITRE", title: "Cybersecurity Analyst", function: "cybersecurity", industry: "defense",
      seniority: "analyst", startYear: 2016, endYear: 2019, clients: [], programs: [] },
    { company: "Accenture", title: "Senior Manager, Technology Consulting", function: "consulting",
      industry: null, seniority: "senior_manager", startYear: 2019, endYear: null, clients: [], programs: [] },
  ],
};

/** Tier 4 — a shared employer, with no overlap in time. */
export const p4: Person = {
  ...base("p4", "Marcus Bell"),
  currentCompany: "Capital One", currentTitle: "Analytics Lead",
  currentFunction: "analytics", currentIndustry: "banking", currentSeniority: "manager",
  education: [{ school: "University of Virginia", degree: "BS", field: "Statistics",
    startYear: 2010, endYear: 2014, activities: ["Club Rowing"] }],
  roles: [
    { company: "Acme Analytics", title: "Data Analyst", function: "analytics", industry: null,
      seniority: "analyst", startYear: 2014, endYear: 2019, clients: [], programs: [] },
    { company: "Capital One", title: "Analytics Lead", function: "analytics", industry: "banking",
      seniority: "manager", startYear: 2019, endYear: null, clients: [], programs: [] },
  ],
};

/** Tier 5 — same hometown, nothing else. */
export const p5: Person = {
  ...base("p5", "Elena Cruz"),
  currentCompany: "Figma", currentTitle: "Product Designer",
  currentFunction: "design", currentSeniority: "senior_associate",
  hometown: "Greater Richmond Area",
  education: [{ school: "James Madison University", degree: "BFA", field: "Graphic Design",
    startYear: 2013, endYear: 2017, activities: ["Ad Club"] }],
  roles: [{ company: "Figma", title: "Product Designer", function: "design", industry: null,
    seniority: "senior_associate", startYear: 2020, endYear: null, clients: [], programs: [] }],
};

/** Tier 7 — a genuinely specific shared professional interest. */
export const p7: Person = {
  ...base("p7", "Tomás Herrera"),
  currentCompany: "Booz Allen Hamilton", currentTitle: "Lead Data Engineer",
  currentFunction: "data engineering", currentSeniority: "manager",
  interests: ["responsible AI deployment for public-sector clients"],
  education: [{ school: "Georgetown University", degree: "MS", field: "Analytics",
    startYear: 2015, endYear: 2017, activities: [] }],
  roles: [{ company: "Booz Allen Hamilton", title: "Lead Data Engineer", function: "data engineering",
    industry: null, seniority: "manager", startYear: 2017, endYear: null, clients: [], programs: [] }],
};

/** Tier 8 — recently published, and at a company the student is targeting. */
export const p8: Person = {
  ...base("p8", "Ruth Okonjo"),
  currentCompany: "Databricks", currentTitle: "Director of Field Engineering",
  currentFunction: "field engineering", currentSeniority: "director",
  posts: [{
    id: "post-1", kind: "talk", title: "What we got wrong about onboarding new grads",
    excerpt: null, topics: ["hiring"], url: null, publishedAt: iso(3),
  }],
  education: [{ school: "Purdue University", degree: "BS", field: "Industrial Engineering",
    startYear: 2008, endYear: 2012, activities: [] }],
  roles: [{ company: "Databricks", title: "Director of Field Engineering", function: "field engineering",
    industry: null, seniority: "director", startYear: 2021, endYear: null, clients: [], programs: [] }],
};

/** Tier 9 — they were at the same competition, yesterday. */
export const p9: Person = {
  ...base("p9", "Colin Marsh"),
  currentCompany: "Guidehouse", currentTitle: "Risk Associate",
  currentFunction: "risk", currentSeniority: "associate",
  events: [{ name: "Deloitte Tech Case Competition", kind: "case_competition", date: iso(1), org: "Deloitte" }],
  education: [{ school: "University of Maryland", degree: "BS", field: "Finance",
    startYear: 2016, endYear: 2020, activities: [] }],
  roles: [{ company: "Guidehouse", title: "Risk Associate", function: "risk", industry: null,
    seniority: "associate", startYear: 2020, endYear: null, clients: [], programs: [] }],
};

/** Tier 10 — exactly one rung ahead, in the student's own function. */
export const p10: Person = {
  ...base("p10", "Ava Lindqvist"),
  currentCompany: "Bain & Company", currentTitle: "Consulting Associate",
  currentFunction: "consulting", currentSeniority: "associate",
  education: [{ school: "New York University", degree: "BA", field: "Economics",
    startYear: 2019, endYear: 2023, activities: [] }],
  roles: [{ company: "Bain & Company", title: "Consulting Associate", function: "consulting",
    industry: null, seniority: "associate", startYear: 2023, endYear: null, clients: [], programs: [] }],
};

/** Tier 11 — a target company, and nothing personal at all. */
export const p11: Person = {
  ...base("p11", "Harold Finch"),
  currentCompany: "Deloitte", currentTitle: "Tax Partner",
  currentFunction: "tax", currentSeniority: "partner",
  education: [{ school: "Ohio State University", degree: "BS", field: "Taxation",
    startYear: 1996, endYear: 2000, activities: [] }],
  roles: [{ company: "Deloitte", title: "Tax Partner", function: "tax", industry: null,
    seniority: "partner", startYear: 2000, endYear: null, clients: [], programs: [] }],
};

/** Tier 12 — "we both like AI", which is exactly as weak as it sounds. */
export const p12: Person = {
  ...base("p12", "Nate Osei"),
  currentCompany: "Scale AI", currentTitle: "Research Lead",
  currentFunction: "research", currentSeniority: "manager",
  interests: ["AI"],
  education: [{ school: "University of Washington", degree: "PhD", field: "Robotics",
    startYear: 2012, endYear: 2018, activities: [] }],
  roles: [{ company: "Scale AI", title: "Research Lead", function: "research", industry: null,
    seniority: "manager", startYear: 2018, endYear: null, clients: [], programs: [] }],
};

/** Tier 13 — nothing in common but a pulse. */
export const p13: Person = {
  ...base("p13", "Jo Ferreira"),
  currentCompany: "Klaviyo", currentTitle: "Brand Marketing Lead",
  currentFunction: "marketing", currentSeniority: "manager",
  education: [{ school: "Boston University", degree: "BA", field: "Communications",
    startYear: 2011, endYear: 2015, activities: [] }],
  roles: [{ company: "Klaviyo", title: "Brand Marketing Lead", function: "marketing", industry: null,
    seniority: "manager", startYear: 2019, endYear: null, clients: [], programs: [] }],
};

/** Shuffled on purpose: a cast already in ladder order proves nothing. */
export const cast: readonly Person[] = [p9, p13, p2, p11, p5, p8, p3, p12, p7, p10, p4];

export const EXPECTED_ORDER = [2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13] as const;
