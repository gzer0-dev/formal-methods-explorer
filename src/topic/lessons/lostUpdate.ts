import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { displayName, displayNames } from "../labels";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
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

export function lostUpdateLesson(language: Language): Lesson {
  const t = translator(language);
  const steps = (actions: string[]) => displayNames(actions, language);
  return {
    id: "lost-update",
    category: "basics",
    title: t("テストが見逃すバグ", "The bug your tests miss"),
    subtitle: t("2つの処理が同じ値に1を足す", "Two processes add 1 to the same value"),
    summary: t(
      `2つのプロセスが同じカウンタに1ずつ足す。テストは毎回${USUAL_RESULT.count}になって通るのに、動く順によっては1になる。順の組み合わせを全部たどると、${NAIVE_RUNS.total}通りのうち${NAIVE_RUNS.bad}通りで更新が消える。`,
      `Two processes each add 1 to a shared counter. The test gets ${USUAL_RESULT.count} every time and passes, yet some orders end at 1. Walking every interleaving, ${NAIVE_RUNS.bad} of the ${NAIVE_RUNS.total} lose an update.`,
    ),
    intro: [
      t(
        "並行処理（複数の処理が同時に進むこと）の例として、ここではプロセスAとプロセスBが同じ変数 count を読み、足して、書き戻す。読んでから書くまでの間に相手が割り込むと、片方の更新が消えることがある。これを更新の消失（lost update）と呼ぶ。",
        "As an example of concurrency (several things running at once), processes A and B each read the shared variable count, add 1, and write it back. If the other process slips in between the read and the write, one update can vanish. This is called a lost update.",
      ),
      t(
        "テストはいつも同じ順で動きやすく、割り込みが起きる順にはほとんどならないので、何度流しても合格してしまう。形式手法（仕様を数学的に書き、機械で確かめる方法）のモデル検査器は、あり得る動きの順を機械的に全部たどり、テストでは起きにくい順も漏らさず調べる。",
        "A test tends to run in the same order every time and almost never hits the interleaving that breaks, so it passes no matter how often you run it. A model checker, one of the tools of formal methods (writing a spec precisely and checking it by machine), walks every possible order, including the ones tests rarely reach.",
      ),
      t(
        "図では、まずテストのカードが合格になる様子を見てから、モデル検査器が見つけた手順を順に追う。AとBが count を読む矢印と書き戻す矢印に注目し、Bが書き戻す手で count がどうなるかを見る。",
        "In the diagram, first watch the test card pass, then follow the steps the model checker found. Watch the arrows where A and B read count and write it back, and see what count becomes when B writes.",
      ),
    ],
    facts: [
      {
        label: t("実行の並び", "Interleavings"),
        value: t(`${NAIVE_RUNS.total}通り`, `${NAIVE_RUNS.total}`),
      },
      {
        label: t("更新が消える並び", "Lose an update"),
        value: t(`${NAIVE_RUNS.bad}通り`, `${NAIVE_RUNS.bad}`),
        tone: "bad",
      },
      {
        label: t("たどった状態", "States explored"),
        value: t(`${NAIVE_CHECK.stateCount}個`, `${NAIVE_CHECK.stateCount}`),
      },
      { label: t("実物の道具", "Real tools"), value: t("TLA+ と TLC", "TLA+ and TLC") },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 2.4.2節（共有変数とロック）`,
          `${CSP_BOOK_EN}, section 2.4.2 (shared variables and locks)`,
        ),
      },
    ],
    actors: [
      {
        id: "a",
        label: t("プロセスA", "Process A"),
        sublabel: t("count に1を足す", "adds 1 to count"),
        icon: "process",
        x: 14,
        y: 27,
      },
      {
        id: "b",
        label: t("プロセスB", "Process B"),
        sublabel: t("count に1を足す", "adds 1 to count"),
        icon: "process",
        x: 14,
        y: 73,
      },
      {
        id: "count",
        label: "count",
        sublabel: t("共有の変数", "shared variable"),
        icon: "variable",
        x: 50,
        y: 50,
        initial: { rows: { [t("値", "value")]: "0" } },
      },
      {
        id: "test",
        label: t("テスト", "Test"),
        sublabel: t("1回だけ流す", "runs once"),
        icon: "test",
        x: 86,
        y: 27,
      },
      {
        id: "checker",
        label: t("モデル検査器", "Model checker"),
        sublabel: t("全部の順をたどる", "walks every order"),
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
        title: t("テストを流す", "Run the test"),
        actor: "test",
        to: ["a", "b"],
        summary: t(
          `いつもの順で動かすと count は${USUAL_RESULT.count}になる`,
          `In the usual order, count ends at ${USUAL_RESULT.count}`,
        ),
        explain: t(
          `テストを流すと、たいてい Aが読み書きを終えてから Bが動く。この順では count が${USUAL_RESULT.count}になり、テストは通る。何度流しても同じ順になりやすいので、通り続ける。`,
          `When the test runs, A usually finishes reading and writing before B starts. In that order count becomes ${USUAL_RESULT.count} and the test passes. Runs tend to repeat the same order, so it keeps passing.`,
        ),
        set: {
          test: {
            tone: "ok",
            rows: {
              [t("結果", "result")]: t(
                `合格（count=${USUAL_RESULT.count}）`,
                `pass (count=${USUAL_RESULT.count})`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("テストで動いた順", "Order the test ran in"),
            fields: [{ label: t("順", "Order"), value: steps(USUAL_ORDER) }],
          },
        ],
      },
      {
        id: "explore",
        kind: "explore",
        title: t("全部の順をたどる", "Walk every order"),
        actor: "checker",
        to: ["count"],
        summary: t(
          `あり得る実行の並びを${NAIVE_RUNS.total}通り全部たどる`,
          `Walks all ${NAIVE_RUNS.total} possible interleavings`,
        ),
        explain: t(
          `モデル検査器は、AとBの手順がどう入り混じっても全部の並びをたどる。2つのプロセスが2手ずつなら${NAIVE_RUNS.total}通り。テストのように運に任せず、順の組み合わせを漏らさない。`,
          `The model checker walks every way the steps of A and B can interleave. With two processes of two steps each there are ${NAIVE_RUNS.total}. Unlike a test, it does not rely on luck and misses no ordering.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("並び", "orders")]: t(
                `${NAIVE_RUNS.total}通り`,
                `${NAIVE_RUNS.total}`,
              ),
              [t("状態", "states")]: t(
                `${NAIVE_CHECK.stateCount}個`,
                `${NAIVE_CHECK.stateCount}`,
              ),
            },
          },
        },
      },
      {
        id: "a-reads",
        kind: "found",
        title: t("Aが読む", "A reads"),
        actor: "a",
        to: ["count"],
        summary: t(
          `Aが count の${stateAt(1).tmps[0]}を手元に写す`,
          `A copies count (${stateAt(1).tmps[0]}) into its local`,
        ),
        explain: t(
          `検査器が見つけた反例の並びを1手ずつ再生する。まず Aが count を読み、手元に${stateAt(1).tmps[0]}を覚える。まだ書き戻していない。`,
          `Now replay, one step at a time, the counterexample the checker found. First A reads count and keeps ${stateAt(1).tmps[0]} locally. It has not written back yet.`,
        ),
        set: {
          a: {
            tone: "wait",
            rows: { [t("手元", "local")]: String(stateAt(1).tmps[0]) },
          },
        },
      },
      {
        id: "b-reads",
        kind: "found",
        title: t("Bが読む", "B reads"),
        actor: "b",
        to: ["count"],
        summary: t(
          `Aが書く前に、Bも${stateAt(2).tmps[1]}を読む`,
          `Before A writes, B also reads ${stateAt(2).tmps[1]}`,
        ),
        explain: t(
          `Aが書き戻す前に Bが動き、同じ${stateAt(2).tmps[1]}を読む。2つのプロセスが、同じ古い値を元に計算しようとしている。`,
          `B runs before A writes back and reads the same ${stateAt(2).tmps[1]}. Both processes are about to compute from the same stale value.`,
        ),
        set: {
          b: {
            tone: "wait",
            rows: { [t("手元", "local")]: String(stateAt(2).tmps[1]) },
          },
        },
      },
      {
        id: "a-writes",
        kind: "found",
        title: t("Aが書く", "A writes"),
        actor: "a",
        to: ["count"],
        summary: t(
          `Aが${stateAt(2).tmps[0]} + 1 = ${stateAt(3).count}を書く`,
          `A writes ${stateAt(2).tmps[0]} + 1 = ${stateAt(3).count}`,
        ),
        explain: t(
          `Aが手元の${stateAt(2).tmps[0]}に1を足して書き戻す。count は${stateAt(3).count}になった。ここまでは正しい。`,
          `A adds 1 to its local ${stateAt(2).tmps[0]} and writes it back. count is now ${stateAt(3).count}. So far, so good.`,
        ),
        set: {
          a: {
            tone: "ok",
            rows: { [t("手元", "local")]: null, [t("状態", "state")]: t("済", "done") },
          },
          count: { rows: { [t("値", "value")]: String(stateAt(3).count) } },
        },
      },
      {
        id: "b-writes",
        kind: "found",
        title: t("Bが書く", "B writes"),
        actor: "b",
        to: ["count"],
        summary: t(
          `Bも${stateAt(3).tmps[1]} + 1 = ${stateAt(4).count}を書き、Aの更新が消える`,
          `B also writes ${stateAt(3).tmps[1]} + 1 = ${stateAt(4).count}, and A's update is lost`,
        ),
        explain: t(
          `Bも手元の${stateAt(3).tmps[1]}に1を足して書き戻す。count は${stateAt(4).count}のまま。2回足したのに1回分が消えた。不変条件「全員が終わったら count は2」が破れた。`,
          `B adds 1 to its local ${stateAt(3).tmps[1]} and writes it back. count stays at ${stateAt(4).count}. It was incremented twice, but one increment is gone. The invariant "when everyone is done, count is 2" is broken.`,
        ),
        set: {
          b: {
            tone: "bad",
            rows: { [t("手元", "local")]: null, [t("状態", "state")]: t("済", "done") },
          },
          count: {
            tone: "bad",
            rows: {
              [t("値", "value")]: String(stateAt(4).count),
              [t("期待", "expected")]: "2",
            },
          },
          checker: {
            tone: "bad",
            rows: {
              [t("反例", "counterexample")]: t(
                `${TRACE.length - 1}手で発見`,
                `found in ${TRACE.length - 1} steps`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("検査器が見つけた反例", "Counterexample the checker found"),
            fields: TRACE.slice(1).map((step, i) => ({
              label: t(`${i + 1}手目`, `Step ${i + 1}`),
              value: displayName(step.action ?? "", language),
              note: `count=${step.state.count}`,
            })),
          },
        ],
      },
      {
        id: "fix",
        kind: "fix",
        title: t("1手で足すように直す", "Fix: add in one step"),
        actor: "checker",
        to: ["count"],
        summary: t(
          `読みと書きを分けなければ、${ATOMIC_CHECK.stateCount}状態すべてで正しい`,
          `Without splitting read and write, all ${ATOMIC_CHECK.stateCount} states are correct`,
        ),
        explain: t(
          "読んで書くを分けずに、1手で足す（ロックを取る、原子的な命令を使う）ように直して、もう一度全部たどる。どの順でも count は2になり、反例は見つからない。",
          "Change the code to add in a single step (take a lock, or use an atomic instruction) instead of a separate read and write, and walk everything again. In every order count ends at 2, and no counterexample is found.",
        ),
        set: {
          count: {
            tone: "ok",
            rows: { [t("値", "value")]: "2", [t("期待", "expected")]: null },
          },
          checker: {
            tone: "ok",
            rows: {
              [t("並び", "orders")]: null,
              [t("状態", "states")]: t(
                `${ATOMIC_CHECK.stateCount}個`,
                `${ATOMIC_CHECK.stateCount}`,
              ),
              [t("反例", "counterexample")]: t("なし", "none"),
            },
          },
          a: { tone: "ok" },
          b: { tone: "ok" },
        },
        simplified: t(
          `実物の TLA+ では、プロセスの手順を PlusCal などで書き、TLC が同じように全部の状態をたどる。ここでは検査器を TypeScript で小さく作り、このページの中で実際に動かしている。同じモデルを TLA+ で書いて TLC にかけると、同じ${NAIVE_CHECK.stateCount}状態と同じ${TRACE.length - 1}手の反例が出る（リポジトリの specs/tla/Counter.tla）。`,
          `With real TLA+ you write the process steps in PlusCal or similar, and TLC walks every state the same way. Here the checker is a small TypeScript program running in this page. Writing the same model in TLA+ and running TLC gives the same ${NAIVE_CHECK.stateCount} states and the same ${TRACE.length - 1}-step counterexample (specs/tla/Counter.tla in the repository).`,
        ),
      },
    ],
    lab: {
      title: t("プロセスの数を変える", "Change the number of processes"),
      hint: t(
        "プロセスが増えると、並びの数は急に増え、正しく終わる並びの割合は小さくなる。足し方を「1手」にすると反例は消える。",
        "With more processes the number of interleavings grows fast and the share that ends correctly shrinks. Adding in 1 step makes the counterexample go away.",
      ),
      inputs: [
        {
          id: "count",
          label: t("プロセスの数（1〜4）", "Processes (1-4)"),
          initial: "2",
        },
        {
          id: "atomic",
          label: t("足し方（2手 / 1手）", "Addition (2 steps / 1 step)"),
          initial: t("2手", "2 steps"),
        },
      ],
      compute: (values): Field[] => {
        const processCount = parseCount(values.count);
        const isAtomic = (values.atomic ?? "").includes("1");
        const model = counterModel(processCount, isAtomic);
        const runs = countExecutions(model, isCounterCorrect);
        const result = check(model);
        return [
          { label: t("プロセスの数", "Processes"), value: String(processCount) },
          {
            label: t("実行の並び", "Interleavings"),
            value: t(`${runs.total}通り`, `${runs.total}`),
          },
          {
            label: t("更新が消える並び", "Lose an update"),
            value: t(`${runs.bad}通り`, `${runs.bad}`),
            tone: runs.bad > 0 ? "bad" : "ok",
          },
          {
            label: t("たどった状態", "States explored"),
            value: t(`${result.stateCount}個`, `${result.stateCount}`),
          },
          {
            label: t("最短の反例", "Shortest counterexample"),
            value: result.violation
              ? t(
                  `${result.violation.length - 1}手`,
                  `${result.violation.length - 1} steps`,
                )
              : t("なし", "none"),
            tone: result.violation ? "bad" : "ok",
          },
        ];
      },
    },
  };
}
