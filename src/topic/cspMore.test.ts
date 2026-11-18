import { describe, expect, it } from "vitest";
import { determinism, divergence, failuresRefines, starvation } from "./csp";
import { focusLazy } from "./cspMore";
import { FOCUS_ENV, FOCUS_SPEC, focusOnPhilosopher0 } from "./cspCases";
import {
  COUNTER_ENV,
  counterObserved,
  PRINTER_ENV,
  printerImpl,
  printerSpec,
} from "./cspModels";
import { POOL_ENV, poolSystem } from "./cspMore";

describe("決定性（flaky なテストの原因を見つける）", () => {
  it("ロック無しのカウンタは、finish の後に result.1 も result.2 もありうるので非決定的", () => {
    const result = determinism(counterObserved(false), COUNTER_ENV);
    expect(result.isDeterministic).toBe(false);
    expect(result.witness?.trace).toEqual(["finish"]);
  });

  it("ロックありのカウンタは決定的（毎回 result.2）", () => {
    expect(determinism(counterObserved(true), COUNTER_ENV).isDeterministic).toBe(true);
  });

  it("勝手にカラーを断るプリンタは非決定的、仕様のプリンタは決定的", () => {
    expect(determinism(printerImpl(), PRINTER_ENV).isDeterministic).toBe(false);
    expect(determinism(printerSpec(), PRINTER_ENV).isDeterministic).toBe(true);
  });
});

describe("Eager 抽象化と Lazy 抽象化（哲学者0だけを見る）", () => {
  it("Eager（ただ隠す）は、ほかの人が食べ続ける動きが発散に見える", () => {
    expect(divergence(focusOnPhilosopher0(true), FOCUS_ENV)).not.toBeNull();
  });

  it("Lazy は安定失敗モデルで比べ、ほかの人が止まると哲学者0も止まりうることを失敗として示す", () => {
    const result = failuresRefines(FOCUS_SPEC, focusLazy(true), FOCUS_ENV);
    expect(result.holds).toBe(false);
  });
});

describe("共用チャネル（2人の客が1つのサーバーに依頼する）", () => {
  it("受け箱から好きな依頼を取るサーバーでは、B が頼んだまま A だけが回り続ける（飢餓）", () => {
    const result = starvation(poolSystem("anyOrder"), POOL_ENV, "req.B", "resp.B");
    expect(result).not.toBeNull();
    expect(result?.cycle).toContain("resp.A");
    expect(result?.cycle).not.toContain("resp.B");
  });

  it("依頼を先着順の列に入れると、B は必ず応答をもらえる", () => {
    expect(starvation(poolSystem("fifo"), POOL_ENV, "req.B", "resp.B")).toBeNull();
  });
});
