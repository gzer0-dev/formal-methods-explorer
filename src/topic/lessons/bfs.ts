import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson, Step } from "../../core/types";
import { describeCounterIn, displayNames } from "../labels";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import { check, countExecutions } from "../modelCheck";
import { counterModel, isCounterCorrect, type CounterState } from "../models";

const MODEL = counterModel(2, false);
const RESULT = check(MODEL);
const RUNS = countExecutions(MODEL, isCounterCorrect);
const LARGE_PROCESS_COUNT = 4;
const LARGE_MODEL = counterModel(LARGE_PROCESS_COUNT, false);
const LARGE_RESULT = check(LARGE_MODEL);
const LARGE_RUNS = countExecutions(LARGE_MODEL, isCounterCorrect);

interface Level {
  depth: number;
  states: CounterState[];
  /** この深さの状態から出る遷移の数。 */
  transitionCount: number;
  /** 次の深さで初めて見つかった状態の数。 */
  newCount: number;
  /** すでに訪問済みの状態に着いた遷移の数（数え直さない分）。 */
  revisitCount: number;
}

// check() の order は深さの順に並んでいるので、levels の数で切り分ければ深さごとの状態になる。
function splitByDepth(): Level[] {
  let begin = 0;
  return RESULT.levels.map((size, depth) => {
    const states = RESULT.order.slice(begin, begin + size);
    begin += size;
    const transitionCount = states
      .map((state) => MODEL.actions.filter((action) => action.enabled(state)).length)
      .reduce((sum, count) => sum + count, 0);
    const newCount = RESULT.levels[depth + 1] ?? 0;
    return {
      depth,
      states,
      transitionCount,
      newCount,
      revisitCount: transitionCount - newCount,
    };
  });
}

const LEVELS = splitByDepth();
const LAST_DEPTH = LEVELS.length - 1;
const TOTAL_REVISITS = RESULT.transitionCount - (RESULT.stateCount - 1);
const VIOLATION_STATE = RESULT.violation!.at(-1)!.state;

// 深さ2で、2通りの並びが同じ状態に合流する例（先に読む方が入れ替わっただけ）。
const MERGE_STATE = LEVELS[2]!.states.find((state) =>
  state.pcs.every((pc) => pc === "write"),
)!;
const MERGE_ORDERS = [
  ["Aが読む", "Bが読む"],
  ["Bが読む", "Aが読む"],
];

function visitedUpTo(depth: number): number {
  return RESULT.levels.slice(0, depth + 1).reduce((sum, count) => sum + count, 0);
}

/** describeCounterIn の「A:読む前 B:手元=0 count=0」をカードの行に分ける。 */
function counterRows(state: CounterState, language: Language): Record<string, string> {
  return Object.fromEntries(
    describeCounterIn(state, language)
      .split(" ")
      .map((part) => {
        const separator = part.includes(":") ? ":" : "=";
        const [name, ...rest] = part.split(separator);
        return [name!, rest.join(separator)];
      }),
  );
}

function parseCount(text: string | undefined): number {
  const value = Number.parseInt(text ?? "", 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 4) : 2;
}

export function bfsLesson(language: Language): Lesson {
  const t = translator(language);
  const describe = (state: CounterState) => describeCounterIn(state, language);
  const rowsOf = (state: CounterState) => counterRows(state, language);
  const count = (n: number) => t(`${n}個`, `${n}`);
  const waiting = t("待ち", "waiting");
  const depthKey = t("深さ", "depth");
  const visitedKey = t("状態の数", "states");

  function levelDetail(level: Level) {
    return {
      title: t(
        `深さ${level.depth}の状態（${level.states.length}個）`,
        `States at depth ${level.depth} (${level.states.length})`,
      ),
      fields: level.states.map((state, index) => ({
        label: `${index + 1}`,
        value: describe(state),
        tone: MODEL.invariant!(state) ? undefined : ("bad" as const),
      })),
    };
  }

  function expandStep(depth: number): Step {
    const level = LEVELS[depth]!;
    const next = LEVELS[depth + 1]!;
    const lastState = level.states.at(-1)!;
    const revisitJa =
      level.revisitCount > 0
        ? `残りの${level.revisitCount}本は訪問済みの状態に着いたので数え直さない。`
        : "どれも初めて見る状態だった。";
    const revisitEn =
      level.revisitCount > 0
        ? `The other ${level.revisitCount} reach states already visited, so they are not counted again.`
        : "Every one of them was new.";
    return {
      id: `expand-${depth}`,
      kind: "explore",
      title: t(`深さ${depth + 1}へ広げる`, `Expand to depth ${depth + 1}`),
      actor: "queue",
      to: ["state"],
      summary: t(
        `深さ${depth}の${level.states.length}個を取り出し、深さ${depth + 1}の状態を${next.states.length}個見つける`,
        `Takes the ${level.states.length} at depth ${depth} and finds ${next.states.length} at depth ${depth + 1}`,
      ),
      explain: t(
        `列の先頭から深さ${depth}の状態を順に取り出し、できる操作を全部試す。遷移は${level.transitionCount}本あり、初めて見る状態${level.newCount}個だけを列の後ろと訪問済みに足す。${revisitJa}`,
        `Take the depth-${depth} states from the front of the queue one by one and try every possible action. There are ${level.transitionCount} transitions, and only the ${level.newCount} new states are added to the back of the queue and to visited. ${revisitEn}`,
      ),
      set: {
        state: { rows: rowsOf(lastState) },
        queue: {
          rows: { [waiting]: count(next.states.length), [depthKey]: String(depth + 1) },
        },
        visited: { rows: { [visitedKey]: count(visitedUpTo(depth + 1)) } },
      },
      detail: [levelDetail(next)],
    };
  }

  return {
    id: "bfs",
    category: "model",
    title: t("状態を全部たどる", "Exploring every state"),
    subtitle: t(
      "幅優先探索で、同じ状態は1回だけ数える",
      "Breadth-first search counts each state once",
    ),
    summary: t(
      `モデル検査器は、初期状態から深さ1、深さ2と順に状態を広げる（幅優先探索）。同じ状態に別の道から着いても数え直さないので、2つのプロセスのカウンタは${RESULT.stateCount}状態で調べ終わる。`,
      `A model checker expands states from the initial state to depth 1, then depth 2, and so on (breadth-first search). Reaching the same state by another path does not count it again, so the two-process counter is done in ${RESULT.stateCount} states.`,
    ),
    intro: [
      t(
        "モデル検査器（あり得る状態を機械的に全部たどる道具）がよく使う探し方が、幅優先探索（初期状態から手数の少ない順に広げていく探し方）である。",
        "A common way for a model checker (a tool that mechanically walks every possible state) to search is breadth-first search (expanding from the initial state in order of fewest steps).",
      ),
      t(
        "前のレッスンの「全部の状態をたどる」が、中で何をしているかを見るレッスンである。題材は最初のレッスンのカウンタで、動いた順が違っても着いた状態が同じなら、その先に起きることも同じになる点を使う。",
        'This lesson looks inside "walk every state" from the previous lesson. The example is the counter from the first lesson, and it relies on one fact: if different orders reach the same state, what happens after is also the same.',
      ),
      t(
        "図では、探索待ちの列から状態が取り出され、いま調べている状態のカードに移り、訪問済みに加わる流れを追う。別の順から同じ状態に着いたときの扱いと、最後の深さで不変条件（いつ見ても成り立っていてほしい条件）を確かめる場面が分かれ目になる。",
        "In the diagram, follow states as they leave the queue, move to the current-state card, and join visited. The turning points are how a state reached by another order is handled, and the check of the invariant (a condition that should hold whenever you look) at the last depth.",
      ),
    ],
    facts: [
      { label: t("状態", "States"), value: count(RESULT.stateCount) },
      {
        label: t("遷移", "Transitions"),
        value: t(`${RESULT.transitionCount}本`, `${RESULT.transitionCount}`),
      },
      { label: t("深さごとの数", "Per depth"), value: RESULT.levels.join(" → ") },
      {
        label: t("実物の道具", "Real tools"),
        value: t("TLC（TLA+ の検査器）", "TLC (the TLA+ checker)"),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 3.1節（モデル検査）`,
          `${CSP_BOOK_EN}, section 3.1 (model checking)`,
        ),
      },
    ],
    actors: [
      {
        id: "checker",
        label: t("モデル検査器", "Model checker"),
        sublabel: t("幅優先でたどる", "breadth-first"),
        icon: "checker",
        x: 14,
        y: 50,
      },
      {
        id: "queue",
        label: t("探索待ちの列", "Queue"),
        sublabel: "queue",
        icon: "queue",
        x: 38,
        y: 50,
        initial: { rows: { [waiting]: count(0) } },
      },
      {
        id: "state",
        label: t("いま調べている状態", "Current state"),
        sublabel: "state",
        icon: "state",
        x: 62,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "visited",
        label: t("訪問済み", "Visited"),
        sublabel: "visited",
        icon: "visited",
        x: 86,
        y: 50,
        initial: { rows: { [visitedKey]: count(0) } },
      },
    ],
    stageHeight: 300,
    links: [
      { from: "checker", to: "queue" },
      { from: "queue", to: "state" },
      { from: "state", to: "visited" },
    ],
    steps: [
      {
        id: "start",
        kind: "spec",
        title: t("初期状態を入れる", "Enqueue the initial state"),
        actor: "checker",
        to: ["queue"],
        summary: t(
          "初期状態を探索待ちの列と訪問済みに入れる",
          "Put the initial state in the queue and in visited",
        ),
        explain: t(
          "探索は、探索待ちの列（queue、先に入れたものから取り出す）と、訪問済みの集合（visited、一度見た状態の控え）の2つで進む。最初は初期状態だけを両方に入れる。",
          "The search runs on two things: a queue (first in, first out) and a visited set (a record of every state already seen). At the start, only the initial state goes into both.",
        ),
        set: {
          state: { isHidden: false, tone: "wait", rows: rowsOf(MODEL.init) },
          queue: { rows: { [waiting]: count(RESULT.levels[0]!), [depthKey]: "0" } },
          visited: { rows: { [visitedKey]: count(visitedUpTo(0)) } },
        },
      },
      expandStep(0),
      {
        ...expandStep(1),
        title: t("同じ状態は1回だけ", "Each state only once"),
        summary: t(
          `深さ1から出る${LEVELS[1]!.transitionCount}本の遷移のうち、新しい状態に着くのは${LEVELS[1]!.newCount}本`,
          `Of the ${LEVELS[1]!.transitionCount} transitions from depth 1, only ${LEVELS[1]!.newCount} reach new states`,
        ),
        explain: t(
          `「Aが読む → Bが読む」と「Bが読む → Aが読む」は、どちらも「${describe(MERGE_STATE)}」に着く。訪問済みにすでにあるので、2回目は列に入れない。並びは違っても、着いた状態が同じなら、その先に起きることも同じだから。`,
          `"${displayNames(MERGE_ORDERS[0]!, language)}" and "${displayNames(MERGE_ORDERS[1]!, language)}" both reach "${describe(MERGE_STATE)}". It is already in visited, so the second arrival is not queued. The orders differ, but the state is the same, so what happens next is the same too.`,
        ),
        set: {
          state: { rows: rowsOf(MERGE_STATE) },
          queue: {
            rows: { [waiting]: count(LEVELS[2]!.states.length), [depthKey]: "2" },
          },
          visited: { tone: "ok", rows: { [visitedKey]: count(visitedUpTo(2)) } },
        },
      },
      expandStep(2),
      {
        ...expandStep(LAST_DEPTH - 1),
        kind: "found",
        title: t("最後の深さで破れる", "Broken at the last depth"),
        actor: "state",
        to: ["checker"],
        summary: t(
          `深さ${LAST_DEPTH}の${RESULT.levels[LAST_DEPTH]}個のうち1個が不変条件を破る`,
          `One of the ${RESULT.levels[LAST_DEPTH]} states at depth ${LAST_DEPTH} breaks the invariant`,
        ),
        explain: t(
          `深さ${LAST_DEPTH}で、2つのプロセスがどちらも終わった状態に着く。count=2の状態のほかに「${describe(VIOLATION_STATE)}」があり、不変条件「全員が終わったら count は2」を破っている。検査器は列から取り出した状態ごとに不変条件を確かめるので、ここで見つかる。`,
          `At depth ${LAST_DEPTH}, both processes have finished. Besides the state with count=2 there is "${describe(VIOLATION_STATE)}", which breaks the invariant "when everyone is done, count is 2". The checker tests the invariant on each state it takes from the queue, so it is found here.`,
        ),
        set: {
          state: { tone: "bad", rows: rowsOf(VIOLATION_STATE) },
          queue: {
            rows: {
              [waiting]: count(RESULT.levels[LAST_DEPTH]!),
              [depthKey]: String(LAST_DEPTH),
            },
          },
          visited: { rows: { [visitedKey]: count(visitedUpTo(LAST_DEPTH)) } },
          checker: {
            tone: "bad",
            rows: { [t("違反", "violations")]: count(RESULT.violationCount) },
          },
        },
        simplified: t(
          "TLC は状態を作った時点で不変条件を確かめ、最初の違反で止まる。ここでは列から取り出した時点で確かめ、最後までたどって違反の数も数えている。",
          "TLC checks the invariant when a state is generated and stops at the first violation. Here it is checked when a state leaves the queue, and the search runs to the end to count the violations.",
        ),
      },
      {
        id: "compare",
        kind: "explore",
        title: t("並びと状態を比べる", "Orders versus states"),
        actor: "checker",
        to: ["visited"],
        summary: t(
          `${RESULT.stateCount}状態・${RESULT.transitionCount}遷移で調べ終わる。プロセスが${LARGE_PROCESS_COUNT}つなら並び${LARGE_RUNS.total}通りに対し状態${LARGE_RESULT.stateCount}個`,
          `Done in ${RESULT.stateCount} states and ${RESULT.transitionCount} transitions. With ${LARGE_PROCESS_COUNT} processes: ${LARGE_RUNS.total} orders but only ${LARGE_RESULT.stateCount} states`,
        ),
        explain: t(
          `列が空になり、${RESULT.stateCount}状態・${RESULT.transitionCount}遷移で探索が終わった。訪問済みに着いた遷移は${TOTAL_REVISITS}本あった。2つのプロセスでは並び${RUNS.total}通りの方が少ないが、${LARGE_PROCESS_COUNT}つにすると並びは${LARGE_RUNS.total}通りまで増え、状態は${LARGE_RESULT.stateCount}個で済む。同じ状態をまとめるので、状態は並びより緩やかに増える。`,
          `The queue is empty, and the search ended after ${RESULT.stateCount} states and ${RESULT.transitionCount} transitions. ${TOTAL_REVISITS} transitions reached states already visited. With two processes the ${RUNS.total} orders are fewer, but with ${LARGE_PROCESS_COUNT} the orders grow to ${LARGE_RUNS.total} while the states stay at ${LARGE_RESULT.stateCount}. Because identical states are merged, states grow more slowly than orders.`,
        ),
        set: {
          state: { isHidden: true },
          queue: { tone: "idle", rows: { [waiting]: count(0), [depthKey]: null } },
          visited: { rows: { [visitedKey]: count(RESULT.stateCount) } },
          checker: {
            rows: {
              [t("状態", "states")]: count(RESULT.stateCount),
              [t("遷移", "transitions")]: t(
                `${RESULT.transitionCount}本`,
                `${RESULT.transitionCount}`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("並びの数と状態の数", "Orders and states"),
            fields: [
              {
                label: t("2プロセスの並び", "Orders, 2 processes"),
                value: t(`${RUNS.total}通り`, `${RUNS.total}`),
              },
              {
                label: t("2プロセスの状態", "States, 2 processes"),
                value: count(RESULT.stateCount),
              },
              {
                label: t(
                  `${LARGE_PROCESS_COUNT}プロセスの並び`,
                  `Orders, ${LARGE_PROCESS_COUNT} processes`,
                ),
                value: t(`${LARGE_RUNS.total}通り`, `${LARGE_RUNS.total}`),
              },
              {
                label: t(
                  `${LARGE_PROCESS_COUNT}プロセスの状態`,
                  `States, ${LARGE_PROCESS_COUNT} processes`,
                ),
                value: count(LARGE_RESULT.stateCount),
              },
            ],
          },
        ],
        simplified: t(
          "TLC は状態そのものではなく指紋（ハッシュ値）を訪問済みに覚え、複数のスレッドで並列にたどり、入りきらない分はディスクに置く。ここでは状態を文字列の鍵にして Map に入れている。",
          "TLC stores a fingerprint (hash) of each state in visited rather than the state itself, explores in parallel on several threads, and spills to disk what does not fit in memory. Here each state is turned into a string key and stored in a Map.",
        ),
      },
    ],
    lab: {
      title: t("プロセスの数を変える", "Change the number of processes"),
      hint: t(
        "プロセスを増やすと、並びは急に増えるが、状態の数はそれより緩やかに増える。足し方を「1手」にすると状態はさらに少なく、違反も消える。",
        "Adding processes makes the orders grow fast, but the number of states grows more slowly. Adding in 1 step makes the states even fewer, and the violation goes away.",
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
        const result = check(model);
        const runs = countExecutions(model, isCounterCorrect);
        return [
          { label: t("プロセスの数", "Processes"), value: String(processCount) },
          {
            label: t("たどった状態", "States explored"),
            value: count(result.stateCount),
          },
          {
            label: t("遷移", "Transitions"),
            value: t(`${result.transitionCount}本`, `${result.transitionCount}`),
          },
          { label: t("深さごとの数", "Per depth"), value: result.levels.join(" → ") },
          {
            label: t("実行の並び", "Interleavings"),
            value: t(`${runs.total}通り`, `${runs.total}`),
          },
          {
            label: t("不変条件を破る状態", "States breaking invariant"),
            value: count(result.violationCount),
            tone: result.violationCount > 0 ? "bad" : "ok",
          },
        ];
      },
    },
  };
}
