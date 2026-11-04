# 言灵残片 Echo Shards · 小白可用性调研笔记

**问题（来自产品方）**：普通中文 EFL 小白看到当前交互，能马上明白吗？社区有什么可对照的体验设计理念？  
**范围**：社区 UX / 互动设计 / 语言学习与相邻 edtech / 教无手册的游戏 UX；映射到 copy v3 后的现状（营地 / 日课 / 潮汐 / 市集 / 工坊；隐喻仍密）。  
**方法**：WebSearch + WebFetch 优先一手来源与知名实践者；**不编造研究**；证据薄处标明。  
**日期**：2026-11-02（Asia/Shanghai）

---

## A. Verdict criteria（「5 秒内小白能懂吗？」测试）

用这 5–8 条做**可复现的判据**（对真实新手做 silent first-use，不问引导问题；计时从首屏落地起）：

1. **一眼下一动作**（≤5s）  
   用户能否指着屏幕说「我下一步该点这里」？若需要读完一段诗意文案才能猜，判失败。  
   *对照：Krug「self-evident / self-explanatory」；Duolingo「one highlighted action」。*

2. **导航名可翻译成学习动作**（≤5s，不看说明）  
   对「营地 / 日课 / 潮汐 / 市集 / 工坊」任抽 3 个，用户能否用白话说出各自在学英语里干什么（例：学新词 / 复习 / 用词做任务）？说成「露营」「涨潮」「买东西」算**隐喻泄漏**，判弱失败。

3. **主路径无需隐喻词典**（首 60s）  
   不解释「提案 / 接过 / 残片墙 / 开炉 / 休整 / 过今夜」的前提下，用户能否完成一次「看到英文 → 写出中文意思 → 对照」？完成不了或反复卡在锁态文案 = 失败。

4. **空态给出通路而非氛围**（营地首访）  
   「拼写残片墙」空态：用户是否知道**为什么空**、**怎么填满**、**现在该去哪**？只能欣赏空墙诗意 = 失败（NN/G empty states）。

5. **锁 / 休整可被扫读理解**（潮汐卡）  
   「还不能练 / 暂时不练」：用户能否在**不读长散文**的情况下，用 UI 状态（灰态、唯一 CTA「去练意思」）理解「现在不能做这件事，但有明确去处」？只能靠反复文字解释 = 失败。

6. **卡片上的等级芯片不制造假权威焦虑**（潮汐练）  
   看到 CEFR「B1」时，小白是忽略、好奇点开，还是以为「我不够级 / 系统评了我」？若多数人误读为**对自己的定级**而非词条元数据，判失败（行业侧常见：裸 CEFR 需 can-do 或藏进详情）。

7. **页脚 / 词表署名不抢主路径**（任意主屏）  
   首 5 秒视线是否被「NGSL-Spoken…」或 seed/ngsl 展开芯片吸走，而错过「接过今日提案 / 开始练」？抢注意 = 失败（认知负荷：extraneous load）。

8. **「接过今日提案」前有可预览的内容承诺**（日课）  
   用户在点按钮前，能否说出今天大概练什么（几词、什么练习、大约多久）？盲接提案 = 弱失败（信息气味 / preview before commit）。

**总判读建议**：1–3 任一条失败 → **当前对普通小白不够「马上明白」**；4–8 失败则属**可分期修的摩擦**，但累计会抬高弃用率。

---

## B. Community principles（具名 + 来源 + 对 Echo Shards 的一行含义）

| # | 原则 | 来源 | 对 Echo Shards 的含义 |
| --- | --- | --- | --- |
| 1 | **Don’t make me think** — 屏应 self-evident；做不到至少 self-explanatory | Steve Krug, *Don’t Make Me Think*（概述：[UX Booth 十课](https://uxbooth.com/articles/10-usability-lessons-from-steve-krugs-dont-make-me-think/)；Oreilly Ch.1） | 「今日提案 / 接过」若不能一眼等于「今天练这几个词的意思」，就还在想隐喻，不在学英语。 |
| 2 | **砍掉 happy talk**；用户扫描不细读 | 同上（Krug：eliminate happy talk；we scan） | 营地空墙诗意、锁态重复散文，对小白是噪声不是氛围。 |
| 3 | **Progressive disclosure** — 先只露常用核心；高级进二级 | [NN/G · Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)（Jakob Nielsen） | seed / ngsl / CEFR / 许可脚注应进「高级展开」；主路径只留「练意思」。 |
| 4 | **Training wheels** — 初期限制功能反而学得更好 | [NN/G · Training Wheels UI](https://www.nngroup.com/articles/training-wheels-user-interface/)（Carroll 研究综述） | 五顶隐喻导航在首成功前同时可见，等于拆掉训练轮；首日应实质只露出「日课→潮汐」一条轨。 |
| 5 | **Recognition over recall** — 可见选项优于要记住的规则 | [NN/G · Recognition and Recall](https://www.nngroup.com/articles/recognition-and-recall/)；[Ten Heuristics #6](https://www.nngroup.com/articles/ten-usability-heuristics/) | 「先意思、隔夜才开拼写」应用状态与唯一按钮表达，而不是让用户记住世界观规则。 |
| 6 | **Minimize extraneous cognitive load** | [NN/G · Minimize Cognitive Load](https://www.nngroup.com/articles/minimize-cognitive-load/)；Sweller CLT 综述见 [Springer · Cognitive Architecture…](https://link.springer.com/article/10.1007/s10648-019-09465-5) | 隐喻堆叠、署名页脚、多芯片 = 外在负荷，挤占「写中文意思」的内在负荷。 |
| 7 | **Empty states = 状态说明 + 学什么 + 直接通路** | [NN/G · Empty States](https://www.nngroup.com/articles/empty-state-interface-design/)；PatternFly / Primer empty-state 指南同向 | 「拼写残片墙」空态必须有「练完意思并过一夜会出现痕迹」+ CTA 去日课/潮汐，而非只留诗意。 |
| 8 | **One clear next action / Path** — 首页一条推荐下一步；学 App 不学 App 说明书 | [Duolingo Path 科学说明](https://blog.duolingo.com/new-duolingo-home-screen-design/)；[Duolingo Handbook 原则摘要（行业 teardown 引用「Intuitive: if it needs explanation, it’s not right」）](https://handbook.duolingo.com/)；[Onboarding teardown：lesson before signup](https://appwinners.eu/guides/duolingo-onboarding-teardown) | 市场话术「日课→潮汐→市集」应变成 UI 上的**单一高亮下一步**，不是五 Tab 并列让用户自选。 |
| 9 | **First success before worldbuilding** — 先交付一次真实练习成功 | 同上 Duolingo onboarding（首课先于账号）；社区共识亦见于 Growth.Design / Screens Design teardown | 世界隐喻（营地/潮汐/市集）应在**第一次对照释义成功之后**再 unlock 叙事，而不是首屏齐上。 |
| 10 | **Teach through the first minutes of play** — 一次只引入一个机制；失败要安全 | 游戏设计实践：Portal/Zelda 式 chamber teaching（综述见 [Gamasutra/GameDeveloper · Zelda tutorials](https://www.gamedeveloper.com/design/tutorials-of-zelda-when-do-players-get-to-quot-play-quot-)；[Interactive tutorials](https://www.gamedeveloper.com/design/interactive-tutorials-for-an-interactive-medium)）；Raph Koster *Theory of Fun*：乐趣=学习模式 | 「意思 →（稍后）拼写 →（更后）读音」很好；但 UI 若同时讲解开炉/休整/残片/市集，就违反「一室一机制」。 |
| 11 | **Diegetic metaphor helps only after competence; pile-up hurts novices** | 游戏 HCI：diegetic/spatial UI 对新手表现混合、依赖情境（例：[IJHCI 2021 diegesis VR](https://doi.org/10.1080/10447318.2020.1870819) — 证据为 VR/专家对比，**不宜直接外推为移动 edtech 铁律**）；实践共识仍是「系统 UI 先保证可学」 | 「潮汐 / 残片」可作皮肤；**不能替代**「复习 / 已记住的痕迹」这类系统标签。新手阶段优先 systemic 白话，diegetic 后置。 |
| 12 | **Scaffolding that fades** — 支持是暂时的、依表现撤回 | 教学设计：scaffolding & fading（Wood / Vygotsky 传统；综述 [Scaffolding in Teacher–Student Interaction](https://link.springer.com/article/10.1007/s10648-010-9127-6)） | 锁态旁注、对照释义、今日只练一面：早期可多提示；重复成功后应收成短状态条，避免永远说明书。 |
| 13 | **中国背词 App 首开：计划清楚 + 一个最大「开始」**（高阶观察，非实验室论文） | 人人都是产品经理体验文：[百词斩背词分析](https://www.woshipm.com/evaluating/3923886.html)；竞品对照同文内「不背单词 / 墨墨 / 扇贝」 | 小白预期是「选词书/看今日任务 → 点开始背」；Echo 的「接过今日提案」若无数量/预览/时间感，会低于该心智模型。**注意：这是产品体验报告，不是对照实验。** |

*Anki / FSRS 对照（负例）*：社区长期批评 Anki「为程序员做的 UI、陡峭学习曲线、选项名词难懂」——功率用户工具 ≠ 小白产品（[HN 讨论](https://news.ycombinator.com/item?id=44020946)；[Reddit 产品视角](https://www.reddit.com/r/Anki/comments/1l56142/why_do_a_lot_of_people_think_anki_has_an_outdated/)；SynapDeck whitepaper 对 Anki UI 陡峭的归纳）。Echo 已去 FSRS 字样是对的；**若调度隐喻仍像 Anki 选项页的诗意版，小白仍会退**。

---

## C. Likely fail points（映射当前屏 · 直白 · 有据）

### 营地
- **五 Tab 隐喻先于首成功**：营地/日课/潮汐/市集/工坊同时可见 → 违反 progressive disclosure / training wheels；小白会问「我是该露营还是赶潮」。  
- **拼写残片墙诗意空态**：有墙无砖 + 诗意 → NN/G：空态若不说明「会有什么 / 怎么填」，用户怀疑坏了或无关装饰。  
- **次要进度账本与主路径争注意力**：冷启动账本术语即使已白话，仍是第二故事线；首日应折叠到「练完再看」。

### 日课
- **「今日提案」+「接过今日提案」**：提案/接过是 RPG 话术；中国 EFL 小白更熟「今日任务 / 开始学习」（百词斩类心智）。无词表预览、无预计时长 → 盲承诺（信息气味弱）。  
- **「今天只练意思，另一面改天」**：规则本身合理（aspect 分面），但出现在接提案前，等于先教世界观再学词 —— Portal 反例：应先做一次「写意思」，再自然带出「拼写还没开」。

### 潮汐练
- **任务本身清晰（写中文意思 → 对照释义）**：这是产品最接近「小白秒懂」的核心；好。  
- **CEFR B1 chip 在学习者卡片上**：对未接触雅思/欧标的用户是黑话芯片；易被误读为「我被定级」。行业实践倾向用 can-do 白话或藏进详情（证据多为实践指南/产品文，**缺少专门「CEFR chip A/B」论文**——标为 thin evidence）。  
- **高级 expand 的 seed/ngsl**：对小白是词表工程细节；应默认折叠且不进主卡。

### 锁（「还不能练」）
- **锁态靠散文解释、且文案易重复**：recognition 原则要求状态可见 + 一个动作；长说明 = 让用户 recall 规则。  
- **「点开只读、无解锁按钮」若仍 internally 说明书腔**（copy v3 已改方向）：小白需要的是**唯一出口 CTA**（去练意思），不是理解锻造系统。

### 休整（「暂时不练」）
- **「暂时不练」比「休整/工坊」好**（copy v3 正向）：仍须避免与锁态视觉/文案堆成三四种「不能练」变体让人辨析差异——小白只需要「现在不能 / 去能练的那面」。

### 市集 / 页脚（相邻）
- **市集作为第三幕**：在未完成日课→潮汐闭环前出现在底栏，会稀释「一条路」。  
- **Footer NGSL-Spoken**：许可应存在，但与主 CTA 同视觉权重会抢扫视路径（认知负荷）。

---

## D. Positive patterns already present（不全是在喷）

1. **营销流「日课 → 潮汐 → 市集」方向正确** — 接近 Duolingo Path「一条前向路径」；缺的是 UI 强制同一条，而不是仅文案宣称。  
2. **潮汐核心练习形态对** — 「英词 → 写中文意思 → 对照释义」是高 recognition、低规则负荷的题型；比 Anki 空白回忆更友好（仍属设计判断，非本轮实测）。  
3. **Copy v3 去 FSRS / lemma / aspect 黑话** — 直接对准 Anki 式失败模式；「意思 / 拼写 / 读音」是正确的学徒标签。  
4. **「今天只练一面」+ 锁/休整分面** — 本质是 training wheels + scaffolding；机制对，表层隐喻过密。  
5. **锁不用惩罚红叉**（隐喻文档：灰冷未开炉）— 符合「安全失败 / 非惩罚锁」的游戏教学习惯。  
6. **对照释义提供即时反馈** — 符合「teach through play」的即时后果，而非事后说明书。  
7. **奶油+青绿与克制视觉** — 降低视觉 clutter 有利扫读（在文案密度下降后收益更大）。

---

## E. Prioritized fix directions（行为语言 · 无色板 · 无代码）

### P0 — 不改世界观也能先让小白「马上明白」
1. **首日实质单轨**：首成功前，底栏视觉上只强调「日课」或「今日下一步」；潮汐在接提案后自然进入；市集/工坊降级为次要或完成日闭环后再亮。  
2. **日课变成可预览的今日任务**：展示「大约 N 个词 · 练中文意思 · 约 x 分钟」+ 词预览或样例一瞥；主按钮改为白话「开始今天的练习」（可保留小字世界观）。  
3. **潮汐卡只留学习动作**：默认可见 = 英文词 + 输入区 + 对照；CEFR / seed / ngsl 进「详情」；页脚署名弱化到不进首屏扫视。  
4. **锁/休整改成状态 + 一个出口**：标题级「拼写还不能练」；副文一行内；主按钮「去练意思」。删重复解释段落。  
5. **营地空墙改通路空态**：一句「练过意思并隔夜后，痕迹会出现在这里」+ 按钮「去今日练习」。诗意最多作插图 alt，不作唯一文案。

### P1 — 隐喻延后、脚手架可褪
6. **First-success gate 后再讲世界**：第一次对照成功后，用一条短庆祝带出「残片会留在营地」；勿首屏世界观导览。  
7. **导航双名策略（过渡）**：学徒侧「今日 / 复习 / 任务」；品牌名「日课 / 潮汐 / 市集」作次级或熟练后切换——直接回应「隐喻名不可译成学习动作」。  
8. **CEFR**：学习者主卡不显示裸 B1；若保留，改为「中阶常用」或点进后看「大约能读简单文章」类 can-do（**表述需产品自测；无强制学术标准**）。  
9. **提示随成功褪去**：同一规则第三次出现时缩成图标+短标签；失败再展开（scaffolding fade）。

### P2 — 打磨与验证（证据仍依赖你们自己的测）
10. **5 人静默首用测试**：用 A 节 8 条记二值通过率；改文案前后对比。社区原则不能代替测你们的隐喻密度。  
11. **市集信息差任务**：仅在完成至少一轮潮汐后推荐；入口文案用「用今天的词去问价」而非假定用户已懂「市集」。  
12. **账本/工坊**：保持折叠；工坊默认不可达或末位（与 copy v3 一致）。

---

## Evidence hygiene（诚实边界）

- **硬证据**：Krug；NN/G progressive disclosure / recognition / empty states / cognitive load / training wheels；Duolingo 公开发布的 Path 与（经 teardown 引用的）onboarding 实验结果。  
- **中等证据**：中国背词 App 体验报告（人人都是产品经理等）——描述首开心智与「一个开始按钮」，**非 RCT**。  
- **薄证据 / 勿当铁律**：CEFR chip 对焦虑的定量影响；diegetic UI 在非 VR 语言 App 上的因果结论；「5 个顶栏隐喻」的精确阈值（5 是对本产品的启发式，不是论文常数）。  
- **负例参照**：Anki 陡峭 UI 的社区共识，用于说明「算法正确 ≠ 小白能懂」。

---

## Bottom line for 「普通小白能马上明白吗？」

**按 A 节判据：大概率不能「马上」明白整套 UI。**  
他们**有机会**明白潮汐里「看英文、写中文意思」这一下——这是现有最强资产。  
卡住的是：**五隐喻导航 + 提案话术 + 诗意空墙 + 锁态散文 + 元数据芯片**在首成功前同时征收认知税。  
Copy v3 已去掉管线黑话，方向对；下一步是 **行为上的 progressive disclosure / training wheels**，不是再写一篇更美的世界观说明书。

