import { describe, expect, it } from "vitest";
import { explore, hide, normalizedStateCount, traceRefines } from "./csp";
import { PHILOSOPHER_ENV, philosophers } from "./cspModels";
import {
  SESSION_ENV,
  sessionExclusiveSpec,
  sessionSystem,
  sessionView,
} from "./cspSession";
import { philosopherTupleModel, symmetricStateCount } from "./explosion";
import { check } from "./modelCheck";
import { checkLtl, doorModel } from "./ltl";

describe("チャネル渡し（セッションのチャネルを客に渡す）", () => {
  it("空きを覚えている振り分け役なら、同じセッションを2人が同時に持たない", () => {
    expect(
      traceRefines(
        sessionExclusiveSpec("s1"),
        sessionView(sessionSystem(false), "s1"),
        SESSION_ENV,
      ).holds,
    ).toBe(true);
  });

  it("空きを覚えない振り分け役は、同じセッションを2人に渡してしまう", () => {
    const result = traceRefines(
      sessionExclusiveSpec("s1"),
      sessionView(sessionSystem(true), "s1"),
      SESSION_ENV,
    );
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual(["assign.A.s1", "assign.B.s1"]);
  });
});

describe("状態爆発", () => {
  it("哲学者を素朴に書いたモデルの状態数は、CSP のモデルの状態数と一致する", () => {
    for (const n of [2, 3, 4]) {
      expect(check(philosopherTupleModel(n)).stateCount).toBe(
        explore(philosophers(n, false), PHILOSOPHER_ENV).stateCount,
      );
    }
  });

  it("回して同じになる配置を1つに数える（対称性）と、状態はおよそ人数分の1に減る", () => {
    expect(symmetricStateCount(3)).toBeLessThan(
      check(philosopherTupleModel(3)).stateCount,
    );
    for (const n of [3, 4, 5]) {
      const full = check(philosopherTupleModel(n)).stateCount;
      expect(symmetricStateCount(n)).toBeGreaterThanOrEqual(Math.ceil(full / n));
    }
  });

  it("見える振る舞いだけに正規化すると、隠した動きの分だけ状態が減る", () => {
    const hidden = hide(philosophers(3, false), [
      "pick.1.1",
      "pick.1.2",
      "put.1.1",
      "put.1.2",
      "pick.2.2",
      "pick.2.0",
      "put.2.2",
      "put.2.0",
    ]);
    expect(normalizedStateCount(hidden, PHILOSOPHER_ENV)).toBeLessThan(
      explore(hidden, PHILOSOPHER_ENV).stateCount,
    );
  });
});

describe("時相論理（LTL）をエレベーターの扉で読む", () => {
  it("正しい扉: 呼べばいつか必ず開く（□(呼ぶ → ◇開)）、閉じた状態に何度でも戻る（□◇閉）", () => {
    const door = doorModel(false);
    expect(checkLtl(door, { kind: "leadsTo", p: "requested", q: "open" }).holds).toBe(
      true,
    );
    expect(checkLtl(door, { kind: "alwaysEventually", p: "closed" }).holds).toBe(true);
  });

  it("ずっと開いたまま（◇□開）は成り立たない", () => {
    expect(
      checkLtl(doorModel(false), { kind: "eventuallyAlways", p: "open" }).holds,
    ).toBe(false);
  });

  it("呼び出しを取りこぼす扉は、呼んでも開かないまま回り続ける反例がある", () => {
    const result = checkLtl(doorModel(true), {
      kind: "leadsTo",
      p: "requested",
      q: "open",
    });
    expect(result.holds).toBe(false);
    // 閉まる途中で呼ぶ → 閉まりきると呼び出しが消える → 待ち続ける
    expect(result.trace).toEqual([
      "呼ぶ",
      "開き始める",
      "開ききる",
      "閉まり始める",
      "呼ぶ",
      "閉まりきる",
    ]);
    expect(result.cycle).toEqual(["待つ"]);
  });

  it("いつも（□）は不変条件と同じ: 開いているときに呼び出しが残っていることはない", () => {
    expect(checkLtl(doorModel(false), { kind: "always", p: "safe" }).holds).toBe(true);
  });
});
