# 言灵残片 Echo Shards

文字先行的英语学习：用 **ts-fsrs** 做陈述保持，一轮只练一个 aspect（形 / 义 / 音文字），再用信息差 Quest 把词用出来。

Text-first English study. Statement memory goes through **ts-fsrs**. One aspect per batch. Info-gap quests stay in their own table. Remembering a word is not the same as using it.

本仓库是 monorepo。语音（ASR / TTS / 发音评分）只有接口占位，不实现。

## 原则 / Principles

- 等级 1–4 只进 `TideScheduler.rate`。没有人、也没有模型，可以直接写 `due`。
- TOPRA：每个 `(lexeme × aspect)` 一张 FSRS 卡。一批大约 5 个词，只锁一个 aspect。
- `cards` 与 `quest_runs` 分表。Quest 成功看 `must_elicit` 是否被问出。
- 词地板是 NGSL-Spoken 1.2（721 lemmas）。义项大多 `pending`。不要编造中文释义。

## 本地运行 / Run locally

需要 Node ≥ 18。

```bash
npm install
npm test          # demo + quest YAML + policy checks
npm run dev       # http://127.0.0.1:43123
```

单独命令：

| Command | What it does |
| --- | --- |
| `npm run demo` | 5 个种子词的形界潮汐，打印 Asia/Shanghai due。结束时应看到 `Demo OK.` |
| `npm run demo:quest` | 校验 `content/quests/echo-bazaar-info-gap-01.yaml` |
| `npm run demo:policy` | 拒绝写 due、TOPRA 单 aspect、721/671 词量、must_elicit |
| `npm run typecheck` | `packages/core` 与 `apps/web` |
| `npm run lint` | Next.js eslint |
| `npm run import:ngsl-s` | 从官方词表重写 `content/lexemes/ngsl-s-*.json`（不发明 gloss） |

开发服务器绑定 `0.0.0.0:43123`。页面：

- `/` 营地：词量与三条路
- `/review` 形界复习，due 来自 TideScheduler
- `/lexemes` NGSL-S 地板，待审校行不显示假释义
- `/quests` 回声交易所文字桩

## 目录 / Layout

```
apps/web/                 Next.js
packages/core/            模型、TideScheduler、agents、demos
content/packs/ngsl-s-1.2/ 官方词表 + NOTICE + CITATION（CC BY-SA 4.0）
content/lexemes/          种子与导入 JSON
content/quests/           Quest YAML
schemas/quest.schema.json
supabase/migrations/      001 文字基础，002 内容与事件
scripts/import-ngsl-s.ts
docs/                     数据需求、字段字典、AI-native 笔记
ARCHITECTURE.md           模块 ↔ agent ↔ 表
```

模块和表的对照见 [ARCHITECTURE.md](ARCHITECTURE.md)。字段字典见 [docs/schema.md](docs/schema.md)。

## 迁移 / Migrations

还没接云端 Supabase。SQL 是 Postgres 草案，按顺序应用：

1. `supabase/migrations/001_text_foundation.sql` — users、lexemes、cards、review_logs、quests、quest_runs、progress
2. `supabase/migrations/002_content_and_events.sql` — content packs、senses、session_batches、agent_runs、session_proposals、learning_events、learner_memory_items、eval_scores

```bash
# 装了 Supabase CLI 时
supabase db reset
```

Demo 与网页复习用内存（复习进度还可留在浏览器 localStorage）。调度规则以 `TideScheduler` 为准，不以来表为准。

## 许可 / License

- 应用代码：**UNLICENSED**（保留所有权利）。见 [LICENSE](LICENSE)。
- `content/packs/ngsl-s-1.2/`：**CC BY-SA 4.0**，Charles Browne & Brent Culligan。保留该目录的 NOTICE 与 CITATION。
- `ts-fsrs`、`zod`、`yaml`：MIT。

衍生分发词表时，词表部分继续 CC BY-SA，并带上署名。
