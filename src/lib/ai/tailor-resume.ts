import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL } from "./client";
import { findFabrications, type Fabrication } from "./fabrication-check";
import { TailoredResumeSchema, type StudentProfile, type TailoredResume } from "./schemas";

const SYSTEM = `You tailor a university student's resume to one specific job posting.

The confirmed profile is the ONLY source of truth. You may:
  - select which experience, projects and skills to include, and in what order
  - rewrite bullet wording to use the posting's vocabulary
  - write a summary that frames existing facts for this role

You may NOT, under any circumstances:
  - add an employer, job title, date, school, credential, project or skill that
    is not in the profile
  - change any employment date, title or employer name
  - imply seniority, scope or results the profile does not state
  - state a proficiency the profile does not support

If the student lacks something the posting wants, leave it out. Do not soften
the gap with vague phrasing that implies they have it. A student signs their
name to this document and will be asked about every line of it in an interview.

Populate "changes" with one plain-language entry per meaningful edit, so the
student can see what you did before they send it.`;

export interface TailorResult {
  resume: TailoredResume;
  /** Empty on success. Non-empty means the structural check still caught something. */
  fabrications: Fabrication[];
  attempts: number;
}

export async function tailorResume(input: {
  profile: StudentProfile;
  job: { title: string; company: string; description: string | null };
}): Promise<TailorResult> {
  const { profile, job } = input;

  const request = (correction?: Fabrication[]) =>
    anthropic().messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { format: zodOutputFormat(TailoredResumeSchema) },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `<confirmed_profile>\n${JSON.stringify(profile, null, 2)}\n</confirmed_profile>`,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: [
                `<job_posting>`,
                `Title: ${job.title}`,
                `Company: ${job.company}`,
                `Description: ${(job.description ?? "No description.").slice(0, 8000)}`,
                `</job_posting>`,
                correction
                  ? `\nYour previous attempt introduced facts absent from the profile:\n` +
                    correction.map((f) => `  - ${f.field}: "${f.value}" — ${f.detail}`).join("\n") +
                    `\nRewrite using only what the profile states.`
                  : "",
              ].join("\n"),
            },
          ],
        },
      ],
    });

  let attempts = 0;
  let last: { resume: TailoredResume; fabrications: Fabrication[] } | null = null;

  // One retry: the structural check is cheap and a second pass fixes most
  // slips. Beyond that, hand the problems to the UI rather than loop on cost.
  for (const correction of [undefined, "retry"] as const) {
    attempts++;
    const response = await request(
      correction && last ? last.fabrications : undefined,
    );
    if (!response.parsed_output) {
      throw new Error(`Resume tailoring returned no parsed output (${response.stop_reason})`);
    }

    const resume = response.parsed_output;
    const fabrications = findFabrications(profile, resume);
    last = { resume, fabrications };
    if (fabrications.length === 0) break;
  }

  return { ...last!, attempts };
}
