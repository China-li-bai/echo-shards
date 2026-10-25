/**
 * Echo Broker — text info-gap only.
 * Success is must_elicit checked in code, not a fluency score.
 * Quest runs never write SRS cards.
 */

import { QuestSchema, type Lexeme, type Quest } from "../models/types.js";
import { AgentEventLog } from "./event-log.js";
import { SchedulePolicyError } from "./policy.js";

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

/**
 * Build a text info-gap Quest from ready/enriched lexemes only.
 * Orthography tokens become must_elicit targets. Never invents Chinese glosses.
 */
export function draftQuest(input: {
  lexemes: Lexeme[];
  id?: string;
  title?: string;
  maxTurns?: number;
}): Quest {
  const ready = input.lexemes.filter(
    (row) =>
      row.orthography.trim() &&
      row.gloss_zh.trim() &&
      row.example_sentence.trim(),
  );
  if (ready.length < 2) {
    throw new SchedulePolicyError(
      "Echo Broker draftQuest needs at least 2 ready lexemes with real glosses.",
    );
  }
  const picks = ready.slice(0, 5);
  const words = picks.map((row) => row.orthography.toLowerCase());
  const must = picks.map(
    (row) => `${row.orthography} (ask about / use: ${row.gloss_zh.split(/[;；]/)[0]!.trim()})`,
  );
  const draft = {
    id: input.id ?? `generated-${picks.map((row) => row.id).join("-").slice(0, 48)}`,
    title: input.title ?? `动态市集 · ${words.slice(0, 3).join(" / ")}`,
    goal: `用英文向摊主问清并主动用出目标词：${words.join(", ")}。成交前复述关键条件。`,
    roles: {
      student: "营地学徒（买方）——已知预算有限，需要确认价格与时间",
      npc: "回声摊主（卖方）——掌握标价与截止时间，不会主动全盘托出",
    },
    student_knows: [
      "自己预算有限",
      `目标词：${words.join(", ")}`,
      "需要在日落前带回营地",
    ],
    npc_knows: [
      `目标物品涉及：${words.join(", ")}`,
      "若买方提出 bargain，可商量价格",
      "摊位在日落（sunset）关闭",
    ],
    must_elicit: must,
    success_criteria: [
      "学生至少用英文问出价格或时间",
      "学生主动用出 must_elicit 中的目标英文词",
      "学生用英文复述成交条件",
    ],
    target_lexemes: picks.map((row) => row.id),
    max_turns: input.maxTurns ?? 12,
    rubric: [
      "文字回合评分（非语音）：",
      "- 信息差完成度 50%：must_elicit 是否被问出并确认",
      "- 目标词使用 30%：target_lexemes 出现合理用法",
      "- 礼貌与回合效率 20%：未超过 max_turns；无纯中文糊弄过关",
      "失败：只背单词不提问、或未复述成交条件。",
      "Quest 跑次不写 SRS 卡。",
    ].join("\n"),
    modality: "text" as const,
  };
  return QuestSchema.parse(draft);
}

/**
 * Deterministic nudge when must_elicit items are still missing.
 * Does not invent answers; only points at the next open info-gap slot.
 */
export function composeAdaptTurn(quest: Quest, hits: ElicitHit[], turns = 0): string {
  const missing = hits.filter((hit) => !hit.hit);
  if (missing.length === 0) {
    if (turns > quest.max_turns) {
      return "目标信息已齐，但回合超限。下次先问关键条件再收束。";
    }
    return "目标信息已齐。用英文复述成交条件，再点「请求成交」。";
  }
  const next = missing[0]!;
  const tokenHint =
    next.tokens.length > 0
      ? next.tokens.slice(0, 2).join(" / ")
      : next.item.split(/[（(]/)[0]!.trim().slice(0, 40);
  return `还缺 ${missing.length} 项信息。下一句用英文问：${tokenHint}。`;
}

/** @deprecated prefer composeAdaptTurn; kept as the public tool name. */
export const adaptTurn = composeAdaptTurn;

export class EchoBroker {
  constructor(private readonly log: AgentEventLog) {}

  draftQuest(input: {
    lexemes: Lexeme[];
    id?: string;
    title?: string;
    maxTurns?: number;
  }): Quest {
    const quest = draftQuest(input);
    this.log.recordRun({
      agent: "echo_broker",
      tools: ["draftQuest"],
      status: "ok",
      output_ref: quest.id,
    });
    return quest;
  }

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
      payload: {
        quest_id: quest.id,
        turns,
        reason: result.reason,
        // Per-lexeme deal seals on the form shard wall (dual track vs tide「记得」).
        target_lexemes: [...quest.target_lexemes],
        lexeme_ids: [...quest.target_lexemes],
      },
    });
    return result;
  }

  abandon(quest: Quest, reason = "learner abandoned"): void {
    this.log.recordRun({
      agent: "echo_broker",
      tools: ["abandon"],
      status: "ok",
      input_ref: quest.id,
    });
    this.log.recordEvent({
      event_type: "abandon",
      payload: { quest_id: quest.id, reason },
    });
  }

  adaptTurn(quest: Quest, hits: ElicitHit[], turns = 0): string {
    const nudge = composeAdaptTurn(quest, hits, turns);
    this.log.recordRun({
      agent: "echo_broker",
      tools: ["adaptTurn"],
      status: "ok",
      input_ref: quest.id,
      output_ref: nudge.slice(0, 80),
    });
    return nudge;
  }
}
