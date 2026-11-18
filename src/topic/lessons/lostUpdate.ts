import type { Field, Lesson } from "../../core/types";
import { check, countExecutions } from "../modelCheck";
import { counterModel, isCounterCorrect, runSchedule } from "../models";

const NAIVE = counterModel(2, false);
const NAIVE_CHECK = check(NAIVE);
const NAIVE_RUNS = countExecutions(NAIVE, isCounterCorrect);
const ATOMIC_CHECK = check(counterModel(2, true));
// テストがふだん通る順: A が読み書きを終えてから B が動く。
const USUAL_ORDER = ["A が読む", "A が書く", "B が読む", "B が書く"];
const USUAL_RESULT = runSchedule(USUAL_ORDER, false);
// 反例の手順（検査器が見つけた最短の並び）。trace[0] は初期状態。
const TRACE = NAIVE_CHECK.violation!;

function stateAt(index: number) {
  return TRACE[index]!.state;
}

function parseCount(text: string | undefined): number {
  const value = Number.parseInt(text ?? "", 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 4) : 2;
}

export const lostUpdateLesson: Lesson = {
  id: "lost-update",
  category: "basics",
  title: "テストが見逃すバグ",
  subtitle: "2つの処理が同じ値に1を足す",
  summary: `2つのプロセスが同じカウンタに 1 ずつ足す。テストは毎回 ${USUAL_RESULT.count} になって通るのに、動く順によっては 1 になる。順の組み合わせを全部たどると、${NAIVE_RUNS.total} 通りのうち ${NAIVE_RUNS.bad} 通りで更新が消える。`,
  facts: [
    { label: "実行の並び", value: `${NAIVE_RUNS.total} 通り` },
    { label: "更新が消える並び", value: `${NAIVE_RUNS.bad} 通り`, tone: "bad" },
    { label: "たどった状態", value: `${NAIVE_CHECK.stateCount} 個` },
    { label: "実物の道具", value: "TLA+ と TLC" },
  ],
  actors: [
    {
      id: "a",
      label: "プロセスA",
      sublabel: "count に 1 を足す",
      icon: "process",
      x: 14,
      y: 27,
    },
    {
      id: "b",
      label: "プロセスB",
      sublabel: "count に 1 を足す",
      icon: "process",
      x: 14,
      y: 73,
    },
    {
      id: "count",
      label: "count",
      sublabel: "共有の変数",
      icon: "variable",
      x: 50,
      y: 50,
      initial: { rows: { 値: "0" } },
    },
    {
      id: "test",
      label: "テスト",
      sublabel: "1回だけ流す",
      icon: "test",
      x: 86,
      y: 27,
    },
    {
      id: "checker",
      label: "モデル検査器",
      sublabel: "全部の順をたどる",
      icon: "checker",
      x: 86,
      y: 73,
      initial: { isHidden: true },
    },
  ],
  links: [
    { from: "a", to: "count" },
    { from: "b", to: "count" },
    { from: "test", to: "a" },
    { from: "test", to: "b" },
    { from: "checker", to: "count" },
  ],
  steps: [
    {
      id: "run-test",
      kind: "run",
      title: "テストを流す",
      actor: "test",
      to: ["a", "b"],
      summary: `いつもの順で動かすと count は ${USUAL_RESULT.count} になる`,
      explain:
        "テストを流すと、たいてい A が読み書きを終えてから B が動く。この順では count が 2 になり、テストは通る。何度流しても同じ順になりやすいので、通り続ける。",
      set: {
        test: { tone: "ok", rows: { 結果: `合格（count=${USUAL_RESULT.count}）` } },
      },
      detail: [
        {
          title: "テストで動いた順",
          fields: [{ label: "順", value: USUAL_ORDER.join(" → ") }],
        },
      ],
    },
    {
      id: "explore",
      kind: "explore",
      title: "全部の順をたどる",
      actor: "checker",
      to: ["count"],
      summary: `あり得る実行の並びを ${NAIVE_RUNS.total} 通り全部たどる`,
      explain: `モデル検査器は、A と B の手順がどう入り混じっても全部の並びをたどる。2 つのプロセスが 2 手ずつなら ${NAIVE_RUNS.total} 通り。テストのように運に任せず、順の組み合わせを漏らさない。`,
      set: {
        checker: {
          isHidden: false,
          tone: "wait",
          rows: {
            並び: `${NAIVE_RUNS.total} 通り`,
            状態: `${NAIVE_CHECK.stateCount} 個`,
          },
        },
      },
    },
    {
      id: "a-reads",
      kind: "found",
      title: "A が読む",
      actor: "a",
      to: ["count"],
      summary: "A が count の 0 を手元に写す",
      explain:
        "検査器が見つけた反例の並びを1手ずつ再生する。まず A が count を読み、手元に 0 を覚える。まだ書き戻していない。",
      set: { a: { tone: "wait", rows: { 手元: String(stateAt(1).tmps[0]) } } },
    },
    {
      id: "b-reads",
      kind: "found",
      title: "B が読む",
      actor: "b",
      to: ["count"],
      summary: "A が書く前に、B も 0 を読む",
      explain:
        "A が書き戻す前に B が動き、同じ 0 を読む。2 つのプロセスが、同じ古い値を元に計算しようとしている。",
      set: { b: { tone: "wait", rows: { 手元: String(stateAt(2).tmps[1]) } } },
    },
    {
      id: "a-writes",
      kind: "found",
      title: "A が書く",
      actor: "a",
      to: ["count"],
      summary: "A が 0 + 1 = 1 を書く",
      explain:
        "A が手元の 0 に 1 を足して書き戻す。count は 1 になった。ここまでは正しい。",
      set: {
        a: { tone: "ok", rows: { 手元: null, 状態: "済" } },
        count: { rows: { 値: String(stateAt(3).count) } },
      },
    },
    {
      id: "b-writes",
      kind: "found",
      title: "B が書く",
      actor: "b",
      to: ["count"],
      summary: "B も 0 + 1 = 1 を書き、A の更新が消える",
      explain: `B も手元の 0 に 1 を足して書き戻す。count は ${stateAt(4).count} のまま。2 回足したのに 1 回分が消えた。不変条件「全員が終わったら count は 2」が破れた。`,
      set: {
        b: { tone: "bad", rows: { 手元: null, 状態: "済" } },
        count: { tone: "bad", rows: { 値: String(stateAt(4).count), 期待: "2" } },
        checker: { tone: "bad", rows: { 反例: `${TRACE.length - 1} 手で発見` } },
      },
      detail: [
        {
          title: "検査器が見つけた反例",
          fields: TRACE.slice(1).map((step, i) => ({
            label: `${i + 1} 手目`,
            value: step.action ?? "",
            note: `count=${step.state.count}`,
          })),
        },
      ],
    },
    {
      id: "fix",
      kind: "fix",
      title: "1手で足すように直す",
      actor: "checker",
      to: ["count"],
      summary: `読みと書きを分けなければ、${ATOMIC_CHECK.stateCount} 状態すべてで正しい`,
      explain:
        "読んで書くを分けずに、1 手で足す（ロックを取る、原子的な命令を使う）ように直して、もう一度全部たどる。どの順でも count は 2 になり、反例は見つからない。",
      set: {
        count: { tone: "ok", rows: { 値: "2", 期待: null } },
        checker: {
          tone: "ok",
          rows: { 並び: null, 状態: `${ATOMIC_CHECK.stateCount} 個`, 反例: "なし" },
        },
        a: { tone: "ok" },
        b: { tone: "ok" },
      },
      simplified:
        "実物の TLA+ では、プロセスの手順を PlusCal などで書き、TLC が同じように全部の状態をたどる。ここでは検査器を TypeScript で小さく作り、このページの中で実際に動かしている。",
    },
  ],
  lab: {
    title: "プロセスの数を変える",
    hint: "プロセスが増えると、並びの数は急に増え、正しく終わる並びの割合は小さくなる。足し方を「1手」にすると反例は消える。",
    inputs: [
      { id: "count", label: "プロセスの数（1〜4）", initial: "2" },
      { id: "atomic", label: "足し方（2手 / 1手）", initial: "2手" },
    ],
    compute: (values): Field[] => {
      const processCount = parseCount(values.count);
      const isAtomic = (values.atomic ?? "").includes("1");
      const model = counterModel(processCount, isAtomic);
      const runs = countExecutions(model, isCounterCorrect);
      const result = check(model);
      return [
        { label: "プロセスの数", value: String(processCount) },
        { label: "実行の並び", value: `${runs.total} 通り` },
        {
          label: "更新が消える並び",
          value: `${runs.bad} 通り`,
          tone: runs.bad > 0 ? "bad" : "ok",
        },
        { label: "たどった状態", value: `${result.stateCount} 個` },
        {
          label: "最短の反例",
          value: result.violation ? `${result.violation.length - 1} 手` : "なし",
          tone: result.violation ? "bad" : "ok",
        },
      ];
    },
  },
};
