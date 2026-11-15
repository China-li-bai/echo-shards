/**
 * Compare two phoneme strings for a practice hint.
 * A slip is not a grade, not mastery, and not a schedule change.
 */

export interface PracticeSoundSlip {
  expected: string;
  heard: string | null;
}

export interface PracticeSoundHint {
  compared: boolean;
  slips: PracticeSoundSlip[];
}

function phones(input: string): string[] {
  return [...(input ?? "").normalize("NFC")].filter((symbol) => {
    if (/\s/.test(symbol)) return false;
    return symbol !== "ˈ" && symbol !== "ˌ" && symbol !== "/" && symbol !== "." && symbol !== "ˌ";
  });
}

/** Align the dictionary phones with phones from a recording. Empty input is not a comparison. */
export function practiceSoundHints(expected: string, heard: string): PracticeSoundHint {
  const left = phones(expected).slice(0, 80);
  const right = phones(heard).slice(0, 80);
  if (left.length === 0 || right.length === 0) return { compared: false, slips: [] };
  const slips: PracticeSoundSlip[] = [];
  const height = left.length + 1;
  const width = right.length + 1;
  const cost: number[] = new Array(height * width).fill(0);
  const at = (row: number, col: number) => row * width + col;
  for (let row = 1; row < height; row += 1) cost[at(row, 0)] = row;
  for (let col = 1; col < width; col += 1) cost[at(0, col)] = col;
  for (let row = 1; row < height; row += 1) {
    for (let col = 1; col < width; col += 1) {
      const swap = left[row - 1] === right[col - 1] ? 0 : 1;
      cost[at(row, col)] = Math.min(
        cost[at(row - 1, col)] + 1,
        cost[at(row, col - 1)] + 1,
        cost[at(row - 1, col - 1)] + swap,
      );
    }
  }
  let row = left.length;
  let col = right.length;
  while (row > 0 || col > 0) {
    if (row > 0 && col > 0 && cost[at(row, col)] === cost[at(row - 1, col - 1)] + (left[row - 1] === right[col - 1] ? 0 : 1)) {
      if (left[row - 1] !== right[col - 1]) slips.push({ expected: left[row - 1] ?? "", heard: right[col - 1] ?? "" });
      row -= 1;
      col -= 1;
    } else if (row > 0 && cost[at(row, col)] === cost[at(row - 1, col)] + 1) {
      slips.push({ expected: left[row - 1] ?? "", heard: null });
      row -= 1;
    } else {
      col -= 1;
    }
  }
  slips.reverse();
  return { compared: true, slips };
}
