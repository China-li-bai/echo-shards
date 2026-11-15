/**
 * Split an interview self-introduction into short speakable pieces.
 * This is text only. It does not listen, score, or schedule.
 */

export const SPEECH_CHUNK_WORD_CAP = 14;

export interface SpeechChunk {
  index: number;
  text: string;
  words: number;
}

const JOINERS = new Set([
  "and",
  "but",
  "so",
  "because",
  "which",
  "when",
  "while",
  "if",
  "or",
]);

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? "";
    current += ch;
    const cjkStop = ch === "。" || ch === "？" || ch === "！";
    const englishStop = ch === "." || ch === "?" || ch === "!";
    const next = text[i + 1] ?? "";
    if (cjkStop || (englishStop && (next === "" || /\s/.test(next)))) {
      const clean = tidy(current);
      if (clean) sentences.push(clean);
      current = "";
    }
  }
  const tail = tidy(current);
  if (tail) sentences.push(tail);
  return sentences;
}

function packParts(parts: string[]): string[] {
  const bins: string[] = [];
  let current = "";
  for (const part of parts) {
    const piece = tidy(part);
    if (!piece) continue;
    const next = current ? `${current} ${piece}` : piece;
    if (current && countWords(next) > SPEECH_CHUNK_WORD_CAP) {
      bins.push(current);
      current = piece;
    } else {
      current = next;
    }
  }
  if (current) bins.push(current);
  return bins;
}

function splitAtJoiner(sentence: string): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length <= SPEECH_CHUNK_WORD_CAP) return [sentence];
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  const mid = Math.floor(words.length / 2);
  for (let i = 3; i <= words.length - 3; i += 1) {
    const token = words[i]?.replace(/^[^a-z]+|[^a-z]+$/gi, "").toLowerCase();
    if (!token || !JOINERS.has(token)) continue;
    const distance = Math.abs(i - mid);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  if (best < 0) {
    const out: string[] = [];
    for (let i = 0; i < words.length; i += SPEECH_CHUNK_WORD_CAP) {
      out.push(words.slice(i, i + SPEECH_CHUNK_WORD_CAP).join(" "));
    }
    return out;
  }
  const left = words.slice(0, best).join(" ");
  const right = words.slice(best).join(" ");
  return [...splitAtJoiner(left), ...splitAtJoiner(right)];
}

function breakSentence(sentence: string): string[] {
  const clean = tidy(sentence);
  if (!clean) return [];
  if (countWords(clean) <= SPEECH_CHUNK_WORD_CAP) return [clean];
  const clauses = clean.split(/(?<=[,;:—])\s+/).filter(Boolean);
  if (clauses.length > 1) {
    return packParts(clauses).flatMap((part) =>
      countWords(part) > SPEECH_CHUNK_WORD_CAP ? splitAtJoiner(part) : [part],
    );
  }
  return splitAtJoiner(clean);
}

/** Return speakable pieces in order. Empty or blank input returns an empty list. */
export function chunkSelfIntro(input: string): SpeechChunk[] {
  const text = tidy(input ?? "");
  if (!text) return [];
  const sentences = splitSentences(text);
  const pieces = sentences.flatMap((sentence) => breakSentence(sentence));
  return pieces.map((piece, index) => ({
    index,
    text: piece,
    words: countWords(piece),
  }));
}
