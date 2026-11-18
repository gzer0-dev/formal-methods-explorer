import { describe, expect, it } from "vitest";
import { checkWithdraw } from "./contracts";
import { coverTransitions } from "./coverage";
import { ORDER_ACTIONS } from "./models";
import {
  hasNoDuplicates,
  removeAdjacentDuplicates,
  runPropertyTest,
  shrinkCandidates,
  uniqueValues,
} from "./pbt";
import { checkBossInstances } from "./smallScope";

describe("事前条件・事後条件（引き出し）", () => {
  it("事前条件が「金額 > 0」だけだと、残高 0 から 1 を引く反例が最初に見つかる", () => {
    const result = checkWithdraw({ maxBalance: 5, maxAmount: 5, requireEnough: false });
    expect(result.checked).toBe(30);
    expect(result.counterexample).toEqual({ balance: 0, amount: 1, after: -1 });
  });

  it("「金額 ≦ 残高」を足すと、範囲内の 15 通りすべてで事後条件が成り立つ", () => {
    const result = checkWithdraw({ maxBalance: 5, maxAmount: 5, requireEnough: true });
    expect(result.checked).toBe(15);
    expect(result.counterexample).toBeNull();
  });
});

describe("性質ベーステスト（重複を取り除く関数）", () => {
  const property = (input: number[], output: number[]) =>
    hasNoDuplicates(output) && input.every((value) => output.includes(value));

  it("正しい実装は 100 回の入力すべてで性質を満たす", () => {
    const result = runPropertyTest(uniqueValues, property, { seed: 7, runs: 100 });
    expect(result.failing).toBeNull();
    expect(result.runs).toBe(100);
  });

  it("隣どうしだけ見る実装は反例が見つかり、縮めた反例も性質を破る", () => {
    const result = runPropertyTest(removeAdjacentDuplicates, property, {
      seed: 7,
      runs: 100,
    });
    expect(result.failing).not.toBeNull();
    const shrunk = result.shrunk!;
    expect(property(shrunk, removeAdjacentDuplicates(shrunk))).toBe(false);
    expect(shrunk).toHaveLength(3);
    // これ以上縮められない: どの候補も性質を満たしてしまう。
    for (const candidate of shrinkCandidates(shrunk)) {
      expect(property(candidate, removeAdjacentDuplicates(candidate))).toBe(true);
    }
    expect(result.shrinkSteps[0]).toEqual(result.failing);
    expect(result.shrinkSteps.at(-1)).toEqual(shrunk);
  });

  it("同じシードなら毎回同じ結果になる", () => {
    const first = runPropertyTest(removeAdjacentDuplicates, property, {
      seed: 7,
      runs: 100,
    });
    const second = runPropertyTest(removeAdjacentDuplicates, property, {
      seed: 7,
      runs: 100,
    });
    expect(second).toEqual(first);
  });
});

describe("小さな範囲で全部調べる（3 人の上司の関係）", () => {
  it("制約なしでは 64 通り、うち 48 通りで「自分が自分の上司筋」になる", () => {
    const result = checkBossInstances({ forbidSelf: false, forbidCycle: false });
    expect(result.total).toBe(64);
    expect(result.counterexampleCount).toBe(48);
    expect(result.firstCounterexample).toEqual({ A: null, B: null, C: "C" });
  });

  it("自分を上司にしない制約だけでは、27 通りのうち 11 通りに輪が残る", () => {
    const result = checkBossInstances({ forbidSelf: true, forbidCycle: false });
    expect(result.total).toBe(27);
    expect(result.counterexampleCount).toBe(11);
    expect(result.firstCounterexample).toEqual({ A: null, B: "C", C: "B" });
  });

  it("輪を禁じる制約を入れると、残る 16 通りに反例は無い", () => {
    const result = checkBossInstances({ forbidSelf: true, forbidCycle: true });
    expect(result.total).toBe(16);
    expect(result.counterexampleCount).toBe(0);
  });
});

describe("遷移を網羅するテストの生成", () => {
  it("注文の 5 本の遷移を 3 本のテストで通る", () => {
    expect(coverTransitions(ORDER_ACTIONS, "未払い")).toEqual([
      ["支払う", "発送する", "届ける"],
      ["取り消す"],
      ["支払う", "返金する"],
    ]);
  });
});
