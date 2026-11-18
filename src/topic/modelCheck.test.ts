import { describe, expect, it } from "vitest";
import { check, checkEventually, countExecutions, type Model } from "./modelCheck";

// 0 → 1 → 2と進み、2で止まる小さなモデル。toBad なら0から9へも行ける。
function line(toBad: boolean): Model<number> {
  return {
    init: 0,
    key: (s) => String(s),
    actions: [
      { name: "inc", enabled: (s) => s < 2, next: (s) => s + 1 },
      { name: "jump", enabled: (s) => toBad && s === 0, next: () => 9 },
    ],
    invariant: (s) => s !== 9,
    isFinal: (s) => s === 2,
  };
}

describe("check（幅優先の全探索）", () => {
  it("到達できる状態を深さごとに数える", () => {
    const result = check(line(false));
    expect(result.stateCount).toBe(3);
    expect(result.levels).toEqual([1, 1, 1]);
    expect(result.transitionCount).toBe(2);
    expect(result.order).toEqual([0, 1, 2]);
  });

  it("不変条件を破る状態があれば、そこまでの最短の手順を返す", () => {
    const result = check(line(true));
    expect(result.violation?.map((step) => step.action)).toEqual([null, "jump"]);
    expect(result.violation?.at(-1)?.state).toBe(9);
    expect(result.violationCount).toBe(1);
  });

  it("破る状態が無ければ violation は null", () => {
    expect(check(line(false)).violation).toBeNull();
  });

  it("終わりでない状態で動けなくなったらデッドロックとして手順を返す", () => {
    const stuck: Model<number> = {
      init: 0,
      key: String,
      actions: [{ name: "inc", enabled: (s) => s < 1, next: (s) => s + 1 }],
      isFinal: () => false,
    };
    expect(check(stuck).deadlock?.map((step) => step.state)).toEqual([0, 1]);
  });

  it("終わりの状態で止まるのはデッドロックではない", () => {
    expect(check(line(false)).deadlock).toBeNull();
  });
});

describe("countExecutions（最後まで走る実行の数）", () => {
  it("分かれ道ごとの実行を数え、終わりの状態で良し悪しを分ける", () => {
    const fork: Model<string> = {
      init: "s",
      key: (s) => s,
      actions: [
        { name: "a", enabled: (s) => s === "s", next: () => "ok" },
        { name: "b", enabled: (s) => s === "s", next: () => "ng" },
      ],
    };
    expect(countExecutions(fork, (s) => s === "ok")).toEqual({
      total: 2,
      good: 1,
      bad: 1,
    });
  });
});

describe("checkEventually（いつか必ず目標に着くか）", () => {
  it("目標を通らずに回り続ける輪があれば、輪までの道と輪を返す", () => {
    const loop: Model<string> = {
      init: "wait",
      key: (s) => s,
      actions: [
        { name: "try", enabled: (s) => s === "wait", next: () => "run" },
        { name: "fail", enabled: (s) => s === "run", next: () => "wait" },
        { name: "ok", enabled: (s) => s === "run", next: () => "done" },
      ],
      isFinal: (s) => s === "done",
    };
    const result = checkEventually(loop, (s) => s === "done");
    expect(result.holds).toBe(false);
    expect(result.cycle?.map((step) => step.state)).toEqual(["wait", "run", "wait"]);
  });

  it("目標に着く前に止まる状態があれば、そこまでの手順を返す", () => {
    const result = checkEventually(line(true), (s) => s === 2);
    expect(result.holds).toBe(false);
    expect(result.stuck?.at(-1)?.state).toBe(9);
  });

  it("どの道でも目標に着くなら holds", () => {
    expect(checkEventually(line(false), (s) => s === 2).holds).toBe(true);
  });
});
