import type { Field, Lesson } from "../../core/types";
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

function paidLabel(isPaid: boolean): string {
  return isPaid ? "はい" : "いいえ";
}

function describeTrace(trace: TraceStep<OrderState>[]): string {
  return trace
    .slice(1)
    .map((step) => `${step.action}（${step.state.status}）`)
    .join(" → ");
}

function parseHasBug(text: string | undefined): boolean {
  return !(text ?? "").includes("なし");
}

export const invariantLesson: Lesson = {
  id: "invariant",
  category: "model",
  title: "不変条件を書く",
  subtitle: "注文はいつでも「支払ってから発送」か",
  summary: `注文の状態遷移に「発送済み・配達済みなら支払済み」という不変条件を書く。いつもの流れを試すテストは通るが、全部の状態（${BUGGY_CHECK.stateCount} 個）をたどると、未払いのまま発送する ${TRACE.length - 1} 手の反例が見つかる。`,
  facts: [
    { label: "たどった状態", value: `${BUGGY_CHECK.stateCount} 個` },
    {
      label: "不変条件を破る状態",
      value: `${BUGGY_CHECK.violationCount} 個`,
      tone: "bad",
    },
    { label: "最短の反例", value: `${TRACE.length - 1} 手`, tone: "bad" },
    { label: "実物の道具", value: "TLA+ と TLC（INVARIANT）" },
  ],
  actors: [
    {
      id: "spec",
      label: "仕様",
      sublabel: "注文の状態と操作",
      icon: "spec",
      x: 14,
      y: 27,
      initial: { rows: { 操作: `${ORDER_ACTIONS.length} 種類` } },
    },
    {
      id: "order",
      label: "注文",
      sublabel: "状態を1つ持つ",
      icon: "state",
      x: 50,
      y: 27,
      initial: {
        rows: { 状態: BUGGY.init.status, 支払: paidLabel(BUGGY.init.isPaid) },
      },
    },
    {
      id: "invariant",
      label: "不変条件",
      sublabel: "いつでも成り立つべき",
      icon: "contract",
      x: 86,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "test",
      label: "テスト",
      sublabel: "いつもの流れを試す",
      icon: "test",
      x: 30,
      y: 73,
    },
    {
      id: "checker",
      label: "モデル検査器",
      sublabel: "全部の状態をたどる",
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
      title: "状態と操作を書く",
      actor: "spec",
      to: ["order"],
      summary: `注文の状態と ${ORDER_ACTIONS.length} つの操作を書く。「発送する」の前提条件を書き忘れている`,
      explain:
        "注文は未払いから始まり、支払う・発送する・届ける・取り消す・返金するで状態が変わる。ところが「発送する」の前提条件（支払済みであること）を書き忘れ、未払いからも発送できる仕様になっている。",
      set: { spec: { rows: { 発送の前提: "書き忘れ" } } },
      detail: [
        {
          title: "正しい仕様の操作",
          fields: ORDER_ACTIONS.map((transition) => ({
            label: transition.name,
            value: `${transition.from} → ${transition.to}`,
          })),
        },
      ],
    },
    {
      id: "write-invariant",
      kind: "spec",
      title: "不変条件を決める",
      actor: "invariant",
      to: ["order"],
      summary: "「発送済み・配達済みなら支払済み」を不変条件にする",
      explain:
        "不変条件（invariant）は、どの状態にいても成り立つべき性質のこと。悪いことが決して起きないことを言うので、安全性（safety）とも呼ぶ。ここでは「発送済みか配達済みなら、支払済み」とする。",
      set: {
        invariant: {
          isHidden: false,
          rows: { 性質: "発送済み・配達済みなら支払済み" },
        },
      },
    },
    {
      id: "run-test",
      kind: "test",
      title: "いつもの流れを試す",
      actor: "test",
      to: ["order"],
      summary: `「${USUAL_FLOW.join("→")}」を流すと ${USUAL_ON_BUGGY.status} になり、テストは通る`,
      explain: `テストは「${USUAL_FLOW.join("→")}」の普通の流れを試す。この流れでは必ず支払ってから発送するので、不変条件は破れず、書き忘れに気づかない。正しい仕様で流しても同じ ${USUAL_ON_SPEC.status} になる。`,
      set: {
        order: {
          rows: { 状態: USUAL_ON_BUGGY.status, 支払: paidLabel(USUAL_ON_BUGGY.isPaid) },
        },
        test: {
          tone: USUAL_ON_BUGGY_OK ? "ok" : "bad",
          rows: { 結果: USUAL_ON_BUGGY_OK ? "合格" : "不合格" },
        },
      },
      detail: [
        {
          title: "テストで当てた操作",
          fields: USUAL_FLOW.map((name, i) => ({
            label: `${i + 1} 手目`,
            value: name,
          })),
        },
      ],
    },
    {
      id: "explore",
      kind: "explore",
      title: "全部の状態をたどる",
      actor: "checker",
      to: ["order"],
      summary: `未払いから行ける状態を ${BUGGY_CHECK.stateCount} 個たどり、それぞれで不変条件を調べる`,
      explain: `モデル検査器は初期状態から行ける状態を幅優先で全部たどり、1つずつ不変条件を当てる。この仕様では ${BUGGY_CHECK.stateCount} 個の状態があり、そのうち ${BUGGY_CHECK.violationCount} 個で不変条件が破れていた。`,
      set: {
        order: {
          rows: { 状態: BUGGY.init.status, 支払: paidLabel(BUGGY.init.isPaid) },
        },
        checker: {
          isHidden: false,
          tone: "wait",
          rows: {
            状態: `${BUGGY_CHECK.stateCount} 個`,
            遷移: `${BUGGY_CHECK.transitionCount} 本`,
          },
        },
      },
    },
    {
      id: "found",
      kind: "found",
      title: "未払いのまま発送",
      actor: "checker",
      to: ["order"],
      summary: `最短の反例は「${describeTrace(TRACE)}」の ${TRACE.length - 1} 手`,
      explain: `幅優先なので、いちばん短い反例が先に見つかる。未払いの注文にいきなり「${TRACE[1]!.action}」を当てると ${SHIPPED.status} になり、支払が「${paidLabel(SHIPPED.isPaid)}」のまま。テストが試さなかった順を、検査器は漏らさず調べた。`,
      set: {
        order: {
          tone: "bad",
          rows: { 状態: SHIPPED.status, 支払: paidLabel(SHIPPED.isPaid) },
        },
        invariant: { tone: "bad", rows: { 判定: "破れた" } },
        checker: { tone: "bad", rows: { 反例: `${TRACE.length - 1} 手で発見` } },
      },
      detail: [
        {
          title: "検査器が見つけた反例",
          fields: TRACE.map((step, i) => ({
            label: i === 0 ? "初期状態" : `${i} 手目`,
            value: step.action ?? "（はじめ）",
            note: `${step.state.status}・支払 ${paidLabel(step.state.isPaid)}`,
          })),
        },
      ],
    },
    {
      id: "fix",
      kind: "fix",
      title: "前提条件を足す",
      actor: "spec",
      to: ["order"],
      summary: `「発送するのは支払済みのときだけ」と書くと、${FIXED_CHECK.stateCount} 状態すべてで不変条件が成り立つ`,
      explain: `「発送する」に前提条件「支払済みのときだけ」を足して、もう一度全部たどる。状態は ${FIXED_CHECK.stateCount} 個に減り、どの状態でも不変条件が成り立つ。反例は見つからない。`,
      set: {
        spec: { tone: "ok", rows: { 発送の前提: "支払済み" } },
        order: {
          tone: "ok",
          rows: { 状態: BUGGY.init.status, 支払: paidLabel(BUGGY.init.isPaid) },
        },
        invariant: { tone: "ok", rows: { 判定: "成り立つ" } },
        checker: {
          tone: "ok",
          rows: {
            状態: `${FIXED_CHECK.stateCount} 個`,
            遷移: `${FIXED_CHECK.transitionCount} 本`,
            反例: FIXED_CHECK.violation ? "あり" : "なし",
          },
        },
        test: { tone: "idle" },
      },
      simplified:
        "実物の TLA+ では、不変条件を式で書いて設定ファイルの INVARIANT に挙げ、TLC が到達できる各状態で調べる。ここでは注文の仕様を TypeScript の小さなモデルにし、自作の検査器で同じことをしている。調べているのは設計（モデル）で、実際の注文システムのコードではない。",
    },
  ],
  lab: {
    title: "前提条件の書き忘れを切り替える",
    hint: "「あり」は発送の前提条件を書き忘れた仕様、「なし」は正しい仕様。書き忘れがあると、たどる状態が増え、反例の手順が出る。",
    inputs: [
      { id: "bug", label: "前提条件の書き忘れ（あり / なし）", initial: "あり" },
    ],
    compute: (values): Field[] => {
      const hasBug = parseHasBug(values.bug);
      const result = check(orderModel(hasBug));
      return [
        { label: "仕様", value: hasBug ? "書き忘れあり" : "正しい仕様" },
        { label: "たどった状態", value: `${result.stateCount} 個` },
        {
          label: "不変条件を破る状態",
          value: `${result.violationCount} 個`,
          tone: result.violationCount > 0 ? "bad" : "ok",
        },
        {
          label: "反例の手順",
          value: result.violation ? describeTrace(result.violation) : "なし",
          tone: result.violation ? "bad" : "ok",
        },
      ];
    },
  },
};
