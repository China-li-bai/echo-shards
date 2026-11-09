/**
 * Pronunciation experiment scores stay off the memory schedule.
 * A recorded fixture may be stored as its own event. It is not a Grade,
 * not a retrieval, and not a measured acoustic accuracy.
 * Typed IPA on a phonology_text card remains an ordinary memory grade
 * elsewhere. This module does not schedule.
 */

import { AgentEventLog, type LearningEventRecord } from "../agents/event-log.js";

export const PRONUNCIATION_EXPERIMENT_VERSION = 1 as const;
export const PRONUNCIATION_FIXTURE_LABEL = "test-fixture-not-learner-speech" as const;

const ALLOWED_KEYS = new Set([
  "schema_version",
  "task",
  "source",
  "fixture",
  "fixture_label",
  "score",
  "reference_text",
  "client_event_id",
  "note",
]);

const BANNED_NOTE = /学会|掌握|发音准确|会说|会发音|准确率/;

export class PronunciationScheduleError extends Error {
  readonly schedules = false as const;

  constructor(message: string) {
    super(message);
    this.name = "PronunciationScheduleError";
  }
}

export interface PronunciationExperimentRecord {
  id: string;
  event_type: "pronunciation_experiment";
  schema_version: 1;
  task: "pronunciation_experiment";
  source: "recorded-fixture";
  fixture: true;
  fixture_label: typeof PRONUNCIATION_FIXTURE_LABEL;
  score: number;
  reference_text: string;
  note: string | null;
  client_event_id: string | null;
  mastery: false;
  acoustic_accuracy: "not_measured";
  schedules: false;
  accepted_as_grade: false;
}

interface ParsedExperiment {
  score: number;
  reference_text: string;
  note: string | null;
  client_event_id: string | null;
}

/** A pronunciation score has no conversion into an FSRS grade. */
export function pronunciationScoreToGrade(_input: unknown): never {
  throw new PronunciationScheduleError(
    "A pronunciation experiment score cannot become a memory grade.",
  );
}

/**
 * TideSteward.rate may carry client_event_id and nothing else.
 * Any other field is refused before the scheduler runs.
 */
export function assertMemoryRateExtra(extra: Record<string, unknown>): void {
  for (const key of Object.keys(extra)) {
    if (key === "client_event_id") continue;
    pronunciationScoreToGrade(extra[key]);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readExperiment(input: unknown): ParsedExperiment {
  if (!isRecord(input)) {
    throw new PronunciationScheduleError("A pronunciation experiment must be an object.");
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new PronunciationScheduleError(
        `Field ${key} cannot ride along with a pronunciation experiment.`,
      );
    }
  }
  if (input.schema_version !== PRONUNCIATION_EXPERIMENT_VERSION) {
    throw new PronunciationScheduleError("Unknown pronunciation experiment version.");
  }
  if (input.task !== "pronunciation_experiment") {
    throw new PronunciationScheduleError("This object is not a pronunciation experiment.");
  }
  if (input.source !== "recorded-fixture") {
    throw new PronunciationScheduleError("Only a recorded fixture can be stored. Live speech is not connected.");
  }
  if (input.fixture !== true || input.fixture_label !== PRONUNCIATION_FIXTURE_LABEL) {
    throw new PronunciationScheduleError("The fixture label does not match the recorded sample.");
  }
  if (typeof input.score !== "number" || !Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
    throw new PronunciationScheduleError("The experiment score must be a finite number from 0 to 100.");
  }
  if (
    typeof input.reference_text !== "string" ||
    input.reference_text.length === 0 ||
    input.reference_text.length > 80 ||
    input.reference_text !== input.reference_text.trim()
  ) {
    throw new PronunciationScheduleError("reference_text must be a short label for the sample.");
  }
  let note: string | null = null;
  if (input.note !== undefined) {
    if (
      typeof input.note !== "string" ||
      input.note.length === 0 ||
      input.note.length > 80 ||
      input.note !== input.note.trim() ||
      BANNED_NOTE.test(input.note)
    ) {
      throw new PronunciationScheduleError("The sample note cannot claim pronunciation mastery.");
    }
    note = input.note;
  }
  let clientEventId: string | null = null;
  if (input.client_event_id !== undefined) {
    if (
      typeof input.client_event_id !== "string" ||
      input.client_event_id.length === 0 ||
      input.client_event_id.length > 128 ||
      input.client_event_id !== input.client_event_id.trim()
    ) {
      throw new PronunciationScheduleError("client_event_id must be a non-empty trimmed string.");
    }
    clientEventId = input.client_event_id;
  }
  return {
    score: input.score,
    reference_text: input.reference_text,
    note,
    client_event_id: clientEventId,
  };
}

function signature(parsed: ParsedExperiment): string {
  return JSON.stringify([
    parsed.score,
    parsed.reference_text,
    parsed.note,
    parsed.client_event_id,
  ]);
}

function toRecord(event: LearningEventRecord, parsed: ParsedExperiment): PronunciationExperimentRecord {
  return {
    id: event.id,
    event_type: "pronunciation_experiment",
    schema_version: 1,
    task: "pronunciation_experiment",
    source: "recorded-fixture",
    fixture: true,
    fixture_label: PRONUNCIATION_FIXTURE_LABEL,
    score: parsed.score,
    reference_text: parsed.reference_text,
    note: parsed.note,
    client_event_id: parsed.client_event_id,
    mastery: false,
    acoustic_accuracy: "not_measured",
    schedules: false,
    accepted_as_grade: false,
  };
}

function parsedFromPayload(payload: Record<string, unknown>): ParsedExperiment | null {
  if (typeof payload.score !== "number" || typeof payload.reference_text !== "string") return null;
  return {
    score: payload.score,
    reference_text: payload.reference_text,
    note: typeof payload.note === "string" ? payload.note : null,
    client_event_id: typeof payload.client_event_id === "string" ? payload.client_event_id : null,
  };
}

/**
 * Store one experiment sample. Same client_event_id and same sample returns
 * the stored row. A different sample with that id throws and writes nothing.
 * The event log is the only write. No card, due, or review log changes.
 */
export function recordPronunciationExperiment(
  input: unknown,
  log: AgentEventLog,
): PronunciationExperimentRecord {
  const parsed = readExperiment(input);
  const eventId = parsed.client_event_id ? `pronunciation:${parsed.client_event_id}` : undefined;
  if (parsed.client_event_id) {
    const existing = log.events.find(
      (event) =>
        event.event_type === "pronunciation_experiment" &&
        (event.id === eventId || event.payload.client_event_id === parsed.client_event_id),
    );
    if (existing) {
      const stored = parsedFromPayload(existing.payload);
      if (!stored || signature(stored) !== signature(parsed)) {
        throw new PronunciationScheduleError(
          "This pronunciation id was already stored with a different sample.",
        );
      }
      return toRecord(existing, parsed);
    }
  }
  const event = log.recordEvent({
    ...(eventId ? { id: eventId } : {}),
    event_type: "pronunciation_experiment",
    payload: {
      schema_version: 1,
      task: "pronunciation_experiment",
      source: "recorded-fixture",
      fixture: true,
      fixture_label: PRONUNCIATION_FIXTURE_LABEL,
      score: parsed.score,
      reference_text: parsed.reference_text,
      note: parsed.note,
      client_event_id: parsed.client_event_id,
      mastery: false,
      acoustic_accuracy: "not_measured",
      schedules: false,
      accepted_as_grade: false,
    },
  });
  return toRecord(event, parsed);
}
