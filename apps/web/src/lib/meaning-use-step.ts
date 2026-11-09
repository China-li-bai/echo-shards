/**
 * Short sentence after a saved meaning recall.
 *
 * Calls checkMeaningUse only. It never rates, and it does not decide whether
 * the sentence's meaning fits. Records stay in localStorage under one
 * echo-shards key. Another browser, or a write that fails, does not share
 * this memory. A corrupt log is left in place and does not block recall.
 */
import { checkMeaningUse, type MeaningUseVerdict } from "@echo-shards/core";

export const MEANING_USE_STORAGE_KEY = "echo-shards.meaning-use.v1";
export const MEANING_USE_SCHEMA_VERSION = 1;
export const MEANING_USE_SKIP_NOTE = "先跳过了。这不算已经会用。";
export const MEANING_USE_SAVE_FAILED_MESSAGE = "这句还在，这次没存下来。可以再试一次。";
export const MEANING_USE_HELD_MESSAGE =
  "这台设备上有一份造句记录，这次读不了。记录还在，没有删掉。";

export interface MeaningUseRecord {
  schema_version: 1;
  id: string;
  card_id: string;
  lemma: string;
  forms: string[];
  sentence: string;
  verdict: MeaningUseVerdict | "skipped";
  reasons: string[];
  learner_note: string;
  meaning_judged: false;
  semantic_status: "not_evaluated";
  checked_at: string;
  event_type: "meaning_use";
}

export interface MeaningUseOfferInput {
  aspect: string;
  cardId: string;
  lemma: string;
  forms?: readonly string[];
  enrichment_status?: string;
}

export function buildMeaningUseOffer(input: {
  aspect: string;
  cardId: string;
  orthography?: string;
  inReadyPool: boolean;
}): MeaningUseOfferInput | null {
  if (input.aspect !== "meaning" || !input.inReadyPool) return null;
  const orthography = input.orthography?.trim() ?? "";
  if (!orthography) return null;
  return {
    aspect: "meaning",
    cardId: input.cardId,
    lemma: orthography,
    forms: [orthography],
    enrichment_status: "ready",
  };
}

export function meaningUseKeyAction(key: string): "submit" | "ignore" {
  if (key === "Enter") return "submit";
  return "ignore";
}

export function normalizeRoundPhase(phase: unknown): "answer" | "grade" | "summary" | "use" {
  if (phase === "grade" || phase === "summary" || phase === "answer" || phase === "use") return phase;
  return "answer";
}

interface Attempt {
  id: string;
  cardId: string;
  lemma: string;
  forms: string[];
  text: string;
  note: string | null;
  terminal: MeaningUseRecord | null;
  inflight: boolean;
}

export interface MeaningUseStepResult {
  offered: boolean;
  already: boolean;
  saved: boolean;
  records: number;
  note: string | null;
  verdict?: MeaningUseRecord["verdict"];
  message?: string;
  advance?: boolean;
  handled?: "submit" | "ignore";
}

function idleResult(records: number, extra: Partial<MeaningUseStepResult> = {}): MeaningUseStepResult {
  return {
    offered: false,
    already: false,
    saved: false,
    records,
    note: null,
    ...extra,
  };
}

export function createMeaningUseStep(deps: {
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  now: () => Date;
  newId: () => string;
  key?: string;
}) {
  const key = deps.key ?? MEANING_USE_STORAGE_KEY;
  let records: MeaningUseRecord[] = [];
  let held = false;
  let loaded = false;
  let attempt: Attempt | null = null;
  let continued = false;

  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    let raw: string | null = null;
    try {
      raw = deps.storage.getItem(key);
    } catch {
      held = true;
      return;
    }
    if (raw === null || raw === "") return;
    try {
      const parsed = JSON.parse(raw) as { schema_version?: unknown; records?: unknown };
      if (parsed?.schema_version !== MEANING_USE_SCHEMA_VERSION || !Array.isArray(parsed.records)) {
        held = true;
        return;
      }
      records = parsed.records as MeaningUseRecord[];
    } catch {
      held = true;
    }
  }

  function write(next: MeaningUseRecord[]) {
    deps.storage.setItem(
      key,
      JSON.stringify({ schema_version: MEANING_USE_SCHEMA_VERSION, records: next }),
    );
  }

  function existingFor(cardId: string): MeaningUseRecord | undefined {
    return records.find(
      (row) => row.card_id === cardId && (row.verdict === "basic_pass" || row.verdict === "skipped"),
    );
  }

  function offer(input: MeaningUseOfferInput): MeaningUseStepResult {
    ensureLoaded();
    if (held) {
      return idleResult(records.length, { message: MEANING_USE_HELD_MESSAGE });
    }
    if (input.aspect !== "meaning" || input.enrichment_status !== "ready" || !input.lemma.trim()) {
      return idleResult(records.length);
    }
    const prior = existingFor(input.cardId);
    if (prior) {
      attempt = {
        id: prior.id,
        cardId: input.cardId,
        lemma: input.lemma,
        forms: [...(input.forms ?? [input.lemma])],
        text: prior.sentence,
        note: prior.learner_note,
        terminal: prior,
        inflight: false,
      };
      return idleResult(records.length, { already: true, saved: true, note: prior.learner_note });
    }
    attempt = {
      id: deps.newId(),
      cardId: input.cardId,
      lemma: input.lemma.trim(),
      forms: [...(input.forms?.length ? input.forms : [input.lemma.trim()])],
      text: "",
      note: null,
      terminal: null,
      inflight: false,
    };
    continued = false;
    return {
      offered: true,
      already: false,
      saved: false,
      records: records.length,
      note: null,
    };
  }

  function setText(text: string) {
    if (!attempt || attempt.terminal) return;
    attempt.text = text;
  }

  function submit(): MeaningUseStepResult {
    ensureLoaded();
    if (held) return idleResult(records.length, { message: MEANING_USE_HELD_MESSAGE });
    if (!attempt) return idleResult(records.length);
    if (attempt.inflight) return idleResult(records.length, { note: attempt.note });
    if (attempt.terminal) {
      return idleResult(records.length, {
        saved: true,
        note: attempt.note,
        verdict: attempt.terminal.verdict,
      });
    }
    attempt.inflight = true;
    try {
      const checked = checkMeaningUse({
        lemma: attempt.lemma,
        forms: attempt.forms,
        sentence: attempt.text,
        enrichment_status: "ready",
      });
      if (checked.verdict !== "basic_pass") {
        attempt.note = checked.learner_note;
        return idleResult(records.length, { note: checked.learner_note, verdict: checked.verdict });
      }
      const record: MeaningUseRecord = {
        schema_version: 1,
        id: attempt.id,
        card_id: attempt.cardId,
        lemma: attempt.lemma,
        forms: [...attempt.forms],
        sentence: attempt.text,
        verdict: "basic_pass",
        reasons: [...checked.reasons],
        learner_note: checked.learner_note,
        meaning_judged: false,
        semantic_status: "not_evaluated",
        checked_at: deps.now().toISOString(),
        event_type: "meaning_use",
      };
      const next = [...records, record];
      try {
        write(next);
      } catch {
        attempt.note = MEANING_USE_SAVE_FAILED_MESSAGE;
        return idleResult(records.length, { note: MEANING_USE_SAVE_FAILED_MESSAGE });
      }
      records = next;
      attempt.terminal = record;
      attempt.note = checked.learner_note;
      return idleResult(records.length, {
        saved: true,
        note: checked.learner_note,
        verdict: "basic_pass",
      });
    } finally {
      attempt.inflight = false;
    }
  }

  function skip(): MeaningUseStepResult {
    ensureLoaded();
    if (held) return idleResult(records.length, { message: MEANING_USE_HELD_MESSAGE });
    if (!attempt) return idleResult(records.length);
    if (attempt.terminal) {
      return idleResult(records.length, { saved: true, note: attempt.note, verdict: attempt.terminal.verdict });
    }
    const record: MeaningUseRecord = {
      schema_version: 1,
      id: attempt.id,
      card_id: attempt.cardId,
      lemma: attempt.lemma,
      forms: [...attempt.forms],
      sentence: attempt.text,
      verdict: "skipped",
      reasons: ["skipped"],
      learner_note: MEANING_USE_SKIP_NOTE,
      meaning_judged: false,
      semantic_status: "not_evaluated",
      checked_at: deps.now().toISOString(),
      event_type: "meaning_use",
    };
    const next = [...records, record];
    try {
      write(next);
    } catch {
      attempt.note = MEANING_USE_SAVE_FAILED_MESSAGE;
      return idleResult(records.length, { note: MEANING_USE_SAVE_FAILED_MESSAGE });
    }
    records = next;
    attempt.terminal = record;
    attempt.note = MEANING_USE_SKIP_NOTE;
    return idleResult(records.length, { saved: true, note: MEANING_USE_SKIP_NOTE, verdict: "skipped" });
  }

  function finish(): { advance: boolean } {
    if (!attempt?.terminal || continued) return { advance: false };
    continued = true;
    return { advance: true };
  }

  function applyKey(key: string): MeaningUseStepResult {
    if (meaningUseKeyAction(key) === "submit") {
      return { ...submit(), handled: "submit" };
    }
    return idleResult(records.length, { handled: "ignore" });
  }

  function view() {
    if (!attempt) {
      return { mode: "hidden" as const, lemma: "", text: "", note: null as string | null, canContinue: false };
    }
    return {
      mode: attempt.terminal ? ("done" as const) : ("draft" as const),
      lemma: attempt.lemma,
      text: attempt.text,
      note: attempt.note,
      canContinue: Boolean(attempt.terminal),
    };
  }

  return { offer, setText, submit, skip, finish, applyKey, view };
}

export type MeaningUseStep = ReturnType<typeof createMeaningUseStep>;
