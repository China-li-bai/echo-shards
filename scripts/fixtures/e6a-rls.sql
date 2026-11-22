-- Test identities/placeholder content only, never learner data or reviewed vocabulary.
create role anon nologin nosuperuser nobypassrls;
create role authenticated nologin nosuperuser nobypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated;
-- Deliberately broad grants: the tests must prove RLS, not missing privileges.
grant all privileges on all tables in schema public to anon, authenticated;
insert into users(id, display_name) values
 ('11111111-1111-1111-1111-111111111111', 'A'),
 ('22222222-2222-2222-2222-222222222222', 'B');
insert into lexemes(id, lemma, orthography, phonetic_text, gloss_zh, sense_id, example_sentence)
 values ('fixture', 'fixture', 'fixture', '', '', 'fixture', '');
insert into quests(id,title,goal,roles,student_knows,npc_knows,must_elicit,success_criteria,rubric)
 values ('fixture','','','{}','{}','{}','[]','[]','');
insert into content_packs(id,name,version,license) values('fixture','','','test-only');
insert into lemma_sources(id,pack_id,lemma) values('fixture','fixture','fixture');
insert into lemmas(id,lemma,pack_id) values('fixture','fixture','fixture');
insert into lemma_forms(id,lemma_id,form) values('fixture','fixture','fixture');
insert into lexeme_senses(id,lemma_id,sense_key,orthography) values('fixture','fixture','fixture','fixture');
do $$
declare u uuid; label text;
begin
 for u, label in select id, display_name from users loop
  insert into cards(id,user_id,lexeme_id,aspect,due) values (label,u,'fixture','meaning','2026-11-01T00:00:00Z');
  insert into review_logs(id,card_id,user_id,grade,state_before) values(label,label,u,3,0);
  insert into progress(user_id) values(u);
  insert into quest_runs(id,quest_id,user_id) values(u,'fixture',u);
  insert into session_batches(id,user_id,aspect) values(label,u,'meaning');
  insert into session_proposals(id,user_id,day_id) values(label,u,'2026-11-01');
  insert into agent_runs(id,user_id,agent) values(u,u,'fixture');
  insert into learning_events(id,user_id,event_type,card_id,session_batch_id,quest_run_id,agent_run_id)
   values(u,u,'retrieval_grade',label,label,u,u);
  insert into learner_memory_items(id,user_id,kind) values(u,u,'episode');
  insert into eval_scores(id,suite,metric,agent_run_id) values(u,'fixture','fixture',u);
 end loop;
 insert into agent_runs(agent) values('unowned fixture');
 insert into eval_scores(suite,metric) values('unowned fixture','fixture');
end $$;
