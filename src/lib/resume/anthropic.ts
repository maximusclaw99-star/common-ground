import { extractProfile } from "@/lib/ai/extract-profile";
import type { StudentProfile } from "@/lib/ai/schemas";
import type { ResumeInput, ResumeProvider } from "./types";

/**
 * Reads the resume with Claude, which takes the PDF itself rather than text
 * flattened out of it — so layout survives and a scan still works. Kept as an
 * option for anyone holding an Anthropic key; the default is Databricks.
 */
export const anthropicResumeProvider: ResumeProvider = {
  name: "anthropic",
  isReady: () => Boolean(process.env.ANTHROPIC_API_KEY),
  notReadyReason:
    "ANTHROPIC_API_KEY isn't set. Either add one, or set RESUME_PROVIDER=databricks to read it in the warehouse.",

  async extract({ bytes, dictation }: ResumeInput): Promise<StudentProfile> {
    const base64 = Buffer.from(bytes).toString("base64");
    return extractProfile({ documents: [{ kind: "resume", base64 }], dictation });
  },
};
