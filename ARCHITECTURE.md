# TripPlan — Architecture Rules

> This file defines the non-negotiable structure of the project.
> Every contributor (human or AI) must follow these rules.
> If a rule needs to change — update this file first, then the code.

## Stack

- **Framework:** Next.js (App Router) + TypeScript (strict mode)
- **Database + Auth:** Supabase (PostgreSQL, Row Level Security)
- **Hosting/CD:** Vercel (auto-deploy from `main`)
- **CI:** GitHub Actions (type-check + lint on every push)
- **Server state:** TanStack Query
- **Local UI state:** Zustand
- **Validation:** Zod (single source of truth for types, forms, API)
- **AI provider:** Gemini, behind an abstraction layer (`src/lib/ai`)
- **UI atoms:** shadcn/ui + Tailwind CSS

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
6. **Trips are a state machine.** `planning → executing → completed`. No boolean flags for status.
7. **`components/ui` stays dumb.** If a component knows what a "trip" is, it belongs to a feature.

## Domain Entities (initial)

| Entity | Purpose |
|---|---|
| `profiles` | User data, linked to Supabase auth |
| `trips` | Belongs to a user. Has `status` (state machine) |
| `suggested_destinations` | Proposed destination per trip. Fields incl. coordinates, source (ai/manual), selected flag |
| `itinerary_items` | Selected destination scheduled in time: start, end, order |

## Adding a New Feature — Checklist

1. Create `src/features/<name>/` with the standard sub-folders.
2. Define the Zod schema(s) in `domain/` first.
3. Write data access in `infrastructure/`.
4. Expose only what's needed via `index.ts`.
5. Compose the UI in `app/` routes.
6. Update `PROJECT_PLAN.md`.
