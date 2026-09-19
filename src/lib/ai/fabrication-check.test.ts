import assert from "node:assert/strict";
import { test } from "vitest";
import { findFabrications } from "./fabrication-check";
import type { StudentProfile, TailoredResume } from "./schemas";

const profile: StudentProfile = {
  full_name: "Sam Rivera", school: "Virginia Tech", grad_date: "2027-05-15",
  work_auth: "US citizen",
  skills: ["Python", "SQL", "Tableau"],
  coursework: [{ code: "BIT 3484", title: "Business Intelligence", grade: "A", term: "Fall 2026" }],
  experience: [{
    employer: "Acme Analytics", title: "Data Intern", start: "2026-06", end: "2026-08",
    location: "Roanoke, VA", bullets: ["Built dashboards"],
  }],
  projects: [{ name: "Campus Energy Dashboard", summary: "Viz of usage", skills: ["Tableau"] }],
  targets: { roles: ["Data Analyst"], locations: ["DC"], industries: ["Consulting"] },
  affinity: {
    school_raw: "Virginia Tech", majors: ["Business Information Technology"], minors: [],
    student_orgs: ["Consulting Club"], greek: ["Beta Alpha Psi"], case_competitions: [],
    programs: [], prior_employers: ["Acme Analytics"], clients_and_programs: [],
    certifications_in_progress: [], clearance: null,
  },
  uncertainties: [],
};

const baseResume: TailoredResume = {
  summary: "Analytics-focused student.",
  skills: ["Python", "SQL"],
  experience: [{
    employer: "Acme Analytics", title: "Data Intern",
    start: "2026-06", end: "2026-08", bullets: ["Rebuilt reporting in Tableau"],
  }],
  projects: [{ name: "Campus Energy Dashboard", bullets: ["Modelled usage"] }],
  education: { school: "Virginia Tech", credential: "BS", grad_date: "2027-05-15", highlights: [] },
  changes: [],
};

test("a faithfully tailored resume raises nothing", () => {
  assert.deepEqual(findFabrications(profile, baseResume), []);
});

test("rewording bullets is allowed — that is what tailoring is", () => {
  const reworded = {
    ...baseResume,
    experience: [{ ...baseResume.experience[0], bullets: ["Totally different phrasing here"] }],
  };
  assert.deepEqual(findFabrications(profile, reworded), []);
});

test("catches an invented employer", () => {
  const bad = { ...baseResume, experience: [{ ...baseResume.experience[0], employer: "Goldman Sachs" }] };
  const found = findFabrications(profile, bad);
  assert.equal(found.length, 1);
  assert.equal(found[0].field, "experience.employer");
});

test("catches an inflated job title at a real employer", () => {
  const bad = { ...baseResume, experience: [{ ...baseResume.experience[0], title: "Lead Data Scientist" }] };
  assert.equal(findFabrications(profile, bad)[0].field, "experience.title");
});

test("catches stretched employment dates", () => {
  const bad = { ...baseResume, experience: [{ ...baseResume.experience[0], start: "2025-01" }] };
  const found = findFabrications(profile, bad);
  assert.equal(found[0].field, "experience.start");
  assert.match(found[0].detail, /2026-06/);
});

test("catches a skill added because the posting asked for it", () => {
  const bad = { ...baseResume, skills: ["Python", "Kubernetes"] };
  const found = findFabrications(profile, bad);
  assert.equal(found.length, 1);
  assert.equal(found[0].value, "Kubernetes");
});

test("accepts a skill evidenced by coursework or a project", () => {
  const ok = { ...baseResume, skills: ["Tableau", "Business Intelligence"] };
  assert.deepEqual(findFabrications(profile, ok), []);
});

test("catches an invented project and a wrong school", () => {
  const bad = {
    ...baseResume,
    projects: [{ name: "Autonomous Drone Fleet", bullets: [] }],
    education: { ...baseResume.education, school: "MIT" },
  };
  const fields = findFabrications(profile, bad).map((f) => f.field);
  assert.deepEqual(fields.sort(), ["education.school", "projects.name"]);
});
