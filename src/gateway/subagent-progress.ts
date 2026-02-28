import type { AgentEventPayload } from "../infra/agent-events.js";
import type { GatewayBroadcastFn } from "./server-broadcast.js";

/**
 * Maps tool names to human-readable stage labels for subagent progress.
 */
const TOOL_STAGE_LABELS: Record<string, string> = {
  read: "Reading files",
  write: "Writing files",
  edit: "Editing files",
  apply_patch: "Applying patches",
  exec: "Running command",
  bash: "Running command",
  grep: "Searching code",
  glob: "Finding files",
  memory_search: "Searching memory",
  memory_write: "Writing to memory",
  message: "Sending message",
  sessions_send: "Messaging session",
  sessions_spawn: "Spawning subagent",
};

export type SubagentProgressPayload = {
  runId: string;
  sessionKey?: string;
  stage: string;
  ts: number;
};

/**
 * Detect whether an agent event originates from a subagent session.
 */
export function isSubagentEvent(evt: AgentEventPayload): boolean {
  const key = evt.sessionKey;
  if (!key || typeof key !== "string") return false;
  // Subagent session keys contain ":subagent:" or start with "subagent:"
  return key.includes(":subagent:") || key.startsWith("subagent:");
}

/**
 * Map a tool event to a human-readable stage label.
 */
export function formatStage(evt: AgentEventPayload): string | undefined {
  const data = evt.data;
  if (evt.stream === "tool" && typeof data?.name === "string") {
    return TOOL_STAGE_LABELS[data.name] ?? `Using ${data.name}`;
  }
  if (evt.stream === "lifecycle") {
    const phase = data?.phase as string | undefined;
    if (phase === "start") return "Starting";
    if (phase === "complete") return "Complete";
    if (phase === "error") return "Error";
  }
  if (evt.stream === "assistant") {
    return "Thinking";
  }
  return undefined;
}

/**
 * Emitter that filters subagent events, throttles them, and broadcasts
 * progress updates to connected gateway clients.
 */
export class SubagentProgressEmitter {
  private readonly broadcast: GatewayBroadcastFn;
  private readonly throttleMs: number;
  private readonly lastEmit = new Map<string, number>();

  constructor(broadcast: GatewayBroadcastFn, throttleMs = 1000) {
    this.broadcast = broadcast;
    this.throttleMs = throttleMs;
  }

  /**
   * Process an agent event. Filters to subagent events, throttles,
   * and broadcasts progress updates.
   */
  onEvent(evt: AgentEventPayload): void {
    if (!isSubagentEvent(evt)) return;

    const stage = formatStage(evt);
    if (!stage) return;

    // Throttle: at most 1 event per throttleMs per runId
    const now = evt.ts || Date.now();
    const lastTs = this.lastEmit.get(evt.runId) ?? 0;
    const isComplete = evt.stream === "lifecycle" && evt.data?.phase === "complete";

    if (!isComplete && now - lastTs < this.throttleMs) {
      return;
    }
    this.lastEmit.set(evt.runId, now);

    // Clean up completed runs
    if (isComplete) {
      this.lastEmit.delete(evt.runId);
    }

    const payload: SubagentProgressPayload = {
      runId: evt.runId,
      sessionKey: evt.sessionKey,
      stage,
      ts: now,
    };

    this.broadcast("subagent-progress", payload, { dropIfSlow: true });
  }
}
