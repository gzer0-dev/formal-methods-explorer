import { translator, type Language } from "../../core/i18n";
import type { ActorPatch, Field, Lesson, Step } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
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

function forkName(fork: number, language: Language): string {
  return language === "ja" ? `フォーク${fork}` : `fork ${fork}`;
}

function orderText(order: number[], language: Language): string {
  return order.map((fork) => forkName(fork, language)).join(" → ");
}

function stepWord(count: number): string {
  return count === 1 ? "step" : "steps";
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

/** 哲学者 i が次に取りに行くフォーク。全部持っていれば undefined。 */
function wantedFork(
  i: number,
  count: number,
  isAsymmetric: boolean,
): number | undefined {
  const order = pickOrder(i, PEOPLE, isAsymmetric);
  const held = order.filter((fork) => holdersAfter(count).get(fork) === i);
  return order.find((fork) => !held.includes(fork));
}

function personRows(
  i: number,
  count: number,
  isAsymmetric: boolean,
  language: Language,
) {
  const t = translator(language);
  const order = pickOrder(i, PEOPLE, isAsymmetric);
  const held = order.filter((fork) => holdersAfter(count).get(fork) === i);
  const wanted = wantedFork(i, count, isAsymmetric);
  return {
    [t("取る順", "order")]: order.join(" → "),
    [t("持っている", "holding")]:
      held.length > 0
        ? held.map((fork) => forkName(fork, language)).join(t("・", ", "))
        : t("なし", "none"),
    [t("次に取る", "next")]:
      wanted === undefined ? t("なし", "none") : forkName(wanted, language),
  };
}

function forkRows(j: number, count: number, language: Language) {
  const t = translator(language);
  const holder = holdersAfter(count).get(j);
  return {
    [t("持ち主", "holder")]:
      holder === undefined
        ? t("空き", "free")
        : t(`哲学者${holder}`, `philosopher ${holder}`),
  };
}

function pickSteps(language: Language): Step[] {
  const t = translator(language);
  return DEADLOCK.map((ev, index) => {
    const { person, fork } = parsePick(ev);
    const count = index + 1;
    const wantedNumber = wantedFork(person, count, false);
    const wanted =
      wantedNumber === undefined ? t("なし", "none") : forkName(wantedNumber, language);
    return {
      id: `pick-${person}`,
      kind: "found",
      title: t(
        `哲学者${person}がフォーク${fork}を取る`,
        `Philosopher ${person} takes fork ${fork}`,
      ),
      actor: `p${person}`,
      to: [`f${fork}`],
      summary: t(`${count}手目: ${ev}`, `Step ${count}: ${ev}`),
      explain: t(
        `${count}手目は ${ev}。哲学者${person}がフォーク${fork}を取り、次は${wanted}を取りに行く。${count === 1 ? "pick は哲学者とフォークの両方が応じたときだけ起きる。" : "哲学者は食べ終えるまでフォークを置かないので、このフォークはしばらく空かない。"}`,
        `Step ${count} is ${ev}. Philosopher ${person} takes fork ${fork} and goes for ${wanted} next. ${count === 1 ? "pick happens only when both the philosopher and the fork take part." : "A philosopher does not put a fork down until done eating, so this fork stays taken for a while."}`,
      ),
      set: {
        [`p${person}`]: {
          tone: "wait",
          rows: personRows(person, count, false, language),
        },
        [`f${fork}`]: { tone: "wait", rows: forkRows(fork, count, language) },
      },
    };
  });
}

function stuckSet(language: Language): Record<string, ActorPatch> {
  const t = translator(language);
  return Object.fromEntries([
    ...INDEXES.map((i) => [`p${i}`, { tone: "bad" as const }]),
    ...INDEXES.map((j) => [`f${j}`, { tone: "bad" as const }]),
    [
      "checker",
      {
        tone: "bad" as const,
        rows: {
          [t("デッドロック", "deadlock")]: t(
            `${DEADLOCK.length}手で発見`,
            `found in ${DEADLOCK.length} ${stepWord(DEADLOCK.length)}`,
          ),
        },
      },
    ],
  ]);
}

function fixSet(language: Language): Record<string, ActorPatch> {
  const t = translator(language);
  return Object.fromEntries([
    ...INDEXES.map((i) => [
      `p${i}`,
      { tone: "ok" as const, rows: personRows(i, 0, true, language) },
    ]),
    ...INDEXES.map((j) => [
      `f${j}`,
      { tone: "idle" as const, rows: forkRows(j, 0, language) },
    ]),
    [
      "checker",
      {
        tone: "ok" as const,
        rows: {
          [t("状態", "states")]: t(
            `${ONE_REVERSED.stateCount}個`,
            `${ONE_REVERSED.stateCount}`,
          ),
          [t("遷移", "transitions")]: t(
            `${ONE_REVERSED.transitionCount}本`,
            `${ONE_REVERSED.transitionCount}`,
          ),
          [t("デッドロック", "deadlock")]: FIXED ? t("あり", "yes") : t("なし", "none"),
        },
      },
    ],
  ]);
}

function parsePeople(text: string | undefined): number {
  const n = Number.parseInt((text ?? "").trim(), 10);
  if (Number.isNaN(n)) return PEOPLE;
  return Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, n));
}

function parseReversed(text: string | undefined): boolean {
  // 「あり」（英語では yes）と書いたときだけ逆順にする。それ以外（空や読めない入力）は既定の「なし」に戻す。
  const value = text ?? "";
  return value.includes("あり") || /\b(yes|on)\b/i.test(value);
}

const FORK_X = [14, 38, 62];

export function cspDeadlockLesson(language: Language): Lesson {
  const t = translator(language);
  const order0 = pickOrder(0, PEOPLE, false);
  const users0 = forkUsers(0, PEOPLE);
  const reversedOrder = orderText(pickOrder(LAST, PEOPLE, true), language);
  return {
    id: "csp-deadlock",
    category: "csp",
    title: t("食事する哲学者", "Dining philosophers"),
    subtitle: t(
      "全員が1本ずつ持って、もう1本を待ち続ける",
      "Everyone holds one fork and waits for the other",
    ),
    summary: t(
      `${PEOPLE}人の哲学者と${PEOPLE}本のフォークをプロセスで書き、並行合成する。全員が左から取ると${LEFT_FIRST.stateCount}状態の中に${DEADLOCK.length}手のデッドロックがあり、1人だけ逆順にすると消える。`,
      `Write ${PEOPLE} philosophers and ${PEOPLE} forks as processes and compose them in parallel. If everyone takes the left fork first, the ${LEFT_FIRST.stateCount} states contain a ${DEADLOCK.length}-step deadlock; reversing the order for just one philosopher removes it.`,
    ),
    intro: [
      t(
        "食事する哲学者は、丸いテーブルで隣と共有するフォークを左右とも取ってから食べる、デッドロックの古典的な例だ。CSP では哲学者もフォークもプロセスとして書き、取る・置くのイベントで同期させる。CSP でのデッドロックは、正しく終わった合図（✓）を出していないのに、どのイベントも起こせない状態を指す。",
        "The dining philosophers are a classic deadlock example: around a round table, each philosopher must take both forks, each shared with a neighbour, before eating. In CSP both philosophers and forks are written as processes that synchronise on take and put events. A deadlock in CSP is a state that cannot perform any event even though it has not signalled proper termination (✓).",
      ),
      t(
        "「デッドロックを見つける」では、2本のロックを状態遷移で書いた。ここでは、部品をプロセスとして並行合成しただけで、同じ形が現れることを確かめる。全員がそろって1本目を取る順は、テストで狙って起こすのが難しい。",
        '"Finding deadlocks" wrote two locks as a state machine. Here we check that the same shape appears just by composing the parts as processes in parallel. The order in which everyone takes their first fork at once is hard to trigger on purpose in a test.',
      ),
      t(
        "図では、哲学者とフォークのカードがどの順で取られるかを追い、全員が1本ずつ持ったところで何も動けなくなる場面を見る。最後に1人だけ取る順を逆にして、その形ができなくなるかを確かめる。",
        "In the diagram, follow the order in which the philosopher and fork cards are taken, and see the moment when everyone holds one fork and nothing can move. Finally, reverse the order for just one philosopher and check that this shape can no longer form.",
      ),
    ],
    facts: [
      {
        label: t("たどった状態", "States explored"),
        value: t(
          `${LEFT_FIRST.stateCount}個・${LEFT_FIRST.transitionCount}遷移`,
          `${LEFT_FIRST.stateCount} states, ${LEFT_FIRST.transitionCount} transitions`,
        ),
      },
      {
        label: t("デッドロックまで", "Steps to deadlock"),
        value: t(`${DEADLOCK.length}手`, `${DEADLOCK.length}`),
        tone: "bad",
      },
      {
        label: t("1人だけ逆順", "One reversed"),
        value: t(
          `${ONE_REVERSED.stateCount}状態で${FIXED ? "デッドロックあり" : "デッドロックなし"}`,
          `${ONE_REVERSED.stateCount} states, ${FIXED ? "deadlock" : "no deadlock"}`,
        ),
        tone: "ok",
      },
      {
        label: t("実物の道具", "Real tools"),
        value: t("FDR の deadlock free の表明", "FDR's deadlock free assertion"),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 2.5節・3.2.5節（食事する哲学者）`,
          `${CSP_BOOK_EN}, sections 2.5 and 3.2.5 (dining philosophers)`,
        ),
      },
    ],
    actors: [
      ...INDEXES.map((i) => ({
        id: `p${i}`,
        label: t(`哲学者${i}`, `Philosopher ${i}`),
        sublabel: t("プロセス", "process"),
        icon: "people",
        x: FORK_X[i]!,
        y: 27,
        initial: { rows: personRows(i, 0, false, language) },
      })),
      ...INDEXES.map((j) => ({
        id: `f${j}`,
        label: t(`フォーク${j}`, `Fork ${j}`),
        sublabel: t("プロセス", "process"),
        icon: "lock",
        x: FORK_X[j]!,
        y: 73,
        initial: { rows: forkRows(j, 0, language) },
      })),
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("動けない状態を探す", "looks for stuck states"),
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
        title: t("哲学者をプロセスで書く", "Write a philosopher process"),
        actor: "p0",
        to: order0.map((j) => `f${j}`),
        summary: t(
          `哲学者iは pick.i.j でフォークjを取り、食べたら put.i.j で置く`,
          `Philosopher i takes fork j with pick.i.j and, after eating, puts it down with put.i.j`,
        ),
        explain: t(
          `丸いテーブルに${PEOPLE}人の哲学者が座り、隣り合う人の間にフォークが1本ずつある。哲学者は左右の2本を取ってから食べ、食べ終えたら置く。pick.0.0 は「哲学者0がフォーク0を取る」、put.0.0 は「置く」というイベント（プロセスどうしが同期して起こす出来事）。`,
          `${PEOPLE} philosophers sit at a round table with one fork between each pair of neighbours. A philosopher takes both the left and right forks, eats, and then puts them down. pick.0.0 means "philosopher 0 takes fork 0" and put.0.0 means "puts it down"; these are events (things processes do together when they synchronise).`,
        ),
        detail: [
          {
            title: t(
              "哲学者0の書き方（このサイトのモデル）",
              "Philosopher 0 (this site's model)",
            ),
            fields: [
              {
                label: "Phil(0)",
                value: `pick.0.${order0[0]} → pick.0.${order0[1]} → put.0.${order0[1]} → put.0.${order0[0]} → Phil(0)`,
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "式はこのサイトのモデル（cspModels.ts）に合わせた短い書き方で、実物の CSPM（FDR の記法）とは書き方が違う。考えることと食べることはイベントにせず、フォークを取る・置くだけを残した。",
          "The expression is a short form matching this site's model (cspModels.ts) and differs from real CSPM (the notation used by FDR). Thinking and eating are not events; only taking and putting forks are kept.",
        ),
      },
      {
        id: "fork",
        kind: "spec",
        title: t("フォークもプロセス", "Forks are processes too"),
        actor: "f0",
        to: users0.map((i) => `p${i}`),
        summary: t(
          `フォーク0は哲学者${users0.join("と哲学者")}のどちらかに取られ、置かれるまで次に取られない`,
          `Fork 0 is taken by philosopher ${users0.join(" or philosopher ")} and cannot be taken again until put down`,
        ),
        explain: t(
          `フォークも「取られる → 置かれる」をくり返すプロセスとして書く。フォーク0を取りうるのは両隣の哲学者${users0.join("と哲学者")}で、どちらが取るかは外から選ばれる（外部選択 □）。哲学者たちとフォークたちを pick と put で同期させて並行合成すると、1本を2人が同時に持つことはなくなる。`,
          `A fork is also written as a process that repeats "taken, then put down". Fork 0 can be taken by its two neighbours, philosophers ${users0.join(" and ")}, and which one takes it is chosen from outside (external choice □). Composing the philosophers and forks in parallel, synchronised on pick and put, means no fork is ever held by two people at once.`,
        ),
        detail: [
          {
            title: t(
              "フォーク0の書き方（このサイトのモデル）",
              "Fork 0 (this site's model)",
            ),
            fields: [
              {
                label: "Fork(0)",
                value: users0
                  .map((i) => `pick.${i}.0 → put.${i}.0 → Fork(0)`)
                  .join("  □  "),
                isCode: true,
              },
              {
                label: t("全体", "System"),
                value: `(${INDEXES.map((i) => `Phil(${i})`).join(" ||| ")}) [| pick, put |] (${INDEXES.map((j) => `Fork(${j})`).join(" ||| ")})`,
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "実物の CSPM（FDR の記法）とは書き方が違う。||| は同期せずに並べる合成（インターリーブ）、[| … |] は書いたイベントだけ両側がそろって起きる並行合成。",
          "This differs from real CSPM (the notation used by FDR). ||| composes without synchronising (interleaving); [| … |] is parallel composition where only the listed events need both sides.",
        ),
      },
      {
        id: "explore",
        kind: "explore",
        title: t("全部の状態をたどる", "Walk every state"),
        actor: "checker",
        to: [`p${LAST}`, `f${LAST}`],
        summary: t(
          `${LEFT_FIRST.stateCount}状態・${LEFT_FIRST.transitionCount}遷移をたどり、動けない状態を探す`,
          `Walk ${LEFT_FIRST.stateCount} states and ${LEFT_FIRST.transitionCount} transitions looking for a stuck state`,
        ),
        explain: t(
          `検査器は並行合成した全体を幅優先でたどり、${LEFT_FIRST.stateCount}状態を数える。CSP でのデッドロックは「正しく終わった合図 ✓ を出していないのに、どのイベントも起こせない状態」。幅優先なので、最初に見つかる手順が最短になる。`,
          `The checker walks the whole composition breadth-first and counts ${LEFT_FIRST.stateCount} states. A deadlock in CSP is "a state that cannot perform any event although it has not signalled proper termination ✓". Because the search is breadth-first, the first path found is the shortest.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("状態", "states")]: t(
                `${LEFT_FIRST.stateCount}個`,
                `${LEFT_FIRST.stateCount}`,
              ),
              [t("遷移", "transitions")]: t(
                `${LEFT_FIRST.transitionCount}本`,
                `${LEFT_FIRST.transitionCount}`,
              ),
            },
          },
        },
        simplified: t(
          "実物の FDR は deadlock free の表明でデッドロックを調べる。同じモデルを CSPM で書いて ProB にかけると、2人では2手、3人では pick.0.0 → pick.1.1 → pick.2.2 の3手でデッドロックし、1人だけ逆順にすると無くなることが、このサイトの結果と一致した（リポジトリの specs/csp）。",
          "Real FDR checks for deadlock with a deadlock free assertion. Writing the same model in CSPM and running ProB matched this site's results: 2 philosophers deadlock in 2 steps, 3 in 3 steps (pick.0.0 → pick.1.1 → pick.2.2), and reversing one philosopher removes it (specs/csp in the repository).",
        ),
      },
      ...pickSteps(language),
      {
        id: "stuck",
        kind: "found",
        title: t("全員が1本ずつ持つ", "Everyone holds one fork"),
        actor: "checker",
        to: INDEXES.map((i) => `p${i}`),
        summary: t(
          `起こせるイベントが${STUCK_MOVES}個で、✓ も出ていない。${DEADLOCK.length}手でデッドロック`,
          `${STUCK_MOVES} events possible and no ✓. Deadlock in ${DEADLOCK.length} steps`,
        ),
        explain: t(
          `全員が左のフォークを持ち、右のフォークは隣の人が持っている。誰も2本目を取れず、置くのは食べた後なので誰も手放さない。起こせるイベントは${STUCK_MOVES}個で ✓ も出ていないため、これがデッドロック。サイトの「デッドロックを見つける」の2本のロックと同じ形を、プロセスの組み合わせで書いたもの。`,
          `Everyone holds their left fork, and each right fork is held by the neighbour. Nobody can take a second fork, and since forks are put down only after eating, nobody lets go. ${STUCK_MOVES} events are possible and there is no ✓, so this is a deadlock. It is the same shape as the two locks in "Finding deadlocks", written as a composition of processes.`,
        ),
        set: stuckSet(language),
        detail: [
          {
            title: t("検査器が返した手順", "Steps the checker returned"),
            fields: DEADLOCK.map((ev, index) => ({
              label: t(`${index + 1}手目`, `Step ${index + 1}`),
              value: ev,
            })),
          },
        ],
      },
      {
        id: "fix",
        kind: "fix",
        title: t("1人だけ逆順にする", "Reverse one philosopher"),
        actor: "checker",
        to: [`p${LAST}`],
        summary: t(
          `哲学者${LAST}だけ${reversedOrder}の順にすると、${ONE_REVERSED.stateCount}状態でデッドロック${FIXED ? "あり" : "なし"}`,
          `If only philosopher ${LAST} takes ${reversedOrder}, the ${ONE_REVERSED.stateCount} states have ${FIXED ? "a deadlock" : "no deadlock"}`,
        ),
        explain: t(
          `哲学者${LAST}だけが${reversedOrder}の順に取るように直す。全員が1本ずつ持って輪になる形ができなくなり、たどり直すと${ONE_REVERSED.stateCount}状態・${ONE_REVERSED.transitionCount}遷移のどこにもデッドロックは${FIXED ? "残った" : "無い"}。ロックを取る順をそろえるのと同じ考え方。`,
          `Change only philosopher ${LAST} to take ${reversedOrder}. The ring where everyone holds one fork can no longer form; walking again, ${FIXED ? "a deadlock remains" : "there is no deadlock anywhere"} in the ${ONE_REVERSED.stateCount} states and ${ONE_REVERSED.transitionCount} transitions. It is the same idea as taking locks in a consistent order.`,
        ),
        set: fixSet(language),
      },
    ],
    lab: {
      title: t("人数と取る順を変える", "Change the number and the order"),
      hint: t(
        `人数は${MIN_PEOPLE}〜${MAX_PEOPLE}。「1人だけ逆順」を「あり」にすると、最後の哲学者だけ右から取る。`,
        `Philosophers: ${MIN_PEOPLE}-${MAX_PEOPLE}. Set "One reversed" to "yes" and only the last philosopher takes the right fork first.`,
      ),
      inputs: [
        {
          id: "people",
          label: t(
            `人数（${MIN_PEOPLE}〜${MAX_PEOPLE}）`,
            `Philosophers (${MIN_PEOPLE}-${MAX_PEOPLE})`,
          ),
          initial: `${PEOPLE}`,
        },
        {
          id: "reversed",
          label: t("1人だけ逆順（あり / なし）", "One reversed (yes / no)"),
          initial: t("なし", "no"),
        },
      ],
      compute: (values): Field[] => {
        const n = parsePeople(values.people);
        const isAsymmetric = parseReversed(values.reversed);
        const lts = explore(philosophers(n, isAsymmetric), PHILOSOPHER_ENV);
        const trace = shortestDeadlock(n, isAsymmetric);
        return [
          { label: t("人数", "Philosophers"), value: t(`${n}人`, `${n}`) },
          {
            label: t("1人だけ逆順", "One reversed"),
            value: isAsymmetric ? t("あり", "yes") : t("なし", "no"),
          },
          {
            label: t("状態", "States"),
            value: t(`${lts.stateCount}個`, `${lts.stateCount}`),
          },
          {
            label: t("遷移", "Transitions"),
            value: t(`${lts.transitionCount}本`, `${lts.transitionCount}`),
          },
          {
            label: t("デッドロック", "Deadlock"),
            value: trace
              ? t(
                  `あり（${trace.length}手）`,
                  `yes (${trace.length} ${stepWord(trace.length)})`,
                )
              : t("なし", "none"),
            tone: trace ? "bad" : "ok",
          },
          {
            label: t("最短の手順", "Shortest path"),
            value: trace ? trace.join(" → ") : t("なし", "none"),
            isCode: true,
          },
        ];
      },
    },
  };
}
