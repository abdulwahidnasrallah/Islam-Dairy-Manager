import { Router } from "express";
import type { HealthStatus } from "@idm/shared-types";
import { isDatabaseConnected } from "../../config/prisma";
import { env } from "../../config/env";
import { sendSuccess } from "../../utils/apiResponse";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const databaseConnected = await isDatabaseConnected();

  const payload: HealthStatus = {
    status: databaseConnected ? "running" : "degraded",
    application: "Islam Dairy Manager",
    version: env.APP_VERSION,
    databaseConnected,
    timestamp: new Date().toISOString(),
  };

  sendSuccess(res, payload, "OK");
});
