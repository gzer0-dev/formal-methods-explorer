import { translator, type Language } from "../../core/i18n";
import type { Lesson, Step } from "../../core/types";
import { acceptsTrace, determinism, traceTo } from "../csp";
import {
  ADDERS,
  COUNTER_ENV,
  COUNTER_VALUES,
  counterObserved,
  counterSystem,
} from "../cspModels";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";

// 演習: ロック無しのカウンタは決定的か（exerciseCsp.ts の問6を1レッスンにしたもの）。
// 既定の図は問題の設定だけを見せ、出うる結果や検査器の判定は出さない。答えを入れると、
// 出うる結果ごとの実行の例と、検査器の判定が図に足される。

type Translate = (ja: string, en: string) => string;

/** 反例の時点を文の頭に置く形にする（exerciseCsp.ts と同じ）。 */
function traceText(trace: string[], t: Translate): string {
  return trace.length > 0
    ? t(`${trace.join(" → ")}の後`, `After ${trace.join(" → ")}`)
    : t("最初の時点で", "At the start");
}

// 正解の計算は exerciseCsp.ts の問6と同じ関数・同じモデル。図で見せる実行の例は、読み書きを隠す前の全体から取る。
const RESULT = lazy(() => {
  const observed = counterObserved(false);
  const determinismResult = determinism(observed, COUNTER_ENV);
  // finish の後に出ることがある結果（テストを何回も回したときに見える値）
  const results = COUNTER_VALUES.filter(
    (value) =>
      acceptsTrace(observed, COUNTER_ENV, ["finish", `result.${value}`]).isAccepted,
  ).map((value) => `result.${value}`);
  // 正しい結果（足し手の人数）の実行を先に、それ以外の実行を後に並べる。
  const expected = `result.${ADDERS.length}`;
  const ordered = [...results].sort(
    (a, b) => Number(b === expected) - Number(a === expected),
  );
  const runs = ordered.map((event) => ({
    event,
    trace: traceTo(counterSystem(false), COUNTER_ENV, event),
  }));
  return {
    determinism: determinismResult,
    results,
    runs,
    lockDeterminism: determinism(counterObserved(true), COUNTER_ENV),
  };
});

function setupSteps(t: Translate): Step[] {
  return [
    {
      id: "adders",
      kind: "spec",
      title: t("ロック無しで2人が足す", "Two add without a lock"),
      actor: "adderA",
      to: ["count"],
      summary: t(
        "AとBが、count を読んで1を足して書き戻す。ロックは無い",
        "A and B each read count, add 1 and write it back. There is no lock",
      ),
      explain: t(
        "足し手AとBは、どちらも count を読み（read）、読んだ値に1を足して書き戻す（write）。ロックが無いので、2人の読み書きはどんな順にも混ざりうる。2人とも終わると finish が起き、count が最後の値を result.値 で報告する。",
        "Adders A and B each read count (read), add 1 to the value they read and write it back (write). With no lock, their reads and writes can interleave in any order. When both are done, finish happens and count reports its final value as result.value.",
      ),
      set: {
        adderA: { rows: { [t("手順", "steps")]: t("読む → 書く", "read → write") } },
        adderB: { rows: { [t("手順", "steps")]: t("読む → 書く", "read → write") } },
        count: { tone: "wait" },
      },
      simplified: t(
        "式はこのサイトのモデル（cspModels.ts）の書き方で、実物の CSPM（FDR の記法）とは書き方が違う。count の値は0〜2の範囲で扱う。",
        "The expressions use this site's model notation (cspModels.ts), which differs from real CSPM (the FDR notation). count is kept in the range 0 to 2.",
      ),
    },
    {
      id: "observe",
      kind: "run",
      title: t("外から見えるもの", "What is visible outside"),
      actor: "test",
      to: ["count"],
      summary: t(
        "テストから見えるのは finish と result.値 だけ。読み書きは隠す",
        "The test sees only finish and result.value. Reads and writes are hidden",
      ),
      explain: t(
        "テストは同じ操作を何回も流し、finish（全員が終わった合図）と result.値（最後の値の報告）だけを見る。読み書きは内部の動きとして隠すので、どの順で混ざったかはテストからは見えない。",
        "The test runs the same steps many times and sees only finish (the signal that everyone is done) and result.value (the final value). Reads and writes are hidden as internal moves, so the test cannot see in which order they interleaved.",
      ),
      set: {
        test: {
          tone: "wait",
          rows: { [t("見える", "sees")]: "finish, result.n" },
        },
      },
    },
    {
      id: "question",
      kind: "explore",
      title: t("このカウンタは決定的か", "Is it deterministic?"),
      actor: "checker",
      to: ["count"],
      summary: t(
        "ロック無しのカウンタが決定的かを答える",
        "Is the counter without a lock deterministic?",
      ),
      explain: t(
        "決定的とは、同じイベントの並びの後で、受け付けるイベントがいつも同じこと。外から finish と result.値 だけが見えるこのカウンタは、決定的か。下の「答え合わせ」に「はい」か「いいえ」を入れると、検査器の結果と実行の例がこの図に足される。ヒント: テストを何回も流したとき、結果は毎回同じか。",
        'Deterministic means that after the same sequence of events, it always accepts the same events. Seen from outside, where only finish and result.value are visible, is this counter deterministic? Enter "yes" or "no" under "Check your answer" below and the checker\'s result and example runs are added to this diagram. Hint: if you run the test many times, is the result the same every time?',
      ),
      set: {
        checker: {
          tone: "wait",
          rows: { [t("問い", "question")]: t("決定的？", "Deterministic?") },
        },
      },
    },
  ];
}

function runStep(
  run: { event: string; trace: string[] | null },
  index: number,
  t: Translate,
): Step {
  if (run.trace === null) {
    throw new Error(`${run.event} に至る実行が見つからない`);
  }
  const value = run.event.split(".")[1]!;
  const internal = run.trace.filter(
    (ev) => ev.startsWith("read.") || ev.startsWith("write."),
  );
  const internalText = internal.join(" → ");
  return {
    id: `run-${index + 1}`,
    kind: run.event === `result.${ADDERS.length}` ? "run" : "found",
    title: t(`${index + 1}回目: ${run.event}`, `Run ${index + 1}: ${run.event}`),
    actor: "count",
    to: ["test"],
    summary: t(
      `読み書きが${internalText}の順だと、finish の後に${run.event}`,
      `If reads and writes go ${internalText}, ${run.event} follows finish`,
    ),
    explain: t(
      `内部の読み書きが${internalText}の順に起きると、count は${value}で終わり、テストには finish の後に${run.event}が見える。読み書きは隠れているので、テストから見えるのは結果だけ。`,
      `If the internal reads and writes happen in the order ${internalText}, count ends at ${value}, and the test sees ${run.event} after finish. The reads and writes are hidden, so the test sees only the result.`,
    ),
    set: {
      count: { tone: "idle", rows: { [t("値", "value")]: value } },
      test: { rows: { [t(`${index + 1}回目`, `run ${index + 1}`)]: run.event } },
    },
    detail: [
      {
        title: t("隠す前の全体の並び", "Whole sequence before hiding"),
        fields: [
          { label: t("並び", "Sequence"), value: run.trace.join(" → "), isCode: true },
        ],
      },
    ],
  };
}

function solutionSteps(t: Translate): Step[] {
  const result = RESULT();
  const witness = result.determinism.witness;
  if (witness?.kind !== "refusal") {
    throw new Error("ロック無しのカウンタで、断ることの証拠が見つからない");
  }
  const isDeterministic = (value: boolean) =>
    value ? t("決定的", "deterministic") : t("非決定的", "nondeterministic");
  const resultsText = result.results.join(t("・", ", "));
  return [
    {
      id: "same-test",
      kind: "run",
      title: t("同じテストを流す", "Run the same test"),
      actor: "test",
      to: ["count"],
      summary: t(
        `finish の後に出うる結果は${resultsText}`,
        `Results that can follow finish: ${resultsText}`,
      ),
      explain: t(
        `同じテストを何回も流すと、finish の後に${resultsText}のいずれも出うる。どれになるかは、内部の読み書きの順で決まる。読み書きの順が違う実行を、1つずつ見る。`,
        `Running the same test many times, any of ${resultsText} can follow finish. Which one appears depends on the internal order of reads and writes. Look at runs with different orders one at a time.`,
      ),
      set: {
        test: { tone: "wait", rows: { [t("見える", "sees")]: null } },
        checker: { rows: { [t("問い", "question")]: null } },
      },
    },
    ...result.runs.map((run, index) => runStep(run, index, t)),
    {
      id: "witness",
      kind: "found",
      title: t("起こせるのに断る", "Can do it, yet may refuse"),
      actor: "checker",
      to: ["count"],
      summary: t(
        `${traceText(witness.trace, t)}、${witness.event}を受け付けることも断ることもある`,
        `${traceText(witness.trace, t)}, it may either accept or refuse ${witness.event}`,
      ),
      explain: t(
        `検査器は「${traceText(witness.trace, t)}、${witness.event}を起こせる回もあれば、断る回もある」という証拠を返した。同じ並びの後で受け付けるイベントが回ごとに違うので、このカウンタは${isDeterministic(result.determinism.isDeterministic)}。テストから見ると、同じ操作なのにたまに落ちる、揺れるテストになる。`,
        `The checker returned evidence: "${traceText(witness.trace, t)}, ${witness.event} sometimes happens and is sometimes refused". After the same sequence, the events it accepts differ from run to run, so this counter is ${isDeterministic(result.determinism.isDeterministic)}. From the test's side, it is a flaky test: the same steps, but it sometimes fails.`,
      ),
      set: {
        count: { tone: "bad" },
        test: { tone: "bad" },
        checker: {
          tone: "bad",
          rows: {
            [t("ロック無し", "no lock")]: isDeterministic(
              result.determinism.isDeterministic,
            ),
          },
        },
      },
      detail: [
        {
          title: t("検査器が返した証拠", "Evidence the checker returned"),
          fields: [
            {
              label: t("トレース", "Trace"),
              value:
                witness.trace.join(" → ") ||
                t("なし（最初から）", "none (from the start)"),
              isCode: true,
            },
            {
              label: t("断ることがあるイベント", "Event it may refuse"),
              value: witness.event,
              isCode: true,
            },
          ],
        },
      ],
      simplified: t(
        "同じ組を ProB の deterministic の検査で確かめ、結果が一致した（specs/csp）。",
        "The same cases were checked with ProB's deterministic check, and the results agreed (specs/csp).",
      ),
    },
    {
      id: "lock",
      kind: "fix",
      title: t("ロックを掛けると", "With a lock"),
      actor: "checker",
      to: ["adderA", "adderB"],
      summary: t(
        `ロックありのカウンタは${isDeterministic(result.lockDeterminism.isDeterministic)}`,
        `The counter with a lock is ${isDeterministic(result.lockDeterminism.isDeterministic)}`,
      ),
      explain: t(
        `比べるために、読んでから書くまでをロックで囲んだカウンタも同じ検査にかけると、${isDeterministic(result.lockDeterminism.isDeterministic)}だった。読み書きが混ざらなくなり、finish の後の結果が1つに決まる。揺れるテストを見たら、リトライを足す前に、内部の順で結果が変わる所を探す。`,
        `For comparison, the counter that wraps read-then-write in a lock goes through the same check and is ${isDeterministic(result.lockDeterminism.isDeterministic)}. Reads and writes no longer interleave, so the result after finish is fixed. When a test flakes, look for where the internal order changes the result before adding a retry.`,
      ),
      set: {
        adderA: { tone: "ok" },
        adderB: { tone: "ok" },
        checker: {
          rows: {
            [t("ロックあり", "with lock")]: isDeterministic(
              result.lockDeterminism.isDeterministic,
            ),
          },
        },
      },
    },
  ];
}

export function exerciseDeterminismLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-determinism",
      title: t("演習: カウンタの決定性", "Exercise: is the counter deterministic?"),
      subtitle: t(
        "ロック無しのカウンタは、決定的か",
        "Is the counter without a lock deterministic?",
      ),
      summary: t(
        "ロック無しで2人が1を足すカウンタが、外から見て決定的かを答える。答えを入れると、実行の例と検査器の結果を図で追える。",
        "Answer whether the counter where two add 1 without a lock is deterministic as seen from outside. Once you answer, you can follow example runs and the checker's result.",
      ),
      intro: [
        t(
          "「決定性と揺れるテスト」で見た、ロック無しのカウンタを使う。外から見えるのは finish と result.値 だけにして、同じ操作をしたときに受け付けるイベントがいつも同じかを問う。",
          'This uses the counter without a lock from "Determinism and flaky tests". Only finish and result.value are visible from outside, and the question is whether the same steps always lead to the same accepted events.',
        ),
        t(
          "図はまず、2人の足し手と count とテストの関係だけを見せる。答えを入れると、テストのカードに実行ごとの結果が、検査器のカードに判定が足されるので、内部の読み書きの順と結果の関係を追う。",
          "The diagram first shows only how the two adders, count and the test relate. Once you answer, the result of each run is added to the test's card and the verdict to the checker's card, so follow how the internal order of reads and writes relates to the result.",
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t("ロック無しのカウンタ", "Counter without a lock"),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("「はい」か「いいえ」", '"yes" or "no"'),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t("決定性と揺れるテスト", '"Determinism and flaky tests"'),
        },
      ],
      actors: [
        {
          id: "test",
          label: t("テスト", "Test"),
          sublabel: t("同じ操作を何回も", "same steps, many times"),
          icon: "test",
          x: 14,
          y: 50,
        },
        {
          id: "adderA",
          label: t("足し手A", "Adder A"),
          sublabel: t("読む → 書く", "read → write"),
          icon: "process",
          x: 38,
          y: 27,
        },
        {
          id: "adderB",
          label: t("足し手B", "Adder B"),
          sublabel: t("読む → 書く", "read → write"),
          icon: "process",
          x: 38,
          y: 73,
        },
        {
          id: "count",
          label: "count",
          sublabel: t("共有の変数", "shared variable"),
          icon: "variable",
          x: 62,
          y: 50,
          initial: { rows: { [t("値", "value")]: "0" } },
        },
        {
          id: "checker",
          label: t("検査器", "Checker"),
          sublabel: t("決定性を調べる", "checks determinism"),
          icon: "checker",
          x: 86,
          y: 50,
        },
      ],
      links: [
        { from: "adderA", to: "count" },
        { from: "adderB", to: "count" },
        { from: "test", to: "count" },
        { from: "checker", to: "count" },
      ],
      answerType: "yesno",
      answerLabel: t("あなたの答え（はい／いいえ）", "Your answer (yes / no)"),
      hint: t(
        "決定的なら「はい」、決定的でないなら「いいえ」を入れる。入れると、図に検査器の結果と実行の例が足される。",
        'Enter "yes" if it is deterministic, "no" if not. The checker\'s result and example runs are then added to the diagram.',
      ),
      verdictActor: "checker",
      // 既定の見本には日本語の「はい」「いいえ」が入っていて、英語のレッスンの訳し忘れの検査に掛かるので、言語ごとに渡す。
      samples: language === "ja" ? ["はい", "いいえ", "yes", "x"] : ["yes", "no", "x"],
      setupSteps: setupSteps(t),
      solve: () => {
        const result = RESULT().determinism;
        const witness = result.witness;
        const witnessText =
          witness?.kind === "refusal"
            ? t(
                `${traceText(witness.trace, t)}、${witness.event}を受け付けることも断ることもある。`,
                `${traceText(witness.trace, t)}, it may either accept or refuse ${witness.event}. `,
              )
            : witness?.kind === "divergence"
              ? t(
                  `${traceText(witness.trace, t)}、外から見えない動きだけで回り続けられる。`,
                  `${traceText(witness.trace, t)}, it can keep going round on invisible moves alone. `,
                )
              : "";
        return {
          answer: result.isDeterministic,
          reason: result.isDeterministic
            ? t(
                "どの並びの後でも、受け付けるイベントは同じだった。",
                "After every sequence, it accepted the same events.",
              )
            : t(
                `${witnessText}同じテストでも、内部の動く順しだいで結果が変わる（揺れるテストの原因）。`,
                `${witnessText}The same test can give different results depending on the internal order (a cause of flaky tests).`,
              ),
        };
      },
      solutionSteps: () => solutionSteps(t),
    },
    language,
  );
}
