import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { logger } from "../config/logger";
import { sendError } from "../utils/apiResponse";

/**
 * Global error handler. This is the ONLY place that decides what error
 * detail reaches the client. Rules (see security architecture):
 *  - Never expose stack traces, SQL, file paths, or internal config.
 *  - Known/expected errors (AppError, ZodError) get a friendly, specific message.
 *  - Anything else becomes a generic message; full detail goes to the log only.
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    sendError(res, "بيانات غير صحيحة", "VALIDATION_ERROR", 422);
    return;
  }

  if (err instanceof AppError) {
    sendError(res, err.message, err.errorCode, err.statusCode);
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  sendError(res, "حدث خطأ غير متوقع، الرجاء المحاولة لاحقاً.", "INTERNAL_ERROR", 500);
}

/** 404 handler for unknown routes. */
export function notFoundMiddleware(req: Request, res: Response): void {
  sendError(res, `المسار غير موجود: ${req.originalUrl}`, "NOT_FOUND", 404);
}
