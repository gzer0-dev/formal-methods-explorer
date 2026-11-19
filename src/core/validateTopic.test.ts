import { describe, expect, it } from "vitest";

import type { Lesson, Topic } from "./types";
import { validateTopic } from "./validateTopic";

const ICONS = ["person", "server"];

function validLesson(): Lesson {
  return {
    id: "l1",
    category: "basic",
    title: "送って確かめる",
    subtitle: "いちばん小さい例",
    summary: "A が B に送り、B が確かめる。",
    facts: [{ label: "登場物", value: "2" }],
    actors: [
      { id: "a", label: "A", icon: "person", x: 20, y: 50 },
      { id: "b", label: "B", icon: "server", x: 80, y: 50 },
    ],
    links: [{ from: "a", to: "b" }],
    steps: [
      {
        id: "send",
        kind: "message",
        title: "送る",
        actor: "a",
        to: ["b"],
        summary: "A が B に送る",
        explain: "A が B にデータを送る。",
        detail: [{ title: "中身", fields: [{ label: "本文", value: "hello" }] }],
      },
      {
        id: "check",
        kind: "work",
        title: "確かめる",
        actor: "b",
        summary: "B が確かめる",
        explain: "B が受け取ったデータを確かめる。",
        set: { b: { tone: "ok" } },
      },
    ],
  };
}

function validTopic(): Topic {
  return {
    id: "sample",
    title: "見本",
    tagline: "見本の題材",
    brandIcon: "person",
    timelineTitle: "処理の流れ",
    kinds: [
      { id: "message", label: "通信", color: "#06c" },
      { id: "work", label: "処理", color: "#c60" },
    ],
    categories: [{ id: "basic", label: "基本" }],
    lessons: [validLesson()],
  };
}

/** 正しい題材を 1 か所だけ壊して、その壊れ方が名指しで報告されるかを見る。 */
function problemsAfter(breakIt: (topic: Topic) => void): string {
  const topic = validTopic();
  breakIt(topic);
  return validateTopic(topic, ICONS).join("\n");
}

describe("validateTopic", () => {
  it("正しい題材は問題なし", () => {
    expect(validateTopic(validTopic(), ICONS)).toEqual([]);
  });

  it("レッスンが 1 つも無い", () => {
    expect(problemsAfter((t) => (t.lessons = []))).toContain("レッスンが 1 つも無い");
  });

  it("レッスンの id が重複している", () => {
    expect(problemsAfter((t) => t.lessons.push(validLesson()))).toContain("id が重複");
  });

  it("レッスンが存在しないカテゴリを指している", () => {
    expect(problemsAfter((t) => (t.lessons[0].category = "x"))).toContain(
      'カテゴリ "x" が無い',
    );
  });

  it("レッスンが 1 つも無いカテゴリがある", () => {
    expect(
      problemsAfter((t) => t.categories.push({ id: "empty", label: "空" })),
    ).toContain('カテゴリ "empty" にレッスンが無い');
  });

  it("概要に空の段落がある", () => {
    expect(problemsAfter((t) => (t.lessons[0].intro = ["何の話か", " "]))).toContain(
      'レッスン "l1": 概要の 2 段落目が空',
    );
  });

  it("ステップが 1 つも無い", () => {
    expect(problemsAfter((t) => (t.lessons[0].steps = []))).toContain(
      "ステップが 1 つも無い",
    );
  });

  it("ステップの主体が登場物に無い", () => {
    expect(problemsAfter((t) => (t.lessons[0].steps[0].actor = "z"))).toContain(
      '主体 "z" が登場物に無い',
    );
  });

  it("ステップの送り先が登場物に無い", () => {
    expect(problemsAfter((t) => (t.lessons[0].steps[0].to = ["z"]))).toContain(
      '送り先 "z" が登場物に無い',
    );
  });

  it("ステップの送り先が主体と同じ", () => {
    expect(problemsAfter((t) => (t.lessons[0].steps[0].to = ["a"]))).toContain(
      "送り先が主体と同じ",
    );
  });

  it("ステップの種類が kinds に無い", () => {
    expect(problemsAfter((t) => (t.lessons[0].steps[0].kind = "x"))).toContain(
      '種類 "x" が kinds に無い',
    );
  });

  it("どのステップにも使われていない種類がある（凡例にだけ出てしまう）", () => {
    expect(
      problemsAfter((t) =>
        t.kinds.push({ id: "unused", label: "未使用", color: "#000" }),
      ),
    ).toContain('種類 "unused" がどのステップにも使われていない');
  });

  it("set が存在しない登場物を指している", () => {
    expect(
      problemsAfter((t) => (t.lessons[0].steps[1].set = { z: { tone: "ok" } })),
    ).toContain('set の "z" が登場物に無い');
  });

  it("線が存在しない登場物を指している", () => {
    expect(
      problemsAfter((t) => (t.lessons[0].links = [{ from: "a", to: "z" }])),
    ).toContain('線の端 "z" が登場物に無い');
  });

  it("登場物の位置が図の外にある", () => {
    expect(problemsAfter((t) => (t.lessons[0].actors[0].x = 120))).toContain(
      "位置が 0〜100 の外",
    );
  });

  it("登場物のアイコンが登録されていない", () => {
    expect(problemsAfter((t) => (t.lessons[0].actors[0].icon = "ufo"))).toContain(
      'アイコン "ufo" が無い',
    );
  });

  it("題材が足したアイコンは使える", () => {
    expect(
      problemsAfter((t) => {
        t.icons = { ufo: "<circle cx='12' cy='12' r='8'/>" };
        t.lessons[0].actors[0].icon = "ufo";
      }),
    ).toBe("");
  });

  it("ヘッダーの印のアイコンが登録されていない", () => {
    expect(problemsAfter((t) => (t.brandIcon = "ufo"))).toContain(
      '題材の brandIcon "ufo" が無い',
    );
  });

  it("ステップの題が長すぎて図に収まらない", () => {
    expect(
      problemsAfter((t) => (t.lessons[0].steps[0].title = "あ".repeat(17))),
    ).toContain("title が 16 文字を超えている");
  });

  it("英語の題は英語の長さの上限で見る（英単語は日本語より字数が要るため）", () => {
    const topic = validTopic();
    topic.lessons[0].steps[0].title = "Send the order to the shop";
    expect(validateTopic(topic, ICONS, "en")).toEqual([]);
    topic.lessons[0].steps[0].title = "a".repeat(33);
    expect(validateTopic(topic, ICONS, "en").join("\n")).toContain(
      "title が 32 文字を超えている",
    );
  });

  it("説明が空のステップがある", () => {
    expect(problemsAfter((t) => (t.lessons[0].steps[0].explain = " "))).toContain(
      "explain が空",
    );
  });

  it("隠れている登場物がステップに参加している", () => {
    expect(
      problemsAfter((t) => (t.lessons[0].actors[1].initial = { isHidden: true })),
    ).toContain('"b" がまだ隠れているのに参加している');
  });

  it("最後まで一度も現れない登場物がある", () => {
    expect(
      problemsAfter((t) =>
        t.lessons[0].actors.push({
          id: "ghost",
          label: "G",
          icon: "person",
          x: 50,
          y: 10,
          initial: { isHidden: true },
        }),
      ),
    ).toContain('"ghost" が最後まで一度も現れない');
  });

  it("詳細の項目が空のセクションがある", () => {
    expect(
      problemsAfter(
        (t) => (t.lessons[0].steps[0].detail = [{ title: "空", fields: [] }]),
      ),
    ).toContain("項目が 1 つも無い");
  });

  it("実験が初期値で結果を 1 つも返さない", () => {
    expect(
      problemsAfter(
        (t) =>
          (t.lessons[0].lab = {
            title: "実験",
            hint: "入れてみる",
            inputs: [{ id: "text", label: "文字", initial: "a" }],
            compute: () => [],
          }),
      ),
    ).toContain("実験が初期値で結果を返さない");
  });

  it("実験の compute が例外を投げる", () => {
    expect(
      problemsAfter(
        (t) =>
          (t.lessons[0].lab = {
            title: "実験",
            hint: "入れてみる",
            inputs: [{ id: "text", label: "文字", initial: "a" }],
            compute: () => {
              throw new Error("boom");
            },
          }),
      ),
    ).toContain("実験の compute が失敗した: boom");
  });
});
