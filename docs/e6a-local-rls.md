# E6a：本地 RLS 门禁

## 运行

```sh
npm ci
npm run assert:e6a
npm run check
```

无需 PostgreSQL 服务、Docker、Supabase 项目、环境变量或密钥。锁定的 devDependency `@electric-sql/pglite@0.5.16` 在测试进程内运行真正的 PostgreSQL WASM（含 pgcrypto）。`001`、`002`、`003` 迁移文件原样执行，不移除扩展或用 SQL 文本匹配代替执行。实例只在内存中存在，finally 关闭；测试不出站。现有 Actions 不变：Node 22，`npm ci` + `npm run check`。

## 先红后绿

在编写 003 之前先运行：

```sh
npm run assert:e6a -- --without-rls
```

结果 exit 1：`RLS gate: A must not read B's card`，`1 !== 0`。相同测试角色确实查询到了 B，不是因迁移文件缺失、连接失败或权限缺失而红。这个命令现在仍可重现红灯：只跳过 003，不跳过隔离断言。

正常的 `npm run assert:e6a` 会先验证无 RLS 时 A 读到 B，并捕获预期的隔离断言失败，然后应用 003 并运行同一隔离断言及完整正反例。缺少/破坏 003 将失败，不会回退到文本检查。

## 隔离如何证明

- 夹具用管理员建表/播种；查询使用 `SET LOCAL ROLE authenticated`。断言此角色既非超级用户也无 BYPASSRLS。A/B 是两个固定测试 UUID；事务内设 `request.jwt.claim.sub`，最小 `auth.uid()` 返回该 UUID。事务结束恢复角色与 claim。
- 故意给 anon/authenticated 所有 public 表 ALL PRIVILEGES；隔离不能归功于没有 GRANT。
- users、cards、review_logs、progress、quest_runs、session_batches、session_proposals、agent_runs、learning_events、learner_memory_items、eval_scores 都覆盖 A/B 双向只见本人，以及对方 UPDATE/DELETE 返回 0。练习行在攻击前后的完整快照相同。无归属的审计/评估不可见。
- 伪造 B 的卡片 INSERT，以及把自己的 review_logs.card_id 改为 B 的卡片，必须被引擎拒绝：SQLSTATE `42501` 且错误正文为 row-level security。对 learning_events 的 card/batch/quest/agent 关联，以及 review_logs 的 event/agent 关联，同样验证拒绝。
- TRUNCATE 不受 RLS 控制：额外先写测试发现宽权限下 TRUNCATE 真的成功，门禁以 `Missing expected rejection` 红灯。迁移撤销这 18 张应用表的 TRUNCATE/REFERENCES/TRIGGER 权限后，anon 与 authenticated 的 `TRUNCATE cards CASCADE` 都以 `42501 permission denied` 拒绝。
- WITH CHECK 防止把自己的行改成别人的归属。缺 claim 的 authenticated 和 anon 都不能读私人表；即使 anon 带伪造 claim 也无策略。Supabase 匿名登录用户则属于有 UUID 的 authenticated，而不是无登录 anon。
- 本人读、本人 UPDATE 和新 review INSERT 真的成功。共享内容所有表可读，但客户端 UPDATE/DELETE 为 0；伪造内容 INSERT 被拒绝。
- 同用户重复 client_event_id（包括不同 grade）触发 `23505`；不同用户可以使用同一个 id。空、首尾空白、超长 id 触发 `23514`。既有 NULL id 保留。卡片 due/stability/scheduled_days 原值不变。

## 迁移与重放边界

只新增 review_logs.client_event_id：opaque text、最长 128、去首尾 ASCII 空白、`UNIQUE(user_id, client_event_id)`；旧行允许 NULL，避免给历史数据伪造 id。001 已有重放输入 card_id、grade、reviewed_at、state_before，不重复加列。SQL 不计算 due，不调用 FSRS，不改调度参数；TideScheduler.rate 仍是应用唯一调度写入口。

RLS 对所有含私人练习/审计信息的表做本人策略，对共享内容做只读策略；review/event 的可选关联也必须属于本人。没有增加 learning_events.client_event_id 或扩充 event_type：事件映射、冲突比较、重放顺序、账号建立、跨设备原子提交都留到 E6b。唯一约束只防重复存储，不声称实现了服务端重放。

## 局限 / 不做

- PGlite 单连接 PostgreSQL WASM 验证 SQL/RLS，不验证真实 Supabase Auth/JWT 签名、PostgREST、Realtime、真实 grants、并发连接竞争或云迁移权限。上线前仍需获准的非生产项目集成验收。
- auth.uid() 测试替身只模拟受信任的已验证身份；普通客户端不能获准任意设置服务端身份。超级用户、BYPASSRLS/service role 不受 RLS 保护，不能把这类密钥发给浏览器。RLS 本身也不能证明调用来自 TideScheduler.rate。
- 不执行 `supabase db push`，不部署、不创建云项目、不发行密钥、不改浏览器存储/连云、不改 E1 工作流或分支保护、不改科学契约和业务代码、不做 E4/E5b/E6b/E6c。内容夹具为空义项测试占位，不是审校词义。
- 新迁移未应用到任何真实数据库；尚无云端数据回滚问题。真实应用后的回滚须另行审查，不能把删除文件当作已回滚数据库。
