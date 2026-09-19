import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { EMPTY_FACTS, type AffinityFacts, type FactsMeta, type StudentProfile } from "@/lib/ai/schemas";
import { student as fixtureStudent } from "@/lib/affinity/__fixtures__/cast";

/**
 * The demo-mode store: accounts and their students, held in module memory.
 *
 * Deliberately not a database. Demo mode exists so the product can be shown
 * and built before Supabase is configured, and anything that survives a server
 * restart would start to look like persistence we have not actually built.
 *
 * It IS per account, though. The first version held a single student that
 * every visitor shared, which meant the questionnaire showed one person the
 * answers another had just typed. Each account now owns its own student, keyed
 * by a session cookie, so two browsers never see each other's answers — the
 * same shape the Supabase path has, minus the durability.
 */
export interface StoredStudent {
  profile: StudentProfile;
  facts: AffinityFacts;
  meta: FactsMeta;
  intakeCompletedAt: string | null;
  email: string | null;
}

export interface DemoAccount {
  id: string;
  email: string;
  createdAt: string;
}

interface AccountRecord extends DemoAccount {
  salt: string;
  hash: string;
  student: StoredStudent;
}

/**
 * A resume that has been read, but that leaves the questionnaire real work to
 * do: it names a school, employers and one club, and flags an ambiguity the
 * extractor could not resolve on its own. Every new demo account starts here,
 * because the resume reader needs warehouse credentials that a demo room
 * rarely has — the student can still replace it by uploading their own.
 */
function seed(email: string): StoredStudent {
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
    email,
  };
}

/**
 * DEMO_PREFILL=1 seeds each new account with the fully answered questionnaire
 * from the fixture instead of an empty one, so the dashboard is interesting
 * without walking the questions live. Off by default: the questionnaire is
 * the demo, and this exists for rehearsal-free showings only.
 */
function prefilled(email: string): StoredStudent {
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
    email,
  };
}

const initial = (email: string) => (process.env.DEMO_PREFILL === "1" ? prefilled(email) : seed(email));

/**
 * Pinned to globalThis, not module scope. Next's dev server re-evaluates a
 * module whenever it or an import changes, and can hold more than one
 * instance of it across route bundles; a plain `const accounts = new Map()`
 * is emptied by either, which is how an account signed up a minute ago came
 * back as "session expired" on upload. globalThis is process-wide and outlives
 * every re-evaluation — the same trick used for database clients in dev.
 */
interface DemoState {
  accounts: Map<string, AccountRecord>;
  idsByEmail: Map<string, string>;
}
const globalStore = globalThis as typeof globalThis & { __commonGroundDemo?: DemoState };
const state: DemoState = globalStore.__commonGroundDemo ??= {
  accounts: new Map(), idsByEmail: new Map(),
};
const { accounts, idsByEmail } = state;

/**
 * The standing demo login, so there is always an account to walk in with —
 * on a laptop after a restart, or on Vercel after a cold start, where every
 * account made by hand has just been wiped. `DEMO_LOGIN=email:password`
 * overrides it. Shown on the sign-in page in demo mode; it is not a secret.
 */
export const DEMO_LOGIN: { email: string; password: string } = (() => {
  const [email, ...rest] = (process.env.DEMO_LOGIN ?? "demo@commonground.app:commonground").split(":");
  return { email: email.trim(), password: rest.join(":") || "commonground" };
})();

const normaliseEmail = (email: string) => email.trim().toLowerCase();

/**
 * scrypt with a per-account salt. Overkill for something that lives in RAM
 * and dies on restart, but the cost of doing it properly is three lines, and
 * a demo that stores plaintext passwords is the kind of thing that gets
 * copied into the real implementation later.
 */
const hashPassword = (password: string, salt: string) =>
  scryptSync(password, salt, 32).toString("hex");

const publicView = ({ id, email, createdAt }: AccountRecord): DemoAccount => ({ id, email, createdAt });

export const demoStore = {
  /** Null when the address already has an account. */
  createAccount(email: string, password: string): DemoAccount | null {
    const key = normaliseEmail(email);
    if (!key || idsByEmail.has(key)) return null;
    const salt = randomBytes(16).toString("hex");
    const record: AccountRecord = {
      id: randomUUID(),
      email: key,
      createdAt: new Date().toISOString(),
      salt,
      hash: hashPassword(password, salt),
      student: initial(key),
    };
    accounts.set(record.id, record);
    idsByEmail.set(key, record.id);
    return publicView(record);
  },

  /** Null for an unknown address or a wrong password — the same null, on purpose. */
  authenticate(email: string, password: string): DemoAccount | null {
    const id = idsByEmail.get(normaliseEmail(email));
    const record = id ? accounts.get(id) : undefined;
    if (!record) return null;
    const attempt = Buffer.from(hashPassword(password, record.salt), "hex");
    const stored = Buffer.from(record.hash, "hex");
    return attempt.length === stored.length && timingSafeEqual(attempt, stored) ? publicView(record) : null;
  },

  hasAccount(email: string): boolean {
    return idsByEmail.has(normaliseEmail(email));
  },

  /** Null for a missing or unknown id — which is what a restart produces. */
  get(id: string | null | undefined): StoredStudent | null {
    return id ? accounts.get(id)?.student ?? null : null;
  },

  set(id: string, next: Partial<StoredStudent>): StoredStudent {
    const record = accounts.get(id);
    if (!record) throw new Error("Not signed in");
    record.student = { ...record.student, ...next };
    return record.student;
  },

  /** Back to the seeded student, keeping the account. */
  reset(id: string): StoredStudent | null {
    const record = accounts.get(id);
    if (!record) return null;
    record.student = initial(record.email);
    return record.student;
  },

  /** How many accounts this server currently holds. For the status strip. */
  size(): number {
    return accounts.size;
  },

  /** Tests only. */
  clear(): void {
    accounts.clear();
    idsByEmail.clear();
    seedDemoLogin();
  },
};

function seedDemoLogin(): void {
  if (!idsByEmail.has(normaliseEmail(DEMO_LOGIN.email))) {
    demoStore.createAccount(DEMO_LOGIN.email, DEMO_LOGIN.password);
  }
}
seedDemoLogin();
