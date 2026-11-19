import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { displayName, displayNames } from "../labels";
import { check } from "../modelCheck";
import { counterModel, PROCESS_NAMES, runSchedule } from "../models";

// 検査器が見つけた最短の反例。trace[0] は初期状態なので、操作は1番目から。
const TRACE = check(counterModel(2, false)).violation!;
const SCHEDULE = TRACE.slice(1).map((step) => step.action ?? "");
const BUGGY_RESULT = runSchedule(SCHEDULE, false);
// 直した実装は「読んで書く」を1手で行うので、操作の名前も1手のものになる。
const FIXED_SCHEDULE = ["Aが足す", "Bが足す"];
const FIXED_RESULT = runSchedule(FIXED_SCHEDULE, true);

// 英語の画面で打った操作名（"A reads" など）を、計算が読む日本語の操作名に戻す表。
// 表示名は labels.ts の displayName から作り、大文字小文字と空白の違いは無視する。
const ENGLISH_TO_ACTION = new Map(
  PROCESS_NAMES.flatMap((name) => [`${name}が読む`, `${name}が書く`]).map((action) => [
    normalizeEnglish(displayName(action, "en")),
    action,
  ]),
);

function normalizeEnglish(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

function parseSchedule(text: string | undefined): string[] {
  const steps = (text ?? "")
    .split(/[,、，]/)
    .map((step) => {
      const english = ENGLISH_TO_ACTION.get(normalizeEnglish(step));
      return english ?? step.replace(/\s+/g, ""); // 「A が読む」と空白入りで打っても通す
    })
    .filter((step) => step.length > 0);
  return steps.length > 0 ? steps : SCHEDULE;
}

// runSchedule が動けない順で投げる例外の文言（models.ts）。英語の画面では、動けなかった操作名だけを取り出して訳す。
const STUCK_PREFIX = "この順では動けない: ";

export function traceToTestLesson(language: Language): Lesson {
  const t = translator(language);
  const resultLabel = (isCorrect: boolean): string =>
    isCorrect ? t("合格", "pass") : t("不合格", "fail");
  const stepsText = (count: number): string =>
    t(`${count}手`, count === 1 ? "1 step" : `${count} steps`);
  return {
    id: "trace-to-test",
    category: "testing",
    title: t("反例をテストにする", "Turning a counterexample into a test"),
    subtitle: t(
      "検査器の手順を、毎回同じに再現するテストへ",
      "From the checker's steps to a test that reproduces them every time",
    ),
    summary: t(
      `モデル検査器が見つけた${SCHEDULE.length}手の反例を、動く順を固定したテストに書き写す。直す前は毎回 count=${BUGGY_RESULT.count}で落ち、直した後は count=${FIXED_RESULT.count}で通る。`,
      `Copy the ${SCHEDULE.length}-step counterexample the model checker found into a test with a fixed order. Before the fix it fails every time with count=${BUGGY_RESULT.count}; after the fix it passes with count=${FIXED_RESULT.count}.`,
    ),
    intro: [
      t(
        "反例とは、守るべき性質を破る実行の手順のことだ。このレッスンでは、モデル検査器が見つけた反例を、プロセスの動く順を固定したテストに書き写す。題材は「テストが見逃すバグ」で見た、2つのプロセスが count に1を足すカウンタである。",
        'A counterexample is a sequence of steps in a run that breaks a property that should hold. In this lesson we copy the counterexample the model checker found into a test that fixes the order in which processes move. The example is the counter from "The bug your tests miss", where two processes add 1 to count.',
      ),
      t(
        "並行処理のバグは、どちらが先に動くかが実行のたびに変わるので、テストを流してもたまにしか落ちない。検査器が返した手順どおりに順を固定すれば、同じ失敗を毎回再現でき、直した後は回帰テスト（同じバグが戻ったら気づくためのテスト）として残せる。",
        "With a concurrency bug, which process moves first changes from run to run, so the test fails only now and then. Fixing the order to the steps the checker returned reproduces the same failure every time, and after the fix it can stay as a regression test (a test that tells you if the same bug comes back).",
      ),
      t(
        "図では、左のモデル検査器から反例の手順、テスト、右の実装へと受け渡される流れを追う。転換点は実装を「1手で足す」形に直す場面で、その前後でテストのカードの結果がどう変わるかを見比べる。",
        'In the diagram, follow the hand-off from the model checker on the left, to the counterexample steps, to the test, to the implementation on the right. The turning point is where the implementation is fixed to "add in one step"; compare the test card\'s result before and after.',
      ),
    ],
    facts: [
      {
        label: t("反例の手数", "Counterexample length"),
        value: stepsText(SCHEDULE.length),
      },
      {
        label: t("直す前", "Before the fix"),
        value: t(
          `count=${BUGGY_RESULT.count}（${resultLabel(BUGGY_RESULT.isCorrect)}）`,
          `count=${BUGGY_RESULT.count} (${resultLabel(BUGGY_RESULT.isCorrect)})`,
        ),
        tone: "bad",
      },
      {
        label: t("直した後", "After the fix"),
        value: t(
          `count=${FIXED_RESULT.count}（${resultLabel(FIXED_RESULT.isCorrect)}）`,
          `count=${FIXED_RESULT.count} (${resultLabel(FIXED_RESULT.isCorrect)})`,
        ),
        tone: "ok",
      },
      {
        label: t("テストの性質", "The test"),
        value: t("毎回同じ順で動く", "runs in the same order every time"),
      },
    ],
    actors: [
      {
        id: "checker",
        label: t("モデル検査器", "Model checker"),
        sublabel: t("全部の順をたどった", "walked every order"),
        icon: "checker",
        x: 14,
        y: 50,
        initial: {
          tone: "bad",
          rows: { [t("反例", "counterexample")]: stepsText(SCHEDULE.length) },
        },
      },
      {
        id: "trace",
        label: t("反例の手順", "Counterexample"),
        sublabel: t("動いた順の記録", "record of the order"),
        icon: "route",
        x: 38,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "test",
        label: t("テスト", "Test"),
        sublabel: t("順を固定して流す", "fixed order"),
        icon: "test",
        x: 62,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "impl",
        label: t("実装", "Implementation"),
        sublabel: t("count に1を足す", "adds 1 to count"),
        icon: "process",
        x: 86,
        y: 50,
        initial: {
          rows: {
            [t("足し方", "adds in")]: t("読む・書くの2手", "2: read, write"),
          },
        },
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
        title: t("反例を受け取る", "Take the counterexample"),
        actor: "checker",
        to: ["trace"],
        summary: t(
          `検査器が見つけた最短の反例は${SCHEDULE.length}手`,
          `The shortest counterexample the checker found is ${stepsText(SCHEDULE.length)}`,
        ),
        explain: t(
          "モデル検査器は、更新が消える並びを最短の手順として返す。この手順は「どの順で動くと壊れるか」の正確な記録なので、そのままテストの材料になる。",
          'The model checker returns an interleaving that loses an update, as the shortest sequence of steps. These steps are an exact record of "which order breaks it", so they can go straight into a test.',
        ),
        set: {
          trace: {
            isHidden: false,
            tone: "bad",
            rows: Object.fromEntries(
              SCHEDULE.map((step, i) => [`${i + 1}`, displayName(step, language)]),
            ),
          },
        },
        detail: [
          {
            title: t("検査器が見つけた手順", "Steps the checker found"),
            fields: TRACE.slice(1).map((step, i) => ({
              label: t(`${i + 1}手目`, `Step ${i + 1}`),
              value: displayName(step.action ?? "", language),
              note: `count=${step.state.count}`,
            })),
          },
        ],
      },
      {
        id: "fix-order",
        kind: "spec",
        title: t("動く順を固定する", "Fix the order"),
        actor: "trace",
        to: ["test"],
        summary: t(
          "手順をそのまま、テストの中の決まった順に書き写す",
          "Copy the steps as they are into a fixed order in the test",
        ),
        explain: t(
          "ふつうのテストでは、どちらのプロセスが先に動くかは実行のたびに運で決まる。反例の手順どおりに動く順を決めて書けば、何度流しても同じ並びで動く、決定的に再現するテストになる。",
          "In an ordinary test, which process moves first is left to chance on each run. If you write the order to follow the counterexample's steps, it runs in the same order however often you run it: a test that reproduces deterministically.",
        ),
        set: {
          test: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("順", "order")]: t(
                `${SCHEDULE.length}手を固定`,
                `${stepsText(SCHEDULE.length)}, fixed`,
              ),
            },
          },
        },
        simplified: t(
          "実務では、スレッドが「読んだ直後」などの決まった位置で止まるようにフック（差し込み口）や待ち合わせ（ラッチやバリア）を置き、もう一方を先に進めてから再開させて順を固定する。ここでは操作の名前を並べて順に呼ぶだけで再現している。",
          'In practice you fix the order by putting hooks (insertion points) or synchronisation (latches or barriers) where a thread should stop, such as "right after reading", letting the other thread go ahead, then resuming. Here it is reproduced just by listing the operation names and calling them in order.',
        ),
      },
      {
        id: "test-fails",
        kind: "test",
        title: t("直す前は必ず落ちる", "It always fails before the fix"),
        actor: "test",
        to: ["impl"],
        summary: t(
          `固定した順で流すと count=${BUGGY_RESULT.count}になり、毎回落ちる`,
          `Run in the fixed order, count is ${BUGGY_RESULT.count} and it fails every time`,
        ),
        explain: t(
          `決めた順で動かすと、2回足したのに count は${BUGGY_RESULT.count}になる。順を固定したので、たまに落ちるテストではなく毎回落ちるテストになった。原因を調べている間も、何度でも同じ失敗を見られる。`,
          `Run in the chosen order, count is ${BUGGY_RESULT.count} even though 1 was added twice. Because the order is fixed, the test now fails every time instead of now and then. While you investigate the cause, you can see the same failure as often as you like.`,
        ),
        set: {
          test: {
            tone: "bad",
            rows: {
              [t("結果", "result")]: t(
                `${resultLabel(BUGGY_RESULT.isCorrect)}（count=${BUGGY_RESULT.count}）`,
                `${resultLabel(BUGGY_RESULT.isCorrect)} (count=${BUGGY_RESULT.count})`,
              ),
            },
          },
          impl: { tone: "bad", rows: { count: String(BUGGY_RESULT.count) } },
        },
      },
      {
        id: "fix-impl",
        kind: "fix",
        title: t("1手で足すように直す", "Fix: add in one step"),
        actor: "impl",
        summary: t(
          "読みと書きの間に割り込めないようにする",
          "Make it impossible to slip in between the read and the write",
        ),
        explain: t(
          "ロックを取る、または原子的な命令を使い、読んで書くを1手にする。間に他のプロセスが割り込めないので、古い値を元に書き戻すことが起きなくなる。",
          "Take a lock or use an atomic instruction so that reading and writing are one step. No other process can slip in between, so nothing writes back based on a stale value any more.",
        ),
        set: {
          impl: {
            tone: "wait",
            rows: {
              [t("足し方", "adds in")]: t("1手（割り込めない）", "1 step (atomic)"),
              count: null,
            },
          },
        },
      },
      {
        id: "test-passes",
        kind: "test",
        title: t("同じテストが通る", "The same test passes"),
        actor: "test",
        to: ["impl"],
        summary: t(
          `直した実装では count=${FIXED_RESULT.count}になり、テストが通る`,
          `With the fixed implementation, count is ${FIXED_RESULT.count} and the test passes`,
        ),
        explain: t(
          `同じ2つのプロセスを決めた順で動かすと、count は${FIXED_RESULT.count}になる。落ちていたテストが通ったことで、直した箇所が本当に原因だったと確かめられる。`,
          `Running the same two processes in the chosen order, count is ${FIXED_RESULT.count}. The failing test now passes, which confirms that what you fixed really was the cause.`,
        ),
        set: {
          test: {
            tone: "ok",
            rows: {
              [t("結果", "result")]: t(
                `${resultLabel(FIXED_RESULT.isCorrect)}（count=${FIXED_RESULT.count}）`,
                `${resultLabel(FIXED_RESULT.isCorrect)} (count=${FIXED_RESULT.count})`,
              ),
            },
          },
          impl: { tone: "ok", rows: { count: String(FIXED_RESULT.count) } },
        },
        detail: [
          {
            title: t("直した後の順", "Order after the fix"),
            fields: FIXED_SCHEDULE.map((step, i) => ({
              label: t(`${i + 1}手目`, `Step ${i + 1}`),
              value: displayName(step, language),
            })),
          },
        ],
        simplified: t(
          "このページのモデルでは、直した実装は操作が「足す」1つになるので、テストの順も「Aが足す → Bが足す」に書き換えている。実務では、同じ割り込み位置で止めるテストをそのまま直した実装に流す。",
          `In this page's model the fixed implementation has a single operation, "add", so the test order is rewritten as "${displayNames(FIXED_SCHEDULE, language)}". In practice you run the same test, stopping at the same point, against the fixed implementation.`,
        ),
      },
      {
        id: "keep",
        kind: "test",
        title: t("回帰テストに残す", "Keep it as a regression test"),
        actor: "test",
        to: ["checker"],
        summary: t(
          "同じバグが戻ったら、このテストが毎回落として知らせる",
          "If the same bug comes back, this test fails every time and tells you",
        ),
        explain: t(
          "このテストを残しておけば、後で誰かがロックを外しても毎回落ちて気づける。検査器は設計の段階で全部の順を調べ、テストは見つかった危ない順を実装の上で見張り続ける、という分担になる。",
          "Keep this test, and if someone later removes the lock it fails every time and you notice. The work is split: the checker examines every order at design time, and the test keeps watch over the dangerous order it found, on the real implementation.",
        ),
        set: {
          test: { rows: { [t("役目", "role")]: t("回帰テスト", "regression test") } },
          checker: {
            tone: "ok",
            rows: {
              [t("反例", "counterexample")]: t("テストに移した", "moved to a test"),
            },
          },
          trace: { tone: "ok" },
        },
      },
    ],
    lab: {
      title: t("動く順を決めて流す", "Choose the order and run"),
      hint: t(
        "「Aが読む」「Aが書く」「Bが読む」「Bが書く」をカンマ区切りで並べる。読む前に書くなど、動けない順を入れるとそこで止まる。足し方は2手の実装で試す。",
        `List "${displayName("Aが読む", "en")}", "${displayName("Aが書く", "en")}", "${displayName("Bが読む", "en")}" and "${displayName("Bが書く", "en")}" separated by commas. An order that cannot run, such as writing before reading, stops there. It runs on the 2-step implementation.`,
      ),
      inputs: [
        {
          id: "schedule",
          label: t("動く順（カンマ区切り）", "Order (comma-separated)"),
          initial: SCHEDULE.map((step) => displayName(step, language)).join(","),
        },
      ],
      compute: (values): Field[] => {
        const schedule = parseSchedule(values.schedule);
        const order: Field = {
          label: t("動く順", "Order"),
          value: displayNames(schedule, language),
        };
        try {
          const result = runSchedule(schedule, false);
          return [
            order,
            { label: "count", value: String(result.count) },
            {
              label: t("結果", "Result"),
              value: resultLabel(result.isCorrect),
              tone: result.isCorrect ? "ok" : "bad",
            },
          ];
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          const stuckStep = reason.startsWith(STUCK_PREFIX)
            ? reason.slice(STUCK_PREFIX.length)
            : null;
          const note =
            stuckStep === null
              ? reason
              : t(
                  reason,
                  `cannot run in this order: ${displayName(stuckStep, language)}`,
                );
          return [
            order,
            {
              label: t("結果", "Result"),
              value: t("この順では動けない", "cannot run in this order"),
              tone: "wait",
              note,
            },
          ];
        }
      },
    },
  };
}
