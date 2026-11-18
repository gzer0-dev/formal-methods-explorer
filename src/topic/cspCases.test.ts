import { describe, expect, it } from "vitest";
import {
  checkLaw,
  completeTraces,
  deadlocks,
  failuresDivergencesRefines,
  failuresRefines,
} from "./csp";
import {
  CANCEL_ENV,
  cancelSystem,
  CRYPTO_ENV,
  cryptographers,
  FOCUS_ENV,
  FOCUS_SPEC,
  focusOnPhilosopher0,
  parityOf,
} from "./cspCases";

// C（応用）のレッスンの芯。
describe("隠蔽による抽象化（哲学者0だけを見る）", () => {
  it("哲学者0のイベントだけを残すと、トレースは小さな仕様（取る→置く の繰り返し）と等しい", () => {
    for (const isAsymmetric of [false, true]) {
      const focus = focusOnPhilosopher0(isAsymmetric);
      expect(checkLaw(FOCUS_SPEC, focus, FOCUS_ENV).traces).toBe(true);
    }
  });

  it("全員が左から取ると、哲学者0が左を取ったまま置けなくなる失敗が見つかる", () => {
    const result = failuresRefines(FOCUS_SPEC, focusOnPhilosopher0(false), FOCUS_ENV);
    expect(result).toEqual({
      holds: false,
      counterexample: { trace: ["pick.0.0"], refusal: ["put.0.0"] },
    });
  });

  it("1人だけ逆順なら失敗詳細化は成り立つが、ほかの人の動きを隠したことで発散が生まれる", () => {
    const focus = focusOnPhilosopher0(true);
    expect(failuresRefines(FOCUS_SPEC, focus, FOCUS_ENV).holds).toBe(true);
    expect(
      failuresDivergencesRefines(FOCUS_SPEC, focus, FOCUS_ENV).counterexample?.kind,
    ).toBe("divergence");
  });
});

describe("食事する暗号学者（匿名性）", () => {
  it("誰が払っても、外から見える発言の並びは同じ（トレースも失敗も等しい）", () => {
    const law01 = checkLaw(
      cryptographers(0, false),
      cryptographers(1, false),
      CRYPTO_ENV,
    );
    const law12 = checkLaw(
      cryptographers(1, false),
      cryptographers(2, false),
      CRYPTO_ENV,
    );
    expect(law01.traces && law01.failures).toBe(true);
    expect(law12.traces && law12.failures).toBe(true);
  });

  it("誰も払っていないときとは区別できる（発言の排他的論理和が 0 か 1 か）", () => {
    expect(
      checkLaw(cryptographers(null, false), cryptographers(0, false), CRYPTO_ENV)
        .traces,
    ).toBe(false);
    for (const trace of completeTraces(cryptographers(0, false), CRYPTO_ENV))
      expect(parityOf(trace)).toBe(1);
    for (const trace of completeTraces(cryptographers(null, false), CRYPTO_ENV))
      expect(parityOf(trace)).toBe(0);
  });

  it("暗号学者0のコインが外に漏れると、0が払ったかが分かってしまう（1と2の間は分からないまま）", () => {
    expect(
      checkLaw(cryptographers(0, true), cryptographers(1, true), CRYPTO_ENV).traces,
    ).toBe(false);
    expect(
      checkLaw(cryptographers(1, true), cryptographers(2, true), CRYPTO_ENV).traces,
    ).toBe(true);
  });
});

describe("送受信待ちの取り消し", () => {
  it("落ちうる通信路で応答を待ち続けると、デッドロックする", () => {
    expect(deadlocks(cancelSystem("wait"), CANCEL_ENV).length).toBeGreaterThan(0);
  });

  it("タイムアウトで諦めるだけだと、遅れて返そうとしたサーバーが止まる", () => {
    const traces = deadlocks(cancelSystem("timeout"), CANCEL_ENV);
    expect(traces.length).toBeGreaterThan(0);
    expect(traces.some((trace) => trace.includes("giveup"))).toBe(true);
  });

  it("タイムアウトでサーバーの送信も取り消せば、デッドロックしない", () => {
    expect(deadlocks(cancelSystem("cancel"), CANCEL_ENV)).toHaveLength(0);
  });
});
