# Architecture

言灵残片 Echo Shards is a text-first English study app. Remembering a form and
using it in an info-gap are different stores. An agent may propose; it does not
schedule.

## Layout

| Path | Role |
| --- | --- |
| `apps/web` | Next.js UI. Form-aspect review, NGSL floor browser, Echo Bazaar stub. |
| `packages/core` | Zod models, `TideScheduler` (`ts-fsrs`), quest checks, agent tool boundaries. |
| `packages/core/src/demo` | CLI demos. `npm test` runs them. |
| `content/packs/ngsl-s-1.2` | Official NGSL-Spoken 1.2 files, NOTICE, CITATION (CC BY-SA 4.0). |
| `content/lexemes` | Seed JSON. 721 lemmas; enrichment mostly `pending`. |
| `content/quests` | Static quest YAML. |
| `schemas/quest.schema.json` | JSON Schema aligned with `QuestSchema`. |
| `supabase/migrations` | Postgres draft. `001` text foundation, `002` content and events. |
| `scripts/import-ngsl-s.ts` | Rebuilds lexeme JSON from the pack. Does not invent glosses. |
| `docs/` | Data requirements, field dictionary, AI-native notes from the design phase. |

`packages/core` entry `.` is safe to import from the browser. `./node` reads the filesystem (quest YAML and lexeme JSON) and stays on the server.

## Invariant

Models propose. `TideScheduler.rate` is the only writer of `due`, `stability`, and `scheduled_days`. Grades are 1–4 (`Again` … `Easy`). Quest success is `must_elicit` checked in code. A batch locks one aspect (TOPRA), about five lexemes. Each `(learner × lexeme × aspect)` is its own FSRS card. `cards` and `quest_runs` stay separate tables.

`assertNoScheduleFields` rejects an agent payload that carries schedule fields. `EvalSentinel` records that block. There is no `setDue`.

## Agents → modules → tables

| Agent | Module | Tools in this slice | Writes | Tables | Forbidden |
| --- | --- | --- | --- | --- | --- |
| Curriculum Director | `agents/curriculum-director.ts` | `proposeDayPlan`, `estimateLoad`, `requestException` | `session_proposals` (in-memory) | `session_proposals` | Auto-open two aspects; exceed 5 lexemes |
| Tide Steward | `agents/tide-steward.ts` | `getDue`, `buildSessionBatch`, `explainWhyTheseCards`, `enqueueAspect`, `rate` | FSRS state only via `TideScheduler.rate`; `review_logs` | `cards`, `review_logs`, `session_batches` | Raw updates to `due` / `stability` / `scheduled_days` |
| Forge Smith | `agents/forge-smith.ts` | `lockAspect`, `genRetrievalItem`, `suggestDistractors`, `assistGrade` | Grade enum only | `review_logs` after Steward `rate` | A second aspect in the same batch; writing `due` |
| Echo Broker | `agents/echo-broker.ts` | `checkMustElicit`, `finalizeDeal` | Quest hit list | `quests`, `quest_runs` | Marking success without `must_elicit`; touching cards |
| Eval Sentinel | `agents/eval-sentinel.ts` | `runGoldSuite`, `scoreDealRate`, `flagPolicyBreach` | Scores and breach flags | `eval_scores`, `learning_events` | Treating a policy block as a learner success |
| Learner Memory | `agents/learner-memory.ts` | `upsertEpisode` | Short structured text | `learner_memory_items` | Full transcript dumps |

The web process keeps `AgentEventLog` in memory (and, for the review round, `localStorage`). It mirrors `agent_runs`, `session_proposals`, `learning_events`, and `eval_scores` from `002_content_and_events.sql`. Nothing here connects to hosted Supabase.

Voice is a placeholder interface in `packages/core/src/providers/voice-placeholder.ts`. ASR, TTS, and pronunciation scoring are not implemented, and a pronunciation score is not an FSRS grade.

## Request path

1. The review page loads seed lexemes or the first ready NGSL rows on the server and builds public prompts. Prompts contain the gloss and a cloze, not the spelling.
2. The browser enqueues form, meaning, and phonology-text cards, then opens a form batch of at most five.
3. Forge Smith (`suggestFormGrade` server action) compares the typed spelling and returns a suggested grade plus the reveal.
4. The learner confirms 1–4. Tide Steward calls `TideScheduler.rate`. The UI prints `due` in Asia/Shanghai.
5. The quest page loads `content/quests/echo-bazaar-info-gap-01.yaml` through Zod. Echo Broker checks Latin tokens against `must_elicit`. That result is not a card grade.

## Word floor

NGSL-Spoken 1.2 is the spoken floor: 721 lemmas, 2354 forms, 50 enrichment rows touched, 671 pending. Pending rows keep an empty `gloss_zh`. The browser shows 待审校 instead of a made-up gloss. Upstream English definitions from the pack may be shown and are labeled 上游英义.
