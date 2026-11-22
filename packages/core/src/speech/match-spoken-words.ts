/**
 * Compare a script with a transcript word by word.
 * A match means the word showed up in the transcript. It is not a
 * pronunciation score and it does not schedule.
 */

export interface SpokenWordMatch {
  heard: string[];
  missing: string[];
  extra: string[];
}

const EXPANSIONS: Record<string, readonly string[]> = {
  "i'm": ["i", "am"],
  "i've": ["i", "have"],
  "i'll": ["i", "will"],
  "i'd": ["i", "would"],
  "don't": ["do", "not"],
  "doesn't": ["does", "not"],
  "didn't": ["did", "not"],
  "can't": ["cannot"],
  "won't": ["will", "not"],
  "it's": ["it", "is"],
  "that's": ["that", "is"],
  "there's": ["there", "is"],
  "we're": ["we", "are"],
  "they're": ["they", "are"],
  "you're": ["you", "are"],
  "let's": ["let", "us"],
  "isn't": ["is", "not"],
  "aren't": ["are", "not"],
  "wasn't": ["was", "not"],
  "weren't": ["were", "not"],
};

function expand(token: string): string[] {
  const key = token.replace(/’/g, "'");
  const known = EXPANSIONS[key];
  if (known) return [...known];
  if (/^\d+(?:\.\d+)+$/.test(key)) return [key];
  const plain = key.replace(/[^a-z0-9]+/g, "");
  return plain ? [plain] : [];
}

function wordsOf(text: string): string[] {
  const rough = text.toLowerCase().match(/[a-z0-9]+(?:[.'][a-z0-9]+)*/g) ?? [];
  return rough.flatMap((token) => expand(token));
}

/** Walk the script in order. Extra transcript words do not fill a missing script word. */
export function matchSpokenWords(reference: string, transcript: string): SpokenWordMatch {
  const expected = wordsOf(reference ?? "");
  const said = wordsOf(transcript ?? "");
  const heard: string[] = [];
  const missing: string[] = [];
  const extra: string[] = [];
  let cursor = 0;
  for (const word of expected) {
    let found = -1;
    for (let index = cursor; index < said.length; index += 1) {
      if (said[index] === word) {
        found = index;
        break;
      }
    }
    if (found < 0) {
      missing.push(word);
      continue;
    }
    for (let index = cursor; index < found; index += 1) extra.push(said[index] ?? "");
    heard.push(word);
    cursor = found + 1;
  }
  for (let index = cursor; index < said.length; index += 1) extra.push(said[index] ?? "");
  return { heard, missing, extra };
}
