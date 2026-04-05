import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";

import { ERROR_CODES, type ErrorCode } from "../../constants/error-codes";
import { HttpError as LegacyHttpError } from "../../lib/error";
import { ApiHttpError, ApiInvalidJsonError, ApiValidationError } from "./api-http-error";

function formatZodIssues(error: ZodError): unknown[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

function extractHttpExceptionMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const typedPayload = payload as Record<string, unknown>;
    if (typeof typedPayload.message === "string") {
      return typedPayload.message;
    }

    if (Array.isArray(typedPayload.message)) {
      return typedPayload.message.join(", ");
    }
  }

  return fallback;
}

function mapStatusToCode(statusCode: number): ErrorCode {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      return ERROR_CODES.VALIDATION_ERROR;
    case HttpStatus.UNAUTHORIZED:
      return ERROR_CODES.INVALID_TOKEN;
    case HttpStatus.FORBIDDEN:
      return ERROR_CODES.INSUFFICIENT_PERMISSIONS;
    case HttpStatus.NOT_FOUND:
      return ERROR_CODES.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ERROR_CODES.CONFLICT;
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return ERROR_CODES.INVALID_OPERATION;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ERROR_CODES.RATE_LIMIT_EXCEEDED;
    default:
      return ERROR_CODES.INTERNAL_ERROR;
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ZodError) {
      const validationError = new ApiValidationError("Request body is invalid", formatZodIssues(exception));
      this.sendError(response, validationError.statusCode, validationError.code, validationError.message, validationError.details);
      return;
    }

    if (exception instanceof SyntaxError) {
      const jsonError = new ApiInvalidJsonError();
      this.sendError(response, jsonError.statusCode, jsonError.code, jsonError.message, jsonError.details);
      return;
    }

    if (exception instanceof ApiHttpError) {
      this.sendError(response, exception.statusCode, exception.code, exception.message, exception.details);
      return;
    }

    if (exception instanceof LegacyHttpError) {
      this.sendError(response, exception.statusCode, exception.code, exception.message, exception.details);
      return;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      this.sendError(
        response,
        statusCode,
        mapStatusToCode(statusCode),
        extractHttpExceptionMessage(payload, "Request failed"),
      );
      return;
    }

    console.error("Unhandled Nest API error:", exception);
    this.sendError(
      response,
      HttpStatus.INTERNAL_SERVER_ERROR,
      ERROR_CODES.INTERNAL_ERROR,
      "An unexpected error occurred",
    );
  }

  private sendError(response: Response, statusCode: number, code: string, message: string, details: unknown[] = []) {
    response.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        details,
      },
    });
  }
}