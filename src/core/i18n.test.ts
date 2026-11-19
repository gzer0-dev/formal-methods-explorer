import { describe, expect, it } from "vitest";

import { findUntranslated, translator } from "./i18n";
import type { Field, Lab } from "./types";

describe("translator", () => {
  it("選んだ言語の方の文字列を返す", () => {
    expect(translator("ja")("題", "Title")).toBe("題");
    expect(translator("en")("題", "Title")).toBe("Title");
  });
});

describe("findUntranslated", () => {
  const field = (label: string, value: string): Field => ({ label, value });

  it("日本語の文字が残っている文字列の場所を返す", () => {
    expect(
      findUntranslated({
        title: "Title",
        lessons: [{ facts: [field("Count", "6通り")] }],
      }),
    ).toEqual(["lessons[0].facts[0].value: 6通り"]);
  });

  it("中黒と長音（カタカナの文字種に入らない記号）も見つける", () => {
    expect(findUntranslated({ where: "A ・ B" })).toEqual(["where: A ・ B"]);
  });

  it("Lab は初期値以外の入力でも計算して調べる（入力で問題を選ぶ演習のため）", () => {
    const lab: Lab = {
      title: "Lab",
      hint: "Type",
      inputs: [{ id: "n", label: "Number", initial: "1" }],
      compute: (values) => [field("Question", values.n === "3" ? "第3問" : "Q")],
    };
    expect(findUntranslated({ lab })).toEqual(['lab.compute(n="3")[0].value: 第3問']);
  });

  it("全部英語なら空", () => {
    expect(findUntranslated({ title: "Title", rows: { a: "A → B" }, x: 3 })).toEqual(
      [],
    );
  });

  it("画面に出るオブジェクトのキー（カードの項目名）も調べる", () => {
    expect(findUntranslated({ rows: { 残高: "3" } })).toEqual(["rows: キー 残高"]);
  });

  it("Lab は初期値で計算した結果も調べる", () => {
    const lab: Lab = {
      title: "Lab",
      hint: "Type",
      inputs: [{ id: "n", label: "Number", initial: "2" }],
      compute: () => [field("Result", "成り立つ")],
    };
    expect(findUntranslated({ lab })).toEqual([
      "lab.compute(initial)[0].value: 成り立つ",
    ]);
  });
});
