/**
 * Curriculum Director — proposes a day plan. It does not publish a batch
 * or touch card schedules. Acceptance is an explicit choice.
 */

import type { Aspect } from "../models/types.js";
import { dayIdShanghai } from "../format.js";
import { AgentEventLog, type PlanVariant, type ProposalRecord } from "./event-log.js";
import { assertSingleAspect, SchedulePolicyError } from "./policy.js";

const LOAD_CAP = 5;

export class CurriculumDirector {
  constructor(private readonly log: AgentEventLog) {}

  estimateLoad(lexemeIds: string[]): { max_lexemes: number; aspects: number; capped: string[] } {
    const capped = lexemeIds.slice(0, LOAD_CAP);
    const estimate = { max_lexemes: LOAD_CAP, aspects: 1, capped };
    this.log.recordRun({
      agent: "curriculum_director",
      tools: ["estimateLoad"],
      status: "ok",
      output_ref: `${capped.length}/${LOAD_CAP}`,
    });
    return estimate;
  }

  proposeDayPlan(input: {
    lexemeIds: string[];
    now?: Date;
    intent?: string;
    /** Optional static/generated quest id for the form+quest combo. */
    questId?: string;
  }): ProposalRecord {
    const estimate = this.estimateLoad(input.lexemeIds);
    const lexemeIds = estimate.capped;
    if (lexemeIds.length === 0) {
      throw new SchedulePolicyError("Curriculum Director has no lexemes to plan.");
    }

    const intent = input.intent?.trim() || "text-first tide";
    this.log.recordEvent({
      event_type: "intent",
      payload: { intent, lexeme_ids: lexemeIds, day_id: dayIdShanghai(input.now) },
    });

    const variants: PlanVariant[] = [
      {
        id: "v-form",
        aspect: "form",
        lexeme_ids: lexemeIds,
        label: "形界潮汐 · 拼写提取",
        load: lexemeIds.length,
      },
      {
        id: "v-meaning",
        aspect: "meaning",
        lexeme_ids: lexemeIds,
        label: "义界潮汐 · 中文义提取",
        load: lexemeIds.length,
      },
      {
        id: "v-form-quest",
        aspect: "form",
        lexeme_ids: lexemeIds,
        label: "形界潮汐 + 信息差 Quest（Quest 不改卡）",
        load: lexemeIds.length,
        include_quest: true,
        quest_id: input.questId ?? "echo-bazaar-info-gap-01",
      },
    ];
    for (const variant of variants) assertSingleAspect([variant.aspect]);
    if (variants.length < 2 || variants.length > 3) {
      throw new SchedulePolicyError(
        `Director must present 2–3 proposals, got ${variants.length}.`,
      );
    }

    const proposal = this.log.addProposal({
      day_id: dayIdShanghai(input.now),
      intent,
      variants,
      user_edits: {},
      load_estimate: { max_lexemes: LOAD_CAP, aspects: 1 },
      status: "presented",
    });
    this.log.recordRun({
      agent: "curriculum_director",
      tools: ["proposeDayPlan", "estimateLoad"],
      status: "ok",
      output_ref: proposal.id,
    });
    return proposal;
  }

  accept(proposalId: string, variantId: string): PlanVariant {
    const proposal = this.log.proposals.find((row) => row.id === proposalId);
    if (!proposal) throw new SchedulePolicyError(`Missing proposal ${proposalId}`);
    const variant = proposal.variants.find((row) => row.id === variantId);
    if (!variant) throw new SchedulePolicyError(`Missing variant ${variantId}`);
    assertSingleAspect([variant.aspect]);
    if (variant.lexeme_ids.length > LOAD_CAP) {
      throw new SchedulePolicyError(
        `Load cap is ${LOAD_CAP} lexemes, variant has ${variant.lexeme_ids.length}.`,
      );
    }
    proposal.chosen_id = variant.id;
    proposal.status = "accepted";
    proposal.decided_at = new Date().toISOString();
    this.log.recordEvent({
      event_type: "proposal_accepted",
      payload: {
        proposal_id: proposal.id,
        variant_id: variant.id,
        aspect: variant.aspect,
        lexeme_ids: variant.lexeme_ids,
        include_quest: Boolean(variant.include_quest),
        quest_id: variant.quest_id ?? null,
      },
    });
    return variant;
  }

  reject(proposalId: string, reason = "user rejected"): void {
    const proposal = this.log.proposals.find((row) => row.id === proposalId);
    if (!proposal) throw new SchedulePolicyError(`Missing proposal ${proposalId}`);
    proposal.status = "rejected";
    proposal.decided_at = new Date().toISOString();
    this.log.recordEvent({
      event_type: "proposal_rejected",
      payload: { proposal_id: proposal.id, reason },
    });
  }

  /** Record a request that breaks TOPRA or the load cap. Nothing is applied. */
  requestException(lexemeIds: string[], aspects: readonly Aspect[]): void {
    try {
      assertSingleAspect(aspects);
      if (lexemeIds.length > LOAD_CAP) {
        throw new SchedulePolicyError(
          `Load cap is ${LOAD_CAP}, exception requested ${lexemeIds.length}.`,
        );
      }
      this.log.recordRun({
        agent: "curriculum_director",
        tools: ["requestException"],
        status: "ok",
        output_ref: "within cap; still not auto-applied",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.recordRun({
        agent: "curriculum_director",
        tools: ["requestException"],
        status: "blocked",
        error_message: message,
      });
      throw error;
    }
  }
}
