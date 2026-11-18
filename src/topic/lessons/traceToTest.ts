import type { Field, Lesson } from "../../core/types";
import { check } from "../modelCheck";
import { counterModel, runSchedule } from "../models";

// 検査器が見つけた最短の反例。trace[0] は初期状態なので、操作は1番目から。
const TRACE = check(counterModel(2, false)).violation!;
const SCHEDULE = TRACE.slice(1).map((step) => step.action ?? "");
const BUGGY_RESULT = runSchedule(SCHEDULE, false);
// 直した実装は「読んで書く」を1手で行うので、操作の名前も1手のものになる。
const FIXED_SCHEDULE = ["Aが足す", "Bが足す"];
const FIXED_RESULT = runSchedule(FIXED_SCHEDULE, true);

function parseSchedule(text: string | undefined): string[] {
  const steps = (text ?? "")
    .split(/[,、，]/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
  return steps.length > 0 ? steps : SCHEDULE;
}

function resultLabel(isCorrect: boolean): string {
  return isCorrect ? "合格" : "不合格";
}

export const traceToTestLesson: Lesson = {
  id: "trace-to-test",
  category: "testing",
  title: "反例をテストにする",
  subtitle: "検査器の手順を、毎回同じに再現するテストへ",
  summary: `モデル検査器が見つけた${SCHEDULE.length}手の反例を、動く順を固定したテストに書き写す。直す前は毎回 count=${BUGGY_RESULT.count}で落ち、直した後は count=${FIXED_RESULT.count}で通る。`,
  facts: [
    { label: "反例の手数", value: `${SCHEDULE.length}手` },
    {
      label: "直す前",
      value: `count=${BUGGY_RESULT.count}（${resultLabel(BUGGY_RESULT.isCorrect)}）`,
      tone: "bad",
    },
    {
      label: "直した後",
      value: `count=${FIXED_RESULT.count}（${resultLabel(FIXED_RESULT.isCorrect)}）`,
      tone: "ok",
    },
    { label: "テストの性質", value: "毎回同じ順で動く" },
  ],
  actors: [
    {
      id: "checker",
      label: "モデル検査器",
      sublabel: "全部の順をたどった",
      icon: "checker",
      x: 14,
      y: 50,
      initial: { tone: "bad", rows: { 反例: `${SCHEDULE.length}手` } },
    },
    {
      id: "trace",
      label: "反例の手順",
      sublabel: "動いた順の記録",
      icon: "route",
      x: 38,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "test",
      label: "テスト",
      sublabel: "順を固定して流す",
      icon: "test",
      x: 62,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "impl",
      label: "実装",
      sublabel: "count に1を足す",
      icon: "process",
      x: 86,
      y: 50,
      initial: { rows: { 足し方: "読む・書くの2手" } },
    },
  ],
  stageHeight: 300,
  links: [
    { from: "checker", to: "trace" },
    { from: "trace", to: "test" },
    { from: "test", to: "impl" },
  ],
  steps: [
    {
      id: "take-trace",
      kind: "found",
      title: "反例を受け取る",
      actor: "checker",
      to: ["trace"],
      summary: `検査器が見つけた最短の反例は${SCHEDULE.length}手`,
      explain:
        "モデル検査器は、更新が消える並びを最短の手順として返す。この手順は「どの順で動くと壊れるか」の正確な記録なので、そのままテストの材料になる。",
      set: {
        trace: {
          isHidden: false,
          tone: "bad",
          rows: Object.fromEntries(SCHEDULE.map((step, i) => [`${i + 1}`, step])),
        },
      },
      detail: [
        {
          title: "検査器が見つけた手順",
          fields: TRACE.slice(1).map((step, i) => ({
            label: `${i + 1}手目`,
            value: step.action ?? "",
            note: `count=${step.state.count}`,
          })),
        },
      ],
    },
    {
      id: "fix-order",
      kind: "spec",
      title: "動く順を固定する",
      actor: "trace",
      to: ["test"],
      summary: "手順をそのまま、テストの中の決まった順に書き写す",
      explain:
        "ふつうのテストでは、どちらのプロセスが先に動くかは実行のたびに運で決まる。反例の手順どおりに動く順を決めて書けば、何度流しても同じ並びで動く、決定的に再現するテストになる。",
      set: {
        test: {
          isHidden: false,
          tone: "wait",
          rows: { 順: `${SCHEDULE.length}手を固定` },
        },
      },
      simplified:
        "実務では、スレッドが「読んだ直後」などの決まった位置で止まるようにフック（差し込み口）や待ち合わせ（ラッチやバリア）を置き、もう一方を先に進めてから再開させて順を固定する。ここでは操作の名前を並べて順に呼ぶだけで再現している。",
    },
    {
      id: "test-fails",
      kind: "test",
      title: "直す前は必ず落ちる",
      actor: "test",
      to: ["impl"],
      summary: `固定した順で流すと count=${BUGGY_RESULT.count}になり、毎回落ちる`,
      explain: `決めた順で動かすと、2回足したのに count は${BUGGY_RESULT.count}になる。順を固定したので、たまに落ちるテストではなく毎回落ちるテストになった。原因を調べている間も、何度でも同じ失敗を見られる。`,
      set: {
        test: {
          tone: "bad",
          rows: {
            結果: `${resultLabel(BUGGY_RESULT.isCorrect)}（count=${BUGGY_RESULT.count}）`,
          },
        },
        impl: { tone: "bad", rows: { count: String(BUGGY_RESULT.count) } },
      },
    },
    {
      id: "fix-impl",
      kind: "fix",
      title: "1手で足すように直す",
      actor: "impl",
      summary: "読みと書きの間に割り込めないようにする",
      explain:
        "ロックを取る、または原子的な命令を使い、読んで書くを1手にする。間に他のプロセスが割り込めないので、古い値を元に書き戻すことが起きなくなる。",
      set: {
        impl: { tone: "wait", rows: { 足し方: "1手（割り込めない）", count: null } },
      },
    },
    {
      id: "test-passes",
      kind: "test",
      title: "同じテストが通る",
      actor: "test",
      to: ["impl"],
      summary: `直した実装では count=${FIXED_RESULT.count}になり、テストが通る`,
      explain: `同じ2つのプロセスを決めた順で動かすと、count は${FIXED_RESULT.count}になる。落ちていたテストが通ったことで、直した箇所が本当に原因だったと確かめられる。`,
      set: {
        test: {
          tone: "ok",
          rows: {
            結果: `${resultLabel(FIXED_RESULT.isCorrect)}（count=${FIXED_RESULT.count}）`,
          },
        },
        impl: { tone: "ok", rows: { count: String(FIXED_RESULT.count) } },
      },
      detail: [
        {
          title: "直した後の順",
          fields: FIXED_SCHEDULE.map((step, i) => ({
            label: `${i + 1}手目`,
            value: step,
          })),
        },
      ],
      simplified:
        "このページのモデルでは、直した実装は操作が「足す」1つになるので、テストの順も「Aが足す → Bが足す」に書き換えている。実務では、同じ割り込み位置で止めるテストをそのまま直した実装に流す。",
    },
    {
      id: "keep",
      kind: "test",
      title: "回帰テストに残す",
      actor: "test",
      to: ["checker"],
      summary: "同じバグが戻ったら、このテストが毎回落として知らせる",
      explain:
        "このテストを残しておけば、後で誰かがロックを外しても毎回落ちて気づける。検査器は設計の段階で全部の順を調べ、テストは見つかった危ない順を実装の上で見張り続ける、という分担になる。",
      set: {
        test: { rows: { 役目: "回帰テスト" } },
        checker: { tone: "ok", rows: { 反例: "テストに移した" } },
        trace: { tone: "ok" },
      },
    },
  ],
  lab: {
    title: "動く順を決めて流す",
    hint: "「Aが読む」「Aが書く」「Bが読む」「Bが書く」をカンマ区切りで並べる。読む前に書くなど、動けない順を入れるとそこで止まる。足し方は2手の実装で試す。",
    inputs: [
      { id: "schedule", label: "動く順（カンマ区切り）", initial: SCHEDULE.join(",") },
    ],
    compute: (values): Field[] => {
      const schedule = parseSchedule(values.schedule);
      const order: Field = { label: "動く順", value: schedule.join(" → ") };
      try {
        const result = runSchedule(schedule, false);
        return [
          order,
          { label: "count", value: String(result.count) },
          {
            label: "結果",
            value: resultLabel(result.isCorrect),
            tone: result.isCorrect ? "ok" : "bad",
          },
        ];
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return [
          order,
          { label: "結果", value: "この順では動けない", tone: "wait", note: reason },
        ];
      }
    },
  },
};
