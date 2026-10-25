/**
 * Learner-facing UIs hide steward / NPC private panels by default.
 * Opt in with ?debug=1 on the current URL (client-only).
 */
export function isLearnerDebug(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1";
  } catch {
    return false;
  }
}
