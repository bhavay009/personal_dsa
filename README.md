# PrepOS

A personal DSA prep tracker. Core loop: log problems, tag mistakes, get a
spaced-repetition revision queue, see a small dashboard. Plus V1: exam
countdown, a PDF library, and LeetCode import. No auth, no AI beyond the
LeetCode import's use of their public API.

**Note on process:** V1 was built before V0 had any real usage data behind
it — normally that's backwards (see "Explicitly not here" below for what's
still deliberately deferred), but it's what was asked for. Watch for
features here that turn out unused; that's exactly the risk of skipping
validation.

## Setup (first time, or on a new machine)

```bash
npm install          # also runs `prisma generate` (postinstall)
npm run db:setup     # applies migrations, creates dev.db if missing
npm run dev
```

Open http://localhost:3000 (or whatever port it prints — it auto-picks a
free one if 3000 is taken).

## Daily use

```bash
npm run dev
```

Five pages: **Dashboard** (`/`), **Problems** (`/problems`), **Revise
Today** (`/revise`), **Exams** (`/exams`), **Library** (`/library`). Add a
problem right after solving it, tag what went wrong if it wasn't clean, and
work through Revise Today when something's due — that's still the core
loop. Add exam dates as they come up; they surface on the dashboard as they
get close. Upload PDFs to the Library grouped by subject. On the Problems
page, "Import from LeetCode" pulls your last 20 accepted submissions (best
effort — see the note on that button).

## Your data

Everything lives in `dev.db` (SQLite) at the project root. It is
**gitignored on purpose** — it changes on every action and isn't meant to be
versioned like source code.

**Back it up.** There's no server, no cloud sync — if this file is lost,
your DSA history is lost. Two ways:

- Click **"Export data (JSON backup)"** at the bottom of the Dashboard,
  which downloads a full, human-readable JSON dump of every problem, exam,
  and document *metadata* (not the PDF bytes — see below).
- Or copy the raw files: `cp dev.db ~/wherever-you-sync/` and
  `cp -r storage ~/wherever-you-sync/` (uploaded PDFs live in
  `storage/pdfs/`, also gitignored, also not covered by the JSON export).

Do this occasionally — after a study session, or on whatever cadence you
trust yourself to actually do.

## How revision scheduling works

SM-2 (the classic spaced-repetition algorithm — same family as Anki).
Quality is derived from outcome + whether a mistake was tagged (Solved with
no tag → 5, Solved with a tag → 4, Partial → 2, Failed → 0), since the UI
captures those rather than asking for a raw self-rating. Ease factor,
interval, and repetition count live on `Problem`; each attempt recomputes
them and writes the next due date onto that `Attempt`. See `src/lib/db.ts`
(`computeSm2Update`, `outcomeToQuality`).

## LeetCode import

Uses LeetCode's unofficial public GraphQL endpoint (`recentAcSubmissionList`
+ a per-problem `question` lookup for difficulty/topic tags) — there is no
official public API for this. It has a 10s timeout and fails with a visible
message rather than hanging, but the endpoint can change shape or start
blocking requests at any time without notice. If it breaks, add problems
manually — nothing else in the app depends on it.

## PDF library

Files are stored on the local filesystem under `storage/pdfs/` (gitignored,
back it up manually), named by a random UUID; the original filename and a
subject/folder tag live in the `Document` table. Served back through
`/api/files/[id]`, not directly from `/public`, so nothing is exposed
without going through that route.

## Stack

Next.js (App Router) + Prisma 7 + SQLite via `@prisma/adapter-better-sqlite3`
+ Tailwind. No separate backend, no client-side state library — server
components and server actions do all the work. See the schema in
`prisma/schema.prisma`.

## Explicitly not here

Pattern-recognition trainer, interview simulators, resume/JD analysis,
internship tracker, "Ask My Notes" search over the PDF library, mock
interviews, career-readiness scoring. None of these get built until real
usage shows they're actually needed — see the product plan this was built
from.
