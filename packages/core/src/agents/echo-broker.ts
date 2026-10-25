/**
 * Echo Broker — text info-gap only.
 * Success is must_elicit checked in code, not a fluency score.
 * Quest runs never write SRS cards.
 */

import type { Quest } from "../models/types.js";
import { AgentEventLog } from "./event-log.js";

export interface ElicitHit {
  item: string;
  hit: boolean;
  tokens: string[];
}

export interface DealResult {
  success: boolean;
  reason: string;
}

/** Latin tokens long enough to be a real elicit target, not a Chinese gloss. */
export function elicitTokens(item: string): string[] {
  return item.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? [];
}

export function checkMustElicit(quest: Quest, learnerText: string): ElicitHit[] {
  const haystack = learnerText.toLowerCase();
  return quest.must_elicit.map((item) => {
    const tokens = elicitTokens(item);
    const hit = tokens.length > 0 && tokens.some((token) => haystack.includes(token));
    return { item, hit, tokens };
  });
}

export class EchoBroker {
  constructor(private readonly log: AgentEventLog) {}

  check(quest: Quest, learnerText: string): ElicitHit[] {
    const hits = checkMustElicit(quest, learnerText);
    this.log.recordRun({
      agent: "echo_broker",
      tools: ["checkMustElicit"],
      status: "ok",
      input_ref: quest.id,
      output_ref: `${hits.filter((hit) => hit.hit).length}/${hits.length}`,
    });
    for (const hit of hits) {
      this.log.recordEvent({
        event_type: hit.hit ? "must_elicit_hit" : "must_elicit_miss",
        payload: { quest_id: quest.id, item: hit.item },
      });
    }
    return hits;
  }

  finalizeDeal(quest: Quest, hits: ElicitHit[], turns: number): DealResult {
    const missing = hits.filter((hit) => !hit.hit).map((hit) => hit.item);
    let result: DealResult;
    if (missing.length > 0) {
      result = {
        success: false,
        reason: `还有没问出来的信息：${missing.join(" / ")}`,
      };
    } else if (turns > quest.max_turns) {
      result = {
        success: false,
        reason: `超过 max_turns（${quest.max_turns}）`,
      };
    } else {
      result = { success: true, reason: "must_elicit 已全部勾选，文字成交。" };
    }
    this.log.recordRun({
      agent: "echo_broker",
      tools: ["finalizeDeal"],
      status: "ok",
      input_ref: quest.id,
      output_ref: result.success ? "success" : "fail",
    });
    this.log.recordEvent({
      event_type: result.success ? "quest_success" : "quest_fail",
      payload: { quest_id: quest.id, turns, reason: result.reason },
    });
    return result;
  }
}
