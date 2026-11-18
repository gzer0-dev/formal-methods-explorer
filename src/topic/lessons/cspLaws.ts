import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import {
  checkLaw,
  ext,
  type Failure,
  failuresRefines,
  int,
  type LawCheck,
  moves,
  par,
  pre,
  type Proc,
  STOP,
} from "../csp";

// 法則の両辺に使う小さなプロセス（csp.test.ts と同じ組）。
const P: Proc = pre("p", STOP);
const Q: Proc = pre("q", STOP);

interface LawPair {
  id: string;
  name: string;
  left: Proc;
  right: Proc;
  leftText: string;
  rightText: string;
}

const PAIRS: LawPair[] = [
  {
    id: "1",
    name: "P □ STOP = P",
    left: ext(P, STOP),
    right: P,
    leftText: "P □ STOP",
    rightText: "P",
  },
  {
    id: "2",
    name: "P □ Q = Q □ P",
    left: ext(P, Q),
    right: ext(Q, P),
    leftText: "P □ Q",
    rightText: "Q □ P",
  },
  {
    id: "3",
    name: "(a → P) □ (a → Q) = a → (P ⊓ Q)",
    left: ext(pre("a", P), pre("a", Q)),
    right: pre("a", int(P, Q)),
    leftText: "(a → P) □ (a → Q)",
    rightText: "a → (P ⊓ Q)",
  },
  {
    id: "4",
    name: "a → (P □ Q) と (a → P) □ (a → Q)",
    left: pre("a", ext(P, Q)),
    right: ext(pre("a", P), pre("a", Q)),
    leftText: "a → (P □ Q)",
    rightText: "(a → P) □ (a → Q)",
  },
];

const [STOP_LAW, COMMUTE_LAW, SAME_EVENT_LAW, NOT_LAW] = PAIRS as [
  LawPair,
  LawPair,
  LawPair,
  LawPair,
];

function check(pair: LawPair): LawCheck {
  return checkLaw(pair.left, pair.right, {});
}

const STOP_RESULT = check(STOP_LAW);
const COMMUTE_RESULT = check(COMMUTE_LAW);
const SAME_EVENT_RESULT = check(SAME_EVENT_LAW);
const NOT_LAW_RESULT = check(NOT_LAW);
// 法則ではない組で、どちら向きの失敗詳細化が破れるか（左を仕様、右を実装にした向き）。
const NOT_LAW_FAILURE = failuresRefines(NOT_LAW.left, NOT_LAW.right, {});
const NOT_LAW_REVERSE = failuresRefines(NOT_LAW.right, NOT_LAW.left, {});
if (!NOT_LAW_FAILURE.counterexample) {
  throw new Error("a → (P □ Q) ⊑F (a → P) □ (a → Q) の反例が見つからない");
}
const NOT_LAW_COUNTER: Failure = NOT_LAW_FAILURE.counterexample;
// a → (P □ Q) が a の後に差し出すイベント
const AFTER_A_OFFERS = moves(ext(P, Q), {}).map((m) => m.ev);

// 部品ごとに確かめれば全体も成り立つ: 等しい2つを、同じ外側の式（周りの部品）に入れても等しいまま。
const CONTEXT_EVENT = "b";
const IN_CHOICE = checkLaw(
  ext(SAME_EVENT_LAW.left, pre(CONTEXT_EVENT, STOP)),
  ext(SAME_EVENT_LAW.right, pre(CONTEXT_EVENT, STOP)),
  {},
);
const IN_PARALLEL = checkLaw(
  par(SAME_EVENT_LAW.left, [], pre(CONTEXT_EVENT, STOP)),
  par(SAME_EVENT_LAW.right, [], pre(CONTEXT_EVENT, STOP)),
  {},
);

function yesNo(isEqual: boolean): string {
  return isEqual ? "等しい" : "等しくない";
}

function isLaw(result: LawCheck): boolean {
  return result.traces && result.failures && result.failuresDivergences;
}

function lawRows(result: LawCheck): Record<string, string> {
  return {
    トレース: yesNo(result.traces),
    失敗: yesNo(result.failures),
    失敗発散: yesNo(result.failuresDivergences),
  };
}

function failureText(failure: Failure): string {
  const trace = failure.trace.length > 0 ? `⟨${failure.trace.join(", ")}⟩` : "⟨⟩";
  return `(${trace}, {${failure.refusal.join(", ")}})`;
}

function lawFields(result: LawCheck): Field[] {
  return [
    {
      label: "トレースで",
      value: yesNo(result.traces),
      tone: result.traces ? "ok" : "bad",
    },
    {
      label: "失敗で",
      value: yesNo(result.failures),
      tone: result.failures ? "ok" : "bad",
    },
    {
      label: "失敗発散で",
      value: yesNo(result.failuresDivergences),
      tone: result.failuresDivergences ? "ok" : "bad",
    },
  ];
}

function parsePair(text: string | undefined): LawPair {
  const trimmed = (text ?? "").trim();
  // 読めない入力は既定の組（4: 法則ではない組）に戻す
  return PAIRS.find((pair) => pair.id === trimmed) ?? NOT_LAW;
}

export const cspLawsLesson: Lesson = {
  id: "csp-laws",
  category: "csp",
  title: "代数法則を確かめる",
  subtitle: "式の書き換えが正しいかを、詳細化を両向きに調べて確かめる",
  summary: `「P □ STOP = P」のような CSP の法則を、検査器で詳細化を両向きに調べて確かめる。a → (P □ Q) と (a → P) □ (a → Q) はトレースでは${yesNo(NOT_LAW_RESULT.traces)}が、失敗では${yesNo(NOT_LAW_RESULT.failures)}。`,
  facts: [
    {
      label: STOP_LAW.name,
      value: isLaw(STOP_RESULT) ? "法則" : "法則ではない",
      tone: isLaw(STOP_RESULT) ? "ok" : "bad",
    },
    {
      label: SAME_EVENT_LAW.name,
      value: isLaw(SAME_EVENT_RESULT) ? "法則" : "法則ではない",
      tone: isLaw(SAME_EVENT_RESULT) ? "ok" : "bad",
    },
    {
      label: NOT_LAW.name,
      value: isLaw(NOT_LAW_RESULT) ? "法則" : "法則ではない",
      tone: isLaw(NOT_LAW_RESULT) ? "ok" : "bad",
    },
    { label: "失敗の反例", value: failureText(NOT_LAW_COUNTER), tone: "bad" },
    { label: "参考文献", value: `${CSP_BOOK} 6.6節（CSPの基礎）` },
  ],
  actors: [
    {
      id: "left",
      label: "左辺",
      sublabel: STOP_LAW.leftText,
      icon: "process",
      x: 14,
      y: 50,
    },
    {
      id: "right",
      label: "右辺",
      sublabel: STOP_LAW.rightText,
      icon: "process",
      x: 38,
      y: 50,
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "詳細化を両向きに",
      icon: "checker",
      x: 62,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "context",
      label: "周りの部品",
      sublabel: `□ ${CONTEXT_EVENT} → STOP など`,
      icon: "route",
      x: 86,
      y: 50,
      initial: { isHidden: true },
    },
  ],
  stageHeight: 300,
  links: [
    { from: "checker", to: "left" },
    { from: "checker", to: "right" },
    { from: "context", to: "checker" },
  ],
  steps: [
    {
      id: "laws",
      kind: "spec",
      title: "法則で式を書き換える",
      actor: "left",
      to: ["right"],
      summary: `${STOP_LAW.name}: 動けない STOP を選択肢に足しても何も変わらない`,
      explain:
        "CSP には、算数の「x + 0 = x」のような代数法則がある。P □ STOP = P は、外部選択 □ に、何もしない STOP を足しても、選べる中身は P のままという法則。法則を使えば、式を書き換えて2つのプロセスが等しいことを示せる。",
      set: {
        left: { tone: "wait", rows: { 式: STOP_LAW.leftText } },
        right: { tone: "wait", rows: { 式: STOP_LAW.rightText } },
      },
      detail: [
        {
          title: "このレッスンで使う部品",
          fields: [
            { label: "P", value: "p → STOP", isCode: true },
            { label: "Q", value: "q → STOP", isCode: true },
          ],
        },
      ],
      simplified:
        "式はこのサイトのモデル（csp.ts）に合わせた短い書き方で、実物の CSPM（FDR の記法）とは書き方が違う（□ は []、⊓ は |~|）。",
    },
    {
      id: "both-ways",
      kind: "explore",
      title: "両向きの詳細化で確かめる",
      actor: "checker",
      to: ["left", "right"],
      summary: `左 ⊑ 右 と 右 ⊑ 左 を3種類の比べ方で調べ、どれも${yesNo(isLaw(STOP_RESULT))}`,
      explain:
        "2つが等しいとは、互いに相手を詳細化すること。検査器で「左を仕様、右を実装」と「右を仕様、左を実装」の両方を調べれば、法則が成り立つかを書き換えなしで確かめられる。トレース・失敗・失敗発散の3種類で、それぞれ答えを出す。",
      set: {
        checker: { isHidden: false, tone: "ok", rows: lawRows(STOP_RESULT) },
        left: { tone: "ok" },
        right: { tone: "ok" },
      },
      simplified:
        "この組は ProB でも失敗発散詳細化（[FD=）を両向きに確かめ、結果が一致した（specs/csp）。",
    },
    {
      id: "commute",
      kind: "explore",
      title: "□ は並べる順を問わない",
      actor: "checker",
      to: ["left", "right"],
      summary: `${COMMUTE_LAW.name}は、3種類とも${yesNo(isLaw(COMMUTE_RESULT))}`,
      explain:
        "外部選択は、差し出す選択肢を左右どちらに書いても、環境から見た選べる中身は同じ。検査器でも3種類の比べ方すべてで等しくなる。",
      set: {
        left: { tone: "ok", rows: { 式: COMMUTE_LAW.leftText } },
        right: { tone: "ok", rows: { 式: COMMUTE_LAW.rightText } },
        checker: { tone: "ok", rows: lawRows(COMMUTE_RESULT) },
      },
      simplified:
        "同じ組を ProB でも確かめ、失敗発散で両向きに等しいことが一致した（リポジトリの specs/csp）。",
    },
    {
      id: "same-event",
      kind: "explore",
      title: "同じ a の選択は内部選択",
      actor: "checker",
      to: ["left", "right"],
      summary: `${SAME_EVENT_LAW.name}は、3種類とも${yesNo(isLaw(SAME_EVENT_RESULT))}`,
      explain:
        "外部選択の両側が同じイベント a で始まると、環境は a を起こせても、どちらの a かは選べない。だから先は P と Q のどちらかをプロセスが勝手に決める内部選択 ⊓ と同じになる。「□ は環境が選ぶ」と覚えていると直感に反するので、ここは要点になる。",
      set: {
        left: { tone: "ok", rows: { 式: SAME_EVENT_LAW.leftText } },
        right: { tone: "ok", rows: { 式: SAME_EVENT_LAW.rightText } },
        checker: { tone: "ok", rows: lawRows(SAME_EVENT_RESULT) },
      },
      simplified:
        "この組は ProB でも失敗発散詳細化（[FD=）を両向きに確かめ、結果が一致した（specs/csp）。",
    },
    {
      id: "not-law",
      kind: "found",
      title: "似ているが法則ではない",
      actor: "checker",
      to: ["left", "right"],
      summary: `${NOT_LAW.name}: トレースでは${yesNo(NOT_LAW_RESULT.traces)}が、失敗では${yesNo(NOT_LAW_RESULT.failures)}。反例${failureText(NOT_LAW_COUNTER)}`,
      explain: `どちらも a の後に p か q が起きるので、トレースは同じ。ところが${NOT_LAW.rightText}は a の時点で片方の先へ勝手に進むので、a の後に${NOT_LAW_COUNTER.refusal.join("・")}を拒否できる。${NOT_LAW.leftText}は a の後も両方を差し出すので拒否しない。`,
      set: {
        left: {
          tone: "ok",
          rows: {
            式: NOT_LAW.leftText,
            "a の後": `${AFTER_A_OFFERS.join("・")}を受け付ける`,
          },
        },
        right: {
          tone: "bad",
          rows: {
            式: NOT_LAW.rightText,
            "a の後": `${NOT_LAW_COUNTER.refusal.join("・")}を拒否できる`,
          },
        },
        checker: { tone: "bad", rows: lawRows(NOT_LAW_RESULT) },
      },
      detail: [
        {
          title: "向きごとの失敗詳細化",
          fields: [
            {
              label: `${NOT_LAW.leftText} ⊑F ${NOT_LAW.rightText}`,
              value: NOT_LAW_FAILURE.holds ? "成り立つ" : "成り立たない",
              tone: NOT_LAW_FAILURE.holds ? "ok" : "bad",
            },
            {
              label: "その反例",
              value: failureText(NOT_LAW_COUNTER),
              tone: "bad",
            },
            {
              label: `${NOT_LAW.rightText} ⊑F ${NOT_LAW.leftText}`,
              value: NOT_LAW_REVERSE.holds ? "成り立つ" : "成り立たない",
              tone: NOT_LAW_REVERSE.holds ? "ok" : "bad",
            },
          ],
        },
      ],
      simplified:
        "この組は ProB でもトレース詳細化（[T=）が成り立ち、失敗詳細化（[F=）が破れることを片向きで確かめ、結果が一致した（specs/csp）。",
    },
    {
      id: "compose",
      kind: "test",
      title: "部品ごとに確かめる",
      actor: "context",
      to: ["checker"],
      summary: `等しい2つを「□ ${CONTEXT_EVENT} → STOP」や並行合成の中に入れても、失敗発散で${yesNo(IN_CHOICE.failuresDivergences && IN_PARALLEL.failuresDivergences)}`,
      explain: `詳細化は、どの演算子で組み立てても保たれる。だから部品ごとに「仕様を満たす」と確かめれば、組み立てた全体も成り立つ。${SAME_EVENT_LAW.name}の両辺を同じ周りの部品に入れて比べても、検査器の答えは変わらない。単体テストを積んで全体を信じる考え方に近いが、こちらはどの組み合わせでも保証される。`,
      set: {
        context: {
          isHidden: false,
          tone: "ok",
          rows: {
            "□ の中": yesNo(isLaw(IN_CHOICE)),
            並行合成の中: yesNo(isLaw(IN_PARALLEL)),
          },
        },
        checker: { tone: "ok", rows: lawRows(IN_PARALLEL) },
      },
      detail: [
        {
          title: "周りの部品に入れて比べた式",
          fields: [
            {
              label: "□ の中",
              value: `(${SAME_EVENT_LAW.leftText}) □ (${CONTEXT_EVENT} → STOP) と (${SAME_EVENT_LAW.rightText}) □ (${CONTEXT_EVENT} → STOP)`,
              isCode: true,
            },
            {
              label: "並行合成の中",
              value: `(${SAME_EVENT_LAW.leftText}) ||| (${CONTEXT_EVENT} → STOP) と (${SAME_EVENT_LAW.rightText}) ||| (${CONTEXT_EVENT} → STOP)`,
              isCode: true,
            },
          ],
        },
      ],
      simplified:
        "ここで見せたのは2つの周りの部品での確認だけで、「どの演算子でも保たれる」こと自体の証明ではない（証明は書籍 6.6節の考え方を参照）。||| は同期しない並行合成（インタリーブ）。",
    },
  ],
  lab: {
    title: "組を選んで3種類で比べる",
    hint: PAIRS.map((pair) => `${pair.id}: ${pair.name}`).join(" ／ "),
    inputs: [{ id: "pair", label: "組の番号（1〜4）", initial: NOT_LAW.id }],
    compute: (values): Field[] => {
      const pair = parsePair(values.pair);
      const result = check(pair);
      const forward = failuresRefines(pair.left, pair.right, {});
      const backward = failuresRefines(pair.right, pair.left, {});
      const counter = forward.counterexample ?? backward.counterexample;
      return [
        { label: "組", value: pair.name },
        ...lawFields(result),
        {
          label:
            backward.counterexample && !forward.counterexample
              ? "失敗の反例（右辺を仕様にした向き）"
              : "失敗の反例（左辺を仕様にした向き）",
          value: counter ? failureText(counter) : "なし",
          tone: counter ? "bad" : "ok",
        },
      ];
    },
  },
};
