import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../app";

describe("GET /api/health", () => {
  it("returns a running status with application metadata", async () => {
    const app = createApp();
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.application).toBe("Islam Dairy Manager");
  });
});
