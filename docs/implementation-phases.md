# Implementation Summary

This file tracks what is currently implemented in the backend.

## Architecture
- Route handlers are implemented as Nest controllers under `src/nest/**` and bootstrapped from `src/main.ts`.
- Service modules in `src/services/**` contain business logic.
- Data access stays in Prisma-backed repositories under `src/data/**`.

## Runtime Coverage
- The backend is implemented with NestJS as the primary runtime.
- Implemented and verified endpoints include: `GET /api/health`, `POST /api/auth/login`, `GET /api/auth/validate`, all `users` endpoints, `GET /api/audit-logs`, all `financial-records` plus recycle-bin endpoints, and all `dashboard` endpoints.
- Global Nest response envelope, error filter, and rate-limit middleware are active to preserve API behavior, with docs routes excluded from envelope wrapping.

## Authentication and Access Control
- JWT-based login and bearer token validation are implemented.
- Active/inactive user status is enforced for authenticated requests.
- Role checks are centralized for `viewer`, `analyst`, and `admin`.

## API Features
- User APIs support create, list, read, update, delete, and role assignment.
- Financial record APIs support create, list, read, update, and soft delete.
- Financial record listing supports `currencyCode` filter with `INR` and `USD` options.
- Financial record recycle-bin APIs support listing deleted records, restoring by id, and purging expired records.
- Dashboard APIs support summary totals, recent activity, and trend insights.
- Dashboard summary and trends support `currencyCode` source filtering and `targetCurrencyCode` output conversion for `INR` and `USD`.
- Admin audit-log API supports filtered, paginated viewing of audit events.

## Security and Reliability
- API rate limiting is applied globally for `/api/*` with a stricter policy for login routes.
- Immutable audit trail capture is implemented for user and financial-record write operations.
- Audit entries include actor metadata and before/after snapshots for traceability.

## Validation and Error Handling
- Request body and query validation is handled with Zod.
- Currency filters for list records and dashboard conversion params are validated and normalized at API boundaries.
- API errors use a consistent envelope and mapped HTTP status codes.

## Runtime and Tooling
- Docker Compose is used for local PostgreSQL.
- Prisma migration, generate, and seed scripts are available via npm scripts.
- OpenAPI JSON and Swagger UI are available at `/api/docs/openapi` and `/api/docs`.

## Tests
- RBAC behavior tests.
- Auth active/inactive gating tests.
- Financial records validation tests.
- Dashboard summary and trends math tests, including INR/USD conversion checks.
- Rate-limit policy tests.
- Audit-trail tests for user and financial-record write paths.
- Admin audit-log listing service tests.
