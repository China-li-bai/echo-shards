# 言灵残片 · 数据需求清单（先于表设计）

> 原则：**先明确要采什么，再设计表字段。**  
> 默认目标：英→中、日常对话开口。文字先行，无音频二进制。  
> 日期：2026-10-25（Asia/Shanghai）

## 0. 词量策略（证据校准）

| 来源 | 主张 | 产品解读 |
|------|------|----------|
| Stuart Webb（BBC 转述） | 约 **800–1000 高频 lemma** ≈ 日常口语 **~75%** 覆盖 | 「起步日常」地板，**不是**舒适无辅助理解 |
| Nation (2006) | 口语约 **3000 word families + 专有名词 ≈ 95%**；**6000–7000 ≈ 98%** | 舒适理解阶梯 |
| **NGSL-Spoken 1.2**（Browne & Culligan） | **721 词 ≈ 口语最高约 90%** 覆盖；CC BY-SA 4.0 | MVP 词库锚定 |

**产品策略**

- **MVP**：NGSL-S ≈ **720–800 lemma** =「日常开口地板」
- **Phase 2** → ~2000 families；**Phase 3** → ~3000 families（对齐 Nation 95%）
- **硬结论：词表覆盖 ≠ 会说。** 仍需 Quest（信息差产出）回路；SRS 卡与 Quest 分表。

许可：官方词表文件与自研 enrichment（义项/例句/Quest）**分层存放**；词表目录保留 NOTICE（CC BY-SA）；enrichment 自有版权但引用词表。

---

## 1. 数据需求表

| ID | 要采什么 | 为何要 | 来源 | 阶段 |
|----|----------|--------|------|------|
| **A. 内容层** ||||| ||||| ||||| | ---- |
| A1 | lemma 列表（规范形） | 词库主索引；排频级；去重 | NGSL-S 1.2 `.txt` / lemmatized CSV | **MVP 已采 721** |
| A2 | 词形变体（屈折/缩略） | 形界识别、输入匹配、例句对齐 | NGSL-S lemmatized CSV | **MVP 已采**（forms） |
| A3 | 义项 gloss_zh | 义界闪卡、中文对照 | 自研 enrichment（人工/审校管线） | **样例 50**；余 pending |
| A4 | phonetic_text（IPA 等文字） | 音界文字轮；**无音频** | 自研 enrichment | **样例 50**；余 pending |
| A5 | 例句中英 | 语境检索、Quest 素材 | 自研；可后接语料授权 | **样例 50**；余下一步 |
| A6 | 搭配 collocations | 产出提示、干扰项 | 自研 / 授权搭配表 | 样例；批量下一步 |
| A7 | 话题标签 topic_tags | Session / Quest 选题 | 规则标注 + 编辑 | MVP 粗标 `spoken-mvp` |
| A8 | 频级 / rank | 引入顺序、负荷控制 | NGSL-S 频序 | **已采** |
| A9 | CEFR 估 | 教学分层（弱信号） | 估标 / 后接外部表 | 可选；样例有 |
| A10 | source + license | 合规、署名、ShareAlike | NOTICE / CITATION | **已写** |
| A11 | 英文短义 gloss_en | 编辑参考、回退释义 | NGSL-S `_en.csv` 镜像 | **已采**（上游） |
| **B. 教学层** |||||
| B1 | aspect 分轨卡状态 | TOPRA：形/义/音文字独立 FSRS | 运行时 cards | 001 已有；沿用 |
| B2 | SessionBatch | 一轮 ~5 词 × 单 aspect | 调度器生成 | 002 建表 |
| B3 | Quest 模板 | 信息差强制产出 | YAML / DB quests | 已有 1 个 demo |
| B4 | Quest 动态生成稿 | Echo Broker 共创 | generated quests + parent | 002 字段 |
| B5 | must_elicit 目标 | 成功判据（程序勾选） | Quest 定义 | 001/002 |
| **C. 学习事件层** |||||
| C1 | review_logs | 陈述保持评分轨迹 | TideScheduler.rate | 001 |
| C2 | quest_runs / turns | 产出回合与 elicited | 交易所运行时 | 001 + 002 补 |
| C3 | agent_runs | AI 调用审计 | 各 Agent | **002 新建** |
| C4 | session_proposals | 日课多提案共创 | Curriculum Director | **002 新建** |
| C5 | learning_events | 统一事件：intent / grade / must_elicit_hit / abandon | 埋点 | **002 新建** |
| C6 | eval_scores | 无 eval 不算 AI-native | Eval Sentinel | **002 新建** |
| **D. 学习者画像** |||||
| D1 | progress（xp/shards/streak） | 营地进度 | 运行时 | 001 + 002 扩 |
| D2 | 错误类型计数 | 弱项诊断 | review / quest 聚合 | 002 progress 字段 |
| D3 | 依从 streak | 习惯/依从 | session 完成 | 002 |
| D4 | WTC 代理字段（可空） | 愿说意愿弱信号 | 自陈/代理指标 | 002 可空 |
| D5 | learner_memory_items | 结构化记忆；禁整段聊天入 prompt | Memory Agent | **002 新建** |
| **E. 本阶段明确不采** |||||
| E1 | 音频波形 / 录音文件 | 文字先行 | — | **不做** |
| E2 | ASR 对齐时间戳 | 无语音管线 | — | **不做** |
| E3 | 发音评分分数 | 无 PronunciationProvider 实装 | — | **不做** |
| E4 | 用户生物信息 / 声纹 | 隐私与范围外 | — | **不做** |
| E5 | 编造 700 条伪义项 | 质量底线 | — | **禁止** |

---

## 2. LICENSE 分层策略

```
content/packs/ngsl-s-1.2/     ← 官方词表 + NOTICE + CITATION（CC BY-SA 4.0）
content/lexemes/*.json        ← 自研 enrichment / seed（引用词表；自有版权）
content/quests/               ← 自研 Quest（可引用 lemma id）
```

衍生分发时：词表部分保持 CC BY-SA + 署名 Browne & Culligan；enrichment 注明引用。

---

## 3. 采集状态（截至本交付）

| 项 | 状态 |
|----|------|
| NGSL-S 1.2 原始文件 | ✅ `content/packs/ngsl-s-1.2/` |
| 导入脚本 | ✅ `scripts/import-ngsl-s.ts` |
| lemma / sense / forms 种子 | ✅ 721 lemmas，2354 forms |
| 中英义·音标·例句 | ✅ 前 50 ready；671 pending |
| 批量 enrichment 管线 | ⏳ 下一步（审校，不幻觉） |

导入命令：

```bash
# from the repo root
npm run import:ngsl-s
# 或跳过 enrichment：
npx tsx scripts/import-ngsl-s.ts --no-enrichment
```

## 4. 相关链接

- NGSL-Spoken：https://www.newgeneralservicelist.com/ngsl-spoken
- Webb / BBC 800 词大众表述：https://www.bbc.com/news/world-44569277
- Nation (2006) PDF：https://www.wgtn.ac.nz/__data/assets/pdf_file/0018/1626120/2006-How-large-a-vocab.pdf
- 教学 lemmatized CSV：https://www.lextutor.ca/freq/lists_download/ngsl_browne/NGSL-Spoken_1.2_lemmatized_for_teaching.csv
- 镜像：https://github.com/koba-ninkigumi/ngsl
