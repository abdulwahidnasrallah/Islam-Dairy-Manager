import { describe, it, expect, vi, beforeEach } from "vitest";

// Mirrors the real @anthropic-ai/sdk error class hierarchy just closely
// enough to exercise mapAnthropicError()'s instanceof checks: APIError
// is the base class, the rest extend it, and APIConnectionError has no
// `status` (a network-level failure never reached the API at all).
class FakeAPIError extends Error {}
class FakeAPIConnectionError extends FakeAPIError {}
class FakeAuthenticationError extends FakeAPIError {
  status = 401;
}
class FakeRateLimitError extends FakeAPIError {
  status = 429;
}
class FakeNotFoundError extends FakeAPIError {
  status = 404;
}

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: (...args: unknown[]) => createMock(...args) };
    static APIError = FakeAPIError;
    static APIConnectionError = FakeAPIConnectionError;
    static AuthenticationError = FakeAuthenticationError;
    static RateLimitError = FakeRateLimitError;
    static NotFoundError = FakeNotFoundError;
  }
  return { default: MockAnthropic };
});

let mockEnv: { ANTHROPIC_API_KEY?: string; ASSISTANT_MODEL: string };
vi.mock("../../config/env", () => ({
  get env() {
    return mockEnv;
  },
}));

const addMessageMock = vi.fn().mockResolvedValue(undefined);
const touchConversationMock = vi.fn().mockResolvedValue(undefined);
const createConversationMock = vi.fn().mockResolvedValue({
  id: "conv_1",
  userId: "user_1",
  title: "hi",
  createdAt: new Date(),
  updatedAt: new Date(),
});
const findConversationWithMessagesMock = vi.fn().mockResolvedValue({
  id: "conv_1",
  userId: "user_1",
  title: "hi",
  createdAt: new Date(),
  updatedAt: new Date(),
  messages: [],
});

vi.mock("./assistant.repository", () => ({
  assistantRepository: {
    createConversation: (...args: unknown[]) => createConversationMock(...args),
    addMessage: (...args: unknown[]) => addMessageMock(...args),
    touchConversation: (...args: unknown[]) => touchConversationMock(...args),
    findConversationWithMessages: (...args: unknown[]) => findConversationWithMessagesMock(...args),
  },
}));

vi.mock("./assistant.tools", () => ({
  assistantTools: [],
  executeAssistantTool: vi.fn(),
}));

import { assistantService } from "./assistant.service";

describe("assistantService.chat — missing API key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = { ANTHROPIC_API_KEY: undefined, ASSISTANT_MODEL: "claude-sonnet-5" };
  });

  it("throws ASSISTANT_NOT_CONFIGURED and never calls the Anthropic API when the key is missing", async () => {
    await expect(
      assistantService.chat({ conversationId: null, message: "hi" }, "user_1"),
    ).rejects.toMatchObject({ errorCode: "ASSISTANT_NOT_CONFIGURED", statusCode: 503 });

    expect(createMock).not.toHaveBeenCalled();
  });

  it("treats an empty-string key exactly like a missing one (e.g. a copied .env.example with ANTHROPIC_API_KEY=\"\")", async () => {
    mockEnv.ANTHROPIC_API_KEY = "";

    await expect(
      assistantService.chat({ conversationId: null, message: "hi" }, "user_1"),
    ).rejects.toMatchObject({ errorCode: "ASSISTANT_NOT_CONFIGURED" });
  });
});

describe("assistantService.chat — Anthropic API failures are mapped to clear errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = { ANTHROPIC_API_KEY: "sk-ant-real-key", ASSISTANT_MODEL: "claude-sonnet-5" };
  });

  it("maps AuthenticationError (bad/expired key) to ASSISTANT_INVALID_API_KEY, not a generic error", async () => {
    createMock.mockRejectedValue(new FakeAuthenticationError("invalid x-api-key"));

    await expect(
      assistantService.chat({ conversationId: null, message: "hi" }, "user_1"),
    ).rejects.toMatchObject({ errorCode: "ASSISTANT_INVALID_API_KEY", statusCode: 503 });
  });

  it("maps APIConnectionError (network failure reaching Anthropic) to ASSISTANT_CONNECTION_FAILED", async () => {
    createMock.mockRejectedValue(new FakeAPIConnectionError("fetch failed"));

    await expect(
      assistantService.chat({ conversationId: null, message: "hi" }, "user_1"),
    ).rejects.toMatchObject({ errorCode: "ASSISTANT_CONNECTION_FAILED" });
  });

  it("maps RateLimitError to ASSISTANT_RATE_LIMITED", async () => {
    createMock.mockRejectedValue(new FakeRateLimitError("rate limited"));

    await expect(
      assistantService.chat({ conversationId: null, message: "hi" }, "user_1"),
    ).rejects.toMatchObject({ errorCode: "ASSISTANT_RATE_LIMITED" });
  });

  it("maps NotFoundError (bad ASSISTANT_MODEL value) to ASSISTANT_MODEL_NOT_FOUND", async () => {
    createMock.mockRejectedValue(new FakeNotFoundError("model not found"));

    await expect(
      assistantService.chat({ conversationId: null, message: "hi" }, "user_1"),
    ).rejects.toMatchObject({ errorCode: "ASSISTANT_MODEL_NOT_FOUND" });
  });

  it("maps an unrecognized error to a specific fallback code, never a silent crash", async () => {
    createMock.mockRejectedValue(new Error("something truly unexpected"));

    await expect(
      assistantService.chat({ conversationId: null, message: "hi" }, "user_1"),
    ).rejects.toMatchObject({ errorCode: "ASSISTANT_UNKNOWN_ERROR", statusCode: 503 });
  });

  it("returns the assistant's reply normally when the API call succeeds", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "الرصيد 500" }],
      stop_reason: "end_turn",
    });

    const result = await assistantService.chat({ conversationId: null, message: "كم الرصيد؟" }, "user_1");

    expect(result.id).toBe("conv_1");
    expect(addMessageMock).toHaveBeenCalledWith("conv_1", "ASSISTANT", "الرصيد 500");
  });
});
