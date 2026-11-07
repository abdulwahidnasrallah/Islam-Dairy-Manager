import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

/**
 * Validates req.body against the given Zod schema and replaces req.body
 * with the parsed (typed, coerced) result. Throws ZodError on failure,
 * which the global error middleware turns into a friendly 422 response.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}

/** Same idea, for query string parameters. */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.query = schema.parse(req.query);
    next();
  };
}
