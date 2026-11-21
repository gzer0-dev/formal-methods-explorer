// 演習の答えの読み取りと書式。答え合わせのレッスンの組み立ては exerciseLesson.ts。
// produces: parseAnswer・formatAnswer・lazy（正解の計算を使い回す）・Answer／Solution の型 ／ consumes: core の i18n。

import { translator, type Language } from "../core/i18n";

export type AnswerType = "number" | "yesno";
export type Answer = number | boolean;

export interface Solution {
  answer: Answer;
  /** なぜその答えになるかの短い解説。数字は計算の戻り値から組み立てる。 */
  reason: string;
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
