/**
 * Open one TOPRA batch: director proposes, steward enqueues every aspect,
 * smith builds items for the locked aspect only.
 */

import type { Aspect, Lexeme, SessionBatch } from "../models/types.js";
import { AgentEventLog, type ProposalRecord } from "../agents/event-log.js";
import { CurriculumDirector } from "../agents/curriculum-director.js";
import { ForgeSmith, type RetrievalItem } from "../agents/forge-smith.js";
import { TideSteward } from "../agents/tide-steward.js";
import { TideScheduler } from "../scheduler/TideScheduler.js";

export const LOCAL_LEARNER_ID = "local-learner";

export const TOPRA_ASPECTS = ["form", "meaning", "phonology_text"] as const satisfies readonly Aspect[];

export interface OpenRound {
  proposal: ProposalRecord;
  batch: SessionBatch;
  items: RetrievalItem[];
  why: string;
  parked_aspects: Aspect[];
}

export function openAspectRound(input: {
  tide: TideScheduler;
  log: AgentEventLog;
  lexemes: Lexeme[];
  userId?: string;
  aspect?: Aspect;
  now?: Date;
}): OpenRound {
  const now = input.now ?? new Date();
  const userId = input.userId ?? LOCAL_LEARNER_ID;
  const aspect = input.aspect ?? "form";
  const director = new CurriculumDirector(input.log);
  const proposal = director.proposeDayPlan({
    lexemeIds: input.lexemes.map((lexeme) => lexeme.id),
    now,
    intent: `${aspect} tide`,
  });
  const variantId = aspect === "meaning" ? "v-meaning" : "v-form";
  const variant = director.accept(proposal.id, variantId);
  if (variant.aspect !== aspect && aspect !== "phonology_text") {
    throw new Error(`Accepted ${variant.aspect} while opening ${aspect}.`);
  }
  const lockedAspect: Aspect = aspect === "phonology_text" ? "phonology_text" : variant.aspect;
  const ids =
    lockedAspect === variant.aspect
      ? variant.lexeme_ids
      : input.lexemes.slice(0, 5).map((lexeme) => lexeme.id);

  const steward = new TideSteward(input.tide, input.log);
  for (const track of TOPRA_ASPECTS) {
    steward.enqueueIds(userId, ids, track, now);
  }
  const batch = steward.buildSessionBatch(userId, lockedAspect, now);
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
  input.log.recordEvent({
    event_type: "session_start",
    payload: { batch_id: batch.id, aspect: batch.aspect, size: batch.card_ids.length },
  });
  return {
    proposal,
    batch,
    items,
    why,
    parked_aspects: TOPRA_ASPECTS.filter((track) => track !== lockedAspect),
  };
}
