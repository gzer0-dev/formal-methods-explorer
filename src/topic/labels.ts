// モデルの操作名・状態を、画面に出すときだけ言語ごとの表示名にする。
//
// 操作名（「Aが読む」など）や状態（「未払い」など）は計算の識別子を兼ねている（反例の手順・テストの判定・lab の入力が
// 文字列で読む）。英語のためにそれ自体を変えると、計算と照合（TLC・ProB）の期待値まで変わるので、表示の所でだけ置き換える。
// 英訳を手分けするとき、モデルの識別子の英語はここに集める（レッスンごとに訳がぶれないように）。

import type { Language } from "../core/i18n";
import { PROCESS_NAMES, type CounterState } from "./models";
import { PEOPLE, type BossInstance } from "./smallScope";

// 1語そのままで置き換わるもの（ジョブ・注文の状態と操作、エレベーターの扉の動き）。
const EXACT: Record<string, string> = {
  待ち: "waiting",
  実行中: "running",
  成功: "succeeded",
  断念: "gave up",
  実行する: "run",
  成功する: "succeed",
  失敗する: "fail",
  諦める: "give up",
  未払い: "unpaid",
  支払済み: "paid",
  発送済み: "shipped",
  配達済み: "delivered",
  取消済み: "cancelled",
  返金済み: "refunded",
  支払う: "pay",
  発送する: "ship",
  届ける: "deliver",
  取り消す: "cancel",
  返金する: "refund",
  呼ぶ: "call",
  待つ: "wait",
  開き始める: "start opening",
  開ききる: "finish opening",
  閉まり始める: "start closing",
  閉まりきる: "finish closing",
  なし: "none",
};

// 主語つきの操作名（カウンタ・ロック・哲学者）と、番号つきの部品（並べ替えの比較器）。
const PATTERNS: [RegExp, (match: RegExpExecArray) => string][] = [
  [/^(.+)が読む$/, (m) => `${m[1]} reads`],
  [/^(.+)が書く$/, (m) => `${m[1]} writes`],
  [/^(.+)が足す$/, (m) => `${m[1]} adds`],
  [/^(.+)が手放す$/, (m) => `${m[1]} releases`],
  [/^(.+)が左を取る$/, (m) => `${m[1]} takes left`],
  [/^(.+)が右を取る$/, (m) => `${m[1]} takes right`],
  [/^(.+)が左を置く$/, (m) => `${m[1]} puts left`],
  [/^(.+)が右を置く$/, (m) => `${m[1]} puts right`],
  [/^(.+)が(.+)を取る$/, (m) => `${m[1]} takes ${m[2]}`],
  [/^比較器(\d+)$/, (m) => `comparator ${m[1]}`],
];

/**
 * 操作名・状態の表示名。日本語ではそのまま返す。
 * 英語の表示名が無いものもそのまま返す（訳し忘れとして findUntranslated に見つけさせる）。
 */
export function displayName(name: string, language: Language): string {
  if (language === "ja") return name;
  const exact = EXACT[name];
  if (exact !== undefined) return exact;
  for (const [pattern, render] of PATTERNS) {
    const match = pattern.exec(name);
    if (match) return render(match);
  }
  return name;
}

/** 操作の並びを「A reads → B reads」の形にする。 */
export function displayNames(names: string[], language: Language): string {
  return names.map((name) => displayName(name, language)).join(" → ");
}

/** describeCounter の言語つき版。日本語では describeCounter と同じ文字列になる。 */
export function describeCounterIn(state: CounterState, language: Language): string {
  const labels =
    language === "ja"
      ? { before: "読む前", local: "手元", done: "済" }
      : { before: "before-read", local: "local", done: "done" };
  return state.pcs
    .map((pc, i) => {
      const tmp = state.tmps[i];
      const label =
        pc === "read"
          ? labels.before
          : pc === "write"
            ? `${labels.local}=${tmp}`
            : labels.done;
      return `${PROCESS_NAMES[i] ?? `P${i + 1}`}:${label}`;
    })
    .concat(`count=${state.count}`)
    .join(" ");
}

/** describeBosses の言語つき版。日本語では describeBosses と同じ文字列になる。 */
export function describeBossesIn(instance: BossInstance, language: Language): string {
  const none = language === "ja" ? "なし" : "none";
  const separator = language === "ja" ? "、" : ", ";
  return PEOPLE.map((person) => `${person}→${instance[person] ?? none}`).join(
    separator,
  );
}
