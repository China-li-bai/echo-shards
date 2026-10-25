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

  proposeDayPlan(input: {
    lexemeIds: string[];
    now?: Date;
    intent?: string;
  }): ProposalRecord {
    const lexemeIds = input.lexemeIds.slice(0, LOAD_CAP);
    if (lexemeIds.length === 0) {
      throw new SchedulePolicyError("Curriculum Director has no lexemes to plan.");
    }
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
        label: "义界潮汐 · 另开一轮",
        load: lexemeIds.length,
      },
    ];
    for (const variant of variants) assertSingleAspect([variant.aspect]);
    const proposal = this.log.addProposal({
      day_id: dayIdShanghai(input.now),
      intent: input.intent ?? "text-first tide",
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
      },
    });
    return variant;
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
