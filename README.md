# Care Provider Platform

Configurable engagement platform for healthcare workforce onboarding. Admins define profile types and forms via config, upload leads from any source, and run multi-step WhatsApp campaigns with automated reminders against a structured care-provider database.

## Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Backend**: Next.js server actions + API routes
- **DB**: Postgres 16 (local Docker)
- **ORM**: Prisma
- **Auth**: NextAuth with WhatsApp magic-link (Ultramsg)
- **WhatsApp**: Ultramsg (unofficial WA Web bridge)

## Prerequisites

- Node 22 (`nvm use` — `.nvmrc` is pinned)
- Docker Desktop (running)

## Quick start

```bash
nvm use
npm install
docker compose up -d        # starts Postgres on :5434 (5432/5433 are in use locally)
cp .env.example .env        # then fill in Ultramsg creds + NEXTAUTH_SECRET
npx prisma migrate dev      # creates tables
npx prisma db seed          # seeds profile types + attributes
npm run dev                 # http://localhost:3030
```

## Project structure

```
.
├── prisma/
│   ├── schema.prisma       # all entities
│   └── seed.ts             # profile types + attributes
├── src/
│   ├── app/
│   │   ├── (admin)/        # admin portal routes
│   │   ├── (public)/       # public onboarding form
│   │   └── api/            # auth + webhooks
│   ├── lib/
│   │   ├── auth.ts         # NextAuth config
│   │   ├── db.ts           # Prisma client
│   │   └── ultramsg.ts     # WhatsApp client
│   └── components/
└── docker-compose.yml
```

## Core entities

- **Attribute** — atomic data points (typed, with options + validation)
- **ProfileType** — bundles of attributes per role (NURSE, PHLEBO, GDA, CARETAKER, PHYSIO)
- **MessageTemplate** — WhatsApp copy with merge tags
- **Campaign** — orchestrates a CSV batch → invite → form → reminders
- **CareProvider** — the canonical onboarded entity, phone as natural key
- **CareProviderEvent** — append-only audit log

See `prisma/schema.prisma` for the source of truth.
