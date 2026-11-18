// 性質ベーステストの最小の実装（fast-check や Hypothesis がやっていることの芯）。
// 乱数はシード付きにする。Math.random だと画面とテストが毎回変わり、説明の数字が合わなくなる。

/** 32 ビットの小さな擬似乱数（mulberry32）。0 以上 1 未満を返す関数を作る。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MAX_LENGTH = 8;
export const MAX_VALUE = 9;

/** 長さ 0〜8、値 0〜9 の配列を作る。 */
export function generateArray(random: () => number): number[] {
  const length = Math.floor(random() * (MAX_LENGTH + 1));
  return Array.from({ length }, () => Math.floor(random() * (MAX_VALUE + 1)));
}

/** 正しい実装: 出てきた順に、まだ無い値だけ残す。 */
export function uniqueValues(values: number[]): number[] {
  return [...new Set(values)];
}

/** よくある誤り: 並べ替えずに「隣と同じなら捨てる」だけにしている。 */
export function removeAdjacentDuplicates(values: number[]): number[] {
  return values.filter((value, i) => i === 0 || value !== values[i - 1]);
}

export function hasNoDuplicates(values: number[]): boolean {
  return new Set(values).size === values.length;
}

/** 1 つ小さい候補を並べる。先に要素を 1 つ消す候補、次に値を 0 や 1 つ小さい値に変える候補。 */
export function shrinkCandidates(values: number[]): number[][] {
  const candidates: number[][] = [];
  values.forEach((_, i) => candidates.push(values.filter((__, j) => j !== i)));
  values.forEach((value, i) => {
    const smaller = new Set<number>();
    if (value > 0) smaller.add(0);
    if (value > 1) smaller.add(value - 1);
    for (const next of smaller)
      candidates.push(values.map((v, j) => (j === i ? next : v)));
  });
  return candidates;
}

export type Property = (input: number[], output: number[]) => boolean;

export interface PropertyTestResult {
  /** 実際に試した入力の数。反例が見つかったらそこで止まる。 */
  runs: number;
  /** 最初に見つかった反例。 */
  failing: number[] | null;
  /** 縮めきった反例。 */
  shrunk: number[] | null;
  /** 縮める途中の反例。先頭が見つかった反例、末尾が縮めきった反例。 */
  shrinkSteps: number[][];
}

export function runPropertyTest(
  subject: (values: number[]) => number[],
  property: Property,
  options: { seed: number; runs: number },
): PropertyTestResult {
  const random = mulberry32(options.seed);
  const fails = (input: number[]) => !property(input, subject(input));

  for (let run = 1; run <= options.runs; run += 1) {
    const input = generateArray(random);
    if (!fails(input)) continue;

    // 欲張りに縮める: 性質を破ったままの候補が見つかる限り、それに乗り換える。
    const shrinkSteps = [input];
    let current = input;
    for (;;) {
      const next = shrinkCandidates(current).find(fails);
      if (!next) break;
      current = next;
      shrinkSteps.push(current);
    }
    return { runs: run, failing: input, shrunk: current, shrinkSteps };
  }
  return { runs: options.runs, failing: null, shrunk: null, shrinkSteps: [] };
}

export function formatArray(values: number[]): string {
  return `[${values.join(", ")}]`;
}
