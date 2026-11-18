import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { topic } from "./index";

// 英語の概要ページ（public/en/index.html）は手で書いているので、レッスンを足したときに載せ忘れないよう見張る。
describe("英語の概要ページ", () => {
  const html = readFileSync("public/en/index.html", "utf8");
  const listed = [...html.matchAll(/data-lesson="([a-z0-9-]+)"/g)].map(
    (match) => match[1],
  );

  it("全レッスンを、サイトと同じ並びで1回ずつ載せている", () => {
    expect(listed).toEqual(topic.lessons.map((lesson) => lesson.id));
  });

  it("各レッスンから、日本語の動く図のページへつないでいる", () => {
    for (const lesson of topic.lessons) {
      expect(html).toContain(`href="../#${lesson.id}"`);
    }
  });

  it("全部の分類に見出しがある", () => {
    for (const category of topic.categories) {
      expect(html).toContain(`data-category="${category.id}"`);
    }
  });
});
