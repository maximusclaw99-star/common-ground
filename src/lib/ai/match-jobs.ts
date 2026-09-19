import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL } from "./client";
import { MatchBatchSchema, type StudentProfile } from "./schemas";

export interface ScorableJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
}

export interface MatchResult {
  jobId: string;
  score: number;
  reasons: string[];
  gaps: string[];
}

/** Jobs per request. Small enough that one bad posting can't skew a batch. */
const BATCH_SIZE = 10;
/** Descriptions run long; this keeps a batch inside a sensible prompt size. */
const DESCRIPTION_CHARS = 6000;

const SYSTEM = `You score how well a specific university student fits specific entry-level job postings.

Score 0-100, where:
  85-100  strong fit — coursework and experience map directly onto the role
  60-84   plausible fit — core requirements met, some stretch
  30-59   weak fit — adjacent skills, meaningful gaps
  0-29    poor fit — wrong field, or the student is ineligible

Judge on evidence in the profile, not enthusiasm. Weigh coursework as real
preparation: a relevant course sequence can substitute for internship
experience at this level.

"reasons" must cite something concrete from the profile (a named course,
project, tool or role). "gaps" must be things the student could actually
address or should know about before applying. Both stay under 20 words each.

Be decisive. If a posting is a bad fit, score it low rather than hedging —
an inflated score wastes an application the student cannot get back.`;

function renderProfile(profile: StudentProfile): string {
  return [
    `School: ${profile.school ?? "unknown"}`,
    `Graduates: ${profile.grad_date ?? "unknown"}`,
    `Work authorisation: ${profile.work_auth ?? "unstated"}`,
    `Skills: ${profile.skills.join(", ") || "none listed"}`,
    `Coursework: ${profile.coursework.map((c) => c.title).join("; ") || "none listed"}`,
    `Experience: ${
      profile.experience.map((e) => `${e.title} at ${e.employer}`).join("; ") || "none listed"
    }`,
    `Projects: ${profile.projects.map((p) => `${p.name} (${p.skills.join("/")})`).join("; ") || "none"}`,
    `Wants roles: ${profile.targets.roles.join(", ") || "unspecified"}`,
    `Wants locations: ${profile.targets.locations.join(", ") || "unspecified"}`,
    `Wants industries: ${profile.targets.industries.join(", ") || "unspecified"}`,
  ].join("\n");
}

async function scoreBatch(profile: StudentProfile, jobs: ScorableJob[]): Promise<MatchResult[]> {
  const rendered = jobs
    .map((job) =>
      [
        `<job id="${job.id}">`,
        `Title: ${job.title}`,
        `Company: ${job.company}`,
        `Location: ${job.location ?? "unspecified"}`,
        `Description: ${(job.description ?? "No description available.").slice(0, DESCRIPTION_CHARS)}`,
        `</job>`,
      ].join("\n"),
    )
    .join("\n\n");

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(MatchBatchSchema) },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            // Stable prefix first so it caches across every batch for this student.
            text: `<student_profile>\n${renderProfile(profile)}\n</student_profile>`,
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: `Score each posting below.\n\n${rendered}` },
        ],
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) return [];

  const valid = new Set(jobs.map((j) => j.id));
  return parsed.matches
    .filter((m) => valid.has(m.job_id)) // guard against a hallucinated id
    .map((m) => ({
      jobId: m.job_id,
      score: Math.round(m.score),
      reasons: m.reasons,
      gaps: m.gaps,
    }));
}

export async function matchJobs(
  profile: StudentProfile,
  jobs: ScorableJob[],
): Promise<MatchResult[]> {
  const batches: ScorableJob[][] = [];
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) batches.push(jobs.slice(i, i + BATCH_SIZE));

  const results: MatchResult[] = [];
  // Sequential: the cached profile prefix must be written by the first call
  // before later calls can read it.
  for (const batch of batches) {
    results.push(...(await scoreBatch(profile, batch)));
  }
  return results.sort((a, b) => b.score - a.score);
}
