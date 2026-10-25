-- 言灵残片 · 文字基础表（Postgres / Supabase）
-- 本阶段可不连云；demo 用内存 Map。本地可用 SQLite 对照同名字段。
-- 证据原则：cards（SRS）与 quests / quest_runs 分表。

create extension if not exists "pgcrypto";

-- users：进度账号占位
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- lexemes：词条（形 / 音文字 / 义）；无音频列
create table if not exists lexemes (
  id text primary key,
  lemma text not null,
  orthography text not null,
  phonetic_text text not null,
  gloss_zh text not null,
  sense_id text not null,
  example_sentence text not null,
  example_sentence_zh text,
  collocations jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  cefr text,
  freq_rank int,
  lang text not null default 'en',
  l1 text not null default 'zh',
  created_at timestamptz not null default now()
);

-- cards：每个 (user × lexeme × aspect) 一条 FSRS 卡（TOPRA）
create table if not exists cards (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  lexeme_id text not null references lexemes(id) on delete cascade,
  aspect text not null check (aspect in ('form', 'meaning', 'phonology_text')),
  state int not null default 0,
  due timestamptz not null,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days double precision not null default 0,
  scheduled_days double precision not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  learning_steps int not null default 0,
  last_review timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, lexeme_id, aspect)
);

create index if not exists cards_due_idx on cards (due);
create index if not exists cards_user_id_idx on cards (user_id);
create index if not exists cards_lexeme_aspect_idx on cards (lexeme_id, aspect);
create index if not exists cards_user_aspect_due_idx on cards (user_id, aspect, due);

-- review_logs：陈述保持评分日志（与 Quest 产出分表）
create table if not exists review_logs (
  id text primary key,
  card_id text not null references cards(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  grade int not null check (grade between 1 and 4),
  reviewed_at timestamptz not null default now(),
  state_before int not null,
  scheduled_days double precision
);

create index if not exists review_logs_user_idx on review_logs (user_id, reviewed_at desc);
create index if not exists review_logs_card_idx on review_logs (card_id);

-- quests：文字信息差任务定义（YAML 导入）
create table if not exists quests (
  id text primary key,
  title text not null,
  goal text not null,
  roles jsonb not null,
  student_knows jsonb not null,
  npc_knows jsonb not null,
  must_elicit jsonb not null,
  success_criteria jsonb not null,
  target_lexemes jsonb not null default '[]'::jsonb,
  max_turns int not null default 12,
  rubric text not null,
  modality text not null default 'text' check (modality = 'text'),
  created_at timestamptz not null default now()
);

-- quest_runs：一次文字交易所跑次（强制产出记录）
create table if not exists quest_runs (
  id uuid primary key default gen_random_uuid(),
  quest_id text not null references quests(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  turns jsonb not null default '[]'::jsonb,
  elicited jsonb not null default '[]'::jsonb,
  success boolean,
  score double precision,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists quest_runs_user_idx on quest_runs (user_id, started_at desc);
create index if not exists quest_runs_quest_idx on quest_runs (quest_id);

-- progress：营地 XP / 残片占位
create table if not exists progress (
  user_id uuid primary key references users(id) on delete cascade,
  xp int not null default 0,
  shards int not null default 0,
  camp_level int not null default 1,
  streak_days int not null default 0,
  updated_at timestamptz not null default now()
);
