/**
 * Read-only learning evidence.
 *
 * A due review is an evidence_version 1 retrieval whose reps_before is at least 1
 * and whose reviewed_at is at or after due_before. payload.due is the due written
 * after rate and is ignored. Good/Easy (3/4) is a self-rating, not mastery.
 * Clicks, XP, homepage opens, quest success, meaning-use skips, and fixtures
 * do not enter that numerator. A zero denominator is null, not 0% or 100%.
 * Day buckets use Asia/Shanghai via dayIdShanghai. The function does not rate,
 * write logs, or change unlocks.
 */

import { dayIdShanghai } from "./format.js";

export const LEARNING_EVIDENCE_VERSION = 1 as const;

export const LEARNING_EVIDENCE_DEFINITION =
  "numerator = deduped evidence v1 reviews with reps_before>=1 and reviewed_at>=due_before and grade>=3; denominator = the same set with any grade 1-4; Asia/Shanghai day buckets use reviewed_at; payload.due is ignored";

const ACTIVITY_NOTE = "clicks_and_xp_are_not_retention" as const;

export interface LearningEvidenceInput {
  events: readonly unknown[];
  meaningUseRecords?: readonly unknown[];
  /** Inclusive end instant. Rows with reviewed_at after this are outside the window. */
  asOf?: Date;
  /** Inclusive start instant. */
  windowStart?: Date;
}

export interface LearningEvidenceReport {
  status: "invalid" | "empty" | "observed";
  timezone: "Asia/Shanghai";
  definition: typeof LEARNING_EVIDENCE_DEFINITION;
  homepage_only: boolean;
  window: { start: string | null; end: string | null };
  activity: {
    retrieval_submissions: number | null;
    note: typeof ACTIVITY_NOTE;
  };
  delayed_retrieval: {
    status: "no_data" | "counted";
    numerator: number | null;
    denominator: number | null;
    ratio: number | null;
    again_count: number | null;
    again_ratio: number | null;
    grade_counts: { "1": number; "2": number; "3": number; "4": number } | null;
  };
  first_learning_count: number | null;
  early_count: number | null;
  cross_night: {
    status: "no_data" | "no_pair" | "counted";
    cards: number | null;
    still_self_rated_at_least_good: number | null;
    ratio: number | null;
  };
  compliance: {
    status: "no_data" | "unknown" | "observed";
    days: number | null;
  };
  meaning_use: {
    status: "not_provided" | "empty" | "invalid" | "counted";
    form_present_count: number | null;
    form_absent_count: number | null;
    skipped_count: number | null;
    fixture_excluded_count: number | null;
    not_accepted_count: number | null;
    semantic_judged_count: number | null;
    form_present_ratio: number | null;
    conflicts: { id: string }[];
  };
  quest: {
    success_count: number | null;
    must_elicit_hit_count: number | null;
    must_elicit_miss_count: number | null;
    counted_in_delayed_retrieval: false;
  };
  coverage: {
    missing_pre_review_evidence: number;
    with_pre_review_evidence: number;
    rejected: number;
    conflict_groups: number;
    outside_window: number;
    unsupported_version: number;
    missing_identity: number;
    missing_last_review: number;
  };
  conflicts: { client_event_id: string; event_ids: string[] }[];
  rejected: { event_id: string; reason: string }[];
}

type Grade = 1 | 2 | 3 | 4;
type ReviewClass = "first" | "early" | "delayed";

interface VersionedRow {
  key: string;
  clientEventId: string;
  eventId: string;
  signature: string;
  grade: Grade;
  cardId: string;
  reviewedAt: number;
  dueBefore: number;
  repsBefore: number;
  missingLastReview: boolean;
  reviewClass: ReviewClass;
}

interface LegacyRow {
  key: string;
  clientEventId: string;
  eventId: string;
  signature: string;
  grade: Grade;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function eventIdOf(value: unknown): string {
  if (isRecord(value) && typeof value.id === "string" && value.id.trim() !== "" && value.id === value.id.trim()) {
    return value.id;
  }
  return "(missing)";
}

function usableId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128 || trimmed !== value) return null;
  return trimmed;
}

function readInstant(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim()) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return time;
}

function readInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value;
}

function readGrade(value: unknown): Grade | null {
  const grade = readInteger(value);
  if (grade === 1 || grade === 2 || grade === 3 || grade === 4) return grade;
  return null;
}

function readCardId(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim()) return null;
  return value;
}

function emptyGrades(): { "1": number; "2": number; "3": number; "4": number } {
  return { "1": 0, "2": 0, "3": 0, "4": 0 };
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function groupUnique<T extends { key: string; clientEventId: string; eventId: string; signature: string }>(
  rows: readonly T[],
): { unique: T[]; conflicts: { client_event_id: string; event_ids: string[] }[] } {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(row.key);
    if (list) list.push(row);
    else groups.set(row.key, [row]);
  }
  const unique: T[] = [];
  const conflicts: { client_event_id: string; event_ids: string[] }[] = [];
  for (const list of groups.values()) {
    const signatures = new Set(list.map((row) => row.signature));
    if (signatures.size > 1) {
      conflicts.push({
        client_event_id: list[0]!.clientEventId,
        event_ids: [...new Set(list.map((row) => row.eventId))].sort(),
      });
      continue;
    }
    const sorted = list.slice().sort((a, b) => a.eventId.localeCompare(b.eventId));
    unique.push(sorted[0]!);
  }
  conflicts.sort((a, b) => a.client_event_id.localeCompare(b.client_event_id) || a.event_ids.join().localeCompare(b.event_ids.join()));
  return { unique, conflicts };
}

function blankMeaning(status: LearningEvidenceReport["meaning_use"]["status"]): LearningEvidenceReport["meaning_use"] {
  const counted = status === "empty" || status === "counted";
  return {
    status,
    form_present_count: counted ? 0 : null,
    form_absent_count: counted ? 0 : null,
    skipped_count: counted ? 0 : null,
    fixture_excluded_count: counted ? 0 : null,
    not_accepted_count: counted ? 0 : null,
    semantic_judged_count: counted ? 0 : null,
    form_present_ratio: null,
    conflicts: [],
  };
}

function blankReport(status: "invalid" | "empty", meaning: LearningEvidenceReport["meaning_use"]): LearningEvidenceReport {
  return {
    status,
    timezone: "Asia/Shanghai",
    definition: LEARNING_EVIDENCE_DEFINITION,
    homepage_only: false,
    window: { start: null, end: null },
    activity: {
      retrieval_submissions: status === "empty" ? 0 : null,
      note: ACTIVITY_NOTE,
    },
    delayed_retrieval: {
      status: "no_data",
      numerator: null,
      denominator: null,
      ratio: null,
      again_count: null,
      again_ratio: null,
      grade_counts: null,
    },
    first_learning_count: status === "empty" ? 0 : null,
    early_count: status === "empty" ? 0 : null,
    cross_night: {
      status: "no_data",
      cards: null,
      still_self_rated_at_least_good: null,
      ratio: null,
    },
    compliance: { status: "no_data", days: null },
    meaning_use: meaning,
    quest: {
      success_count: status === "empty" ? 0 : null,
      must_elicit_hit_count: status === "empty" ? 0 : null,
      must_elicit_miss_count: status === "empty" ? 0 : null,
      counted_in_delayed_retrieval: false,
    },
    coverage: {
      missing_pre_review_evidence: 0,
      with_pre_review_evidence: 0,
      rejected: 0,
      conflict_groups: 0,
      outside_window: 0,
      unsupported_version: 0,
      missing_identity: 0,
      missing_last_review: 0,
    },
    conflicts: [],
    rejected: [],
  };
}

function readBound(value: unknown): { ok: true; time: number | null } | { ok: false } {
  if (value === undefined) return { ok: true, time: null };
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return { ok: false };
  return { ok: true, time: value.getTime() };
}

interface MeaningRow {
  key: string;
  id: string;
  signature: string;
  kind: "pass" | "fail" | "skip" | "fixture" | "not_accepted";
  at: number | null;
  day: string | null;
}

function meaningRows(records: readonly unknown[]): { rows: MeaningRow[]; conflicts: { id: string }[] } {
  const parsed: MeaningRow[] = [];
  records.forEach((record, index) => {
    if (!isRecord(record)) {
      parsed.push({
        key: `anon:${index}`,
        id: `(missing:${index})`,
        signature: "not_accepted",
        kind: "not_accepted",
        at: null,
        day: null,
      });
      return;
    }
    const id = usableId(record.id);
    const key = id ?? `anon:${index}`;
    const fixture = record.fixture === true || record.simulation === "recorded-json";
    const checked = readInstant(record.checked_at);
    const day = checked === null ? null : dayIdShanghai(new Date(checked));
    const verdict = record.verdict;
    const semantic = record.semantic_status;
    const judged = record.meaning_judged === true;
    let kind: MeaningRow["kind"] = "not_accepted";
    if (fixture) kind = "fixture";
    else if (checked !== null && semantic === "not_evaluated" && !judged && verdict === "basic_pass") kind = "pass";
    else if (checked !== null && semantic === "not_evaluated" && !judged && verdict === "basic_fail") kind = "fail";
    else if (checked !== null && semantic === "not_evaluated" && !judged && verdict === "skipped") kind = "skip";
    parsed.push({
      key,
      id: id ?? `(missing:${index})`,
      signature: `${kind}|${checked ?? "none"}`,
      kind,
      at: checked,
      day: kind === "pass" || kind === "fail" || kind === "skip" ? day : null,
    });
  });
  const grouped = groupUnique(parsed.map((row) => ({ ...row, clientEventId: row.id, eventId: row.id })));
  return {
    rows: grouped.unique,
    conflicts: grouped.conflicts.map((row) => ({ id: row.client_event_id })),
  };
}

function summarizeMeaning(records: unknown): LearningEvidenceReport["meaning_use"] {
  if (records === undefined) return blankMeaning("not_provided");
  if (!Array.isArray(records)) return blankMeaning("invalid");
  if (records.length === 0) return blankMeaning("empty");
  const { rows, conflicts } = meaningRows(records);
  let pass = 0;
  let fail = 0;
  let skip = 0;
  let fixture = 0;
  let notAccepted = 0;
  for (const row of rows) {
    if (row.kind === "pass") pass += 1;
    else if (row.kind === "fail") fail += 1;
    else if (row.kind === "skip") skip += 1;
    else if (row.kind === "fixture") fixture += 1;
    else notAccepted += 1;
  }
  const sample = pass + fail;
  return {
    status: "counted",
    form_present_count: pass,
    form_absent_count: fail,
    skipped_count: skip,
    fixture_excluded_count: fixture,
    not_accepted_count: notAccepted,
    semantic_judged_count: 0,
    form_present_ratio: ratio(pass, sample),
    conflicts,
  };
}

export function summarizeLearningEvidence(input: LearningEvidenceInput | null | undefined): LearningEvidenceReport {
  if (!isRecord(input) || !Array.isArray(input.events)) {
    return blankReport("invalid", blankMeaning("not_provided"));
  }
  const start = readBound(input.windowStart);
  const end = readBound(input.asOf);
  if (!start.ok || !end.ok) return blankReport("invalid", blankMeaning("not_provided"));
  const windowed = start.time !== null || end.time !== null;

  const meaning = summarizeMeaning(input.meaningUseRecords);
  const events = input.events;
  const meaningProvided = input.meaningUseRecords !== undefined;
  const meaningEmpty = Array.isArray(input.meaningUseRecords) && input.meaningUseRecords.length === 0;
  if (events.length === 0 && (!meaningProvided || meaningEmpty)) {
    const report = blankReport("empty", meaning);
    report.window = {
      start: start.time === null ? null : new Date(start.time).toISOString(),
      end: end.time === null ? null : new Date(end.time).toISOString(),
    };
    return report;
  }

  const rejected: { event_id: string; reason: string }[] = [];
  const versioned: VersionedRow[] = [];
  const legacy: LegacyRow[] = [];
  let unsupported = 0;
  let missingIdentity = 0;
  const questSeen = new Set<string>();
  const quest = { success_count: 0, must_elicit_hit_count: 0, must_elicit_miss_count: 0 };

  const pushReject = (value: unknown, reason: string) => {
    rejected.push({ event_id: eventIdOf(value), reason });
  };

  for (const event of events) {
    if (!isRecord(event)) {
      pushReject(event, "not_an_event");
      continue;
    }
    const eventType = event.event_type;
    if (eventType === "quest_success" || eventType === "must_elicit_hit" || eventType === "must_elicit_miss") {
      const id = eventIdOf(event);
      const key = `${eventType}:${id}`;
      if (!questSeen.has(key)) {
        questSeen.add(key);
        if (eventType === "quest_success") quest.success_count += 1;
        if (eventType === "must_elicit_hit") quest.must_elicit_hit_count += 1;
        if (eventType === "must_elicit_miss") quest.must_elicit_miss_count += 1;
      }
      continue;
    }
    if (eventType !== "retrieval_grade") continue;

    const clientId = isRecord(event.payload) ? usableId(event.payload.client_event_id) : null;
    const ownId = usableId(event.id);
    const identity = clientId ?? ownId;
    if (!identity) {
      missingIdentity += 1;
      continue;
    }
    if (!isRecord(event.payload)) {
      pushReject(event, "bad_payload");
      continue;
    }
    const payload = event.payload;
    const version = payload.evidence_version;
    if (version === undefined) {
      const grade = readGrade(payload.grade);
      const cardId = readCardId(event.card_id);
      if (!grade) {
        pushReject(event, "bad_grade");
        continue;
      }
      if (!cardId) {
        pushReject(event, "missing_card");
        continue;
      }
      legacy.push({
        key: identity,
        clientEventId: clientId ?? ownId!,
        eventId: ownId ?? identity,
        signature: `legacy|${grade}|${cardId}`,
        grade,
      });
      continue;
    }
    if (version !== 1) {
      unsupported += 1;
      pushReject(event, "unsupported_version");
      continue;
    }
    const grade = readGrade(payload.grade);
    if (!grade) {
      pushReject(event, "bad_grade");
      continue;
    }
    const cardId = readCardId(event.card_id);
    if (!cardId) {
      pushReject(event, "missing_card");
      continue;
    }
    if (!("due_before" in payload) || !("reviewed_at" in payload) || !("reps_before" in payload) || !("state_before" in payload) || !("last_review_before" in payload)) {
      pushReject(event, "incomplete_evidence");
      continue;
    }
    const dueBefore = readInstant(payload.due_before);
    const reviewedAt = readInstant(payload.reviewed_at);
    if (dueBefore === null || reviewedAt === null) {
      pushReject(event, "bad_instant");
      continue;
    }
    const repsBefore = readInteger(payload.reps_before);
    const stateBefore = readInteger(payload.state_before);
    if (repsBefore === null || repsBefore < 0 || stateBefore === null || stateBefore < 0) {
      pushReject(event, "bad_reps");
      continue;
    }
    let lastReview: number | null = null;
    if (payload.last_review_before !== null) {
      lastReview = readInstant(payload.last_review_before);
      if (lastReview === null) {
        pushReject(event, "bad_last_review");
        continue;
      }
    }
    if (repsBefore === 0) {
      if (stateBefore !== 0 || lastReview !== null) {
        pushReject(event, "inconsistent_state");
        continue;
      }
    } else if (stateBefore === 0) {
      pushReject(event, "inconsistent_state");
      continue;
    } else if (lastReview !== null && lastReview >= reviewedAt) {
      pushReject(event, "bad_last_review");
      continue;
    }
    const reviewClass: ReviewClass =
      repsBefore === 0 ? "first" : reviewedAt >= dueBefore ? "delayed" : "early";
    versioned.push({
      key: identity,
      clientEventId: clientId ?? ownId!,
      eventId: ownId ?? identity,
      signature: `${grade}|${cardId}|${reviewedAt}|${dueBefore}|${repsBefore}|${stateBefore}|${lastReview ?? "none"}|1`,
      grade,
      cardId,
      reviewedAt,
      dueBefore,
      repsBefore,
      missingLastReview: repsBefore >= 1 && lastReview === null,
      reviewClass,
    });
  }

  const combined = [
    ...versioned.map((row) => ({ ...row, lane: "v1" as const })),
    ...legacy.map((row) => ({ ...row, lane: "legacy" as const })),
  ];
  const byIdentity = new Map<string, typeof combined>();
  for (const row of combined) {
    const list = byIdentity.get(row.key);
    if (list) list.push(row);
    else byIdentity.set(row.key, [row]);
  }
  const conflicts: { client_event_id: string; event_ids: string[] }[] = [];
  const versionedUnique: VersionedRow[] = [];
  const legacyUnique: LegacyRow[] = [];
  for (const list of byIdentity.values()) {
    const signatures = new Set(list.map((row) => row.signature));
    if (signatures.size > 1) {
      conflicts.push({
        client_event_id: list[0]!.clientEventId,
        event_ids: [...new Set(list.map((row) => row.eventId))].sort(),
      });
      continue;
    }
    const kept = list.slice().sort((a, b) => a.eventId.localeCompare(b.eventId))[0]!;
    if (kept.lane === "v1") versionedUnique.push(kept);
    else legacyUnique.push(kept);
  }
  conflicts.sort(
    (a, b) => a.client_event_id.localeCompare(b.client_event_id) || a.event_ids.join().localeCompare(b.event_ids.join()),
  );

  const inWindow: VersionedRow[] = [];
  let outside = 0;
  for (const row of versionedUnique) {
    const afterEnd = end.time !== null && row.reviewedAt > end.time;
    const beforeStart = start.time !== null && row.reviewedAt < start.time;
    if (afterEnd || beforeStart) outside += 1;
    else inWindow.push(row);
  }

  const delayed = inWindow.filter((row) => row.reviewClass === "delayed");
  const firstLearning = inWindow.filter((row) => row.reviewClass === "first");
  const early = inWindow.filter((row) => row.reviewClass === "early");
  const legacyCount = legacyUnique.length;
  const clicks = inWindow.length + (windowed ? 0 : legacyCount);

  let delayedBlock: LearningEvidenceReport["delayed_retrieval"];
  if (delayed.length === 0) {
    delayedBlock = {
      status: "no_data",
      numerator: null,
      denominator: null,
      ratio: null,
      again_count: null,
      again_ratio: null,
      grade_counts: null,
    };
  } else {
    const grades = emptyGrades();
    let numerator = 0;
    let again = 0;
    for (const row of delayed) {
      grades[String(row.grade) as "1" | "2" | "3" | "4"] += 1;
      if (row.grade >= 3) numerator += 1;
      if (row.grade === 1) again += 1;
    }
    delayedBlock = {
      status: "counted",
      numerator,
      denominator: delayed.length,
      ratio: ratio(numerator, delayed.length),
      again_count: again,
      again_ratio: ratio(again, delayed.length),
      grade_counts: grades,
    };
  }

  const byCard = new Map<string, VersionedRow[]>();
  for (const row of inWindow) {
    const list = byCard.get(row.cardId);
    if (list) list.push(row);
    else byCard.set(row.cardId, [row]);
  }
  let crossCards = 0;
  let crossKept = 0;
  if (inWindow.length > 0) {
    for (const list of byCard.values()) {
      const sorted = list.slice().sort((a, b) => a.reviewedAt - b.reviewedAt || a.eventId.localeCompare(b.eventId));
      let later: VersionedRow | null = null;
      for (let i = 0; i < sorted.length && !later; i += 1) {
        const earlierDay = dayIdShanghai(new Date(sorted[i]!.reviewedAt));
        for (let j = i + 1; j < sorted.length; j += 1) {
          const candidate = sorted[j]!;
          if (candidate.reviewClass !== "delayed") continue;
          if (dayIdShanghai(new Date(candidate.reviewedAt)) > earlierDay) {
            later = candidate;
            break;
          }
        }
      }
      if (!later) continue;
      crossCards += 1;
      if (later.grade >= 3) crossKept += 1;
    }
  }
  const crossNight: LearningEvidenceReport["cross_night"] =
    inWindow.length === 0
      ? { status: "no_data", cards: null, still_self_rated_at_least_good: null, ratio: null }
      : crossCards === 0
        ? { status: "no_pair", cards: null, still_self_rated_at_least_good: null, ratio: null }
        : {
            status: "counted",
            cards: crossCards,
            still_self_rated_at_least_good: crossKept,
            ratio: ratio(crossKept, crossCards),
          };

  const days = new Set<string>();
  for (const row of inWindow) days.add(dayIdShanghai(new Date(row.reviewedAt)));
  if (meaning.status === "counted" && Array.isArray(input.meaningUseRecords)) {
    for (const row of meaningRows(input.meaningUseRecords).rows) {
      if (!row.day || row.at === null) continue;
      if (end.time !== null && row.at > end.time) continue;
      if (start.time !== null && row.at < start.time) continue;
      days.add(row.day);
    }
  }
  let compliance: LearningEvidenceReport["compliance"];
  if (days.size > 0) compliance = { status: "observed", days: days.size };
  else if (legacyCount > 0) compliance = { status: "unknown", days: null };
  else compliance = { status: "observed", days: 0 };

  rejected.sort((a, b) => a.event_id.localeCompare(b.event_id) || a.reason.localeCompare(b.reason));
  const homepageOnly =
    events.length > 0 &&
    events.every((row) => isRecord(row) && row.event_type === "session_start") &&
    meaning.status === "not_provided";

  return {
    status: "observed",
    timezone: "Asia/Shanghai",
    definition: LEARNING_EVIDENCE_DEFINITION,
    homepage_only: homepageOnly,
    window: {
      start: start.time === null ? null : new Date(start.time).toISOString(),
      end: end.time === null ? null : new Date(end.time).toISOString(),
    },
    activity: { retrieval_submissions: clicks, note: ACTIVITY_NOTE },
    delayed_retrieval: delayedBlock,
    first_learning_count: firstLearning.length,
    early_count: early.length,
    cross_night: crossNight,
    compliance,
    meaning_use: meaning,
    quest: { ...quest, counted_in_delayed_retrieval: false },
    coverage: {
      missing_pre_review_evidence: legacyCount,
      with_pre_review_evidence: inWindow.length,
      rejected: rejected.length,
      conflict_groups: conflicts.length,
      outside_window: outside,
      unsupported_version: unsupported,
      missing_identity: missingIdentity,
      missing_last_review: inWindow.filter((row) => row.missingLastReview).length,
    },
    conflicts,
    rejected,
  };
}

export function formatLearningEvidence(report: LearningEvidenceReport): string[] {
  if (report.status === "invalid") {
    return ["这些记录读不了，暂时没有够用的数据。"];
  }
  const lines: string[] = [];
  const delayed = report.delayed_retrieval;
  if (delayed.status === "no_data") {
    lines.push("到期后再练时记不记得，暂时没有够用的记录。");
  } else {
    const sample = delayed.denominator !== null && delayed.denominator < 20 ? "样本少，" : "";
    lines.push(
      `到期后再练时，你自己选「记得」或「轻松」的有 ${delayed.numerator}/${delayed.denominator} 次。这是自评，${sample}不是测出来的学会，样本只有 ${delayed.denominator} 次。`,
    );
  }
  if (report.cross_night.status === "counted") {
    const cards = report.cross_night.cards;
    const kept = report.cross_night.still_self_rated_at_least_good;
    const sample = cards !== null && cards < 20 ? "样本少，" : "";
    lines.push(
      `隔了至少一个上海日，再到期练习时仍选「记得」或「轻松」的有 ${kept}/${cards} 张卡。这是自评，${sample}样本只有 ${cards} 张。`,
    );
  } else if (report.cross_night.status === "no_pair") {
    lines.push("还没有跨到下一个上海日的到期练习，看不出隔夜之后怎样。");
  }
  if (report.compliance.status === "observed" && report.compliance.days !== null) {
    lines.push(`按上海日期，有 ${report.compliance.days} 天做过回忆或造句。只打开页面不算。`);
  } else if (report.compliance.status === "unknown") {
    lines.push("哪几天做过练习，这些记录里还看不出来。");
  }
  if (report.coverage.missing_pre_review_evidence > 0) {
    lines.push(
      `有 ${report.coverage.missing_pre_review_evidence} 条练习记录没有练习前的到期时间，没有算进到期后的比例。`,
    );
  }
  if (report.conflicts.length > 0) {
    lines.push(`有 ${report.conflicts.length} 组编号相同但内容对不上的记录，没有拿来计数。`);
  }
  const use = report.meaning_use;
  if ((use.status === "counted" || use.status === "empty") && (use.form_present_count ?? 0) > 0) {
    lines.push(`有 ${use.form_present_count} 句里出现了目标词。意思用得对不对，还没判断。`);
  }
  if ((use.status === "counted" || use.status === "empty") && (use.skipped_count ?? 0) > 0) {
    lines.push("造句有跳过。跳过不算已经会用。");
  }
  return lines;
}
