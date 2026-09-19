import type { StudentProfile } from "@/lib/ai/schemas";

export interface NetworkingJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
}

export interface NetworkingTarget {
  id: string;
  /** Absent for role-based targets ("the campus recruiter for this programme"). */
  name?: string;
  role: string;
  company: string;
  /** Why this person, for this student, for this job. */
  rationale: string;
  /** Pre-filled search when no named person is known. */
  searchUrl?: string;
  profileUrl?: string;
  suggestedMessage?: string;
  confidence: number;
}

export interface NetworkingProvider {
  readonly name: string;
  getTargets(input: {
    student: StudentProfile;
    job: NetworkingJob;
    limit?: number;
  }): Promise<NetworkingTarget[]>;
}
