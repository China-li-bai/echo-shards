/**
 * In-memory stand-in for agent_runs, session_proposals, learning_events, eval_scores.
 * Shape follows supabase/migrations/002_content_and_events.sql. Not a database client.
 */

export type AgentName =
  | "tide_steward"
  | "forge_smith"
  | "echo_broker"
  | "curriculum_director"
  | "eval_sentinel"
  | "learner_memory";

export type AgentRunStatus = "ok" | "error" | "blocked" | "skipped";

export interface AgentRunRecord {
  id: string;
  agent: AgentName;
  tools: string[];
  input_ref?: string;
  output_ref?: string;
  status: AgentRunStatus;
  error_message?: string;
  created_at: string;
}

export interface PlanVariant {
  id: string;
  aspect: "form" | "meaning" | "phonology_text";
  lexeme_ids: string[];
  label: string;
  load: number;
  /** Optional info-gap after the tide. Quest never grades cards. */
  include_quest?: boolean;
  quest_id?: string;
}

export interface ProposalRecord {
  id: string;
  day_id: string;
  intent?: string;
  variants: PlanVariant[];
  chosen_id?: string;
  user_edits: Record<string, unknown>;
  load_estimate: { max_lexemes: number; aspects: number };
  status: "draft" | "presented" | "accepted" | "rejected" | "expired";
  created_at: string;
  decided_at?: string;
}

export type LearningEventType =
  | "intent"
  | "proposal_accepted"
  | "proposal_rejected"
  | "retrieval_grade"
  | "must_elicit_hit"
  | "must_elicit_miss"
  | "quest_success"
  | "quest_fail"
  | "abandon"
  | "session_start"
  | "session_end"
  | "enrichment_request"
  | "policy_breach";

export interface LearningEventRecord {
  id: string;
  event_type: LearningEventType;
  card_id?: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface EvalScoreRecord {
  id: string;
  suite: string;
  item_id?: string;
  metric: string;
  score: number | null;
  breach_flags: string[];
  created_at: string;
}

export interface EventLogSnapshot {
  runs: AgentRunRecord[];
  proposals: ProposalRecord[];
  events: LearningEventRecord[];
  eval_scores: EvalScoreRecord[];
}

function nid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export class AgentEventLog {
  readonly runs: AgentRunRecord[] = [];
  readonly proposals: ProposalRecord[] = [];
  readonly events: LearningEventRecord[] = [];
  readonly evalScores: EvalScoreRecord[] = [];

  recordRun(input: Omit<AgentRunRecord, "id" | "created_at">): AgentRunRecord {
    const row: AgentRunRecord = {
      ...input,
      id: nid("run"),
      created_at: new Date().toISOString(),
    };
    this.runs.push(row);
    return row;
  }

  addProposal(input: Omit<ProposalRecord, "id" | "created_at"> & { id?: string }): ProposalRecord {
    const row: ProposalRecord = {
      ...input,
      id: input.id ?? nid("prop"),
      created_at: new Date().toISOString(),
    };
    this.proposals.push(row);
    return row;
  }

  recordEvent(
    input: Omit<LearningEventRecord, "id" | "created_at">,
  ): LearningEventRecord {
    const row: LearningEventRecord = {
      ...input,
      id: nid("evt"),
      created_at: new Date().toISOString(),
    };
    this.events.push(row);
    return row;
  }

  recordEval(input: Omit<EvalScoreRecord, "id" | "created_at">): EvalScoreRecord {
    const row: EvalScoreRecord = {
      ...input,
      id: nid("eval"),
      created_at: new Date().toISOString(),
    };
    this.evalScores.push(row);
    return row;
  }

  snapshot(): EventLogSnapshot {
    return {
      runs: this.runs.map((row) => ({ ...row, tools: [...row.tools] })),
      proposals: this.proposals.map((row) => ({
        ...row,
        variants: row.variants.map((variant) => ({
          ...variant,
          lexeme_ids: [...variant.lexeme_ids],
        })),
        user_edits: { ...row.user_edits },
        load_estimate: { ...row.load_estimate },
      })),
      events: this.events.map((row) => ({ ...row, payload: { ...row.payload } })),
      eval_scores: this.evalScores.map((row) => ({
        ...row,
        breach_flags: [...row.breach_flags],
      })),
    };
  }

  restore(state: EventLogSnapshot): void {
    this.runs.length = 0;
    this.proposals.length = 0;
    this.events.length = 0;
    this.evalScores.length = 0;
    this.runs.push(...state.runs);
    this.proposals.push(...state.proposals);
    this.events.push(...state.events);
    this.evalScores.push(...state.eval_scores);
  }
}
