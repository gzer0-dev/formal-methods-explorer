import { translator, type Language } from "../../core/i18n";
import type { Lesson, Step } from "../../core/types";
import { acceptsTrace } from "../csp";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";
import { displayName } from "../labels";
import {
  type NetworkRun,
  runNetwork,
  SORT_IMPL_WIRINGS,
  visibleLog,
} from "../sortImpl";
import { SORT_ENV, SORT_SIZE, SORT_VALUES, sortSpec } from "../sortModels";

// 演習: 比較器を1つ忘れた並べ替えの実装を何回も動かしたとき、結果だけ見るテストは何回落ちるか
// （exerciseCsp.ts の問5を1レッスンにしたもの）。既定の図は問題の設定だけを見せ、落ちる入力と回数は出さない。
// 答えを入れると、並ぶ回・並ばない回の実行と、落ちた回の数え方が図に足される。

// 問題の条件。exerciseCsp.ts の問5（と caseImplement.ts）と同じにしてある。
const SEED_COUNT = 20;
const SEEDS = Array.from({ length: SEED_COUNT }, (_, k) => k + 1);

/** 0と1を3つ並べた入力の全部（caseImplement.ts と同じ数え方）。軽いので最上位で作る。 */
function allInputs(): number[][] {
  let inputs: number[][] = [[]];
  for (let k = 0; k < SORT_SIZE; k += 1) {
    inputs = inputs.flatMap((prefix) => SORT_VALUES.map((v) => [...prefix, v]));
  }
  return inputs;
}
const INPUTS = allInputs();
const RUN_COUNT = INPUTS.length * SEEDS.length;
const MISSING = SORT_IMPL_WIRINGS.missingLast;
const CORRECT = SORT_IMPL_WIRINGS.correct;

function isSorted(values: number[]): boolean {
  return values.every((v, k) => k === 0 || values[k - 1]! <= v);
}

interface Trial {
  input: number[];
  seed: number;
  run: NetworkRun;
  isSortedOutput: boolean;
  isAccepted: boolean;
}

// 正解の計算は exerciseCsp.ts の問5と同じ関数・同じ条件。図で例を見せるために、1回ずつの実行も持つ。
const TALLY = lazy(() => {
  const trials = INPUTS.flatMap((input) =>
    SEEDS.map((seed): Trial => {
      const run = runNetwork(MISSING, input, seed);
      return {
        input,
        seed,
        run,
        isSortedOutput: isSorted(run.output),
        isAccepted: acceptsTrace(sortSpec(), SORT_ENV, visibleLog(run.log)).isAccepted,
      };
    }),
  );
  const unsorted = trials.filter((trial) => !trial.isSortedOutput);
  return {
    unsortedCount: unsorted.length,
    rejectedCount: trials.filter((trial) => !trial.isAccepted).length,
    failingInputs: [...new Set(unsorted.map((trial) => `(${trial.input.join(",")})`))],
    // 「偶然並ぶ」例には、入力がもともと並んでいない回を選ぶ（(0,0,0) のような回では比較器の働きが見えない）。
    lucky: trials.find((trial) => trial.isSortedOutput && !isSorted(trial.input)),
    wrong: unsorted[0],
  };
});

type Translate = (ja: string, en: string) => string;

function inputText(values: number[]): string {
  return `(${values.join(",")})`;
}

function comparatorText(language: Language): string {
  const t = translator(language);
  return MISSING.map((c) => displayName(c.name, language)).join(t("・", ", "));
}

function setupSteps(t: Translate, language: Language): Step[] {
  return [
    {
      id: "missing",
      kind: "spec",
      title: t("比較器を1つ忘れた", "One comparator missing"),
      actor: "impl",
      to: ["log"],
      summary: t(
        `3つの値を並べ替えるネットワークで、正しくは${CORRECT.length}個ある比較器を${MISSING.length}個しか付けていない`,
        `A network that sorts three values, wired with only ${MISSING.length} of the ${CORRECT.length} comparators it needs`,
      ),
      explain: t(
        `比較器は、2本の入口から値を受け取り、小さい方と大きい方を別々の出口へ送る部品。正しい配線は${CORRECT.length}個の比較器を使うが、この実装は最後の比較器を付け忘れ、${comparatorText(language)}だけで組んである。比較器は Go のチャネルのように並行に動き、値の受け渡しの順は実行ごとに変わる。`,
        `A comparator takes values from two inputs and sends the smaller and the larger to separate outputs. The correct wiring uses ${CORRECT.length} comparators, but this implementation forgot the last one and is built from only ${comparatorText(language)}. The comparators run in parallel like Go channels, and the order of hand-offs changes from run to run.`,
      ),
      set: {
        impl: {
          tone: "wait",
          rows: {
            [t("比較器", "comparators")]: t(
              `${MISSING.length}個（正しくは${CORRECT.length}個）`,
              `${MISSING.length} (should be ${CORRECT.length})`,
            ),
          },
        },
      },
    },
    {
      id: "runs",
      kind: "run",
      title: t("入力とシードで回す", "Inputs times seeds"),
      actor: "impl",
      to: ["log"],
      summary: t(
        `0と1の入力${INPUTS.length}通りを、シード${SEED_COUNT}個でそれぞれ動かす（計${RUN_COUNT}回）`,
        `Run each of the ${INPUTS.length} inputs of 0s and 1s with ${SEED_COUNT} seeds (${RUN_COUNT} runs in all)`,
      ),
      explain: t(
        `入力は0と1を3つ並べた${INPUTS.length}通り（0と1で調べれば足りる、という0-1原理による）。どの組から動くかはシード付きの乱数で決めるので、シードを変えると受け渡しの順が変わる。${INPUTS.length}通り × ${SEED_COUNT}個のシードで、${RUN_COUNT}回の実行ログが残る。`,
        `The inputs are the ${INPUTS.length} ways to line up three 0s and 1s (by the 0-1 principle, checking 0s and 1s is enough). A seeded random number decides which pair moves first, so a different seed changes the order of hand-offs. ${INPUTS.length} inputs × ${SEED_COUNT} seeds leave ${RUN_COUNT} execution logs.`,
      ),
      set: {
        log: {
          tone: "wait",
          rows: {
            [t("実行", "runs")]: t(
              `${INPUTS.length}通り × ${SEED_COUNT} = ${RUN_COUNT}回`,
              `${INPUTS.length} × ${SEED_COUNT} = ${RUN_COUNT}`,
            ),
          },
        },
      },
    },
    {
      id: "question",
      kind: "test",
      title: t("結果のテストは何回落ちるか", "How often does it fail?"),
      actor: "result",
      to: ["log"],
      summary: t(
        `出力が並んでいるかだけを見るテストは、${RUN_COUNT}回のうち何回落ちるかを答える`,
        `Answer how many of the ${RUN_COUNT} runs fail a test that only checks whether the output is sorted`,
      ),
      explain: t(
        `結果のテストは、出口に出た3つの値が小さい順に並んでいるかだけを見る。途中の受け渡しの順は見ない。${RUN_COUNT}回の実行のうち、このテストが落ちるのは何回か。下の「答え合わせ」に数を入れると、実行の例と数え方がこの図に足される。ヒント: 忘れた比較器が要るのは、どんな入力のときか。`,
        `The result test only checks whether the three values that come out are in ascending order. It does not look at the order of hand-offs along the way. Of the ${RUN_COUNT} runs, how many fail this test? Enter a number under "Check your answer" below and example runs and how they are counted are added to this diagram. Hint: for which inputs is the missing comparator needed?`,
      ),
      set: {
        result: {
          tone: "wait",
          rows: { [t("見る", "checks")]: t("出力が並んでいるか", "is output sorted?") },
        },
        spec: { tone: "idle" },
        oracle: { tone: "idle" },
      },
      simplified: t(
        "実装は Go のチャネル風の小さな実行環境で、どの組から動くかをシード付きの乱数で決めている。仕様での判定は、「全部読んでから出す」という仕様の決まりを破った回も数える。",
        'The implementation runs on a small Go-channel-like runtime, and a seeded random number decides which pair moves first. Judging against the spec also counts runs that break the spec\'s rule "read everything before output".',
      ),
    },
  ];
}

function runSummary(trial: Trial, t: Translate): string {
  return t(
    `入力${inputText(trial.input)}・シード${trial.seed}: 出力${inputText(trial.run.output)}`,
    `Input ${inputText(trial.input)}, seed ${trial.seed}: output ${inputText(trial.run.output)}`,
  );
}

/** カードに載せる短い形（「(1,1,0) → (1,0,1)」）。並び全体は detail に出す。 */
function ioText(trial: Trial): string {
  return `${inputText(trial.input)} → ${inputText(trial.run.output)}`;
}

function solutionSteps(t: Translate): Step[] {
  const tally = TALLY();
  const { lucky, wrong } = tally;
  if (!lucky || !wrong) {
    throw new Error("比較器を忘れた実装で、並ぶ回と並ばない回の両方が見つからない");
  }
  // 並ばない回の説明は「最初の比較器の小さい方が、そのまま out.0 に出る」配線を前提にしている。
  if (MISSING[0]!.lo !== "out.0") {
    throw new Error(
      "比較器を忘れた配線が、説明の前提（最初の比較器の小さい方が out.0）と違う",
    );
  }
  const failingInputs = tally.failingInputs.join(t("、", ", "));
  const passedCount = RUN_COUNT - tally.unsortedCount;
  return [
    {
      id: "lucky-run",
      kind: "run",
      title: t("並ぶ回", "A run that sorts"),
      actor: "impl",
      to: ["log", "result"],
      summary: runSummary(lucky, t),
      explain: t(
        `入力${inputText(lucky.input)}をシード${lucky.seed}で動かすと、出力は${inputText(lucky.run.output)}で並んでいる。比較器が1つ足りなくても、この入力では足りない比較が要らないので、結果のテストは通る。`,
        `Running input ${inputText(lucky.input)} with seed ${lucky.seed} gives output ${inputText(lucky.run.output)}, which is sorted. Even with a comparator missing, this input never needs the missing comparison, so the result test passes.`,
      ),
      set: {
        impl: { tone: "idle" },
        log: {
          tone: "idle",
          rows: { [t("この回", "this run")]: ioText(lucky) },
        },
        result: { tone: "ok", rows: { [t("この回", "this run")]: t("合格", "pass") } },
      },
      detail: [
        {
          title: t("見えるイベントの並び", "Visible events"),
          fields: [
            {
              label: t("ログ", "Log"),
              value: visibleLog(lucky.run.log).join(" → "),
              isCode: true,
            },
          ],
        },
      ],
    },
    {
      id: "wrong-run",
      kind: "found",
      title: t("並ばない回", "A run that does not sort"),
      actor: "impl",
      to: ["log", "result"],
      summary: runSummary(wrong, t),
      explain: t(
        `入力${inputText(wrong.input)}をシード${wrong.seed}で動かすと、出力は${inputText(wrong.run.output)}で並んでいない。最初の比較器が出した小さい方は、そのまま出口 out.0 に出て、3つ目の入力と比べられない。忘れた比較器は、ここを比べ直す部品だった。`,
        `Running input ${inputText(wrong.input)} with seed ${wrong.seed} gives output ${inputText(wrong.run.output)}, which is not sorted. The smaller value from the first comparator goes straight to out.0 and is never compared with the third input. The missing comparator was the part that compares them again.`,
      ),
      set: {
        impl: { tone: "bad" },
        log: {
          tone: "bad",
          rows: { [t("この回", "this run")]: ioText(wrong) },
        },
        result: {
          tone: "bad",
          rows: { [t("この回", "this run")]: t("不合格", "fail") },
        },
      },
      detail: [
        {
          title: t("見えるイベントの並び", "Visible events"),
          fields: [
            {
              label: t("ログ", "Log"),
              value: visibleLog(wrong.run.log).join(" → "),
              isCode: true,
            },
          ],
        },
      ],
    },
    {
      id: "count",
      kind: "test",
      title: t("落ちた回を数える", "Count the failed runs"),
      actor: "result",
      to: ["log"],
      summary: t(
        `並ばなかったのは入力${failingInputs}の回だけで、${RUN_COUNT}回中${tally.unsortedCount}回`,
        `Only runs with input ${failingInputs} come out unsorted: ${tally.unsortedCount} of ${RUN_COUNT}`,
      ),
      explain: t(
        `${RUN_COUNT}回すべてを結果のテストにかけると、落ちたのは入力${failingInputs}の回だけで、合わせて${tally.unsortedCount}回だった。ほかの入力は、比較器が足りなくても偶然並ぶので、${passedCount}回は通ってしまう。`,
        `Putting all ${RUN_COUNT} runs through the result test, only the runs with input ${failingInputs} failed, ${tally.unsortedCount} in all. Other inputs come out sorted by chance even with a comparator missing, so ${passedCount} runs pass.`,
      ),
      set: {
        log: { tone: "idle", rows: { [t("この回", "this run")]: null } },
        result: {
          tone: "bad",
          rows: {
            [t("この回", "this run")]: null,
            [t("見る", "checks")]: null,
            [t("落ちた", "failed")]: t(
              `${tally.unsortedCount}回`,
              `${tally.unsortedCount}`,
            ),
          },
        },
      },
    },
    {
      id: "oracle",
      kind: "explore",
      title: t("仕様で判定すると", "Judged by the spec"),
      actor: "oracle",
      to: ["log", "spec"],
      summary: t(
        `同じ${RUN_COUNT}回のログを仕様で判定すると${tally.rejectedCount}回落ちる`,
        `Judging the same ${RUN_COUNT} logs with the spec, ${tally.rejectedCount} fail`,
      ),
      explain: t(
        `同じ${RUN_COUNT}回のログを、逐次の仕様（全部読んでから、並べて出す）が起こせるかで判定すると、${tally.rejectedCount}回落ちる。出力が偶然並んでも、途中の順が仕様と違う回まで捕まえるので、結果だけ見るテストより多く落ちる。`,
        `Judging the same ${RUN_COUNT} logs by whether the sequential spec (read everything, then output in order) can produce them, ${tally.rejectedCount} fail. It also catches runs whose output happened to be sorted but whose steps went in an order the spec does not allow, so it fails more runs than the result-only test.`,
      ),
      set: {
        spec: { tone: "ok" },
        oracle: {
          tone: "bad",
          rows: {
            [t("落ちた", "failed")]: t(
              `${tally.rejectedCount}回`,
              `${tally.rejectedCount}`,
            ),
          },
        },
      },
    },
  ];
}

export function exerciseSortTestLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-sort-test",
      title: t("演習: 結果だけ見るテスト", "Exercise: a test that checks the output"),
      subtitle: t(
        "比較器を1つ忘れた実装を、結果のテストは何回落とすか",
        "How often does an output check catch a missing comparator?",
      ),
      summary: t(
        `比較器を1つ忘れた並べ替えの実装を${RUN_COUNT}回動かし、出力が並んでいるかだけを見るテストが何回落ちるかを答える。答えを入れると、実行の例と数え方、仕様で判定した結果を図で追える。`,
        `Run a sorting implementation missing one comparator ${RUN_COUNT} times and answer how many runs fail a test that only checks whether the output is sorted. Once you answer, you can follow example runs, how they are counted, and the result of judging by the spec.`,
      ),
      intro: [
        t(
          "「実装をモデルで検査する」で見た、チャネルで動く並べ替えネットワークを使う。最後の比較器を付け忘れた実装を、入力とシードを変えて何回も動かす。",
          'This uses the channel-based sorting network from "Checking the implementation against the model". The implementation that forgot the last comparator is run many times with different inputs and seeds.',
        ),
        t(
          "図はまず、実装と実行ログと結果のテストの関係だけを見せる。答えを入れると、ログに残った実行の例と、結果のテストのカードに落ちた回数が足されるので、仕様の判定と比べて読む。",
          "The diagram first shows only how the implementation, the execution log and the result test relate. Once you answer, example runs from the log and the number of failures on the result test's card are added; read them against the spec check.",
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t("並べ替えネットワーク", "Sorting network"),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("数（半角数字）", "A number (digits)"),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t(
            "実装をモデルで検査する",
            '"Checking the implementation against the model"',
          ),
        },
      ],
      actors: [
        {
          id: "impl",
          label: t("実装", "Implementation"),
          sublabel: t("チャネルで動く", "runs on channels"),
          icon: "process",
          x: 14,
          y: 27,
        },
        {
          id: "log",
          label: t("実行ログ", "Execution log"),
          sublabel: t("見えるイベント", "visible events"),
          icon: "document",
          x: 50,
          y: 27,
        },
        {
          id: "spec",
          label: t("仕様", "Spec"),
          sublabel: t("逐次の並べ替え", "sequential sort"),
          icon: "spec",
          x: 86,
          y: 27,
        },
        {
          id: "result",
          label: t("結果のテスト", "Result test"),
          sublabel: t("並んでいるか", "is it sorted?"),
          icon: "test",
          x: 30,
          y: 73,
        },
        {
          id: "oracle",
          label: t("仕様の判定", "Spec check"),
          sublabel: t("テストのオラクル", "test oracle"),
          icon: "checker",
          x: 70,
          y: 73,
        },
      ],
      links: [
        { from: "impl", to: "log" },
        { from: "log", to: "result" },
        { from: "log", to: "oracle" },
        { from: "spec", to: "oracle" },
      ],
      answerType: "number",
      answerLabel: t("あなたの答え（回数）", "Your answer (runs)"),
      hint: t(
        "結果のテストが落ちる回数を数で入れる。入れると、図に実行の例と数え方が足される（全部動かすのに少し時間がかかる）。",
        "Enter how many runs fail the result test. Example runs and how they are counted are then added to the diagram (running them all takes a moment).",
      ),
      verdictActor: "result",
      setupSteps: setupSteps(t, language),
      solve: () => {
        const { unsortedCount, rejectedCount, failingInputs } = TALLY();
        return {
          answer: unsortedCount,
          reason: t(
            `出力が並ばなかったのは入力${failingInputs.join("、") || "なし"}の回だけ。ほかの入力は、比較器が足りなくても偶然並ぶ。同じ${RUN_COUNT}回を仕様での判定にかけると${rejectedCount}回落ちる。`,
            `The output was unsorted only on runs with input ${failingInputs.join(", ") || "none"}. Other inputs come out sorted by chance even with a comparator missing. Judging the same ${RUN_COUNT} runs against the spec, ${rejectedCount} fail.`,
          ),
        };
      },
      solutionSteps: () => solutionSteps(t),
    },
    language,
  );
}
