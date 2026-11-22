# 言灵残片 · 架构与数据层重审

**日期**：2026-11-15（Asia/Shanghai）  
**代码**：`cursor/interview-speak-7369`，开口页已经在这条分支上。  
**地位**：说明现在代码里的层次和数据放在哪。调度硬规则仍以 [word-schedule-contract.md](word-schedule-contract.md) 为准。  
**不覆盖**：`supabase/migrations/001` 与 `002` 仍是草案，应用没有连接。[schema.md](schema.md) 是字段字典，不是正在使用的库。[evolution-architecture.md](evolution-architecture.md) 第 1 节停在 `bcc2b4a`，不要把它读成这条分支的现状。

## 1. 四层，各管一件事

| 层 | 学徒看见的 | 代码 | 权威是什么 |
| --- | --- | --- | --- |
| 内容 | 词、中文义、例句、市集任务 | 构建包里的 JSON / YAML | 已审校的内容版本。不随练习改变 |
| 记忆 | 先看一眼、写意思、下次何时再练 | `TideScheduler.rate` 与 `word-tide-gate` | 复习日志重放得到 due。只有 `rate` 能写 due |
| 会用 | 用词写一句、市集问价 | `checkMeaningUse`、`EchoBroker` | 独立事件。成交和 `basic_pass` 不写卡 |
| 开口 | 自我介绍的断句、录音、听写、词典读音 | `/speak` | 稿子和录音在本机。听写和词典读音不算记忆等级 |

这和 Anki / FSRS 的常见分法一致：词表是内容，`revlog` 重放得到到期时间，媒体文件另放。也和语言课里「记得」与「会用」分开记的做法一致。开口层对齐浏览器教练的做法：声音留在本机，模型只做听写或朗读，判断用确定性规则，不把分数写回记忆卡。可对照的公开项目是浏览器发音教练 [Slip](https://github.com/RemiKG/slip)：录音不离开设备，模型听声音，分数由确定性计算给出，并写明不是考官评分。本仓库没有接它的音素打分，原因见第 4 节。

## 2. 数据放在哪

| 数据 | 位置 | 版本 | 清空练习记录 |
| --- | --- | --- | --- |
| 721 个 lemma、50 个 ready、任务 YAML | 构建包 `content/` | 随发布 | 不删。词表还在 |
| 今日安排 | `localStorage` `echo-shards.day-plan.v1` | 1 | 删 |
| 意思 / 拼写 / 读音卡和复习日志 | `localStorage` `echo-shards.round.v2:{词表}:{方面}` | 2 | 删 |
| 市集事件 | `localStorage` `echo-shards.quest-log.v1` | 1 | 删 |
| 造句 | `localStorage` `echo-shards.meaning-use.v1` | 1 | 删 |
| 自我介绍稿和「顺了 / 还卡」 | `localStorage` `echo-shards.speak.v1` | 1 | 删 |
| 自我介绍录音 | IndexedDB `echo-shards-speak` | 1 | 另删整个库 |
| 听写结果、词典读音 | 页面内存 | 无 | 刷新就没了 |
| Whisper / Kokoro 模型文件 | 浏览器自己的模型缓存 | 由 Transformers.js 管理 | 不删，也不上传 |
| Postgres 表 | 只有 SQL 文件 | 草案 | 没有连接，没有数据 |

录音不放进 `localStorage`。小 JSON 和较大的音频分开，是浏览器应用的常见做法：`localStorage` 配额小，而且清空时不好只删某一类。Anki 也把媒体和调度集合分开。模型缓存再单独留着，避免每次清空都重新下载几十 MB。

学习日固定为 `Asia/Shanghai`，用 `dayIdShanghai`。这不是设备时区。

## 3. 谁可以写什么

| 动作 | 可以写 | 不可以写 |
| --- | --- | --- |
| 学徒点 1–4 | `TideScheduler.rate` 写 due、reps | 建议分不能自己 `rate`。连点用 `client_event_id` 只记一次 |
| 同日第二面撞车 | 闸门过滤，不改原来的 due | 编排和模型都不能改 due 来「顺延」 |
| 造句 `basic_pass` | `meaning_use` 事件 | 不表示语义正确，不进解锁 |
| 市集成交 | 任务事件、经验和残片 | 不写 FSRS。经验不是学会 |
| 开口听写 | 页面上的「听到了 / 还没听到」 | 不调用 `rate`。不是发音对了 |
| 词典读音 | 页面上的音标串 | 不是学徒刚才读对了，不是考官分 |
| 发音实验夹具 | `pronunciation_experiment`，且 `acoustic_accuracy` 为 `not_measured` | 现场录音不能冒充这份夹具。夹具分不能变成记忆等级 |

`packages/core` 里的六个 Agent 仍是确定性 TypeScript。课程导演提案，潮汐管家调用 `rate`，锻炉给建议分，市集经纪人只看 `must_elicit`。它们不调用托管模型。

## 4. 对照开源和业界之后，现在差在哪

**调度日志还不是学徒每天走的那条路。** FSRS 和 Anki 的做法是：日志追加，due 由重放得到。`TideScheduler.restore` 已经是这个语义。日课按钮却把 `from=day` 带进回忆页。`savedOk` 要求 `from` 不是 `day`，否则清空快照再入队，并写回同一个 `round.v2` 键。只按主按钮的人，第二天换掉的是昨天的 due 和跨夜成功日。闸门本身仍守着同日单方面和跨夜解锁，但成功日已经被换掉。这是源码结论。浏览器里这次没有再点这条日课路径。

**开口判断停在本页。** 听写和词典读音没有自己的事件表。刷新之后，稿子和录音还在，刚才「哪些词没听到」不在。业界若要把这种判断留下来，会做成追加事件，并且和 `retrieval_grade` 分开。现在不存，是为了避免把听写误写成记得。代价是不能回看。

**音素分没有接。** [Open ASR Leaderboard](https://huggingface.co/datasets/hf-audio/open-asr-leaderboard) 比的是转写词错率，不是发音。榜首模型要服务器。本页用的是浏览器里的 `Xenova/whisper-tiny.en`，只回答词有没有出现。`onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX` 能出音素，但仓库核对时没有 `tokenizer.json`，Transformers.js 的现成流水线不能可靠解码。Slip 作者自己写的音素相关大约 0.44–0.46，并声明不是考官分。本仓库没有复测，也没有把这个数写成产品分数。

**账号库还没开始。** 业界在发匿名钥匙之前先做行级安全。本仓库的 SQL 没有 RLS，也没有客户端。进度权威仍是这台浏览器。这是现在的事实，不是已经同步到云。

## 5. 以后若要动，先动哪一层

1. 让日课进入回忆时留下已有复习日志，按到期组这一轮。due 仍只由 `rate` 写。这是记忆层的洞，不该用开口模型去补。
2. 若要留下「哪些词没听到」，新增一种开口事件，不要复用 `retrieval_grade` 或发音实验夹具。
3. 音素提示只有在解码路径能测、文案仍写「练习提示」时再接。它不能进解锁链。
4. 接 Postgres 之前先有本地的行级隔离测试。客户端上传的 due 仍然丢掉，由日志重放。

这次重审不实现上面四步。
