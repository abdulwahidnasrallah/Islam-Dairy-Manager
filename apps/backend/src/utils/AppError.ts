/**
 * Thrown deliberately by services/controllers for expected error cases
 * (validation, not-found, permission-denied, ...). The global error
 * middleware maps this to a safe, friendly response.
 *
 * Anything that is NOT an AppError is treated as an unexpected internal
 * error: logged with full detail, but never shown to the user.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;

  constructor(message: string, statusCode = 400, errorCode = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}
