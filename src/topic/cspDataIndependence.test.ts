import { describe, expect, it } from "vitest";
import { checkLaw, explore, failuresRefines, traceRefines } from "./csp";
import {
  collapseTopValue,
  DATA_ENV,
  fifoPair,
  fifoSpec,
  stackBuffer,
  valuesOf,
  dedupFilter,
  uniqueSpec,
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

  it("値を比べないスタックは、3つ目の値を2つ目に写すと、値2つのスタックと区別できない", () => {
    const law = checkLaw(collapseTopValue(stackBuffer(3), 3), stackBuffer(2), DATA_ENV);
    expect(law).toEqual({ traces: true, failures: true, failuresDivergences: true });
  });

  it("直近2つを覚える重複よけは、値が1つか2つなら同じ値を2回渡さない", () => {
    for (const count of [1, 2]) {
      expect(
        traceRefines(uniqueSpec(count), dedupFilter(2, count), DATA_ENV).holds,
      ).toBe(true);
    }
  });

  it("直近2つを覚える重複よけは、値が3つになると、忘れた0をもう一度渡す", () => {
    const result = traceRefines(uniqueSpec(3), dedupFilter(2, 3), DATA_ENV);
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual([
      "in.0",
      "out.0",
      "in.1",
      "out.1",
      "in.2",
      "out.2",
      "in.0",
      "out.0",
    ]);
  });

  it("覚える数を k にすると、値が k 個までは成り立ち、k+1 個で破れる", () => {
    for (const memory of [1, 2, 3]) {
      for (const count of [1, 2, 3, 4]) {
        const holds = traceRefines(
          uniqueSpec(count),
          dedupFilter(memory, count),
          DATA_ENV,
        ).holds;
        expect(holds).toBe(count <= memory);
      }
    }
  });

  it("重複よけは値を比べるので、3つ目の値を2つ目に写すと値2つの版と違うものになる", () => {
    const collapsed = collapseTopValue(dedupFilter(2, 3), 3);
    expect(checkLaw(collapsed, dedupFilter(2, 2), DATA_ENV).traces).toBe(false);
    expect(traceRefines(uniqueSpec(2), collapsed, DATA_ENV).holds).toBe(false);
  });
});
