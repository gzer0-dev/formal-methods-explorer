import { describe, expect, it } from "vitest";

import { findUntranslated } from "../core/i18n";
import { philosopherTupleModel } from "./explosion";
import {
  describeBossesIn,
  describeCounterIn,
  displayName,
  displayNames,
} from "./labels";
import { doorModel } from "./ltl";
import { check } from "./modelCheck";
import {
  counterModel,
  describeCounter,
  jobModel,
  lockModel,
  ORDER_ACTIONS,
  orderModel,
} from "./models";
import { describeBosses, PEOPLE } from "./smallScope";
import { WIRINGS } from "./sortModels";

describe("操作名と状態の表示名", () => {
  it("日本語ではそのまま出す（操作名は計算の識別子なので変えない）", () => {
    expect(displayName("Aが読む", "ja")).toBe("Aが読む");
  });

  it("英語ではカウンタ・ロックの操作を英語にする", () => {
    expect(displayNames(["Aが読む", "Bが書く", "Cが足す"], "en")).toBe(
      "A reads → B writes → C adds",
    );
    expect(displayName("T1がL1を取る", "en")).toBe("T1 takes L1");
    expect(displayName("T2が手放す", "en")).toBe("T2 releases");
  });

  it("知らない名前は英語でもそのまま返す（訳し忘れとして findUntranslated に見つけさせる）", () => {
    expect(displayName("見たことのない操作", "en")).toBe("見たことのない操作");
  });

  it("サイトのモデルの操作名と状態は、どれも英語の表示名を持つ", () => {
    const names = [
      ...counterModel(4, false).actions.map((action) => action.name),
      ...counterModel(4, true).actions.map((action) => action.name),
      ...lockModel(false).actions.map((action) => action.name),
      ...jobModel(2).actions.map((action) => action.name),
      ...orderModel(true).actions.map((action) => action.name),
      ...ORDER_ACTIONS.flatMap((transition) => [transition.from, transition.to]),
      ...["待ち", "実行中", "成功", "断念"],
      ...doorModel(true).model.actions.map((action) => action.name),
      ...philosopherTupleModel(3).actions.map((action) => action.name),
      ...Object.values(WIRINGS).flatMap((wiring) => wiring.map((c) => c.name)),
    ];
    expect(names.length).toBeGreaterThan(30);
    expect(findUntranslated(names.map((name) => displayName(name, "en")))).toEqual([]);
  });
});

describe("状態の文字列", () => {
  it("カウンタ: 日本語は describeCounter と同じ、英語は日本語が残らない", () => {
    const trace = check(counterModel(2, false)).violation!;
    for (const step of trace) {
      expect(describeCounterIn(step.state, "ja")).toBe(describeCounter(step.state));
    }
    expect(
      describeCounterIn(
        { pcs: ["read", "write", "done"], tmps: [null, 0, null], count: 1 },
        "en",
      ),
    ).toBe("A:before-read B:local=0 C:done count=1");
  });

  it("上司の関係: 日本語は describeBosses と同じ、英語は日本語が残らない", () => {
    const instance = { A: "B", B: null, C: "A" } as const;
    expect(describeBossesIn(instance, "ja")).toBe(describeBosses(instance));
    expect(describeBossesIn(instance, "en")).toBe("A→B, B→none, C→A");
    expect(PEOPLE.length).toBe(3);
  });
});
