import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const db = new PGlite({ extensions: { pgcrypto } });
const sql = (path) => readFile(new URL(path, import.meta.url), "utf8");
async function asUser(user, statement, params = [], role = "authenticated") {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
    await tx.exec(`set local role ${role}`);
    return tx.query(statement, params);
  });
}
async function denied(user, statement, params = [], role = "authenticated") {
  await assert.rejects(() => asUser(user, statement, params, role),
    (error) => error.code === "42501" && /row-level security/.test(error.message));
}
async function isolationGate() {
  const result = await asUser(A, "select id from cards where user_id = $1", [B]);
  assert.equal(result.rows.length, 0, "RLS gate: A must not read B's card");
}
const privateTables = ["cards", "review_logs", "progress", "quest_runs", "session_batches",
  "session_proposals", "agent_runs", "learning_events", "learner_memory_items"];
try {
  console.log("E6a engine:", (await db.query("select version() as version")).rows[0].version);
  await db.exec(await sql("../supabase/migrations/001_text_foundation.sql"));
  await db.exec(await sql("../supabase/migrations/002_content_and_events.sql"));
  await db.exec(await sql("./fixtures/e6a-rls.sql"));
  const role = await asUser(A, "select current_user, rolsuper, rolbypassrls from pg_roles where rolname = current_user");
  assert.deepEqual(role.rows, [{ current_user: "authenticated", rolsuper: false, rolbypassrls: false }]);
  // Negative control uses identical grants and queries, but no policies.
  assert.equal((await asUser(A, "select id from cards where user_id = $1", [B])).rows.length, 1);
  await assert.rejects(isolationGate, /A must not read B/);
  console.log("E6a negative control: without RLS, A reads B; isolation assertion fails as required");
  if (!process.argv.includes("--without-rls")) {
    await db.exec(await sql("../supabase/migrations/003_rls_local_policy.sql"));
  }
  await isolationGate();
  // TRUNCATE bypasses RLS; Supabase-style broad grants must be narrowed too.
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(() => asUser(A, "truncate table cards cascade", [], role),
      (error) => error.code === "42501" && /permission denied/.test(error.message));
  }
  const protectedBefore = (await db.query(`select jsonb_build_object(
    'cards', (select jsonb_agg(c order by id) from cards c),
    'reviews', (select jsonb_agg(r order by id) from review_logs r)
  ) as snapshot`)).rows[0].snapshot;
  for (const [user, other] of [[A, B], [B, A]]) {
    for (const table of privateTables) {
      assert.equal((await asUser(user, `select * from ${table}`)).rows.length, 1, `${table}: own row only`);
      assert.equal((await asUser(user, `update ${table} set user_id = user_id where user_id = $1 returning user_id`, [user])).rows.length, 1, `${table}: own update succeeds`);
      assert.equal((await asUser(user, `select * from ${table} where user_id = $1`, [other])).rows.length, 0);
      assert.equal((await asUser(user, `update ${table} set user_id = user_id where user_id = $1 returning user_id`, [other])).rows.length, 0);
      assert.equal((await asUser(user, `delete from ${table} where user_id = $1 returning user_id`, [other])).rows.length, 0);
      await denied(user, `update ${table} set user_id = $1 where user_id = $2`, [other, user]);
    }
    assert.deepEqual((await asUser(user, "select id from users")).rows, [{ id: user }]);
    assert.equal((await asUser(user, "update users set display_name = 'forged' where id = $1 returning id", [other])).rows.length, 0);
    assert.equal((await asUser(user, "delete from users where id = $1 returning id", [other])).rows.length, 0);
    await denied(user, "update users set id = $1 where id = $2", [other, user]);
    assert.deepEqual((await asUser(user, "select id from eval_scores")).rows, [{ id: user }]);
    assert.equal((await asUser(user, "update eval_scores set score = 99 where id = $1 returning id", [other])).rows.length, 0);
    assert.equal((await asUser(user, "delete from eval_scores where id = $1 returning id", [other])).rows.length, 0);
    await denied(user, "update eval_scores set agent_run_id = $1 where id = $2", [other, user]);
  }
  assert.deepEqual((await db.query(`select jsonb_build_object(
    'cards', (select jsonb_agg(c order by id) from cards c),
    'reviews', (select jsonb_agg(r order by id) from review_logs r)
  ) as snapshot`)).rows[0].snapshot, protectedBefore, "foreign mutations leave practice unchanged");
  const forgedInserts = [
    "insert into review_logs(id,card_id,user_id,grade,state_before) values('foreign','B',$1,3,0)",
    "insert into progress(user_id) values($1)",
    "insert into quest_runs(quest_id,user_id) values('fixture',$1)",
    "insert into session_batches(id,user_id,aspect) values('foreign',$1,'meaning')",
    "insert into session_proposals(id,user_id,day_id) values('foreign',$1,'2026-11-01')",
    "insert into agent_runs(user_id,agent) values($1,'fixture')",
    "insert into learning_events(user_id,event_type) values($1,'intent')",
    "insert into learner_memory_items(user_id,kind) values($1,'episode')",
    "insert into eval_scores(suite,metric,agent_run_id) values('fixture','fixture',$1)",
  ];
  for (const statement of forgedInserts) await denied(A, statement, [B]);
  await denied("", "insert into quest_runs(quest_id,user_id) values('fixture',$1)", [A]);
  for (const table of ["lexemes", "quests", "content_packs", "lemma_sources", "lemmas", "lemma_forms", "lexeme_senses"]) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await asUser(A, `select * from ${table}`, [], role)).rows.length, 1);
      assert.equal((await asUser(A, `update ${table} set id = id returning id`, [], role)).rows.length, 0);
      assert.equal((await asUser(A, `delete from ${table} returning id`, [], role)).rows.length, 0);
    }
  }
  await denied(A, "insert into lexemes(id,lemma,orthography,phonetic_text,gloss_zh,sense_id,example_sentence) values('forged','','','','','','')");
  // WITH CHECK must throw actual PostgreSQL 42501, not just hide SELECT results.
  await denied(A, "insert into cards(id,user_id,lexeme_id,aspect,due) values('forged',$1,'fixture','form',now())", [B]);
  await denied(A, "insert into review_logs(id,card_id,user_id,grade,state_before) values('forged','B',$1,3,0)", [A]);
  await denied(A, "update review_logs set card_id = 'B' where id = 'A'");
  for (const [column, value] of [["card_id", "B"], ["session_batch_id", "B"], ["quest_run_id", B], ["agent_run_id", B]]) {
    await denied(A, `update learning_events set ${column} = $1 where id = $2`, [value, A]);
  }
  await denied(A, "update review_logs set learning_event_id = $1 where id = 'A'", [B]);
  await denied(A, "update review_logs set agent_run_id = $1 where id = 'A'", [B]);
  for (const user of ["", A]) {
    for (const table of ["users", ...privateTables, "eval_scores"]) {
      assert.equal((await asUser(user, `select * from ${table}`, [], "anon")).rows.length, 0, `${table}: anon denied`);
      assert.equal((await asUser("", `select * from ${table}`)).rows.length, 0, `${table}: missing uid denied`);
      assert.equal((await asUser(user, `delete from ${table} returning *`, [], "anon")).rows.length, 0);
    }
    await denied(user, "insert into progress(user_id) values($1)", [A], "anon");
    await denied(user, "insert into users(id) values('33333333-3333-3333-3333-333333333333')", [], "anon");
  }
  // Positive controls: own read/write succeeds, so broad grants are real.
  await asUser(A, "update users set display_name = 'own edit' where id = $1", [A]);
  await asUser(A, "insert into review_logs(id,card_id,user_id,grade,state_before,client_event_id,reviewed_at) values('new-a','A',$1,3,0,'same-event','2026-11-01T00:00:00Z')", [A]);
  await asUser(B, "insert into review_logs(id,card_id,user_id,grade,state_before,client_event_id) values('new-b','B',$1,3,0,'same-event')", [B]);
  await assert.rejects(() => asUser(A, "insert into review_logs(id,card_id,user_id,grade,state_before,client_event_id) values('duplicate','A',$1,4,0,'same-event')", [A]), (e) => e.code === "23505");
  for (const bad of ["", " padded ", "\tpadded\n", "\vpadded\v", "x".repeat(129)]) {
    await assert.rejects(() => asUser(A, "insert into review_logs(id,card_id,user_id,grade,state_before,client_event_id) values('bad','A',$1,3,0,$2)", [A, bad]), (e) => e.code === "23514");
  }
  await asUser(A, "insert into review_logs(id,card_id,user_id,grade,state_before,client_event_id) values('valid-v','A',$1,3,0,'valid-v')", [A]);
  // Existing rows remain nullable; replay inputs are preserved, never computed by SQL.
  assert.equal((await asUser(A, "select client_event_id from review_logs where id = 'A'")).rows[0].client_event_id, null);
  const replay = await asUser(A, "select card_id, grade, state_before, reviewed_at, client_event_id from review_logs where id = 'new-a'");
  assert.equal(replay.rows[0].card_id, "A");
  assert.equal(replay.rows[0].grade, 3);
  assert.equal(replay.rows[0].state_before, 0);
  assert.equal(new Date(replay.rows[0].reviewed_at).toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal((await db.query("select count(*)::int as n from cards")).rows[0].n, 2);
  assert.equal((await db.query("select display_name from users where id = $1", [B])).rows[0].display_name, "B");
  assert.equal((await db.query("select count(*)::int as n from cards where due = '2026-11-01T00:00:00Z' and stability = 0 and scheduled_days = 0")).rows[0].n, 2);
  console.log("E6a PASS: PostgreSQL WASM RLS; A/B read/update/delete isolation; 42501 write denial; anon denied; replay uniqueness; schedule untouched");
} finally {
  await db.close();
}
