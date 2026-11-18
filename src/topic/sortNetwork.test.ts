import { describe, expect, it } from "vitest";
import {
  acceptsTrace,
  deadlocks,
  divergence,
  failuresRefines,
  traceRefines,
} from "./csp";
import { runNetwork, SORT_IMPL_WIRINGS, visibleLog } from "./sortImpl";
import { networkModel, observedNetwork, SORT_ENV, sortSpec } from "./sortModels";

// 一気通貫の事例（設計 → 検証 → 実装）の芯。ここが崩れると説明が嘘になる。
describe("並べ替えネットワークのモデル（値は 0 と 1）", () => {
  it("正しい配線は、逐次の仕様と両向きに詳細化し合う（等価）", () => {
    const net = observedNetwork("correct");
    expect(traceRefines(sortSpec(), net, SORT_ENV).holds).toBe(true);
    expect(traceRefines(net, sortSpec(), SORT_ENV).holds).toBe(true);
    expect(failuresRefines(sortSpec(), net, SORT_ENV).holds).toBe(true);
    expect(failuresRefines(net, sortSpec(), SORT_ENV).holds).toBe(true);
  });

  it("正しい配線はデッドロックも発散もしない", () => {
    expect(deadlocks(networkModel("correct"), SORT_ENV)).toHaveLength(0);
    expect(divergence(observedNetwork("correct"), SORT_ENV)).toBeNull();
  });

  it("3つ目の比較器を忘れた配線は、並んでいない出力を出す反例が見つかる", () => {
    const result = traceRefines(sortSpec(), observedNetwork("missingLast"), SORT_ENV);
    expect(result.holds).toBe(false);
    expect(result.counterexample?.at(-1)).toMatch(/^out\./);
  });
});

describe("チャネルで動く実装（モデルをテストの判定役にする）", () => {
  const inputs = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ];

  it("正しい実装は、どの入力・どの実行順でも並べ替え、ログをモデルが受け付ける", () => {
    for (const input of inputs) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const run = runNetwork(SORT_IMPL_WIRINGS.correct, input, seed);
        expect(run.isFinished).toBe(true);
        expect(run.output).toEqual([...input].sort());
        expect(
          acceptsTrace(networkModel("correct"), SORT_ENV, run.log).isAccepted,
        ).toBe(true);
      }
    }
  });

  it("同じシードなら同じ実行順になる", () => {
    const first = runNetwork(SORT_IMPL_WIRINGS.correct, [1, 0, 1], 5);
    expect(runNetwork(SORT_IMPL_WIRINGS.correct, [1, 0, 1], 5)).toEqual(first);
  });

  it("配線を誤った実装は、並んでいない出力を出し、そのログを正しいモデルが拒否する", () => {
    const run = runNetwork(SORT_IMPL_WIRINGS.missingLast, [1, 1, 0], 1);
    expect(run.output).not.toEqual([0, 1, 1]);
    expect(acceptsTrace(networkModel("correct"), SORT_ENV, run.log).isAccepted).toBe(
      false,
    );
  });

  it("外から見えるログ（in と out）だけを逐次の仕様で判定すると、内部の配線に関係なく合否が決まる", () => {
    const visible = visibleLog(runNetwork(SORT_IMPL_WIRINGS.correct, [1, 0, 1], 3).log);
    expect(visible.every((ev) => /^(in|out)\./.test(ev))).toBe(true);
    expect(acceptsTrace(sortSpec(), SORT_ENV, visible).isAccepted).toBe(true);
    const wrong = visibleLog(
      runNetwork(SORT_IMPL_WIRINGS.missingLast, [1, 1, 0], 1).log,
    );
    expect(acceptsTrace(sortSpec(), SORT_ENV, wrong).isAccepted).toBe(false);
  });
});
