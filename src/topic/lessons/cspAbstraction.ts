import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import {
  checkLaw,
  explore,
  type FdCounterexample,
  failuresDivergencesRefines,
  failuresRefines,
  traceRefines,
} from "../csp";
import { philosophers, PHILOSOPHER_ENV } from "../cspModels";
import { FOCUS_ENV, FOCUS_EVENTS, FOCUS_SPEC, focusOnPhilosopher0 } from "../cspCases";

const PEOPLE = 3;

// ここで呼ぶ比較はどれも数ミリ秒で終わる（隠した後の全体が数十状態しかないため）。
const WHOLE = explore(philosophers(PEOPLE, false), PHILOSOPHER_ENV);
const FOCUSED = explore(focusOnPhilosopher0(false), FOCUS_ENV);
const SPEC_LTS = explore(FOCUS_SPEC, FOCUS_ENV);
const LAW_LEFT_FIRST = checkLaw(FOCUS_SPEC, focusOnPhilosopher0(false), FOCUS_ENV);
const LAW_ONE_REVERSED = checkLaw(FOCUS_SPEC, focusOnPhilosopher0(true), FOCUS_ENV);
const FAILURES_LEFT_FIRST = failuresRefines(
  FOCUS_SPEC,
  focusOnPhilosopher0(false),
  FOCUS_ENV,
);
if (!FAILURES_LEFT_FIRST.counterexample) {
  throw new Error("全員が左から取る版で、失敗詳細化の反例が見つからない");
}
const STUCK = FAILURES_LEFT_FIRST.counterexample;
const FAILURES_ONE_REVERSED = failuresRefines(
  FOCUS_SPEC,
  focusOnPhilosopher0(true),
  FOCUS_ENV,
);
const FD_ONE_REVERSED = failuresDivergencesRefines(
  FOCUS_SPEC,
  focusOnPhilosopher0(true),
  FOCUS_ENV,
);
if (FD_ONE_REVERSED.counterexample?.kind !== "divergence") {
  throw new Error("1人だけ逆順の版で、失敗発散詳細化の反例が発散になっていない");
}
const DIVERGE = FD_ONE_REVERSED.counterexample;

// 全体のイベントのうち、残したもの以外の数（pick と put の種類の数）
const ALL_EVENT_COUNT = new Set(
  WHOLE.edges.map((edge) => edge.ev).filter((ev) => /^(pick|put)\./.test(ev)),
).size;
const HIDDEN_COUNT = ALL_EVENT_COUNT - FOCUS_EVENTS.length;

function traceText(trace: string[]): string {
  return trace.length > 0 ? trace.join(" → ") : "なし（最初から）";
}

/** 発散が始まる時点を「最初から」「a → b の後から」と読む。 */
function startText(trace: string[]): string {
  return trace.length > 0 ? `${trace.join(" → ")}の後から` : "最初から";
}

function holdsText(holds: boolean): string {
  return holds ? "成り立つ" : "破れる";
}

function fdText(counterexample: FdCounterexample | null): string {
  if (!counterexample) return "反例なし";
  if (counterexample.kind === "failure") {
    return `失敗: ${traceText(counterexample.trace)}の後に {${counterexample.refusal.join(", ")}}を拒否`;
  }
  if (counterexample.kind === "divergence")
    return `発散: ${startText(counterexample.trace)}`;
  return `トレース: ${traceText(counterexample.trace)}`;
}

function parseReversed(text: string | undefined): boolean {
  // 「あり」と書いたときだけ逆順にする。それ以外（空や読めない入力）は既定の「なし」に戻す。
  return (text ?? "").includes("あり");
}

export const cspAbstractionLesson: Lesson = {
  id: "csp-abstraction",
  category: "apply",
  title: "隠して小さく見る",
  subtitle: "見たい動きだけ残し、残りを隠して比べる",
  summary: `${PEOPLE}人の哲学者から、哲学者0が左のフォークを取る・置くだけを残して隠すと、取る→置くを繰り返す小さな仕様とトレースが等しくなる。失敗で比べるとデッドロックが見え、失敗発散で比べると隠した動きが発散に見える。`,
  facts: [
    {
      label: "全体の状態",
      value: `${WHOLE.stateCount}個（仕様 Focus は${SPEC_LTS.stateCount}個）`,
    },
    {
      label: "トレース",
      value: `仕様と${LAW_LEFT_FIRST.traces && LAW_ONE_REVERSED.traces ? "等しい（どちらの取り方でも）" : "等しくない"}`,
      tone: "ok",
    },
    {
      label: "全員が左から",
      value: `失敗詳細化が${holdsText(FAILURES_LEFT_FIRST.holds)}`,
      tone: "bad",
    },
    {
      label: "1人だけ逆順",
      value: `失敗詳細化は${holdsText(FAILURES_ONE_REVERSED.holds)}、失敗発散は${holdsText(FD_ONE_REVERSED.holds)}`,
      tone: "wait",
    },
    { label: "参考文献", value: `${CSP_BOOK} 7.3節（抽象化による検証例）` },
  ],
  actors: [
    {
      id: "table",
      label: "哲学者の全体",
      sublabel: `${PEOPLE}人と${PEOPLE}本のフォーク`,
      icon: "people",
      x: 14,
      y: 50,
      initial: {
        rows: { 状態: `${WHOLE.stateCount}個`, イベント: `${ALL_EVENT_COUNT}種類` },
      },
    },
    {
      id: "hide",
      label: "隠蔽",
      sublabel: "哲学者0の左手だけ残す",
      icon: "visited",
      x: 38,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "spec",
      label: "仕様 Focus",
      sublabel: "取る→置くの繰り返し",
      icon: "spec",
      x: 62,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "3つの比べ方",
      icon: "checker",
      x: 86,
      y: 50,
      initial: { isHidden: true },
    },
  ],
  stageHeight: 300,
  links: [
    { from: "table", to: "hide" },
    { from: "hide", to: "spec" },
    { from: "checker", to: "spec" },
  ],
  steps: [
    {
      id: "whole",
      kind: "spec",
      title: "全体は大きい",
      actor: "table",
      summary: `全員が左から取る${PEOPLE}人の哲学者は${WHOLE.stateCount}状態・${WHOLE.transitionCount}遷移`,
      explain: `「食事する哲学者」のモデルをそのまま使う。${PEOPLE}人と${PEOPLE}本のフォークで、イベントは${ALL_EVENT_COUNT}種類、状態は${WHOLE.stateCount}個ある。人数が増えると、全部を見て「正しいか」を考えるのは難しくなる。`,
      set: { table: { tone: "wait" } },
      simplified:
        "式はこのサイトのモデル（cspModels.ts・cspCases.ts）に合わせた短い書き方で、実物の CSPM（FDR の記法）とは書き方が違う。",
    },
    {
      id: "hide",
      kind: "spec",
      title: "1人の左手だけ見る",
      actor: "hide",
      to: ["table"],
      summary: `${FOCUS_EVENTS.join(" と ")}以外の${HIDDEN_COUNT}種類を隠す`,
      explain: `注目するのは哲学者0が左のフォークを取る${FOCUS_EVENTS[0]}と、置く${FOCUS_EVENTS[1]}だけ。残りの${HIDDEN_COUNT}種類のイベントを隠す（隠蔽 \\）と、外の同意なしに起きる見えない動き τ に変わる。${FOCUSED.stateCount === WHOLE.stateCount ? `状態の数（${FOCUSED.stateCount}個）は変わらないが` : `状態は${FOCUSED.stateCount}個（隠す前は${WHOLE.stateCount}個）で`}、外から見えるイベントは${FOCUS_EVENTS.length}種類だけになる。`,
      set: {
        hide: { isHidden: false, tone: "wait" },
        table: { rows: { 見える: FOCUS_EVENTS.join("・") } },
      },
    },
    {
      id: "spec",
      kind: "spec",
      title: "小さな仕様を書く",
      actor: "spec",
      summary: `Focus = ${FOCUS_EVENTS[0]} → ${FOCUS_EVENTS[1]} → Focus（${SPEC_LTS.stateCount}状態）`,
      explain: `哲学者0の左手から見て正しい動きは「取って、置いて、また取る」の繰り返しだけ。これを${SPEC_LTS.stateCount}状態の小さな仕様 Focus として書く。大きな全体をこの小さな仕様と比べれば、1人から見た振る舞いを確かめられる。`,
      set: {
        spec: {
          isHidden: false,
          tone: "idle",
          rows: { 状態: `${SPEC_LTS.stateCount}個` },
        },
      },
      detail: [
        {
          title: "このサイトのモデル",
          fields: [
            {
              label: "Focus",
              value: `${FOCUS_EVENTS[0]} → ${FOCUS_EVENTS[1]} → Focus`,
              isCode: true,
            },
            {
              label: "比べる相手",
              value: `Phils \\ (pick と put のうち${FOCUS_EVENTS.join(", ")}以外)`,
              isCode: true,
            },
          ],
        },
      ],
    },
    {
      id: "traces",
      kind: "explore",
      title: "トレースは等しい",
      actor: "checker",
      to: ["spec", "hide"],
      summary: `トレースで比べると、全員が左からでも1人だけ逆順でも仕様と${LAW_LEFT_FIRST.traces && LAW_ONE_REVERSED.traces ? "等しい" : "等しくない"}`,
      explain: `トレース（起こせるイベントの並び）を両向きに比べると、どちらの取り方でも仕様と${LAW_LEFT_FIRST.traces && LAW_ONE_REVERSED.traces ? "等しい" : "等しくない"}。隠した後に見える並びは、取る・置くが交互に出るものだけだから。ただしトレースは「起こせること」しか見ないので、途中で止まるかどうかは分からない。`,
      set: {
        checker: {
          isHidden: false,
          tone: "ok",
          rows: { トレース: LAW_LEFT_FIRST.traces ? "等しい" : "等しくない" },
        },
        spec: { tone: "ok" },
      },
      simplified:
        "同じ組を ProB で確かめ、結果が一致した（specs/csp）。ここでの「等しい」は詳細化を両向きに調べた結果。",
    },
    {
      id: "stuck",
      kind: "found",
      title: "取ったまま置けない",
      actor: "checker",
      to: ["table"],
      summary: `全員が左から: ${traceText(STUCK.trace)}の後に {${STUCK.refusal.join(", ")}}を拒否できる`,
      explain: `失敗（その時点で拒否できるイベント）まで比べると、全員が左から取る版は反例が出る。${traceText(STUCK.trace)}の後、仕様なら必ず${STUCK.refusal.join(", ")}を受け付けるのに、全体はそれを拒否できる。全体のデッドロック（全員が1本ずつ持って止まる）が、注目している1人から見ると「左を取ったまま置けない」形で見えた。`,
      set: {
        table: { tone: "bad" },
        checker: {
          tone: "bad",
          rows: {
            失敗: `${traceText(STUCK.trace)}の後に${STUCK.refusal.join(", ")}を拒否`,
          },
        },
      },
      detail: [
        {
          title: "検査器が返した反例",
          fields: [
            { label: "トレース", value: traceText(STUCK.trace), isCode: true },
            {
              label: "拒否できる",
              value: `{${STUCK.refusal.join(", ")}}`,
              isCode: true,
            },
          ],
        },
      ],
      simplified:
        "失敗詳細化は、実装が安定した（τ で勝手に動けない）状態で拒否できるイベントを比べる。発散はこの比べ方の外なので、ここでは見ていない（FDR の [F= と同じ）。",
    },
    {
      id: "reverse",
      kind: "fix",
      title: "1人だけ逆順にする",
      actor: "checker",
      to: ["table"],
      summary: `最後の哲学者だけ右から取ると、失敗詳細化は${holdsText(FAILURES_ONE_REVERSED.holds)}`,
      explain: `デッドロックのレッスンと同じく、最後の哲学者だけフォークを取る順を逆にする。全員が1本ずつ持って止まる形が無くなり、哲学者0が左を取ったまま全体が止まる時点も無くなるので、失敗詳細化は${holdsText(FAILURES_ONE_REVERSED.holds)}。`,
      set: {
        table: { tone: "ok" },
        checker: { tone: "ok", rows: { 失敗: holdsText(FAILURES_ONE_REVERSED.holds) } },
      },
    },
    {
      id: "diverge",
      kind: "found",
      title: "隠した動きが発散に",
      actor: "checker",
      to: ["hide"],
      summary: `失敗発散で比べると、${startText(DIVERGE.trace)}発散できるという反例が出る`,
      explain: `失敗発散詳細化は、見えない動き τ だけで回り続けられるか（発散）も比べる。ほかの人の動きを全部隠したので、ほかの人が取って食べて置くのを繰り返す間、外からは何も起きない。仕様 Focus は発散しないので、${startText(DIVERGE.trace)}発散できることが反例になる。`,
      set: {
        hide: { tone: "bad" },
        checker: {
          tone: "bad",
          rows: { 失敗発散: `発散（${startText(DIVERGE.trace)}）` },
        },
      },
      simplified:
        "ここでの発散は「ほかの人が食べ続け、哲学者0がずっと待たされる」実行も含む。公平性（いつか全員に順番が来るという仮定）は置いていない。",
    },
    {
      id: "choose",
      kind: "spec",
      title: "比べ方を選ぶ",
      actor: "checker",
      to: ["spec"],
      summary: "隠すと小さく見られるが、何を言えるかは比べ方で変わる",
      explain:
        "トレースは「起こせる並び」、失敗は「止まらないこと」、失敗発散は「見えない動きで回り続けないこと」まで言える。隠して小さく見るときは、どの比べ方で何を言えるかを、確かめたいことに合わせて選ぶ必要がある。書籍の7.3節では、Eager 抽象化と Lazy 抽象化という扱い分けとして説明されている。",
      set: { spec: { tone: "ok" }, checker: { tone: "idle" } },
      simplified:
        "Eager／Lazy 抽象化の定義はここでは扱わない。このサイトの検査器は、隠したイベントを τ にする隠蔽だけを実装している。",
    },
  ],
  lab: {
    title: "取る順と比べ方",
    hint: "「1人だけ逆順」を「あり」にすると、最後の哲学者だけ右から取る。3つの比べ方で、仕様 Focus を満たすかを出す。",
    inputs: [{ id: "reversed", label: "1人だけ逆順（あり / なし）", initial: "なし" }],
    compute: (values): Field[] => {
      const isAsymmetric = parseReversed(values.reversed);
      const focus = focusOnPhilosopher0(isAsymmetric);
      const lts = explore(focus, FOCUS_ENV);
      const traces = traceRefines(FOCUS_SPEC, focus, FOCUS_ENV);
      const failures = failuresRefines(FOCUS_SPEC, focus, FOCUS_ENV);
      const fd = failuresDivergencesRefines(FOCUS_SPEC, focus, FOCUS_ENV);
      return [
        { label: "1人だけ逆順", value: isAsymmetric ? "あり" : "なし" },
        { label: "隠した後の状態", value: `${lts.stateCount}個` },
        {
          label: "トレース詳細化",
          value: traces.holds
            ? "成り立つ"
            : `破れる（${traceText(traces.counterexample ?? [])}）`,
          tone: traces.holds ? "ok" : "bad",
        },
        {
          label: "失敗詳細化",
          value: failures.counterexample
            ? `破れる（${traceText(failures.counterexample.trace)}の後に {${failures.counterexample.refusal.join(", ")}}を拒否）`
            : "成り立つ",
          tone: failures.holds ? "ok" : "bad",
        },
        {
          label: "失敗発散詳細化",
          value: fd.holds ? "成り立つ" : `破れる（${fdText(fd.counterexample)}）`,
          tone: fd.holds ? "ok" : "bad",
        },
      ];
    },
  },
};
