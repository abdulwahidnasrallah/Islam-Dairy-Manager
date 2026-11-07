import { Router } from "express";
import { assistantChatSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { assistantController } from "./assistant.controller";

export const assistantRouter = Router();

assistantRouter.use(authenticate);
assistantRouter.use(authorize(PERMISSIONS.USE_AI_ASSISTANT));

assistantRouter.get("/conversations", asyncHandler(assistantController.listConversations));
assistantRouter.get("/conversations/:id", asyncHandler(assistantController.getConversation));
assistantRouter.delete("/conversations/:id", asyncHandler(assistantController.deleteConversation));
assistantRouter.post(
  "/chat",
  validateBody(assistantChatSchema),
  asyncHandler(assistantController.chat),
);
