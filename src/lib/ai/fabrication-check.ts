import type { StudentProfile, TailoredResume } from "./schemas";

/**
 * Structural check that a tailored resume invented nothing.
 *
 * A model instructed not to fabricate mostly complies, but "mostly" is not a
 * standard a student can rely on — they sign their name to this document. So
 * every hard fact in the output is checked against the confirmed profile, and
 * anything unsupported is surfaced rather than silently shipped.
 *
 * Scope: verifiable identity facts (employers, titles, dates, school). Bullet
 * wording is intentionally not checked — rephrasing is the point of tailoring.
 */

export interface Fabrication {
  field: string;
  value: string;
  detail: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function findFabrications(
  profile: StudentProfile,
  resume: TailoredResume,
): Fabrication[] {
  const problems: Fabrication[] = [];

  const employers = new Set(profile.experience.map((e) => norm(e.employer)));
  const titlesByEmployer = new Map<string, Set<string>>();
  for (const e of profile.experience) {
    const key = norm(e.employer);
    if (!titlesByEmployer.has(key)) titlesByEmployer.set(key, new Set());
    titlesByEmployer.get(key)!.add(norm(e.title));
  }
  const datesByEmployer = new Map(
    profile.experience.map((e) => [norm(e.employer), { start: e.start, end: e.end }]),
  );

  for (const role of resume.experience) {
    const key = norm(role.employer);

    if (!employers.has(key)) {
      problems.push({
        field: "experience.employer",
        value: role.employer,
        detail: "employer does not appear in the confirmed profile",
      });
      continue;
    }

    if (!titlesByEmployer.get(key)!.has(norm(role.title))) {
      problems.push({
        field: "experience.title",
        value: `${role.title} at ${role.employer}`,
        detail: "job title differs from the confirmed profile",
      });
    }

    const source = datesByEmployer.get(key)!;
    for (const [field, got, want] of [
      ["start", role.start, source.start],
      ["end", role.end, source.end],
    ] as const) {
      if (got && want && norm(got) !== norm(want)) {
        problems.push({
          field: `experience.${field}`,
          value: `${role.employer}: ${got}`,
          detail: `profile says "${want}"`,
        });
      }
    }
  }

  const projects = new Set(profile.projects.map((p) => norm(p.name)));
  for (const project of resume.projects) {
    if (!projects.has(norm(project.name))) {
      problems.push({
        field: "projects.name",
        value: project.name,
        detail: "project does not appear in the confirmed profile",
      });
    }
  }

  if (profile.school && norm(resume.education.school) !== norm(profile.school)) {
    problems.push({
      field: "education.school",
      value: resume.education.school,
      detail: `profile says "${profile.school}"`,
    });
  }

  // Skills are the easiest thing for a model to "helpfully" add because the
  // posting asked for them — which is exactly the dangerous case.
  const known = new Set([
    ...profile.skills.map(norm),
    ...profile.projects.flatMap((p) => p.skills.map(norm)),
    ...profile.coursework.map((c) => norm(c.title)),
  ]);
  for (const skill of resume.skills) {
    if (!known.has(norm(skill))) {
      problems.push({
        field: "skills",
        value: skill,
        detail: "skill is not claimed anywhere in the confirmed profile",
      });
    }
  }

  return problems;
}
