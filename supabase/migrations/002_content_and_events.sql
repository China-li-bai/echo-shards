-- 言灵残片 · 内容包 / 义项分层 / AI-native 事件与记忆
-- 在 001_text_foundation.sql 之上；不破坏既有语义，可 ALTER + 新建表。
-- 约束：LLM 不得写 cards.due / stability / scheduled_days（应用层 Enforce）。

-- ---------------------------------------------------------------------------
-- 内容层：词表包 → lemma → sense / forms；与教学 enrichment 分层
-- ---------------------------------------------------------------------------

-- content_packs：词表包元数据（license / url / version）
create table if not exists content_packs (
  id text primary key,                          -- e.g. ngsl-s-1.2
  name text not null,                           -- 展示名
  version text not null,                        -- 语义版本或上游版本号
  license text not null,                        -- e.g. CC-BY-SA-4.0
  source_url text,                              -- 官网或权威来源
  mirror_url text,                              -- 镜像（可选）
  citation text,                                -- 署名短文
  lemma_count int,                              -- 宣称 / 实测 lemma 数
  coverage_note text,                           -- 覆盖率说明（口语 ~90% 等）
  created_at timestamptz not null default now()
);

comment on table content_packs is '词表包元数据；官方词表文件与自研 enrichment 分层存放';

-- lemma_sources：同一 lemma 可来自多包时的溯源行（可选多对多）
create table if not exists lemma_sources (
  id text primary key,
  pack_id text not null references content_packs(id) on delete cascade,
  lemma text not null,                          -- 规范小写 lemma
  freq_rank int,                                -- 包内频级（1=最高频）
  source_row jsonb not null default '{}'::jsonb,-- 原始行快照（forms / en def）
  created_at timestamptz not null default now(),
  unique (pack_id, lemma)
);

create index if not exists lemma_sources_pack_rank_idx
  on lemma_sources (pack_id, freq_rank);

comment on table lemma_sources is 'lemma 在某 content_pack 中的溯源与频级';

-- lemmas：规范 lemma（与 sense 分离）
create table if not exists lemmas (
  id text primary key,                          -- e.g. en_be
  lemma text not null,                          -- 规范形
  lang text not null default 'en',
  pack_id text references content_packs(id) on delete set null,
  freq_rank int,                                -- MVP 用主包频级
  cefr_est text check (cefr_est is null or cefr_est in ('A1','A2','B1','B2','C1','C2')),
  topic_tags jsonb not null default '[]'::jsonb,
  enrichment_status text not null default 'pending'
    check (enrichment_status in ('pending','partial','ready','blocked')),
  created_at timestamptz not null default now(),
  unique (lang, lemma)
);

create index if not exists lemmas_pack_rank_idx on lemmas (pack_id, freq_rank);
create index if not exists lemmas_enrichment_idx on lemmas (enrichment_status);

comment on table lemmas is '规范 lemma；义项在 lexeme_senses / lexemes';

-- lemma_forms：屈折 / 拼写变体
create table if not exists lemma_forms (
  id text primary key,
  lemma_id text not null references lemmas(id) on delete cascade,
  form text not null,
  form_type text not null default 'inflected'
    check (form_type in ('lemma','inflected','variant','contraction')),
  created_at timestamptz not null default now(),
  unique (lemma_id, form)
);

create index if not exists lemma_forms_form_idx on lemma_forms (form);

comment on table lemma_forms is 'lemma 的屈折与拼写变体（来自 lemmatized CSV）';

-- lexeme_senses：一词多义；保留 TOPRA 所需形音义字段
-- 与 001.lexemes 并行演进：新导入写入本表；旧 seed 可逐步 migrate
create table if not exists lexeme_senses (
  id text primary key,                          -- sense id
  lemma_id text not null references lemmas(id) on delete cascade,
  sense_key text not null,                      -- 包内稳定键
  orthography text not null,                    -- 书写形（常=lemma）
  phonetic_text text,                           -- IPA 等文字；可空至 enrichment
  gloss_zh text,                                -- 中文义项；可空至 enrichment
  gloss_en text,                                -- 上游英文短义（可选）
  example_sentence text,
  example_sentence_zh text,
  collocations jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  cefr text check (cefr is null or cefr in ('A1','A2','B1','B2','C1','C2')),
  freq_rank int,
  enrichment_status text not null default 'pending'
    check (enrichment_status in ('pending','partial','ready','blocked')),
  source_pack_id text references content_packs(id) on delete set null,
  license_note text,                            -- 本行衍生许可备注
  created_at timestamptz not null default now(),
  unique (lemma_id, sense_key)
);

create index if not exists lexeme_senses_lemma_idx on lexeme_senses (lemma_id);
create index if not exists lexeme_senses_enrichment_idx on lexeme_senses (enrichment_status);

comment on table lexeme_senses is '义项层；cards 可引用 sense_id；无音频二进制';

-- 兼容 001.lexemes：补 enrichment / 溯源列（不改非空约束语义）
alter table lexemes
  add column if not exists lemma_id text,
  add column if not exists enrichment_status text default 'ready',
  add column if not exists source_pack_id text,
  add column if not exists gloss_en text,
  add column if not exists license_note text;

-- 若尚无 check，用约束名保护（Postgres 无 IF NOT EXISTS for check；忽略冲突）
do $$
begin
  alter table lexemes
    add constraint lexemes_enrichment_status_chk
    check (enrichment_status in ('pending','partial','ready','blocked'));
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 教学层补强：quests / quest_runs
-- ---------------------------------------------------------------------------

alter table quests
  add column if not exists origin text default 'static',
  add column if not exists generated_by text,           -- agent 名，如 echo_broker
  add column if not exists parent_quest_id text,        -- 衍生自静态模板
  add column if not exists topic_tags jsonb default '[]'::jsonb,
  add column if not exists eval_score double precision;

do $$
begin
  alter table quests
    add constraint quests_origin_chk
    check (origin in ('static','generated'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table quests
    add constraint quests_parent_fk
    foreign key (parent_quest_id) references quests(id) on delete set null;
exception when duplicate_object then null;
end $$;

alter table quest_runs
  add column if not exists generated_by text,
  add column if not exists parent_quest_id text,
  add column if not exists must_elicit_hits jsonb default '[]'::jsonb,
  add column if not exists eval_score double precision,
  add column if not exists abandon_reason text,
  add column if not exists intent text;                 -- 当日意图契约摘要

-- session_batches：一轮 ~5 词 × 单 aspect（教学层）
create table if not exists session_batches (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  aspect text not null check (aspect in ('form','meaning','phonology_text')),
  lexeme_ids jsonb not null default '[]'::jsonb,
  card_ids jsonb not null default '[]'::jsonb,
  proposal_id text,                                   -- 关联 session_proposals
  created_at timestamptz not null default now()
);

create index if not exists session_batches_user_idx
  on session_batches (user_id, created_at desc);

comment on table session_batches is 'SessionBatch：一轮只一个 aspect；约 5 词';

-- ---------------------------------------------------------------------------
-- 学习事件层：agent_runs / proposals / 统一事件流
-- ---------------------------------------------------------------------------

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  agent text not null,                              -- tide_steward / forge_smith / …
  tools jsonb not null default '[]'::jsonb,
  input_ref text,                                   -- 对象或 blob 引用
  output_ref text,
  cost_tokens int,
  status text not null default 'ok'
    check (status in ('ok','error','blocked','skipped')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists agent_runs_user_idx on agent_runs (user_id, created_at desc);
create index if not exists agent_runs_agent_idx on agent_runs (agent, created_at desc);

comment on table agent_runs is 'AI-native：每次 agent 调用审计；不得由此写 due';

create table if not exists session_proposals (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  day_id text not null,                             -- YYYY-MM-DD（用户时区）
  intent text,                                      -- 意图契约
  variants jsonb not null default '[]'::jsonb,      -- 多提案
  chosen_id text,
  user_edits jsonb not null default '{}'::jsonb,
  load_estimate jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','presented','accepted','rejected','expired')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists session_proposals_user_day_idx
  on session_proposals (user_id, day_id);

comment on table session_proposals is 'Curriculum Director 日课多提案；透明共创';

-- learning_events：统一事件流（intent / grade / must_elicit_hit / abandon …）
create table if not exists learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null
    check (event_type in (
      'intent',
      'proposal_accepted',
      'proposal_rejected',
      'retrieval_grade',
      'must_elicit_hit',
      'must_elicit_miss',
      'quest_success',
      'quest_fail',
      'abandon',
      'session_start',
      'session_end',
      'enrichment_request',
      'policy_breach'
    )),
  session_batch_id text references session_batches(id) on delete set null,
  quest_run_id uuid references quest_runs(id) on delete set null,
  card_id text references cards(id) on delete set null,
  agent_run_id uuid references agent_runs(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists learning_events_user_time_idx
  on learning_events (user_id, created_at desc);
create index if not exists learning_events_type_idx
  on learning_events (event_type, created_at desc);

comment on table learning_events is '统一学习事件流；Eval / Memory 只读聚合';

-- review_logs 补可选事件关联
alter table review_logs
  add column if not exists learning_event_id uuid,
  add column if not exists agent_run_id uuid;

-- ---------------------------------------------------------------------------
-- 学习者画像 / Learner Memory
-- ---------------------------------------------------------------------------

alter table progress
  add column if not exists error_type_counts jsonb default '{}'::jsonb,  -- 形/义/音错误计数
  add column if not exists compliance_streak int default 0,              -- 依从连续天数
  add column if not exists wtc_proxy double precision,                   -- WTC 代理分，可空
  add column if not exists last_intent text,
  add column if not exists last_session_at timestamptz;

create table if not exists learner_memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null
    check (kind in (
      'episode',
      'preference',
      'weak_lexeme',
      'strong_pattern',
      'topic_affinity',
      'error_signature',
      'wtc_note',
      'summary'
    )),
  payload jsonb not null default '{}'::jsonb,
  embedding_ref text,                               -- 外存向量引用；本阶段可空
  salience double precision not null default 0.5,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learner_memory_user_kind_idx
  on learner_memory_items (user_id, kind);
create index if not exists learner_memory_user_updated_idx
  on learner_memory_items (user_id, updated_at desc);

comment on table learner_memory_items is '结构化 Learner Memory；禁止整段聊天入 prompt';

-- eval_scores：Eval Sentinel
create table if not exists eval_scores (
  id uuid primary key default gen_random_uuid(),
  suite text not null,
  item_id text,
  metric text not null,
  score double precision,
  breach_flags jsonb not null default '[]'::jsonb,
  agent_run_id uuid references agent_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists eval_scores_suite_idx on eval_scores (suite, created_at desc);

comment on table eval_scores is '无 eval 不算 AI-native；策略违约写入 breach_flags';
