import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

/**
 * Security headers. The desktop app loads the frontend from a local
 * origin only (no remote content), so a strict default-src is safe.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
});

/**
 * CORS: the backend is only ever called by the local Electron renderer
 * or the local Vite dev server — never by an arbitrary remote origin.
 */
export const corsPolicy = cors({
  origin: ["http://localhost:5173", "app://."],
  credentials: true,
});

/** Basic brute-force throttling for authentication endpoints. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "عدد كبير من المحاولات، الرجاء المحاولة لاحقاً.",
    errorCode: "RATE_LIMITED",
  },
});
