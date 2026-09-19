import { findFabrications, type Fabrication } from "@/lib/ai/fabrication-check";
import { TailoredResumeSchema, type StudentProfile, type TailoredResume } from "@/lib/ai/schemas";
import { chat } from "@/lib/databricks/chat";
import { extractJsonObject } from "@/lib/resume/json";
import type { Position } from "@/lib/positions";

/**
 * The resume rewrite, on Databricks.
 *
 * Same rules as src/lib/ai/tailor-resume.ts (which needs an Anthropic key):
 * the confirmed profile is the only source of truth, and the output goes
 * through the same structural fabrication check. A 70B model through chat
 * returns a string, so the JSON is extracted leniently and validated with the
 * same zod schema; one retry with the check's findings fed back, then the
 * result is returned with whatever the check still caught — shown, not hidden.
 */

const RULES = `You tailor a university student's resume to one specific job posting.

The confirmed profile is the ONLY source of truth. You may:
  - select which experience, projects and skills to include, and in what order
  - rewrite bullet wording to use the posting's vocabulary
  - write a summary that frames existing facts for this role

You may NOT, under any circumstances:
  - add an employer, job title, date, school, credential, project or skill that is not in the profile
  - change any employment date, title or employer name
  - imply seniority, scope or results the profile does not state
  - state a proficiency the profile does not support

If the student lacks something the posting wants, leave it out. Do not soften the gap with vague
phrasing that implies they have it. A student signs their name to this document.

Reply with ONE JSON object and nothing else — no prose, no code fence — in exactly this shape:
{"summary":string,"skills":string[],
 "experience":[{"employer":string,"title":string,"start":string|null,"end":string|null,"bullets":string[]}],
 "projects":[{"name":string,"bullets":string[]}],
 "education":{"school":string,"credential":string|null,"grad_date":string|null,"highlights":string[]},
 "changes":[{"change":string,"rationale":string}]}`;

export interface RewriteResult {
  resume: TailoredResume | null;
  fabrications: Fabrication[];
  attempts: number;
  error: string | null;
}

export async function rewriteResume(profile: StudentProfile, position: Position): Promise<RewriteResult> {
  const posting = {
    title: position.title, company: position.company, description: position.description,
    requirements: position.requirements.map((r) => `${r.requirement}${r.required ? " (required)" : ""}`),
  };
  const base = `POSTING:\n${JSON.stringify(posting)}\n\nCONFIRMED PROFILE:\n${JSON.stringify(profile)}`;

  let fabrications: Fabrication[] = [];
  let last: TailoredResume | null = null;
  let error: string | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const correction = fabrications.length
      ? `\n\nYour previous draft invented facts. Remove or correct every one of these and reply again:\n` +
        fabrications.map((f) => `- ${f.field}: "${f.value}" — ${f.detail}`).join("\n")
      : "";
    try {
      const reply = await chat(
        [{ role: "system", content: RULES }, { role: "user", content: base + correction }],
        { maxTokens: 1600, temperature: 0.1, timeoutMs: 60_000 },
      );
      const parsed = TailoredResumeSchema.safeParse(extractJsonObject(reply.content ?? ""));
      if (!parsed.success) {
        error = `resume JSON did not match the schema (${parsed.error.issues[0]?.path.join(".") ?? "?"})`;
        continue;
      }
      last = parsed.data;
      fabrications = findFabrications(profile, parsed.data);
      error = null;
      if (!fabrications.length) return { resume: last, fabrications, attempts: attempt, error: null };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
  return { resume: last, fabrications, attempts: 2, error };
}
