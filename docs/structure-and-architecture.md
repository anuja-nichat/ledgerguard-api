# Backend Structure and Architecture

For this project, the backend uses a **3-Tier Architecture** with a NestJS modular API runtime. This separation of concerns keeps the codebase clean, makes it easier to write tests, and ensures business rules are strictly enforced.

## 1. Core Architectural Layers

- **Route/Controller Layer (`src/nest/**`)**: Receives HTTP requests, applies auth context and middleware, and maps responses. Business logic stays out of this layer.
- **Service Layer (`src/services/`)**: The core "brain" of the application. This layer handles Role-Based Access Control (RBAC) checks, business logic, and heavy calculations (like dashboard summaries and trends).
- **Data Layer (`src/data/`)**: Implements the Repository pattern. All database queries using Prisma are isolated here. If the database schema changes, we only need to update the repositories, not the services on top of them.

## 2. Folder Structure Overview

Here is a quick look at where everything lives:

```text
├── prisma/                # Database schema, migrations, and seed data
│   └── schema.prisma      # Single source of truth for DB tables
├── src/
│   ├── constants/         # Shared constants (error codes, roles)
│   ├── data/              # Repositories for DB access
│   ├── lib/               # Utility functions (auth, error formatting, RBAC)
│   ├── middleware/        # Reusable auth and role checks
│   ├── nest/              # NestJS controllers, guards, filters, interceptors
│   ├── services/          # Core business logic layer
│   └── types/             # TypeScript interfaces and types
├── tests/                 # Unit and integration tests (Jest)
└── docs/                  # Project documentation
```

## 3. Request Flow Example

When a user requests their dashboard summary, the flow looks like this:
1. **Request**: Hits `src/nest/dashboard/dashboard.controller.ts` route method for `/api/dashboard/summary`.
2. **Guard/Auth Context**: `AuthContextGuard` extracts the Bearer token, validates it, and blocks inactive users before adding `authContext` to the request.
3. **Route handler**: Calls `getDashboardSummaryForContext(...)` from the dashboard service layer.
4. **Service**: Enforces RBAC and query validation, then calls data-layer aggregation functions (`aggregateTotalsByType` and `aggregateCategoryTotals`) for raw totals.
5. **Logic**: The Service computes summary values, category totals, and currency conversions for the target currency.
6. **Response**: The controller returns service data, and the global `ResponseEnvelopeInterceptor` wraps it in the standard success envelope.
