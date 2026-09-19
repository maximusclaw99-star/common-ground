import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL } from "@/lib/ai/client";
import { NetworkingTargetsSchema } from "@/lib/ai/schemas";
import type { NetworkingProvider, NetworkingTarget } from "./types";

/**
 * Stand-in until the dedicated networking module is ready.
 *
 * It names ROLES rather than people, and hands back a pre-filled search plus a
 * drafted opener. It stores no third-party contact data, which is deliberate:
 * LinkedIn has no people-search API, scraping it breaks their terms and is
 * actively blocked, and holding personal data on people who never signed up
 * carries obligations a student product should not take on by accident.
 */

const SYSTEM = `You advise a university student on who to contact at a company BEFORE they apply.

Name roles, never specific individuals — you have no way to know who actually
works there and inventing a name would send the student to a dead end.

Good targets are people who realistically reply to a student: campus and
university recruiters, recent graduates from the same school now on the team,
early-career people in the exact role, and the hiring manager for the function.

For each target write a LinkedIn search query that would surface them, and a
short opener (under 80 words) referencing something concrete from the student's
background. No flattery, no buzzwords, no "I hope this finds you well".`;

export const placeholderNetworkingProvider: NetworkingProvider = {
  name: "placeholder",

  async getTargets({ student, job, limit = 5 }) {
    const response = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { format: zodOutputFormat(NetworkingTargetsSchema) },
      messages: [
        {
          role: "user",
          content: [
            `Student: ${student.school ?? "unknown school"}, graduating ${student.grad_date ?? "unknown"}.`,
            `Skills: ${student.skills.join(", ") || "none listed"}.`,
            `Experience: ${student.experience.map((e) => `${e.title} at ${e.employer}`).join("; ") || "none"}.`,
            ``,
            `Role: ${job.title} at ${job.company}${job.location ? ` (${job.location})` : ""}.`,
            job.description ? `Posting: ${job.description.slice(0, 3000)}` : "",
            ``,
            `Give at most ${limit} targets, most valuable first.`,
          ].join("\n"),
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) return [];

    return parsed.targets.slice(0, limit).map<NetworkingTarget>((t, i) => ({
      id: `${job.id}:${i}`,
      role: t.role,
      company: job.company,
      rationale: t.rationale,
      searchUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
        t.search_query,
      )}`,
      suggestedMessage: t.suggested_message,
      confidence: t.confidence,
    }));
  },
};
