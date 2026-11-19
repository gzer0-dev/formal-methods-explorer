import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
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

// 英語の画面では on / off で入れる。
function parseLock(text: string | undefined): boolean {
  const value = text ?? "";
  return value.includes("あり") || /\b(yes|on)\b/i.test(value);
}

function traceText(trace: string[], language: Language): string {
  if (trace.length > 0) return `⟨${trace.join(", ")}⟩`;
  return language === "ja" ? "⟨⟩（空）" : "⟨⟩ (empty)";
}

function stepWord(count: number): string {
  return count === 1 ? "step" : "steps";
}

export function cspRefinementLesson(language: Language): Lesson {
  const t = translator(language);
  const holdsText = (holds: boolean) =>
    holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
  const visibleList = t(VISIBLE_EVENTS.join("・"), VISIBLE_EVENTS.join(", "));
  return {
    id: "csp-refinement",
    category: "csp",
    title: t("仕様もプロセスで書く", "Specifications are processes too"),
    subtitle: t(
      "実装が仕様を詳細化するかを調べる",
      "Check whether the implementation refines the spec",
    ),
    summary: t(
      `仕様「finish の後は result.2」もプロセスで書き、読み書きを隠したカウンタと比べる。ロックなしは ${traceText(COUNTEREXAMPLE, language)} が反例になり、ロックありは${LOCKED.holds ? "成り立つ" : "成り立たない"}。`,
      `Write the spec "after finish comes result.2" as a process too, and compare it with the counter whose reads and writes are hidden. Without the lock, ${traceText(COUNTEREXAMPLE, language)} is a counterexample; with the lock, refinement ${LOCKED.holds ? "holds" : "fails"}.`,
    ),
    intro: [
      t(
        "CSP では、守ってほしい性質（仕様）も、実装と同じ記法のプロセスで書く。実装が仕様を詳細化するとは、実装が仕様の許す振る舞いしかしないことを指す。このレッスンでは、外から見えたイベントの並び（トレース）だけで比べる。",
        "In CSP, the property you want (the specification) is written as a process in the same notation as the implementation. The implementation refines the spec when it only does what the spec allows. This lesson compares them only by the sequences of visible events (traces).",
      ),
      t(
        "「並行合成と同期」のカウンタから読み書きを隠蔽し（外から見えないようにし）、全員が終わった合図と結果の報告だけを仕様と比べる。テストの期待値と同じく外から見た振る舞いで判定するので、中の作りが違う実装にも同じ仕様を使える。",
        'Take the counter from "Parallel composition", hide its reads and writes (make them invisible from outside), and compare only the "everyone is done" signal and the reported result with the spec. Like a test\'s expected value, this judges behaviour seen from outside, so the same spec works for implementations built differently inside.',
      ),
      t(
        "図では、検査器が仕様と実装のカードを組にしてたどり、実装だけが起こせるイベントが出た所で反例になる。その後に隠した中身のカードが開き、反例の裏で起きていた読み書きの順が見える。",
        "In the diagram, the checker walks the spec and implementation cards as a pair, and a counterexample appears where only the implementation can perform an event. Then the hidden-internals card opens, showing the order of reads and writes behind the counterexample.",
      ),
    ],
    facts: [
      {
        label: t("仕様のトレース", "Spec trace"),
        value: traceText(SPEC_TRACE, language),
      },
      {
        label: t("ロックなし", "No lock"),
        value: holdsText(NAIVE.holds),
        tone: NAIVE.holds ? "ok" : "bad",
      },
      {
        label: t("ロックあり", "With lock"),
        value: holdsText(LOCKED.holds),
        tone: LOCKED.holds ? "ok" : "bad",
      },
      {
        label: t("実物の道具", "Real tools"),
        value: t("FDR（assert Spec [T= Impl）", "FDR (assert Spec [T= Impl)"),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 6.2節（トレース方式）・3.2.4節（表明）`,
          `${CSP_BOOK_EN}, sections 6.2 (trace model) and 3.2.4 (assertions)`,
        ),
      },
    ],
    actors: [
      {
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: "RESULT_SPEC",
        icon: "spec",
        x: 14,
        y: 27,
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("トレースを比べる", "compares traces"),
        icon: "checker",
        x: 50,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "impl",
        label: t("実装", "Implementation"),
        sublabel: t("カウンタを外から見る", "the counter from outside"),
        icon: "process",
        x: 86,
        y: 27,
      },
      {
        id: "inside",
        label: t("隠した中身", "Hidden internals"),
        sublabel: t("読み書きの並び", "reads and writes"),
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
        title: t("仕様をプロセスで書く", "Write the spec as a process"),
        actor: "spec",
        summary: t(
          `仕様は「finish の後は result.2 を出して終わる」というプロセス`,
          `The spec is a process: "after finish, output result.2 and terminate"`,
        ),
        explain: t(
          "CSP では、守ってほしい性質も、実装と同じ記法のプロセスで書く。仕様は「finish（全員が終わった合図）の後に result.2（結果は2）を出して終わる」だけ。こう振る舞ってよい、という見本を1つの振る舞いとして書いている。",
          'In CSP, the property you want is written as a process in the same notation as the implementation. The spec is just "after finish (the signal that everyone is done), output result.2 (the result is 2) and terminate". It writes the allowed behaviour as a single example of behaviour.',
        ),
        set: {
          spec: {
            tone: "ok",
            rows: {
              [t("定義", "definition")]: procKey(RESULT_SPEC).replaceAll("→", " → "),
              [t("トレース", "trace")]: traceText(SPEC_TRACE, language),
            },
          },
        },
        simplified: t(
          "実物の CSPM（FDR の記法）では RESULT_SPEC = finish -> result.2 -> SKIP と書く。このサイトは矢印の記号で短く見せている。",
          "In real CSPM (the notation used by FDR) this is written RESULT_SPEC = finish -> result.2 -> SKIP. This site uses the arrow symbol for brevity.",
        ),
      },
      {
        id: "hide",
        kind: "spec",
        title: t("中の動きを隠す", "Hide the internal moves"),
        actor: "impl",
        summary: t(
          `実装から read・write・lock を隠し、見えるのは ${VISIBLE_EVENTS.join("・")} だけにする`,
          `Hide read, write and lock in the implementation, leaving only ${VISIBLE_EVENTS.join(", ")} visible`,
        ),
        explain: t(
          `「並行合成と同期」のカウンタから、読み書き（とロック）を隠蔽（\\ で外から見えなくする）する。隠したイベントは ${TAU}（タウ、見えない動き）に変わるだけで、状態は${OBSERVED_LTS.stateCount}個のまま、遷移${OBSERVED_LTS.transitionCount}本のうち見えない動きは${HIDDEN_MOVES}本になる（隠す前から足し手が終わる合図の${TAU_BEFORE_HIDING}本があり、隠蔽で${HIDDEN_MOVES - TAU_BEFORE_HIDING}本増えた）。仕様に出てくるイベントだけで比べるために隠す。`,
          `Hide the reads and writes (and the lock) of the counter from "Parallel composition" (\\ makes them invisible from outside). Hidden events just become ${TAU} (tau, an invisible move): there are still ${OBSERVED_LTS.stateCount} states, and ${HIDDEN_MOVES} of the ${OBSERVED_LTS.transitionCount} transitions are invisible (${TAU_BEFORE_HIDING} were already there before hiding, from adders finishing, and hiding added ${HIDDEN_MOVES - TAU_BEFORE_HIDING}). We hide them so the comparison uses only the events in the spec.`,
        ),
        set: {
          impl: {
            tone: "wait",
            rows: {
              [t("見える", "visible")]: visibleList,
              [t("状態", "states")]: t(
                `${OBSERVED_LTS.stateCount}個`,
                `${OBSERVED_LTS.stateCount}`,
              ),
              [t("見えない動き", "invisible moves")]: t(
                `${HIDDEN_MOVES}本`,
                `${HIDDEN_MOVES}`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("このサイトの書き方", "Notation on this site"),
            fields: [
              {
                label: t("実装", "Implementation"),
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
        title: t("トレース詳細化を調べる", "Check trace refinement"),
        actor: "checker",
        to: ["spec", "impl"],
        summary: t(
          "Spec ⊑T Impl: 実装のどのトレースも、仕様のトレースか",
          "Spec ⊑T Impl: is every implementation trace a spec trace?",
        ),
        explain: t(
          "トレースとは、起きた見えるイベントの並び。実装が起こしうるどのトレースも仕様が起こせるなら、実装は仕様をトレース詳細化する（Spec ⊑T Impl）という。検査器は実装と仕様を組にして幅優先でたどり、仕様が起こせないイベントを探す。",
          "A trace is the sequence of visible events that happened. If the spec can perform every trace the implementation can, the implementation is a trace refinement of the spec (Spec ⊑T Impl). The checker walks the implementation and spec as a pair, breadth-first, looking for an event the spec cannot perform.",
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "wait",
            rows: { [t("調べる", "checking")]: "Spec ⊑T Impl" },
          },
        },
        simplified: t(
          "このサイトの検査器は、仕様の「いまいうる状態の集まり」と実装の状態を組にしてたどる。FDR は仕様を正規化してから比べるが、調べている中身は同じ。",
          "This site's checker walks pairs of an implementation state and the set of states the spec could be in. FDR normalises the spec before comparing, but what it checks is the same.",
        ),
      },
      {
        id: "counterexample",
        kind: "found",
        title: t("反例のトレース", "The counterexample trace"),
        actor: "impl",
        to: ["checker"],
        summary: t(
          `実装は ${traceText(COUNTEREXAMPLE, language)} を起こせるが、仕様は起こせない`,
          `The implementation can perform ${traceText(COUNTEREXAMPLE, language)}, but the spec cannot`,
        ),
        explain: t(
          `実装は finish の後に ${LAST_EVENT} を出せる。仕様は${SPEC_ON_CEX.acceptedCount}個目の finish までは同じだが、${LAST_EVENT} は起こせない。検査器はこの最短のトレースを反例として返す。`,
          `The implementation can output ${LAST_EVENT} after finish. The spec agrees up to finish (event ${SPEC_ON_CEX.acceptedCount}) but cannot perform ${LAST_EVENT}. The checker returns this shortest trace as the counterexample.`,
        ),
        set: {
          impl: {
            tone: "bad",
            rows: {
              [t("反例", "counterexample")]: traceText(COUNTEREXAMPLE, language),
            },
          },
          checker: {
            tone: "bad",
            rows: { [t("結果", "result")]: holdsText(NAIVE.holds) },
          },
        },
      },
      {
        id: "inside",
        kind: "found",
        title: t("隠した中身を見る", "Look at the hidden internals"),
        actor: "inside",
        to: ["impl"],
        summary: t(
          `反例の裏では、${INSIDE.length}手の読み書きが起きていた`,
          `Behind the counterexample, ${INSIDE.length} ${stepWord(INSIDE.length)} of reads and writes happened`,
        ),
        explain: t(
          `隠す前の並行合成で ${LAST_EVENT} までの最短の手順を出すと、AとBが同じ0を読んで1を書く、「並行合成と同期」と同じ並びになる。反例は外から見えるトレースだけで示され、原因は中を開いて確かめる。`,
          `Asking the unhidden composition for the shortest path to ${LAST_EVENT} gives the same ordering as in "Parallel composition": A and B both read 0 and write 1. The counterexample is shown only as a visible trace; you find the cause by opening up the inside.`,
        ),
        set: {
          inside: {
            isHidden: false,
            tone: "bad",
            rows: {
              [t("手順", "steps")]: t(`${INSIDE.length}手`, `${INSIDE.length}`),
            },
          },
        },
        detail: [
          {
            title: t(
              `隠す前の、${LAST_EVENT} までの手順`,
              `Steps to ${LAST_EVENT} before hiding`,
            ),
            fields: INSIDE.map((ev, i) => ({
              label: t(`${i + 1}手目`, `Step ${i + 1}`),
              value: ev,
              isCode: true,
            })),
          },
        ],
      },
      {
        id: "with-lock",
        kind: "fix",
        title: t("ロックありは成り立つ", "With the lock, it holds"),
        actor: "checker",
        to: ["spec", "impl"],
        summary: t(
          `ロックありの実装（${LOCKED_LTS.stateCount}状態）は、仕様をトレース詳細化${LOCKED.holds ? "する" : "しない"}`,
          `The implementation with the lock (${LOCKED_LTS.stateCount} states) ${LOCKED.holds ? "is" : "is not"} a trace refinement of the spec`,
        ),
        explain: t(
          `ロックありのカウンタから同じように読み書きとロックを隠して比べると、反例は見つからない。finish の後は必ず result.2 になり、実装のどのトレースも仕様のトレースになっている。`,
          `Hiding the reads, writes and lock of the locked counter in the same way and comparing finds no counterexample. After finish it always gives result.2, and every implementation trace is a spec trace.`,
        ),
        set: {
          impl: {
            tone: "ok",
            rows: {
              [t("見える", "visible")]: null,
              [t("見えない動き", "invisible moves")]: null,
              [t("状態", "states")]: t(
                `${LOCKED_LTS.stateCount}個`,
                `${LOCKED_LTS.stateCount}`,
              ),
              [t("反例", "counterexample")]: t("なし", "none"),
            },
          },
          inside: { tone: "idle" },
          checker: {
            tone: "ok",
            rows: { [t("結果", "result")]: holdsText(LOCKED.holds) },
          },
        },
      },
      {
        id: "vs-invariant",
        kind: "spec",
        title: t("不変条件との違い", "How this differs from invariants"),
        actor: "spec",
        to: ["checker"],
        summary: t(
          "性質を式ではなく「こう振る舞うべき」というプロセスで書く",
          'Write the property as a process ("behave like this"), not a formula',
        ),
        explain: t(
          "TLA+ のレッスンでは「全員が終わったら count は2」のような不変条件を式で書き、どの状態でも成り立つかを調べた。CSP では、外から見えるイベントの並び方そのものを仕様のプロセスとして書き、実装と見比べる。実装の中の変数名に頼らないので、作りが違う実装でも同じ仕様で確かめられる。",
          'The TLA+ lessons wrote invariants as formulas, such as "when everyone is done, count is 2", and checked that they hold in every state. In CSP, the allowed sequences of visible events are themselves written as a spec process and compared with the implementation. Because it does not rely on the implementation\'s variable names, the same spec can check implementations built differently.',
        ),
        set: { spec: { tone: "ok" } },
        simplified: t(
          `このサイトの finish と result.値 は、結果を外から見るために足したイベント。トレース詳細化は「してはいけないことをしない」だけを見るので、何もしない実装（STOP）も仕様を満たす（検査器でも${STOP_REFINES ? "成り立つ" : "成り立たない"}）。断ってはいけないことは、「拒否で見分ける」の失敗詳細化で調べる。`,
          `finish and result.value are events this site adds so the result can be seen from outside. Trace refinement only checks that nothing forbidden happens, so an implementation that does nothing (STOP) also satisfies the spec (the checker agrees: it ${STOP_REFINES ? "holds" : "fails"}). What must not be refused is checked by failures refinement in "Telling processes apart by refusals".`,
        ),
      },
    ],
    lab: {
      title: t("ロックのあり・なしで調べ直す", "Recheck with and without the lock"),
      hint: t(
        "「あり」にすると、読み書きとロックを隠した実装が仕様を満たすかを調べ直す。",
        'Set it to "yes" to recheck whether the implementation, with reads, writes and lock hidden, satisfies the spec.',
      ),
      inputs: [
        {
          id: "lock",
          label: t("ロック（あり / なし）", "Lock (yes / no)"),
          initial: t("なし", "no"),
        },
      ],
      compute: (values): Field[] => {
        const withLock = parseLock(values.lock);
        const result = traceRefines(
          RESULT_SPEC,
          counterObserved(withLock),
          COUNTER_ENV,
        );
        return [
          {
            label: t("ロック", "Lock"),
            value: withLock ? t("あり", "yes") : t("なし", "no"),
          },
          {
            label: "Spec ⊑T Impl",
            value: holdsText(result.holds),
            tone: result.holds ? "ok" : "bad",
          },
          {
            label: t("反例のトレース", "Counterexample trace"),
            value: result.counterexample
              ? traceText(result.counterexample, language)
              : t("なし", "none"),
            tone: result.counterexample ? "bad" : "ok",
          },
        ];
      },
    },
  };
}
