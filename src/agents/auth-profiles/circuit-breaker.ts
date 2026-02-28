import type { ProfileUsageStats } from "./types.js";

/**
 * Circuit-breaker state machine for auth profile cooldown management.
 *
 * Provides a formal state model on top of the existing cooldown infrastructure:
 * - **closed**: profile is healthy, all requests flow through
 * - **open**: profile is in cooldown/disabled, requests are blocked
 * - **half_open**: cooldown has expired but the profile hasn't yet proven healthy;
 *   a limited number of probe requests are allowed through
 */
export type CircuitState = "closed" | "open" | "half_open";

const DEFAULT_REQUIRED_SUCCESSES = 3;

/**
 * Derive the circuit-breaker state from profile usage statistics.
 *
 * - If no cooldown/disable window is active → **closed**
 * - If a cooldown/disable window is still in the future → **open**
 * - If the cooldown just expired but `errorCount` is still elevated → **half_open**
 */
export function deriveCircuitState(stats: ProfileUsageStats, now?: number): CircuitState {
  const ts = now ?? Date.now();

  const cooldownActive =
    typeof stats.cooldownUntil === "number" &&
    Number.isFinite(stats.cooldownUntil) &&
    stats.cooldownUntil > 0 &&
    ts < stats.cooldownUntil;

  const disabledActive =
    typeof stats.disabledUntil === "number" &&
    Number.isFinite(stats.disabledUntil) &&
    stats.disabledUntil > 0 &&
    ts < stats.disabledUntil;

  if (cooldownActive || disabledActive) {
    return "open";
  }

  // Cooldown has expired (or never existed). If there's residual error state,
  // the profile is in half-open: it needs to prove itself with successful calls.
  const hasResidualErrors = (stats.errorCount ?? 0) > 0;
  const halfOpenCount = stats.halfOpenSuccessCount ?? 0;

  if (hasResidualErrors && halfOpenCount < DEFAULT_REQUIRED_SUCCESSES) {
    return "half_open";
  }

  return "closed";
}

/**
 * Check whether a profile in half-open state has accumulated enough
 * consecutive successes to be promoted back to closed.
 */
export function shouldAttemptInHalfOpen(
  stats: ProfileUsageStats,
  requiredSuccesses = DEFAULT_REQUIRED_SUCCESSES,
): boolean {
  return (stats.halfOpenSuccessCount ?? 0) < requiredSuccesses;
}

/**
 * Increment the half-open success counter. Call this after a successful
 * request while the circuit is in half-open state.
 *
 * Returns a new stats object (does not mutate the input).
 */
export function markHalfOpenSuccess(stats: ProfileUsageStats): ProfileUsageStats {
  return {
    ...stats,
    halfOpenSuccessCount: (stats.halfOpenSuccessCount ?? 0) + 1,
  };
}

/**
 * Fully reset the circuit to closed state. Clears error counters and
 * the half-open success counter.
 *
 * Returns a new stats object (does not mutate the input).
 */
export function resetCircuit(stats: ProfileUsageStats): ProfileUsageStats {
  return {
    ...stats,
    errorCount: 0,
    cooldownUntil: undefined,
    disabledUntil: undefined,
    disabledReason: undefined,
    failureCounts: undefined,
    halfOpenSuccessCount: 0,
  };
}
