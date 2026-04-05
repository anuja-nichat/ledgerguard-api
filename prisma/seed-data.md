# Seed Data Reference

This document describes the default data created by the seed script in [prisma/seed.ts](prisma/seed.ts).

## Users

The seed creates or updates three users to ensure predictable local development credentials.

| Email | Role | Status | Password |
| --- | --- | --- | --- |
| admin@finance.com | ADMIN | ACTIVE | Admin#12 |
| analyst@finance.com | ANALYST | ACTIVE | Analyst#34 |
| viewer@finance.com | VIEWER | ACTIVE | Viewer#56 |

Notes:
- Password is hashed with bcrypt before storing in the database.
- User records are created with upsert, so rerunning seed keeps email, password, role, and status aligned with defaults.

## Financial Records

The seed ensures baseline records for key users without creating duplicates on rerun.

Conditions:
- `admin@finance.com`: insert the sample record only if this user has no active records (`deletedAt = null`).
- `analyst@finance.com`: insert the sample record only if this user has no active records (`deletedAt = null`).

Sample records inserted:

| User | Type | Amount | Currency Code | Currency Symbol | Category | Date (UTC) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| admin@finance.com | INCOME | 5000 | USD | $ | Salary | 2026-03-01T00:00:00.000Z | Monthly payroll |
| analyst@finance.com | EXPENSE | 1200 | INR | ₹ | Operations | 2026-03-05T00:00:00.000Z | Vendor invoice |

## Run Seed

Use the project script:

```bash
npm run prisma:seed
```
