import { describe, expect, it } from "vitest";
import {
  ext,
  hide,
  int,
  moves,
  par,
  pre,
  ref,
  seq,
  SKIP,
  STOP,
  TAU,
  TICK,
  type Env,
} from "./csp";
import {
  derivationOf,
  derivationText,
  nextStepsFor,
  pathWithTau,
  tauOrigin,
} from "./cspDerivation";

function onlyMove(p: Parameters<typeof moves>[0], env: Env, ev: string) {
  const move = moves(p, env).find((m) => m.ev === ev);
  if (!move) throw new Error(`${ev} の手が無い`);
  return move;
}

describe("遷移規則の導出（外側から内側まで、どの規則を重ねたか）", () => {
  it("前置だけなら Prefix の1段", () => {
    const p = pre("a", STOP);
    expect(derivationText(derivationOf(p, {}, onlyMove(p, {}, "a")))).toBe("Prefix");
  });

  it("名前の先の内部選択は PName の内側に IntCh1 が来る", () => {
    const env: Env = { P: () => int(pre("a", STOP), pre("b", STOP)) };
    const [first, second] = moves(ref("P"), env);
    expect(derivationText(derivationOf(ref("P"), env, first!))).toBe("PName(IntCh1)");
    expect(derivationText(derivationOf(ref("P"), env, second!))).toBe("PName(IntCh2)");
  });

  it("SKIP の後の逐次合成の τ は SeqTick で、その前提は Skip（✓）", () => {
    const p = seq(SKIP, pre("b", STOP));
    expect(derivationText(derivationOf(p, {}, onlyMove(p, {}, TAU)))).toBe(
      "SeqTick(Skip)",
    );
  });

  it("同期は左右の前提を両方持つ", () => {
    const p = par(pre("s", STOP), ["s"], ext(pre("b", STOP), pre("s", STOP)));
    expect(derivationText(derivationOf(p, {}, onlyMove(p, {}, "s")))).toBe(
      "ParSync(Prefix, ExtCh2(Prefix))",
    );
  });

  it("並行合成の片側が終わると ParTick の τ になり、両方終われば ParTerm", () => {
    const p = par(SKIP, [], pre("b", SKIP));
    expect(derivationText(derivationOf(p, {}, onlyMove(p, {}, TAU)))).toBe(
      "ParTick1(Skip)",
    );
    const done = par({ k: "omega" }, [], { k: "omega" });
    expect(derivationText(derivationOf(done, {}, onlyMove(done, {}, TICK)))).toBe(
      "ParTerm",
    );
  });

  it("隠したイベントは Hide1、見えるイベントは Hide2 で、前提は元のイベントの手", () => {
    const p = hide(ext(pre("a", STOP), pre("b", STOP)), ["a"]);
    expect(derivationText(derivationOf(p, {}, onlyMove(p, {}, TAU)))).toBe(
      "Hide1(ExtCh1(Prefix))",
    );
    expect(derivationText(derivationOf(p, {}, onlyMove(p, {}, "b")))).toBe(
      "Hide2(ExtCh2(Prefix))",
    );
  });

  it("同じ規則が続く段は ×n にまとめる", () => {
    const p = ext(pre("a", STOP), pre("b", STOP), pre("c", STOP));
    expect(derivationText(derivationOf(p, {}, onlyMove(p, {}, "a")))).toBe(
      "ExtCh1×2(Prefix)",
    );
  });

  it("外部選択の中の τ は選択を決めない ExtChTau になる", () => {
    const p = ext(int(pre("a", STOP), pre("b", STOP)), pre("c", STOP));
    const tauMove = moves(p, {}).find((m) => m.ev === TAU)!;
    expect(derivationText(derivationOf(p, {}, tauMove))).toBe("ExtChTau1(IntCh1)");
  });
});

describe("τ の出どころ（見えない手を生んだ規則）", () => {
  it("τ を出している中でいちばん内側の規則を返す", () => {
    const afterSkip = seq(SKIP, pre("b", STOP));
    expect(tauOrigin(derivationOf(afterSkip, {}, onlyMove(afterSkip, {}, TAU)))).toBe(
      "SeqTick",
    );
    const env: Env = { P: () => int(pre("a", STOP), pre("b", STOP)) };
    expect(tauOrigin(derivationOf(ref("P"), env, moves(ref("P"), env)[0]!))).toBe(
      "IntCh1",
    );
    const hidden = hide(pre("a", STOP), ["a"]);
    expect(tauOrigin(derivationOf(hidden, {}, onlyMove(hidden, {}, TAU)))).toBe(
      "Hide1",
    );
  });
});

describe("τ も含めた最短の手順", () => {
  it("そのイベントまでの手を、τ も含めて1手ずつ規則付きで返す", () => {
    const path = pathWithTau(seq(SKIP, pre("b", STOP)), {}, "b");
    expect(
      path?.map((step) => [step.move.ev, derivationText(step.derivation)]),
    ).toEqual([
      [TAU, "SeqTick(Skip)"],
      ["b", "Prefix"],
    ]);
  });

  it("着かないイベントなら null", () => {
    expect(pathWithTau(pre("a", STOP), {}, "z")).toBeNull();
  });
});

describe("次のイベントまでの手（τ を自動で挟む）", () => {
  it("内部選択の2本目の τ の先でしか起こせないイベントも、その τ を通って起こす", () => {
    const steps = nextStepsFor(int(pre("a", STOP), pre("b", STOP)), {}, "b");
    expect(steps?.map((step) => [step.move.ev, step.move.rule])).toEqual([
      [TAU, "IntCh2"],
      ["b", "Prefix"],
    ]);
  });

  it("τ をたどっても起こせないイベントなら null", () => {
    expect(nextStepsFor(int(pre("a", STOP), pre("b", STOP)), {}, "c")).toBeNull();
  });
});
