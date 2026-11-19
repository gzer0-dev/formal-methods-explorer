// @vitest-environment jsdom
//
// 実際の題材（src/topic）に対する検査。題材を足す・直すたびにここが守る。言語ごとの題材（topics）すべてに当てる。
//   1. データの整合（存在しない登場物を指していないか、など）
//   2. すべてのレッスンを、画面の操作だけで最後のステップまで進められるか
//   3. 日本語以外の題材に、日本語の文字が残っていないか（訳し忘れ）

import { afterEach, describe, expect, it } from "vitest";

import { findUntranslated, type Language } from "./core/i18n";
import type { Topic } from "./core/types";
import { validateTopic } from "./core/validateTopic";
import { topic, topics } from "./topic";
import { mountApp } from "./ui/app";
import { BUILTIN_ICON_IDS } from "./ui/icons";

afterEach(() => document.body.replaceChildren());

const entries = Object.entries(topics) as [Language, Topic][];

describe("言語ごとの題材", () => {
  it("日本語の題材が topics の ja と同じ（静的な本文と文言の書き出しは topic を読むため）", () => {
    expect(topics.ja).toBe(topic);
  });

  it("どの言語も同じレッスンを同じ並びで持つ（切り替えでいまのレッスンを引き継ぐため）", () => {
    for (const [, localized] of entries) {
      expect(localized.lessons.map((lesson) => lesson.id)).toEqual(
        topic.lessons.map((lesson) => lesson.id),
      );
    }
  });
});

describe.each(entries)("題材データの整合（%s）", (language, localized) => {
  it("validateTopic が問題を 1 つも報告しない", () => {
    expect(validateTopic(localized, BUILTIN_ICON_IDS, language)).toEqual([]);
  });

  it("レッスンが 1 つ以上ある（検査の対象が 0 件になっていない）", () => {
    expect(localized.lessons.length).toBeGreaterThan(0);
  });

  if (language !== "ja") {
    it("日本語の文字が残っていない", () => {
      expect(findUntranslated(localized)).toEqual([]);
    });
  }
});

describe.each(entries)(
  "すべてのレッスンを最後まで進められる（%s）",
  (_language, localized) => {
    for (const lesson of localized.lessons) {
      it(`${lesson.title}: 「次へ」だけで最後のステップに着く`, () => {
        const root = document.createElement("div");
        document.body.append(root);
        const app = mountApp(root, localized);
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
  },
);
