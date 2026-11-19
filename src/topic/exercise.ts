// 演習レッスンの答え合わせ。問題の文言はレッスンが言語ごとに渡し、ここは固定の文言だけを言語で切り替える。
// 問題の番号と読者の答えを読み、その問題の正解（サイトの計算関数で求めたもの）と比べる。
// produces: gradeExercise（lab の compute に渡す関数）・lazy（正解の計算を使い回す）／consumes: 各演習レッスンが渡す問題の一覧（solve が計算関数を呼ぶ）。

import { translator, type Language } from "../core/i18n";
import type { Field } from "../core/types";

export type AnswerType = "number" | "yesno";
export type Answer = number | boolean;

export interface Solution {
  answer: Answer;
  /** なぜその答えになるかの短い解説。数字は計算の戻り値から組み立てる。 */
  reason: string;
}

export interface ExerciseQuestion {
  /** 「問1 …」の形（英語の画面では「Q1 …」）。答え合わせの結果の見出しにも使う。 */
  title: string;
  answerType: AnswerType;
  /** 重い計算もあるので、答え合わせで初めて呼ばれる（モジュールの読み込み時には呼ばない）。 */
  solve(): Solution;
}

const YES_WORDS = ["はい", "yes", "y", "true"];
const NO_WORDS = ["いいえ", "no", "n", "false"];

/** 全角の数字を半角にそろえる（日本語入力のまま打った答えも受けるため）。 */
function toHalfWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  );
}

/** 文字列の中の最初の整数を読む。「4手」「問3」も読めるようにする。 */
function firstInteger(text: string | undefined): number | null {
  const match = toHalfWidthDigits(text ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function parseQuestionNumber(
  text: string | undefined,
  questionCount: number,
): number | null {
  const value = firstInteger(text);
  if (value === null || value < 1 || value > questionCount) return null;
  return value;
}

export function parseAnswer(text: string | undefined, type: AnswerType): Answer | null {
  if (type === "number") return firstInteger(text);
  const word = (text ?? "").trim().toLowerCase();
  if (YES_WORDS.includes(word)) return true;
  if (NO_WORDS.includes(word)) return false;
  return null;
}

export function formatAnswer(answer: Answer, language: Language): string {
  const t = translator(language);
  if (typeof answer === "boolean") return answer ? t("はい", "yes") : t("いいえ", "no");
  return String(answer);
}

function answerGuide(type: AnswerType, language: Language): string {
  const t = translator(language);
  return type === "number"
    ? t("数（半角数字）で答えてください", "Answer with a number (digits)")
    : t("「はい」か「いいえ」で答えてください", 'Answer "yes" or "no"');
}

/**
 * lab の compute を作る。values.number が問題の番号、values.answer が読者の答え。
 * 答えが読めないときは solve を呼ばない（初期値の空欄で重い計算を走らせず、正解も見せないため）。
 * 答えはどの言語の画面でも「はい／いいえ」「yes／no」の両方を受け付ける。
 */
export function gradeExercise(
  questions: ExerciseQuestion[],
  language: Language,
): (values: Record<string, string>) => Field[] {
  const t = translator(language);
  const labels = {
    question: t("問題", "Question"),
    result: t("判定", "Result"),
    yourAnswer: t("あなたの答え", "Your answer"),
    correctAnswer: t("正解", "Correct answer"),
    explanation: t("解説", "Explanation"),
  };
  const solved = new Map<number, Solution>();
  const solutionOf = (index: number): Solution => {
    const cached = solved.get(index);
    if (cached) return cached;
    const solution = questions[index]!.solve();
    solved.set(index, solution);
    return solution;
  };

  return (values) => {
    const number = parseQuestionNumber(values.number, questions.length);
    if (number === null) {
      return [
        {
          label: labels.question,
          value: t(
            `番号は1〜${questions.length}で入れてください`,
            `Enter a number from 1 to ${questions.length}`,
          ),
          tone: "wait",
        },
      ];
    }
    const question = questions[number - 1]!;
    const answer = parseAnswer(values.answer, question.answerType);
    if (answer === null) {
      return [
        { label: labels.question, value: question.title },
        {
          label: labels.result,
          value: answerGuide(question.answerType, language),
          tone: "wait",
        },
      ];
    }
    const solution = solutionOf(number - 1);
    const isCorrect = answer === solution.answer;
    return [
      { label: labels.question, value: question.title },
      { label: labels.yourAnswer, value: formatAnswer(answer, language) },
      {
        label: labels.result,
        value: isCorrect ? t("正解", "Correct") : t("不正解", "Incorrect"),
        tone: isCorrect ? "ok" : "bad",
      },
      { label: labels.correctAnswer, value: formatAnswer(solution.answer, language) },
      { label: labels.explanation, value: solution.reason },
    ];
  };
}

/**
 * 重い計算を、最初に呼ばれたときに1回だけ行う関数にする。
 * 演習のレッスンは言語ごとに問題の文言を作り直すので、正解の計算はモジュールの最上位でこれに包み、言語をまたいで使い回す。
 */
export function lazy<T>(compute: () => T): () => T {
  let cached: { value: T } | null = null;
  return () => {
    if (cached === null) cached = { value: compute() };
    return cached.value;
  };
}
