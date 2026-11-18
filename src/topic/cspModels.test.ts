import { describe, expect, it } from "vitest";
import { deadlocks, divergence, failuresRefines, traceRefines, traceTo } from "./csp";
import {
  counterSystem,
  COUNTER_ENV,
  counterObserved,
  RESULT_SPEC,
  philosophers,
  PHILOSOPHER_ENV,
  printerImpl,
  PRINTER_ENV,
  printerSpec,
  jobSystem,
  JOB_ENV,
} from "./cspModels";

// CSP のレッスンの説明の芯。ここが崩れると説明が嘘になる。
describe("CSP のカウンタ（共有変数をプロセスで書く）", () => {
  it("ロックが無いと result.1 に着く。最短は 読む・読む・書く・書く・finish・result.1", () => {
    expect(traceTo(counterSystem(false), COUNTER_ENV, "result.1")).toEqual([
      "read.A.0",
      "read.B.0",
      "write.A.1",
      "write.B.1",
      "finish",
      "result.1",
    ]);
  });

  it("ロックがあると result.1 には着かず、result.2 にだけ着く", () => {
    expect(traceTo(counterSystem(true), COUNTER_ENV, "result.1")).toBeNull();
    expect(traceTo(counterSystem(true), COUNTER_ENV, "result.2")).not.toBeNull();
  });

  it("どちらもデッドロックしない（最後は全員が正しく終わる）", () => {
    expect(deadlocks(counterSystem(false), COUNTER_ENV)).toHaveLength(0);
    expect(deadlocks(counterSystem(true), COUNTER_ENV)).toHaveLength(0);
  });

  it("仕様「finish の後は result.2」をトレース詳細化で確かめると、ロック無しは [finish, result.1] で破れる", () => {
    const naive = traceRefines(RESULT_SPEC, counterObserved(false), COUNTER_ENV);
    expect(naive).toEqual({ holds: false, counterexample: ["finish", "result.1"] });
    expect(traceRefines(RESULT_SPEC, counterObserved(true), COUNTER_ENV).holds).toBe(
      true,
    );
  });
});

describe("プリンタ（外部選択と内部選択）", () => {
  it("インク切れで勝手にカラーを断る実装は、トレースでは仕様を満たす", () => {
    expect(traceRefines(printerSpec(), printerImpl(), PRINTER_ENV).holds).toBe(true);
  });

  it("失敗詳細化では、最初に color を拒否できることが反例になる", () => {
    expect(failuresRefines(printerSpec(), printerImpl(), PRINTER_ENV)).toEqual({
      holds: false,
      counterexample: { trace: [], refusal: ["color"] },
    });
  });
});

describe("食事する哲学者", () => {
  it("2人が同じ向きに取ると、2手でデッドロックする", () => {
    const traces = deadlocks(philosophers(2, false), PHILOSOPHER_ENV);
    expect(traces.length).toBeGreaterThan(0);
    expect(Math.min(...traces.map((trace) => trace.length))).toBe(2);
  });

  it("3人でも、全員が左を取った3手でデッドロックする", () => {
    const traces = deadlocks(philosophers(3, false), PHILOSOPHER_ENV);
    expect(Math.min(...traces.map((trace) => trace.length))).toBe(3);
  });

  it("1人だけ取る順を逆にすると、デッドロックは無い", () => {
    expect(deadlocks(philosophers(2, true), PHILOSOPHER_ENV)).toHaveLength(0);
    expect(deadlocks(philosophers(3, true), PHILOSOPHER_ENV)).toHaveLength(0);
  });
});

describe("リトライするジョブ（隠蔽と発散）", () => {
  it("内部の動きを隠すと、無制限のリトライは発散（ライブロック）する", () => {
    expect(divergence(jobSystem(null, true), JOB_ENV)).not.toBeNull();
  });

  it("見えるままなら発散ではない", () => {
    expect(divergence(jobSystem(null, false), JOB_ENV)).toBeNull();
  });

  it("上限があれば、隠しても発散しない", () => {
    expect(divergence(jobSystem(2, true), JOB_ENV)).toBeNull();
  });
});
