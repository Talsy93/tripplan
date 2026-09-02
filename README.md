# MyTrip

A trip planner in Hebrew (RTL): pick destinations, get AI suggestions for what to
do in each city, and turn the result into a day-by-day itinerary that knows which
city you sleep in and when your flight lands.

Built as a working application and as a portfolio piece — Clean Architecture,
TypeScript strict, CI on every push, and every architectural decision written
down at the point it was made.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Data + Auth | Supabase — PostgreSQL, Row Level Security |
| Styling | Tailwind CSS v4 (CSS-first, no config file), hand-written UI primitives |
| Validation | Zod — one schema per entity, types and forms derived from it |
| AI | Gemini, behind an abstraction layer (`src/lib/ai`) |
| Maps | Leaflet + OpenStreetMap; places from Overpass, geocoding from Nominatim |
| Weather | Open-Meteo |
| Hosting | Vercel (auto-deploy from `main`) · CI: GitHub Actions |

**Every external service is on a free tier with no card attached.** That is a
hard constraint, not a coincidence: a feature that would need a paid service gets
redesigned or dropped. It is why invitations are delivered through the sender's
own WhatsApp rather than an SMS gateway, and why a trip's phase is computed from
its dates instead of being kept accurate by a scheduled job.

## Running it

```bash
npm install
npm run dev
```

Requires a `.env.local` with the Supabase URL and anon key, a Gemini API key, and
(for the public share page) the Supabase service-role key. Nothing secret is read
outside `src/app/api` and server-side code.

```bash
npm run type-check   # tsc --noEmit
npm run lint         # eslint
npm run build        # the only check that catches circular imports — see below
```

## Layout

```
src/
├── app/          # routes only; pages compose features
│   └── api/      # server-side routes — API keys live here and nowhere else
├── components/
│   ├── ui/       # domain-agnostic primitives: Button, Card, Dialog, ListRow
│   └── layout/   # the app shell: header, bottom nav, sidebar
├── features/     # each feature is a closed box
│   └── <name>/
│       ├── domain/          # Zod schemas, types, pure functions
│       ├── application/     # Server Actions
│       ├── infrastructure/  # Supabase and external providers
│       ├── components/      # domain-aware components
│       └── index.ts         # the feature's only public entry point
├── lib/          # shared clients and utils
└── db/           # schema and migrations, applied by hand in the SQL editor
```

The rules that keep this shape are in [`ARCHITECTURE.md`](ARCHITECTURE.md) and
they are binding. [`PROJECT_PLAN.md`](PROJECT_PLAN.md) is the state of the
project plus a decision log; [`HANDOFF.md`](HANDOFF.md) is a rolling snapshot for
picking the work back up.

## Things worth knowing before changing anything

These each cost real debugging time. The full versions, with the symptoms that
led to them, are in `HANDOFF.md`.

- **`npm run build` is the only check that catches a circular import.** Type-check
  and lint both pass on one; the build fails with a `ReferenceError` in an
  unrelated third file.
- **`next build` and `next dev` share `.next`.** Delete the directory between
  them, or `npm run dev` produces a cascade of `Module not found`.
- **`datetime-local` and `timestamptz` are different data types.** Every
  conversion goes through `src/lib/datetime.ts` and states its zone. A bare
  `toLocaleString` gives a different answer to every reader.
- **A Supabase `update`/`delete` that matched zero rows is reported as success.**
  Check `count`, or use `upsert`. A silent write failure looks exactly like a
  read bug.
- **`truncate` on a flex child needs `min-w-0`, and `min-w-0` alone is not
  enough** if the text has no break opportunity — `break-words` does not reduce
  an element's min-content width, only `wrap-anywhere` does.
- **The Gemini free tier is 20 requests/minute for the whole project.** Do not
  run real AI calls casually.
- **Migrations are applied by hand** in the Supabase SQL editor, in order. They
  are idempotent except `0016`, which guards itself with an
  `applied_migrations` table. **`src/db/check_migrations.sql` reports which of
  them a database actually has** — nothing else does, because only 0016 records
  itself.
