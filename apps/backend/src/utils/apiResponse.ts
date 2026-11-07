import type { Response } from "express";
import type { ApiError, ApiSuccess } from "@idm/shared-types";

export function sendSuccess<T>(res: Response, data: T, message = "", status = 200): void {
  const body: ApiSuccess<T> = { success: true, message, data };
  res.status(status).json(body);
}

export function sendError(
  res: Response,
  message: string,
  errorCode: string,
  status = 400,
): void {
  const body: ApiError = { success: false, message, errorCode };
  res.status(status).json(body);
}
