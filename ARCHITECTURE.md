# Architecture

言灵残片 Echo Shards is a text-first English study app. Remembering a form and
using it in an info-gap are different stores. An agent may propose; it does not
schedule.

## Layout

| Path | Role |
| --- | --- |
| `apps/web` | Next.js UI. Day plan, form/meaning/phonology_text review, NGSL floor, enrichment queue, Echo Bazaar, eval. |
| `packages/core` | Zod models, `TideScheduler` (`ts-fsrs`), quest checks, agent tool boundaries. |
| `packages/core/src/demo` | CLI demos. `npm test` runs them (including `demo:day` / `demo:eval`). |
| `content/packs/ngsl-s-1.2` | Official NGSL-Spoken 1.2 files, NOTICE, CITATION (CC BY-SA 4.0). |
| `content/lexemes` | Seed JSON. 721 lemmas; enrichment mostly `pending`. |
| `content/quests` | Static quest YAML. |
| `content/quests/generated` | Echo Broker `draftQuest` JSON (ready lexemes only). |
| `schemas/quest.schema.json` | JSON Schema aligned with `QuestSchema`. |
| `supabase/migrations` | Postgres draft. `001` text foundation, `002` content and events. |
| `scripts/import-ngsl-s.ts` | Rebuilds lexeme JSON from the pack. Does not invent glosses. |
| `scripts/enrichment-*.ts` | Validate / queue / merge enrichment. Pending stays empty gloss_zh. |
| `.data/` | Optional file-backed AgentEventLog + progress for CLI demos (gitignored). |
| `docs/` | Data requirements, field dictionary, AI-native notes from the design phase. |

`packages/core` entry `.` is safe to import from the browser. `./node` reads the filesystem (quest YAML and lexeme JSON) and stays on the server.

## Invariant

Models propose. `TideScheduler.rate` is the only writer of `due`, `stability`, and `scheduled_days`. Grades are 1–4 (`Again` … `Easy`). Quest success is `must_elicit` checked in code. A batch locks one aspect (TOPRA), about five lexemes. Each `(learner × lexeme × aspect)` is its own FSRS card. `cards` and `quest_runs` stay separate tables.

`assertNoScheduleFields` rejects an agent payload that carries schedule fields. `EvalSentinel` records that block. There is no `setDue`.

Client `TideScheduler.snapshot()` / `restore()` (and the web review `localStorage` blob) are **not a trusted schedule authority**. `restore` re-derives card review fields by replaying `ReviewLog` grades through the same FSRS engine as `rate`; a hand-edited due/stability that disagrees with the log chain throws `TideRestoreError` and the UI starts a fresh enqueue. Server-authoritative cards remain a later milestone.

## Agents → modules → tables

| Agent | Module | Tools in this slice | Writes | Tables | Forbidden |
| --- | --- | --- | --- | --- | --- |
| Curriculum Director | `agents/curriculum-director.ts` | `proposeDayPlan`, `estimateLoad`, `requestException` | `session_proposals` (in-memory) | `session_proposals` | Auto-open two aspects; exceed 5 lexemes |
| Tide Steward | `agents/tide-steward.ts` | `getDue`, `buildSessionBatch`, `explainWhyTheseCards`, `enqueueAspect`, `rate` | FSRS state only via `TideScheduler.rate`; `review_logs` | `cards`, `review_logs`, `session_batches` | Raw updates to `due` / `stability` / `scheduled_days` |
| Forge Smith | `agents/forge-smith.ts` | `lockAspect`, `genRetrievalItem`, `suggestDistractors`, `assistGrade` | Grade enum only | `review_logs` after Steward `rate` | A second aspect in the same batch; writing `due` |
| Echo Broker | `agents/echo-broker.ts` | `draftQuest`, `checkMustElicit`, `adaptTurn`, `finalizeDeal`, `abandon` | Quest hit list | `quests`, `quest_runs` | Marking success without `must_elicit`; touching cards; inventing glosses |
| Eval Sentinel | `agents/eval-sentinel.ts` | `runGoldSuite`, `scoreDealRate`, `flagPolicyBreach` | Scores and breach flags | `eval_scores`, `learning_events` | Treating a policy block as a learner success |
| Learner Memory | `agents/learner-memory.ts` | `upsertEpisode` | Short structured text | `learner_memory_items` | Full transcript dumps |

The web process keeps `AgentEventLog` in memory (and, for the review round, `localStorage`). CLI demos may append snapshots under `.data/` via `FileEventStore`. Camp `/` derives xp/shards/streak from those events when present (`progressFromEvents`). Mirrors `agent_runs`, `session_proposals`, `learning_events`, `eval_scores`, and `progress` from the SQL drafts. Nothing here connects to hosted Supabase.

Voice is a placeholder interface in `packages/core/src/providers/voice-placeholder.ts`. ASR, TTS, and pronunciation scoring are not implemented, and a pronunciation score is not an FSRS grade.

## Request path (P0 日课闭环)

1. `/day` — learner types an intent and picks ≤5 lexemes. Curriculum Director presents 2–3 variants (form, phonology_text when phonetic ready else meaning, form+quest). Explicit accept writes `intent` + `proposal_accepted` and stores the plan in `localStorage`.
2. `/review` — Tide Steward enqueues TOPRA tracks, opens one aspect batch (form / meaning / phonology_text). Forge Smith builds public prompts (form hides spelling; meaning hides gloss; phonology hides IPA). After confirm 1–4, Steward calls `TideScheduler.rate` and logs `retrieval_grade`.
3. `/quests` — Echo Broker lists static YAML + `content/quests/generated`. `checkMustElicit` / `adaptTurn` / `finalizeDeal` / `abandon`. Chinese-only fails; English elicit tokens succeed. Quest never grades cards.
4. `/eval` — Eval Sentinel `runGoldSuite` + Learner Memory short episode. Camp summary of scores and breaches. Persists `.data/` for demo progress.
5. `/enrichment` — read-only queue + merge instructions. No invented glosses.

## Word floor

NGSL-Spoken 1.2 is the spoken floor: 721 lemmas, 2354 forms, 50 enrichment rows touched, 671 pending. Pending rows keep an empty `gloss_zh`. The browser shows 待审校 instead of a made-up gloss. Upstream English definitions from the pack may be shown and are labeled 上游英义.
