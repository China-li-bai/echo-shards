import type { Metadata } from "next";
import {
  AgentEventLog,
  EvalSentinel,
  LearnerMemory,
} from "@echo-shards/core";
import { EvalPanel } from "@/components/eval-panel";
import { getEvalSnapshot, getQuest } from "@/lib/content";
import { bundledCatalog, bundledSeedLexemes } from "@/lib/bundled-content";

export const metadata: Metadata = {
  title: "Eval Sentinel",
};

export default function EvalPage() {
  const snapshot = getEvalSnapshot();
  const seed = bundledSeedLexemes();
  const catalog = bundledCatalog();
  const quest = getQuest();
  const pending = catalog.filter((row) => row.enrichment_status === "pending");
  const pendingEmpty = pending.filter((row) => !row.gloss_zh.trim()).length;

  const log = new AgentEventLog();
  const sentinel = new EvalSentinel(log);
  const memory = new LearnerMemory(log);
  const failures = sentinel.runGoldSuite({
    lexeme: seed[0]!,
    quest,
    catalogStats: {
      lemmas: catalog.length,
      pending: pending.length,
      pendingEmptyGloss: pendingEmpty,
    },
  });
  memory.upsertEpisode({
    kind: "episode",
    text: `eval gold ${failures.length === 0 ? "pass" : "fail"}; pendingEmpty=${pendingEmpty}`,
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Eval Sentinel · Learner Memory
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">营地评估摘要</h1>
        <p className="mt-3 text-muted-foreground">
          金标守卫与本机构造快照。结果见下方。
        </p>
      </div>
      <EvalPanel
        floor={snapshot.floor}
        pendingEmptyGloss={snapshot.pendingEmptyGloss}
        questCount={snapshot.quests.length}
        failures={failures}
        runs={log.snapshot().runs}
        evalScores={log.snapshot().eval_scores}
        events={log.snapshot().events}
        memoryCount={memory.items.length}
      />
    </div>
  );
}
