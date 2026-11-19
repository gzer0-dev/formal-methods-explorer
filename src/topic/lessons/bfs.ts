import type { Field, Lesson, Step } from "../../core/types";
import { CSP_BOOK } from "../references";
import { check, countExecutions } from "../modelCheck";
import {
  counterModel,
  describeCounter,
  isCounterCorrect,
  type CounterState,
} from "../models";

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

function visitedUpTo(depth: number): number {
  return RESULT.levels.slice(0, depth + 1).reduce((sum, count) => sum + count, 0);
}

/** describeCounter の「A:読む前 B:手元=0 count=0」をカードの行に分ける。 */
function counterRows(state: CounterState): Record<string, string> {
  return Object.fromEntries(
    describeCounter(state)
      .split(" ")
      .map((part) => {
        const separator = part.includes(":") ? ":" : "=";
        const [name, ...rest] = part.split(separator);
        return [name!, rest.join(separator)];
      }),
  );
}

function levelDetail(level: Level) {
  return {
    title: `深さ${level.depth}の状態（${level.states.length}個）`,
    fields: level.states.map((state, index) => ({
      label: `${index + 1}`,
      value: describeCounter(state),
      tone: MODEL.invariant!(state) ? undefined : ("bad" as const),
    })),
  };
}

function expandStep(depth: number): Step {
  const level = LEVELS[depth]!;
  const next = LEVELS[depth + 1]!;
  const lastState = level.states.at(-1)!;
  return {
    id: `expand-${depth}`,
    kind: "explore",
    title: `深さ${depth + 1}へ広げる`,
    actor: "queue",
    to: ["state"],
    summary: `深さ${depth}の${level.states.length}個を取り出し、深さ${depth + 1}の状態を${next.states.length}個見つける`,
    explain: `列の先頭から深さ${depth}の状態を順に取り出し、できる操作を全部試す。遷移は${level.transitionCount}本あり、初めて見る状態${level.newCount}個だけを列の後ろと訪問済みに足す。${level.revisitCount > 0 ? `残りの${level.revisitCount}本は訪問済みの状態に着いたので数え直さない。` : "どれも初めて見る状態だった。"}`,
    set: {
      state: { rows: counterRows(lastState) },
      queue: { rows: { 待ち: `${next.states.length}個`, 深さ: String(depth + 1) } },
      visited: { rows: { 状態の数: `${visitedUpTo(depth + 1)}個` } },
    },
    detail: [levelDetail(next)],
  };
}

function parseCount(text: string | undefined): number {
  const value = Number.parseInt(text ?? "", 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 4) : 2;
}

export const bfsLesson: Lesson = {
  id: "bfs",
  category: "model",
  title: "状態を全部たどる",
  subtitle: "幅優先探索で、同じ状態は1回だけ数える",
  summary: `モデル検査器は、初期状態から深さ1、深さ2と順に状態を広げる（幅優先探索）。同じ状態に別の道から着いても数え直さないので、2つのプロセスのカウンタは${RESULT.stateCount}状態で調べ終わる。`,
  intro: [
    "モデル検査器（あり得る状態を機械的に全部たどる道具）がよく使う探し方が、幅優先探索（初期状態から手数の少ない順に広げていく探し方）である。",
    "前のレッスンの「全部の状態をたどる」が、中で何をしているかを見るレッスンである。題材は最初のレッスンのカウンタで、動いた順が違っても着いた状態が同じなら、その先に起きることも同じになる点を使う。",
    "図では、探索待ちの列から状態が取り出され、いま調べている状態のカードに移り、訪問済みに加わる流れを追う。別の順から同じ状態に着いたときの扱いと、最後の深さで不変条件（いつ見ても成り立っていてほしい条件）を確かめる場面が分かれ目になる。",
  ],
  facts: [
    { label: "状態", value: `${RESULT.stateCount}個` },
    { label: "遷移", value: `${RESULT.transitionCount}本` },
    { label: "深さごとの数", value: RESULT.levels.join(" → ") },
    { label: "実物の道具", value: "TLC（TLA+ の検査器）" },
    { label: "参考文献", value: `${CSP_BOOK} 3.1節（モデル検査）` },
  ],
  actors: [
    {
      id: "checker",
      label: "モデル検査器",
      sublabel: "幅優先でたどる",
      icon: "checker",
      x: 14,
      y: 50,
    },
    {
      id: "queue",
      label: "探索待ちの列",
      sublabel: "queue",
      icon: "queue",
      x: 38,
      y: 50,
      initial: { rows: { 待ち: "0個" } },
    },
    {
      id: "state",
      label: "いま調べている状態",
      sublabel: "state",
      icon: "state",
      x: 62,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "visited",
      label: "訪問済み",
      sublabel: "visited",
      icon: "visited",
      x: 86,
      y: 50,
      initial: { rows: { 状態の数: "0個" } },
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
      title: "初期状態を入れる",
      actor: "checker",
      to: ["queue"],
      summary: "初期状態を探索待ちの列と訪問済みに入れる",
      explain:
        "探索は、探索待ちの列（queue、先に入れたものから取り出す）と、訪問済みの集合（visited、一度見た状態の控え）の2つで進む。最初は初期状態だけを両方に入れる。",
      set: {
        state: { isHidden: false, tone: "wait", rows: counterRows(MODEL.init) },
        queue: { rows: { 待ち: `${RESULT.levels[0]}個`, 深さ: "0" } },
        visited: { rows: { 状態の数: `${visitedUpTo(0)}個` } },
      },
    },
    expandStep(0),
    {
      ...expandStep(1),
      title: "同じ状態は1回だけ",
      summary: `深さ1から出る${LEVELS[1]!.transitionCount}本の遷移のうち、新しい状態に着くのは${LEVELS[1]!.newCount}本`,
      explain: `「Aが読む → Bが読む」と「Bが読む → Aが読む」は、どちらも「${describeCounter(MERGE_STATE)}」に着く。訪問済みにすでにあるので、2回目は列に入れない。並びは違っても、着いた状態が同じなら、その先に起きることも同じだから。`,
      set: {
        state: { rows: counterRows(MERGE_STATE) },
        queue: { rows: { 待ち: `${LEVELS[2]!.states.length}個`, 深さ: "2" } },
        visited: { tone: "ok", rows: { 状態の数: `${visitedUpTo(2)}個` } },
      },
    },
    expandStep(2),
    {
      ...expandStep(LAST_DEPTH - 1),
      kind: "found",
      title: "最後の深さで破れる",
      actor: "state",
      to: ["checker"],
      summary: `深さ${LAST_DEPTH}の${RESULT.levels[LAST_DEPTH]}個のうち1個が不変条件を破る`,
      explain: `深さ${LAST_DEPTH}で、2つのプロセスがどちらも終わった状態に着く。count=2の状態のほかに「${describeCounter(VIOLATION_STATE)}」があり、不変条件「全員が終わったら count は2」を破っている。検査器は列から取り出した状態ごとに不変条件を確かめるので、ここで見つかる。`,
      set: {
        state: { tone: "bad", rows: counterRows(VIOLATION_STATE) },
        queue: {
          rows: { 待ち: `${RESULT.levels[LAST_DEPTH]}個`, 深さ: String(LAST_DEPTH) },
        },
        visited: { rows: { 状態の数: `${visitedUpTo(LAST_DEPTH)}個` } },
        checker: { tone: "bad", rows: { 違反: `${RESULT.violationCount}個` } },
      },
      simplified:
        "TLC は状態を作った時点で不変条件を確かめ、最初の違反で止まる。ここでは列から取り出した時点で確かめ、最後までたどって違反の数も数えている。",
    },
    {
      id: "compare",
      kind: "explore",
      title: "並びと状態を比べる",
      actor: "checker",
      to: ["visited"],
      summary: `${RESULT.stateCount}状態・${RESULT.transitionCount}遷移で調べ終わる。プロセスが${LARGE_PROCESS_COUNT}つなら並び${LARGE_RUNS.total}通りに対し状態${LARGE_RESULT.stateCount}個`,
      explain: `列が空になり、${RESULT.stateCount}状態・${RESULT.transitionCount}遷移で探索が終わった。訪問済みに着いた遷移は${TOTAL_REVISITS}本あった。2つのプロセスでは並び${RUNS.total}通りの方が少ないが、${LARGE_PROCESS_COUNT}つにすると並びは${LARGE_RUNS.total}通りまで増え、状態は${LARGE_RESULT.stateCount}個で済む。同じ状態をまとめるので、状態は並びより緩やかに増える。`,
      set: {
        state: { isHidden: true },
        queue: { tone: "idle", rows: { 待ち: "0個", 深さ: null } },
        visited: { rows: { 状態の数: `${RESULT.stateCount}個` } },
        checker: {
          rows: {
            状態: `${RESULT.stateCount}個`,
            遷移: `${RESULT.transitionCount}本`,
          },
        },
      },
      detail: [
        {
          title: "並びの数と状態の数",
          fields: [
            { label: "2プロセスの並び", value: `${RUNS.total}通り` },
            { label: "2プロセスの状態", value: `${RESULT.stateCount}個` },
            {
              label: `${LARGE_PROCESS_COUNT}プロセスの並び`,
              value: `${LARGE_RUNS.total}通り`,
            },
            {
              label: `${LARGE_PROCESS_COUNT}プロセスの状態`,
              value: `${LARGE_RESULT.stateCount}個`,
            },
          ],
        },
      ],
      simplified:
        "TLC は状態そのものではなく指紋（ハッシュ値）を訪問済みに覚え、複数のスレッドで並列にたどり、入りきらない分はディスクに置く。ここでは状態を文字列の鍵にして Map に入れている。",
    },
  ],
  lab: {
    title: "プロセスの数を変える",
    hint: "プロセスを増やすと、並びは急に増えるが、状態の数はそれより緩やかに増える。足し方を「1手」にすると状態はさらに少なく、違反も消える。",
    inputs: [
      { id: "count", label: "プロセスの数（1〜4）", initial: "2" },
      { id: "atomic", label: "足し方（2手 / 1手）", initial: "2手" },
    ],
    compute: (values): Field[] => {
      const processCount = parseCount(values.count);
      const isAtomic = (values.atomic ?? "").includes("1");
      const model = counterModel(processCount, isAtomic);
      const result = check(model);
      const runs = countExecutions(model, isCounterCorrect);
      return [
        { label: "プロセスの数", value: String(processCount) },
        { label: "たどった状態", value: `${result.stateCount}個` },
        { label: "遷移", value: `${result.transitionCount}本` },
        { label: "深さごとの数", value: result.levels.join(" → ") },
        { label: "実行の並び", value: `${runs.total}通り` },
        {
          label: "不変条件を破る状態",
          value: `${result.violationCount}個`,
          tone: result.violationCount > 0 ? "bad" : "ok",
        },
      ];
    },
  },
};
