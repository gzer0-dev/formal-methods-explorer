import { translator, type Language } from "../../core/i18n";
import type { Lesson, Step } from "../../core/types";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";
import { displayName } from "../labels";
import { check } from "../modelCheck";
import { counterModel, type CounterState } from "../models";

// 演習: 2つのプロセスのカウンタで、最短の反例は何手か。
// 既定の図は問題の設定だけを見せ、正解（手数と手順）は出さない。答えを入れると、lab.lesson が
// 検査器の見つけた反例を1手ずつ足したレッスンを返し、答え合わせを図で見られるようにする。
const TRACE = lazy(() => check(counterModel(2, false)).violation!);

type Translate = (ja: string, en: string) => string;

function pcText(state: CounterState, index: number, t: Translate): string {
  const pc = state.pcs[index];
  if (pc === "read") return t("読む前", "before read");
  if (pc === "write")
    return t(`手元=${state.tmps[index]}`, `local=${state.tmps[index]}`);
  return t("済", "done");
}

function setupSteps(t: Translate): Step[] {
  return [
    {
      id: "setup",
      kind: "spec",
      title: t("2つが count に足す", "Two add to count"),
      actor: "count",
      to: ["a", "b"],
      summary: t(
        "AとBが、共有の count を読んで1を足して書き戻す",
        "A and B each read the shared count, add 1 and write it back",
      ),
      explain: t(
        "プロセスAとBは、どちらも「読む」で count を手元に写し、「書く」で手元の値に1を足して count に戻す。1回の動きは「読む」か「書く」のどちらか1手で、どちらが先に動くかは決まっていない。",
        'Processes A and B each "read" count into a local copy, then "write" the local value plus 1 back to count. Each move is one step, either a read or a write, and which process moves first is not fixed.',
      ),
      set: {
        a: { rows: { [t("状態", "state")]: t("読む前", "before read") } },
        b: { rows: { [t("状態", "state")]: t("読む前", "before read") } },
      },
    },
    {
      id: "usual",
      kind: "run",
      title: t("順に動けば2になる", "In turn it reaches 2"),
      actor: "a",
      to: ["count"],
      summary: t(
        "Aが読んで書き、そのあとBが読んで書くと、count は2になる",
        "If A reads and writes, then B reads and writes, count ends at 2",
      ),
      explain: t(
        "片方が書き終えてからもう片方が読めば、どちらの1も count に残る。不変条件「全員が終わったら count は2」は、この順では守られる。",
        'If one finishes writing before the other reads, both additions stay in count. The invariant "when everyone is done, count is 2" holds for this order.',
      ),
      set: {
        a: { tone: "ok", rows: { [t("状態", "state")]: t("済", "done") } },
        b: { tone: "ok", rows: { [t("状態", "state")]: t("済", "done") } },
        count: { tone: "ok", rows: { [t("値", "value")]: "2" } },
      },
    },
    {
      id: "question",
      kind: "explore",
      title: t("最短の反例は何手か", "How short can it be?"),
      actor: "checker",
      to: ["count"],
      summary: t(
        "不変条件を破る並びのうち、いちばん短いものは何手かを答える",
        "Answer how many steps the shortest order that breaks the invariant takes",
      ),
      explain: t(
        "検査器は、初期状態から近い順（幅優先）にすべての並びをたどり、不変条件を破る状態を探す。いちばん短い反例は何手か。下の「答え合わせ」に数を入れると、検査器が見つけた手順がこの図に足される。ヒント: 更新が消えるのは、2つとも書く前に読んだとき。",
        'The checker walks every order, nearest states first (breadth-first), looking for a state that breaks the invariant. How many steps is the shortest counterexample? Enter a number under "Check your answer" below and the steps the checker found are added to this diagram. Hint: an update is lost only when both read before either writes.',
      ),
      set: {
        a: { tone: "idle", rows: { [t("状態", "state")]: t("読む前", "before read") } },
        b: { tone: "idle", rows: { [t("状態", "state")]: t("読む前", "before read") } },
        count: { tone: "idle", rows: { [t("値", "value")]: "0" } },
        checker: {
          tone: "wait",
          rows: { [t("問い", "question")]: t("最短は何手？", "Shortest?") },
        },
      },
    },
  ];
}

function solutionSteps(t: Translate, language: Language): Step[] {
  const trace = TRACE();
  const moveCount = trace.length - 1;
  const moves: Step[] = trace.slice(1).map((entry, index) => {
    const action = entry.action!;
    const processIndex = action.startsWith("A") ? 0 : 1;
    const processId = processIndex === 0 ? "a" : "b";
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
      explain: isLast
        ? t(
            `2つとも書き終えたのに count は${entry.state.count}で、不変条件を破る。どちらも0を読んでから書いたので、先に書いた方の1が上書きされて消えた。`,
            `Both have finished writing, yet count is ${entry.state.count}, which breaks the invariant. Both read 0 before writing, so the 1 written first was overwritten and lost.`,
          )
        : isWrite
          ? t(
              `手元の値に1を足して count に書き戻す。`,
              "Add 1 to the local value and write it back to count.",
            )
          : t(
              `count の値（${entry.state.count}）を手元に写す。もう一方がまだ書いていないので、古い値を読むことになる。`,
              `Copy count (${entry.state.count}) into the local variable. The other process has not written yet, so this is the old value.`,
            ),
      set: {
        [processId]: {
          tone: isLast ? "bad" : "wait",
          rows: { [t("状態", "state")]: pcText(entry.state, processIndex, t) },
        },
        count: {
          tone: isLast ? "bad" : "idle",
          rows: { [t("値", "value")]: String(entry.state.count) },
        },
        ...(index === 0
          ? {
              checker: {
                tone: "wait",
                rows: { [t("たどる", "walk")]: t("幅優先", "breadth-first") },
              },
            }
          : {}),
      },
    };
  });
  return moves;
}

export function exerciseShortestLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-shortest",
      title: t("演習: 最短の反例", "Exercise: shortest counterexample"),
      subtitle: t(
        "2つのプロセスで、最短の反例は何手か",
        "With two processes, how short is the shortest counterexample?",
      ),
      summary: t(
        "2つのプロセスのカウンタで、不変条件を破る最短の並びが何手かを答える。答えを入れると、検査器が幅優先で見つけた反例を1手ずつ図で追える。",
        "For the two-process counter, answer how many steps the shortest order that breaks the invariant takes. Once you answer, you can follow the counterexample the checker found breadth-first, one step at a time.",
      ),
      intro: [
        t(
          "「テストが見逃すバグ」と「反例を読む」で見たカウンタを使う。図はまず問題の設定（2つのプロセスと共有の count）だけを見せ、正解の手順は答えるまで出さない。",
          'This uses the counter from "The bug your tests miss" and "Reading a counterexample". The diagram first shows only the setup (two processes and the shared count) and keeps the steps of the answer hidden until you answer.',
        ),
        t(
          "下の「答え合わせ」に数を入れると、図に検査器が見つけた反例の手順と答え合わせのステップが足される。「図で見る」を押して、count がどこで壊れるかを追う。",
          'When you enter a number under "Check your answer", the steps of the counterexample and a result step are added to the diagram. Press "Show the diagram" and follow where count goes wrong.',
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t("2つのプロセスのカウンタ", "Two-process counter"),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("数（半角数字）", "A number (digits)"),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t(
            "テストが見逃すバグ、反例を読む",
            '"The bug your tests miss", "Reading a counterexample"',
          ),
        },
      ],
      actors: [
        {
          id: "a",
          label: t("プロセスA", "Process A"),
          sublabel: t("読む → 書く", "read → write"),
          icon: "process",
          x: 14,
          y: 27,
        },
        {
          id: "b",
          label: t("プロセスB", "Process B"),
          sublabel: t("読む → 書く", "read → write"),
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
          id: "checker",
          label: t("モデル検査器", "Model checker"),
          sublabel: t("幅優先でたどる", "breadth-first"),
          icon: "checker",
          x: 86,
          y: 50,
        },
      ],
      links: [
        { from: "a", to: "count" },
        { from: "b", to: "count" },
        { from: "checker", to: "count" },
      ],
      answerType: "number",
      answerLabel: t("あなたの答え（手数）", "Your answer (steps)"),
      hint: t(
        "最短の反例の手数を数で入れる。入れると、図に正解の手順が足される。",
        "Enter the length of the shortest counterexample. The steps of the answer are then added to the diagram.",
      ),
      verdictActor: "checker",
      setupSteps: setupSteps(t),
      solve: () => {
        const trace = TRACE();
        const moveCount = trace.length - 1;
        return {
          answer: moveCount,
          reason: t(
            `幅優先でたどるので、最初に見つかった反例がいちばん短い。2つとも書く前に読まないと更新は消えないので、読む2手と書く2手の${moveCount}手より短くはならない。`,
            `The search is breadth-first, so the first counterexample found is the shortest. An update is lost only if both read before either writes, so it takes the two reads and two writes, ${moveCount} steps, and cannot be shorter.`,
          ),
        };
      },
      solutionSteps: () => solutionSteps(t, language),
    },
    language,
  );
}
