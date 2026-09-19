import { EMPTY_FACTS, type AffinityFacts, type FactsMeta, type StudentProfile } from "@/lib/ai/schemas";
import { student as fixtureStudent } from "@/lib/affinity/__fixtures__/cast";
import { DEFAULT_WEIGHTS, type HomophilyWeights } from "@/lib/homophily/scorer";

/**
 * The demo-mode store: one student per browser, held in module memory.
 *
 * Deliberately not a database. Demo mode exists so the product can be shown
 * and built before Supabase is configured, and anything that survives a server
 * restart would start to look like persistence we have not actually built.
 *
 * There is no sign-in here. proxy.ts hands every browser a random id in a
 * cookie on its first visit, and that id owns a student. Two browsers never
 * see each other's answers — the bug the first shared-student version had —
 * and nobody types a password to look at a demo. An id the store has never
 * seen (after a restart, say) simply gets a fresh student, so there is no
 * "session expired" to run into.
 */
export interface StoredStudent {
  profile: StudentProfile;
  facts: AffinityFacts;
  meta: FactsMeta;
  intakeCompletedAt: string | null;
  email: string | null;
  /** The student's own weights for the homophily scorer. */
  homophilyWeights: HomophilyWeights;
}

/**
 * A resume that has been read, but that leaves the questionnaire real work to
 * do: it names a school, employers and one club, and flags an ambiguity the
 * extractor could not resolve on its own. Every browser starts here, because
 * the resume reader needs warehouse credentials that a demo room rarely has —
 * the student can still replace it by uploading their own.
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
    email: null,
    homophilyWeights: { ...DEFAULT_WEIGHTS },
  };
}

/**
 * DEMO_PREFILL=1 seeds each new browser with the fully answered questionnaire
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
    email: null,
    homophilyWeights: { ...DEFAULT_WEIGHTS },
  };
}

const initial = () => (process.env.DEMO_PREFILL === "1" ? prefilled() : seed());

/**
 * Pinned to globalThis, not module scope. Next's dev server re-evaluates a
 * module whenever it or an import changes, and can hold more than one
 * instance of it across route bundles; a plain `const students = new Map()`
 * is emptied by either. globalThis is process-wide and outlives every
 * re-evaluation — the same trick used for database clients in dev.
 */
// The key names the shape: the value that outlives a module reload may have
// been written by an older version of this file, and must be checked, not
// trusted.
const globalStore = globalThis as typeof globalThis & { __commonGroundDemoStudents?: unknown };
if (!(globalStore.__commonGroundDemoStudents instanceof Map)) globalStore.__commonGroundDemoStudents = new Map();
const students = globalStore.__commonGroundDemoStudents as Map<string, StoredStudent>;

export const demoStore = {
  /** This browser's student, made on first sight. Null only with no id at all. */
  get(id: string | null | undefined): StoredStudent | null {
    if (!id) return null;
    let student = students.get(id);
    if (!student) {
      student = initial();
      students.set(id, student);
    }
    return student;
  },

  set(id: string, next: Partial<StoredStudent>): StoredStudent {
    const student = { ...demoStore.get(id)!, ...next };
    students.set(id, student);
    return student;
  },

  /** Back to the seeded student. */
  reset(id: string): StoredStudent {
    const student = initial();
    students.set(id, student);
    return student;
  },

  /** How many browsers this server currently knows. For the status strip. */
  size(): number {
    return students.size;
  },

  /** Tests only. */
  clear(): void {
    students.clear();
  },
};
