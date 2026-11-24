import { describe, expect, it } from "vitest";
import { acceptsTrace, determinism, divergence } from "./csp";
import {
  HIGH_EVENTS,
  LEAK_RUN,
  lowView,
  NONINTERFERENCE_ENV,
  spoolerSystem,
} from "./cspNoninterference";

describe("非干渉（低い利用者から見たプロセスが決定的か）", () => {
  it("受け皿が1つのとき、高い利用者が1回送るだけで、低い利用者の lo.send が断られることがある", () => {
    const result = determinism(lowView("shared", 1, "lazy"), NONINTERFERENCE_ENV);
    expect(result.isDeterministic).toBe(false);
    expect(result.witness).toEqual({ trace: [], event: "lo.send", kind: "refusal" });
  });

  it("受け皿を分けると、高い利用者が何回送っても低い利用者の見え方は決定的", () => {
    for (const jobs of [0, 1, 2, 3]) {
      const result = determinism(
        lowView("separate", jobs, "lazy"),
        NONINTERFERENCE_ENV,
      );
      expect(result.isDeterministic).toBe(true);
    }
  });

  it("高い利用者が1回も送らなければ、受け皿が1つでも決定的（動かないと漏れは見えない）", () => {
    expect(
      determinism(lowView("shared", 0, "lazy"), NONINTERFERENCE_ENV).isDeterministic,
    ).toBe(true);
  });

  it("ただ隠す（Eager）と、高い利用者は必ず受け取ると当てにするので、受け皿が1つでも漏れが見えない", () => {
    expect(
      determinism(lowView("shared", 1, "eager"), NONINTERFERENCE_ENV).isDeterministic,
    ).toBe(true);
  });

  it("どの見え方も発散しない（決定性の判定が発散で決まっていない）", () => {
    for (const design of ["shared", "separate", "held"] as const) {
      for (const abstraction of ["lazy", "eager"] as const) {
        expect(
          divergence(lowView(design, 2, abstraction), NONINTERFERENCE_ENV),
        ).toBeNull();
      }
    }
  });

  it("留め置き印刷: 共有の記憶領域（2件分）があると、高い利用者が2回送れば最初の時点で lo.send が断られる", () => {
    const result = determinism(lowView("held", 2, "lazy"), NONINTERFERENCE_ENV);
    expect(result.isDeterministic).toBe(false);
    expect(result.witness).toEqual({ trace: [], event: "lo.send", kind: "refusal" });
  });

  it("留め置き印刷: 高い利用者が1回なら lo.send の後に次の lo.send が断られ、送らなければ決定的", () => {
    expect(
      determinism(lowView("held", 1, "lazy"), NONINTERFERENCE_ENV).witness,
    ).toEqual({
      trace: ["lo.send"],
      event: "lo.send",
      kind: "refusal",
    });
    expect(
      determinism(lowView("held", 0, "lazy"), NONINTERFERENCE_ENV).isDeterministic,
    ).toBe(true);
  });

  it("漏れの実行: 高い利用者が送って受け取らないと、受け皿が埋まったまま lo.send を起こせない", () => {
    const leak = LEAK_RUN;
    expect(leak).toEqual(["hi.send"]);
    const system = spoolerSystem("shared", 1);
    expect(acceptsTrace(system, NONINTERFERENCE_ENV, leak).isAccepted).toBe(true);
    expect(
      acceptsTrace(system, NONINTERFERENCE_ENV, [...leak, "lo.send"]).isAccepted,
    ).toBe(false);
    expect(
      acceptsTrace(system, NONINTERFERENCE_ENV, [...leak, "hi.take", "lo.send"])
        .isAccepted,
    ).toBe(true);
  });

  it("高い利用者のイベントは hi.send と hi.take の2つ", () => {
    expect(HIGH_EVENTS).toEqual(["hi.send", "hi.take"]);
  });

  it("留め置き印刷: 高い利用者が2回送って取らないと、低い利用者は送れない。送らなければ2回送れる", () => {
    const system = spoolerSystem("held", 2);
    expect(
      acceptsTrace(system, NONINTERFERENCE_ENV, ["lo.send", "lo.send"]).isAccepted,
    ).toBe(true);
    expect(
      acceptsTrace(system, NONINTERFERENCE_ENV, ["hi.send", "hi.send", "lo.send"])
        .isAccepted,
    ).toBe(false);
  });
});
