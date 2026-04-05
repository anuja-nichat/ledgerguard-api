import { z } from "zod";

import { InvalidJsonError, ValidationError } from "@/lib/error";

export function formatZodIssues(error: z.ZodError): unknown[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export function parseWithSchema<T>(schema: z.ZodType<T>, data: unknown, message: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ValidationError(message, formatZodIssues(parsed.error));
  }

  return parsed.data;
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  message = "Request body is invalid",
): Promise<T> {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    throw new InvalidJsonError();
  }

  return parseWithSchema(schema, rawBody, message);
}

export function parseQueryParams<T>(
  request: Request,
  schema: z.ZodType<T>,
  message = "Query parameters are invalid",
): T {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};

  for (const [key, value] of url.searchParams.entries()) {
    raw[key] = value;
  }

  return parseWithSchema(schema, raw, message);
}
