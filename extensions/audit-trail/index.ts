import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { AuditWriter } from "./src/writer.js";

type AuditTrailConfig = {
  outputDir?: string;
};

export default function register(api: OpenClawPluginApi) {
  const cfg = (api.pluginConfig ?? {}) as AuditTrailConfig;
  const outputDir = cfg.outputDir ?? "audit";
  const writer = new AuditWriter(outputDir, api.logger);

  api.on("after_tool_call", async (event) => {
    await writer.append({
      toolName: event.toolName,
      // oxlint-disable-next-line typescript/no-explicit-any
      toolCallId: (event as any).toolCallId,
      params: event.params,
      result: event.result,
      error: event.error,
      durationMs: event.durationMs,
    });
  });
}
