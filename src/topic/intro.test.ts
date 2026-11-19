import { describe, expect, it } from "vitest";

import { topic } from "./index";

// アニメーションだけでは何の話か分からないと言われたので、全レッスンに見る前の概要を置く（2026-11-19）。
describe("レッスンの概要", () => {
  it.each(topic.lessons.map((lesson) => [lesson.id, lesson] as const))(
    "%s は図の前に読む概要を2〜3段落持ち、要約の繰り返しではない",
    (_id, lesson) => {
      const intro = lesson.intro ?? [];
      expect(intro.length).toBeGreaterThanOrEqual(2);
      expect(intro.length).toBeLessThanOrEqual(3);
      for (const paragraph of intro) {
        expect(paragraph.trim()).not.toBe("");
        expect(paragraph).not.toBe(lesson.summary);
      }
    },
  );
});
