import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { assistantService } from "./assistant.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const assistantController = {
  async listConversations(req: AuthenticatedRequest, res: Response) {
    const conversations = await assistantService.listConversations(req.user!.id);
    sendSuccess(res, conversations);
  },

  async getConversation(req: AuthenticatedRequest, res: Response) {
    const conversation = await assistantService.getConversation(req.params.id, req.user!.id);
    sendSuccess(res, conversation);
  },

  async chat(req: AuthenticatedRequest, res: Response) {
    const conversation = await assistantService.chat(req.body, req.user!.id);
    sendSuccess(res, conversation);
  },

  async deleteConversation(req: AuthenticatedRequest, res: Response) {
    await assistantService.deleteConversation(req.params.id, req.user!.id);
    sendSuccess(res, null, "تم حذف المحادثة");
  },
};
