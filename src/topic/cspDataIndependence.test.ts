import { describe, expect, it } from "vitest";
import { checkLaw, deadlocks, explore, failuresRefines, traceRefines } from "./csp";
import {
  collapseTopValue,
  DATA_ENV,
  fifoPair,
  fifoSpec,
  stackBuffer,
  valuesOf,
  voter,
} from "./cspDataIndependence";

describe("データ独立性", () => {
  it("値の種類は 0 から順に数える", () => {
    expect(valuesOf(3)).toEqual([0, 1, 2]);
  });

  it("受け取った順に渡す2つのセルは、値が1つでも2つでも3つでも仕様を ⊑F で満たす", () => {
    for (const count of [1, 2, 3]) {
      expect(failuresRefines(fifoSpec(count), fifoPair(count), DATA_ENV).holds).toBe(
        true,
      );
    }
  });

  it("後に入れたものを先に出す（スタック）は、値が1つだと区別できず ⊑T で見逃す", () => {
    expect(traceRefines(fifoSpec(1), stackBuffer(1), DATA_ENV).holds).toBe(true);
  });

  it("スタックは、値が2つでも3つでも同じ反例 [in.0, in.1, out.1] で仕様を破る", () => {
    for (const count of [2, 3]) {
      const result = traceRefines(fifoSpec(count), stackBuffer(count), DATA_ENV);
      expect(result.holds).toBe(false);
      expect(result.counterexample).toEqual(["in.0", "in.1", "out.1"]);
    }
  });

  it("値の種類を増やすと、結論は同じでも状態は増える", () => {
    const sizes = [2, 3].map(
      (count) => explore(stackBuffer(count), DATA_ENV).stateCount,
    );
    expect(sizes[1]!).toBeGreaterThan(sizes[0]!);
  });

  it("多数決は値を比べるので、値が2つなら止まらないが、3つなら [in.0, in.1, in.2] で止まる", () => {
    expect(deadlocks(voter(1), DATA_ENV)).toEqual([]);
    expect(deadlocks(voter(2), DATA_ENV)).toEqual([]);
    expect(deadlocks(voter(3), DATA_ENV)[0]).toEqual(["in.0", "in.1", "in.2"]);
  });

  it("値を比べないスタックは、3つ目の値を2つ目に写すと、値2つのスタックと区別できない", () => {
    const law = checkLaw(collapseTopValue(stackBuffer(3), 3), stackBuffer(2), DATA_ENV);
    expect(law).toEqual({ traces: true, failures: true, failuresDivergences: true });
  });

  it("多数決は、3つ目の値を2つ目に写すと値2つの多数決と違うものになる（止まる道が残る）", () => {
    const law = checkLaw(collapseTopValue(voter(3), 3), voter(2), DATA_ENV);
    expect(law.failures).toBe(false);
    expect(deadlocks(collapseTopValue(voter(3), 3), DATA_ENV)[0]).toEqual([
      "in.0",
      "in.1",
      "in.1",
    ]);
  });
});
