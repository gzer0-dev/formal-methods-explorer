import { translator, type Language } from "../../core/i18n";
import type { Lesson, Step } from "../../core/types";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";
import { displayName } from "../labels";
import { check, countExecutions } from "../modelCheck";
import {
  counterModel,
  type CounterState,
  isCounterCorrect,
  PROCESS_NAMES,
  runSchedule,
} from "../models";

// 演習: カウンタを3つのプロセスにしたとき、更新が消える並びは何通りか。
// 条件と正解の計算は exerciseModel.ts の問1と同じ（PROCESS_COUNT・countExecutions）。
// 答える前の図は設定と「順に動けば正しい」だけを見せ、並びの数も壊れる並びも出さない。
const PROCESS_COUNT = 3;
const PROCESS_IDS = ["a", "b", "c"];
const NAMES = PROCESS_NAMES.slice(0, PROCESS_COUNT);
// 1つずつ読み書きを終えてから次が動く順（テストがふだん通る順）。軽いので最上位で1回だけ動かす。
const USUAL_RESULT = runSchedule(
  NAMES.flatMap((name) => [`${name}が読む`, `${name}が書く`]),
  false,
);

const RUNS = lazy(() =>
  countExecutions(counterModel(PROCESS_COUNT, false), isCounterCorrect),
);
// 更新が消える並びの1例（検査器が幅優先で最初に見つけたもの）。TRACE()[0] は初期状態。
const TRACE = lazy(() => check(counterModel(PROCESS_COUNT, false)).violation!);

type Translate = (ja: string, en: string) => string;

function pcText(state: CounterState, index: number, t: Translate): string {
  const pc = state.pcs[index];
  if (pc === "read") return t("読む前", "before read");
  if (pc === "write")
    return t(`手元=${state.tmps[index]}`, `local=${state.tmps[index]}`);
  return t("済", "done");
}

function idleProcesses(t: Translate) {
  return Object.fromEntries(
    PROCESS_IDS.map((id) => [
      id,
      {
        tone: "idle" as const,
        rows: { [t("状態", "state")]: t("読む前", "before read") },
      },
    ]),
  );
}

function setupSteps(t: Translate): Step[] {
  return [
    {
      id: "setup",
      kind: "spec",
      title: t("3つが count に足す", "Three add to count"),
      actor: "count",
      to: PROCESS_IDS,
      summary: t(
        "A・B・Cが、共有の count を読んで1を足して書き戻す",
        "A, B and C each read the shared count, add 1 and write it back",
      ),
      explain: t(
        "「テストが見逃すバグ」のカウンタを、プロセス3つにした。どのプロセスも「読む」で count を手元に写し、「書く」で手元の値に1を足して count に戻す。1回の動きは「読む」か「書く」のどちらか1手で、どのプロセスが先に動くかは決まっていない。",
        'This is the counter from "The bug your tests miss", now with three processes. Each one "reads" count into a local copy, then "writes" the local value plus 1 back to count. Each move is one step, either a read or a write, and which process moves first is not fixed.',
      ),
      set: idleProcesses(t),
    },
    {
      id: "usual",
      kind: "run",
      title: t(
        `順に動けば${USUAL_RESULT.count}になる`,
        `In turn it reaches ${USUAL_RESULT.count}`,
      ),
      actor: "a",
      to: ["count"],
      summary: t(
        `A、B、Cの順に1つずつ読んで書くと、count は${USUAL_RESULT.count}になる`,
        `If A, B and C each read and write in turn, count ends at ${USUAL_RESULT.count}`,
      ),
      explain: t(
        `どのプロセスも、前のプロセスが書き終えてから読めば、全員の1が count に残る。テストはこの順で動きやすいので、いつも${USUAL_RESULT.count}になって通る。`,
        `If each process reads only after the previous one has finished writing, every addition stays in count. Tests tend to run in this order, so they always get ${USUAL_RESULT.count} and pass.`,
      ),
      set: {
        ...Object.fromEntries(
          PROCESS_IDS.map((id) => [
            id,
            { tone: "ok" as const, rows: { [t("状態", "state")]: t("済", "done") } },
          ]),
        ),
        count: {
          tone: USUAL_RESULT.isCorrect ? "ok" : "bad",
          rows: { [t("値", "value")]: String(USUAL_RESULT.count) },
        },
      },
    },
    {
      id: "question",
      kind: "explore",
      title: t("消える並びは何通りか", "How many lose one?"),
      actor: "checker",
      to: ["count"],
      summary: t(
        `最後に count が${PROCESS_COUNT}にならない並びが何通りあるかを答える`,
        `Answer how many interleavings end with count not equal to ${PROCESS_COUNT}`,
      ),
      explain: t(
        `3つのプロセスが2手ずつ動く並びを全部考える。最後に count が${PROCESS_COUNT}にならない並びは何通りか。下の「答え合わせ」に数を入れると、壊れる並びの1例と数え方がこの図に足される。ヒント: 並びの総数から、どのプロセスも他と読み書きが重ならない並びを引く。`,
        `Consider every interleaving of the three processes taking two steps each. How many end with count not equal to ${PROCESS_COUNT}? Enter a number under "Check your answer" below and one interleaving that breaks, plus how to count them, are added to this diagram. Hint: from the total, subtract the interleavings where no process's read and write overlap with another's.`,
      ),
      set: {
        ...idleProcesses(t),
        count: { tone: "idle", rows: { [t("値", "value")]: "0" } },
        checker: {
          tone: "wait",
          rows: { [t("問い", "question")]: t("何通り？", "How many?") },
        },
      },
    },
  ];
}

function moveExplain(
  before: CounterState,
  after: CounterState,
  processIndex: number,
  isLast: boolean,
  t: Translate,
): string {
  const name = NAMES[processIndex]!;
  const read = before.tmps[processIndex];
  const isLostHere = after.count <= before.count;
  if (isLast && !isLostHere) {
    return t(
      `3つとも書き終えたのに count は${after.count}で、${PROCESS_COUNT}にならない。それより前の手で、先に書かれた1が上書きされていた。`,
      `All three have finished writing, yet count is ${after.count}, not ${PROCESS_COUNT}. An addition written earlier was overwritten in a previous step.`,
    );
  }
  if (isLast) {
    return t(
      `${name}が読んだのは${read}だが、書く前に count は${before.count}まで進んでいた。${name}が${after.count}を書いたことで、その間に足された1が上書きされて消えた。3つとも書き終えたのに、count は${PROCESS_COUNT}にならず${after.count}で終わる。`,
      `${name} read ${read}, but count had reached ${before.count} before it wrote. By writing ${after.count}, ${name} overwrote the addition made in between, and it is lost. All three have finished, yet count ends at ${after.count}, not ${PROCESS_COUNT}.`,
    );
  }
  if (before.pcs[processIndex] === "read") {
    const pending = NAMES.filter(
      (_, index) => index !== processIndex && after.pcs[index] === "write",
    );
    if (pending.length === 0) {
      return t(
        `${name}が count の値（${after.count}）を手元に写す。`,
        `${name} copies count (${after.count}) into its local variable.`,
      );
    }
    return t(
      `${name}が count の値（${after.count}）を手元に写す。${pending.join("と")}は、読んだ値をまだ書き戻していない。`,
      `${name} copies count (${after.count}) into its local variable. ${pending.join(" and ")} ${pending.length === 1 ? "has" : "have"} not yet written back what ${pending.length === 1 ? "it" : "they"} read.`,
    );
  }
  return isLostHere
    ? t(
        `${name}が手元の値に1を足して書き、count は${after.count}のまま。先に書かれた1が上書きされて消えた。`,
        `${name} adds 1 to its local value and writes it, so count stays at ${after.count}. The addition written earlier is overwritten and lost.`,
      )
    : t(
        `${name}が手元の値に1を足して書き戻し、count は${after.count}になる。`,
        `${name} adds 1 to its local value and writes it back; count becomes ${after.count}.`,
      );
}

function solutionSteps(t: Translate, language: Language): Step[] {
  const trace = TRACE();
  const runs = RUNS();
  const moveCount = trace.length - 1;
  const moves: Step[] = trace.slice(1).map((entry, index) => {
    const action = entry.action!;
    const before = trace[index]!.state;
    const processIndex = NAMES.findIndex((name) => action.startsWith(name));
    const processId = PROCESS_IDS[processIndex]!;
    const isWrite = action.endsWith("書く");
    const isLast = index === moveCount - 1;
    return {
      id: `move-${index + 1}`,
      kind: isLast ? "found" : "explore",
      title: t(
        `${index + 1}手目: ${action}`,
        `Step ${index + 1}: ${displayName(action, language)}`,
      ),
      actor: isWrite ? processId : "count",
      to: [isWrite ? "count" : processId],
      summary: t(
        `${action}。count は${entry.state.count}`,
        `${displayName(action, language)}. count is ${entry.state.count}`,
      ),
      explain: moveExplain(before, entry.state, processIndex, isLast, t),
      set: {
        [processId]: {
          tone: entry.state.pcs[processIndex] === "done" ? "ok" : "wait",
          rows: { [t("状態", "state")]: pcText(entry.state, processIndex, t) },
        },
        count: {
          tone: isLast ? "bad" : "idle",
          rows: { [t("値", "value")]: String(entry.state.count) },
        },
        ...(index === 0
          ? {
              checker: {
                tone: "wait" as const,
                rows: {
                  [t("問い", "question")]: null,
                  [t("見る", "showing")]: t("壊れる1例", "one bad run"),
                },
              },
            }
          : {}),
      },
    };
  });
  const counting: Step = {
    id: "count-runs",
    kind: "found",
    title: t(
      `${runs.total}通り中${runs.bad}通り`,
      `${runs.bad} of ${runs.total} interleavings`,
    ),
    actor: "checker",
    to: ["count"],
    summary: t(
      `並びは全部で${runs.total}通り。正しく終わるのは${runs.good}通りで、残りの${runs.bad}通りで更新が消える`,
      `There are ${runs.total} interleavings in all. ${runs.good} end correctly, and the other ${runs.bad} lose an update`,
    ),
    explain: t(
      `${moveCount}手の並びは、どのプロセスも「読む」が「書く」より先という決まりの中で${runs.total}通りある。正しく終わるのは、どのプロセスも読んでから書くまで他に割り込まれない${runs.good}通りだけ。それ以外の${runs.bad}通りでは、今の例のように誰かの1が上書きされる。`,
      `With each process's read coming before its write, the ${moveCount} steps can be interleaved in ${runs.total} ways. Only the ${runs.good} where no process is interrupted between its read and its write end correctly. In the other ${runs.bad}, someone's addition is overwritten, as in the example above.`,
    ),
    set: {
      checker: {
        tone: "bad",
        rows: {
          [t("見る", "showing")]: null,
          [t("全部", "total")]: t(`${runs.total}通り`, `${runs.total}`),
          [t("消える", "lost")]: t(`${runs.bad}通り`, `${runs.bad}`),
        },
      },
    },
  };
  return [...moves, counting];
}

export function exerciseThreeProcessesLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-three-processes",
      title: t("演習: 3つで消える並び", "Exercise: lost updates with three"),
      subtitle: t(
        "3つのプロセスで、更新が消える並びは何通りか",
        "With three processes, how many orders lose an update?",
      ),
      summary: t(
        `カウンタを${PROCESS_COUNT}つのプロセスにしたとき、更新が消える並びが何通りあるかを答える。答えを入れると、壊れる並びの1例を1手ずつ追い、全体の数え方を図で確かめられる。`,
        `With the counter split across ${PROCESS_COUNT} processes, answer how many interleavings lose an update. Once you answer, you can follow one bad interleaving step by step and see how the whole count is made.`,
      ),
      intro: [
        t(
          "「テストが見逃すバグ」で見たカウンタを、プロセス3つに増やす。どのプロセスも「読む」「書く」の2手で count に1を足し、動く順は決まっていない。最後に count が足りなくなる並びがいくつあるかを数える問題である。",
          'This takes the counter from "The bug your tests miss" and uses three processes. Each adds 1 to count in two steps, "read" and "write", and the order they move in is not fixed. The question is how many interleavings leave count short at the end.',
        ),
        t(
          "図はまず、3つのプロセスと共有の count、順に動いたときの結果だけを見せる。下の「答え合わせ」に数を入れると、壊れる並びの1例と数え方が足される。「図で見る」を押して、どの手で count の1が消えるかを追う。",
          'The diagram first shows only the three processes, the shared count, and what happens when they move in turn. When you enter a number under "Check your answer", one bad interleaving and how to count them are added. Press "Show the diagram" and find the step where an addition to count disappears.',
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t("3つのプロセスのカウンタ", "Three-process counter"),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("数（半角数字）", "A number (digits)"),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t("テストが見逃すバグ", '"The bug your tests miss"'),
        },
      ],
      actors: [
        ...NAMES.map((name, index) => ({
          id: PROCESS_IDS[index]!,
          label: t(`プロセス${name}`, `Process ${name}`),
          sublabel: t("読む → 書く", "read → write"),
          icon: "process",
          x: 20 + index * 30,
          y: 27,
          initial: { rows: { [t("状態", "state")]: t("読む前", "before read") } },
        })),
        {
          id: "count",
          label: "count",
          sublabel: t("共有の変数", "shared variable"),
          icon: "variable",
          x: 35,
          y: 73,
          initial: { rows: { [t("値", "value")]: "0" } },
        },
        {
          id: "checker",
          label: t("モデル検査器", "Model checker"),
          sublabel: t("並びを全部数える", "counts every order"),
          icon: "checker",
          x: 65,
          y: 73,
        },
      ],
      links: [
        ...PROCESS_IDS.map((id) => ({ from: id, to: "count" })),
        { from: "checker", to: "count" },
      ],
      answerType: "number",
      answerLabel: t("あなたの答え（通り）", "Your answer (interleavings)"),
      hint: t(
        "更新が消える並びの数を入れる。入れると、図に壊れる並びの1例と数え方が足される。",
        "Enter how many interleavings lose an update. One bad interleaving and how to count them are then added to the diagram.",
      ),
      verdictActor: "checker",
      setupSteps: setupSteps(t),
      solve: () => {
        const runs = RUNS();
        return {
          answer: runs.bad,
          reason: t(
            `${PROCESS_COUNT}つのプロセスが2手ずつ動く並びは${runs.total}通り。正しく終わるのは、読んでから書くまでに他のプロセスが割り込まない${runs.good}通りだけで、残りの${runs.bad}通りでは誰かの更新が消える。`,
            `With ${PROCESS_COUNT} processes taking two steps each there are ${runs.total} interleavings. Only the ${runs.good} where no other process slips in between a read and its write end correctly; in the other ${runs.bad}, someone's update is lost.`,
          ),
        };
      },
      solutionSteps: () => solutionSteps(t, language),
    },
    language,
  );
}
