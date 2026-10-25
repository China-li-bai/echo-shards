# 言灵残片 Echo Shards — 文字基础数据与技术支撑

> 本阶段范围：**文字 only**。用最快路径证明「陈述保持 FSRS + TOPRA 分轮 + 文字信息差 Quest」回路。

调研/方案时间：2026-10-24（Asia/Shanghai）

## 一句话原则

文字最高效路径 = **陈述保持（ts-fsrs）** + **TOPRA 分轮（形 / 义 / 音文字）** + **文字信息差产出（Quest）**。  
记得 ≠ 会用：SRS 卡与 Quest **分表**；文字 Quest 也强制信息差输出，不能只有闪卡。

## 本阶段做 / 不做

### 做
- Lexeme / Aspect / Card / SessionBatch / Quest / Progress 数据模型（Zod）
- `TideScheduler`（封装 `ts-fsrs`）：getDue、rate、新卡入队
- 5 词种子 + 1 个文字信息差 Quest YAML + schema 校验
- Supabase/Postgres 迁移草案（可先不连云）
- CLI demo：形界一轮 → 评分 → 打印 due

### 不做（明确砍掉）
- ASR / TTS / 发音评分
- 压缩门 / 音炉（语音玩法）
- Fork Anki / LibreLingo
- 真实连云 Supabase（本仓库用内存；SQL 仅草案）
- genanki 导出（仅预留注释，本阶段不实现）

## 安装与 Demo

需要 Node ≥ 18。

```bash
cd /workspace/echo-shards
npm install
npm run demo          # 5 词形界潮汐回路
npm run demo:quest    # 校验信息差 Quest YAML
npm run typecheck     # 可选
```

期望：`Demo OK.`，并打印各卡下次 due（Asia/Shanghai）。

## 目录说明

```
echo-shards/
├── content/
│   ├── packs/ngsl-s-1.2/                  # NGSL-S 官方词表 + NOTICE（CC BY-SA）
│   ├── lexemes/                           # seed + ngsl-s 导入产物 + top50 enrichment
│   └── quests/echo-bazaar-info-gap-01.yaml
├── scripts/import-ngsl-s.ts
├── docs/data-requirements.md
├── docs/schema.md
├── schemas/quest.schema.json              # JSON Schema（与 Zod 对齐）
├── src/
│   ├── models/types.ts                    # Lexeme / Card / Quest / …
│   ├── scheduler/TideScheduler.ts         # ts-fsrs 封装
│   ├── quest/loadQuest.ts                 # YAML → Zod
│   ├── providers/voice-placeholder.ts     # 语音接口占位（不实现）
│   └── demo/run-form-round.ts
├── supabase/migrations/001_text_foundation.sql
├── supabase/migrations/002_content_and_events.sql
├── package.json
└── README.md
```

## 数据要点

| 实体 | 要点 |
|------|------|
| Lexeme | lemma、orthography、**phonetic_text**（仅文字）、gloss_zh、例句… |
| Aspect | `form` \| `meaning` \| `phonology_text` |
| Card | `(user × lexeme × aspect)` 独立 FSRS 状态 |
| SessionBatch | ~5 词，一轮只一个 aspect |
| Quest | student_knows / npc_knows / **must_elicit** / rubric |
| Progress | xp / shards / camp_level 占位 |

默认 `request_retention = 0.9`（ts-fsrs 默认），在 `TideScheduler` 构造参数可改。

## 存储

- **Demo**：内存 `Map`（见 `TideScheduler`）
- **生产草案**：`supabase/migrations/001_text_foundation.sql`
- **本地替代**：可用 SQLite 建同名字段表；不必本阶段接通

索引：`cards(due)`、`cards(user_id)`、`cards(lexeme_id, aspect)`。

## 下一阶段如何插语音（仅接口）

见 `src/providers/voice-placeholder.ts`：

- `AsrProvider.transcribe`
- `TtsProvider.synthesize`
- `PronunciationProvider.score`

文字对话管线先跑通后，再把 Provider 注入「回声交易所」回合；**不要**把语音分数直接当成 FSRS grade——口语结果另表，再按产品规则写回 review_log。


## 数据需求与词库（2026-10-25）

**先需求后表。** 详见：

- 数据需求清单：[`docs/data-requirements.md`](docs/data-requirements.md)
- 字段字典 / ER：[`docs/schema.md`](docs/schema.md)
- 迁移：`supabase/migrations/001_text_foundation.sql` + **`002_content_and_events.sql`**

### 词量策略（证据校准）

- MVP：**NGSL-Spoken 1.2 ≈ 721 lemma** 作日常开口地板（口语覆盖可至 ~90%，Browne & Culligan；Webb/BBC 大众表述约 800–1000 ≈ 75%「起步日常」）
- 路线图：Phase2→~2000，Phase3→~3000 families（Nation 口语 ~95%）
- **覆盖 ≠ 会说** — 仍需 Quest 产出回路

### 导入 NGSL-S

```bash
npm run import:ngsl-s
# 产出：content/lexemes/ngsl-s-1.2-*.json ；官方包在 content/packs/ngsl-s-1.2/（CC BY-SA 4.0 + NOTICE）
```

当前统计：721 lemmas / 前 50 enrichment ready / 其余 pending（禁止编造伪义项）。

## 许可与依赖

- `ts-fsrs` MIT
- `zod` / `yaml` MIT
- 本仓库产品代码暂 `UNLICENSED`（内部）

## 相关方案页

- 玩法设计、整体框架与开源选型：见 Cursor Canvas（父仓库 store）
- 开源选型全文：`/cursor/stores/.../echo-shards/oss-selection-2026-10-24.md`
