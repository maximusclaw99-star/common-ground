# Common Ground

Students land jobs through human connection, not AI-blasted applications. This ranks *people* at a
student's target companies by how strong a genuine, nameable commonality is — and asks the student
only for the facts their resume didn't already give up.

```bash
npm install
npm run dev     # http://localhost:3000 — runs in demo mode with no config at all
```

With no `.env.local`, the app runs in **demo mode**: there is no sign-in, every screen works, and a
banner says so on every page. Each browser gets its own student, keyed by a cookie the proxy sets
on the first visit, so two browsers never see each other's answers; a server restart clears them.
Copy `.env.example` to `.env.local` to turn on real accounts and persistence.

The flow is: upload a resume → answer only the questions the resume left open (about you, never
about companies) → **dashboard**, where you pick one company at a time and see who to write to
there. With Supabase configured, making an account comes first.

## The ladder

Everything keys off one ranked list of what makes a connection worth writing to, strongest first.
It lives as data in `src/lib/affinity/tiers.ts`, including the outreach guidance for each rung.

| | |
|---|---|
| ~~1~~ | ~~Warm intro from a mutual contact~~ — **out of scope** |
| 2 | Same university **and** the same organisation or programme |
| 3 | Same university **and** they already made the move you're making |
| 4 | Shared employer, client or programme |
| 5 | Same hometown, high school or local community |
| ~~6~~ | ~~Shared mutual connection~~ — **out of scope** |
| 7 | A specific shared professional interest — concrete, not a field |
| 8 | They published something you can engage with *(decays over ~30 days)* |
| 9 | Same event, class or competition *(decays over ~72 hours)* |
| 10 | Exactly one step ahead of you |
| 11 | Same function, industry or company — no personal overlap |
| 12 | Same broad interest only |
| 13 | No connection beyond wanting a job there |

Tiers 1 and 6 need a private LinkedIn connection graph. We don't collect one, so they stay in the
table as greyed rows with the reason — a better answer than a list that quietly starts at 2.

## How it fits together

```
src/lib/affinity/   the scorer. Deterministic, pure, no LLM in the hot path.
src/lib/intake/     the questionnaire. Computed from what the resume left out.
src/lib/people/     the provider seam — mock by default, Databricks with PEOPLE_PROVIDER=databricks.
databricks/         the warehouse: schema, mock people with coffee-chat hooks, matching views, Genie, loader.
src/lib/ai/         Claude: resume extraction, job matching, answer structuring, tailoring.
src/lib/ats/        Greenhouse / Lever / Ashby / Workday ingestion (tested, not yet on a page).
```

**Scoring.** Each tier owns a band of eight points; the in-band bonus tops out at seven. Because
the bonus can never cross a band, sorting by score *is* sorting by tier — asserted from the table
in `ladder.test.ts`, not hardcoded. The highest tier wins outright: the ladder orders conversation
openers, not additive evidence. You open with one hook, and the rest make that same message
warmer. Three mediocre overlaps must not beat one shared fraternity.

**The homophily scorer is the second opinion.** `src/lib/homophily/scorer.ts` is a direct port of
`DynamicHomophilyScorer`: five shared factors (past employer, organisation, academic focus,
hometown, university), each worth a weight the student sets, added up, every firing factor named.
Where the ladder asks "what is the single best opener", this asks "how much do we have in common,
all told". On a company page, "Most in common" ranks by it and shows the weights form; the person
page shows the total and its drivers. Both sides pass through the same canonicaliser first, so
"VT" and "Virginia Polytechnic" still count as one university. `scorer.test.ts` runs the reference
script's two contacts and requires 70 and 15 with the reference's exact reason strings.

**Decay** decides whether a hit *survives*, not how far it slides. A four-day-old career fair
should stop being the opener, not become a weaker one — so below the floor the hit is dropped and
the person falls to whatever tier they otherwise match.

**Companies are chosen, not asked.** The questionnaire is about the person. Which companies to go
after is picked on the dashboard, one at a time, and written to `target_companies` from there; the
company page then ranks only the people who work there (plus a short tail of strong ties elsewhere).
`src/lib/companies/registry.ts` knows ~80 employers by name, alias, sector and domain, and
`npx tsx scripts/fetch-logos.ts` vendors their logos into `public/logos/` so no page makes a
third-party image request. Unknown companies get a monogram.

**The questionnaire is computed, not static.** `computeGaps` runs the field registry against what
extraction produced and asks only for the rest. A student who lists their clubs is never asked
about clubs. Two rules carry most of the weight:

- An explicit "none" **is an answer**. Tapping *I'm not in any* writes `[]` with `source: "answer"`
  and the question never returns. Without that distinction the form nags forever.
- Questions are ordered by real demand. When someone at a target company has a hometown and the
  student doesn't, the scorer emits an `unlockable`, and the question arrives saying *"we ask
  because Elena Cruz is from Richmond."*

## Turning on accounts

Every account path is already written — sign-up, sign-in, sign-out, per-user storage, and row-level
security keyed on `auth.uid()`. What is missing is a project to point it at. Until there is one,
`isSupabaseConfigured()` is false, the sign-in pages pass straight through, and
`src/lib/session/demo-store.ts` keeps one student per browser behind the `cg_demo` cookie.

1. Create a free project at [supabase.com](https://supabase.com) (this needs your own login).
2. Run the three files in `supabase/migrations/` **in order** in the project's SQL editor, or
   `supabase db push` with the CLI. `0001` creates the tables, the owner-only RLS policies, and the
   `handle_new_user` trigger that gives every new account its `profiles` row; `0002` creates the
   private `documents` bucket; `0003` adds the questionnaire columns; `0004` adds the homophily
   weights column.
3. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from Settings → API. Set the same
   three in Vercel (Settings → Environment Variables) and redeploy.

The anon key is meant to be public — RLS is what protects the data. The service role key bypasses
RLS entirely and belongs only on the server.

Supabase confirms email addresses by default, so `signUp` returns a user with **no session** and the
form says to go and open the link. Turning that off (Authentication → Providers → Email → "Confirm
email") makes sign-up log you straight in, which is the better setting for a demo where judges make
accounts on the spot.

## Wiring up Databricks

`src/lib/people/databricks.ts` is the only file that needs to change. Set `PEOPLE_PROVIDER=databricks`
plus the three `DATABRICKS_*` variables and the UI is untouched — the engine consumes `Person`
(`src/lib/affinity/types.ts`), and a provider's whole job is producing that shape.

Before relying on it, run `coverage(people)` from `src/lib/affinity`. Tiers 8 and 9 need post and
event rows that a warehouse table may simply not carry, and that is worth knowing in advance.

Rows fetched from a provider are scored in memory and never written to Supabase. We hold no
standing database of people who never signed up — which is also why tiers 1 and 6 are out.

## Checks

```bash
npm test          # 102 tests
npm run typecheck
npm run lint
```

The ones worth knowing about:

- `ladder.test.ts` — eleven engineered people must rank exactly `[2,3,4,5,7,8,9,10,11,12,13]`, and
  a *minimum*-strength tier 2 must outscore a *maximum*-strength stack of tiers 3+4+5+7+11.
- `normalize.test.ts` — "Virginia Tech" / "VT" / "Virginia Polytechnic Institute and State
  University" collapse to one key, while UVA, Virginia Tech and VCU stay three. Richmond VA is not
  Richmond CA. Fuzzy matching is *refused* for schools: it is the most expensive error available.
- `specificity.test.ts` — "AI" scores 0.09, "responsible AI deployment for public-sector clients"
  scores 0.80, and a 30-phrase table guards the gate between them.
- `answers.test.ts` — answering every question with its skip drives `computeGaps` to zero. If that
  ever loops, a student can never finish.
- `decay.test.ts` — stubs `Date.now` to throw, proving no predicate reads the clock.

## Not built yet

The openings UI. `src/lib/ats` and `src/lib/jobs` ingest and classify roles and are tested, and
`/api/cron/poll` runs nightly, but nothing renders them — `/jobs` says so rather than showing an
empty page. Resume tailoring is deprioritised by design; `tailor-resume.ts` and
`fabrication-check.ts` exist, but `tailored_resumes.pdf_path` has no storage bucket yet.
