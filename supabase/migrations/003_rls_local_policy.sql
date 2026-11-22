-- E6a: database isolation only. Apply after 001 and 002 in Supabase.
-- No cloud application, auth provisioning, sync endpoint or scheduler implementation.
-- auth.uid() is supplied by Supabase; anon is NOT an authenticated anonymous user.
-- Supabase anonymous sign-in uses the authenticated role with a real user UUID.
begin;

-- TRUNCATE bypasses RLS. Browser roles need DML only, never bulk/DDL powers.
-- Name only this application's tables rather than changing unrelated schemas.
revoke truncate, references, trigger on table
  public.users, public.cards, public.review_logs, public.progress,
  public.quest_runs, public.session_batches, public.session_proposals,
  public.agent_runs, public.learning_events, public.learner_memory_items,
  public.eval_scores, public.lexemes, public.quests, public.content_packs,
  public.lemma_sources, public.lemmas, public.lemma_forms, public.lexeme_senses
from public, anon, authenticated;

-- E2a/E2c event IDs are opaque text (including legacy:...), not necessarily UUIDs.
-- Historical logs have no ID: preserve NULL, do not invent or re-rate records.
-- Replay already has card_id, grade, reviewed_at and state_before from 001.
alter table public.review_logs add column client_event_id text;
alter table public.review_logs add constraint review_logs_client_event_id_check
  check (client_event_id is null or (
    char_length(client_event_id) between 1 and 128
    and client_event_id = btrim(client_event_id, E' \t\n\r\f\013')
  ));
alter table public.review_logs add constraint review_logs_user_client_event_unique
  unique (user_id, client_event_id);
comment on column public.review_logs.client_event_id is
  'User-scoped E2a/E2c idempotency key; NULL for pre-ID logs. Replay belongs to TideScheduler.rate, not SQL.';

-- RLS is the gate even when table grants are broad. No policy is granted to anon.
-- FORCE also covers non-superuser table owners. Superusers / BYPASSRLS (service
-- roles) remain trusted and are explicitly outside the browser-key guarantee.
do $$
declare t text;
begin
  foreach t in array array[
    'cards', 'progress', 'quest_runs', 'session_batches',
    'session_proposals', 'agent_runs', 'learner_memory_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated
       using (user_id = (select auth.uid()))
       with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

alter table public.users enable row level security;
alter table public.users force row level security;
create policy own_profile on public.users for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Checking user_id alone is insufficient: a forged own log must not point to
-- someone else's card or audit row. EXISTS runs under the caller's RLS.
alter table public.review_logs enable row level security;
alter table public.review_logs force row level security;
create policy own_reviews on public.review_logs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.cards c where c.id = card_id and c.user_id = (select auth.uid()))
    and (learning_event_id is null or exists (
      select 1 from public.learning_events e where e.id = learning_event_id and e.user_id = (select auth.uid())))
    and (agent_run_id is null or exists (
      select 1 from public.agent_runs a where a.id = agent_run_id and a.user_id = (select auth.uid())))
  );

alter table public.learning_events enable row level security;
alter table public.learning_events force row level security;
create policy own_events on public.learning_events for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (card_id is null or exists (
      select 1 from public.cards c where c.id = card_id and c.user_id = (select auth.uid())))
    and (session_batch_id is null or exists (
      select 1 from public.session_batches b where b.id = session_batch_id and b.user_id = (select auth.uid())))
    and (quest_run_id is null or exists (
      select 1 from public.quest_runs q where q.id = quest_run_id and q.user_id = (select auth.uid())))
    and (agent_run_id is null or exists (
      select 1 from public.agent_runs a where a.id = agent_run_id and a.user_id = (select auth.uid())))
  );

-- eval_scores has no user_id: inherit ownership from its agent run.
-- Unowned system audits / evals remain invisible to clients.
alter table public.eval_scores enable row level security;
alter table public.eval_scores force row level security;
create policy own_evaluations on public.eval_scores for all to authenticated
  using (exists (
    select 1 from public.agent_runs a where a.id = agent_run_id and a.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.agent_runs a where a.id = agent_run_id and a.user_id = (select auth.uid())));

-- Shared content is readable but never client-writable (including generated
-- quests). Import/generation stays on a trusted future server path.
do $$
declare t text;
begin
  foreach t in array array[
    'lexemes', 'quests', 'content_packs', 'lemma_sources',
    'lemmas', 'lemma_forms', 'lexeme_senses'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy shared_read on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- Deliberately no event_type expansion, schedule trigger or replay RPC.
commit;
