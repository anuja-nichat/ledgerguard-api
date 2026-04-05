# LedgerGuard API

Finance data processing and access-control backend built with NestJS.

## Overview

LedgerGuard provides authenticated APIs for user administration, financial record management, dashboard analytics, and immutable audit logging.

## Tech Stack

- NestJS
- TypeScript
- PostgreSQL (Docker Compose)
- Prisma ORM
- JWT authentication
- Swagger UI + OpenAPI ([/api/docs](http://localhost:3001/api/docs), [/api/docs/openapi](http://localhost:3001/api/docs/openapi))
- Jest

## Core Features

- JWT login and token validation
- Role-based access control for `viewer`, `analyst`, and `admin`
- Active/inactive user gating on authenticated routes
- User CRUD and role assignment
- Financial records CRUD with validation and filters
- Financial records recycle bin with restore and 30-day retention
- Dashboard summary, recent activity, and trends
- Currency-aware dashboard conversion for INR/USD
- Immutable audit logs for user and financial-record write operations
- Global response envelope, error mapping, and API rate limiting

## Architecture

- Route layer: Nest controllers in `src/nest/**`
- Service layer: business logic in `src/services/**`
- Data layer: Prisma repositories in `src/data/**`

## Project Documentation

- [Implementation Phases](docs/implementation-phases.md)
- [Backend Structure and Architecture](docs/structure-and-architecture.md)
- [Tech Stack and Decisions](docs/tech-stack.md)
- [Seed Data Reference](prisma/seed-data.md)

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop

## Quick Start

1. Install dependencies.
2. Create `.env` from `.env.example`.
3. Start PostgreSQL.
4. Run migrations, generate Prisma client, and seed data.
5. Start the development server.

```bash
npm install
npm run db:up
npm run prisma:migrate -- --name init
npm run prisma:generate
npm run prisma:seed
npm run dev
```

After startup:

- API base URL: `http://localhost:3001/api`
- Swagger UI: `http://localhost:3001/api/docs`
- OpenAPI JSON: `http://localhost:3001/api/docs/openapi`

## Command Reference

| Task | Command |
| --- | --- |
| Start dev server | `npm run dev` |
| Start server once | `npm run start` |
| Build type-check | `npm run build` |
| Lint | `npm run lint` |
| Run tests | `npm run test` |
| Run integration test suite | `npm run test:integration` |
| Run full checks | `npm run check` |
| Start DB | `npm run db:up` |
| Stop DB | `npm run db:down` |
| Full DB setup (up + migrate + generate + seed) | `npm run db:setup` |
| Prisma client generate | `npm run prisma:generate` |
| Prisma migration | `npm run prisma:migrate -- --name <migration-name>` |
| Seed data | `npm run prisma:seed` |
| Open Prisma Studio | `npm run prisma:studio` |

## API Endpoints

### Health and Auth

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/validate`

### Users

- `GET|POST /api/users`
- `GET|PATCH|DELETE /api/users/:id`
- `POST /api/users/:id/roles`

### Financial Records

- `GET|POST /api/financial-records`
- `GET|PATCH|DELETE /api/financial-records/:id`
- `GET|DELETE /api/financial-records/recycle-bin`
- `POST /api/financial-records/recycle-bin/:id/restore`

### Dashboard

- `GET /api/dashboard/summary`
- `GET /api/dashboard/recent-activity`
- `GET /api/dashboard/trends`

### Audit Logs

- `GET /api/audit-logs` (admin only)

## Seed Data

See [prisma/seed-data.md](prisma/seed-data.md) for default users, credentials, and baseline financial records.

## Notes and Tradeoffs

- Financial records use soft delete (`deletedAt`) to preserve recovery and auditability.
- Recycle-bin retention is 30 days.
- Login rate limit is 5 requests per 15 minutes per IP.
- Standard API rate limit is 100 requests per 15 minutes per IP.
- Dashboard conversion currently supports INR and USD with configured rate `1 USD = 92.74 INR`.
- Datetime handling is normalized to UTC for storage and aggregation.

