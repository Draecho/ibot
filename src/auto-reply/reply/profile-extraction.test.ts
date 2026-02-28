import { describe, expect, it, vi } from "vitest";
import {
  shouldRunProfileExtraction,
  buildExtractionPrompt,
  runProfileExtraction,
} from "./profile-extraction.js";

describe("shouldRunProfileExtraction", () => {
  it("returns false when not enabled", () => {
    expect(shouldRunProfileExtraction(undefined, 5)).toBe(false);
    expect(shouldRunProfileExtraction({ enabled: false }, 5)).toBe(false);
  });

  it("returns false when session count is 0", () => {
    expect(shouldRunProfileExtraction({ enabled: true }, 0)).toBe(false);
  });

  it("returns true at default frequency (every 5 sessions)", () => {
    expect(shouldRunProfileExtraction({ enabled: true }, 5)).toBe(true);
    expect(shouldRunProfileExtraction({ enabled: true }, 10)).toBe(true);
    expect(shouldRunProfileExtraction({ enabled: true }, 3)).toBe(false);
  });

  it("respects custom frequency", () => {
    expect(shouldRunProfileExtraction({ enabled: true, frequency: 3 }, 3)).toBe(true);
    expect(shouldRunProfileExtraction({ enabled: true, frequency: 3 }, 6)).toBe(true);
    expect(shouldRunProfileExtraction({ enabled: true, frequency: 3 }, 4)).toBe(false);
  });

  it("returns false when frequency is 0 or negative", () => {
    expect(shouldRunProfileExtraction({ enabled: true, frequency: 0 }, 5)).toBe(false);
    expect(shouldRunProfileExtraction({ enabled: true, frequency: -1 }, 5)).toBe(false);
  });
});

describe("buildExtractionPrompt", () => {
  it("returns default prompt when no custom prompt", () => {
    const prompt = buildExtractionPrompt();
    expect(prompt).toContain("Communication style");
  });

  it("uses custom prompt when provided", () => {
    const custom = "Extract preferences only";
    expect(buildExtractionPrompt({ prompt: custom })).toBe(custom);
  });

  it("falls back to default for empty custom prompt", () => {
    const prompt = buildExtractionPrompt({ prompt: "  " });
    expect(prompt).toContain("Communication style");
  });
});

describe("runProfileExtraction", () => {
  it("skips when conditions not met", async () => {
    const runAgentTurn = vi.fn();
    const result = await runProfileExtraction({
      config: { enabled: false },
      sessionCount: 5,
      runAgentTurn,
    });
    expect(result).toBe(false);
    expect(runAgentTurn).not.toHaveBeenCalled();
  });

  it("runs when conditions are met", async () => {
    const runAgentTurn = vi.fn().mockResolvedValue(undefined);
    const result = await runProfileExtraction({
      config: { enabled: true },
      sessionCount: 5,
      runAgentTurn,
    });
    expect(result).toBe(true);
    expect(runAgentTurn).toHaveBeenCalledOnce();
    expect(runAgentTurn.mock.calls[0][0]).toContain("Communication style");
  });

  it("returns false on error", async () => {
    const runAgentTurn = vi.fn().mockRejectedValue(new Error("fail"));
    const result = await runProfileExtraction({
      config: { enabled: true },
      sessionCount: 5,
      runAgentTurn,
    });
    expect(result).toBe(false);
  });
});
