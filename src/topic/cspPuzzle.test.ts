import { describe, expect, it } from "vitest";
import {
  cargoesFor,
  ITEMS,
  PUZZLE_CONFIG,
  type PuzzleConfig,
  replaySolution,
  rulePairs,
  solvePuzzle,
} from "./cspPuzzle";

/** CSP を使わず、岸の並びを直接たどって最短の渡しの回数を数える（検査器の答えと突き合わせる）。 */
function shortestByHand(config: PuzzleConfig): number | null {
  const names = ITEMS.map((item) => item.name as string);
  const pairs = rulePairs(config);
  const isSafe = (keeper: number, sides: number[]) =>
    pairs.every(([a, b]) => {
      const at = sides[names.indexOf(a)]!;
      return !(at === sides[names.indexOf(b)] && at !== keeper);
    });
  const cargoes = cargoesFor(config.capacity).map((cargo) =>
    cargo === "alone" ? [] : cargo.split("_").map((name) => names.indexOf(name)),
  );
  const key = (keeper: number, sides: number[]) => `${keeper}${sides.join("")}`;
  const queue: { keeper: number; sides: number[]; depth: number }[] = [
    { keeper: 0, sides: names.map(() => 0), depth: 0 },
  ];
  const seen = new Set([key(0, queue[0]!.sides)]);
  for (let head = 0; head < queue.length; head += 1) {
    const { keeper, sides, depth } = queue[head]!;
    if (keeper === 1 && sides.every((side) => side === 1)) return depth;
    for (const cargo of cargoes) {
      if (cargo.some((index) => sides[index] !== keeper)) continue;
      const next = sides.map((side, index) =>
        cargo.includes(index) ? 1 - side : side,
      );
      if (!isSafe(1 - keeper, next) || seen.has(key(1 - keeper, next))) continue;
      seen.add(key(1 - keeper, next));
      queue.push({ keeper: 1 - keeper, sides: next, depth: depth + 1 });
    }
  }
  return null;
}

/** 解き方を頭から実行し、どの時点でも規則を破らず、全員が向こう岸に着いてから solved になるか。 */
function isValidSolution(config: PuzzleConfig, solution: string[]): boolean {
  const names = ITEMS.map((item) => item.name as string);
  const sides = names.map(() => "L");
  let keeper = "L";
  for (const [index, event] of solution.entries()) {
    if (event === "solved")
      return (
        index === solution.length - 1 && keeper === "R" && sides.every((s) => s === "R")
      );
    const [direction, cargo] = event.split(".") as [string, string];
    if ((direction === "over") !== (keeper === "L")) return false;
    const items = cargo === "alone" ? [] : cargo.split("_");
    if (items.some((name) => sides[names.indexOf(name)] !== keeper)) return false;
    keeper = keeper === "L" ? "R" : "L";
    for (const name of items) sides[names.indexOf(name)] = keeper;
    for (const [a, b] of rulePairs(config)) {
      const at = sides[names.indexOf(a)];
      if (at === sides[names.indexOf(b)] && at !== keeper) return false;
    }
  }
  return false;
}

describe("パズルを検査器で解く", () => {
  it("重さ2までの舟では、検査器の反例が9回の渡しと solved になる", () => {
    const result = solvePuzzle({ capacity: 2, catTargets: 3 });
    expect(result.solution).toHaveLength(10);
    expect(result.solution?.at(-1)).toBe("solved");
  });

  it("反例の解き方はこの並び（レッスンの説明は、猫を先に運び、途中で連れ戻し、猫と小鳥を一緒に運ぶ手順に沿って書いてある）", () => {
    expect(solvePuzzle(PUZZLE_CONFIG).solution).toEqual([
      "over.cat",
      "back.alone",
      "over.fish",
      "back.cat",
      "over.cat_bird",
      "back.cat",
      "over.dog",
      "back.alone",
      "over.cat",
      "solved",
    ]);
  });

  it("反例の解き方は、頭から実行しても規則を破らない", () => {
    const config = { capacity: 2, catTargets: 3 };
    expect(isValidSolution(config, solvePuzzle(config).solution!)).toBe(true);
  });

  it("反例の渡しの回数は、CSP を使わずに数えた最短の回数と、どの設定でも一致する（幅優先なので最短）", () => {
    for (let capacity = 0; capacity <= 4; capacity += 1)
      for (let catTargets = 0; catTargets <= 3; catTargets += 1) {
        const config = { capacity, catTargets };
        const solution = solvePuzzle(config).solution;
        const trips = solution ? solution.length - 1 : null;
        expect(trips).toBe(shortestByHand(config));
        if (solution) expect(isValidSolution(config, solution)).toBe(true);
      }
  });

  it("重さ1までの舟では、金魚鉢と犬が載らないので解けず、仕様「solved は起きない」が成り立つ", () => {
    expect(solvePuzzle({ capacity: 1, catTargets: 3 }).solution).toBeNull();
  });

  it("猫が誰にもちょっかいを出さなければ、5回で渡れる（規則が手数を増やしている）", () => {
    expect(solvePuzzle({ capacity: 2, catTargets: 0 }).solution).toHaveLength(6);
  });

  it("重さ2までの舟に載せられるのは、空・1匹ずつ4通り・猫と小鳥の6通り", () => {
    expect(cargoesFor(2).sort()).toEqual(
      ["alone", "bird", "cat", "cat_bird", "dog", "fish"].sort(),
    );
  });

  it("解き方をなぞると、渡しごとの岸の様子が出て、最後は全員が向こう岸にいる", () => {
    const solution = solvePuzzle(PUZZLE_CONFIG).solution!;
    const banks = replaySolution(solution);
    expect(banks).toHaveLength(solution.length - 1);
    expect(banks[0]).toEqual({
      trip: "over.cat",
      keeper: "R",
      left: ["bird", "fish", "dog"],
      right: ["cat"],
    });
    expect(banks.at(-1)).toEqual({
      trip: solution.at(-2),
      keeper: "R",
      left: [],
      right: ["cat", "bird", "fish", "dog"],
    });
  });
});
