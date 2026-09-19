import type { StudentProfile } from "@/lib/ai/schemas";

export interface ResumeInput {
  /** Raw PDF bytes. */
  bytes: Uint8Array;
  filename?: string;
  /** The student's spoken answers, if any, for intent the resume cannot carry. */
  dictation?: string | null;
}

export interface ResumeProvider {
  readonly name: string;
  /** Whether this provider is configured well enough to run right now. */
  readonly isReady: () => boolean;
  /** What to tell the student when it is not. */
  readonly notReadyReason: string;
  extract(input: ResumeInput): Promise<StudentProfile>;
}
