import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import { check, countExecutions } from "../modelCheck";
import { counterModel, isCounterCorrect, runSchedule } from "../models";

const NAIVE = counterModel(2, false);
const NAIVE_CHECK = check(NAIVE);
const NAIVE_RUNS = countExecutions(NAIVE, isCounterCorrect);
const ATOMIC_CHECK = check(counterModel(2, true));
// テストがふだん通る順: Aが読み書きを終えてから Bが動く。
const USUAL_ORDER = ["Aが読む", "Aが書く", "Bが読む", "Bが書く"];
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
  summary: `2つのプロセスが同じカウンタに1ずつ足す。テストは毎回${USUAL_RESULT.count}になって通るのに、動く順によっては1になる。順の組み合わせを全部たどると、${NAIVE_RUNS.total}通りのうち${NAIVE_RUNS.bad}通りで更新が消える。`,
  intro: [
    "並行処理（複数の処理が同時に進むこと）の例として、ここではプロセスAとプロセスBが同じ変数 count を読み、足して、書き戻す。読んでから書くまでの間に相手が割り込むと、片方の更新が消えることがある。これを更新の消失（lost update）と呼ぶ。",
    "テストはいつも同じ順で動きやすく、割り込みが起きる順にはほとんどならないので、何度流しても合格してしまう。形式手法（仕様を数学的に書き、機械で確かめる方法）のモデル検査器は、あり得る動きの順を機械的に全部たどり、テストでは起きにくい順も漏らさず調べる。",
    "図では、まずテストのカードが合格になる様子を見てから、モデル検査器が見つけた手順を順に追う。AとBが count を読む矢印と書き戻す矢印に注目し、Bが書き戻す手で count がどうなるかを見る。",
  ],
  facts: [
    { label: "実行の並び", value: `${NAIVE_RUNS.total}通り` },
    { label: "更新が消える並び", value: `${NAIVE_RUNS.bad}通り`, tone: "bad" },
    { label: "たどった状態", value: `${NAIVE_CHECK.stateCount}個` },
    { label: "実物の道具", value: "TLA+ と TLC" },
    { label: "参考文献", value: `${CSP_BOOK} 2.4.2節（共有変数とロック）` },
  ],
  actors: [
    {
      id: "a",
      label: "プロセスA",
      sublabel: "count に1を足す",
      icon: "process",
      x: 14,
      y: 27,
    },
    {
      id: "b",
      label: "プロセスB",
      sublabel: "count に1を足す",
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
      summary: `いつもの順で動かすと count は${USUAL_RESULT.count}になる`,
      explain:
        "テストを流すと、たいてい Aが読み書きを終えてから Bが動く。この順では count が2になり、テストは通る。何度流しても同じ順になりやすいので、通り続ける。",
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
      summary: `あり得る実行の並びを${NAIVE_RUNS.total}通り全部たどる`,
      explain: `モデル検査器は、AとBの手順がどう入り混じっても全部の並びをたどる。2つのプロセスが2手ずつなら${NAIVE_RUNS.total}通り。テストのように運に任せず、順の組み合わせを漏らさない。`,
      set: {
        checker: {
          isHidden: false,
          tone: "wait",
          rows: {
            並び: `${NAIVE_RUNS.total}通り`,
            状態: `${NAIVE_CHECK.stateCount}個`,
          },
        },
      },
    },
    {
      id: "a-reads",
      kind: "found",
      title: "Aが読む",
      actor: "a",
      to: ["count"],
      summary: "Aが count の0を手元に写す",
      explain:
        "検査器が見つけた反例の並びを1手ずつ再生する。まず Aが count を読み、手元に0を覚える。まだ書き戻していない。",
      set: { a: { tone: "wait", rows: { 手元: String(stateAt(1).tmps[0]) } } },
    },
    {
      id: "b-reads",
      kind: "found",
      title: "Bが読む",
      actor: "b",
      to: ["count"],
      summary: "Aが書く前に、Bも0を読む",
      explain:
        "Aが書き戻す前に Bが動き、同じ0を読む。2つのプロセスが、同じ古い値を元に計算しようとしている。",
      set: { b: { tone: "wait", rows: { 手元: String(stateAt(2).tmps[1]) } } },
    },
    {
      id: "a-writes",
      kind: "found",
      title: "Aが書く",
      actor: "a",
      to: ["count"],
      summary: "Aが0 + 1 = 1を書く",
      explain: "Aが手元の0に1を足して書き戻す。count は1になった。ここまでは正しい。",
      set: {
        a: { tone: "ok", rows: { 手元: null, 状態: "済" } },
        count: { rows: { 値: String(stateAt(3).count) } },
      },
    },
    {
      id: "b-writes",
      kind: "found",
      title: "Bが書く",
      actor: "b",
      to: ["count"],
      summary: "Bも0 + 1 = 1を書き、Aの更新が消える",
      explain: `Bも手元の0に1を足して書き戻す。count は${stateAt(4).count}のまま。2回足したのに1回分が消えた。不変条件「全員が終わったら count は2」が破れた。`,
      set: {
        b: { tone: "bad", rows: { 手元: null, 状態: "済" } },
        count: { tone: "bad", rows: { 値: String(stateAt(4).count), 期待: "2" } },
        checker: { tone: "bad", rows: { 反例: `${TRACE.length - 1}手で発見` } },
      },
      detail: [
        {
          title: "検査器が見つけた反例",
          fields: TRACE.slice(1).map((step, i) => ({
            label: `${i + 1}手目`,
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
      summary: `読みと書きを分けなければ、${ATOMIC_CHECK.stateCount}状態すべてで正しい`,
      explain:
        "読んで書くを分けずに、1手で足す（ロックを取る、原子的な命令を使う）ように直して、もう一度全部たどる。どの順でも count は2になり、反例は見つからない。",
      set: {
        count: { tone: "ok", rows: { 値: "2", 期待: null } },
        checker: {
          tone: "ok",
          rows: { 並び: null, 状態: `${ATOMIC_CHECK.stateCount}個`, 反例: "なし" },
        },
        a: { tone: "ok" },
        b: { tone: "ok" },
      },
      simplified:
        "実物の TLA+ では、プロセスの手順を PlusCal などで書き、TLC が同じように全部の状態をたどる。ここでは検査器を TypeScript で小さく作り、このページの中で実際に動かしている。同じモデルを TLA+ で書いて TLC にかけると、同じ12状態と同じ4手の反例が出る（リポジトリの specs/tla/Counter.tla）。",
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
        { label: "実行の並び", value: `${runs.total}通り` },
        {
          label: "更新が消える並び",
          value: `${runs.bad}通り`,
          tone: runs.bad > 0 ? "bad" : "ok",
        },
        { label: "たどった状態", value: `${result.stateCount}個` },
        {
          label: "最短の反例",
          value: result.violation ? `${result.violation.length - 1}手` : "なし",
          tone: result.violation ? "bad" : "ok",
        },
      ];
    },
  },
};
