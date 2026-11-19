import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import {
  acceptsTrace,
  explore,
  procKey,
  STOP,
  TAU,
  traceRefines,
  traceTo,
} from "../csp";
import { counterObserved, counterSystem, COUNTER_ENV, RESULT_SPEC } from "../cspModels";

const SPEC_TRACE = traceTo(RESULT_SPEC, COUNTER_ENV, "result.2")!;
const NAIVE = traceRefines(RESULT_SPEC, counterObserved(false), COUNTER_ENV);
const LOCKED = traceRefines(RESULT_SPEC, counterObserved(true), COUNTER_ENV);
const COUNTEREXAMPLE = NAIVE.counterexample!;
// 反例のうち、仕様が受け付けた所まで（仕様は finish までは起こせる）。
const SPEC_ON_CEX = acceptsTrace(RESULT_SPEC, COUNTER_ENV, COUNTEREXAMPLE);
const OBSERVED_LTS = explore(counterObserved(false), COUNTER_ENV);
const HIDDEN_MOVES = OBSERVED_LTS.edges.filter((edge) => edge.ev === TAU).length;
// 隠す前から、足し手が終わったときの見えない動き（✓ が τ になる分）がある。
const TAU_BEFORE_HIDING = explore(counterSystem(false), COUNTER_ENV).edges.filter(
  (edge) => edge.ev === TAU,
).length;
const VISIBLE_EVENTS = [
  ...new Set(OBSERVED_LTS.edges.map((edge) => edge.ev).filter((ev) => ev !== TAU)),
].sort();
const LOCKED_LTS = explore(counterObserved(true), COUNTER_ENV);
// 何もしない実装もトレース詳細化では仕様を満たす（次の「拒否で見分ける」への橋渡し）。
const STOP_REFINES = traceRefines(RESULT_SPEC, STOP, COUNTER_ENV).holds;
// 隠す前の中身。反例のトレースの裏で、読み書きがどう並んでいたか。
const LAST_EVENT = COUNTEREXAMPLE.at(-1)!;
const INSIDE = traceTo(counterSystem(false), COUNTER_ENV, LAST_EVENT)!;

function parseLock(text: string | undefined): boolean {
  return (text ?? "").includes("あり");
}

function traceText(trace: string[]): string {
  return trace.length > 0 ? `⟨${trace.join(", ")}⟩` : "⟨⟩（空）";
}

export const cspRefinementLesson: Lesson = {
  id: "csp-refinement",
  category: "csp",
  title: "仕様もプロセスで書く",
  subtitle: "実装が仕様を詳細化するかを調べる",
  summary: `仕様「finish の後は result.2」もプロセスで書き、読み書きを隠したカウンタと比べる。ロックなしは ${traceText(COUNTEREXAMPLE)} が反例になり、ロックありは${LOCKED.holds ? "成り立つ" : "成り立たない"}。`,
  intro: [
    "CSP では、守ってほしい性質（仕様）も、実装と同じ記法のプロセスで書く。実装が仕様を詳細化するとは、実装が仕様の許す振る舞いしかしないことを指す。このレッスンでは、外から見えたイベントの並び（トレース）だけで比べる。",
    "「並行合成と同期」のカウンタから読み書きを隠蔽し（外から見えないようにし）、全員が終わった合図と結果の報告だけを仕様と比べる。テストの期待値と同じく外から見た振る舞いで判定するので、中の作りが違う実装にも同じ仕様を使える。",
    "図では、検査器が仕様と実装のカードを組にしてたどり、実装だけが起こせるイベントが出た所で反例になる。その後に隠した中身のカードが開き、反例の裏で起きていた読み書きの順が見える。",
  ],
  facts: [
    { label: "仕様のトレース", value: traceText(SPEC_TRACE) },
    {
      label: "ロックなし",
      value: NAIVE.holds ? "成り立つ" : "成り立たない",
      tone: NAIVE.holds ? "ok" : "bad",
    },
    {
      label: "ロックあり",
      value: LOCKED.holds ? "成り立つ" : "成り立たない",
      tone: LOCKED.holds ? "ok" : "bad",
    },
    { label: "実物の道具", value: "FDR（assert Spec [T= Impl）" },
    { label: "参考文献", value: `${CSP_BOOK} 6.2節（トレース方式）・3.2.4節（表明）` },
  ],
  actors: [
    {
      id: "spec",
      label: "仕様",
      sublabel: "RESULT_SPEC",
      icon: "spec",
      x: 14,
      y: 27,
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "トレースを比べる",
      icon: "checker",
      x: 50,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "impl",
      label: "実装",
      sublabel: "カウンタを外から見る",
      icon: "process",
      x: 86,
      y: 27,
    },
    {
      id: "inside",
      label: "隠した中身",
      sublabel: "読み書きの並び",
      icon: "variable",
      x: 86,
      y: 73,
      initial: { isHidden: true },
    },
  ],
  links: [
    { from: "spec", to: "checker" },
    { from: "impl", to: "checker" },
    { from: "inside", to: "impl" },
  ],
  steps: [
    {
      id: "spec-process",
      kind: "spec",
      title: "仕様をプロセスで書く",
      actor: "spec",
      summary: `仕様は「finish の後は result.2 を出して終わる」というプロセス`,
      explain:
        "CSP では、守ってほしい性質も、実装と同じ記法のプロセスで書く。仕様は「finish（全員が終わった合図）の後に result.2（結果は2）を出して終わる」だけ。こう振る舞ってよい、という見本を1つの振る舞いとして書いている。",
      set: {
        spec: {
          tone: "ok",
          rows: {
            定義: procKey(RESULT_SPEC).replaceAll("→", " → "),
            トレース: traceText(SPEC_TRACE),
          },
        },
      },
      simplified:
        "実物の CSPM（FDR の記法）では RESULT_SPEC = finish -> result.2 -> SKIP と書く。このサイトは矢印の記号で短く見せている。",
    },
    {
      id: "hide",
      kind: "spec",
      title: "中の動きを隠す",
      actor: "impl",
      summary: `実装から read・write・lock を隠し、見えるのは ${VISIBLE_EVENTS.join("・")} だけにする`,
      explain: `「並行合成と同期」のカウンタから、読み書き（とロック）を隠蔽（\\ で外から見えなくする）する。隠したイベントは ${TAU}（タウ、見えない動き）に変わるだけで、状態は${OBSERVED_LTS.stateCount}個のまま、遷移${OBSERVED_LTS.transitionCount}本のうち見えない動きは${HIDDEN_MOVES}本になる（隠す前から足し手が終わる合図の${TAU_BEFORE_HIDING}本があり、隠蔽で${HIDDEN_MOVES - TAU_BEFORE_HIDING}本増えた）。仕様に出てくるイベントだけで比べるために隠す。`,
      set: {
        impl: {
          tone: "wait",
          rows: {
            見える: VISIBLE_EVENTS.join("・"),
            状態: `${OBSERVED_LTS.stateCount}個`,
            見えない動き: `${HIDDEN_MOVES}本`,
          },
        },
      },
      detail: [
        {
          title: "このサイトの書き方",
          fields: [
            {
              label: "実装",
              value: "Counter \\ {read, write, lock, unlock}",
              isCode: true,
            },
          ],
        },
      ],
    },
    {
      id: "trace-refinement",
      kind: "explore",
      title: "トレース詳細化を調べる",
      actor: "checker",
      to: ["spec", "impl"],
      summary: "Spec ⊑T Impl: 実装のどのトレースも、仕様のトレースか",
      explain:
        "トレースとは、起きた見えるイベントの並び。実装が起こしうるどのトレースも仕様が起こせるなら、実装は仕様をトレース詳細化する（Spec ⊑T Impl）という。検査器は実装と仕様を組にして幅優先でたどり、仕様が起こせないイベントを探す。",
      set: {
        checker: { isHidden: false, tone: "wait", rows: { 調べる: "Spec ⊑T Impl" } },
      },
      simplified:
        "このサイトの検査器は、仕様の「いまいうる状態の集まり」と実装の状態を組にしてたどる。FDR は仕様を正規化してから比べるが、調べている中身は同じ。",
    },
    {
      id: "counterexample",
      kind: "found",
      title: "反例のトレース",
      actor: "impl",
      to: ["checker"],
      summary: `実装は ${traceText(COUNTEREXAMPLE)} を起こせるが、仕様は起こせない`,
      explain: `実装は finish の後に ${LAST_EVENT} を出せる。仕様は${SPEC_ON_CEX.acceptedCount}個目の finish までは同じだが、${LAST_EVENT} は起こせない。検査器はこの最短のトレースを反例として返す。`,
      set: {
        impl: { tone: "bad", rows: { 反例: traceText(COUNTEREXAMPLE) } },
        checker: {
          tone: "bad",
          rows: { 結果: NAIVE.holds ? "成り立つ" : "成り立たない" },
        },
      },
    },
    {
      id: "inside",
      kind: "found",
      title: "隠した中身を見る",
      actor: "inside",
      to: ["impl"],
      summary: `反例の裏では、${INSIDE.length}手の読み書きが起きていた`,
      explain: `隠す前の並行合成で ${LAST_EVENT} までの最短の手順を出すと、AとBが同じ0を読んで1を書く、「並行合成と同期」と同じ並びになる。反例は外から見えるトレースだけで示され、原因は中を開いて確かめる。`,
      set: {
        inside: { isHidden: false, tone: "bad", rows: { 手順: `${INSIDE.length}手` } },
      },
      detail: [
        {
          title: `隠す前の、${LAST_EVENT} までの手順`,
          fields: INSIDE.map((ev, i) => ({
            label: `${i + 1}手目`,
            value: ev,
            isCode: true,
          })),
        },
      ],
    },
    {
      id: "with-lock",
      kind: "fix",
      title: "ロックありは成り立つ",
      actor: "checker",
      to: ["spec", "impl"],
      summary: `ロックありの実装（${LOCKED_LTS.stateCount}状態）は、仕様をトレース詳細化${LOCKED.holds ? "する" : "しない"}`,
      explain: `ロックありのカウンタから同じように読み書きとロックを隠して比べると、反例は見つからない。finish の後は必ず result.2 になり、実装のどのトレースも仕様のトレースになっている。`,
      set: {
        impl: {
          tone: "ok",
          rows: {
            見える: null,
            見えない動き: null,
            状態: `${LOCKED_LTS.stateCount}個`,
            反例: "なし",
          },
        },
        inside: { tone: "idle" },
        checker: {
          tone: "ok",
          rows: { 結果: LOCKED.holds ? "成り立つ" : "成り立たない" },
        },
      },
    },
    {
      id: "vs-invariant",
      kind: "spec",
      title: "不変条件との違い",
      actor: "spec",
      to: ["checker"],
      summary: "性質を式ではなく「こう振る舞うべき」というプロセスで書く",
      explain:
        "TLA+ のレッスンでは「全員が終わったら count は2」のような不変条件を式で書き、どの状態でも成り立つかを調べた。CSP では、外から見えるイベントの並び方そのものを仕様のプロセスとして書き、実装と見比べる。実装の中の変数名に頼らないので、作りが違う実装でも同じ仕様で確かめられる。",
      set: { spec: { tone: "ok" } },
      simplified: `このサイトの finish と result.値 は、結果を外から見るために足したイベント。トレース詳細化は「してはいけないことをしない」だけを見るので、何もしない実装（STOP）も仕様を満たす（検査器でも${STOP_REFINES ? "成り立つ" : "成り立たない"}）。断ってはいけないことは、「拒否で見分ける」の失敗詳細化で調べる。`,
    },
  ],
  lab: {
    title: "ロックのあり・なしで調べ直す",
    hint: "「あり」にすると、読み書きとロックを隠した実装が仕様を満たすかを調べ直す。",
    inputs: [{ id: "lock", label: "ロック（あり / なし）", initial: "なし" }],
    compute: (values): Field[] => {
      const withLock = parseLock(values.lock);
      const result = traceRefines(RESULT_SPEC, counterObserved(withLock), COUNTER_ENV);
      return [
        { label: "ロック", value: withLock ? "あり" : "なし" },
        {
          label: "Spec ⊑T Impl",
          value: result.holds ? "成り立つ" : "成り立たない",
          tone: result.holds ? "ok" : "bad",
        },
        {
          label: "反例のトレース",
          value: result.counterexample ? traceText(result.counterexample) : "なし",
          tone: result.counterexample ? "bad" : "ok",
        },
      ];
    },
  },
};
