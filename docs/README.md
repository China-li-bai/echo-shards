# 文档索引

学徒现在看见什么、下一步设计改什么，以 [product-design-audit-2026-11-11.md](product-design-audit-2026-11-11.md) 为准（仓库 `7389a8a`，2026-11-11）。那份审核不改调度硬规则，也不实现功能。

调度硬规则仍以 [word-schedule-contract.md](word-schedule-contract.md) 为准。学徒可见句仍以 [learner-copy-lesson-first-final.md](learner-copy-lesson-first-final.md) 为准。

技术路线仍以 [evolution-architecture.md](evolution-architecture.md) 为准，但它的现状盘点和「下一 PR = E1」是 `bcc2b4a`（2026-11-09）的快照。实施队列各项的合并事实见 [implementation-backlog.md](implementation-backlog.md) 文首。

## 先读

| 文档 | 地位 |
| --- | --- |
| [product-design-audit-2026-11-11.md](product-design-audit-2026-11-11.md) | `7389a8a` 的学徒面审核、对自定每日量和多种练法的结论、分阶段设计 |
| [evolution-architecture.md](evolution-architecture.md) | 技术路线、数据与 AI 设计、评测、口语后续。现状节是 `bcc2b4a` 快照 |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | 当前代码的模块、Agent、表对照 |
| [../README.md](../README.md) | 怎么在本地跑 |

## 契约（仍有效）

| 文档 | 地位 |
| --- | --- |
| [word-schedule-contract.md](word-schedule-contract.md) | 同日单方面、有反馈的提取、跨睡眠夜、附带阅读不替代词表。义→形与 N=2 是可配置默认 |
| [learner-copy-lesson-first-final.md](learner-copy-lesson-first-final.md) | 学徒可见句合签 |
| [learner-copy-v3.md](learner-copy-v3.md) | 用词底座 |
| [word-tide-apprentice-rules.md](word-tide-apprentice-rules.md) | 学徒规则卡。实现上的句子以合签和 `WORD_TIDE_COPY` 为准 |

## 产品路径（历史 + 已合入）

| 文档 | 地位 |
| --- | --- |
| [product-design-audit-2026-11-11.md](product-design-audit-2026-11-11.md) | 学徒面审核与改进方案。只描述设计，实现仍看代码 |
| [ux-p0-pr-plan.md](ux-p0-pr-plan.md) | PR1–4 范围。已合入 `bcc2b4a` |
| [learner-first-path.md](learner-first-path.md) | lesson-first。第 3 节是实现前快照；PR5–8 已合入 |
| [ux-beginner-learn-notes.md](ux-beginner-learn-notes.md) | 小白可懂的判据 |
| [learner-copy-literary-pass-lesson-first.md](learner-copy-literary-pass-lesson-first.md) | 语感草稿。与合签冲突时以合签为准 |
| [word-tide-visual-metaphors.md](word-tide-visual-metaphors.md) | 视觉隐喻。不作为调度或文案的上级 |

## 数据与内容

| 文档 | 地位 |
| --- | --- |
| [data-requirements.md](data-requirements.md) | 采什么、不采什么。采集数字仍是 721 / 50 ready / 671 pending |
| [schema.md](schema.md) | `001`/`002` 字段字典。SQL 未接入，无 RLS |
| [enrichment-pipeline.md](enrichment-pipeline.md) | 审校命令。禁止假释义 |
| [ai-native.md](ai-native.md) | 早期工具边界。Agent 已是确定性代码，模型主循环见演进方案第 5 节 |

代码里的表草案：`supabase/migrations/001_text_foundation.sql`、`002_content_and_events.sql`。
