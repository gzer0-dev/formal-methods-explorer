import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
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

function verdictText(check: TraceCheck): string {
  return check.isAccepted ? "受け付けた" : "受け付けない";
}

/** 止まったイベント（先頭から acceptedCount 個の次）。受け付けたときは「なし」。 */
function stoppedAt(log: string[], check: TraceCheck): string {
  if (check.isAccepted) return "なし";
  return `${log[check.acceptedCount]}（${check.acceptedCount + 1}個目）`;
}

function parseWiring(text: string | undefined): WiringName {
  return (text ?? "").includes("忘") ? "missingLast" : "correct";
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

export const caseImplementLesson: Lesson = {
  id: "case-implement",
  category: "case",
  title: "実装をモデルで検査する",
  subtitle: "実装のログを、逐次の仕様で判定する",
  summary: `チャネルで動く実装を${INPUTS.length}通りの入力 × ${SEED_COUNT}のシードで動かし、ログを仕様で判定する。比較器を忘れた実装は、結果のテストでは${MISSING.unsorted}回、仕様の判定では${MISSING.rejected}回落ちる。`,
  intro: [
    "事例の最後として、チャネルで動く並べ替えの実装を作り、その実行ログを前のレッスンで確かめた仕様で判定する。シード（乱数の種）を変えると、並行に動く比較器の受け渡しの順が変わる。",
    "結果がたまたま正しく出た実行でも、途中の順番が誤っていることがある。そこで、出力が並んでいるかの確認とは別に、ログに残ったイベントの並びを仕様で判定する方法を試す。",
    "図では「実装」から「実行ログ」へ進み、そこから「結果のテスト」と「仕様の判定」の2つに分かれる流れを追う。比較器を忘れた実装に替えたとき、2つの判定がそれぞれどの実行で落ちるかの違いが分かれ目になる。",
  ],
  facts: [
    { label: "実行の回数", value: `${INPUTS.length}通り × ${SEED_COUNT} = ${TOTAL}回` },
    {
      label: "正しい実装",
      value: `${TOTAL}回中${CORRECT_ACCEPTED}回を受け付けた`,
      tone: CORRECT.rejected === 0 ? "ok" : "bad",
    },
    {
      label: "忘れた実装（結果のテスト）",
      value: `${TOTAL}回中${MISSING.unsorted}回で落ちる`,
      tone: "bad",
    },
    {
      label: "忘れた実装（仕様の判定）",
      value: `${TOTAL}回中${MISSING.rejected}回で落ちる`,
      tone: "bad",
    },
    { label: "参考文献", value: `${CSP_BOOK} 10.3節（JCSPによる実装）` },
  ],
  actors: [
    {
      id: "impl",
      label: "実装",
      sublabel: "チャネルで動く",
      icon: "process",
      x: 14,
      y: 27,
      initial: { rows: { 状態: "まだ動かしていない" } },
    },
    {
      id: "log",
      label: "実行ログ",
      sublabel: "見えるイベント",
      icon: "document",
      x: 50,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "spec",
      label: "仕様",
      sublabel: "逐次の並べ替え",
      icon: "spec",
      x: 86,
      y: 27,
      initial: { rows: { 状態: "等価を確かめ済み" } },
    },
    {
      id: "result",
      label: "結果のテスト",
      sublabel: "並んでいるか",
      icon: "test",
      x: 30,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "oracle",
      label: "仕様の判定",
      sublabel: "テストのオラクル",
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
      title: "小さな実行環境",
      actor: "impl",
      summary: "比較器をそれぞれ並行に動かし、送り手と受け手がそろったときだけ受け渡す",
      explain:
        "実装は、Go の goroutine とチャネルのように、比較器・値を入れる係・受け取る係を並行に動かす。チャネルの受け渡しは、送り手と受け手がそろったときだけ起きる（モデルの同期と同じ）。どの組から動かすかはシード付きの乱数で決めるので、毎回違う順で動く並行実行を、同じシードなら同じ順で再現できる。",
      set: { impl: { tone: "wait", rows: { 状態: "モデルと同じ配線" } } },
      simplified:
        "実物のスレッドではなく、ジェネレーター関数を1つの実行環境が順番に進める作り。参考文献の JCSP（Java のライブラリ）の代わりに、同じ受け渡しの規則だけを再現している。",
    },
    {
      id: "run",
      kind: "run",
      title: "動かしてログを取る",
      actor: "impl",
      to: ["log"],
      summary: `入力${SAMPLE_INPUT.join(",")}・シード${SAMPLE_SEED}で、出力は${SAMPLE_RUN.output.join(",")}。見えるイベントは${SAMPLE_VISIBLE.length}個`,
      explain: `正しい配線の実装に${SAMPLE_INPUT.join(",")}を入れて動かすと、${SAMPLE_RUN.log.length}回の受け渡しがログに残る。内部の線（w.*）を除き、外から見える入口と出口のイベント${SAMPLE_VISIBLE.length}個だけを取り出す。仕様にも内部の線は出てこないので、配線の作りに関係なく同じ仕様で判定できる。`,
      set: {
        impl: { tone: "ok", rows: { 状態: null, 出力: SAMPLE_RUN.output.join(",") } },
        log: {
          isHidden: false,
          tone: "wait",
          rows: {
            件数: `${SAMPLE_VISIBLE.length}個`,
            先頭: SAMPLE_VISIBLE[0] ?? "なし",
            最後: SAMPLE_VISIBLE.at(-1) ?? "なし",
          },
        },
      },
      detail: [
        {
          title: "見えるイベント",
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
      title: "仕様で判定する",
      actor: "oracle",
      to: ["log", "spec"],
      summary: `acceptsTrace の結果: ${verdictText(SAMPLE_CHECK)}（${SAMPLE_CHECK.acceptedCount}個）`,
      explain: `判定役はログを先頭から1つずつ読み、逐次の仕様がその順でイベントを起こせるかを確かめる。${SAMPLE_CHECK.acceptedCount}個すべてを仕様が起こせたので${verdictText(SAMPLE_CHECK)}。前のレッスンで並行版と等価だと確かめた仕様を、そのままテストの判定役（オラクル）に使っている。`,
      set: {
        oracle: {
          isHidden: false,
          tone: SAMPLE_CHECK.isAccepted ? "ok" : "bad",
          rows: { 判定: verdictText(SAMPLE_CHECK) },
        },
        log: { tone: "ok" },
      },
      simplified: `acceptsTrace はログが仕様のトレースの先頭部分かどうかを見る。途中で切れたログも受け付けるので、最後まで動き終えたか（デッドロックしなかったか）は実装の側で別に見る。正しい実装で止まった回は${CORRECT.unfinished}回、比較器を忘れた実装でも${MISSING.unfinished}回。`,
    },
    {
      id: "all-runs",
      kind: "test",
      title: `${TOTAL}回まわす`,
      actor: "oracle",
      to: ["result"],
      summary: `正しい実装は${TOTAL}回中、並んだのが${CORRECT_SORTED}回、仕様が受け付けたのが${CORRECT_ACCEPTED}回`,
      explain: `入力${INPUTS.length}通り × シード${SEED_COUNT}個の${TOTAL}回を動かし、出力が並んでいるか（結果のテスト）と、ログを仕様が受け付けるか（仕様の判定）を両方見る。正しい実装はどちらも${TOTAL}回すべて通る。`,
      set: {
        result: {
          isHidden: false,
          tone: CORRECT.unsorted === 0 ? "ok" : "bad",
          rows: { 落ちた: `${CORRECT.unsorted}回` },
        },
        oracle: {
          tone: CORRECT.rejected === 0 ? "ok" : "bad",
          rows: { 判定: null, 落ちた: `${CORRECT.rejected}回` },
        },
        log: { rows: { 件数: `${TOTAL}回分`, 先頭: null, 最後: null } },
      },
    },
    {
      id: "missing-result",
      kind: "found",
      title: `結果のテストは${MISSING.unsorted}回`,
      actor: "result",
      summary: `比較器を忘れた実装: 出力が並ばないのは${TOTAL}回中${MISSING.unsorted}回（入力${MISSING.inputsUnsorted}通り）だけ`,
      explain: `比較器3を忘れた実装で同じ${TOTAL}回を動かす。出力が並ばずに結果のテストで落ちるのは${MISSING.unsorted}回だけ（例: 入力${WRONG.input.join(",")}・シード${WRONG.seed}で出力${WRONG.run.output.join(",")}）。比較器は受け取った2つの小さい方と大きい方を出すだけなので、出力は入力だけで決まり、シードでは変わらない。結果が崩れるのは${INPUTS.length}通りの入力のうち${MISSING.inputsUnsorted}通りだけ。`,
      set: {
        impl: { tone: "bad", rows: { 出力: null, 配線: "比較器を忘れた" } },
        result: { tone: "bad", rows: { 落ちた: `${MISSING.unsorted}回` } },
        oracle: { tone: "idle", rows: { 落ちた: "まだ" } },
      },
    },
    {
      id: "missing-oracle",
      kind: "found",
      title: `仕様の判定は${MISSING.rejected}回`,
      actor: "oracle",
      to: ["log", "spec"],
      summary: `ログを仕様で判定すると${MISSING.rejected}回落ちる。そのうち${MISSING.rejectedButSorted}回は結果が並んでいた（入力${MISSING.inputsRejected}通り）`,
      explain: `同じ${TOTAL}回のログを仕様で判定すると${MISSING.rejected}回落ちる。落ちた入力は${INPUTS.length}通り中${MISSING.inputsRejected}通りで、そのうち${MISSING.rejectedButSorted}回は結果が正しく並んでいたのに、3つ全部を読む前に出口へ出していた（例: 入力${LUCKY.input.join(",")}・シード${LUCKY.seed}は${stoppedAt(LUCKY_VISIBLE, LUCKY.check)}で止まる）。シードで変わるのは、受け渡しの順に「先に出した」ことが現れるかどうか。`,
      set: {
        oracle: {
          tone: "bad",
          rows: {
            落ちた: `${MISSING.rejected}回`,
            結果は並んでいた: `${MISSING.rejectedButSorted}回`,
          },
        },
        log: { tone: "bad" },
      },
      detail: [
        {
          title: `入力${LUCKY.input.join(",")}・シード${LUCKY.seed}の見えるログ（出力${LUCKY.run.output.join(",")}）`,
          fields: LUCKY_VISIBLE.map((ev, index) => ({
            label: `${index + 1}`,
            value: ev,
            isCode: true,
            tone: index === LUCKY.check.acceptedCount ? ("bad" as const) : undefined,
            note: index === LUCKY.check.acceptedCount ? "ここで止まる" : undefined,
          })),
        },
      ],
    },
    {
      id: "lesson",
      kind: "test",
      title: "振る舞いを判定する",
      actor: "oracle",
      to: ["result"],
      summary:
        "結果だけを見るテストより、イベントの並びをモデルで判定するテストの方が、並行の不具合を多く捕まえる",
      explain: `結果だけを見るテストは、結果がたまたま正しくなる入力では、振る舞いの誤りを見逃す（落ちる入力は${INPUTS.length}通り中${MISSING.inputsUnsorted}通り）。イベントの並びをモデルで判定すると、結果が正しくても途中の振る舞いが仕様から外れた回を捕まえられる（${MISSING.inputsRejected}通りの入力で、${MISSING.unsorted}回に対して${MISSING.rejected}回）。期待値を手で書かずに済むのも、モデルを判定役にする利点。`,
      set: { spec: { tone: "ok", rows: { 状態: "判定役として使った" } } },
      simplified: `「3つ全部を読んでから出す」は、このサイトの仕様で決めたこと。それを破った回を不具合として数えている。出力が並べばよいだけの用途なら、結果が並んでいた${MISSING.rejectedButSorted}回は害のない振る舞いと見ることもできる。ただし同じ振る舞い（3つを見る前に最小を決める）が、入力${WRONG.input.join(",")}では誤った出力になる。どこまでを仕様にするかは、設計で決める。`,
    },
  ],
  lab: {
    title: "実装を動かして判定する",
    hint: "配線は「正しい」か「比較器を忘れた」。入力は0 か1 を3つ、シードは1以上の整数。",
    inputs: [
      {
        id: "wiring",
        label: "配線（正しい / 比較器を忘れた）",
        initial: "比較器を忘れた",
      },
      { id: "input", label: "入力（0か1 を3つ）", initial: LUCKY.input.join(",") },
      { id: "seed", label: "シード", initial: String(LUCKY.seed) },
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
        { label: "配線", value: wiring === "correct" ? "正しい" : "比較器を忘れた" },
        { label: "入力・シード", value: `${input.join(",")}・${seed}` },
        { label: "出力", value: run.output.join(",") },
        {
          label: "結果のテスト",
          value: sorted ? "並んでいる" : "並んでいない",
          tone: sorted ? "ok" : "bad",
        },
        {
          label: "仕様の判定",
          value: verdictText(check),
          tone: check.isAccepted ? "ok" : "bad",
          note: `止まった所: ${stoppedAt(visible, check)}`,
        },
        { label: "見えるログ", value: visible.join(", "), isCode: true },
      ];
    },
  },
};
