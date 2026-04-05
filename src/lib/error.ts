import { ERROR_CODES, type ErrorCode } from "@/constants/error-codes";

type HttpErrorInput = {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: unknown[];
};

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details: unknown[];

  constructor({ statusCode, code, message, details = [] }: HttpErrorInput) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, details: unknown[] = []) {
    super({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message,
      details,
    });
  }
}

export class InvalidJsonError extends HttpError {
  constructor(message = "Request body must be valid JSON") {
    super({
      statusCode: 400,
      code: ERROR_CODES.INVALID_JSON,
      message,
    });
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Authentication is required") {
    super({
      statusCode: 401,
      code: ERROR_CODES.INVALID_TOKEN,
      message,
    });
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "You do not have permission to access this resource") {
    super({
      statusCode: 403,
      code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      message,
    });
  }
}

export class InactiveUserError extends HttpError {
  constructor(message = "User account is inactive") {
    super({
      statusCode: 403,
      code: ERROR_CODES.USER_INACTIVE,
      message,
    });
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "The requested resource was not found") {
    super({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message,
    });
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict with current resource state") {
    super({
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
      message,
    });
  }
}

export class BusinessRuleError extends HttpError {
  constructor(message = "The requested operation is not allowed", details: unknown[] = []) {
    super({
      statusCode: 422,
      code: ERROR_CODES.INVALID_OPERATION,
      message,
      details,
    });
  }
}
