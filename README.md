# LedgerGuard API

Finance Data Processing and Access Control Backend.

## Tech Stack
- NestJS (primary backend runtime)
- PostgreSQL (Docker Compose)
- Prisma ORM
- JWT auth
- Swagger UI and OpenAPI docs (`/api/docs`, `/api/docs/openapi`)
- Jest

## What Is Implemented
- JWT login and token validation
- User management with role and status control
- Financial records CRUD with filtering and validation
- Financial record recycle bin with restore and 30-day retention
- Per-record currency support (currency code and symbol)
- Currency-aware dashboard summary and trends with target currency conversion (INR/USD)
- API rate limiting with standard per-IP windows
- Immutable audit trail for create, update, role change, and delete actions
- Dashboard summary, recent activity, and trends
- Consistent API response envelope and error handling

## Why I Chose NestJS for Backend Runtime
- This project is backend-focused, so NestJS gives a clearer API architecture with controllers, guards, middleware, and modules.
- It keeps business logic and transport boundaries explicit, which fits RBAC-heavy finance endpoints better as the project grows.
- The API runtime is fully served by Nest controllers under `src/nest/**`.

## Tradeoffs I Made
- **Soft delete vs hard delete**: I used soft delete (`deletedAt`) for financial records so restore and auditability remain possible.
- **JWT expiry policy**: I set token expiry to 15 minutes to balance security with usability for demo and local testing.
- **Rate-limit policy**: I used stricter limits for login (`5 requests / 15 min`) and a standard global API window (`100 requests / 15 min`) to reduce abuse while keeping normal usage smooth.
- **Architecture boundary**: I kept a modular monolith (route/service/repository) instead of splitting microservices to keep complexity and delivery time under control.
- **Write access model**: I limited write operations on financial records to admin, while viewer and analyst stay read-focused.
- **Currency model choice**: I stored `currencyCode` and `currencySymbol` per financial record so multi-currency data is explicit, and I default to `INR` and `₹` when omitted.
- **Currency conversion scope**: Dashboard conversion is currently implemented for `INR` and `USD`, with configured rate `1 USD = 92.74 INR`.
- **Recycle bin policy**: I set recycle-bin retention to 30 days so admins can recover deleted records during that window.
- **Purge strategy**: I allow both automatic purge of expired recycled records during financial-record API operations and manual purge through the recycle-bin delete endpoint.
- **Swagger hosting approach**: I serve Swagger UI from `/api/docs` with OpenAPI JSON from `/api/docs/openapi` so docs stay directly tied to runtime.
- **Auth scope choice**: I kept JWT auth stateless and did not add refresh-token rotation to keep assignment complexity controlled.

## Local Setup
1. Install dependencies.
2. Create `.env` from `.env.example`.
3. Start PostgreSQL with Docker.
4. Run Prisma migration and generate client.
5. Seed sample data.
6. Start development server.

## Quick Start Commands
```bash
npm install
npm run db:up
npm run prisma:migrate -- --name init
npm run prisma:generate
npm run prisma:seed
npm run dev
```

## Useful Commands
- Start database runtime: `npm run db:up`
- Stop database runtime: `npm run db:down`
- Full local DB initialization: `npm run db:setup`
- Full project verification: `npm run check`

## Project Run Commands

Use these command sets for common local workflows.

### 1) Run API in Development (recommended)
```bash
npm install
npm run db:up
npm run prisma:migrate -- --name init
npm run prisma:generate
npm run prisma:seed
npm run dev
```

### 2) Run API (single start command)
```bash
npm run start
```

### 3) One-command DB bootstrap
```bash
npm run db:setup
```

### 4) Open Prisma Studio
```bash
npm run prisma:studio
```
Then open: `http://localhost:5555`

### 5) Run quality checks
```bash
npm run lint
npm run test
npm run build
```

### 6) Run all checks in one command
```bash
npm run check
```

## Seed Data
- See [prisma/seed-data.md](prisma/seed-data.md) for seeded users, default credentials, and sample financial records.

## API Documentation
- `GET /api/docs` (Swagger UI)
- `GET /api/docs/openapi` (OpenAPI JSON)

## Current Endpoints
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/validate`
- `GET /api/audit-logs` (admin only)
- `GET|POST /api/users`
- `GET|PATCH|DELETE /api/users/:id`
- `POST /api/users/:id/roles`
- `GET|POST /api/financial-records`
- `GET|PATCH|DELETE /api/financial-records/:id`
- `GET|DELETE /api/financial-records/recycle-bin`
- `POST /api/financial-records/recycle-bin/:id/restore`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/recent-activity`
- `GET /api/dashboard/trends`

## Implementation Notes
- API contracts are documented and kept in sync through this README and the OpenAPI spec exposed at `/api/docs/openapi`.
- Datetime values are intended to be handled in UTC throughout service and aggregation logic.
- PostgreSQL host port defaults to `5433` to avoid collisions on machines already using `5432`.
- Rate limits are applied at middleware level (`/api/*`): login is 5 requests per 15 minutes per IP, other API routes are 100 requests per 15 minutes per IP.
- Audit logs capture actor identity and before/after snapshots for user and financial record write operations.
- `GET /api/financial-records` supports `currencyCode` filter as `INR` or `USD`.
- `GET /api/dashboard/summary` and `GET /api/dashboard/trends` support `currencyCode` (source filter) and `targetCurrencyCode` (output currency) for `INR`/`USD` conversions.

