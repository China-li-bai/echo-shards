# Echo Shards · AI-native engineering notes

文字阶段 Agent 工具边界（对齐产品页「言灵残片·AI Native 产品设计」）。

## Invariant

- **Models propose; TideScheduler / Zod / success_criteria decide.**
- LLM 不得直接写 `cards.due` / `stability` / `scheduled_days`。
- Quest 成功以 `must_elicit` 程序勾选为准，不以对话流畅度为准。

## Agents → tools → stores

| Agent | Allowed tools | Writes | Forbidden |
| --- | --- | --- | --- |
| Tide Steward | `getDue`, `buildSessionBatch`, `explainWhyTheseCards` | via `TideScheduler.rate` only | raw SQL on cards schedule fields |
| Forge Smith | `lockAspect`, `genRetrievalItem`, `suggestDistractors`, `assistGrade` | `review_logs` + rate | open 2+ aspects in one batch |
| Echo Broker | `draftQuest`, `adaptTurn`, `checkMustElicit`, `finalizeDeal` | `quests` (origin=generated), `quest_runs` | mark success without criteria |
| Curriculum Director | `proposeDayPlan`, `estimateLoad`, `requestException` | `proposals`, intent events | auto-public without approval |
| Learner Memory | `upsertEpisode`, `retrieveRelevant`, `summarizeWeek` | `learner_memory_items` | dump full chat into prompt |
| Eval Sentinel | `runGoldSuite`, `scoreDealRate`, `flagPolicyBreach` | `eval_scores` | bypass on prod “success” badge |

## Suggested schema (on top of `001_text_foundation.sql`)

- `agent_runs(id, agent, tools jsonb, input_ref, output_ref, cost_tokens, created_at)`
- `proposals(id, day_id, variants jsonb, chosen_id, user_edits jsonb)`
- `eval_scores(id, suite, item_id, metric, score, breach_flags jsonb)`
- `learner_memory_items(id, user_id, kind, payload jsonb, embedding_ref, expires_at)`
- alter `quests` add `origin text check (origin in ('static','generated'))`
- alter `quest_runs` add `must_elicit_hits jsonb`

## P0 engineering order

1. Broker: generate Quest YAML matching existing Zod schema from weak lexemes; deterministic `checkMustElicit`.
2. Smith: retrieval item gen for form/meaning; grade enum → `TideScheduler`.
3. Director: CLI day plan with 2–3 proposals + load cap.
4. Instrument events: intent, proposal_accepted, retrieval_grade, must_elicit_hit, abandon.
