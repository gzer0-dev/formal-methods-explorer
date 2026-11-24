import { describe, expect, it } from "vitest";
import { acceptsTrace, explore, failuresRefines, traceRefines } from "./csp";
import { bufferSpec, cellChain, linkedPair, PIPE_ENV, SAMPLE_RUN } from "./cspPipes";

describe("名前の付け替えでつなぐパイプとバッファ", () => {
  it("1要素のセルを2つつなぐと、2要素のバッファの仕様と失敗で等しい（両向きに ⊑F）", () => {
    expect(failuresRefines(bufferSpec(2), cellChain(2), PIPE_ENV).holds).toBe(true);
    expect(failuresRefines(cellChain(2), bufferSpec(2), PIPE_ENV).holds).toBe(true);
  });

  it("セル1つは、2要素のバッファの仕様を満たさない。1つ入れた後に次の入力を断る", () => {
    const result = failuresRefines(bufferSpec(2), cellChain(1), PIPE_ENV);
    expect(result.holds).toBe(false);
    expect(result.counterexample?.trace).toEqual(["in.0"]);
    expect(result.counterexample?.refusal).toEqual(["in.0", "in.1"]);
  });

  it("セル3つは、2要素のバッファよりたくさん溜められるので、トレースで仕様を破る", () => {
    const result = traceRefines(bufferSpec(2), cellChain(3), PIPE_ENV);
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual(["in.0", "in.0", "in.0"]);
  });

  it("つないだ間のチャネルは隠れていて、外から見えるのは in と out だけ", () => {
    const lts = explore(cellChain(2), PIPE_ENV);
    const visible = new Set(lts.edges.map((edge) => edge.ev.split(".")[0]));
    expect([...visible].sort()).toEqual(["in", "out", "τ"]);
  });

  it("隠す前の2つのセルは、例の実行 [in.0, link1.0, in.1, out.0] を起こせる", () => {
    expect(SAMPLE_RUN).toEqual(["in.0", "link1.0", "in.1", "out.0"]);
    expect(acceptsTrace(linkedPair(), PIPE_ENV, SAMPLE_RUN).isAccepted).toBe(true);
  });
});
