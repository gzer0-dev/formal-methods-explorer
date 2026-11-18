import { describe, expect, it } from "vitest";
import { check, checkEventually, countExecutions } from "./modelCheck";
import {
  counterModel,
  isCounterCorrect,
  jobModel,
  isJobFinished,
  lockModel,
  orderModel,
  ORDER_ACTIONS,
  runOrder,
  runSchedule,
} from "./models";

// この題材の説明の芯。ここが崩れると「テストは通るのにモデル検査は見つける」話が嘘になる。
describe("カウンタ（2つのプロセスが同じ変数に 1 を足す）", () => {
  it("読みと書きが分かれていると、12 状態のうち更新が消える状態に 4 手で着く", () => {
    const result = check(counterModel(2, false));
    expect(result.stateCount).toBe(12);
    expect(result.levels).toEqual([1, 2, 3, 4, 2]);
    expect(result.transitionCount).toBe(14);
    expect(result.violation?.map((step) => step.action)).toEqual([
      null,
      "A が読む",
      "B が読む",
      "A が書く",
      "B が書く",
    ]);
    expect(result.violation?.at(-1)?.state.count).toBe(1);
  });

  it("足し算を1手でやれば、どの順でも 2 になる", () => {
    const result = check(counterModel(2, true));
    expect(result.stateCount).toBe(4);
    expect(result.violation).toBeNull();
  });

  it("実行の並びは 2 プロセスで 6 通り、うち 4 通りで更新が消える", () => {
    const model = counterModel(2, false);
    expect(countExecutions(model, isCounterCorrect)).toEqual({
      total: 6,
      good: 2,
      bad: 4,
    });
  });

  it("3 プロセスなら 90 通りのうち正しいのは 6 通りだけ", () => {
    const model = counterModel(3, false);
    expect(countExecutions(model, isCounterCorrect)).toEqual({
      total: 90,
      good: 6,
      bad: 84,
    });
  });

  it("反例の順に動かすと、読み書きが分かれた実装は 1、1手の実装は 2 になる", () => {
    const schedule = ["A が読む", "B が読む", "A が書く", "B が書く"];
    expect(runSchedule(schedule, false)).toEqual({ count: 1, isCorrect: false });
    expect(runSchedule(["A が足す", "B が足す"], true)).toEqual({
      count: 2,
      isCorrect: true,
    });
  });
});

describe("2 つのロック", () => {
  it("取る順が逆だと、2 手でデッドロックに着く", () => {
    const result = check(lockModel(false));
    expect(result.deadlock?.map((step) => step.action)).toEqual([
      null,
      "T1 が L1 を取る",
      "T2 が L2 を取る",
    ]);
  });

  it("同じ順で取ればデッドロックは無い", () => {
    expect(check(lockModel(true)).deadlock).toBeNull();
  });
});

describe("リトライ付きのジョブ", () => {
  it("回数の上限が無いと、失敗と再試行を永遠に繰り返す実行がある", () => {
    const result = checkEventually(jobModel(null), isJobFinished);
    expect(result.holds).toBe(false);
    expect(result.cycle?.map((step) => step.action)).toEqual([
      null,
      "実行する",
      "失敗する",
    ]);
  });

  it("上限があれば、どの実行もいつか終わる（成功か断念）", () => {
    expect(checkEventually(jobModel(2), isJobFinished).holds).toBe(true);
  });
});

describe("注文の状態", () => {
  it("正しい仕様では、支払い前に発送された状態に着かない", () => {
    expect(check(orderModel(false)).violation).toBeNull();
  });

  it("発送の前提条件を書き忘れると、1 手で「未払いのまま発送」に着く", () => {
    const result = check(orderModel(true));
    expect(result.violation?.map((step) => step.action)).toEqual([null, "発送する"]);
  });

  it("状態は 6 つ、遷移は 5 本", () => {
    const result = check(orderModel(false));
    expect(result.stateCount).toBe(6);
    expect(result.transitionCount).toBe(5);
    expect(ORDER_ACTIONS).toHaveLength(5);
  });

  it("操作を順に当て、できない操作で止まる", () => {
    expect(runOrder(["支払う", "発送する"])).toEqual({
      status: "発送済み",
      failedAt: null,
    });
    expect(runOrder(["発送する"])).toEqual({ status: "未払い", failedAt: 0 });
  });
});
