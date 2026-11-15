/**
 * Interview self-intro chunks stay short, and the speak page does not schedule.
 * Run: node --import tsx scripts/assert-speak-chunks.mjs
 */
import { readFileSync } from "node:fs";
import { chunkSelfIntro } from "../packages/core/src/speech/chunk-self-intro.ts";
import { matchSpokenWords } from "../packages/core/src/speech/match-spoken-words.ts";

const errors = [];
const root = new URL("..", import.meta.url);

function read(rel) {
  return readFileSync(new URL(rel, root), "utf8");
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

const empty = chunkSelfIntro("   ");
check(empty.length === 0, "blank input returns no chunks");

const one = chunkSelfIntro("I am a software engineer.");
check(one.length === 1 && one[0].text === "I am a software engineer.", "one short sentence stays whole");
check(one[0].words === 5, "word count counts the sentence");

const two = chunkSelfIntro("I am a software engineer. I like small first steps.");
check(two.length === 2, "two sentences become two chunks");
check(two[1].text.startsWith("I like"), "second sentence is kept");

const chinese = chunkSelfIntro("我先说一句。然后说下一句。");
check(chinese.length === 2, "Chinese sentence marks split");

const decimal = chunkSelfIntro("I have 3.5 years of experience.");
check(decimal.length === 1 && decimal[0].text.includes("3.5"), "a decimal point stays inside the sentence");

const long =
  "I have worked on products where the first screen must tell a beginner what to do next, and I like breaking a large goal into one small step that a person can finish today.";
const parts = chunkSelfIntro(long);
check(parts.length >= 2, "a long sentence splits");
check(parts.every((part) => part.words <= 14), `every chunk stays within 14 words: ${parts.map((p) => p.words).join(",")}`);
check(parts.map((part) => part.text).join(" ").includes("and I like"), "the joiner stays with the following words");

const comma =
  "I studied design, I shipped a small practice app, and I want a role where clear writing matters.";
const commaParts = chunkSelfIntro(comma);
check(commaParts.length >= 2, "commas give a breath point");
check(commaParts.every((part) => part.words <= 14), "comma chunks stay within the cap");

const source = read("packages/core/src/speech/chunk-self-intro.ts");
check(!source.includes("TideScheduler"), "chunker does not touch the scheduler");
check(!source.includes("rate("), "chunker does not rate");

const matcher = read("packages/core/src/speech/match-spoken-words.ts");
check(!matcher.includes("TideScheduler"), "word match does not touch the scheduler");
check(!matcher.includes("fetch("), "word match does not download a model");

const heardAll = matchSpokenWords("I am a software engineer.", "I am a software engineer");
check(heardAll.missing.length === 0 && heardAll.heard.length === 5, "same words count as heard");

const missingArticle = matchSpokenWords("I am a software engineer.", "I am software engineer");
check(missingArticle.missing.join(",") === "a", "a skipped word stays missing");

const contraction = matchSpokenWords("I'm a software engineer.", "I am a software engineer");
check(contraction.missing.length === 0, "I'm matches I am");

const notSubstring = matchSpokenWords("I saw a cat.", "I saw a catch");
check(notSubstring.missing.join(",") === "cat", "catch does not count as cat");
check(notSubstring.extra.join(",") === "catch", "the different word stays extra");

const reference = read("apps/web/src/lib/speak-reference.ts");
check(reference.includes("onnx-community/Kokoro-82M-v1.0-ONNX"), "reference voice names the Kokoro ONNX model");
check(reference.includes('dtype: "q8"'), "reference voice uses the smaller q8 build");
check(!reference.includes("TideScheduler"), "reference voice does not schedule");
check(!reference.includes("process.env"), "reference voice does not read environment secrets");

const transcribe = read("apps/web/src/lib/transcribe-speak.ts");
check(transcribe.includes("Xenova/whisper-tiny.en"), "browser model id is whisper tiny english");
check(!transcribe.includes("TideScheduler"), "transcription does not schedule");
check(!transcribe.includes("process.env"), "transcription does not read environment secrets");

const page = read("apps/web/src/components/speak-desk.tsx");
check(page.includes("分成小段"), "learner can split the script");
check(page.includes("听这一小段"), "learner can hear the reference line");
check(page.includes("听我自己"), "learner can replay their own voice");
check(page.includes("不会判断你的发音对不对"), "the page does not claim a pronunciation verdict");
check(page.includes("看看词说全了没有"), "learner can ask whether the words were heard");
check(page.includes("不是发音对了"), "a word match is not called correct pronunciation");
check(page.includes("示范模型这次没装上，先放系统声音"), "a failed model voice falls back to the system voice");
check(!page.includes("TideScheduler"), "speak page does not construct a scheduler");
check(!page.includes(".rate("), "speak page does not rate");

const header = read("apps/web/src/components/site-header.tsx");
check(header.includes('href: "/speak"'), "self-intro link exists");
check(header.includes("hasFirstMeaningSuccess"), "first-success gate remains");

if (errors.length > 0) {
  console.error(`assert-speak-chunks: FAIL (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("assert-speak-chunks: ok");
