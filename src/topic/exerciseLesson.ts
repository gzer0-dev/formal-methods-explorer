// 演習を1問＝1レッスンで組み立てる。
// 答える前の図は問題の設定だけを見せ、正解の計算（solve）を呼ばない（既定の図と静的な本文に正解を出さないため）。
// 答えを入れると lab.lesson が、正解の手順（solutionSteps）と答え合わせのステップを足したレッスンを返す。
// produces: buildExerciseLesson・ExerciseSpec ／ consumes: exercise.ts の答えの読み取りと書式、core の型。

import { translator, type Language } from "../core/i18n";
import type { Actor, Field, Lesson, Link, Step } from "../core/types";
import {
  type Answer,
  type AnswerType,
  formatAnswer,
  parseAnswer,
  type Solution,
} from "./exercise";

export interface ExerciseSpec {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  intro: string[];
  facts: Field[];
  actors: Actor[];
  links: Link[];
  stageHeight?: number;
  answerType: AnswerType;
  /** 答えの欄の名前（例: 「あなたの答え（手数）」）。 */
  answerLabel: string;
  hint: string;
  /** 答え合わせのステップで、あなたの答えと正解を載せる登場物。 */
  verdictActor: string;
  /** 問題の設定と問い。正解につながる手順は入れない。 */
  setupSteps: Step[];
  /** 正解。重い計算もあるので、答えが入るまで呼ばない。 */
  solve(): Solution;
  /** 正解を図で見せる手順（反例・止まる手順・数え方の例など）。答え合わせのステップは組み立て側が足す。 */
  solutionSteps(solution: Solution, answer: Answer): Step[];
  /** 検査（validateTopic）で試す答え。省くと答えの形ごとの既定を使う。 */
  samples?: string[];
}

const DEFAULT_SAMPLES: Record<AnswerType, string[]> = {
  number: ["0", "1", "4", "x"],
  // 英語の画面の検査（未訳の文字）に掛からないよう英字で書く。答えはどの言語でも yes/no を受け付ける。
  yesno: ["yes", "no", "x"],
};

function verdictStep(
  spec: ExerciseSpec,
  solution: Solution,
  answer: Answer,
  language: Language,
): Step {
  const t = translator(language);
  const isCorrect = answer === solution.answer;
  const yours = formatAnswer(answer, language);
  const correct = formatAnswer(solution.answer, language);
  return {
    id: "verdict",
    kind: isCorrect ? "fix" : "found",
    title: isCorrect
      ? t("答え合わせ: 正解", "Result: correct")
      : t("答え合わせ: 不正解", "Result: incorrect"),
    actor: spec.verdictActor,
    // 「あなたの答えははい」と読みにくくなるので、はい／いいえはかぎかっこで囲む。
    summary:
      spec.answerType === "yesno"
        ? t(
            `あなたは「${yours}」と答え、正解は「${correct}」`,
            `You answered "${yours}"; the answer is "${correct}"`,
          )
        : t(
            `あなたの答えは${yours}、正解は${correct}`,
            `You answered ${yours}; the answer is ${correct}`,
          ),
    explain: solution.reason,
    set: {
      [spec.verdictActor]: {
        tone: isCorrect ? "ok" : "bad",
        rows: {
          [t("あなた", "you")]: yours,
          [t("正解", "answer")]: correct,
        },
      },
    },
  };
}

function gradeFields(
  spec: ExerciseSpec,
  solve: () => Solution,
  values: Record<string, string>,
  language: Language,
): Field[] {
  const t = translator(language);
  const answer = parseAnswer(values.answer, spec.answerType);
  if (answer === null) {
    const guide =
      spec.answerType === "number"
        ? t("数（半角数字）で答えてください", "Answer with a number (digits)")
        : t("「はい」か「いいえ」で答えてください", 'Answer "yes" or "no"');
    return [{ label: t("判定", "Result"), value: guide, tone: "wait" }];
  }
  const solution = solve();
  const isCorrect = answer === solution.answer;
  return [
    { label: t("あなたの答え", "Your answer"), value: formatAnswer(answer, language) },
    {
      label: t("判定", "Result"),
      value: isCorrect ? t("正解", "Correct") : t("不正解", "Incorrect"),
      tone: isCorrect ? "ok" : "bad",
    },
    {
      label: t("正解", "Correct answer"),
      value: formatAnswer(solution.answer, language),
    },
  ];
}

export function buildExerciseLesson(spec: ExerciseSpec, language: Language): Lesson {
  // 同じレッスンの中では正解を1回だけ計算する（答えを打ち直すたびに重い計算を走らせない）。
  let cached: Solution | null = null;
  const solve = (): Solution => {
    if (cached === null) cached = spec.solve();
    return cached;
  };

  const lessonWith = (answer: Answer | null): Lesson => {
    const steps =
      answer === null
        ? spec.setupSteps
        : [
            ...spec.setupSteps,
            ...spec.solutionSteps(solve(), answer),
            verdictStep(spec, solve(), answer, language),
          ];
    return {
      id: spec.id,
      category: "exercise",
      title: spec.title,
      subtitle: spec.subtitle,
      summary: spec.summary,
      intro: spec.intro,
      facts: spec.facts,
      actors: spec.actors,
      ...(spec.stageHeight ? { stageHeight: spec.stageHeight } : {}),
      links: spec.links,
      steps,
      lab: {
        title: translator(language)("答え合わせ", "Check your answer"),
        hint: spec.hint,
        inputs: [
          {
            id: "answer",
            label: spec.answerLabel,
            initial: "",
            samples: spec.samples ?? DEFAULT_SAMPLES[spec.answerType],
          },
        ],
        compute: (values) => gradeFields(spec, solve, values, language),
        lesson: (values) => lessonWith(parseAnswer(values.answer, spec.answerType)),
      },
    };
  };

  return lessonWith(null);
}
