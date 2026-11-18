import type { Field, Lesson } from "../../core/types";
import { checkWithdraw, withdraw } from "../contracts";
import type { WithdrawCase } from "../contracts";

const MAX_BALANCE = 5;
const MAX_AMOUNT = 5;
const WEAK = checkWithdraw({
  maxBalance: MAX_BALANCE,
  maxAmount: MAX_AMOUNT,
  requireEnough: false,
});
const STRONG = checkWithdraw({
  maxBalance: MAX_BALANCE,
  maxAmount: MAX_AMOUNT,
  requireEnough: true,
});
const COUNTER = WEAK.counterexample!;
// 呼び出しの一例（残高の範囲で、普通に引ける額）。
const EXAMPLE_BALANCE = 5;
const EXAMPLE_AMOUNT = 3;
const EXAMPLE_AFTER = withdraw(EXAMPLE_BALANCE, EXAMPLE_AMOUNT);

function describeCase(found: WithdrawCase): string {
  return `残高 ${found.balance}・金額 ${found.amount} → 結果 ${found.after}`;
}

function parseMax(text: string | undefined, fallback: number): number {
  const value = Number.parseInt(text ?? "", 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 9) : fallback;
}

function parseRequireEnough(text: string | undefined): boolean {
  return (text ?? "").includes("あり");
}

export const preconditionsLesson: Lesson = {
  id: "preconditions",
  category: "spec",
  title: "事前条件と事後条件",
  subtitle: "引き出しの関数に契約を書く",
  summary: `残高から金額を引く関数に、呼ぶ前の約束（事前条件）と呼んだ後の約束（事後条件）を書く。「金額 > 0」だけでは ${WEAK.checked} 通り中に反例があり、「金額 ≦ 残高」を足すと ${STRONG.checked} 通りすべてで成り立つ。`,
  facts: [
    { label: "調べた範囲", value: `残高 0〜${MAX_BALANCE}・金額 0〜${MAX_AMOUNT}` },
    { label: "最初の反例", value: describeCase(COUNTER), tone: "bad" },
    { label: "直した後", value: `${STRONG.checked} 通りすべて成立`, tone: "ok" },
    { label: "実物の道具", value: "Dafny など" },
  ],
  actors: [
    {
      id: "caller",
      label: "呼び出し側",
      sublabel: "残高と金額を渡す",
      icon: "person",
      x: 14,
      y: 27,
    },
    {
      id: "withdraw",
      label: "withdraw 関数",
      sublabel: "残高 − 金額を返す",
      icon: "contract",
      x: 50,
      y: 27,
    },
    {
      id: "post",
      label: "事後条件",
      sublabel: "呼んだ後の約束",
      icon: "spec",
      x: 86,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "pre",
      label: "事前条件",
      sublabel: "呼ぶ前の約束",
      icon: "spec",
      x: 30,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "範囲内を総当たり",
      icon: "checker",
      x: 70,
      y: 73,
      initial: { isHidden: true },
    },
  ],
  links: [
    { from: "caller", to: "withdraw" },
    { from: "pre", to: "withdraw" },
    { from: "withdraw", to: "post" },
    { from: "checker", to: "withdraw" },
  ],
  steps: [
    {
      id: "call",
      kind: "run",
      title: "関数を呼ぶ",
      actor: "caller",
      to: ["withdraw"],
      summary: `残高 ${EXAMPLE_BALANCE} から ${EXAMPLE_AMOUNT} を引くと ${EXAMPLE_AFTER} が返る`,
      explain: `withdraw は残高から金額を引いた値を返すだけの関数。残高 ${EXAMPLE_BALANCE} から ${EXAMPLE_AMOUNT} を引けば ${EXAMPLE_AFTER} になる。このままでは、どんな値で呼んでよいのか、何が返ると約束しているのかが書かれていない。`,
      set: {
        caller: {
          rows: { 残高: String(EXAMPLE_BALANCE), 金額: String(EXAMPLE_AMOUNT) },
        },
        withdraw: { rows: { 結果: String(EXAMPLE_AFTER) } },
      },
    },
    {
      id: "write-pre",
      kind: "spec",
      title: "事前条件を書く",
      actor: "pre",
      to: ["withdraw"],
      summary: "呼び出し側が守る約束として「金額 > 0」を書く",
      explain:
        "事前条件（precondition）は、呼び出し側が守るべき約束。ここでは「金額 > 0」だけを書いた。このように関数ごとに約束を書いて責任を分ける考え方を、契約による設計（Design by Contract）と呼ぶ。",
      set: { pre: { isHidden: false, rows: { 条件: "金額 > 0" } } },
    },
    {
      id: "write-post",
      kind: "spec",
      title: "事後条件を書く",
      actor: "post",
      summary: "関数が守る約束として「結果 ≧ 0 かつ 結果 = 残高 − 金額」を書く",
      explain:
        "事後条件（postcondition）は、事前条件が守られたときに関数が守る約束。「残高がマイナスにならず、ちょうど金額分だけ減る」を書いた。事前条件を満たす呼び出しなら、必ずこれが成り立つはずだ。",
      set: {
        post: {
          isHidden: false,
          rows: { 条件: "結果 ≧ 0", 計算: "結果 = 残高 − 金額" },
        },
      },
    },
    {
      id: "explore",
      kind: "explore",
      title: "範囲内を総当たり",
      actor: "checker",
      to: ["withdraw"],
      summary: `残高 0〜${MAX_BALANCE}・金額 0〜${MAX_AMOUNT} のうち事前条件を満たす ${WEAK.checked} 通りで事後条件を調べる`,
      explain: `検査器は、残高 0〜${MAX_BALANCE} と金額 0〜${MAX_AMOUNT} の組を全部作り、事前条件を満たす ${WEAK.checked} 通りだけで関数を呼んで事後条件を確かめる。事前条件を破る呼び出しは、関数の責任ではないので調べない。`,
      set: {
        caller: { rows: { 残高: null, 金額: null } },
        withdraw: { rows: { 結果: null } },
        checker: {
          isHidden: false,
          tone: "wait",
          rows: {
            範囲: `残高 0〜${MAX_BALANCE}・金額 0〜${MAX_AMOUNT}`,
            調べた: `${WEAK.checked} 通り`,
          },
        },
      },
    },
    {
      id: "found",
      kind: "found",
      title: `残高${COUNTER.balance}から${COUNTER.amount}を引く`,
      actor: "checker",
      to: ["withdraw"],
      summary: `最初の反例: ${describeCase(COUNTER)}`,
      explain: `残高 ${COUNTER.balance} から ${COUNTER.amount} を引くと ${COUNTER.after} になり、「結果 ≧ 0」が破れた。金額 > 0 は守っているので、呼び出し側の約束違反ではない。事前条件が弱すぎて、関数が約束を守れない呼び出しを許していた。`,
      set: {
        caller: {
          rows: { 残高: String(COUNTER.balance), 金額: String(COUNTER.amount) },
        },
        withdraw: { tone: "bad", rows: { 結果: String(COUNTER.after) } },
        post: { tone: "bad", rows: { 判定: "破れた" } },
        checker: { tone: "bad", rows: { 反例: describeCase(COUNTER) } },
      },
    },
    {
      id: "fix",
      kind: "fix",
      title: "事前条件を強める",
      actor: "pre",
      to: ["withdraw"],
      summary: `「金額 ≦ 残高」を足すと、${STRONG.checked} 通りすべてで事後条件が成り立つ`,
      explain: `事前条件に「金額 ≦ 残高」を足し、残高より多くは引けないと呼び出し側に約束させる。調べる組は ${STRONG.checked} 通りに減り、そのすべてで事後条件が成り立った。関数の中身は変えず、約束の書き方を直しただけで反例が消えた。`,
      set: {
        pre: { tone: "ok", rows: { 条件: "金額 > 0", 追加: "金額 ≦ 残高" } },
        caller: { rows: { 残高: null, 金額: null } },
        withdraw: { tone: "ok", rows: { 結果: null } },
        post: { tone: "ok", rows: { 判定: "成り立つ" } },
        checker: {
          tone: "ok",
          rows: {
            調べた: `${STRONG.checked} 通り`,
            反例: STRONG.counterexample ? "あり" : "なし",
          },
        },
      },
      simplified:
        "Dafny のような道具は、事前条件と事後条件を書くと、証明によってすべての入力で成り立つことを確かめる。ここでは残高と金額の範囲を 0〜5 に区切り、その中を総当たりしているだけなので、範囲の外は確かめていない。",
    },
  ],
  lab: {
    title: "範囲と事前条件を変える",
    hint: "範囲を広げると調べる組が増える。「金額 ≦ 残高」を「なし」にすると、残高を超えて引く反例が出る。",
    inputs: [
      { id: "maxBalance", label: "残高の上限（0〜9）", initial: String(MAX_BALANCE) },
      { id: "maxAmount", label: "金額の上限（0〜9）", initial: String(MAX_AMOUNT) },
      { id: "enough", label: "「金額 ≦ 残高」（あり / なし）", initial: "なし" },
    ],
    compute: (values): Field[] => {
      const maxBalance = parseMax(values.maxBalance, MAX_BALANCE);
      const maxAmount = parseMax(values.maxAmount, MAX_AMOUNT);
      const requireEnough = parseRequireEnough(values.enough);
      const result = checkWithdraw({ maxBalance, maxAmount, requireEnough });
      return [
        { label: "範囲", value: `残高 0〜${maxBalance}・金額 0〜${maxAmount}` },
        {
          label: "事前条件",
          value: requireEnough ? "金額 > 0 かつ 金額 ≦ 残高" : "金額 > 0",
        },
        { label: "調べた組", value: `${result.checked} 通り` },
        {
          label: "最初の反例",
          value: result.counterexample ? describeCase(result.counterexample) : "なし",
          tone: result.counterexample ? "bad" : "ok",
        },
      ];
    },
  },
};
