import { describe, expect, it } from "vitest";
import { acceptsTrace, divergence, failuresRefines } from "./csp";
import {
  CRASH_ONE_RUN,
  crashEvents,
  FAULT_ENV,
  faultView,
  mirroredStore,
  registerSpec,
  toleratedFaults,
} from "./cspFaultTolerance";

describe("故障を隠して耐故障を示す（鏡のように書く2台のディスク）", () => {
  it("故障を起こさせない（上限0）と、ディスク1台でも記憶の仕様を満たす", () => {
    expect(failuresRefines(registerSpec(), faultView(1, 0), FAULT_ENV).holds).toBe(
      true,
    );
  });

  it("ディスク2台は、故障1回までなら仕様を満たす", () => {
    expect(failuresRefines(registerSpec(), faultView(2, 1), FAULT_ENV).holds).toBe(
      true,
    );
  });

  it("ディスク2台でも、故障2回で両方止まると、最初の時点で書き込みも読み出しも断る", () => {
    const result = failuresRefines(registerSpec(), faultView(2, 2), FAULT_ENV);
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual({
      trace: [],
      refusal: ["read.0", "write.0", "write.1"],
    });
  });

  it("故障の回数を限らずに隠すと、ディスク2台でも仕様を満たさない", () => {
    expect(failuresRefines(registerSpec(), faultView(2, null), FAULT_ENV).holds).toBe(
      false,
    );
  });

  it("許せる故障の回数は、ディスクの台数より1つ少ない", () => {
    expect(toleratedFaults(1)).toBe(0);
    expect(toleratedFaults(2)).toBe(1);
    expect(toleratedFaults(3)).toBe(2);
  });

  it("ディスク1台が壊れた後も、書いた値をもう1台から読める", () => {
    expect(CRASH_ONE_RUN).toEqual(["write.1", "crash.1", "read.1"]);
    expect(acceptsTrace(mirroredStore(2), FAULT_ENV, CRASH_ONE_RUN).isAccepted).toBe(
      true,
    );
    expect(
      acceptsTrace(mirroredStore(2), FAULT_ENV, ["write.1", "crash.1", "read.0"])
        .isAccepted,
    ).toBe(false);
  });

  it("故障のイベントは台数ぶんあり、どの見え方も発散しない", () => {
    expect(crashEvents(3)).toEqual(["crash.1", "crash.2", "crash.3"]);
    for (const limit of [0, 1, 2, null]) {
      expect(divergence(faultView(2, limit), FAULT_ENV)).toBeNull();
    }
  });
});
