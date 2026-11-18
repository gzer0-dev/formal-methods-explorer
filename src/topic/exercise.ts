// 演習レッスンの答え合わせ。問題の番号と読者の答えを読み、その問題の正解（サイトの計算関数で求めたもの）と比べる。
// produces: gradeExercise（lab の compute に渡す関数）／consumes: 各演習レッスンが渡す問題の一覧（solve が計算関数を呼ぶ）。

import type { Field } from "../core/types";

export type AnswerType = "number" | "yesno";
export type Answer = number | boolean;

export interface Solution {
  answer: Answer;
  /** なぜその答えになるかの短い解説。数字は計算の戻り値から組み立てる。 */
  reason: string;
}

export interface ExerciseQuestion {
  /** 「問1 …」の形。答え合わせの結果の見出しにも使う。 */
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

export function formatAnswer(answer: Answer): string {
  if (typeof answer === "boolean") return answer ? "はい" : "いいえ";
  return String(answer);
}

function answerGuide(type: AnswerType): string {
  return type === "number"
    ? "数（半角数字）で答えてください"
    : "「はい」か「いいえ」で答えてください";
}

/**
 * lab の compute を作る。values.number が問題の番号、values.answer が読者の答え。
 * 答えが読めないときは solve を呼ばない（初期値の空欄で重い計算を走らせず、正解も見せないため）。
 */
export function gradeExercise(
  questions: ExerciseQuestion[],
): (values: Record<string, string>) => Field[] {
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
          label: "問題",
          value: `番号は1〜${questions.length}で入れてください`,
          tone: "wait",
        },
      ];
    }
    const question = questions[number - 1]!;
    const answer = parseAnswer(values.answer, question.answerType);
    if (answer === null) {
      return [
        { label: "問題", value: question.title },
        { label: "判定", value: answerGuide(question.answerType), tone: "wait" },
      ];
    }
    const solution = solutionOf(number - 1);
    const isCorrect = answer === solution.answer;
    return [
      { label: "問題", value: question.title },
      { label: "あなたの答え", value: formatAnswer(answer) },
      {
        label: "判定",
        value: isCorrect ? "正解" : "不正解",
        tone: isCorrect ? "ok" : "bad",
      },
      { label: "正解", value: formatAnswer(solution.answer) },
      { label: "解説", value: solution.reason },
    ];
  };
}
