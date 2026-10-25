import type {
  AgentRunRecord,
  EvalScoreRecord,
  LearningEventRecord,
} from "@echo-shards/core";
import type { FloorSummary } from "@/lib/content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EvalPanel({
  floor,
  pendingEmptyGloss,
  questCount,
  failures,
  runs,
  evalScores,
  events,
  memoryCount,
}: {
  floor: FloorSummary;
  pendingEmptyGloss: number;
  questCount: number;
  failures: string[];
  runs: AgentRunRecord[];
  evalScores: EvalScoreRecord[];
  events: LearningEventRecord[];
  memoryCount: number;
}) {
  const pass = failures.length === 0;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant={pass ? "secondary" : "destructive"}>
              gold suite {pass ? "PASS" : "FAIL"}
            </Badge>
            <Badge variant="outline">quests {questCount}</Badge>
            <Badge variant="outline">memory {memoryCount}</Badge>
          </div>
          <CardTitle className="font-display text-3xl">
            {pass ? "守卫通过" : "守卫未通过"}
          </CardTitle>
          <CardDescription>
            lemmas {floor.counts.lemmas} · pending {floor.counts.pending} · empty gloss{" "}
            {pendingEmptyGloss} · ready {floor.counts.ready}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {failures.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-destructive">
              {failures.map((failure) => (
                <li key={failure}>{failure}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              schedule-field 拒绝、TOPRA 单 aspect、must_elicit 英文命中 / 中文失败、721 与
              pending 空 gloss 政策均已核对。
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>agent_runs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {runs.slice(-10).map((run) => (
                <li key={run.id}>
                  {run.agent} · {run.tools.join(",")} · {run.status}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>eval_scores</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {evalScores.map((row) => (
                <li key={row.id}>
                  {row.suite}/{row.metric}={row.score ?? "null"}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>learning_events</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {events.slice(-10).map((event) => (
                <li key={event.id}>{event.event_type}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
