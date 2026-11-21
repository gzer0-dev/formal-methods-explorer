import { translator, type Language } from "../../core/i18n";
import type { ActorPatch, Lesson, Step, Tone } from "../../core/types";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";
import { displayName, displayNames } from "../labels";
import { check, type Model } from "../modelCheck";
import { lockModel, type LockName, type LockState } from "../models";

// 演習: 2つのスレッドがロックを同じ順に取るとき、デッドロックするか。
// 条件と正解の計算は exerciseModel.ts の問3と同じ（lockModel(true) と lockModel(false) を check する）。
// 答える前の図は取る順と問いだけを見せ、「取れなかった方が何を持って待つか」の場面は答えた後に回す。
const THREADS = ["T1", "T2"];
const THREAD_IDS = ["t1", "t2"];
const LOCKS: LockName[] = ["L1", "L2"];
const LOCK_IDS: Record<LockName, string> = { L1: "l1", L2: "l2" };
// モデルを組むだけ（検査はしない）。取る順を操作名から読むのに使う。
const SAME_MODEL = lockModel(true);
const REVERSED_MODEL = lockModel(false);

const RESULTS = lazy(() => ({
  same: check(SAME_MODEL),
  reversed: check(REVERSED_MODEL),
}));

// 同じ順のとき、T1が先にL1を取り、T2が取れずに待つ場面から始めて、両方が終わるまでの順。
// 計算の答え（デッドロックの有無）ではなく、答えた後に見せる1つの実行の筋書き。
const WAIT_SCENE = ["T1がL1を取る"];
const T1_FINISH = ["T1がL2を取る", "T1が手放す"];
const T2_FINISH = ["T2がL1を取る", "T2がL2を取る", "T2が手放す"];

type Translate = (ja: string, en: string) => string;

/** モデルの操作名「T1がL1を取る」から、スレッドがロックを取る順を読み出す。 */
function lockOrder(model: Model<LockState>, thread: string): LockName[] {
  const order = model.actions
    .map((action) => action.name.match(/^(T\d)が(L\d)を取る$/))
    .filter((match) => match !== null && match[1] === thread)
    .map((match) => match![2] as LockName);
  if (order.length !== 2)
    throw new Error(`${thread} のロックを取る順を操作名から読めない`);
  return order;
}

function orderText(model: Model<LockState>, thread: string): string {
  return lockOrder(model, thread).join(" → ");
}

/** 決めた順に操作を当てる。動けない操作が来たら筋書きの誤りなので止める。 */
function runActions(
  model: Model<LockState>,
  from: LockState,
  names: string[],
): LockState {
  return names.reduce((state, name) => {
    const action = model.actions.find((candidate) => candidate.name === name);
    if (!action || !action.enabled(state))
      throw new Error(`この順では動けない: ${name}`);
    return action.next(state);
  }, from);
}

function heldBy(state: LockState, thread: string): LockName[] {
  return LOCKS.filter((lock) => state.owners[lock] === thread);
}

function canMove(model: Model<LockState>, state: LockState, thread: string): boolean {
  return model.actions.some(
    (action) => action.name.startsWith(thread) && action.enabled(state),
  );
}

interface ThreadOverrides {
  /** スレッドの id ごとの色。省くと「終わったら ok、それ以外は idle」。 */
  tones?: Partial<Record<string, Tone>>;
  /** スレッドの id ごとの「取る順」の行。省くとその行は変えない。 */
  orders?: Partial<Record<string, string>>;
}

/** スレッドのカードの差分。色と取る順も同じ差分の中で決める（後からスプレッドで上書きすると行が消えるため）。 */
function threadSet(state: LockState, t: Translate, overrides: ThreadOverrides = {}) {
  return Object.fromEntries(
    THREADS.map((thread, index) => {
      const id = THREAD_IDS[index]!;
      const held = heldBy(state, thread);
      const isDone = state.pcs[index] === 3;
      const order = overrides.orders?.[id];
      const patch: ActorPatch = {
        tone: overrides.tones?.[id] ?? (isDone ? "ok" : "idle"),
        rows: {
          [t("持っている", "holds")]:
            held.length > 0 ? held.join(t("・", ", ")) : t("なし", "none"),
          ...(order === undefined ? {} : { [t("取る順", "order")]: order }),
        },
      };
      return [id, patch];
    }),
  );
}

function lockSet(state: LockState, t: Translate) {
  return Object.fromEntries(
    LOCKS.map((lock) => [
      LOCK_IDS[lock],
      {
        tone: state.owners[lock] === null ? ("idle" as const) : ("wait" as const),
        rows: { [t("持ち主", "owner")]: state.owners[lock] ?? t("空き", "free") },
      },
    ]),
  );
}

function setupSteps(t: Translate): Step[] {
  const init = SAME_MODEL.init;
  return [
    {
      id: "setup",
      kind: "spec",
      title: t("2つのスレッドとロック", "Two threads, two locks"),
      actor: "t1",
      to: ["l1", "l2"],
      summary: t(
        "T1とT2は、L1とL2を両方取ってから仕事をし、終わったら両方を手放す",
        "T1 and T2 each take both L1 and L2, do their work, then release both",
      ),
      explain: t(
        "ロックは、持ち主がいる間は他のスレッドが取れない鍵である。スレッドT1とT2は、どちらもL1とL2を1つずつ取り、両方そろったら仕事をして、両方を手放す。どちらのスレッドが先に動くかは決まっていない。",
        "A lock cannot be taken by another thread while it has an owner. Threads T1 and T2 each take L1 and L2 one at a time, do their work once they hold both, then release both. Which thread moves first is not fixed.",
      ),
      set: { ...threadSet(init, t), ...lockSet(init, t) },
    },
    {
      id: "orders",
      kind: "spec",
      title: t("同じ順で取る", "Same order for both"),
      actor: "t2",
      to: ["l1", "l2"],
      summary: t(
        `T1もT2も、${orderText(SAME_MODEL, "T1")}の順でロックを取る`,
        `Both T1 and T2 take the locks in the order ${orderText(SAME_MODEL, "T1")}`,
      ),
      explain: t(
        `「デッドロックを見つける」では、T2だけが逆の順で取っていた。ここでは取る順をそろえ、T1もT2も${orderText(SAME_MODEL, "T2")}の順で取る。`,
        `In "Finding deadlocks", T2 took the locks in the opposite order. Here the order is the same for both: T1 and T2 each take them as ${orderText(SAME_MODEL, "T2")}.`,
      ),
      set: Object.fromEntries(
        THREADS.map((thread, index) => [
          THREAD_IDS[index]!,
          { rows: { [t("取る順", "order")]: orderText(SAME_MODEL, thread) } },
        ]),
      ),
    },
    {
      id: "question",
      kind: "explore",
      title: t("デッドロックするか", "Can it deadlock?"),
      actor: "checker",
      to: ["l1", "l2"],
      summary: t(
        "同じ順で取るとき、デッドロックが起きるかを「はい」か「いいえ」で答える",
        'Answer "yes" or "no": can a deadlock happen when both take the locks in the same order?',
      ),
      explain: t(
        "2つとも「L1 → L2」の同じ順で取るとき、デッドロック（互いに相手を待って動けなくなること）は起きるか。下の「答え合わせ」に答えを入れると、正解を確かめる手順がこの図に足される。ヒント: 1つ目を取れなかったスレッドが、何を持ったまま待つかを考える。",
        'If both take the locks in the same order, "L1 → L2", can a deadlock (each waiting on the other, so neither can move) happen? Enter your answer under "Check your answer" below and the steps that settle it are added to this diagram. Hint: think about what a thread is holding while it waits for the first lock.',
      ),
      set: {
        ...threadSet(init, t),
        ...lockSet(init, t),
        checker: {
          tone: "wait",
          rows: { [t("問い", "question")]: t("止まる？", "Stuck?") },
        },
      },
    },
  ];
}

function solutionSteps(t: Translate, language: Language): Step[] {
  const { same, reversed } = RESULTS();
  const name = (action: string) => displayName(action, language);
  const afterTake = runActions(SAME_MODEL, SAME_MODEL.init, WAIT_SCENE);
  const t2Held = heldBy(afterTake, "T2");
  const t2Wants = lockOrder(SAME_MODEL, "T2")[afterTake.pcs[1]]!;
  const isT2Blocked = !canMove(SAME_MODEL, afterTake, "T2");
  // 筋書きの前提（T2が何も持たずに待つ）が崩れたら、説明が嘘になるのでここで止める。
  if (!isT2Blocked || t2Held.length > 0)
    throw new Error("T2が何も持たずに待つ場面になっていない");
  const afterT1Take2 = runActions(SAME_MODEL, afterTake, T1_FINISH.slice(0, 1));
  const afterT1 = runActions(SAME_MODEL, afterT1Take2, T1_FINISH.slice(1));
  const afterT2 = runActions(SAME_MODEL, afterT1, T2_FINISH);
  const deadlock = reversed.deadlock;
  const stuck = deadlock?.at(-1)?.state ?? null;

  const steps: Step[] = [
    {
      id: "t1-takes",
      kind: "run",
      title: t(`1手目: ${WAIT_SCENE[0]}`, `Step 1: ${name(WAIT_SCENE[0]!)}`),
      actor: "t1",
      to: ["l1"],
      summary: t(
        `${WAIT_SCENE[0]}。L1の持ち主はT1になる`,
        `${name(WAIT_SCENE[0]!)}. T1 now owns L1`,
      ),
      explain: t(
        "T1が先に動き、1つ目のL1を取った。T2も1つ目にL1を取りたいので、ここで2つがぶつかる。",
        "T1 moves first and takes its first lock, L1. T2 also wants L1 first, so this is where the two meet.",
      ),
      set: {
        ...threadSet(afterTake, t),
        ...lockSet(afterTake, t),
        checker: {
          tone: "wait",
          rows: {
            [t("問い", "question")]: null,
            [t("見る", "showing")]: t("取り合う場面", "the contest"),
          },
        },
      },
    },
    {
      id: "t2-waits",
      kind: "explore",
      title: t("T2は何も持たずに待つ", "T2 waits holding nothing"),
      actor: "t2",
      to: [LOCK_IDS[t2Wants]],
      summary: t(
        `T2が次に取るのは${t2Wants}だが、T1が持っているので待つ。T2の手には何も無い`,
        `T2's next lock is ${t2Wants}, which T1 holds, so it waits. T2 holds nothing`,
      ),
      explain: t(
        `T2は1つ目の${t2Wants}を取れないので、何も持たずに待つ。T1が次に取るL2は誰も持っていないので、T1の邪魔をするものは無い。`,
        `T2 cannot take its first lock, ${t2Wants}, so it waits holding nothing. No one holds L2, the next lock T1 needs, so nothing stands in T1's way.`,
      ),
      set: { t2: { tone: "wait" } },
    },
    {
      id: "t1-takes-second",
      kind: "run",
      title: t(`2手目: ${T1_FINISH[0]}`, `Step 2: ${name(T1_FINISH[0]!)}`),
      actor: "t1",
      to: ["l2"],
      summary: t(
        `${T1_FINISH[0]}。T1は両方そろって仕事ができる`,
        `${name(T1_FINISH[0]!)}. T1 holds both and can do its work`,
      ),
      explain: t(
        "L2は空いていたので、T1はそのまま取れる。待っているT2はL2を持っていないので、互いに待ち合う形にならない。",
        "L2 was free, so T1 takes it straight away. The waiting T2 does not hold L2, so they never end up waiting on each other.",
      ),
      set: {
        ...threadSet(afterT1Take2, t, { tones: { t2: "wait" } }),
        ...lockSet(afterT1Take2, t),
      },
    },
    {
      id: "t1-releases",
      kind: "run",
      title: t(`3手目: ${T1_FINISH[1]}`, `Step 3: ${name(T1_FINISH[1]!)}`),
      actor: "t1",
      to: ["l1", "l2"],
      summary: t(
        `${T1_FINISH[1]}。L1もL2も空く`,
        `${name(T1_FINISH[1]!)}. L1 and L2 are both free`,
      ),
      explain: t(
        "T1は仕事を終えて両方を手放した。これで、待っていたT2がL1を取れるようになる。",
        "T1 finishes its work and releases both locks. Now the waiting T2 can take L1.",
      ),
      set: { ...threadSet(afterT1, t), ...lockSet(afterT1, t) },
    },
    {
      id: "t2-finishes",
      kind: "run",
      title: t("T2も取って手放す", "T2 takes both, releases"),
      actor: "t2",
      to: ["l1", "l2"],
      summary: t(
        `${displayNames(T2_FINISH, language)}。2つとも終わる`,
        `${displayNames(T2_FINISH, language)}. Both have finished`,
      ),
      explain: t(
        "T2も同じ順でL1、L2と取って仕事をし、両方を手放す。どちらが先にL1を取っても、取れなかった方は何も持たずに待つだけなので、最後まで進める。",
        "T2 takes L1 then L2 in the same order, does its work and releases both. Whichever thread gets L1 first, the other just waits holding nothing, so both get to the end.",
      ),
      set: { ...threadSet(afterT2, t), ...lockSet(afterT2, t) },
    },
  ];

  if (deadlock && stuck) {
    steps.push({
      id: "reversed",
      kind: "found",
      title: t("逆の順なら止まる", "Opposite orders get stuck"),
      actor: "t2",
      to: ["l1", "l2"],
      summary: t(
        `比べると、T2が${orderText(REVERSED_MODEL, "T2")}の順なら${deadlock.length - 1}手で止まる`,
        `By contrast, if T2 takes them as ${orderText(REVERSED_MODEL, "T2")}, they get stuck in ${deadlock.length - 1} steps`,
      ),
      explain: t(
        `取る順が逆だと、「${displayNames(
          deadlock.slice(1).map((entry) => entry.action!),
          language,
        )}」の後、T1は${heldBy(stuck, "T1").join("・")}を、T2は${heldBy(stuck, "T2").join("・")}を持ったまま相手のロックを待ち、どちらも動けない。デッドロックは、何かを持ったまま待つときにだけ起きる。`,
        `In opposite orders, after "${displayNames(
          deadlock.slice(1).map((entry) => entry.action!),
          language,
        )}", T1 holds ${heldBy(stuck, "T1").join(", ")} and T2 holds ${heldBy(stuck, "T2").join(", ")}, each waiting for the other's lock, and neither can move. A deadlock happens only when a thread waits while holding something.`,
      ),
      set: {
        ...threadSet(stuck, t, {
          tones: { t1: "bad", t2: "bad" },
          orders: { t2: orderText(REVERSED_MODEL, "T2") },
        }),
        ...lockSet(stuck, t),
        checker: {
          tone: "wait",
          rows: { [t("見る", "showing")]: t("逆の順", "opposite order") },
        },
      },
    });
  }

  steps.push({
    id: "all-states",
    kind: same.deadlock === null ? "fix" : "found",
    title: t("同じ順は全部たどる", "Same order: every state"),
    actor: "checker",
    to: ["l1", "l2"],
    summary: same.deadlock
      ? t(
          `同じ順でも${same.deadlock.length - 1}手で動けなくなる状態がある`,
          `Even in the same order there is a state, ${same.deadlock.length - 1} steps in, where neither can move`,
        )
      : t(
          `同じ順の${same.stateCount}状態を全部たどっても、動けなくなる状態は無い`,
          `Walking all ${same.stateCount} states of the same-order model finds no state where they are stuck`,
        ),
    explain: same.deadlock
      ? t(
          "検査器が、同じ順でも動けなくなる状態を見つけた。",
          "The checker found a state where they are stuck even in the same order.",
        )
      : t(
          `今見たのは実行の1つだけなので、検査器で取る順を同じに戻したモデルの${same.stateCount}状態を全部たどる。終わりでもないのに、どちらも動けない状態は1つも無かった。`,
          `What we followed was just one run, so the checker walks all ${same.stateCount} states of the model with the orders back to the same. There is not a single state, other than the end, where neither can move.`,
        ),
    set: {
      ...threadSet(SAME_MODEL.init, t, {
        orders: { t2: orderText(SAME_MODEL, "T2") },
      }),
      ...lockSet(SAME_MODEL.init, t),
      checker: {
        tone: same.deadlock === null ? "ok" : "bad",
        rows: {
          [t("見る", "showing")]: null,
          [t("たどった", "explored")]: t(
            `${same.stateCount}状態`,
            `${same.stateCount} states`,
          ),
        },
      },
    },
  });
  return steps;
}

export function exerciseSameOrderLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-same-order",
      title: t("演習: 同じ順でロック", "Exercise: locks in the same order"),
      subtitle: t(
        "同じ順でロックを取ると、デッドロックするか",
        "Do locks taken in the same order deadlock?",
      ),
      summary: t(
        "2つのスレッドがロックを同じ順に取るとき、デッドロックが起きるかを答える。答えを入れると、取り合いになった場面を1手ずつ追い、検査器が全部の状態をたどった結果を確かめられる。",
        "Answer whether two threads can deadlock when they take the locks in the same order. Once you answer, you can follow the moment they compete for a lock step by step, and see what the checker finds when it walks every state.",
      ),
      intro: [
        t(
          "「デッドロックを見つける」で見た2つのスレッドとロックを使い、取る順を両方「L1 → L2」にそろえる。そのときデッドロック（互いに相手の持つものを待ち、どちらも進めない状態）が起きるかを考える問題である。",
          'This uses the two threads and two locks from "Finding deadlocks", with both now taking them in the order "L1 → L2". The question is whether a deadlock (each waiting for something the other holds, so neither can go on) can still happen.',
        ),
        t(
          "図はまず、スレッドとロック、それぞれの取る順だけを見せる。下の「答え合わせ」に答えを入れると、2つが同じロックを取り合う場面と検査器の結果が足される。「図で見る」を押して、取れなかったスレッドのカードの「持っている」の行を見る。",
          'The diagram first shows only the threads, the locks and the order each thread takes them in. When you enter your answer under "Check your answer", the moment both go for the same lock and the checker\'s result are added. Press "Show the diagram" and watch the "holds" row on the card of the thread that misses out.',
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t("2つのスレッドと2つのロック", "Two threads and two locks"),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("「はい」か「いいえ」", '"yes" or "no"'),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t("デッドロックを見つける", '"Finding deadlocks"'),
        },
      ],
      actors: [
        ...THREADS.map((thread, index) => ({
          id: THREAD_IDS[index]!,
          label: thread,
          sublabel: t("スレッド", "thread"),
          icon: "process",
          x: 14,
          y: index === 0 ? 27 : 73,
          initial: { rows: { [t("持っている", "holds")]: t("なし", "none") } },
        })),
        ...LOCKS.map((lock, index) => ({
          id: LOCK_IDS[lock],
          label: lock,
          sublabel: t("ロック", "lock"),
          icon: "lock",
          x: 50,
          y: index === 0 ? 27 : 73,
          initial: { rows: { [t("持ち主", "owner")]: t("空き", "free") } },
        })),
        {
          id: "checker",
          label: t("モデル検査器", "Model checker"),
          sublabel: t("動けない状態を探す", "looks for stuck states"),
          icon: "checker",
          x: 86,
          y: 50,
        },
      ],
      links: [
        { from: "t1", to: "l1" },
        { from: "t1", to: "l2" },
        { from: "t2", to: "l1" },
        { from: "t2", to: "l2" },
        { from: "checker", to: "l1" },
        { from: "checker", to: "l2" },
      ],
      answerType: "yesno",
      // 既定の samples は日本語の「はい／いいえ」を含み、英語のレッスンが訳し忘れの検査で落ちるので、言語ごとに渡す。
      samples: language === "ja" ? ["はい", "いいえ", "yes"] : ["yes", "no", "y"],
      answerLabel: t("あなたの答え（はい／いいえ）", "Your answer (yes / no)"),
      hint: t(
        "デッドロックが起きるなら「はい」、起きないなら「いいえ」を入れる。入れると、図に正解を確かめる手順が足される。",
        'Enter "yes" if a deadlock can happen, "no" if not. The steps that settle it are then added to the diagram.',
      ),
      verdictActor: "checker",
      setupSteps: setupSteps(t),
      solve: () => {
        const { same, reversed } = RESULTS();
        const reversedText = reversed.deadlock
          ? t(
              `取る順が逆なら${reversed.deadlock.length - 1}手（${displayNames(
                reversed.deadlock.slice(1).map((step) => step.action ?? ""),
                language,
              )}）で止まる。`,
              `In opposite orders it gets stuck in ${reversed.deadlock.length - 1} steps (${displayNames(
                reversed.deadlock.slice(1).map((step) => step.action ?? ""),
                language,
              )}).`,
            )
          : "";
        return {
          answer: same.deadlock !== null,
          reason: t(
            `同じ順なら、L1を取れなかった方は何も持たずに待つので、互いに待ち合う輪ができない。${same.stateCount}状態を全部たどっても、動けなくなる状態は無かった。${reversedText}`,
            `In the same order, the thread that misses L1 waits holding nothing, so no cycle of waiting can form. Walking all ${same.stateCount} states found no state where they are stuck. ${reversedText}`,
          ).trim(),
        };
      },
      solutionSteps: () => solutionSteps(t, language),
    },
    language,
  );
}
