/**
 * One shown card, one grade submission.
 *
 * The lock is this object, updated before rate() returns. Button disabled
 * state and timers are not the lock. client_event_id and reviewedAt are fixed
 * on the first click so a retry matches E2a instead of conflicting.
 *
 * This does not write disk itself. If persist() throws after rate(), the
 * grade stays in the scheduler memory, saved is false, and the error is
 * returned. A new submitter after that process is gone cannot see the grade
 * unless the caller stored the snapshot. Cross-device sync is out of scope.
 */
import type { Grade } from "@echo-shards/core";

export type GradeSubmitStatus =
  | "saved"
  | "already-inflight"
  | "already-submitted"
  | "stale"
  | "rate-failed"
  | "save-failed"
  | "grade-locked";

export interface GradeAttempt {
  cardId: string;
  grade: Grade;
  reviewedAt: Date;
  clientEventId: string;
}

export interface GradeSubmitResult {
  status: GradeSubmitStatus;
  clientEventId?: string;
  reviewedAt?: string;
  advanced: boolean;
  saved: boolean;
  replayed: boolean;
  error?: string;
}

interface Slot {
  cardId: string;
  clientEventId: string;
  reviewedAt?: Date;
  grade?: Grade;
  phase: "armed" | "inflight" | "rate-failed" | "rated" | "saved";
  replayed: boolean;
}

function idle(partial: Pick<GradeSubmitResult, "status" | "error"> & Partial<GradeSubmitResult>): GradeSubmitResult {
  return {
    advanced: false,
    saved: false,
    replayed: false,
    ...partial,
  };
}

function fromSlot(slot: Slot, partial: Pick<GradeSubmitResult, "status" | "advanced" | "saved" | "replayed" | "error">): GradeSubmitResult {
  return {
    clientEventId: slot.clientEventId,
    reviewedAt: slot.reviewedAt?.toISOString(),
    ...partial,
  };
}

export function gradeFromHotkey(key: string): Grade | null {
  if (key === "1" || key === "2" || key === "3" || key === "4") return Number(key) as Grade;
  return null;
}

export function createGradeSubmitter(deps: { now: () => Date; newId: () => string }) {
  let slot: Slot | null = null;

  function show(cardId: string | null) {
    if (!cardId) return;
    if (slot?.cardId === cardId) return;
    if (slot && slot.phase !== "saved" && slot.phase !== "armed") return;
    slot = {
      cardId,
      clientEventId: deps.newId(),
      phase: "armed",
      replayed: false,
    };
  }

  function submit(input: {
    cardId: string;
    grade: Grade;
    rate: (attempt: GradeAttempt) => { replayed: boolean };
    persist: () => void;
  }): GradeSubmitResult {
    if (!slot || slot.cardId !== input.cardId) {
      return idle({ status: "stale" });
    }
    if (slot.phase === "inflight") {
      return fromSlot(slot, { status: "already-inflight", advanced: false, saved: false, replayed: false });
    }
    if (slot.phase === "saved") {
      return fromSlot(slot, { status: "already-submitted", advanced: false, saved: true, replayed: false });
    }
    if (slot.grade !== undefined && slot.grade !== input.grade) {
      return fromSlot(slot, { status: "grade-locked", advanced: false, saved: false, replayed: false });
    }
    if (slot.phase === "armed") {
      slot.grade = input.grade;
      slot.reviewedAt = deps.now();
    }
    if (!slot.reviewedAt || slot.grade === undefined) {
      return fromSlot(slot, { status: "rate-failed", advanced: false, saved: false, replayed: false, error: "这次评分还没有固定时间" });
    }
    const attempt: GradeAttempt = {
      cardId: slot.cardId,
      grade: slot.grade,
      reviewedAt: slot.reviewedAt,
      clientEventId: slot.clientEventId,
    };
    const phaseBefore = slot.phase;
    slot.phase = "inflight";
    let replayed = false;
    try {
      replayed = input.rate(attempt).replayed;
      slot.replayed = replayed;
    } catch (error) {
      slot.phase = phaseBefore === "rated" ? "rated" : "rate-failed";
      return fromSlot(slot, {
        status: "rate-failed",
        advanced: false,
        saved: false,
        replayed: false,
        error: error instanceof Error ? error.message : "评分没有写进调度器",
      });
    }
    try {
      input.persist();
    } catch (error) {
      slot.phase = "rated";
      return fromSlot(slot, {
        status: "save-failed",
        advanced: false,
        saved: false,
        replayed,
        error: error instanceof Error ? error.message : "评分没有保存",
      });
    }
    slot.phase = "saved";
    return fromSlot(slot, { status: "saved", advanced: true, saved: true, replayed });
  }

  function reset() {
    slot = null;
  }

  return { show, submit, reset };
}

export type GradeSubmitter = ReturnType<typeof createGradeSubmitter>;
