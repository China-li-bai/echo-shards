/**
 * Dictionary pronunciation for one self-intro chunk.
 * This is how a dictionary reads the words. It does not listen to the learner.
 */

export async function dictionaryPronunciation(text: string): Promise<string> {
  const { phonemize } = await import("phonemizer");
  const rows = await phonemize(text, "en-us");
  return rows.map((row) => row.trim()).filter(Boolean).join(" ");
}
