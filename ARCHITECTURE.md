# MyTrip — Architecture Rules

> This file defines the non-negotiable structure of the project.
> Every contributor (human or AI) must follow these rules.
> If a rule needs to change — update this file first, then the code.

## Stack

- **Framework:** Next.js (App Router) + TypeScript (strict mode)
- **Database + Auth:** Supabase (PostgreSQL, Row Level Security)
- **Hosting/CD:** Vercel (auto-deploy from `main`)
- **CI:** GitHub Actions (type-check + lint on every push)
- **Server state:** Server Components and Server Actions. No client data-fetching library.
- **Local UI state:** `useState` inside the component that owns it. No global store.
- **Validation:** Zod (single source of truth for types, forms, API)
- **AI provider:** Gemini, behind an abstraction layer (`src/lib/ai`)
- **UI atoms:** hand-written in `src/components/ui` + Tailwind CSS v4 (CSS-first, no config file)
- **Icons:** `lucide-react` for interface affordances; emoji for domain identity
  (a category, a booking kind, a weather code)

> **Not used, on purpose.** This section listed TanStack Query, Zustand and
> shadcn/ui until 2026-08-27. None of the three were ever installed: Server
> Components and Server Actions covered server state, and the only client state
> in the app is `useState` inside a single component. `CLAUDE.md` was corrected
> on 2026-08-12 and this file was not, so the binding document was the one
> carrying the wrong stack for two weeks. **Do not add them without a real
> need** (YAGNI).
>
> **Free services only.** Every external dependency is on a free tier with no
> card attached — OpenStreetMap/Nominatim/Overpass for places, Open-Meteo for
> weather, Gemini's free tier for AI, Vercel and Supabase hobby plans. A feature
> that requires a paid service is redesigned or dropped, never quietly added.
> This is why phone-number invitations deliver through the *owner's own*
> WhatsApp instead of an SMS gateway (see entity table below).

## Folder Structure

```
src/
├── app/                  # Routes only. Pages compose features. No business logic here.
│   └── api/              # Server-side routes (AI calls, secrets live here)
├── components/
│   ├── ui/               # Generic "atoms": Button, Input, Card. Domain-agnostic.
│   └── layout/           # App shell: header, navigation, footers
├── features/             # Each feature = a closed box
│   └── <feature>/
│       ├── domain/         # Entities, types, Zod schemas
│       ├── application/    # Use-cases, hooks
│       ├── infrastructure/ # Supabase / external provider access
│       ├── components/     # Domain-aware components (TripCard, ...)
│       └── index.ts        # The ONLY public entry point of the feature
├── lib/                  # Shared clients & utils (supabase client, ai client)
└── db/                   # Schema, migrations, RLS policies
```

## Iron Rules

1. **Feature isolation.** A feature never imports from another feature's internals — only from its `index.ts`.
2. **No direct data access in UI.** Components never call Supabase directly. All data access goes through the feature's `infrastructure/` layer.
3. **One Zod schema per entity.** TypeScript types, form validation and API validation are all derived from it.
4. **Secrets live server-side only.** API keys exist only in environment variables and are used only in `app/api` routes or server code. Never in client components, never committed to git.
5. **Breadth before depth.** New capabilities are built as a thin end-to-end slice first.
6. **A trip's phase is derived from its dates, not stored.** `tripPhase()` in
   `features/trips/domain/trip-days.ts` returns `undated | before | during | after`
   from `start_date`, `end_date` and today. The `trips.status` column remains for
   explicit user intent (archiving) and is not written by the app.
   *Changed 2026-08-12.* The stored status was never true: it was set to
   `executing` the moment an AI itinerary was saved — possibly months before
   departure — and nothing ever set `completed`. Keeping a stored status honest
   would need a scheduled job, which costs a paid service and is redundant with
   a calculation that is free. No boolean flags for status either way.
7. **`components/ui` stays dumb.** If a component knows what a "trip" is, it belongs to a feature.

## Domain Entities (initial)

| Entity | Purpose |
|---|---|
| `profiles` | User data, linked to Supabase auth |
| `trips` | Owned by one user (`user_id`). `status` is retained for explicit intent only — the trip's *phase* is derived, see rule 6 |
| `suggested_destinations` | Proposed destination per trip. Fields incl. coordinates, source (ai/manual), selected flag |
| `itinerary_items` | Selected destination scheduled in time: start, end, order |
| `trip_bookings` | Flights, trains and lodging in one table |
| `trip_gear` | The packing list. The only table the user fills in entirely by hand — nothing here is suggested, fetched or derived |
| `trip_members` | Who besides the owner can reach a trip, and at which role (`viewer` / `editor`) |
| `trip_invites` | A pending invitation: an email, a role, and an unguessable token that goes in a URL |

## Access Model

Three separate mechanisms, deliberately different from each other. Adding a
fourth, or blurring two of these, needs a decision recorded in
`PROJECT_PLAN.md` first.

| Mechanism | Who | Sees | Can write |
|---|---|---|---|
| `trips.share_token` | anyone holding the URL, no account | a **redacted** trip: no confirmation codes, no addresses, no prices | no |
| `trip_members.role = 'viewer'` | one named account | the full trip, as the owner sees it | no |
| `trip_members.role = 'editor'` | one named account | the full trip | yes, except deleting the trip |
| `trips.user_id` (owner) | the creator | everything | everything, including delete |

Two rules that hold this together:

1. **The access rule lives in the database, not in this codebase.** Every
   trip-scoped RLS policy goes through `can_view_trip()` / `can_edit_trip()` /
   `is_trip_owner()` — `SECURITY DEFINER` functions defined in migration 0018.
   A rule written in TypeScript would apply only to callers who come through
   this app, and the Supabase REST API is reachable with the anon key and a
   session. Server-side `canEditTrip()` exists for *rendering* decisions only.
2. **Identity is always an email address.** Phone numbers are a delivery
   channel: the app builds a `wa.me` / `sms:` link that opens the owner's own
   WhatsApp or Messages app with the invitation written. SMS-based identity
   would need a paid provider, which is out (see the stack note above).

## Adding a New Feature — Checklist

1. Create `src/features/<name>/` with the standard sub-folders.
2. Define the Zod schema(s) in `domain/` first.
3. Write data access in `infrastructure/`.
4. Expose only what's needed via `index.ts`.
5. Compose the UI in `app/` routes.
6. Update `PROJECT_PLAN.md`.
