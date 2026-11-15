# 面试自我介绍 · 开口练习选型与任务

**日期**：2026-11-15（Asia/Shanghai）  
**代码基线**：从 `7389a8a` 拉出。本文件随开口页一起提交。  
**地位**：口语练习的技术选型与执行顺序。调度硬规则仍以 [word-schedule-contract.md](word-schedule-contract.md) 为准。发音分不能写成记忆等级，见 `pronunciation-boundary.ts`。  
**这一轮做到哪**：T1 和 T2 已接到 `/speak`。T3、T4 还没做。听写用浏览器里的 `Xenova/whisper-tiny.en`，第一次点击才下载。自动检查只跑词对齐，不下载模型，也不把听写结果写成发音分。

## 学徒要完成的事

面试前能把一段英文自我介绍说顺：长句被分成能换气的小段，能听示范，能听自己的录音并重复放，能标出哪一小段还卡。自动判断「发音对不对」不在这一轮，避免把模型分数说成考官结论。

## 2026-11-15 调研

设备约束来自这个仓库：页面跑在浏览器里，进度在本机，没有获准的模型密钥。下面只采用当时能打开的公开页面和 Hugging Face API。

| 来源 | 读到的事实 | 不用来做什么 |
| --- | --- | --- |
| [Open ASR Leaderboard](https://huggingface.co/datasets/hf-audio/open-asr-leaderboard) API，2026-11-15 | 返回 65 行。第 1 行 `Edge0/ARK-ASR-3B`，`value` 4.76，`lower_is_better: true`，`verified: false`。前列还有 MOSS-Transcribe 2B、Parakeet、`CohereLabs/cohere-transcribe-03-2026` | 这是转写词错率，不是发音评分。前排模型要服务器级显存。`verified: false` 表示这不是认证名次 |
| Hugging Face 模型卡 API | `openai/whisper-tiny.en` 约 37.8M 参数，`license` 字段 `apache-2.0`，`pipeline_tag` 为语音识别。`Xenova/whisper-tiny.en` 同样是 `apache-2.0`，供 Transformers.js 使用。`onnx-community/Kokoro-82M-v1.0-ONNX` 与 `hexgrad/Kokoro-82M` 的 `license` 字段都是 `apache-2.0`，`pipeline_tag` 为文字转语音 | 不把参数量写成「已经在本仓库跑过」 |
| [Slip](https://github.com/RemiKG/slip) 仓库说明 | 浏览器里用 wav2vec2 音素后验加确定性对齐。作者写 GOP 与人工评分的相关大约 0.44–0.46，并写明这是练习提示，不是考官评分 | 这个相关是对方仓库的自述，不是本仓库复测 |
| [charsiu-js](https://github.com/mnaoizy/charsiu-js) | 浏览器里做英、中文的强制对齐，输出每个词的时间 | 对齐能定位「说到哪」，不能单独当成会发音 |
| 本仓库 `voice-placeholder.ts` | ASR、TTS、发音分接口仍是空的，调用约束写明文字阶段不注入真实语音 SDK | 自我介绍页不走这组接口，也不把它们标成已实现 |

同一天还看了官方数据集列表里带 speech / asr / audio 的基准：`hf-audio/open-asr-leaderboard`、`MBZUAI/longshot-bench`、`facebook/mmi`、`ARTPARK-IISc/Vaani-Benchmark-V1.0`、`VCLab-PolyU/OmniCompass`。发音评分没有找到一张可直接照抄的官方榜。没有榜的项不编造分数。

多模态开口模型（例如十亿级的 speech-to-speech）能聊天，但不能当作「对照一篇固定稿子」。它们也放不进现在的浏览器页。免费云端接口需要密钥，音频会离开这台设备；仓库没有获准的密钥，所以不选。

## 选型

| 能力 | 选用 | 先不选用 |
| --- | --- | --- |
| 断句 | 本仓库的 `chunkSelfIntro`。按句号、逗号和 and / but / because 等词切开，一小段最多 14 个词 | 不让模型改写稿子 |
| 听示范、重复听 | 浏览器 `speechSynthesis`，语言 `en-US`。不下载模型，不上传文字 | Kokoro 留到 T3。它更自然，但要下载几十到几百 MB，手机上容易把页面撑满 |
| 听自己 | `MediaRecorder`。录音放在 IndexedDB `echo-shards-speak`。稿子放在 `echo-shards.speak.v1` | 不把录音送到服务器 |
| 看哪段还卡 | 学徒自己点「这小段顺了 / 这小段还卡」 | 不把这个选择叫发音分 |
| 下一轮对词 | T2 再用浏览器里的 Whisper tiny English，只看稿子里的词有没有说到 | 不用榜首的大模型做第一版 |
| 音素提示 | T4 才考虑，并且只能记成现有的发音实验事件 | 相关约 0.44 的练习提示不能写成考官分，也不能 `rate` |

## 任务

| 任务 | 学徒能做什么 | 状态 | 不做什么 |
| --- | --- | --- | --- |
| T1 | 打开 `/speak`，改稿，分成小段，听这一小段，录下来，听我自己，按顺序再听 | 本分支已接。顶栏「自我介绍」在第一次意思练成前是灰的 | 不调用 `TideScheduler.rate`。不判断发音对不对 |
| T2 | 录完后点「看看词说全了没有」，看到听到了哪些词、还没听到哪些 | 本分支已接。模型是 `Xenova/whisper-tiny.en`，在浏览器里跑 | 词对上了也不写 due，也不说会发音 |
| T3 | 设备装得下时，用 Kokoro 放更稳的示范 | 未做。失败就继续用系统声音 | 不把示范声音当学徒得分 |
| T4 | 可选的音素提示，句子写明这是练习提示 | 未做 | 必须沿用发音实验边界：不能变成记忆等级 |

清空练习记录会删 `echo-shards.*` 稿子，并删除 `echo-shards-speak` 数据库。词表仍在。

## 验收

- `node --import tsx scripts/assert-speak-chunks.mjs` 通过。
- 页面源码不含 `TideScheduler` 和 `.rate(`。
- 浏览器手点录音不在这次的自动检查里。没有麦克风的环境不能把录音写成已经听过。
