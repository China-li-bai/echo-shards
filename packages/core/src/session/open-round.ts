/**
 * Open one TOPRA batch: director proposes, steward enqueues every aspect,
 * smith builds items for the locked aspect only.
 */

import type { Aspect, Lexeme, SessionBatch } from "../models/types.js";
import { AgentEventLog, type ProposalRecord } from "../agents/event-log.js";
import { CurriculumDirector } from "../agents/curriculum-director.js";
import { ForgeSmith, type RetrievalItem } from "../agents/forge-smith.js";
import { TideSteward } from "../agents/tide-steward.js";
import {
  WORD_TIDE_COPY,
  apprenticeLockNote,
  defaultIncludePhonology,
} from "../agents/word-tide-gate.js";
import { TideScheduler } from "../scheduler/TideScheduler.js";

export const LOCAL_LEARNER_ID = "local-learner";

export const TOPRA_ASPECTS = ["form", "meaning", "phonology_text"] as const satisfies readonly Aspect[];

export interface OpenRound {
  proposal: ProposalRecord;
  batch: SessionBatch;
  items: RetrievalItem[];
  why: string;
  parked_aspects: Aspect[];
  /** 闸门旁注（撞车顺延 / 锁态 / 音界休整）；不改 due。 */
  gate_note?: string;
}

function variantIdFor(aspect: Aspect): string {
  if (aspect === "meaning") return "v-meaning";
  if (aspect === "phonology_text") return "v-phonology";
  return "v-form";
}

export function openAspectRound(input: {
  tide: TideScheduler;
  log: AgentEventLog;
  lexemes: Lexeme[];
  userId?: string;
  aspect?: Aspect;
  now?: Date;
  variantId?: string;
  intent?: string;
  /**
   * 学徒路径默认 true：同日单界 + 解锁链过滤（不改 due）。
   * 内容造 prompt / 显式实验轨可传 false。
   */
  applyWordTideGate?: boolean;
}): OpenRound {
  const now = input.now ?? new Date();
  const userId = input.userId ?? LOCAL_LEARNER_ID;
  // 学徒默认义界（解锁链首）；显式传 form/phonology_text 仍可开。
  const aspect = input.aspect ?? "meaning";
  const applyGate = input.applyWordTideGate !== false;
  const director = new CurriculumDirector(input.log);
  const includePhonology =
    aspect === "phonology_text" || defaultIncludePhonology();
  const proposal = director.proposeDayPlan({
    lexemeIds: input.lexemes.map((lexeme) => lexeme.id),
    now,
    intent: input.intent ?? `${aspect} tide`,
    includePhonology,
  });
  const variantId = input.variantId ?? variantIdFor(aspect);
  const variant = director.accept(proposal.id, variantId);
  const lockedAspect = aspect;
  if (variant.aspect !== lockedAspect) {
    throw new Error(`Accepted ${variant.aspect} while opening ${lockedAspect}.`);
  }
  const ids = variant.lexeme_ids;

  const steward = new TideSteward(input.tide, input.log);
  for (const track of TOPRA_ASPECTS) {
    steward.enqueueIds(userId, ids, track, now);
  }
  const batch = steward.buildSessionBatch(userId, lockedAspect, now, {
    applyWordTideGate: applyGate,
  });
  const smith = new ForgeSmith(input.log);
  smith.lockAspect(lockedAspect);
  const byId = new Map(input.lexemes.map((lexeme) => [lexeme.id, lexeme]));
  const items = batch.card_ids.map((cardId) => {
    const card = input.tide.getCard(cardId);
    if (!card) throw new Error(`Missing card ${cardId}`);
    const lexeme = byId.get(card.lexeme_id);
    if (!lexeme) throw new Error(`Missing lexeme ${card.lexeme_id}`);
    return smith.genRetrievalItem(lexeme, cardId, lockedAspect);
  });
  const why = steward.explainWhyTheseCards(batch);

  let gate_note: string | undefined;
  if (applyGate) {
    const gated = steward.gateDue(now, lockedAspect, userId);
    if (gated.sameDayCollision && gated.deferred.length > 0) {
      gate_note = WORD_TIDE_COPY.sameDayDefer;
    } else if (batch.card_ids.length === 0) {
      const sampleId = ids[0];
      gate_note = sampleId
        ? apprenticeLockNote(sampleId, lockedAspect, input.tide.getLogs(), undefined, input.tide.allCards()) ??
          (lockedAspect === "phonology_text"
            ? WORD_TIDE_COPY.phonologyRest
            : WORD_TIDE_COPY.needCrossNightShape)
        : WORD_TIDE_COPY.needCrossNightShape;
    }
  }

  input.log.recordEvent({
    event_type: "session_start",
    payload: {
      batch_id: batch.id,
      aspect: batch.aspect,
      size: batch.card_ids.length,
      gate_note: gate_note ?? null,
      due_unchanged: true,
    },
  });
  return {
    proposal,
    batch,
    items,
    why,
    parked_aspects: TOPRA_ASPECTS.filter((track) => track !== lockedAspect),
    gate_note,
  };
}
