import { createSubsystemLogger } from "../logging/subsystem.js";
import type { LlmQueryExpander } from "./query-expansion.js";

const log = createSubsystemLogger("llm-expander");

const REFORMULATION_PROMPT = [
  "Given the following search query, generate 2-3 alternative search queries",
  "that would help find relevant information. Return ONLY the queries,",
  "one per line, with no numbering, bullets, or extra text.",
  "",
  "Original query: {query}",
  "",
  "Alternative queries:",
].join("\n");

export type LlmExpanderConfig = {
  enabled?: boolean;
  maxReformulations?: number;
};

export type LlmInvoker = (prompt: string) => Promise<string>;

/**
 * Create an LLM-based query expander that generates alternative search queries.
 * Returns undefined if not enabled or no LLM invoker is available.
 */
export function createDefaultLlmQueryExpander(
  config: LlmExpanderConfig | undefined,
  llmInvoker?: LlmInvoker,
): LlmQueryExpander | undefined {
  if (!config?.enabled || !llmInvoker) {
    return undefined;
  }

  const maxReformulations = Math.max(1, Math.min(5, config.maxReformulations ?? 3));

  return async (query: string): Promise<string[]> => {
    try {
      const prompt = REFORMULATION_PROMPT.replace("{query}", query);
      const response = await llmInvoker(prompt);

      const alternatives = parseReformulations(response, maxReformulations);
      if (alternatives.length === 0) {
        return [query];
      }

      // Include original query + alternatives
      return [query, ...alternatives];
    } catch (err) {
      log.warn(`LLM query reformulation failed: ${String(err)}`);
      return [query];
    }
  };
}

/**
 * Parse LLM response into individual query strings.
 */
export function parseReformulations(response: string, maxCount: number): string[] {
  return response
    .split("\n")
    .map((line) => line.replace(/^\d+[\.\)]\s*/, "").replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length > 0 && line.length < 500)
    .slice(0, maxCount);
}
