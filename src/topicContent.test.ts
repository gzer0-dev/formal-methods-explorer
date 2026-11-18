// @vitest-environment jsdom
//
// 実際の題材（src/topic）に対する検査。題材を足す・直すたびにここが守る。
//   1. データの整合（存在しない登場物を指していないか、など）
//   2. すべてのレッスンを、画面の操作だけで最後のステップまで進められるか

import { afterEach, describe, expect, it } from "vitest";

import { validateTopic } from "./core/validateTopic";
import { topic } from "./topic";
import { mountApp } from "./ui/app";
import { BUILTIN_ICON_IDS } from "./ui/icons";

afterEach(() => document.body.replaceChildren());

describe("題材データの整合", () => {
  it("validateTopic が問題を 1 つも報告しない", () => {
    expect(validateTopic(topic, BUILTIN_ICON_IDS)).toEqual([]);
  });

  it("レッスンが 1 つ以上ある（検査の対象が 0 件になっていない）", () => {
    expect(topic.lessons.length).toBeGreaterThan(0);
  });
});

describe("すべてのレッスンを最後まで進められる", () => {
  for (const lesson of topic.lessons) {
    it(`${lesson.title}: 「次へ」だけで最後のステップに着く`, () => {
      const root = document.createElement("div");
      document.body.append(root);
      const app = mountApp(root, topic);
      root.querySelector<HTMLElement>(`[data-lesson-id="${lesson.id}"]`)?.click();
      const next = root.querySelector<HTMLButtonElement>("[data-action=next]");
      lesson.steps.forEach((step, index) => {
        next?.click();
        expect(root.querySelector("[data-role=step-counter]")?.textContent).toBe(
          `${index + 1} / ${lesson.steps.length}`,
        );
        expect(root.querySelector("[data-role=caption-title]")?.textContent).toBe(
          step.title,
        );
      });
      expect(next?.disabled).toBe(true);
      app.destroy();
    });
  }
});
