/**
 * Learner Memory stub. Structured episodes only — no raw transcript dumps.
 */

import { AgentEventLog } from "./event-log.js";

const MAX_EPISODE_CHARS = 280;

export class MemoryPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryPolicyError";
  }
}

export function upsertEpisode(
  log: AgentEventLog,
  input: { kind: "episode" | "weak_lexeme" | "preference"; text: string },
): void {
  if (input.text.length > MAX_EPISODE_CHARS) {
    const message =
      "Learner Memory refuses full chat dumps. Store a short structured episode.";
    log.recordRun({
      agent: "learner_memory",
      tools: ["upsertEpisode"],
      status: "blocked",
      error_message: message,
    });
    throw new MemoryPolicyError(message);
  }
  log.recordRun({
    agent: "learner_memory",
    tools: ["upsertEpisode"],
    status: "ok",
    output_ref: input.kind,
  });
}
