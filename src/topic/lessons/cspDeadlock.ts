import type { ActorPatch, Field, Lesson, Step } from "../../core/types";
import { CSP_BOOK } from "../references";
import { deadlocks, explore, moves, ref } from "../csp";
import { philosophers, PHILOSOPHER_ENV } from "../cspModels";

const PEOPLE = 3;
const MIN_PEOPLE = 2;
const MAX_PEOPLE = 5;

/** 最短のデッドロックの手順。無ければ null。deadlocks は短い順を約束しないので長さで選ぶ。 */
function shortestDeadlock(n: number, isAsymmetric: boolean): string[] | null {
  const traces = deadlocks(philosophers(n, isAsymmetric), PHILOSOPHER_ENV);
  if (traces.length === 0) return null;
  return traces.reduce((best, trace) => (trace.length < best.length ? trace : best));
}

/** イベント名「pick.0.1」を（哲学者 0 がフォーク 1 を）に読む。書式が変わったら画面に「NaN」を出す前に止める。 */
function parsePick(ev: string): { person: number; fork: number } {
  const match = ev.match(/^pick\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`pick.i.j の形ではないイベント: ${ev}`);
  return { person: Number(match[1]), fork: Number(match[2]) };
}

/** 哲学者 i がフォークを取る順。モデルの定義を moves でたどって読む（左右の計算を書き直さない）。 */
function pickOrder(i: number, n: number, isAsymmetric: boolean): number[] {
  const first = moves(ref("Phil", i, n, isAsymmetric ? 1 : 0), PHILOSOPHER_ENV)[0]!;
  const second = moves(first.to, PHILOSOPHER_ENV)[0]!;
  return [first.ev, second.ev].map((ev) => parsePick(ev).fork);
}

/** フォーク j を取りうる2人（フォークのプロセスが最初に受け付ける pick から読む）。 */
function forkUsers(j: number, n: number): number[] {
  return moves(ref("Fork", j, n), PHILOSOPHER_ENV).map((m) => parsePick(m.ev).person);
}

function orderText(order: number[]): string {
  return order.map((fork) => `フォーク${fork}`).join(" → ");
}

const LEFT_FIRST = explore(philosophers(PEOPLE, false), PHILOSOPHER_ENV);
const ONE_REVERSED = explore(philosophers(PEOPLE, true), PHILOSOPHER_ENV);
const FOUND = shortestDeadlock(PEOPLE, false);
if (!FOUND) throw new Error("全員が左から取る哲学者でデッドロックが見つからない");
const DEADLOCK = FOUND;
const FIXED = shortestDeadlock(PEOPLE, true);

// デッドロックした状態（出る遷移が無く、正しく終わってもいない状態）で起こせるイベントの数
const BUSY_KEYS = new Set(LEFT_FIRST.edges.map((edge) => edge.from));
const STUCK_KEY = [...LEFT_FIRST.states.keys()].find(
  (key) => !BUSY_KEYS.has(key) && LEFT_FIRST.states.get(key)!.k !== "omega",
)!;
const STUCK_MOVES = moves(LEFT_FIRST.states.get(STUCK_KEY)!, PHILOSOPHER_ENV).length;

const INDEXES = Array.from({ length: PEOPLE }, (_, i) => i);
const LAST = PEOPLE - 1;

/** 手順の先頭 count 個を起こした後、誰がどのフォークを持っているか。 */
function holdersAfter(count: number): Map<number, number> {
  return new Map(
    DEADLOCK.slice(0, count).map((ev) => [parsePick(ev).fork, parsePick(ev).person]),
  );
}

function personRows(i: number, count: number, isAsymmetric: boolean) {
  const order = pickOrder(i, PEOPLE, isAsymmetric);
  const held = order.filter((fork) => holdersAfter(count).get(fork) === i);
  const wanted = order.find((fork) => !held.includes(fork));
  return {
    取る順: order.join(" → "),
    持っている:
      held.length > 0 ? held.map((fork) => `フォーク${fork}`).join("・") : "なし",
    次に取る: wanted === undefined ? "なし" : `フォーク${wanted}`,
  };
}

function forkRows(j: number, count: number) {
  const holder = holdersAfter(count).get(j);
  return { 持ち主: holder === undefined ? "空き" : `哲学者${holder}` };
}

const pickSteps: Step[] = DEADLOCK.map((ev, index) => {
  const { person, fork } = parsePick(ev);
  const count = index + 1;
  const wanted = personRows(person, count, false).次に取る;
  return {
    id: `pick-${person}`,
    kind: "found",
    title: `哲学者${person}がフォーク${fork}を取る`,
    actor: `p${person}`,
    to: [`f${fork}`],
    summary: `${count}手目: ${ev}`,
    explain: `${count}手目は ${ev}。哲学者${person}がフォーク${fork}を取り、次は${wanted}を取りに行く。${count === 1 ? "pick は哲学者とフォークの両方が応じたときだけ起きる。" : "哲学者は食べ終えるまでフォークを置かないので、このフォークはしばらく空かない。"}`,
    set: {
      [`p${person}`]: { tone: "wait", rows: personRows(person, count, false) },
      [`f${fork}`]: { tone: "wait", rows: forkRows(fork, count) },
    },
  };
});

const stuckSet: Record<string, ActorPatch> = Object.fromEntries([
  ...INDEXES.map((i) => [`p${i}`, { tone: "bad" as const }]),
  ...INDEXES.map((j) => [`f${j}`, { tone: "bad" as const }]),
  [
    "checker",
    { tone: "bad" as const, rows: { デッドロック: `${DEADLOCK.length}手で発見` } },
  ],
]);

const fixSet: Record<string, ActorPatch> = Object.fromEntries([
  ...INDEXES.map((i) => [
    `p${i}`,
    { tone: "ok" as const, rows: personRows(i, 0, true) },
  ]),
  ...INDEXES.map((j) => [`f${j}`, { tone: "idle" as const, rows: forkRows(j, 0) }]),
  [
    "checker",
    {
      tone: "ok" as const,
      rows: {
        状態: `${ONE_REVERSED.stateCount}個`,
        遷移: `${ONE_REVERSED.transitionCount}本`,
        デッドロック: FIXED ? "あり" : "なし",
      },
    },
  ],
]);

function parsePeople(text: string | undefined): number {
  const n = Number.parseInt((text ?? "").trim(), 10);
  if (Number.isNaN(n)) return PEOPLE;
  return Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, n));
}

function parseReversed(text: string | undefined): boolean {
  // 「あり」と書いたときだけ逆順にする。それ以外（空や読めない入力）は既定の「なし」に戻す。
  return (text ?? "").includes("あり");
}

const FORK_X = [14, 38, 62];

export const cspDeadlockLesson: Lesson = {
  id: "csp-deadlock",
  category: "csp",
  title: "食事する哲学者",
  subtitle: "全員が1本ずつ持って、もう1本を待ち続ける",
  summary: `${PEOPLE}人の哲学者と${PEOPLE}本のフォークをプロセスで書き、並行合成する。全員が左から取ると${LEFT_FIRST.stateCount}状態の中に${DEADLOCK.length}手のデッドロックがあり、1人だけ逆順にすると消える。`,
  facts: [
    {
      label: "たどった状態",
      value: `${LEFT_FIRST.stateCount}個・${LEFT_FIRST.transitionCount}遷移`,
    },
    { label: "デッドロックまで", value: `${DEADLOCK.length}手`, tone: "bad" },
    {
      label: "1人だけ逆順",
      value: `${ONE_REVERSED.stateCount}状態で${FIXED ? "デッドロックあり" : "デッドロックなし"}`,
      tone: "ok",
    },
    { label: "実物の道具", value: "FDR の deadlock free の表明" },
    { label: "参考文献", value: `${CSP_BOOK} 2.5節・3.2.5節（食事する哲学者）` },
  ],
  actors: [
    ...INDEXES.map((i) => ({
      id: `p${i}`,
      label: `哲学者${i}`,
      sublabel: "プロセス",
      icon: "people",
      x: FORK_X[i]!,
      y: 27,
      initial: { rows: personRows(i, 0, false) },
    })),
    ...INDEXES.map((j) => ({
      id: `f${j}`,
      label: `フォーク${j}`,
      sublabel: "プロセス",
      icon: "lock",
      x: FORK_X[j]!,
      y: 73,
      initial: { rows: forkRows(j, 0) },
    })),
    {
      id: "checker",
      label: "検査器",
      sublabel: "動けない状態を探す",
      icon: "checker",
      x: 86,
      y: 50,
      initial: { isHidden: true },
    },
  ],
  links: [
    ...INDEXES.flatMap((i) =>
      pickOrder(i, PEOPLE, false).map((j) => ({ from: `p${i}`, to: `f${j}` })),
    ),
    { from: "checker", to: `p${LAST}` },
    { from: "checker", to: `f${LAST}` },
  ],
  steps: [
    {
      id: "philosopher",
      kind: "spec",
      title: "哲学者をプロセスで書く",
      actor: "p0",
      to: pickOrder(0, PEOPLE, false).map((j) => `f${j}`),
      summary: `哲学者iは pick.i.j でフォークjを取り、食べたら put.i.j で置く`,
      explain: `丸いテーブルに${PEOPLE}人の哲学者が座り、隣り合う人の間にフォークが1本ずつある。哲学者は左右の2本を取ってから食べ、食べ終えたら置く。pick.0.0 は「哲学者0がフォーク0を取る」、put.0.0 は「置く」というイベント（プロセスどうしが同期して起こす出来事）。`,
      detail: [
        {
          title: "哲学者0の書き方（このサイトのモデル）",
          fields: [
            {
              label: "Phil(0)",
              value: `pick.0.${pickOrder(0, PEOPLE, false)[0]} → pick.0.${pickOrder(0, PEOPLE, false)[1]} → put.0.${pickOrder(0, PEOPLE, false)[1]} → put.0.${pickOrder(0, PEOPLE, false)[0]} → Phil(0)`,
              isCode: true,
            },
          ],
        },
      ],
      simplified:
        "式はこのサイトのモデル（cspModels.ts）に合わせた短い書き方で、実物の CSPM（FDR の記法）とは書き方が違う。考えることと食べることはイベントにせず、フォークを取る・置くだけを残した。",
    },
    {
      id: "fork",
      kind: "spec",
      title: "フォークもプロセス",
      actor: "f0",
      to: forkUsers(0, PEOPLE).map((i) => `p${i}`),
      summary: `フォーク0は哲学者${forkUsers(0, PEOPLE).join("と哲学者")}のどちらかに取られ、置かれるまで次に取られない`,
      explain: `フォークも「取られる → 置かれる」をくり返すプロセスとして書く。フォーク0を取りうるのは両隣の哲学者${forkUsers(0, PEOPLE).join("と哲学者")}で、どちらが取るかは外から選ばれる（外部選択 □）。哲学者たちとフォークたちを pick と put で同期させて並行合成すると、1本を2人が同時に持つことはなくなる。`,
      detail: [
        {
          title: "フォーク0の書き方（このサイトのモデル）",
          fields: [
            {
              label: "Fork(0)",
              value: forkUsers(0, PEOPLE)
                .map((i) => `pick.${i}.0 → put.${i}.0 → Fork(0)`)
                .join("  □  "),
              isCode: true,
            },
            {
              label: "全体",
              value: `(${INDEXES.map((i) => `Phil(${i})`).join(" ||| ")}) [| pick, put |] (${INDEXES.map((j) => `Fork(${j})`).join(" ||| ")})`,
              isCode: true,
            },
          ],
        },
      ],
      simplified:
        "実物の CSPM（FDR の記法）とは書き方が違う。||| は同期せずに並べる合成（インターリーブ）、[| … |] は書いたイベントだけ両側がそろって起きる並行合成。",
    },
    {
      id: "explore",
      kind: "explore",
      title: "全部の状態をたどる",
      actor: "checker",
      to: [`p${LAST}`, `f${LAST}`],
      summary: `${LEFT_FIRST.stateCount}状態・${LEFT_FIRST.transitionCount}遷移をたどり、動けない状態を探す`,
      explain: `検査器は並行合成した全体を幅優先でたどり、${LEFT_FIRST.stateCount}状態を数える。CSP でのデッドロックは「正しく終わった合図 ✓ を出していないのに、どのイベントも起こせない状態」。幅優先なので、最初に見つかる手順が最短になる。`,
      set: {
        checker: {
          isHidden: false,
          tone: "wait",
          rows: {
            状態: `${LEFT_FIRST.stateCount}個`,
            遷移: `${LEFT_FIRST.transitionCount}本`,
          },
        },
      },
      simplified:
        "実物の FDR は deadlock free の表明でデッドロックを調べる。同じモデルを CSPM で書いて ProB にかけると、2人では2手、3人では pick.0.0 → pick.1.1 → pick.2.2 の3手でデッドロックし、1人だけ逆順にすると無くなることが、このサイトの結果と一致した（リポジトリの specs/csp）。",
    },
    ...pickSteps,
    {
      id: "stuck",
      kind: "found",
      title: "全員が1本ずつ持つ",
      actor: "checker",
      to: INDEXES.map((i) => `p${i}`),
      summary: `起こせるイベントが${STUCK_MOVES}個で、✓ も出ていない。${DEADLOCK.length}手でデッドロック`,
      explain: `全員が左のフォークを持ち、右のフォークは隣の人が持っている。誰も2本目を取れず、置くのは食べた後なので誰も手放さない。起こせるイベントは${STUCK_MOVES}個で ✓ も出ていないため、これがデッドロック。サイトの「デッドロックを見つける」の2本のロックと同じ形を、プロセスの組み合わせで書いたもの。`,
      set: stuckSet,
      detail: [
        {
          title: "検査器が返した手順",
          fields: DEADLOCK.map((ev, index) => ({
            label: `${index + 1}手目`,
            value: ev,
          })),
        },
      ],
    },
    {
      id: "fix",
      kind: "fix",
      title: "1人だけ逆順にする",
      actor: "checker",
      to: [`p${LAST}`],
      summary: `哲学者${LAST}だけ${orderText(pickOrder(LAST, PEOPLE, true))}の順にすると、${ONE_REVERSED.stateCount}状態でデッドロック${FIXED ? "あり" : "なし"}`,
      explain: `哲学者${LAST}だけが${orderText(pickOrder(LAST, PEOPLE, true))}の順に取るように直す。全員が1本ずつ持って輪になる形ができなくなり、たどり直すと${ONE_REVERSED.stateCount}状態・${ONE_REVERSED.transitionCount}遷移のどこにもデッドロックは${FIXED ? "残った" : "無い"}。ロックを取る順をそろえるのと同じ考え方。`,
      set: fixSet,
    },
  ],
  lab: {
    title: "人数と取る順を変える",
    hint: `人数は${MIN_PEOPLE}〜${MAX_PEOPLE}。「1人だけ逆順」を「あり」にすると、最後の哲学者だけ右から取る。`,
    inputs: [
      {
        id: "people",
        label: `人数（${MIN_PEOPLE}〜${MAX_PEOPLE}）`,
        initial: `${PEOPLE}`,
      },
      { id: "reversed", label: "1人だけ逆順（あり / なし）", initial: "なし" },
    ],
    compute: (values): Field[] => {
      const n = parsePeople(values.people);
      const isAsymmetric = parseReversed(values.reversed);
      const lts = explore(philosophers(n, isAsymmetric), PHILOSOPHER_ENV);
      const trace = shortestDeadlock(n, isAsymmetric);
      return [
        { label: "人数", value: `${n}人` },
        { label: "1人だけ逆順", value: isAsymmetric ? "あり" : "なし" },
        { label: "状態", value: `${lts.stateCount}個` },
        { label: "遷移", value: `${lts.transitionCount}本` },
        {
          label: "デッドロック",
          value: trace ? `あり（${trace.length}手）` : "なし",
          tone: trace ? "bad" : "ok",
        },
        {
          label: "最短の手順",
          value: trace ? trace.join(" → ") : "なし",
          isCode: true,
        },
      ];
    },
  },
};
