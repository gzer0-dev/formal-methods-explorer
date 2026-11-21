import { describe, expect, it } from "vitest";
import type { Language } from "./core/i18n";
import { validateTopic } from "./core/validateTopic";
import { topics } from "./topic";
import { BUILTIN_ICON_IDS } from "./ui/icons";

// 題材（src/topic）の演習を見る検査。ui のアイコン一覧が要るので、topic の外に置く（topic → ui の import は禁止）。
// 演習の samples は既定では正解を含まない（正解は solve で求めるので、ソースに書かない）。
// 正解を入れたときの図も検査から漏れないよう、答え合わせの欄が出す正解を入れて組み直し、題材の検査に通す。
describe("演習に正解を入れたときの図", () => {
  for (const [language, topic] of Object.entries(topics)) {
    const exercises = topic!.lessons.filter((lesson) => lesson.category === "exercise");

    it(`${language}: 演習のレッスンがある`, () => {
      expect(exercises.length).toBeGreaterThan(0);
    });

    for (const lesson of exercises) {
      it(`${language} ${lesson.id}: 正解を入れて組み直した図も検査を通る`, () => {
        const lab = lesson.lab!;
        // 数の問題は 0、はい／いいえの問題は yes を入れれば、答え合わせの欄に正解が出る。
        const fields = [
          ...lab.compute({ answer: "0" }),
          ...lab.compute({ answer: "yes" }),
        ];
        const correctLabel = language === "ja" ? "正解" : "Correct answer";
        const correct = fields.find((field) => field.label === correctLabel)?.value;
        expect(correct).toBeDefined();
        // 組み直した図の lab は「空欄なら答える前の図に戻る」ので、ここでは図だけを検査する（lab の検査は topicContent.test が見る）。
        const { lab: _answeredLab, ...answered } = lab.lesson!({ answer: correct! });
        expect(answered.steps.at(-1)!.set?.[answered.steps.at(-1)!.actor]?.tone).toBe(
          "ok",
        );
        const problems = validateTopic(
          {
            ...topic!,
            lessons: topic!.lessons.map((each) =>
              each.id === lesson.id ? answered : each,
            ),
          },
          BUILTIN_ICON_IDS,
          language as Language,
        );
        expect(problems).toEqual([]);
      });
    }
  }
});
