import { describe, expect, it } from "vitest";
import {
  acceptsTrace,
  determinism,
  lazyAbstraction,
  checkLaw,
  failuresDivergencesRefines,
  moves,
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

describe("遷移規則（どの規則で次の状態ができたか）", () => {
  it("前置・外部選択・内部選択・名前の展開に、それぞれの規則名が付く", () => {
    expect(moves(pre("a", STOP), {}).map((m) => m.rule)).toEqual(["Prefix"]);
    expect(moves(ext(pre("a", STOP), pre("b", STOP)), {}).map((m) => m.rule)).toEqual([
      "ExtCh1",
      "ExtCh2",
    ]);
    expect(moves(int(pre("a", STOP), pre("b", STOP)), {}).map((m) => m.rule)).toEqual([
      "IntCh1",
      "IntCh2",
    ]);
    expect(moves(ref("P"), { P: () => pre("a", STOP) }).map((m) => m.rule)).toEqual([
      "PName",
    ]);
  });

  it("並行合成では、片側だけの動きと同期とで規則が分かれる", () => {
    const rules = moves(
      par(pre("a", STOP), ["s"], ext(pre("s", STOP), pre("b", STOP))),
      {},
    ).map((m) => m.rule);
    expect(rules).toContain("Par1");
    expect(rules).toContain("Par2");
    expect(
      moves(par(pre("s", STOP), ["s"], pre("s", STOP)), {}).map((m) => m.rule),
    ).toEqual(["ParSync"]);
  });

  it("隠したイベントは隠蔽の規則で τ になる", () => {
    expect(moves(hide(pre("a", STOP), ["a"]), {})).toEqual([
      { ev: "τ", to: hide(STOP, ["a"]), rule: "Hide1" },
    ]);
  });
});

describe("失敗発散詳細化 Spec ⊑FD Impl", () => {
  const env: Env = {
    Job: () => pre("start", ext(pre("succeed", SKIP), pre("fail", ref("Job")))),
  };
  const spec = pre("succeed", SKIP);
  const hidden = hide(ref("Job"), ["start", "fail"]);

  it("発散する実装は、トレースと失敗では仕様を満たしても、発散で破れる", () => {
    expect(traceRefines(spec, hidden, env).holds).toBe(true);
    expect(failuresRefines(spec, hidden, env).holds).toBe(true);
    expect(failuresDivergencesRefines(spec, hidden, env)).toEqual({
      holds: false,
      counterexample: { kind: "divergence", trace: [] },
    });
  });

  it("仕様が発散するなら、その後は何をしても満たす（発散は「何でもあり」）", () => {
    const chaotic = hide(ref("Loop"), ["t"]);
    const loopEnv: Env = { Loop: () => pre("t", ref("Loop")) };
    expect(failuresDivergencesRefines(chaotic, pre("x", STOP), loopEnv).holds).toBe(
      true,
    );
  });

  it("発散しなければ、失敗詳細化と同じ反例を返す", () => {
    const result = failuresDivergencesRefines(
      ext(pre("a", STOP), pre("b", STOP)),
      int(pre("a", STOP), pre("b", STOP)),
      {},
    );
    expect(result).toEqual({
      holds: false,
      counterexample: { kind: "failure", trace: [], refusal: ["b"] },
    });
  });
});

describe("代数法則を検査器で確かめる", () => {
  const P = pre("p", STOP);
  const Q = pre("q", STOP);

  it("P □ STOP = P、P □ Q = Q □ P は、どの比べ方でも等しい", () => {
    expect(checkLaw(ext(P, STOP), P, {})).toEqual({
      traces: true,
      failures: true,
      failuresDivergences: true,
    });
    expect(checkLaw(ext(P, Q), ext(Q, P), {})).toEqual({
      traces: true,
      failures: true,
      failuresDivergences: true,
    });
  });

  it("(a → P) □ (a → Q) = a → (P ⊓ Q)（同じイベントの外部選択は、中身の内部選択になる）", () => {
    expect(checkLaw(ext(pre("a", P), pre("a", Q)), pre("a", int(P, Q)), {})).toEqual({
      traces: true,
      failures: true,
      failuresDivergences: true,
    });
  });

  it("a → (P □ Q) と (a → P) □ (a → Q) はトレースでは等しいが、失敗では等しくない", () => {
    expect(checkLaw(pre("a", ext(P, Q)), ext(pre("a", P), pre("a", Q)), {})).toEqual({
      traces: true,
      failures: false,
      failuresDivergences: false,
    });
  });
});

describe("決定性（同じトレースの後に、起こせるイベントを断ることがないか）", () => {
  it("外部選択だけのプロセスは決定的", () => {
    expect(determinism(ext(pre("a", STOP), pre("b", STOP)), {})).toEqual({
      isDeterministic: true,
      witness: null,
    });
  });

  it("内部選択で片方を断れるプロセスは非決定的で、そのトレースとイベントを返す", () => {
    expect(determinism(int(pre("a", STOP), pre("b", STOP)), {})).toEqual({
      isDeterministic: false,
      witness: { trace: [], event: "a", kind: "refusal" },
    });
  });

  it("同じイベントの外部選択でも、その後が違えば非決定的", () => {
    const result = determinism(
      ext(pre("a", pre("b", STOP)), pre("a", pre("c", STOP))),
      {},
    );
    expect(result.isDeterministic).toBe(false);
    expect(result.witness?.trace).toEqual(["a"]);
  });

  it("発散するプロセスは非決定的", () => {
    const env: Env = { Loop: () => pre("t", ref("Loop")) };
    expect(determinism(hide(ref("Loop"), ["t"]), env).witness?.kind).toBe("divergence");
  });
});

describe("Lazy 抽象化（隠すイベントを、環境が勝手に止められるものとして扱う）", () => {
  it("隠すイベントが続くと、Eager（ただの隠蔽）は発散するが、Lazy は発散せず「止まりうる」になる", () => {
    const env: Env = { P: () => ext(pre("h", ref("P")), pre("a", STOP)) };
    const eager = hide(ref("P"), ["h"]);
    const lazy = lazyAbstraction(ref("P"), ["h"]);
    expect(divergence(eager, env)).not.toBeNull();
    expect(failuresRefines(pre("a", STOP), lazy, env).holds).toBe(true);
  });
});
