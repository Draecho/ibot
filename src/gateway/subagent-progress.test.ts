import { describe, expect, it, vi } from "vitest";
import type { AgentEventPayload } from "../infra/agent-events.js";
import {
  SubagentProgressEmitter,
  isSubagentEvent,
  formatStage,
} from "./subagent-progress.js";

function makeEvent(overrides: Partial<AgentEventPayload> = {}): AgentEventPayload {
  return {
    runId: "run-1",
    seq: 1,
    stream: "tool",
    ts: Date.now(),
    data: { name: "read" },
    sessionKey: "agent:main:subagent:abc",
    ...overrides,
  };
}

describe("isSubagentEvent", () => {
  it("detects subagent session keys", () => {
    expect(isSubagentEvent(makeEvent({ sessionKey: "agent:main:subagent:abc" }))).toBe(true);
    expect(isSubagentEvent(makeEvent({ sessionKey: "subagent:test" }))).toBe(true);
  });

  it("rejects non-subagent session keys", () => {
    expect(isSubagentEvent(makeEvent({ sessionKey: "agent:main" }))).toBe(false);
    expect(isSubagentEvent(makeEvent({ sessionKey: undefined }))).toBe(false);
  });
});

describe("formatStage", () => {
  it("maps known tool names", () => {
    expect(formatStage(makeEvent({ data: { name: "read" } }))).toBe("Reading files");
    expect(formatStage(makeEvent({ data: { name: "exec" } }))).toBe("Running command");
    expect(formatStage(makeEvent({ data: { name: "grep" } }))).toBe("Searching code");
  });

  it("generates label for unknown tools", () => {
    expect(formatStage(makeEvent({ data: { name: "custom_tool" } }))).toBe("Using custom_tool");
  });

  it("maps lifecycle events", () => {
    expect(formatStage(makeEvent({ stream: "lifecycle", data: { phase: "start" } }))).toBe("Starting");
    expect(formatStage(makeEvent({ stream: "lifecycle", data: { phase: "complete" } }))).toBe("Complete");
  });

  it("maps assistant stream to Thinking", () => {
    expect(formatStage(makeEvent({ stream: "assistant", data: {} }))).toBe("Thinking");
  });
});

describe("SubagentProgressEmitter", () => {
  it("broadcasts subagent progress events", () => {
    const broadcast = vi.fn();
    const emitter = new SubagentProgressEmitter(broadcast);

    emitter.onEvent(makeEvent());

    expect(broadcast).toHaveBeenCalledWith(
      "subagent-progress",
      expect.objectContaining({
        runId: "run-1",
        stage: "Reading files",
      }),
      { dropIfSlow: true },
    );
  });

  it("ignores non-subagent events", () => {
    const broadcast = vi.fn();
    const emitter = new SubagentProgressEmitter(broadcast);

    emitter.onEvent(makeEvent({ sessionKey: "agent:main" }));

    expect(broadcast).not.toHaveBeenCalled();
  });

  it("throttles events within the window", () => {
    const broadcast = vi.fn();
    const emitter = new SubagentProgressEmitter(broadcast, 1000);
    const now = Date.now();

    emitter.onEvent(makeEvent({ ts: now }));
    emitter.onEvent(makeEvent({ ts: now + 100, seq: 2, data: { name: "write" } }));

    // Only first event should be broadcast
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it("allows events after throttle window", () => {
    const broadcast = vi.fn();
    const emitter = new SubagentProgressEmitter(broadcast, 1000);
    const now = Date.now();

    emitter.onEvent(makeEvent({ ts: now }));
    emitter.onEvent(makeEvent({ ts: now + 1500, seq: 2, data: { name: "write" } }));

    expect(broadcast).toHaveBeenCalledTimes(2);
  });

  it("always sends completion events regardless of throttle", () => {
    const broadcast = vi.fn();
    const emitter = new SubagentProgressEmitter(broadcast, 1000);
    const now = Date.now();

    emitter.onEvent(makeEvent({ ts: now }));
    emitter.onEvent(
      makeEvent({
        ts: now + 100,
        seq: 2,
        stream: "lifecycle",
        data: { phase: "complete" },
      }),
    );

    expect(broadcast).toHaveBeenCalledTimes(2);
  });
});
