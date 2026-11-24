import { describe, expect, it } from "vitest";
import {
  acceptsTrace,
  divergence,
  failuresDivergencesRefines,
  failuresRefines,
  traceRefines,
} from "./csp";
import {
  ABP_ENV,
  abpSpec,
  abpSystem,
  abpWires,
  LOSS_RUN,
  NO_BIT_RUN,
  type Faults,
} from "./cspAbp";

const LOSSY: Faults = { canLose: true, canDuplicate: true };
const PERFECT: Faults = { canLose: false, canDuplicate: false };

describe("交互ビットプロトコル", () => {
  it("落とす・重複させる通信路の上でも、1要素のバッファの仕様を ⊑T と ⊑F で満たす", () => {
    const system = abpSystem(LOSSY, true);
    expect(traceRefines(abpSpec(), system, ABP_ENV).holds).toBe(true);
    expect(failuresRefines(abpSpec(), system, ABP_ENV).holds).toBe(true);
  });

  it("仕様の側から見ても同じ（⊑F が両向きに成り立つ）", () => {
    expect(failuresRefines(abpSystem(LOSSY, true), abpSpec(), ABP_ENV).holds).toBe(
      true,
    );
  });

  it("通信路が落とし続けられると、in.0 の後に発散するので ⊑FD は破れる", () => {
    const result = failuresDivergencesRefines(
      abpSpec(),
      abpSystem(LOSSY, true),
      ABP_ENV,
    );
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual({ kind: "divergence", trace: ["in.0"] });
    expect(
      divergence(abpSystem({ canLose: true, canDuplicate: false }, true), ABP_ENV)
        ?.trace,
    ).toEqual(["in.0"]);
  });

  it("重複だけでも、古い写しを際限なく受け直せるので発散する", () => {
    expect(
      divergence(abpSystem({ canLose: false, canDuplicate: true }, true), ABP_ENV),
    ).not.toBeNull();
  });

  it("落とさず重複もさせない通信路なら発散せず、⊑FD まで成り立つ", () => {
    const system = abpSystem(PERFECT, true);
    expect(divergence(system, ABP_ENV)).toBeNull();
    expect(failuresDivergencesRefines(abpSpec(), system, ABP_ENV).holds).toBe(true);
  });

  it("ビットを使わない（ビットがいつも0）と、送り直しで out.0 が2回出て ⊑T を破る", () => {
    const result = traceRefines(abpSpec(), abpSystem(PERFECT, false), ABP_ENV);
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual(["in.0", "out.0", "out.0"]);
    // 図で中の動きを見せる実行は、見える部分（in と out）が反例と同じでなければならない。
    expect(NO_BIT_RUN.filter((event) => /^(in|out)\./.test(event))).toEqual(
      result.counterexample,
    );
  });

  it("例の実行は、通信路が1回落としたときだけ起こせる（落とさない通信路では起こせない）", () => {
    expect(LOSS_RUN).toEqual([
      "in.0",
      "send.0.0",
      "send.0.0",
      "recv.0.0",
      "out.0",
      "ack.0",
      "getack.0",
    ]);
    expect(acceptsTrace(abpWires(LOSSY, true), ABP_ENV, LOSS_RUN).isAccepted).toBe(
      true,
    );
    expect(acceptsTrace(abpWires(PERFECT, true), ABP_ENV, LOSS_RUN).isAccepted).toBe(
      false,
    );
  });

  it("ビットを使わないときの反例は、中の動きを含めると、受け取りの知らせが届く前の送り直し1回で起きる", () => {
    expect(NO_BIT_RUN).toEqual([
      "in.0",
      "send.0.0",
      "recv.0.0",
      "out.0",
      "ack.0",
      "send.0.0",
      "recv.0.0",
      "out.0",
    ]);
    expect(acceptsTrace(abpWires(PERFECT, false), ABP_ENV, NO_BIT_RUN).isAccepted).toBe(
      true,
    );
    expect(acceptsTrace(abpWires(PERFECT, true), ABP_ENV, NO_BIT_RUN).isAccepted).toBe(
      false,
    );
  });
});
