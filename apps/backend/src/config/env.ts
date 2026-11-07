import "dotenv/config";
import { envSchema, type Env } from "@idm/shared-validation";

/**
 * Validates process.env at startup. The application refuses to start
 * if required variables are missing or invalid — never fall back to
 * silently-wrong defaults for secrets or the database URL.
 */
function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment configuration:");
    for (const issue of result.error.issues) {
      console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
