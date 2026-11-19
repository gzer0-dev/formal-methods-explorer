// レッスンのファイル（src/topic/lessons/*.ts）を 1 つずつ単独で検査する。
//
// 題材全体の検査（topicContent.test.ts）は、import が 1 つ壊れると全部が読めなくなる。
// 複数人（複数のエージェント）で手分けしてレッスンを書くとき、「どのファイルが悪いか」を
// 名指しできるように、ファイルごとの検査を分けてある。書きかけのレッスンがあっても動く。
//
//   npx vitest run src/lessonFiles.test.ts

import { describe, expect, it } from "vitest";

import { findUntranslated, LANGUAGES, type Language } from "./core/i18n";
import type { Lesson, Topic } from "./core/types";
import { validateTopic } from "./core/validateTopic";
import { TOPIC_ICONS } from "./topic/icons";
import { CATEGORIES, KINDS } from "./topic/taxonomy";
import { BUILTIN_ICON_IDS } from "./ui/icons";

const modules = import.meta.glob<Record<string, unknown>>("./topic/lessons/*.ts", {
  eager: true,
});

function isLesson(value: unknown): value is Lesson {
  return (
    typeof value === "object" && value !== null && "steps" in value && "actors" in value
  );
}

// レッスンは Lesson そのもの（日本語だけ）か、名前が Lesson で終わる (language) => Lesson の関数で書く。
// 関数で書いたレッスンは全言語で作って検査する（関数にした時点で、英語の訳し忘れも落ちる）。
const lessons = Object.entries(modules)
  .filter(([path]) => !path.endsWith(".test.ts"))
  .flatMap(([path, exported]) =>
    Object.entries(exported).flatMap(([name, value]) => {
      if (isLesson(value)) return [{ path, language: "ja" as Language, lesson: value }];
      if (typeof value !== "function" || !name.endsWith("Lesson")) return [];
      return LANGUAGES.map((language) => ({
        path,
        language,
        lesson: (value as (language: Language) => Lesson)(language),
      }));
    }),
  );

/** 1 レッスンだけの題材に包んで検査する。他のレッスンが無いことによる指摘は除く。 */
function problemsOf(lesson: Lesson, language: Language): string[] {
  const topic: Topic = {
    id: "single",
    title: "t",
    tagline: "t",
    brandIcon: BUILTIN_ICON_IDS[0],
    timelineTitle: "t",
    kinds: KINDS,
    categories: CATEGORIES,
    lessons: [lesson],
    icons: TOPIC_ICONS,
  };
  return validateTopic(topic, BUILTIN_ICON_IDS, language).filter(
    (problem) =>
      !problem.includes("がどのステップにも使われていない") &&
      !problem.includes("にレッスンが無い"),
  );
}

describe("レッスンのファイル", () => {
  it("1 つ以上のレッスンを見つけている（検査の対象が 0 件になっていない）", () => {
    expect(lessons.length).toBeGreaterThan(0);
  });

  for (const { path, language, lesson } of lessons) {
    it(`${path}（${language}）: ${lesson.title} に問題がない`, () => {
      expect(problemsOf(lesson, language)).toEqual([]);
      if (language !== "ja") expect(findUntranslated(lesson)).toEqual([]);
    });
  }
});
