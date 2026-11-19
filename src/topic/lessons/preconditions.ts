import { translator, type Language } from "../../core/i18n";
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

function describeCase(found: WithdrawCase, language: Language): string {
  if (language === "ja")
    return `残高${found.balance}・金額${found.amount} → 結果${found.after}`;
  return `balance ${found.balance}, amount ${found.amount} → result ${found.after}`;
}

function rangeText(maxBalance: number, maxAmount: number, language: Language): string {
  if (language === "ja") return `残高0〜${maxBalance}・金額0〜${maxAmount}`;
  return `balance 0-${maxBalance}, amount 0-${maxAmount}`;
}

function parseMax(text: string | undefined, fallback: number): number {
  const value = Number.parseInt(text ?? "", 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 9) : fallback;
}

// 「あり」（英語では yes）のときだけ「金額 ≦ 残高」を足す。
function parseRequireEnough(text: string | undefined): boolean {
  const value = text ?? "";
  return value.includes("あり") || /yes/i.test(value);
}

export function preconditionsLesson(language: Language): Lesson {
  const t = translator(language);
  const describe = (found: WithdrawCase) => describeCase(found, language);
  const range = (maxBalance: number, maxAmount: number) =>
    rangeText(maxBalance, maxAmount, language);
  const cases = (n: number) => t(`${n}通り`, `${n}`);
  const balanceKey = t("残高", "balance");
  const amountKey = t("金額", "amount");
  const resultKey = t("結果", "result");
  const conditionKey = t("条件", "condition");
  const verdictKey = t("判定", "verdict");
  const checkedKey = t("調べた", "checked");
  const amountPositive = t("金額 > 0", "amount > 0");
  const amountEnough = t("金額 ≦ 残高", "amount ≤ balance");
  return {
    id: "preconditions",
    category: "spec",
    title: t("事前条件と事後条件", "Pre- and postconditions"),
    subtitle: t(
      "引き出しの関数に契約を書く",
      "Write a contract for a withdraw function",
    ),
    summary: t(
      `残高から金額を引く関数に、呼ぶ前の約束（事前条件）と呼んだ後の約束（事後条件）を書く。「金額 > 0」だけでは${WEAK.checked}通り中に反例があり、「金額 ≦ 残高」を足すと${STRONG.checked}通りすべてで成り立つ。`,
      `Write a promise before the call (precondition) and a promise after it (postcondition) for a function that subtracts an amount from a balance. With only "amount > 0" there is a counterexample among the ${WEAK.checked} cases; adding "amount ≤ balance" makes it hold in all ${STRONG.checked}.`,
    ),
    intro: [
      t(
        "事前条件は関数を呼ぶ側が守る約束、事後条件は呼ばれた関数が守る約束である。両方を組で書くと、関数ごとに「どんな値で呼んでよく、何が返るか」がはっきりする。",
        "A precondition is a promise the caller keeps; a postcondition is a promise the called function keeps. Writing them as a pair makes clear, for each function, what values it may be called with and what it returns.",
      ),
      t(
        "ここからは状態の並びではなく、ひとつの関数の正しさを確かめる。単体テストは選んだ数例を試すだけだが、約束を書いておけば、範囲内の入力を全部当てて、約束が足りない所を見つけられる。",
        "From here on we check the correctness of a single function rather than sequences of states. A unit test tries only a few chosen examples, but once the promises are written down you can apply every input in a range and find where the promises fall short.",
      ),
      t(
        "図では、呼び出し側から withdraw 関数へ値が渡り、事後条件のカードで結果が確かめられる流れを追う。反例が出たとき、責任が呼び出し側と関数のどちらにあるかを考え、事前条件のカードがどう変わるかに注目する。",
        "In the diagram, follow the values from the caller to the withdraw function and the result being checked on the postcondition card. When a counterexample appears, think about whether the caller or the function is responsible, and watch how the precondition card changes.",
      ),
    ],
    facts: [
      {
        label: t("調べた範囲", "Range checked"),
        value: range(MAX_BALANCE, MAX_AMOUNT),
      },
      {
        label: t("最初の反例", "First counterexample"),
        value: describe(COUNTER),
        tone: "bad",
      },
      {
        label: t("直した後", "After the fix"),
        value: t(`${STRONG.checked}通りすべて成立`, `holds in all ${STRONG.checked}`),
        tone: "ok",
      },
      {
        label: t("実物の道具", "Real tools"),
        value: t("Dafny など", "Dafny and others"),
      },
    ],
    actors: [
      {
        id: "caller",
        label: t("呼び出し側", "Caller"),
        sublabel: t("残高と金額を渡す", "passes balance and amount"),
        icon: "person",
        x: 14,
        y: 27,
      },
      {
        id: "withdraw",
        label: t("withdraw 関数", "withdraw function"),
        sublabel: t("残高 − 金額を返す", "returns balance − amount"),
        icon: "contract",
        x: 50,
        y: 27,
      },
      {
        id: "post",
        label: t("事後条件", "Postcondition"),
        sublabel: t("呼んだ後の約束", "promise after the call"),
        icon: "spec",
        x: 86,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "pre",
        label: t("事前条件", "Precondition"),
        sublabel: t("呼ぶ前の約束", "promise before the call"),
        icon: "spec",
        x: 30,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("範囲内を総当たり", "tries every case in range"),
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
        title: t("関数を呼ぶ", "Call the function"),
        actor: "caller",
        to: ["withdraw"],
        summary: t(
          `残高${EXAMPLE_BALANCE}から${EXAMPLE_AMOUNT}を引くと${EXAMPLE_AFTER}が返る`,
          `Withdrawing ${EXAMPLE_AMOUNT} from a balance of ${EXAMPLE_BALANCE} returns ${EXAMPLE_AFTER}`,
        ),
        explain: t(
          `withdraw は残高から金額を引いた値を返すだけの関数。残高${EXAMPLE_BALANCE}から${EXAMPLE_AMOUNT}を引けば${EXAMPLE_AFTER}になる。このままでは、どんな値で呼んでよいのか、何が返ると約束しているのかが書かれていない。`,
          `withdraw is a function that just returns the balance minus the amount. Taking ${EXAMPLE_AMOUNT} from a balance of ${EXAMPLE_BALANCE} gives ${EXAMPLE_AFTER}. As it stands, nothing says what values it may be called with or what it promises to return.`,
        ),
        set: {
          caller: {
            rows: {
              [balanceKey]: String(EXAMPLE_BALANCE),
              [amountKey]: String(EXAMPLE_AMOUNT),
            },
          },
          withdraw: { rows: { [resultKey]: String(EXAMPLE_AFTER) } },
        },
      },
      {
        id: "write-pre",
        kind: "spec",
        title: t("事前条件を書く", "Write the precondition"),
        actor: "pre",
        to: ["withdraw"],
        summary: t(
          "呼び出し側が守る約束として「金額 > 0」を書く",
          'Write "amount > 0" as the promise the caller keeps',
        ),
        explain: t(
          "事前条件（precondition）は、呼び出し側が守るべき約束。ここでは「金額 > 0」だけを書いた。このように関数ごとに約束を書いて責任を分ける考え方を、契約による設計（Design by Contract）と呼ぶ。",
          'A precondition is the promise the caller must keep. Here only "amount > 0" is written. Writing promises per function to split responsibility like this is called Design by Contract.',
        ),
        set: { pre: { isHidden: false, rows: { [conditionKey]: amountPositive } } },
      },
      {
        id: "write-post",
        kind: "spec",
        title: t("事後条件を書く", "Write the postcondition"),
        actor: "post",
        summary: t(
          "関数が守る約束として「結果 ≧ 0、かつ 結果 = 残高 − 金額」を書く",
          'Write "result ≥ 0 and result = balance − amount" as the promise the function keeps',
        ),
        explain: t(
          "事後条件（postcondition）は、事前条件が守られたときに関数が守る約束。「残高がマイナスにならず、ちょうど金額分だけ減る」を書いた。事前条件を満たす呼び出しなら、必ずこれが成り立つはずだ。",
          'A postcondition is the promise the function keeps when the precondition was kept. We wrote "the balance never goes negative and drops by exactly the amount". For any call that meets the precondition, this should always hold.',
        ),
        set: {
          post: {
            isHidden: false,
            rows: {
              [conditionKey]: t("結果 ≧ 0", "result ≥ 0"),
              [t("計算", "value")]: t(
                "結果 = 残高 − 金額",
                "result = balance − amount",
              ),
            },
          },
        },
      },
      {
        id: "explore",
        kind: "explore",
        title: t("範囲内を総当たり", "Try every case in range"),
        actor: "checker",
        to: ["withdraw"],
        summary: t(
          `残高0〜${MAX_BALANCE}・金額0〜${MAX_AMOUNT}のうち事前条件を満たす${WEAK.checked}通りで事後条件を調べる`,
          `Check the postcondition on the ${WEAK.checked} cases in ${range(MAX_BALANCE, MAX_AMOUNT)} that meet the precondition`,
        ),
        explain: t(
          `検査器は、残高0〜${MAX_BALANCE}と金額0〜${MAX_AMOUNT}の組を全部作り、事前条件を満たす${WEAK.checked}通りだけで関数を呼んで事後条件を確かめる。事前条件を破る呼び出しは、関数の責任ではないので調べない。`,
          `The checker builds every pair of balance 0-${MAX_BALANCE} and amount 0-${MAX_AMOUNT}, calls the function only on the ${WEAK.checked} that meet the precondition, and checks the postcondition. Calls that break the precondition are not the function's responsibility, so they are not checked.`,
        ),
        set: {
          caller: { rows: { [balanceKey]: null, [amountKey]: null } },
          withdraw: { rows: { [resultKey]: null } },
          checker: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("範囲", "range")]: range(MAX_BALANCE, MAX_AMOUNT),
              [checkedKey]: cases(WEAK.checked),
            },
          },
        },
      },
      {
        id: "found",
        kind: "found",
        title: t(
          `残高${COUNTER.balance}から${COUNTER.amount}を引く`,
          `Withdraw ${COUNTER.amount} from ${COUNTER.balance}`,
        ),
        actor: "checker",
        to: ["withdraw"],
        summary: t(
          `最初の反例: ${describe(COUNTER)}`,
          `First counterexample: ${describe(COUNTER)}`,
        ),
        explain: t(
          `残高${COUNTER.balance}から${COUNTER.amount}を引くと${COUNTER.after}になり、「結果 ≧ 0」が破れた。「金額 > 0」は守っているので、呼び出し側の約束違反ではない。事前条件が弱すぎて、関数が約束を守れない呼び出しを許していた。`,
          `Taking ${COUNTER.amount} from a balance of ${COUNTER.balance} gives ${COUNTER.after}, breaking "result ≥ 0". "amount > 0" was kept, so the caller did not break its promise. The precondition was too weak and allowed a call in which the function cannot keep its promise.`,
        ),
        set: {
          caller: {
            rows: {
              [balanceKey]: String(COUNTER.balance),
              [amountKey]: String(COUNTER.amount),
            },
          },
          withdraw: { tone: "bad", rows: { [resultKey]: String(COUNTER.after) } },
          post: { tone: "bad", rows: { [verdictKey]: t("破れた", "broken") } },
          checker: {
            tone: "bad",
            rows: { [t("反例", "counterexample")]: describe(COUNTER) },
          },
        },
      },
      {
        id: "fix",
        kind: "fix",
        title: t("事前条件を強める", "Strengthen the precondition"),
        actor: "pre",
        to: ["withdraw"],
        summary: t(
          `「金額 ≦ 残高」を足すと、${STRONG.checked}通りすべてで事後条件が成り立つ`,
          `Adding "amount ≤ balance" makes the postcondition hold in all ${STRONG.checked} cases`,
        ),
        explain: t(
          `事前条件に「金額 ≦ 残高」を足し、残高より多くは引けないと呼び出し側に約束させる。調べる組は${STRONG.checked}通りに減り、そのすべてで事後条件が成り立った。関数の中身は変えず、約束の書き方を直しただけで反例が消えた。`,
          `Add "amount ≤ balance" to the precondition, making the caller promise not to withdraw more than the balance. The cases to check drop to ${STRONG.checked}, and the postcondition holds in all of them. The function body did not change; fixing how the promise is written removed the counterexample.`,
        ),
        set: {
          pre: {
            tone: "ok",
            rows: {
              [conditionKey]: amountPositive,
              [t("追加", "added")]: amountEnough,
            },
          },
          caller: { rows: { [balanceKey]: null, [amountKey]: null } },
          withdraw: { tone: "ok", rows: { [resultKey]: null } },
          post: { tone: "ok", rows: { [verdictKey]: t("成り立つ", "holds") } },
          checker: {
            tone: "ok",
            rows: {
              [checkedKey]: cases(STRONG.checked),
              [t("反例", "counterexample")]: STRONG.counterexample
                ? t("あり", "yes")
                : t("なし", "none"),
            },
          },
        },
        simplified: t(
          "Dafny のような道具は、事前条件と事後条件を書くと、証明によってすべての入力で成り立つことを確かめる。ここでは残高と金額の範囲を0〜5に区切り、その中を総当たりしているだけなので、範囲の外は確かめていない。",
          "Tools like Dafny take the pre- and postconditions and confirm by proof that they hold for every input. Here the balance and amount are limited to 0-5 and every case in that range is tried, so nothing outside the range is checked.",
        ),
      },
    ],
    lab: {
      title: t("範囲と事前条件を変える", "Change the range and precondition"),
      hint: t(
        "範囲を広げると調べる組が増える。「金額 ≦ 残高」を「なし」にすると、残高を超えて引く反例が出る。",
        'A wider range means more cases to check. Setting "amount ≤ balance" to "no" brings back the counterexample that withdraws more than the balance.',
      ),
      inputs: [
        {
          id: "maxBalance",
          label: t("残高の上限（0〜9）", "Max balance (0-9)"),
          initial: String(MAX_BALANCE),
        },
        {
          id: "maxAmount",
          label: t("金額の上限（0〜9）", "Max amount (0-9)"),
          initial: String(MAX_AMOUNT),
        },
        {
          id: "enough",
          label: t("「金額 ≦ 残高」（あり / なし）", '"amount ≤ balance" (yes / no)'),
          initial: t("なし", "no"),
        },
      ],
      compute: (values): Field[] => {
        const maxBalance = parseMax(values.maxBalance, MAX_BALANCE);
        const maxAmount = parseMax(values.maxAmount, MAX_AMOUNT);
        const requireEnough = parseRequireEnough(values.enough);
        const result = checkWithdraw({ maxBalance, maxAmount, requireEnough });
        return [
          { label: t("範囲", "Range"), value: range(maxBalance, maxAmount) },
          {
            label: t("事前条件", "Precondition"),
            value: requireEnough
              ? t("金額 > 0かつ 金額 ≦ 残高", "amount > 0 and amount ≤ balance")
              : amountPositive,
          },
          { label: t("調べた組", "Cases checked"), value: cases(result.checked) },
          {
            label: t("最初の反例", "First counterexample"),
            value: result.counterexample
              ? describe(result.counterexample)
              : t("なし", "none"),
            tone: result.counterexample ? "bad" : "ok",
          },
        ];
      },
    },
  };
}
