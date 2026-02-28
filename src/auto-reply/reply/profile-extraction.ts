import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("profile-extraction");

const DEFAULT_FREQUENCY = 5;

const DEFAULT_EXTRACTION_PROMPT = [
  "Analyze the recent conversation history and extract user behavior patterns.",
  "Look for:",
  "- Communication style preferences (formal/casual, verbose/concise)",
  "- Topic interests and areas of expertise",
  "- Corrections the user has made to your responses",
  "- Format preferences (code style, markdown, lists vs prose)",
  "- Timezone and scheduling patterns",
  "- Tool usage preferences",
  "",
  "Write a concise profile update to memory/user-profile/preferences.md.",
  "If the file exists, merge new observations with existing content.",
  "If nothing notable, do not write anything.",
  "Keep the profile under 500 words total.",
].join("\n");

export type ProfileExtractionConfig = {
  enabled?: boolean;
  frequency?: number;
  prompt?: string;
};

/**
 * Determine whether profile extraction should run based on config and session count.
 */
export function shouldRunProfileExtraction(
  config: ProfileExtractionConfig | undefined,
  sessionCount: number,
): boolean {
  if (!config?.enabled) {
    return false;
  }
  const frequency = config.frequency ?? DEFAULT_FREQUENCY;
  if (frequency <= 0) {
    return false;
  }
  return sessionCount > 0 && sessionCount % frequency === 0;
}

/**
 * Build the extraction prompt, using custom prompt if provided.
 */
export function buildExtractionPrompt(config?: ProfileExtractionConfig): string {
  return config?.prompt?.trim() || DEFAULT_EXTRACTION_PROMPT;
}

export type RunProfileExtractionParams = {
  config?: ProfileExtractionConfig;
  sessionCount: number;
  /** Callback to run the extraction agent turn (same pattern as memory flush). */
  runAgentTurn: (prompt: string) => Promise<void>;
};

/**
 * Run profile extraction if conditions are met.
 * Uses the same agent turn pattern as the existing memory flush.
 */
export async function runProfileExtraction(params: RunProfileExtractionParams): Promise<boolean> {
  if (!shouldRunProfileExtraction(params.config, params.sessionCount)) {
    return false;
  }

  const prompt = buildExtractionPrompt(params.config);
  try {
    log.info("running user profile extraction");
    await params.runAgentTurn(prompt);
    log.info("user profile extraction complete");
    return true;
  } catch (err) {
    log.warn(`user profile extraction failed: ${String(err)}`);
    return false;
  }
}
