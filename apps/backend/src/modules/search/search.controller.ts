import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { searchService } from "./search.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const searchController = {
  async search(req: AuthenticatedRequest, res: Response) {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const results = await searchService.search(query);
    sendSuccess(res, results);
  },
};
