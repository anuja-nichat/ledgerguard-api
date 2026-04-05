# Tech Stack & Decisions

A quick breakdown of the core technologies used in the backend and the practical reasons for choosing them for this project.

| Technology | Role | Why It Was Chosen |
|---|---|---|
| **NestJS** | Backend Framework | Gives us a backend-first architecture with controllers, guards, and middleware that maps cleanly to auth, RBAC, and service layering. |
| **TypeScript** | Programming Language | Catches errors before runtime. Having strict types is essential for an app handling financial calculations. |
| **PostgreSQL** | Database | A highly reliable relational database. Perfect for strict data modeling like financial records, roles, and immutable audit logs. |
| **Prisma** | ORM (Object-Relational Mapper) | Provides type-safe DB queries and simple migrations. Saved hours of debugging raw SQL and integrated perfectly with TypeScript. |
| **JWT** | Authentication | Stateless and fast. Makes it easy to securely pass user roles (Viewer, Analyst, Admin) in the token payload without hitting the database every time. |
| **Zod** | Data Validation | Bulletproof validation for incoming requests. Ensures we never accidentally save invalid currency codes or missing fields to the database. |
| **Docker** | Infrastructure | Used via Docker Compose to run Postgres locally. Makes project setup painless—just run one command instead of installing database software manually. |
| **Jest** | Testing Framework | Mature and widely adopted for backend unit testing with strong mocking utilities and stable CI behavior. |
| **Swagger/OpenAPI**| API Documentation | Provides a clean, interactive UI (`/api/docs`) for anyone to understand and test the endpoints easily. |
