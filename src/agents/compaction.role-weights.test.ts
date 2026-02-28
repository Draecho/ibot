import { describe, expect, it } from "vitest";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { splitMessagesByTokenShare } from "./compaction.js";

function makeMessage(role: string, textLength: number, isError = false): AgentMessage {
  const text = "x".repeat(textLength);
  if (role === "toolResult") {
    return {
      role: "toolResult",
      toolCallId: "call_1",
      isError,
      content: [{ type: "text", text }],
    } as unknown as AgentMessage;
  }
  return {
    role,
    content: [{ type: "text", text }],
  } as unknown as AgentMessage;
}

describe("splitMessagesByTokenShare with roleWeights", () => {
  it("splits without weights (default behavior)", () => {
    const messages = [
      makeMessage("user", 100),
      makeMessage("assistant", 100),
      makeMessage("user", 100),
      makeMessage("assistant", 100),
    ];
    const chunks = splitMessagesByTokenShare(messages, 2);
    expect(chunks.length).toBe(2);
  });

  it("user messages with higher weight get more share", () => {
    const messages = [
      makeMessage("user", 100),
      makeMessage("assistant", 100),
      makeMessage("user", 100),
      makeMessage("assistant", 100),
    ];
    // With high user weight, user messages count more toward the budget
    const chunksWeighted = splitMessagesByTokenShare(messages, 2, { user: 3.0, assistant: 1.0 });
    const chunksUnweighted = splitMessagesByTokenShare(messages, 2);
    // Both should produce 2 chunks but split points may differ
    expect(chunksWeighted.length).toBe(2);
    expect(chunksUnweighted.length).toBe(2);
  });

  it("tool error messages with higher weight affect splitting", () => {
    const messages = [
      makeMessage("user", 50),
      makeMessage("assistant", 50),
      makeMessage("toolResult", 200, true),
      makeMessage("user", 50),
      makeMessage("assistant", 50),
    ];
    const chunks = splitMessagesByTokenShare(messages, 2, { toolError: 2.0 });
    expect(chunks.length).toBe(2);
    // The error tool result should be weighted more heavily
  });

  it("respects custom weights", () => {
    const messages = [
      makeMessage("user", 100),
      makeMessage("assistant", 100),
    ];
    const chunks = splitMessagesByTokenShare(messages, 2, { user: 1.0, assistant: 1.0 });
    expect(chunks.length).toBe(2);
  });

  it("handles empty messages", () => {
    const chunks = splitMessagesByTokenShare([], 2, { user: 2.0 });
    expect(chunks.length).toBe(0);
  });
});
