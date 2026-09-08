# PrepOS

A personal DSA prep tracker. V0 scope only: log problems, tag mistakes, get a
deterministic revision queue, see a 4-number dashboard. No auth, no AI, no
PDF library — those are deferred until V0 proves itself over two weeks of
real use.

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

Three pages: **Dashboard** (`/`), **Problems** (`/problems`), **Revise
Today** (`/revise`). Add a problem right after solving it, tag what went
wrong if it wasn't clean, and work through Revise Today when something's
due. That's the whole loop.

## Your data

Everything lives in `dev.db` (SQLite) at the project root. It is
**gitignored on purpose** — it changes on every action and isn't meant to be
versioned like source code.

**Back it up.** There's no server, no cloud sync — if this file is lost,
your DSA history is lost. Two ways:

- Click **"Export data (JSON backup)"** at the bottom of the Dashboard,
  which downloads a full, human-readable JSON dump of every problem and
  attempt.
- Or just copy the raw file: `cp dev.db ~/wherever-you-sync/prepos-backup.db`

Do this occasionally — after a study session, or on whatever cadence you
trust yourself to actually do.

## How revision scheduling works

Fixed schedule, no ML: `1 → 3 → 7 → 14 → 30` days. Solving a problem again
advances one stage; failing or a partial resets to stage 0 (due again
tomorrow). See `src/lib/db.ts` (`computeNextRevision`).

## Stack

Next.js (App Router) + Prisma 7 + SQLite via `@prisma/adapter-better-sqlite3`
+ Tailwind. No separate backend, no client-side state library — server
components and server actions do all the work. See the schema in
`prisma/schema.prisma`.

## Explicitly not here (V0 discipline)

LeetCode import, PDF library, exam tracking, adaptive spaced repetition,
pattern-recognition trainer, interview simulators, resume/JD analysis,
internship tracker. None of these get built until real usage of the above
shows they're actually needed — see the product plan this was built from.
