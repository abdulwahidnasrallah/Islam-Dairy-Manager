import pino from "pino";
import { env } from "./env";

/**
 * Central application logger.
 * Foundation phase: single stream to stdout.
 * Later phases split this into application/security/database/backup logs
 * with rotation, per the security architecture.
 */
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
