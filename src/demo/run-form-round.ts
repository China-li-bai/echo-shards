/**
 * Demo：造 5 词 → 形界一轮提取练习 → 评分 → 打印下次 due
 * 运行：npm run demo
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LexemeSchema, type Grade, type Lexeme } from "../models/types.js";
import { TideScheduler } from "../scheduler/TideScheduler.js";
import { loadQuestFromYaml } from "../quest/loadQuest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

function fmtDue(d: Date): string {
  // Asia/Shanghai 展示
  return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

const STATE_NAME: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};

const GRADE_NAME: Record<Grade, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

function main() {
  console.log("=== 言灵残片 · 形界潮汐 Demo ===\n");

  const raw = JSON.parse(
    readFileSync(join(root, "content/lexemes/seed-en-zh-5.json"), "utf8"),
  );
  const lexemes: Lexeme[] = LexemeSchema.array().parse(raw);
  console.log(`已加载词条 ${lexemes.length} 个：`);
  for (const lx of lexemes) {
    console.log(`  - ${lx.orthography} ${lx.phonetic_text} → ${lx.gloss_zh}`);
  }

  const userId = "demo-user";
  const now = new Date();
  const tide = new TideScheduler({ requestRetention: 0.9 });

  // TOPRA：本轮只入队 form 轨
  const cards = tide.enqueueAspectBatch(userId, lexemes, "form", now);
  console.log(`\n入队形界卡 ${cards.length} 张（lexeme × form）`);

  const batch = tide.buildSessionBatch(userId, "form", 5, now);
  console.log(
    `\nSessionBatch ${batch.id}\n  aspect=${batch.aspect}  size=${batch.lexeme_ids.length}`,
  );

  // 模拟形界提取：先想拼写再揭晓；给一组评分
  const demoGrades: Grade[] = [3, 4, 3, 2, 3]; // Good Easy Good Hard Good
  console.log("\n--- 形界提取练习（评分）---");
  for (let i = 0; i < batch.card_ids.length; i++) {
    const cardId = batch.card_ids[i]!;
    const grade = demoGrades[i] ?? 3;
    const before = tide.getCard(cardId)!;
    const lx = lexemes.find((l) => l.id === before.lexeme_id)!;
    const { card } = tide.rate(cardId, grade, now);
    console.log(
      `  [${GRADE_NAME[grade].padEnd(5)}] ${lx.orthography.padEnd(10)} ` +
        `${STATE_NAME[before.review.state]} → ${STATE_NAME[card.review.state]}  ` +
        `S=${card.review.stability.toFixed(2)} D=${card.review.difficulty.toFixed(2)}  ` +
        `due=${fmtDue(card.review.due)} (Asia/Shanghai)`,
    );
  }

  const stillDue = tide.getDue(now, "form");
  console.log(`\n评分后仍到期(form)：${stillDue.length} 张`);
  console.log("全部形界卡下次 due：");
  for (const c of tide.allCards().filter((x) => x.aspect === "form")) {
    const lx = lexemes.find((l) => l.id === c.lexeme_id)!;
    console.log(
      `  ${lx.orthography.padEnd(10)} due=${fmtDue(c.review.due)}  reps=${c.review.reps}`,
    );
  }

  // 顺带校验文字 Quest（证明 SRS 与 Quest 分轨共存）
  const quest = loadQuestFromYaml(
    join(root, "content/quests/echo-bazaar-info-gap-01.yaml"),
  );
  console.log(`\nQuest 校验通过：${quest.id}「${quest.title}」`);
  console.log(`  must_elicit: ${quest.must_elicit.join(" | ")}`);
  console.log(`  target_lexemes: ${quest.target_lexemes.join(", ")}`);
  console.log(`\nrequest_retention=${tide.requestRetention}（可配置；本 demo 写死 0.9）`);
  console.log("Demo OK.");
}

main();
