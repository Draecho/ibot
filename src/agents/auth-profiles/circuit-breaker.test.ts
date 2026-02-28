import { describe, expect, it } from "vitest";
import {
  deriveCircuitState,
  markHalfOpenSuccess,
  resetCircuit,
  shouldAttemptInHalfOpen,
} from "./circuit-breaker.js";
import type { ProfileUsageStats } from "./types.js";

describe("deriveCircuitState", () => {
  const now = 1_700_000_000_000;

  it("returns closed when stats are empty", () => {
    expect(deriveCircuitState({}, now)).toBe("closed");
  });

  it("returns closed when no cooldown or errors", () => {
    const stats: ProfileUsageStats = { lastUsed: now - 1000, errorCount: 0 };
    expect(deriveCircuitState(stats, now)).toBe("closed");
  });

  it("returns open when cooldownUntil is in the future", () => {
    const stats: ProfileUsageStats = { cooldownUntil: now + 60_000, errorCount: 2 };
    expect(deriveCircuitState(stats, now)).toBe("open");
  });

  it("returns open when disabledUntil is in the future", () => {
    const stats: ProfileUsageStats = { disabledUntil: now + 300_000, errorCount: 1 };
    expect(deriveCircuitState(stats, now)).toBe("open");
  });

  it("returns half_open when cooldown expired but errors remain", () => {
    const stats: ProfileUsageStats = { cooldownUntil: now - 1000, errorCount: 3 };
    expect(deriveCircuitState(stats, now)).toBe("half_open");
  });

  it("returns half_open when disabled expired but errors remain", () => {
    const stats: ProfileUsageStats = {
      disabledUntil: now - 1000,
      errorCount: 1,
      halfOpenSuccessCount: 1,
    };
    expect(deriveCircuitState(stats, now)).toBe("half_open");
  });

  it("returns closed when half_open success threshold met", () => {
    const stats: ProfileUsageStats = {
      cooldownUntil: now - 1000,
      errorCount: 2,
      halfOpenSuccessCount: 3,
    };
    expect(deriveCircuitState(stats, now)).toBe("closed");
  });

  it("returns closed when errorCount is zero even with expired cooldown", () => {
    const stats: ProfileUsageStats = { cooldownUntil: now - 1000, errorCount: 0 };
    expect(deriveCircuitState(stats, now)).toBe("closed");
  });

  it("defaults to Date.now() when no timestamp provided", () => {
    const stats: ProfileUsageStats = { errorCount: 0 };
    expect(deriveCircuitState(stats)).toBe("closed");
  });
});

describe("shouldAttemptInHalfOpen", () => {
  it("returns true when below threshold", () => {
    expect(shouldAttemptInHalfOpen({ halfOpenSuccessCount: 1 })).toBe(true);
  });

  it("returns false when at threshold", () => {
    expect(shouldAttemptInHalfOpen({ halfOpenSuccessCount: 3 })).toBe(false);
  });

  it("supports custom threshold", () => {
    expect(shouldAttemptInHalfOpen({ halfOpenSuccessCount: 4 }, 5)).toBe(true);
    expect(shouldAttemptInHalfOpen({ halfOpenSuccessCount: 5 }, 5)).toBe(false);
  });

  it("returns true when halfOpenSuccessCount is undefined", () => {
    expect(shouldAttemptInHalfOpen({})).toBe(true);
  });
});

describe("markHalfOpenSuccess", () => {
  it("increments halfOpenSuccessCount from 0", () => {
    const result = markHalfOpenSuccess({});
    expect(result.halfOpenSuccessCount).toBe(1);
  });

  it("increments existing count", () => {
    const result = markHalfOpenSuccess({ halfOpenSuccessCount: 2 });
    expect(result.halfOpenSuccessCount).toBe(3);
  });

  it("preserves other stats fields", () => {
    const stats: ProfileUsageStats = { lastUsed: 123, errorCount: 2, halfOpenSuccessCount: 1 };
    const result = markHalfOpenSuccess(stats);
    expect(result.lastUsed).toBe(123);
    expect(result.errorCount).toBe(2);
    expect(result.halfOpenSuccessCount).toBe(2);
  });

  it("does not mutate the input", () => {
    const stats: ProfileUsageStats = { halfOpenSuccessCount: 1 };
    markHalfOpenSuccess(stats);
    expect(stats.halfOpenSuccessCount).toBe(1);
  });
});

describe("resetCircuit", () => {
  it("clears all error and cooldown fields", () => {
    const stats: ProfileUsageStats = {
      lastUsed: 100,
      errorCount: 5,
      cooldownUntil: 200,
      disabledUntil: 300,
      disabledReason: "billing",
      failureCounts: { billing: 3 },
      halfOpenSuccessCount: 2,
    };
    const result = resetCircuit(stats);

    expect(result.errorCount).toBe(0);
    expect(result.cooldownUntil).toBeUndefined();
    expect(result.disabledUntil).toBeUndefined();
    expect(result.disabledReason).toBeUndefined();
    expect(result.failureCounts).toBeUndefined();
    expect(result.halfOpenSuccessCount).toBe(0);
    // Preserves non-error fields
    expect(result.lastUsed).toBe(100);
  });

  it("does not mutate the input", () => {
    const stats: ProfileUsageStats = { errorCount: 3 };
    resetCircuit(stats);
    expect(stats.errorCount).toBe(3);
  });
});
