import { describe, expect, it } from "vitest";

import { applyPatch, initialStates, statesAt } from "./timeline";
import type { Lesson } from "./types";

const lesson: Lesson = {
  id: "l1",
  category: "c",
  title: "t",
  subtitle: "s",
  summary: "sum",
  facts: [],
  actors: [
    { id: "a", label: "A", icon: "person", x: 10, y: 50 },
    {
      id: "b",
      label: "B",
      icon: "server",
      x: 90,
      y: 50,
      initial: { isHidden: true, rows: { 残高: "0" } },
    },
  ],
  links: [{ from: "a", to: "b" }],
  steps: [
    {
      id: "s1",
      kind: "k",
      title: "送る",
      actor: "a",
      to: ["b"],
      summary: "x",
      explain: "x",
      set: { b: { isHidden: false, rows: { 残高: "10", メモ: "受け取った" } } },
    },
    {
      id: "s2",
      kind: "k",
      title: "確かめる",
      actor: "b",
      summary: "x",
      explain: "x",
      set: { b: { tone: "ok", rows: { メモ: null } } },
    },
  ],
};

describe("initialStates", () => {
  it("initial を書かない登場物は、見えていて行のない idle になる", () => {
    expect(initialStates(lesson).a).toEqual({
      tone: "idle",
      isHidden: false,
      rows: {},
    });
  });

  it("initial の差分が初期状態に反映される", () => {
    expect(initialStates(lesson).b).toEqual({
      tone: "idle",
      isHidden: true,
      rows: { 残高: "0" },
    });
  });
});

describe("statesAt", () => {
  it("cursor が -1 なら初期状態のまま", () => {
    expect(statesAt(lesson, -1)).toEqual(initialStates(lesson));
  });

  it("cursor までのステップの差分を順に重ねる", () => {
    expect(statesAt(lesson, 0).b).toEqual({
      tone: "idle",
      isHidden: false,
      rows: { 残高: "10", メモ: "受け取った" },
    });
  });

  it("rows の値が null の行は消える", () => {
    expect(statesAt(lesson, 1).b).toEqual({
      tone: "ok",
      isHidden: false,
      rows: { 残高: "10" },
    });
  });

  it("進めてから戻しても、同じ cursor なら同じ状態になる", () => {
    const before = statesAt(lesson, 0);
    statesAt(lesson, 1);
    expect(statesAt(lesson, 0)).toEqual(before);
  });

  it("範囲外の cursor は最後のステップまでで止まる", () => {
    expect(statesAt(lesson, 99)).toEqual(statesAt(lesson, 1));
  });
});

describe("applyPatch", () => {
  it("元の状態を書き換えない", () => {
    const state = { tone: "idle" as const, isHidden: false, rows: { a: "1" } };
    applyPatch(state, { rows: { a: "2" } });
    expect(state.rows.a).toBe("1");
  });
});
