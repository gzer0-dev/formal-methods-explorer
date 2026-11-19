import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { displayName, displayNames } from "../labels";
import { check } from "../modelCheck";
import type { Model, TraceStep } from "../modelCheck";
import { ORDER_ACTIONS, orderModel, runOrder } from "../models";
import type { OrderState } from "../models";

const BUGGY = orderModel(true);
const BUGGY_CHECK = check(BUGGY);
const FIXED_CHECK = check(orderModel(false));
// テストがふだん試す流れ: 支払ってから発送して届ける。
const USUAL_FLOW = ["支払う", "発送する", "届ける"];
const USUAL_ON_SPEC = runOrder(USUAL_FLOW);
// 反例の手順（検査器が見つけた最短の並び）。trace[0] は初期状態。
const TRACE = BUGGY_CHECK.violation!;
const SHIPPED = TRACE.at(-1)!.state;
const TRACE_MOVES = TRACE.length - 1;

/** 決めた順にモデルの操作を当てる（テストの再現）。動けない操作に当たったらそこで止める。 */
function replay(model: Model<OrderState>, names: string[]): OrderState {
  let state = model.init;
  for (const name of names) {
    const action = model.actions.find((candidate) => candidate.name === name);
    if (!action || !action.enabled(state)) return state;
    state = action.next(state);
  }
  return state;
}

const USUAL_ON_BUGGY = replay(BUGGY, USUAL_FLOW);
const USUAL_ON_BUGGY_OK = BUGGY.invariant?.(USUAL_ON_BUGGY) ?? true;

function paidLabel(isPaid: boolean, language: Language): string {
  if (language === "ja") return isPaid ? "はい" : "いいえ";
  return isPaid ? "yes" : "no";
}

function describeTrace(trace: TraceStep<OrderState>[], language: Language): string {
  return trace
    .slice(1)
    .map((step) => {
      const action = displayName(step.action ?? "", language);
      const status = displayName(step.state.status, language);
      return language === "ja" ? `${action}（${status}）` : `${action} (${status})`;
    })
    .join(" → ");
}

function stepsText(count: number): string {
  return `${count} ${count === 1 ? "step" : "steps"}`;
}

// 「なし」（英語では no / none）だけが正しい仕様。それ以外は書き忘れありとして扱う。
function parseHasBug(text: string | undefined): boolean {
  const value = (text ?? "").trim();
  return !(value.includes("なし") || /^(no|none)\b/i.test(value));
}

export function invariantLesson(language: Language): Lesson {
  const t = translator(language);
  const name = (text: string) => displayName(text, language);
  const paid = (isPaid: boolean) => paidLabel(isPaid, language);
  const steps = (count: number) => t(`${count}手`, stepsText(count));
  const status = t("状態", "status");
  const paidKey = t("支払", "paid");
  const precondition = t("発送の前提", "ship requires");
  const verdict = t("判定", "verdict");
  const flowJa = USUAL_FLOW.join("→");
  const flowEn = displayNames(USUAL_FLOW, language);
  return {
    id: "invariant",
    category: "model",
    title: t("不変条件を書く", "Writing invariants"),
    subtitle: t(
      "注文はいつでも「支払ってから発送」か",
      'Is an order always "paid before shipped"?',
    ),
    summary: t(
      `注文の状態遷移に「発送済み・配達済みなら支払済み」という不変条件を書く。いつもの流れを試すテストは通るが、全部の状態（${BUGGY_CHECK.stateCount}個）をたどると、未払いのまま発送する${TRACE_MOVES}手の反例が見つかる。`,
      `Add the invariant "if shipped or delivered, then paid" to the order's state transitions. A test of the usual flow passes, but walking every state (${BUGGY_CHECK.stateCount} of them) finds a ${TRACE_MOVES}-step counterexample that ships an unpaid order.`,
    ),
    intro: [
      t(
        "不変条件（いつ見ても成り立っていてほしい条件）は、どの状態にいても破れてはいけない性質である。ここでは、状態と遷移で書いた注文の仕様に、支払いと発送の順についての不変条件を置く。",
        "An invariant (a condition that should hold whenever you look) is a property that must not break in any state. Here we add an invariant about the order of payment and shipping to the order spec written as states and transitions.",
      ),
      t(
        "テストは決めた流れを試すので、仕様の書き忘れがその流れの外にあると気づけない。不変条件を書いておけば、モデル検査器（あり得る状態を機械的に全部たどる道具）が全部の状態で確かめ、破れるなら反例（破れるまでの操作の手順）を返す。",
        "A test tries a fixed flow, so it cannot notice a gap in the spec that lies outside that flow. With an invariant written down, a model checker (a tool that mechanically walks every possible state) checks it in every state, and if it breaks, returns a counterexample (the actions leading to the break).",
      ),
      t(
        "図では、まず仕様のカードの「発送の前提」の欄と、テストのカードが合格になる場面を見る。そのあと、モデル検査器が注文のカードに不変条件を当てていき、どの操作の並びで破れるかに注目する。",
        'In the diagram, first look at the "ship requires" row on the spec card and the test card passing. Then watch the model checker apply the invariant to the order card, and see which sequence of actions breaks it.',
      ),
    ],
    facts: [
      {
        label: t("たどった状態", "States explored"),
        value: t(`${BUGGY_CHECK.stateCount}個`, `${BUGGY_CHECK.stateCount}`),
      },
      {
        label: t("不変条件を破る状態", "States breaking it"),
        value: t(`${BUGGY_CHECK.violationCount}個`, `${BUGGY_CHECK.violationCount}`),
        tone: "bad",
      },
      {
        label: t("最短の反例", "Shortest counterexample"),
        value: steps(TRACE_MOVES),
        tone: "bad",
      },
      {
        label: t("実物の道具", "Real tools"),
        value: t("TLA+ と TLC（INVARIANT）", "TLA+ and TLC (INVARIANT)"),
      },
    ],
    actors: [
      {
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: t("注文の状態と操作", "order states and actions"),
        icon: "spec",
        x: 14,
        y: 27,
        initial: {
          rows: {
            [t("操作", "actions")]: t(
              `${ORDER_ACTIONS.length}種類`,
              `${ORDER_ACTIONS.length}`,
            ),
          },
        },
      },
      {
        id: "order",
        label: t("注文", "Order"),
        sublabel: t("状態を1つ持つ", "holds one state"),
        icon: "state",
        x: 50,
        y: 27,
        initial: {
          rows: {
            [status]: name(BUGGY.init.status),
            [paidKey]: paid(BUGGY.init.isPaid),
          },
        },
      },
      {
        id: "invariant",
        label: t("不変条件", "Invariant"),
        sublabel: t("いつでも成り立つべき", "must always hold"),
        icon: "contract",
        x: 86,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "test",
        label: t("テスト", "Test"),
        sublabel: t("いつもの流れを試す", "tries the usual flow"),
        icon: "test",
        x: 30,
        y: 73,
      },
      {
        id: "checker",
        label: t("モデル検査器", "Model checker"),
        sublabel: t("全部の状態をたどる", "walks every state"),
        icon: "checker",
        x: 70,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "spec", to: "order" },
      { from: "invariant", to: "order" },
      { from: "test", to: "order" },
      { from: "checker", to: "order" },
    ],
    steps: [
      {
        id: "write-spec",
        kind: "spec",
        title: t("状態と操作を書く", "Write states and actions"),
        actor: "spec",
        to: ["order"],
        summary: t(
          `注文の状態と${ORDER_ACTIONS.length}つの操作を書く。「発送する」の前提条件を書き忘れている`,
          `Write the order states and ${ORDER_ACTIONS.length} actions, but forget the precondition of "${name("発送する")}"`,
        ),
        explain: t(
          "注文は未払いから始まり、支払う・発送する・届ける・取り消す・返金するで状態が変わる。ところが「発送する」の前提条件（支払済みであること）を書き忘れ、未払いからも発送できる仕様になっている。",
          'An order starts unpaid, and pay, ship, deliver, cancel and refund change its state. But the precondition of "ship" (that it is paid) was forgotten, so the spec lets an unpaid order ship.',
        ),
        set: { spec: { rows: { [precondition]: t("書き忘れ", "forgotten") } } },
        detail: [
          {
            title: t("正しい仕様の操作", "Actions in the correct spec"),
            fields: ORDER_ACTIONS.map((transition) => ({
              label: name(transition.name),
              value: `${name(transition.from)} → ${name(transition.to)}`,
            })),
          },
        ],
      },
      {
        id: "write-invariant",
        kind: "spec",
        title: t("不変条件を決める", "Choose the invariant"),
        actor: "invariant",
        to: ["order"],
        summary: t(
          "「発送済み・配達済みなら支払済み」を不変条件にする",
          'Make "if shipped or delivered, then paid" the invariant',
        ),
        explain: t(
          "不変条件（invariant）は、どの状態にいても成り立つべき性質のこと。悪いことが決して起きないことを言うので、安全性（safety）とも呼ぶ。ここでは「発送済みか配達済みなら、支払済み」とする。",
          'An invariant is a property that must hold in every state. Because it says something bad never happens, it is also called a safety property. Here it is "if shipped or delivered, then paid".',
        ),
        set: {
          invariant: {
            isHidden: false,
            rows: {
              [t("性質", "property")]: t(
                "発送済み・配達済みなら支払済み",
                "shipped/delivered ⇒ paid",
              ),
            },
          },
        },
      },
      {
        id: "run-test",
        kind: "test",
        title: t("いつもの流れを試す", "Try the usual flow"),
        actor: "test",
        to: ["order"],
        summary: t(
          `「${flowJa}」を流すと${USUAL_ON_BUGGY.status}になり、テストは通る`,
          `Running "${flowEn}" ends at ${name(USUAL_ON_BUGGY.status)}, and the test passes`,
        ),
        explain: t(
          `テストは「${flowJa}」の普通の流れを試す。この流れでは必ず支払ってから発送するので、不変条件は破れず、書き忘れに気づかない。正しい仕様で流しても同じ${USUAL_ON_SPEC.status}になる。`,
          `The test tries the normal flow "${flowEn}". This flow always pays before shipping, so the invariant does not break and the gap goes unnoticed. Running it on the correct spec ends at the same ${name(USUAL_ON_SPEC.status)}.`,
        ),
        set: {
          order: {
            rows: {
              [status]: name(USUAL_ON_BUGGY.status),
              [paidKey]: paid(USUAL_ON_BUGGY.isPaid),
            },
          },
          test: {
            tone: USUAL_ON_BUGGY_OK ? "ok" : "bad",
            rows: {
              [t("結果", "result")]: USUAL_ON_BUGGY_OK
                ? t("合格", "pass")
                : t("不合格", "fail"),
            },
          },
        },
        detail: [
          {
            title: t("テストで当てた操作", "Actions the test applied"),
            fields: USUAL_FLOW.map((action, i) => ({
              label: t(`${i + 1}手目`, `Step ${i + 1}`),
              value: name(action),
            })),
          },
        ],
      },
      {
        id: "explore",
        kind: "explore",
        title: t("全部の状態をたどる", "Walk every state"),
        actor: "checker",
        to: ["order"],
        summary: t(
          `未払いから行ける状態を${BUGGY_CHECK.stateCount}個たどり、それぞれで不変条件を調べる`,
          `Walks the ${BUGGY_CHECK.stateCount} states reachable from unpaid and checks the invariant in each`,
        ),
        explain: t(
          `モデル検査器は初期状態から行ける状態を幅優先で全部たどり、1つずつ不変条件を当てる。この仕様では${BUGGY_CHECK.stateCount}個の状態があり、そのうち${BUGGY_CHECK.violationCount}個で不変条件が破れていた。`,
          `The model checker walks every state reachable from the start, breadth-first, and applies the invariant to each one. This spec has ${BUGGY_CHECK.stateCount} states, and the invariant is broken in ${BUGGY_CHECK.violationCount} of them.`,
        ),
        set: {
          order: {
            rows: {
              [status]: name(BUGGY.init.status),
              [paidKey]: paid(BUGGY.init.isPaid),
            },
          },
          checker: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("状態", "states")]: t(
                `${BUGGY_CHECK.stateCount}個`,
                `${BUGGY_CHECK.stateCount}`,
              ),
              [t("遷移", "transitions")]: t(
                `${BUGGY_CHECK.transitionCount}本`,
                `${BUGGY_CHECK.transitionCount}`,
              ),
            },
          },
        },
      },
      {
        id: "found",
        kind: "found",
        title: t("未払いのまま発送", "Shipped while unpaid"),
        actor: "checker",
        to: ["order"],
        summary: t(
          `最短の反例は「${describeTrace(TRACE, language)}」の${TRACE_MOVES}手`,
          `The shortest counterexample is "${describeTrace(TRACE, language)}", ${stepsText(TRACE_MOVES)}`,
        ),
        explain: t(
          `幅優先なので、いちばん短い反例が先に見つかる。未払いの注文にいきなり「${TRACE[1]!.action}」を当てると${SHIPPED.status}になり、支払が「${paid(SHIPPED.isPaid)}」のまま。テストが試さなかった順を、検査器は漏らさず調べた。`,
          `Because the search is breadth-first, the shortest counterexample is found first. Applying "${name(TRACE[1]!.action!)}" straight to an unpaid order makes it ${name(SHIPPED.status)} while paid stays "${paid(SHIPPED.isPaid)}". The checker covered the order the test never tried.`,
        ),
        set: {
          order: {
            tone: "bad",
            rows: { [status]: name(SHIPPED.status), [paidKey]: paid(SHIPPED.isPaid) },
          },
          invariant: { tone: "bad", rows: { [verdict]: t("破れた", "broken") } },
          checker: {
            tone: "bad",
            rows: {
              [t("反例", "counterexample")]: t(
                `${TRACE_MOVES}手で発見`,
                `found in ${stepsText(TRACE_MOVES)}`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("検査器が見つけた反例", "Counterexample the checker found"),
            fields: TRACE.map((step, i) => ({
              label:
                i === 0 ? t("初期状態", "Initial state") : t(`${i}手目`, `Step ${i}`),
              value: step.action ? name(step.action) : t("（はじめ）", "(start)"),
              note: t(
                `${step.state.status}・支払${paid(step.state.isPaid)}`,
                `${name(step.state.status)}, paid: ${paid(step.state.isPaid)}`,
              ),
            })),
          },
        ],
      },
      {
        id: "fix",
        kind: "fix",
        title: t("前提条件を足す", "Add the precondition"),
        actor: "spec",
        to: ["order"],
        summary: t(
          `「発送するのは支払済みのときだけ」と書くと、${FIXED_CHECK.stateCount}状態すべてで不変条件が成り立つ`,
          `Writing "ship only when paid" makes the invariant hold in all ${FIXED_CHECK.stateCount} states`,
        ),
        explain: t(
          `「発送する」に前提条件「支払済みのときだけ」を足して、もう一度全部たどる。状態は${FIXED_CHECK.stateCount}個に減り、どの状態でも不変条件が成り立つ。反例は見つからない。`,
          `Add the precondition "only when paid" to "ship" and walk everything again. The states drop to ${FIXED_CHECK.stateCount}, and the invariant holds in every one. No counterexample is found.`,
        ),
        set: {
          spec: { tone: "ok", rows: { [precondition]: name("支払済み") } },
          order: {
            tone: "ok",
            rows: {
              [status]: name(BUGGY.init.status),
              [paidKey]: paid(BUGGY.init.isPaid),
            },
          },
          invariant: { tone: "ok", rows: { [verdict]: t("成り立つ", "holds") } },
          checker: {
            tone: "ok",
            rows: {
              [t("状態", "states")]: t(
                `${FIXED_CHECK.stateCount}個`,
                `${FIXED_CHECK.stateCount}`,
              ),
              [t("遷移", "transitions")]: t(
                `${FIXED_CHECK.transitionCount}本`,
                `${FIXED_CHECK.transitionCount}`,
              ),
              [t("反例", "counterexample")]: FIXED_CHECK.violation
                ? t("あり", "yes")
                : t("なし", "none"),
            },
          },
          test: { tone: "idle" },
        },
        simplified: t(
          "実物の TLA+ では、不変条件を式で書いて設定ファイルの INVARIANT に挙げ、TLC が到達できる各状態で調べる。ここでは注文の仕様を TypeScript の小さなモデルにし、自作の検査器で同じことをしている。調べているのは設計（モデル）で、実際の注文システムのコードではない。",
          "In real TLA+ you write the invariant as a formula, list it under INVARIANT in the config file, and TLC checks it in each reachable state. Here the order spec is a small TypeScript model and a homemade checker does the same. What is checked is the design (the model), not the code of a real order system.",
        ),
      },
    ],
    lab: {
      title: t("前提条件の書き忘れを切り替える", "Toggle the missing precondition"),
      hint: t(
        "「あり」は発送の前提条件を書き忘れた仕様、「なし」は正しい仕様。書き忘れがあると、たどる状態が増え、反例の手順が出る。",
        '"yes" is the spec with the ship precondition forgotten, "no" is the correct spec. With the gap, more states are explored and a counterexample appears.',
      ),
      inputs: [
        {
          id: "bug",
          label: t(
            "前提条件の書き忘れ（あり / なし）",
            "Precondition missing (yes / no)",
          ),
          initial: t("あり", "yes"),
        },
      ],
      compute: (values): Field[] => {
        const hasBug = parseHasBug(values.bug);
        const result = check(orderModel(hasBug));
        return [
          {
            label: t("仕様", "Spec"),
            value: hasBug
              ? t("書き忘れあり", "precondition missing")
              : t("正しい仕様", "correct spec"),
          },
          {
            label: t("たどった状態", "States explored"),
            value: t(`${result.stateCount}個`, `${result.stateCount}`),
          },
          {
            label: t("不変条件を破る状態", "States breaking it"),
            value: t(`${result.violationCount}個`, `${result.violationCount}`),
            tone: result.violationCount > 0 ? "bad" : "ok",
          },
          {
            label: t("反例の手順", "Counterexample"),
            value: result.violation
              ? describeTrace(result.violation, language)
              : t("なし", "none"),
            tone: result.violation ? "bad" : "ok",
          },
        ];
      },
    },
  };
}
