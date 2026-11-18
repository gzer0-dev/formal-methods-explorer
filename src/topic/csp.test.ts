import { describe, expect, it } from "vitest";
import {
  acceptsTrace,
  deadlocks,
  divergence,
  explore,
  ext,
  failuresRefines,
  hide,
  int,
  par,
  pre,
  ref,
  seq,
  SKIP,
  STOP,
  traceRefines,
  traceTo,
  type Env,
} from "./csp";

describe("プロセスの遷移と状態", () => {
  it("a → (b → STOP □ c → STOP) は 3 状態・3 遷移", () => {
    const result = explore(pre("a", ext(pre("b", STOP), pre("c", STOP))), {});
    expect(result.stateCount).toBe(3);
    expect(result.transitionCount).toBe(3);
  });

  it("再帰は名前で書き、同じ名前と引数の状態は1つに数える", () => {
    const env: Env = { P: () => pre("a", pre("b", ref("P"))) };
    expect(explore(ref("P"), env).stateCount).toBe(2);
  });

  it("SKIP は終わりの合図 ✓ を出して止まる。止まっていてもデッドロックではない", () => {
    expect(deadlocks(pre("a", SKIP), {})).toHaveLength(0);
    expect(deadlocks(pre("a", STOP), {})).toHaveLength(1);
  });

  it("逐次合成 P ; Q は P が終わると Q へ進む", () => {
    const result = traceTo(seq(pre("a", SKIP), pre("b", SKIP)), {}, "b");
    expect(result).toEqual(["a", "b"]);
  });
});

describe("並行合成", () => {
  it("同期するイベントは両方がそろったときだけ起きる", () => {
    const left = pre("a", pre("s", STOP));
    const right = pre("s", pre("b", STOP));
    expect(traceTo(par(left, ["s"], right), {}, "b")).toEqual(["a", "s", "b"]);
  });

  it("同期しないイベントはそれぞれ勝手に起き、並びが入り混じる", () => {
    const result = explore(par(pre("a", STOP), [], pre("b", STOP)), {});
    expect(result.stateCount).toBe(4);
    expect(result.transitionCount).toBe(4);
  });

  it("両方が終わって初めて全体が終わる", () => {
    expect(deadlocks(par(pre("a", SKIP), [], pre("b", SKIP)), {})).toHaveLength(0);
  });
});

describe("トレース詳細化 Spec ⊑T Impl", () => {
  const env: Env = {
    Spec: () => pre("a", pre("b", ref("Spec"))),
    Good: () => pre("a", pre("b", ref("Good"))),
    Bad: () => pre("a", ext(pre("b", ref("Bad")), pre("c", STOP))),
  };

  it("実装のトレースが仕様のトレースに含まれれば成り立つ", () => {
    expect(traceRefines(ref("Spec"), ref("Good"), env).holds).toBe(true);
  });

  it("仕様に無いトレースがあれば、最短の反例を返す", () => {
    const result = traceRefines(ref("Spec"), ref("Bad"), env);
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual(["a", "c"]);
  });
});

describe("失敗詳細化 Spec ⊑F Impl", () => {
  const external = ext(pre("a", STOP), pre("b", STOP));
  const internal = int(pre("a", STOP), pre("b", STOP));

  it("外部選択と内部選択はトレースでは区別できない", () => {
    expect(traceRefines(external, internal, {}).holds).toBe(true);
    expect(traceRefines(internal, external, {}).holds).toBe(true);
  });

  it("内部選択は片方を拒否できるので、外部選択の仕様を満たさない", () => {
    const result = failuresRefines(external, internal, {});
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual({ trace: [], refusal: ["b"] });
  });

  it("逆向き（内部選択の仕様を外部選択で満たす）は成り立つ", () => {
    expect(failuresRefines(internal, external, {}).holds).toBe(true);
  });
});

describe("隠蔽と発散（ライブロック）", () => {
  const env: Env = {
    Job: () => pre("start", ext(pre("succeed", SKIP), pre("fail", ref("Job")))),
  };

  it("見えるままなら発散しない", () => {
    expect(divergence(ref("Job"), env)).toBeNull();
  });

  it("start と fail を隠すと、見えない動きの輪ができて発散する", () => {
    const result = divergence(hide(ref("Job"), ["start", "fail"]), env);
    expect(result).not.toBeNull();
    expect(result?.trace).toEqual([]);
  });
});

describe("トレースを受け付けるか（テストの判定に使う）", () => {
  const env: Env = { P: () => pre("a", ext(pre("b", ref("P")), pre("c", STOP))) };

  it("モデルが起こせる並びなら受け付け、どこまで進めたかを返す", () => {
    expect(acceptsTrace(ref("P"), env, ["a", "b", "a", "c"])).toEqual({
      isAccepted: true,
      acceptedCount: 4,
    });
  });

  it("起こせないイベントが来たら、そこで止まった位置を返す", () => {
    expect(acceptsTrace(ref("P"), env, ["a", "a"])).toEqual({
      isAccepted: false,
      acceptedCount: 1,
    });
  });

  it("見えない動き（τ）を挟んでも受け付ける", () => {
    expect(acceptsTrace(hide(ref("P"), ["b"]), env, ["a", "a", "c"]).isAccepted).toBe(
      true,
    );
  });
});
