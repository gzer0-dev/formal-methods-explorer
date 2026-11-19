import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import { divergence, explore, type Failure, failuresRefines, type Proc } from "../csp";
import { FOCUS_ENV, FOCUS_EVENTS, FOCUS_SPEC, focusOnPhilosopher0 } from "../cspCases";
import { focusLazy } from "../cspMore";

// どの比較も数ミリ秒で終わるので、最上位で1回ずつ呼ぶ（1人だけ逆順の版だけ）。
const EAGER = focusOnPhilosopher0(true);
const LAZY = focusLazy(true);
const EAGER_LTS = explore(EAGER, FOCUS_ENV);
const LAZY_LTS = explore(LAZY, FOCUS_ENV);
const EAGER_DIVERGENCE = divergence(EAGER, FOCUS_ENV);
const EAGER_FAILURES = failuresRefines(FOCUS_SPEC, EAGER, FOCUS_ENV);
const LAZY_FAILURES = failuresRefines(FOCUS_SPEC, LAZY, FOCUS_ENV);
if (!LAZY_FAILURES.counterexample) {
  throw new Error("Lazy 抽象化で、失敗詳細化の反例が見つからない");
}
const LAZY_STUCK = LAZY_FAILURES.counterexample;

function traceText(trace: string[]): string {
  return trace.length > 0 ? trace.join(" → ") : "なし（最初から）";
}

function failureText(failure: Failure): string {
  return `${traceText(failure.trace)}の後に {${failure.refusal.join(", ")}}を拒否`;
}

function holdsText(holds: boolean): string {
  return holds ? "成り立つ" : "破れる";
}

function parseLazy(text: string | undefined): boolean {
  // 「Eager」と書いたときだけ Eager にする。それ以外（空や読めない入力）は既定の Lazy に戻す。
  return !(text ?? "").toLowerCase().includes("eager");
}

function parseReversed(text: string | undefined): boolean {
  // 「なし」と書いたときだけ全員が左から取る。それ以外（空や読めない入力）は既定の「あり」に戻す。
  return !(text ?? "").includes("なし");
}

function abstractionOf(isLazy: boolean, isAsymmetric: boolean): Proc {
  return isLazy ? focusLazy(isAsymmetric) : focusOnPhilosopher0(isAsymmetric);
}

export const cspLazyLesson: Lesson = {
  id: "csp-lazy",
  category: "apply",
  title: "Eager と Lazy",
  subtitle: "隠した動きが「続いてくれる」と当てにするか",
  summary: `1人だけ逆順の哲学者で、ただ隠す Eager 抽象化では失敗詳細化が${holdsText(EAGER_FAILURES.holds)}が、ほかの人が止まりうるとみなす Lazy 抽象化では「${failureText(LAZY_STUCK)}」が反例になる。`,
  intro: [
    "前のレッスン「隠して小さく見る」の続きで、抽象化の2つの考え方を比べる。Eager 抽象化は隠すイベントをそのまま見えなくし、Lazy 抽象化は隠すイベントを、いつでも止まりうる環境と組み合わせてから見えなくする。",
    "どちらを使うかで、隠した部分（ほかの人の動き）について何を前提にしているかが変わる。前提を取り違えると、検査は通っても、実際の環境では成り立たない結論を信じることになる。",
    "図では「哲学者の全体」から「Eager 抽象化」と「Lazy 抽象化」の2つの道に分かれ、それぞれ「検査器」で仕様 Focus と比べる。同じ全体を同じ仕様と比べているのに、2つの道で結果が分かれるか、分かれるならなぜかに注目する。",
  ],
  facts: [
    {
      label: "Eager（ただ隠す）",
      value: `失敗詳細化が${holdsText(EAGER_FAILURES.holds)}（${EAGER_LTS.stateCount}状態）`,
      tone: EAGER_FAILURES.holds ? "ok" : "bad",
    },
    {
      label: "Lazy（止まりうる）",
      value: `失敗詳細化が${holdsText(LAZY_FAILURES.holds)}（${LAZY_LTS.stateCount}状態）`,
      tone: LAZY_FAILURES.holds ? "ok" : "bad",
    },
    { label: "Lazy の反例", value: failureText(LAZY_STUCK), tone: "bad" },
    { label: "参考文献", value: `${CSP_BOOK} 7.3.2節（Eager抽象化とLazy抽象化）` },
  ],
  actors: [
    {
      id: "table",
      label: "哲学者の全体",
      sublabel: "最後の1人だけ逆順",
      icon: "people",
      x: 14,
      y: 50,
    },
    {
      id: "eager",
      label: "Eager 抽象化",
      sublabel: "ただ隠す",
      icon: "visited",
      x: 38,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "lazy",
      label: "Lazy 抽象化",
      sublabel: "止まりうるとみなす",
      icon: "gear",
      x: 62,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "仕様 Focus と比べる",
      icon: "checker",
      x: 86,
      y: 50,
      initial: { isHidden: true },
    },
  ],
  stageHeight: 300,
  links: [
    { from: "table", to: "eager" },
    { from: "eager", to: "lazy" },
    { from: "lazy", to: "checker" },
  ],
  steps: [
    {
      id: "recap",
      kind: "spec",
      title: "ただ隠して比べる",
      actor: "eager",
      to: ["table"],
      summary: `${FOCUS_EVENTS.join(" と ")}以外を隠すと、失敗詳細化は${holdsText(EAGER_FAILURES.holds)}`,
      explain: `「隠して小さく見る」の続き。最後の1人だけ逆順に取る哲学者から、哲学者0が左のフォークを取る${FOCUS_EVENTS[0]}と置く${FOCUS_EVENTS[1]}だけを残して、ほかを隠す。これを Eager 抽象化と呼び、仕様 Focus（取る→置くの繰り返し）との失敗詳細化は${holdsText(EAGER_FAILURES.holds)}。`,
      set: {
        eager: {
          isHidden: false,
          tone: EAGER_FAILURES.holds ? "ok" : "bad",
          rows: {
            状態: `${EAGER_LTS.stateCount}個`,
            失敗: holdsText(EAGER_FAILURES.holds),
          },
        },
      },
      simplified:
        "式はこのサイトのモデル（cspCases.ts・cspMore.ts）の書き方で、実物の CSPM（FDR の記法）とは書き方が違う。",
    },
    {
      id: "rely",
      kind: "explore",
      title: "続いてくれる前提",
      actor: "eager",
      summary: `隠した動きは${EAGER_DIVERGENCE ? "発散に見え" : "発散に見えず"}、「必ず起き続けられる」扱いになる`,
      explain:
        "ほかの人が取って食べて置く動きは、隠すと見えない動き τ になる。τ で動ける状態は安定していないので、失敗詳細化はそこで拒否を数えない。つまり Eager 抽象化は「ほかの人は止まらず動き続ける」と当てにしていて、その前提で「哲学者0は止まらない」と言っている。",
      set: {
        eager: {
          tone: "wait",
          rows: { 発散: EAGER_DIVERGENCE ? "あり（見えない動きの輪）" : "なし" },
        },
      },
      simplified:
        "失敗詳細化（FDR の [F= と同じ）は、τ で動ける状態の拒否を数えず、発散も見ない。発散は divergence で別に調べている。",
    },
    {
      id: "lazy",
      kind: "spec",
      title: "止まりうる環境",
      actor: "lazy",
      to: ["table"],
      summary: `隠すイベントを、いつでも止まれる環境と同期させてから隠す（${LAZY_LTS.stateCount}状態）`,
      explain: `Lazy 抽象化では、隠すイベントを「いつでも起こせるが、いつでも止まって全部を断ることもできる」環境（CHAOS）と同期させてから隠す。ほかの人の動きは、環境しだいで止まりうるものとして扱われる。状態は${LAZY_LTS.stateCount}個（Eager は${EAGER_LTS.stateCount}個）に増える。`,
      set: {
        lazy: {
          isHidden: false,
          tone: "wait",
          rows: { 状態: `${LAZY_LTS.stateCount}個` },
        },
      },
    },
    {
      id: "stuck",
      kind: "found",
      title: "取ったまま置けない",
      actor: "checker",
      to: ["lazy"],
      summary: `Lazy: ${failureText(LAZY_STUCK)}できる`,
      explain: `Lazy 抽象化を仕様 Focus と失敗詳細化で比べると、「${failureText(LAZY_STUCK)}できる」という反例が出た。ほかの人が右のフォークを持ったまま止まると、哲学者0は2本そろわず食べられないので、左のフォークを置けなくなる。Eager では見えなかった止まり方が、拒否として見えた。`,
      set: {
        lazy: { tone: "bad", rows: { 失敗: holdsText(LAZY_FAILURES.holds) } },
        checker: {
          isHidden: false,
          tone: "bad",
          rows: { 反例: failureText(LAZY_STUCK) },
        },
      },
      detail: [
        {
          title: "検査器が返した反例",
          fields: [
            { label: "トレース", value: traceText(LAZY_STUCK.trace), isCode: true },
            {
              label: "拒否できる",
              value: `{${LAZY_STUCK.refusal.join(", ")}}`,
              isCode: true,
            },
          ],
        },
      ],
      simplified:
        "同じ組を ProB で確かめ、Lazy 抽象化で失敗詳細化が破れることが一致した（specs/csp、CSPM の CHAOS を使用）。",
    },
    {
      id: "choose",
      kind: "spec",
      title: "どちらの前提か選ぶ",
      actor: "checker",
      to: ["eager", "lazy"],
      summary: "Eager は「ほかは止まらない」、Lazy は「ほかは止まるかもしれない」",
      explain:
        "Eager は「ほかの人は止まらない」、Lazy は「ほかの人は止まるかもしれない」を前提にした見方で、どちらが正しいというものではない。何を前提に何を言いたいかを先に決め、それに合う抽象化を選ぶ。書籍の7.3.2節の Eager／Lazy 抽象化の考え方に沿っている。",
      set: { checker: { tone: "idle" }, eager: { tone: "ok" }, lazy: { tone: "wait" } },
    },
    {
      id: "testing",
      kind: "test",
      title: "テストでの前提",
      actor: "checker",
      to: ["table"],
      summary: "依存先が必ず応答するモックか、止まりうるモックかの違いに近い",
      explain:
        "テストで依存先のサービスを必ずすぐ応答するモックにすると、Eager と同じく「相手は止まらない」前提で確かめていることになる。相手が止まったときの振る舞いを確かめたいなら、Lazy のように止まりうる相手を置いて調べる。",
      set: { table: { tone: "ok" } },
    },
  ],
  lab: {
    title: "抽象化と取る順",
    hint: "抽象化に「Eager」か「Lazy」、1人だけ逆順に「あり」か「なし」を書くと、仕様 Focus との失敗詳細化の結果と反例を出す。",
    inputs: [
      { id: "abstraction", label: "抽象化（Eager / Lazy）", initial: "Lazy" },
      { id: "reversed", label: "1人だけ逆順（あり / なし）", initial: "あり" },
    ],
    compute: (values): Field[] => {
      const isLazy = parseLazy(values.abstraction);
      const isAsymmetric = parseReversed(values.reversed);
      const proc = abstractionOf(isLazy, isAsymmetric);
      const lts = explore(proc, FOCUS_ENV);
      const failures = failuresRefines(FOCUS_SPEC, proc, FOCUS_ENV);
      return [
        { label: "抽象化", value: isLazy ? "Lazy" : "Eager" },
        { label: "1人だけ逆順", value: isAsymmetric ? "あり" : "なし" },
        { label: "状態", value: `${lts.stateCount}個` },
        {
          label: "失敗詳細化",
          value: failures.counterexample
            ? `破れる（${failureText(failures.counterexample)}）`
            : "成り立つ",
          tone: failures.holds ? "ok" : "bad",
        },
      ];
    },
  },
};
