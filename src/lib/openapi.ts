type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string }>;
  tags: Array<{
    name: string;
    description: string;
  }>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
  paths: Record<string, unknown>;
};

const HTTP_OPERATION_KEYS = new Set(["get", "post", "patch", "put", "delete", "options", "head"]);

const baseOpenApiDocument: Omit<OpenApiDocument, "servers"> = {
  openapi: "3.0.3",
  info: {
    title: "LedgerGuard API",
    version: "1.0.0",
    description: "Finance Data Processing and Access Control Backend",
  },
  tags: [
    { name: "system", description: "System and runtime metadata" },
    { name: "auth", description: "Authentication and session validation" },
    { name: "audit-logs", description: "Immutable audit trail queries" },
    { name: "users", description: "User lifecycle and role management" },
    { name: "financial-records", description: "Financial records CRUD and filtering" },
    { name: "dashboard", description: "Dashboard summary and insight endpoints" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ErrorEnvelope: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "Request body is invalid" },
              details: {
                type: "array",
                items: { type: "object" },
              },
            },
            required: ["code", "message", "details"],
          },
        },
        required: ["success", "error"],
      },
    },
  },
  paths: {
    "/api": {
      get: {
        tags: ["system"],
        summary: "API root metadata",
        responses: {
          "200": { description: "API base metadata returned" },
        },
      },
    },
    "/api/health": {
      get: {
        tags: ["system"],
        summary: "Health check",
        responses: {
          "200": { description: "Service is healthy" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["auth"],
        summary: "Authenticate user and issue JWT",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Login succeeded" },
          "400": { description: "Invalid payload" },
          "401": { description: "Invalid credentials" },
          "403": { description: "Inactive user" },
        },
      },
    },
    "/api/auth/validate": {
      get: {
        tags: ["auth"],
        summary: "Validate bearer token",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Token is valid" },
          "401": { description: "Token invalid or missing" },
          "403": { description: "Inactive user" },
        },
      },
    },
    "/api/audit-logs": {
      get: {
        tags: ["audit-logs"],
        summary: "List immutable audit logs (admin only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: "action",
            in: "query",
            schema: { type: "string", enum: ["CREATE", "UPDATE", "DELETE", "ROLE_CHANGE"] },
          },
          {
            name: "resource",
            in: "query",
            schema: { type: "string", enum: ["USER", "FINANCIAL_RECORD"] },
          },
          { name: "actorUserId", in: "query", schema: { type: "string", minLength: 1, maxLength: 100 } },
          { name: "resourceId", in: "query", schema: { type: "string", minLength: 1, maxLength: 100 } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } },
        ],
        responses: {
          "200": { description: "Audit logs returned" },
          "400": { description: "Invalid query" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/api/users": {
      get: {
        tags: ["users"],
        summary: "List users (admin only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          { name: "role", in: "query", schema: { type: "string", enum: ["VIEWER", "ANALYST", "ADMIN"] } },
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "INACTIVE"] } },
        ],
        responses: {
          "200": { description: "Users returned" },
          "403": { description: "Forbidden" },
        },
      },
      post: {
        tags: ["users"],
        summary: "Create user (admin only)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  role: { type: "string", enum: ["VIEWER", "ANALYST", "ADMIN"], default: "VIEWER" },
                  status: { type: "string", enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          "201": { description: "User created" },
          "400": { description: "Invalid payload" },
          "409": { description: "User email conflict" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/api/users/{id}": {
      get: {
        tags: ["users"],
        summary: "Get a user by id",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "User returned" },
          "403": { description: "Forbidden" },
          "404": { description: "User not found" },
        },
      },
      patch: {
        tags: ["users"],
        summary: "Update a user (admin only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  role: { type: "string", enum: ["VIEWER", "ANALYST", "ADMIN"] },
                  status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "User updated" },
          "400": { description: "Invalid payload" },
          "403": { description: "Forbidden" },
          "404": { description: "User not found" },
          "422": { description: "Invalid business operation" },
        },
      },
      delete: {
        tags: ["users"],
        summary: "Delete a user (admin only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "204": { description: "User deleted" },
          "403": { description: "Forbidden" },
          "404": { description: "User not found" },
          "422": { description: "Invalid business operation" },
        },
      },
    },
    "/api/users/{id}/roles": {
      post: {
        tags: ["users"],
        summary: "Assign role to user (admin only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  role: { type: "string", enum: ["VIEWER", "ANALYST", "ADMIN"] },
                },
                required: ["role"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Role updated" },
          "400": { description: "Invalid payload" },
          "403": { description: "Forbidden" },
          "404": { description: "User not found" },
          "422": { description: "Invalid business operation" },
        },
      },
    },
    "/api/financial-records": {
      get: {
        tags: ["financial-records"],
        summary: "List financial records",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          { name: "type", in: "query", schema: { type: "string", enum: ["INCOME", "EXPENSE"] } },
          {
            name: "currencyCode",
            in: "query",
            schema: { type: "string", enum: ["INR", "USD"], example: "INR" },
          },
          { name: "category", in: "query", schema: { type: "string", minLength: 1, maxLength: 80 } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "userId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Records returned" },
          "400": { description: "Invalid query" },
          "403": { description: "Forbidden" },
        },
      },
      post: {
        tags: ["financial-records"],
        summary: "Create financial record (admin only)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["INCOME", "EXPENSE"] },
                  amount: { type: "number", minimum: 0.01 },
                  currencyCode: {
                    type: "string",
                    pattern: "^[A-Z]{3}$",
                    default: "INR",
                    example: "INR",
                  },
                  currencySymbol: {
                    type: "string",
                    minLength: 1,
                    maxLength: 8,
                    default: "₹",
                    example: "₹",
                  },
                  category: { type: "string", minLength: 1, maxLength: 80 },
                  date: { type: "string", format: "date-time" },
                  notes: { type: "string", maxLength: 500 },
                  userId: { type: "string" },
                },
                required: ["type", "amount", "category", "date"],
              },
            },
          },
        },
        responses: {
          "201": { description: "Record created" },
          "400": { description: "Invalid payload" },
          "403": { description: "Forbidden" },
          "404": { description: "Target user not found" },
          "422": { description: "Invalid business operation" },
        },
      },
    },
    "/api/financial-records/{id}": {
      get: {
        tags: ["financial-records"],
        summary: "Get financial record by id",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Record returned" },
          "403": { description: "Forbidden" },
          "404": { description: "Record not found" },
        },
      },
      patch: {
        tags: ["financial-records"],
        summary: "Update financial record (admin only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["INCOME", "EXPENSE"] },
                  amount: { type: "number", minimum: 0.01 },
                  currencyCode: {
                    type: "string",
                    pattern: "^[A-Z]{3}$",
                    default: "INR",
                    example: "INR",
                  },
                  currencySymbol: {
                    type: "string",
                    minLength: 1,
                    maxLength: 8,
                    default: "₹",
                    example: "₹",
                  },
                  category: { type: "string", minLength: 1, maxLength: 80 },
                  date: { type: "string", format: "date-time" },
                  notes: { type: "string", maxLength: 500 },
                  userId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Record updated" },
          "400": { description: "Invalid payload" },
          "403": { description: "Forbidden" },
          "404": { description: "Record not found" },
          "422": { description: "Invalid business operation" },
        },
      },
      delete: {
        tags: ["financial-records"],
        summary: "Move financial record to recycle bin (admin only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "204": { description: "Record deleted" },
          "403": { description: "Forbidden" },
          "404": { description: "Record not found" },
        },
      },
    },
    "/api/financial-records/recycle-bin": {
      get: {
        tags: ["financial-records"],
        summary: "List recycled financial records (admin only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          { name: "userId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Recycle bin records returned" },
          "400": { description: "Invalid query" },
          "403": { description: "Forbidden" },
        },
      },
      delete: {
        tags: ["financial-records"],
        summary: "Purge expired recycle bin records (admin only)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Expired recycled records purged" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/api/financial-records/recycle-bin/{id}/restore": {
      post: {
        tags: ["financial-records"],
        summary: "Restore financial record from recycle bin (admin only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Financial record restored" },
          "403": { description: "Forbidden" },
          "404": { description: "Record not found in recycle bin" },
        },
      },
    },
    "/api/dashboard/summary": {
      get: {
        tags: ["dashboard"],
        summary: "Get dashboard summary totals in a target currency",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "userId", in: "query", schema: { type: "string" } },
          {
            name: "currencyCode",
            in: "query",
            schema: { type: "string", enum: ["INR", "USD"] },
          },
          {
            name: "targetCurrencyCode",
            in: "query",
            schema: { type: "string", enum: ["INR", "USD"], default: "INR" },
          },
        ],
        responses: {
          "200": { description: "Summary returned" },
          "400": { description: "Invalid query" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/api/dashboard/recent-activity": {
      get: {
        tags: ["dashboard"],
        summary: "Get recent financial activity",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "userId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Recent activity returned" },
          "400": { description: "Invalid query" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/api/dashboard/trends": {
      get: {
        tags: ["dashboard"],
        summary: "Get month-wise trend insight via a single dropdown selection",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "selection",
            in: "query",
            schema: {
              type: "string",
              enum: ["overall", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"],
              default: "overall",
            },
          },
          { name: "userId", in: "query", schema: { type: "string" } },
          {
            name: "currencyCode",
            in: "query",
            schema: { type: "string", enum: ["INR", "USD"] },
          },
          {
            name: "targetCurrencyCode",
            in: "query",
            schema: { type: "string", enum: ["INR", "USD"], default: "INR" },
          },
        ],
        responses: {
          "200": { description: "Trends returned" },
          "400": { description: "Invalid query" },
          "403": { description: "Forbidden" },
        },
      },
    },
  },
};

export function getServerUrlFromRequest(request: Request) {
  const requestUrl = new URL(request.url);
  return `${requestUrl.protocol}//${requestUrl.host}`;
}

function cloneBaseDocument(): Omit<OpenApiDocument, "servers"> {
  return JSON.parse(JSON.stringify(baseOpenApiDocument)) as Omit<OpenApiDocument, "servers">;
}

function addRateLimitResponses(document: OpenApiDocument) {
  for (const [path, pathItem] of Object.entries(document.paths)) {
    if (path === "/api/health") {
      continue;
    }

    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    for (const [method, operationValue] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!HTTP_OPERATION_KEYS.has(method)) {
        continue;
      }

      if (!operationValue || typeof operationValue !== "object") {
        continue;
      }

      const operation = operationValue as {
        responses?: Record<string, unknown>;
      };

      operation.responses = operation.responses ?? {};
      if (!operation.responses["429"]) {
        operation.responses["429"] = { description: "Too many requests" };
      }
    }
  }
}

export function getOpenApiDocument(serverUrl: string): OpenApiDocument {
  const document: OpenApiDocument = {
    ...cloneBaseDocument(),
    servers: [{ url: serverUrl }],
  };

  addRateLimitResponses(document);
  return document;
}
