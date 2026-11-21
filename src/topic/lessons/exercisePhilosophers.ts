import { translator, type Language } from "../../core/i18n";
import type { Actor, ActorPatch, Lesson, Link, Step } from "../../core/types";
import { deadlocks, moves, ref } from "../csp";
import { PHILOSOPHER_ENV, philosophers } from "../cspModels";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";

// 演習: 4人の哲学者が全員左から取るとき、デッドロックまでの最短は何手か（元は exerciseCsp.ts の問3）。
// 答える前は哲学者とフォークの書き方だけを見せ、全員が1本ずつ持つ場面も手数も出さない。
// 答えると、検査器が見つけた最短の手順を1手ずつ図で追い、最後に全員が止まる場面を見せる。

type Translate = (ja: string, en: string) => string;

// 問題の条件。元の問題（exerciseCsp.ts の問3）と同じ。
const PEOPLE = 4;
const INDEXES = Array.from({ length: PEOPLE }, (_, i) => i);
const LAST = PEOPLE - 1;
// 横に5列（哲学者とフォークの4列＋検査器）を 11〜89 に等間隔で並べる。カード幅（約18.3）より広い 19.5 の間隔になる。
const COLUMN_X = [11, 30.5, 50, 69.5];

// 正解の計算。deadlocks は短い順を約束しないので、長さで最短を選ぶ（cspDeadlock.ts・exerciseCsp.ts と同じ）。
const SHORTEST = lazy(() => {
  const traces = deadlocks(philosophers(PEOPLE, false), PHILOSOPHER_ENV);
  if (traces.length === 0) return null;
  return traces.reduce((best, trace) => (trace.length < best.length ? trace : best));
});

/** イベント名「pick.0.1」を（哲学者0がフォーク1を）に読む。書式が変わったら画面に「NaN」を出す前に止める。 */
function parsePick(ev: string): { person: number; fork: number } {
  const match = ev.match(/^pick\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`pick.i.j の形ではないイベント: ${ev}`);
  return { person: Number(match[1]), fork: Number(match[2]) };
}

/** 哲学者 i がフォークを取る順。モデルの定義を moves でたどって読む（左右の計算を書き直さない）。 */
function pickOrder(i: number): number[] {
  const first = moves(ref("Phil", i, PEOPLE, 0), PHILOSOPHER_ENV)[0]!;
  const second = moves(first.to, PHILOSOPHER_ENV)[0]!;
  return [first.ev, second.ev].map((ev) => parsePick(ev).fork);
}

/** フォーク j を取りうる2人（フォークのプロセスが最初に受け付ける pick から読む）。 */
function forkUsers(j: number): number[] {
  return moves(ref("Fork", j, PEOPLE), PHILOSOPHER_ENV).map(
    (m) => parsePick(m.ev).person,
  );
}

// モデルの形（取る順・取りうる人）は軽いので最上位で読む。
const PICK_ORDERS = INDEXES.map(pickOrder);
const FORK_USERS = INDEXES.map(forkUsers);

function forkName(fork: number, t: Translate): string {
  return t(`フォーク${fork}`, `fork ${fork}`);
}

/** 手順の先頭 count 個を起こした後、誰がどのフォークを持っているか。 */
function holdersAfter(trace: string[], count: number): Map<number, number> {
  return new Map(
    trace.slice(0, count).map((ev) => [parsePick(ev).fork, parsePick(ev).person]),
  );
}

function personRows(i: number, holders: Map<number, number>, t: Translate) {
  const order = PICK_ORDERS[i]!;
  const held = order.filter((fork) => holders.get(fork) === i);
  const wanted = order.find((fork) => !held.includes(fork));
  return {
    [t("取る順", "order")]: order.join(" → "),
    [t("持っている", "holding")]:
      held.length > 0
        ? held.map((fork) => forkName(fork, t)).join(t("・", ", "))
        : t("なし", "none"),
    [t("次に取る", "next")]:
      wanted === undefined ? t("なし", "none") : forkName(wanted, t),
  };
}

function forkRows(j: number, holders: Map<number, number>, t: Translate) {
  const holder = holders.get(j);
  return {
    [t("持ち主", "holder")]:
      holder === undefined
        ? t("空き", "free")
        : t(`哲学者${holder}`, `philosopher ${holder}`),
  };
}

function actorsOf(t: Translate): Actor[] {
  const empty = new Map<number, number>();
  return [
    ...INDEXES.map((i) => ({
      id: `p${i}`,
      label: t(`哲学者${i}`, `Philosopher ${i}`),
      sublabel: t("プロセス", "process"),
      icon: "people",
      x: COLUMN_X[i]!,
      y: 27,
      initial: { rows: personRows(i, empty, t) },
    })),
    ...INDEXES.map((j) => ({
      id: `f${j}`,
      label: t(`フォーク${j}`, `Fork ${j}`),
      sublabel: t("プロセス", "process"),
      icon: "lock",
      x: COLUMN_X[j]!,
      y: 73,
      initial: { rows: forkRows(j, empty, t) },
    })),
    {
      id: "checker",
      label: t("検査器", "Checker"),
      sublabel: t("動けない状態を探す", "looks for stuck states"),
      icon: "checker",
      x: 89,
      y: 50,
      initial: { isHidden: true },
    },
  ];
}

const LINKS: Link[] = [
  ...INDEXES.flatMap((i) =>
    PICK_ORDERS[i]!.map((j) => ({ from: `p${i}`, to: `f${j}` })),
  ),
  { from: "checker", to: `p${LAST}` },
  { from: "checker", to: `f${LAST}` },
];

function setupSteps(t: Translate): Step[] {
  const order0 = PICK_ORDERS[0]!;
  const users0 = FORK_USERS[0]!;
  return [
    {
      id: "philosopher",
      kind: "spec",
      title: t("全員が左から取る", "Everyone takes the left first"),
      actor: "p0",
      to: order0.map((j) => `f${j}`),
      summary: t(
        "哲学者iは pick.i.j でフォークjを取り、2本そろうと食べて put.i.j で置く",
        "Philosopher i takes fork j with pick.i.j and, once holding both, eats and puts them down with put.i.j",
      ),
      explain: t(
        `丸いテーブルに${PEOPLE}人の哲学者が座り、隣り合う人の間にフォークが1本ずつある。どの哲学者も、左のフォークを取ってから右のフォークを取り、食べ終えたら2本とも置く。哲学者0なら${forkName(order0[0]!, t)}、${forkName(order0[1]!, t)}の順に取る（カードの「取る順」）。`,
        `${PEOPLE} philosophers sit at a round table with one fork between each pair of neighbours. Every philosopher takes the left fork, then the right fork, and puts both down after eating. Philosopher 0 takes ${forkName(order0[0]!, t)}, then ${forkName(order0[1]!, t)} (the "order" row on the card).`,
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
        "考えることと食べることはイベントにせず、フォークを取る・置くだけを残した。",
        "Thinking and eating are not events; only taking and putting forks are kept.",
      ),
    },
    {
      id: "fork",
      kind: "spec",
      title: t("フォークは1人ずつ", "One person per fork"),
      actor: "f0",
      to: users0.map((i) => `p${i}`),
      summary: t(
        `フォーク0は哲学者${users0.join("と哲学者")}のどちらかに取られ、置かれるまで次に取られない`,
        `Fork 0 is taken by philosopher ${users0.join(" or philosopher ")} and cannot be taken again until put down`,
      ),
      explain: t(
        `フォークも「取られる → 置かれる」をくり返すプロセスとして書く。フォーク0を取りうるのは両隣の哲学者${users0.join("と哲学者")}で、哲学者たちとフォークたちを pick と put で同期させて並行合成するので、1本を2人が同時に持つことはない。`,
        `A fork is also written as a process that repeats "taken, then put down". Fork 0 can be taken by its two neighbours, philosophers ${users0.join(" and ")}. The philosophers and forks are composed in parallel, synchronised on pick and put, so no fork is ever held by two people at once.`,
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
          ],
        },
      ],
    },
    {
      id: "question",
      kind: "explore",
      title: t("止まるまで最短何手か", "Fewest steps to a deadlock?"),
      actor: "checker",
      to: [`p${LAST}`, `f${LAST}`],
      summary: t(
        "デッドロック（誰も動けなくなること）に至る最短の手順が何手かを答える",
        "Answer how many steps the shortest path to a deadlock (where no one can move) takes",
      ),
      explain: t(
        `食事する哲学者を${PEOPLE}人にする。全員が左のフォークを取ってから右のフォークを取る。デッドロック（誰も動けなくなること）に至る最短の手順は何手か。1手は「哲学者がフォークを1本取る」のようなイベント1つ。下の「答え合わせ」に数を入れると、検査器が見つけた手順がこの図に足される。ヒント: 誰も2本目を取れなくなるのは、どんなときか。`,
        `Use ${PEOPLE} dining philosophers. Each takes the left fork, then the right fork. How many steps is the shortest path to a deadlock (where no one can move)? One step is one event, such as "a philosopher takes one fork". Enter a number under "Check your answer" below and the steps the checker found are added to this diagram. Hint: when can no one pick up a second fork?`,
      ),
      set: {
        checker: {
          isHidden: false,
          tone: "wait",
          rows: { [t("問い", "question")]: t("最短は何手？", "Fewest steps?") },
        },
      },
    },
  ];
}

function pickSteps(trace: string[], t: Translate): Step[] {
  return trace.map((ev, index) => {
    const { person, fork } = parsePick(ev);
    const count = index + 1;
    const holders = holdersAfter(trace, count);
    const rows = personRows(person, holders, t);
    const wanted = rows[t("次に取る", "next")]!;
    return {
      id: `move-${count}`,
      kind: "explore",
      title: t(`${count}手目: ${ev}`, `Step ${count}: ${ev}`),
      actor: `p${person}`,
      to: [`f${fork}`],
      summary: t(
        `哲学者${person}が${forkName(fork, t)}を取る`,
        `Philosopher ${person} takes ${forkName(fork, t)}`,
      ),
      explain: t(
        `${count}手目は ${ev}。哲学者${person}が${forkName(fork, t)}を取り、次は${wanted}を取りに行く。${count === 1 ? "pick は哲学者とフォークの両方が応じたときだけ起きる。" : "哲学者は食べ終えるまでフォークを置かないので、このフォークはしばらく空かない。"}`,
        `Step ${count} is ${ev}. Philosopher ${person} takes ${forkName(fork, t)} and goes for ${wanted} next. ${count === 1 ? "pick happens only when both the philosopher and the fork take part." : "A philosopher does not put a fork down until done eating, so this fork stays taken for a while."}`,
      ),
      set: {
        [`p${person}`]: { tone: "wait", rows },
        [`f${fork}`]: { tone: "wait", rows: forkRows(fork, holders, t) },
        ...(index === 0
          ? {
              checker: {
                rows: { [t("たどる", "walk")]: t("幅優先", "breadth-first") },
              },
            }
          : {}),
      },
    };
  });
}

function stuckStep(trace: string[], t: Translate): Step {
  // 最短の手順が「全員が1本ずつ取る」形のときだけ、手数が人数と同じ理由を添える。
  const isOnePerPerson =
    trace.length === PEOPLE &&
    new Set(trace.map((ev) => parsePick(ev).person)).size === PEOPLE;
  const set: Record<string, ActorPatch> = Object.fromEntries([
    ...INDEXES.map((i) => [`p${i}`, { tone: "bad" as const }]),
    ...INDEXES.map((j) => [`f${j}`, { tone: "bad" as const }]),
    [
      "checker",
      {
        tone: "bad" as const,
        rows: {
          [t("問い", "question")]: null,
          [t("たどる", "walk")]: null,
          [t("デッドロック", "deadlock")]: t(
            `${trace.length}手で発見`,
            `found in ${trace.length} steps`,
          ),
        },
      },
    ],
  ]);
  return {
    id: "stuck",
    kind: "found",
    title: t("誰も動けない", "No one can move"),
    actor: "checker",
    to: [`p${LAST}`, `f${LAST}`],
    summary: t(
      `${trace.length}手で、全員が1本ずつ持ったまま止まる`,
      `After ${trace.length} steps, everyone is stuck holding one fork`,
    ),
    explain: t(
      `${trace.length}手の後、どの哲学者も左のフォークを1本持ち、右のフォークは隣の人が持っている。誰も2本目を取れず、食べ終えないのでフォークも置かれない。正しく終わった合図（✓）も無いので、これはデッドロックだ。${isOnePerPerson ? "1人が1本取るのに1手かかるので、全員が1本ずつ持つには人数分の手数が要り、それより短い手順では止まらない。" : ""}`,
      `After ${trace.length} steps, every philosopher holds their left fork, and each right fork is held by a neighbour. No one can take a second fork, and since no one finishes eating, no fork is put down. There is no sign of proper termination (✓) either, so this is a deadlock.${isOnePerPerson ? " Each philosopher needs one step to take one fork, so everyone holding one takes as many steps as there are people; no shorter path gets stuck." : ""}`,
    ),
    set,
  };
}

function solutionSteps(t: Translate): Step[] {
  const trace = SHORTEST();
  if (trace === null) {
    return [
      {
        id: "no-deadlock",
        kind: "explore",
        title: t("止まる状態は無い", "No stuck state"),
        actor: "checker",
        to: [`p${LAST}`, `f${LAST}`],
        summary: t(
          "全部の状態をたどっても、動けない状態は無かった",
          "No stuck state in any reachable state",
        ),
        explain: t(
          "検査器が全部の状態をたどったが、正しく終わっていないのに動けない状態は無かった。",
          "The checker walked every state and found none that is stuck without having terminated properly.",
        ),
        set: {
          checker: {
            tone: "ok",
            rows: { [t("デッドロック", "deadlock")]: t("なし", "none") },
          },
        },
      },
    ];
  }
  return [...pickSteps(trace, t), stuckStep(trace, t)];
}

export function exercisePhilosophersLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-philosophers",
      title: t(`演習: ${PEOPLE}人の哲学者`, `Exercise: ${PEOPLE} philosophers`),
      subtitle: t(
        "4人が同じ向きに取ると、何手で止まるか",
        "If four all reach the same way, how soon do they get stuck?",
      ),
      summary: t(
        `哲学者${PEOPLE}人が全員左から取るとき、デッドロックまでの最短の手数を答える。答えると、検査器が見つけた手順を1手ずつ図で追える。`,
        `If all ${PEOPLE} philosophers take the left fork first, answer how many steps the nearest deadlock takes. Once you answer, you can follow the steps the checker found, one at a time.`,
      ),
      intro: [
        t(
          "「食事する哲学者」で見たモデルを、人数を増やして使う。哲学者もフォークもプロセスで、フォークを取る・置くのイベントで同期する。全員が同じ向きに取るとき、誰も動けなくなる（デッドロック）までの最短の手順を問う。",
          'This uses the model from "Dining philosophers" with more people. Both philosophers and forks are processes that synchronise on the events of taking and putting forks. When everyone takes forks in the same direction, the question is how short the path to a state where no one can move (a deadlock) can be.',
        ),
        t(
          "図はまず哲学者とフォークの書き方だけを見せる。下の「答え合わせ」に数を入れると、検査器が見つけた手順が足される。哲学者のカードの「持っている」と「次に取る」、フォークのカードの「持ち主」が、1手ごとにどう変わるかを追う。",
          'The diagram first shows only how the philosophers and forks are written. When you enter a number under "Check your answer", the steps the checker found are added. Follow how the "holding" and "next" rows on the philosopher cards and the "holder" row on the fork cards change with each step.',
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t(`食事する哲学者（${PEOPLE}人）`, `Dining philosophers (${PEOPLE})`),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("数（半角数字）", "A number (digits)"),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t("食事する哲学者", '"Dining philosophers"'),
        },
      ],
      actors: actorsOf(t),
      links: LINKS,
      answerType: "number",
      answerLabel: t("あなたの答え（手数）", "Your answer (steps)"),
      hint: t(
        "デッドロックまでの最短の手数を数で入れる。入れると、図に正解の手順が足される。",
        "Enter the number of steps on the shortest path to a deadlock. The steps of the answer are then added to the diagram.",
      ),
      verdictActor: "checker",
      setupSteps: setupSteps(t),
      solve: () => {
        const shortest = SHORTEST();
        if (shortest === null) {
          return {
            answer: 0,
            reason: t("デッドロックは無かった。", "There was no deadlock."),
          };
        }
        return {
          answer: shortest.length,
          reason: t(
            `最短の手順は${shortest.join(" → ")}（pick.i.j は「哲学者iがフォークjを取る」）。全員が左を1本ずつ持つと、右のフォークは隣の人が持っているので、誰も先へ進めない。`,
            `The shortest path is ${shortest.join(" → ")} (pick.i.j means "philosopher i takes fork j"). Once everyone holds their left fork, each right fork is held by a neighbour, so no one can go on.`,
          ),
        };
      },
      solutionSteps: () => solutionSteps(t),
    },
    language,
  );
}
