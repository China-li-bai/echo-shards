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

export type EpisodeKind = "episode" | "weak_lexeme" | "preference";

export interface MemoryEpisode {
  id: string;
  kind: EpisodeKind;
  text: string;
  created_at: string;
}

export function upsertEpisode(
  log: AgentEventLog,
  input: { kind: EpisodeKind; text: string },
): MemoryEpisode {
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
  const episode: MemoryEpisode = {
    id: `mem_${crypto.randomUUID()}`,
    kind: input.kind,
    text: input.text.trim(),
    created_at: new Date().toISOString(),
  };
  log.recordRun({
    agent: "learner_memory",
    tools: ["upsertEpisode"],
    status: "ok",
    output_ref: input.kind,
  });
  return episode;
}

export class LearnerMemory {
  readonly items: MemoryEpisode[] = [];

  constructor(private readonly log: AgentEventLog) {}

  upsertEpisode(input: { kind: EpisodeKind; text: string }): MemoryEpisode {
    const episode = upsertEpisode(this.log, input);
    const existing = this.items.findIndex(
      (row) => row.kind === episode.kind && row.text === episode.text,
    );
    if (existing >= 0) this.items[existing] = episode;
    else this.items.push(episode);
    return episode;
  }
}
