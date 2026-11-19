import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { displayName } from "../labels";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import { acceptsTrace, type TraceCheck } from "../csp";
import {
  type NetworkRun,
  runNetwork,
  SORT_IMPL_WIRINGS,
  visibleLog,
} from "../sortImpl";
import {
  SORT_ENV,
  SORT_SIZE,
  SORT_VALUES,
  sortSpec,
  type WiringName,
} from "../sortModels";

const SEED_COUNT = 20;
const SEEDS = Array.from({ length: SEED_COUNT }, (_, k) => k + 1);

/** 0と1 を3つ並べた入力の全部（0-1原理で調べれば足りる入力）。 */
function allInputs(): number[][] {
  let inputs: number[][] = [[]];
  for (let k = 0; k < SORT_SIZE; k += 1) {
    inputs = inputs.flatMap((prefix) => SORT_VALUES.map((v) => [...prefix, v]));
  }
  return inputs;
}
const INPUTS = allInputs();

function isSorted(values: number[]): boolean {
  return values.every((v, k) => k === 0 || values[k - 1]! <= v);
}

function judge(run: NetworkRun): TraceCheck {
  return acceptsTrace(sortSpec(), SORT_ENV, visibleLog(run.log));
}

interface Trial {
  input: number[];
  seed: number;
  run: NetworkRun;
  isSortedOutput: boolean;
  check: TraceCheck;
}

interface Tally {
  trials: Trial[];
  unsorted: number;
  rejected: number;
  rejectedButSorted: number;
  unsortedButAccepted: number;
  /** 全員が最後まで動かずに止まった回（デッドロック） */
  unfinished: number;
  /** 1回でも結果のテストで落ちた入力の数 */
  inputsUnsorted: number;
  /** 1回でも仕様の判定で落ちた入力の数 */
  inputsRejected: number;
}

/** 条件に当たる実行が1回でもある入力の数。 */
function countInputs(trials: Trial[], isHit: (t: Trial) => boolean): number {
  return new Set(trials.filter(isHit).map((t) => t.input.join(","))).size;
}

/** 入力の全部 × シードの全部で実装を動かし、結果のテストと仕様での判定の両方を数える。 */
function tally(wiring: WiringName): Tally {
  const trials = INPUTS.flatMap((input) =>
    SEEDS.map((seed): Trial => {
      const run = runNetwork(SORT_IMPL_WIRINGS[wiring], input, seed);
      return {
        input,
        seed,
        run,
        isSortedOutput: isSorted(run.output),
        check: judge(run),
      };
    }),
  );
  return {
    trials,
    unsorted: trials.filter((t) => !t.isSortedOutput).length,
    rejected: trials.filter((t) => !t.check.isAccepted).length,
    rejectedButSorted: trials.filter((t) => t.isSortedOutput && !t.check.isAccepted)
      .length,
    unsortedButAccepted: trials.filter((t) => !t.isSortedOutput && t.check.isAccepted)
      .length,
    unfinished: trials.filter((t) => !t.run.isFinished).length,
    inputsUnsorted: countInputs(trials, (t) => !t.isSortedOutput),
    inputsRejected: countInputs(trials, (t) => !t.check.isAccepted),
  };
}

const CORRECT = tally("correct");
const MISSING = tally("missingLast");
const TOTAL = CORRECT.trials.length;
const CORRECT_ACCEPTED = TOTAL - CORRECT.rejected;
const CORRECT_SORTED = TOTAL - CORRECT.unsorted;

const SAMPLE_INPUT = [1, 0, 1];
const SAMPLE_SEED = 1;
const SAMPLE_RUN = runNetwork(SORT_IMPL_WIRINGS.correct, SAMPLE_INPUT, SAMPLE_SEED);
const SAMPLE_VISIBLE = visibleLog(SAMPLE_RUN.log);
const SAMPLE_CHECK = judge(SAMPLE_RUN);

// 結果は偶然並んだが、仕様では落ちた実行の最初の1つ
const LUCKY = MISSING.trials.find((t) => t.isSortedOutput && !t.check.isAccepted)!;
const LUCKY_VISIBLE = visibleLog(LUCKY.run.log);
// 結果も並んでいない実行の最初の1つ
const WRONG = MISSING.trials.find((t) => !t.isSortedOutput)!;

type T = (ja: string, en: string) => string;

function verdictText(check: TraceCheck, t: T): string {
  return check.isAccepted ? t("受け付けた", "accepted") : t("受け付けない", "rejected");
}

/** 止まったイベント（先頭から acceptedCount 個の次）。受け付けたときは「なし」。 */
function stoppedAt(log: string[], check: TraceCheck, t: T): string {
  if (check.isAccepted) return t("なし", "none");
  return t(
    `${log[check.acceptedCount]}（${check.acceptedCount + 1}個目）`,
    `${log[check.acceptedCount]} (event ${check.acceptedCount + 1})`,
  );
}

function parseWiring(text: string | undefined): WiringName {
  // 「比較器を忘れた」か英語の "missing" のときだけ忘れた配線にする。それ以外は既定の正しい配線に戻す。
  const trimmed = (text ?? "").toLowerCase();
  return trimmed.includes("忘") || trimmed.includes("missing")
    ? "missingLast"
    : "correct";
}

function parseInput(text: string | undefined): number[] {
  const values = (text ?? "")
    .split(/[,、\s]+/)
    .filter((part) => part !== "")
    .map(Number);
  const isValid =
    values.length === SORT_SIZE && values.every((v) => SORT_VALUES.includes(v));
  return isValid ? values : SAMPLE_INPUT;
}

function parseSeed(text: string | undefined): number {
  const seed = Number((text ?? "").trim());
  return Number.isInteger(seed) && seed > 0 ? seed : SAMPLE_SEED;
}

export function caseImplementLesson(language: Language): Lesson {
  const t = translator(language);
  const verdict = (check: TraceCheck) => verdictText(check, t);
  const times = (n: number) => (n === 1 ? "1 run" : `${n} runs`);
  const inputsEn = (n: number) => (n === 1 ? "1 input" : `${n} inputs`);
  // 比較器の名前は labels.ts の表示名を通す（「比較器3」→ "comparator 3"）。
  const comparator3 = displayName("比較器3", language);
  return {
    id: "case-implement",
    category: "case",
    title: t("実装をモデルで検査する", "Checking the implementation against the model"),
    subtitle: t(
      "実装のログを、逐次の仕様で判定する",
      "Judge the implementation's logs with the sequential spec",
    ),
    summary: t(
      `チャネルで動く実装を${INPUTS.length}通りの入力 × ${SEED_COUNT}のシードで動かし、ログを仕様で判定する。比較器を忘れた実装は、結果のテストでは${MISSING.unsorted}回、仕様の判定では${MISSING.rejected}回落ちる。`,
      `A channel-based implementation is run on ${INPUTS.length} inputs × ${SEED_COUNT} seeds, and its logs are judged by the spec. The implementation missing a comparator fails the result test in ${times(MISSING.unsorted)} but the spec check in ${times(MISSING.rejected)}.`,
    ),
    intro: [
      t(
        "事例の最後として、チャネルで動く並べ替えの実装を作り、その実行ログを前のレッスンで確かめた仕様で判定する。シード（乱数の種）を変えると、並行に動く比較器の受け渡しの順が変わる。",
        "To finish the case study, build a channel-based sorting implementation and judge its execution logs with the spec checked in the previous lesson. Changing the seed (the starting value for the random numbers) changes the order of hand-offs between the comparators running in parallel.",
      ),
      t(
        "結果がたまたま正しく出た実行でも、途中の順番が誤っていることがある。そこで、出力が並んでいるかの確認とは別に、ログに残ったイベントの並びを仕様で判定する方法を試す。",
        "Even a run whose result happens to be right can go through its steps in a wrong order. So, apart from checking that the output is sorted, try judging the sequence of events left in the log with the spec.",
      ),
      t(
        "図では「実装」から「実行ログ」へ進み、そこから「結果のテスト」と「仕様の判定」の2つに分かれる流れを追う。比較器を忘れた実装に替えたとき、2つの判定がそれぞれどの実行で落ちるかの違いが分かれ目になる。",
        'In the diagram, follow the flow from "Implementation" to "Execution log", where it splits into "Result test" and "Spec check". The key point is which runs each of the two checks fails once the implementation is swapped for one missing a comparator.',
      ),
    ],
    facts: [
      {
        label: t("実行の回数", "Runs"),
        value: t(
          `${INPUTS.length}通り × ${SEED_COUNT} = ${TOTAL}回`,
          `${INPUTS.length} inputs × ${SEED_COUNT} = ${TOTAL}`,
        ),
      },
      {
        label: t("正しい実装", "Correct implementation"),
        value: t(
          `${TOTAL}回中${CORRECT_ACCEPTED}回を受け付けた`,
          `${CORRECT_ACCEPTED} of ${TOTAL} accepted`,
        ),
        tone: CORRECT.rejected === 0 ? "ok" : "bad",
      },
      {
        label: t("忘れた実装（結果のテスト）", "Missing comparator (result test)"),
        value: t(
          `${TOTAL}回中${MISSING.unsorted}回で落ちる`,
          `fails ${MISSING.unsorted} of ${TOTAL}`,
        ),
        tone: "bad",
      },
      {
        label: t("忘れた実装（仕様の判定）", "Missing comparator (spec check)"),
        value: t(
          `${TOTAL}回中${MISSING.rejected}回で落ちる`,
          `fails ${MISSING.rejected} of ${TOTAL}`,
        ),
        tone: "bad",
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 10.3節（JCSPによる実装）`,
          `${CSP_BOOK_EN}, section 10.3 (implementation with JCSP)`,
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
        initial: {
          rows: { [t("状態", "status")]: t("まだ動かしていない", "not run yet") },
        },
      },
      {
        id: "log",
        label: t("実行ログ", "Execution log"),
        sublabel: t("見えるイベント", "visible events"),
        icon: "document",
        x: 50,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: t("逐次の並べ替え", "sequential sort"),
        icon: "spec",
        x: 86,
        y: 27,
        initial: {
          rows: {
            [t("状態", "status")]: t("等価を確かめ済み", "equivalence checked"),
          },
        },
      },
      {
        id: "result",
        label: t("結果のテスト", "Result test"),
        sublabel: t("並んでいるか", "is it sorted?"),
        icon: "test",
        x: 30,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "oracle",
        label: t("仕様の判定", "Spec check"),
        sublabel: t("テストのオラクル", "test oracle"),
        icon: "checker",
        x: 70,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "impl", to: "log" },
      { from: "impl", to: "result" },
      { from: "log", to: "oracle" },
      { from: "spec", to: "oracle" },
    ],
    steps: [
      {
        id: "runtime",
        kind: "spec",
        title: t("小さな実行環境", "A small runtime"),
        actor: "impl",
        summary: t(
          "比較器をそれぞれ並行に動かし、送り手と受け手がそろったときだけ受け渡す",
          "Run each comparator in parallel; a hand-off happens only when sender and receiver are both ready",
        ),
        explain: t(
          "実装は、Go の goroutine とチャネルのように、比較器・値を入れる係・受け取る係を並行に動かす。チャネルの受け渡しは、送り手と受け手がそろったときだけ起きる（モデルの同期と同じ）。どの組から動かすかはシード付きの乱数で決めるので、毎回違う順で動く並行実行を、同じシードなら同じ順で再現できる。",
          "Like goroutines and channels in Go, the implementation runs the comparators, a feeder that puts values in and a collector that takes them out, all in parallel. A hand-off on a channel happens only when sender and receiver are both ready (the same as synchronisation in the model). Seeded random numbers decide which pair moves next, so a concurrent run whose order changes every time can be replayed in the same order with the same seed.",
        ),
        set: {
          impl: {
            tone: "wait",
            rows: {
              [t("状態", "status")]: t("モデルと同じ配線", "same wiring as model"),
            },
          },
        },
        simplified: t(
          "実物のスレッドではなく、ジェネレーター関数を1つの実行環境が順番に進める作り。参考文献の JCSP（Java のライブラリ）の代わりに、同じ受け渡しの規則だけを再現している。",
          "Instead of real threads, a single runtime steps generator functions in turn. In place of JCSP (the Java library in the reference), it reproduces only the same hand-off rule.",
        ),
      },
      {
        id: "run",
        kind: "run",
        title: t("動かしてログを取る", "Run it and log"),
        actor: "impl",
        to: ["log"],
        summary: t(
          `入力${SAMPLE_INPUT.join(",")}・シード${SAMPLE_SEED}で、出力は${SAMPLE_RUN.output.join(",")}。見えるイベントは${SAMPLE_VISIBLE.length}個`,
          `Input ${SAMPLE_INPUT.join(",")} with seed ${SAMPLE_SEED} outputs ${SAMPLE_RUN.output.join(",")}. ${SAMPLE_VISIBLE.length} visible events`,
        ),
        explain: t(
          `正しい配線の実装に${SAMPLE_INPUT.join(",")}を入れて動かすと、${SAMPLE_RUN.log.length}回の受け渡しがログに残る。内部の線（w.*）を除き、外から見える入口と出口のイベント${SAMPLE_VISIBLE.length}個だけを取り出す。仕様にも内部の線は出てこないので、配線の作りに関係なく同じ仕様で判定できる。`,
          `Running the correctly wired implementation on ${SAMPLE_INPUT.join(",")} leaves ${SAMPLE_RUN.log.length} hand-offs in the log. Drop the internal wires (w.*) and keep only the ${SAMPLE_VISIBLE.length} input and output events visible from outside. The spec has no internal wires either, so the same spec can judge any wiring.`,
        ),
        set: {
          impl: {
            tone: "ok",
            rows: {
              [t("状態", "status")]: null,
              [t("出力", "output")]: SAMPLE_RUN.output.join(","),
            },
          },
          log: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("件数", "count")]: t(
                `${SAMPLE_VISIBLE.length}個`,
                `${SAMPLE_VISIBLE.length}`,
              ),
              [t("先頭", "first")]: SAMPLE_VISIBLE[0] ?? t("なし", "none"),
              [t("最後", "last")]: SAMPLE_VISIBLE.at(-1) ?? t("なし", "none"),
            },
          },
        },
        detail: [
          {
            title: t("見えるイベント", "Visible events"),
            fields: SAMPLE_VISIBLE.map((ev, index) => ({
              label: `${index + 1}`,
              value: ev,
              isCode: true,
            })),
          },
        ],
      },
      {
        id: "judge",
        kind: "test",
        title: t("仕様で判定する", "Judge with the spec"),
        actor: "oracle",
        to: ["log", "spec"],
        summary: t(
          `acceptsTrace の結果: ${verdict(SAMPLE_CHECK)}（${SAMPLE_CHECK.acceptedCount}個）`,
          `acceptsTrace result: ${verdict(SAMPLE_CHECK)} (${SAMPLE_CHECK.acceptedCount} events)`,
        ),
        explain: t(
          `判定役はログを先頭から1つずつ読み、逐次の仕様がその順でイベントを起こせるかを確かめる。${SAMPLE_CHECK.acceptedCount}個すべてを仕様が起こせたので${verdict(SAMPLE_CHECK)}。前のレッスンで並行版と等価だと確かめた仕様を、そのままテストの判定役（オラクル）に使っている。`,
          `The oracle reads the log one event at a time from the start and checks that the sequential spec can perform the events in that order. The spec could perform all ${SAMPLE_CHECK.acceptedCount}, so the log is ${verdict(SAMPLE_CHECK)}. The spec shown equivalent to the concurrent version in the previous lesson is used directly as the test's judge (oracle).`,
        ),
        set: {
          oracle: {
            isHidden: false,
            tone: SAMPLE_CHECK.isAccepted ? "ok" : "bad",
            rows: { [t("判定", "verdict")]: verdict(SAMPLE_CHECK) },
          },
          log: { tone: "ok" },
        },
        simplified: t(
          `acceptsTrace はログが仕様のトレースの先頭部分かどうかを見る。途中で切れたログも受け付けるので、最後まで動き終えたか（デッドロックしなかったか）は実装の側で別に見る。正しい実装で止まった回は${CORRECT.unfinished}回、比較器を忘れた実装でも${MISSING.unfinished}回。`,
          `acceptsTrace checks whether the log is a prefix of a trace of the spec. It also accepts a log cut off midway, so whether the run finished (did not deadlock) is checked separately on the implementation side. The correct implementation got stuck in ${times(CORRECT.unfinished)}, and the one missing a comparator in ${times(MISSING.unfinished)} too.`,
        ),
      },
      {
        id: "all-runs",
        kind: "test",
        title: t(`${TOTAL}回まわす`, `Run it ${TOTAL} times`),
        actor: "oracle",
        to: ["result"],
        summary: t(
          `正しい実装は${TOTAL}回中、並んだのが${CORRECT_SORTED}回、仕様が受け付けたのが${CORRECT_ACCEPTED}回`,
          `Of ${TOTAL} runs of the correct implementation, ${CORRECT_SORTED} were sorted and the spec accepted ${CORRECT_ACCEPTED}`,
        ),
        explain: t(
          `入力${INPUTS.length}通り × シード${SEED_COUNT}個の${TOTAL}回を動かし、出力が並んでいるか（結果のテスト）と、ログを仕様が受け付けるか（仕様の判定）を両方見る。正しい実装はどちらも${TOTAL}回すべて通る。`,
          `Run all ${TOTAL} combinations of ${INPUTS.length} inputs × ${SEED_COUNT} seeds, and check both whether the output is sorted (result test) and whether the spec accepts the log (spec check). The correct implementation passes both in all ${TOTAL} runs.`,
        ),
        set: {
          result: {
            isHidden: false,
            tone: CORRECT.unsorted === 0 ? "ok" : "bad",
            rows: {
              [t("落ちた", "failed")]: t(
                `${CORRECT.unsorted}回`,
                `${CORRECT.unsorted}`,
              ),
            },
          },
          oracle: {
            tone: CORRECT.rejected === 0 ? "ok" : "bad",
            rows: {
              [t("判定", "verdict")]: null,
              [t("落ちた", "failed")]: t(
                `${CORRECT.rejected}回`,
                `${CORRECT.rejected}`,
              ),
            },
          },
          log: {
            rows: {
              [t("件数", "count")]: t(`${TOTAL}回分`, `${TOTAL} runs`),
              [t("先頭", "first")]: null,
              [t("最後", "last")]: null,
            },
          },
        },
      },
      {
        id: "missing-result",
        kind: "found",
        title: t(
          `結果のテストは${MISSING.unsorted}回`,
          `Result test: ${MISSING.unsorted} failures`,
        ),
        actor: "result",
        summary: t(
          `比較器を忘れた実装: 出力が並ばないのは${TOTAL}回中${MISSING.unsorted}回（入力${MISSING.inputsUnsorted}通り）だけ`,
          `Missing a comparator: the output is unsorted in only ${MISSING.unsorted} of ${TOTAL} runs (${inputsEn(MISSING.inputsUnsorted)})`,
        ),
        explain: t(
          `比較器3を忘れた実装で同じ${TOTAL}回を動かす。出力が並ばずに結果のテストで落ちるのは${MISSING.unsorted}回だけ（例: 入力${WRONG.input.join(",")}・シード${WRONG.seed}で出力${WRONG.run.output.join(",")}）。比較器は受け取った2つの小さい方と大きい方を出すだけなので、出力は入力だけで決まり、シードでは変わらない。結果が崩れるのは${INPUTS.length}通りの入力のうち${MISSING.inputsUnsorted}通りだけ。`,
          `Run the same ${TOTAL} with the implementation that leaves out ${comparator3}. Only ${times(MISSING.unsorted)} fail the result test with unsorted output (e.g. input ${WRONG.input.join(",")} with seed ${WRONG.seed} outputs ${WRONG.run.output.join(",")}). A comparator just sends out the smaller and larger of the two values it got, so the output depends only on the input, not on the seed. The result goes wrong for only ${MISSING.inputsUnsorted} of the ${INPUTS.length} inputs.`,
        ),
        set: {
          impl: {
            tone: "bad",
            rows: {
              [t("出力", "output")]: null,
              [t("配線", "wiring")]: t("比較器を忘れた", "missing a comparator"),
            },
          },
          result: {
            tone: "bad",
            rows: {
              [t("落ちた", "failed")]: t(
                `${MISSING.unsorted}回`,
                `${MISSING.unsorted}`,
              ),
            },
          },
          oracle: {
            tone: "idle",
            rows: { [t("落ちた", "failed")]: t("まだ", "not yet") },
          },
        },
      },
      {
        id: "missing-oracle",
        kind: "found",
        title: t(
          `仕様の判定は${MISSING.rejected}回`,
          `Spec check: ${MISSING.rejected} failures`,
        ),
        actor: "oracle",
        to: ["log", "spec"],
        summary: t(
          `ログを仕様で判定すると${MISSING.rejected}回落ちる。そのうち${MISSING.rejectedButSorted}回は結果が並んでいた（入力${MISSING.inputsRejected}通り）`,
          `Judging the logs with the spec fails ${times(MISSING.rejected)}. In ${MISSING.rejectedButSorted} of them the result was sorted (${inputsEn(MISSING.inputsRejected)})`,
        ),
        explain: t(
          `同じ${TOTAL}回のログを仕様で判定すると${MISSING.rejected}回落ちる。落ちた入力は${INPUTS.length}通り中${MISSING.inputsRejected}通りで、そのうち${MISSING.rejectedButSorted}回は結果が正しく並んでいたのに、3つ全部を読む前に出口へ出していた（例: 入力${LUCKY.input.join(",")}・シード${LUCKY.seed}は${stoppedAt(LUCKY_VISIBLE, LUCKY.check, t)}で止まる）。シードで変わるのは、受け渡しの順に「先に出した」ことが現れるかどうか。`,
          `Judging the logs of the same ${TOTAL} runs with the spec fails ${times(MISSING.rejected)}. The failing inputs are ${MISSING.inputsRejected} of ${INPUTS.length}, and in ${MISSING.rejectedButSorted} runs the result was correctly sorted, yet a value was sent to an output before all three were read (e.g. input ${LUCKY.input.join(",")} with seed ${LUCKY.seed} stops at ${stoppedAt(LUCKY_VISIBLE, LUCKY.check, t)}). What the seed changes is whether "sent too early" shows up in the order of hand-offs.`,
        ),
        set: {
          oracle: {
            tone: "bad",
            rows: {
              [t("落ちた", "failed")]: t(
                `${MISSING.rejected}回`,
                `${MISSING.rejected}`,
              ),
              [t("結果は並んでいた", "yet sorted")]: t(
                `${MISSING.rejectedButSorted}回`,
                `${MISSING.rejectedButSorted}`,
              ),
            },
          },
          log: { tone: "bad" },
        },
        detail: [
          {
            title: t(
              `入力${LUCKY.input.join(",")}・シード${LUCKY.seed}の見えるログ（出力${LUCKY.run.output.join(",")}）`,
              `Visible log for input ${LUCKY.input.join(",")}, seed ${LUCKY.seed} (output ${LUCKY.run.output.join(",")})`,
            ),
            fields: LUCKY_VISIBLE.map((ev, index) => ({
              label: `${index + 1}`,
              value: ev,
              isCode: true,
              tone: index === LUCKY.check.acceptedCount ? ("bad" as const) : undefined,
              note:
                index === LUCKY.check.acceptedCount
                  ? t("ここで止まる", "stops here")
                  : undefined,
            })),
          },
        ],
      },
      {
        id: "lesson",
        kind: "test",
        title: t("振る舞いを判定する", "Judge the behaviour"),
        actor: "oracle",
        to: ["result"],
        summary: t(
          "結果だけを見るテストより、イベントの並びをモデルで判定するテストの方が、並行の不具合を多く捕まえる",
          "A test that judges the sequence of events with the model catches more concurrency bugs than one that looks only at results",
        ),
        explain: t(
          `結果だけを見るテストは、結果がたまたま正しくなる入力では、振る舞いの誤りを見逃す（落ちる入力は${INPUTS.length}通り中${MISSING.inputsUnsorted}通り）。イベントの並びをモデルで判定すると、結果が正しくても途中の振る舞いが仕様から外れた回を捕まえられる（${MISSING.inputsRejected}通りの入力で、${MISSING.unsorted}回に対して${MISSING.rejected}回）。期待値を手で書かずに済むのも、モデルを判定役にする利点。`,
          `A test that looks only at results misses wrong behaviour on inputs where the result happens to come out right (it fails on ${MISSING.inputsUnsorted} of ${INPUTS.length} inputs). Judging the sequence of events with the model catches runs whose behaviour strays from the spec even when the result is right (${MISSING.rejected} runs instead of ${MISSING.unsorted}, over ${inputsEn(MISSING.inputsRejected)}). Not having to write expected values by hand is another benefit of using the model as the judge.`,
        ),
        set: {
          spec: {
            tone: "ok",
            rows: {
              [t("状態", "status")]: t("判定役として使った", "used as the oracle"),
            },
          },
        },
        simplified: t(
          `「3つ全部を読んでから出す」は、このサイトの仕様で決めたこと。それを破った回を不具合として数えている。出力が並べばよいだけの用途なら、結果が並んでいた${MISSING.rejectedButSorted}回は害のない振る舞いと見ることもできる。ただし同じ振る舞い（3つを見る前に最小を決める）が、入力${WRONG.input.join(",")}では誤った出力になる。どこまでを仕様にするかは、設計で決める。`,
          `"Read all three before sending" is a choice made in this site's spec, and runs that break it are counted as bugs. If all you need is sorted output, the ${MISSING.rejectedButSorted} runs whose result was sorted could be seen as harmless. But the same behaviour (deciding the minimum before seeing all three) gives wrong output on input ${WRONG.input.join(",")}. How much belongs in the spec is a design decision.`,
        ),
      },
    ],
    lab: {
      title: t("実装を動かして判定する", "Run and judge the implementation"),
      hint: t(
        "配線は「正しい」か「比較器を忘れた」。入力は0 か1 を3つ、シードは1以上の整数。",
        'Wiring is "correct" or "missing a comparator". Input is three values, each 0 or 1; the seed is an integer of 1 or more.',
      ),
      inputs: [
        {
          id: "wiring",
          label: t(
            "配線（正しい / 比較器を忘れた）",
            "Wiring (correct / missing a comparator)",
          ),
          initial: t("比較器を忘れた", "missing a comparator"),
        },
        {
          id: "input",
          label: t("入力（0か1 を3つ）", "Input (three 0s or 1s)"),
          initial: LUCKY.input.join(","),
        },
        { id: "seed", label: t("シード", "Seed"), initial: String(LUCKY.seed) },
      ],
      compute: (values): Field[] => {
        const wiring = parseWiring(values.wiring);
        const input = parseInput(values.input);
        const seed = parseSeed(values.seed);
        const run = runNetwork(SORT_IMPL_WIRINGS[wiring], input, seed);
        const visible = visibleLog(run.log);
        const check = acceptsTrace(sortSpec(), SORT_ENV, visible);
        const sorted = isSorted(run.output);
        return [
          {
            label: t("配線", "Wiring"),
            value:
              wiring === "correct"
                ? t("正しい", "correct")
                : t("比較器を忘れた", "missing a comparator"),
          },
          {
            label: t("入力・シード", "Input, seed"),
            value: t(`${input.join(",")}・${seed}`, `${input.join(",")}; ${seed}`),
          },
          { label: t("出力", "Output"), value: run.output.join(",") },
          {
            label: t("結果のテスト", "Result test"),
            value: sorted ? t("並んでいる", "sorted") : t("並んでいない", "not sorted"),
            tone: sorted ? "ok" : "bad",
          },
          {
            label: t("仕様の判定", "Spec check"),
            value: verdict(check),
            tone: check.isAccepted ? "ok" : "bad",
            note: t(
              `止まった所: ${stoppedAt(visible, check, t)}`,
              `stopped at: ${stoppedAt(visible, check, t)}`,
            ),
          },
          {
            label: t("見えるログ", "Visible log"),
            value: visible.join(", "),
            isCode: true,
          },
        ];
      },
    },
  };
}
