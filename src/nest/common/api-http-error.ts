import { ERROR_CODES, type ErrorCode } from "../../constants/error-codes";

type ApiHttpErrorInput = {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: unknown[];
};

export class ApiHttpError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details: unknown[];

  constructor({ statusCode, code, message, details = [] }: ApiHttpErrorInput) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ApiValidationError extends ApiHttpError {
  constructor(message = "Request body is invalid", details: unknown[] = []) {
    super({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message,
      details,
    });
  }
}

export class ApiInvalidJsonError extends ApiHttpError {
  constructor(message = "Request body must be valid JSON") {
    super({
      statusCode: 400,
      code: ERROR_CODES.INVALID_JSON,
      message,
    });
  }
}

export class ApiUnauthorizedError extends ApiHttpError {
  constructor(message = "Authentication is required") {
    super({
      statusCode: 401,
      code: ERROR_CODES.INVALID_TOKEN,
      message,
    });
  }
}

export class ApiForbiddenError extends ApiHttpError {
  constructor(message = "You do not have permission to access this resource") {
    super({
      statusCode: 403,
      code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      message,
    });
  }
}

export class ApiInactiveUserError extends ApiHttpError {
  constructor(message = "User account is inactive") {
    super({
      statusCode: 403,
      code: ERROR_CODES.USER_INACTIVE,
      message,
    });
  }
}