import { EMPTY_FACTS, type AffinityFacts, type FactsMeta, type StudentProfile } from "@/lib/ai/schemas";
import { student as fixtureStudent } from "@/lib/affinity/__fixtures__/cast";

/**
 * The demo-mode store: one student, held in module memory.
 *
 * Deliberately not a database. Demo mode exists so the product can be shown
 * and built before Supabase is configured, and anything that survives a server
 * restart would start to look like persistence we have not actually built.
 */
export interface StoredStudent {
  profile: StudentProfile;
  facts: AffinityFacts;
  meta: FactsMeta;
  intakeCompletedAt: string | null;
  email: string | null;
}

/**
 * A resume that has been read, but that leaves the questionnaire real work to
 * do: it names a school, employers and one club, and flags an ambiguity the
 * extractor could not resolve on its own.
 */
function seed(): StoredStudent {
  return {
    profile: {
      ...fixtureStudent.profile,
      affinity: {
        ...fixtureStudent.profile.affinity,
        student_orgs: ["Consulting Club"],
        greek: [],
        case_competitions: [],
        programs: [],
        clients_and_programs: [],
      },
      uncertainties: [
        "The activities section lists “BAP”. That is probably Beta Alpha Psi, but the document never says so.",
        "Two end dates overlap in summer 2026 — the Acme internship and the campus job may have run at the same time.",
      ],
    },
    facts: { ...EMPTY_FACTS },
    meta: {},
    intakeCompletedAt: null,
    email: "sam.rivera@vt.edu",
  };
}

/**
 * DEMO_PREFILL=1 seeds the demo student with the fully answered questionnaire
 * from the fixture instead of an empty one, so the dashboard is interesting
 * without walking the questions live. Off by default: the questionnaire is
 * the demo, and this exists for rehearsal-free showings only.
 */
function prefilled(): StoredStudent {
  const meta: FactsMeta = {};
  const now = new Date().toISOString();
  for (const key of Object.keys(fixtureStudent.facts)) {
    meta[key] = { source: "answer", confidence: 1, raw: null, updatedAt: now };
  }
  return {
    profile: fixtureStudent.profile,
    facts: { ...fixtureStudent.facts },
    meta,
    intakeCompletedAt: now,
    email: "sam.rivera@vt.edu",
  };
}

const initial = () => (process.env.DEMO_PREFILL === "1" ? prefilled() : seed());

let current: StoredStudent | null = null;

export const demoStore = {
  get(): StoredStudent {
    current ??= initial();
    return current;
  },
  set(next: Partial<StoredStudent>): StoredStudent {
    current = { ...demoStore.get(), ...next };
    return current;
  },
  reset(): StoredStudent {
    current = initial();
    return current;
  },
};
