import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { displayName, displayNames } from "../labels";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import { check, type Model } from "../modelCheck";
import { lockModel, type LockName, type LockState } from "../models";

const THREADS = ["T1", "T2"];
const LOCKS: LockName[] = ["L1", "L2"];

const REVERSED_MODEL = lockModel(false);
const SAME_MODEL = lockModel(true);
const REVERSED = check(REVERSED_MODEL);
const SAME = check(SAME_MODEL);
// デッドロックへの手順。DEADLOCK[0] は初期状態。
const DEADLOCK = REVERSED.deadlock!;
const DEADLOCK_MOVES = DEADLOCK.length - 1;
const STUCK_STATE = DEADLOCK.at(-1)!.state;

/** モデルの操作名「T1がL1を取る」から、スレッドがロックを取る順を読み出す。 */
function lockOrder(model: Model<LockState>, thread: string): LockName[] {
  const order = model.actions
    .map((action) => action.name.match(/^(T\d)が(L\d)を取る$/))
    .filter((match) => match !== null && match[1] === thread)
    .map((match) => match![2] as LockName);
  // 操作名の書き方が変わって読めなくなったら、画面に「null」を出す前にここで止める。
  if (order.length !== 2)
    throw new Error(`${thread} のロックを取る順を操作名から読めない`);
  return order;
}

function orderText(model: Model<LockState>, thread: string): string {
  return lockOrder(model, thread).join(" → ");
}

function heldBy(state: LockState, thread: string): LockName[] {
  return LOCKS.filter((lock) => state.owners[lock] === thread);
}

/** スレッドが次に取ろうとしているロック。両方持った後は null。 */
function wantedBy(
  model: Model<LockState>,
  state: LockState,
  threadIndex: number,
): LockName | null {
  return lockOrder(model, THREADS[threadIndex]!)[state.pcs[threadIndex]!] ?? null;
}

const STUCK_ENABLED = REVERSED_MODEL.actions.filter((action) =>
  action.enabled(STUCK_STATE),
);
const IS_STUCK_FINAL = REVERSED_MODEL.isFinal!(STUCK_STATE);

function parseOrder(text: string | undefined): boolean {
  // 「同じ」（英語では same）と書いたときだけ同じ順にする。それ以外（空や読めない入力）は既定の「逆」に戻す。
  const value = text ?? "";
  return value.includes("同") || /same/i.test(value);
}

function stepsText(count: number): string {
  return `${count} ${count === 1 ? "step" : "steps"}`;
}

export function deadlockLesson(language: Language): Lesson {
  const t = translator(language);
  const name = (action: string) => displayName(action, language);
  const steps = (count: number) => t(`${count}手`, stepsText(count));
  const none = t("なし", "none");
  const holds = t("持っている", "holds");
  const next = t("次に取る", "next");
  const takeOrder = t("取る順", "order");
  const owner = t("持ち主", "owner");

  function threadRows(model: Model<LockState>, state: LockState, threadIndex: number) {
    const thread = THREADS[threadIndex]!;
    const held = heldBy(state, thread);
    const wanted = wantedBy(model, state, threadIndex);
    return {
      [holds]: held.length > 0 ? held.join(t("・", ", ")) : none,
      [next]: wanted ?? none,
    };
  }

  function lockRows(state: LockState, lock: LockName) {
    return { [owner]: state.owners[lock] ?? t("空き", "free") };
  }

  return {
    id: "deadlock",
    category: "model",
    title: t("デッドロックを見つける", "Finding deadlocks"),
    subtitle: t(
      "2つのスレッドが、互いの持つロックを待ち続ける",
      "Two threads wait forever for the lock the other holds",
    ),
    summary: t(
      `T1は${orderText(REVERSED_MODEL, "T1")}、T2は${orderText(REVERSED_MODEL, "T2")}の順でロックを取る。検査器は${REVERSED.stateCount}状態をたどり、${DEADLOCK_MOVES}手で両方が動けなくなる手順を見つける。全員が同じ順で取るように直すと消える。`,
      `T1 takes the locks in the order ${orderText(REVERSED_MODEL, "T1")}, T2 in the order ${orderText(REVERSED_MODEL, "T2")}. The checker walks ${REVERSED.stateCount} states and finds a ${DEADLOCK_MOVES}-step sequence where neither can move. Making everyone take them in the same order removes it.`,
    ),
    intro: [
      t(
        "デッドロックは、複数のスレッドが互いに相手の持つものを待ち続け、どれも先へ進めなくなる状態である。ここではスレッドT1とT2が、ロック（持ち主がいる間は他が取れない鍵）L1とL2を取り合う。",
        "A deadlock is a state where several threads each wait for something another one holds, and none can go on. Here threads T1 and T2 compete for locks L1 and L2 (a lock cannot be taken by anyone else while it has an owner).",
      ),
      t(
        "デッドロックは限られた順で動いたときだけ起きるので、テストでは再現しにくく、本番で突然固まる形で現れやすい。前のレッスンの不変条件（いつ見ても成り立っていてほしい条件）は「悪い状態にならない」を調べたが、ここでは「終わりでもないのに、できる操作が無い状態」を探す。",
        'A deadlock happens only in particular orders, so it is hard to reproduce in tests and tends to show up as a sudden hang in production. The invariant in the previous lesson (a condition that should hold whenever you look) checked "never reach a bad state"; here we look for "a state that is not the end, yet has no action left to take".',
      ),
      t(
        "図では、T1とT2からL1・L2へ向かう矢印を追い、それぞれのロックに誰が持ち主として入っているかを見る。両方のロックが埋まった後、T1とT2が次に何を待っているかが分かれ目になる。",
        "In the diagram, follow the arrows from T1 and T2 to L1 and L2, and watch who is recorded as the owner of each lock. The turning point is what T1 and T2 are each waiting for once both locks are taken.",
      ),
    ],
    facts: [
      {
        label: t("たどった状態", "States explored"),
        value: t(`${REVERSED.stateCount}個`, `${REVERSED.stateCount}`),
      },
      {
        label: t("デッドロックまで", "Steps to deadlock"),
        value: steps(DEADLOCK_MOVES),
        tone: "bad",
      },
      {
        label: t("同じ順にした後", "With the same order"),
        value: SAME.deadlock
          ? t("デッドロックあり", "deadlock")
          : t("デッドロックなし", "no deadlock"),
        tone: "ok",
      },
      {
        label: t("実物の道具", "Real tools"),
        value: t("TLC のデッドロック検査", "TLC deadlock check"),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 3.2.4〜3.2.5節（FDR の表明と食事する哲学者）`,
          `${CSP_BOOK_EN}, sections 3.2.4-3.2.5 (FDR assertions and the dining philosophers)`,
        ),
      },
    ],
    actors: [
      {
        id: "t1",
        label: "T1",
        sublabel: t("スレッド", "thread"),
        icon: "process",
        x: 14,
        y: 27,
        initial: { rows: threadRows(REVERSED_MODEL, REVERSED_MODEL.init, 0) },
      },
      {
        id: "t2",
        label: "T2",
        sublabel: t("スレッド", "thread"),
        icon: "process",
        x: 14,
        y: 73,
        initial: { rows: threadRows(REVERSED_MODEL, REVERSED_MODEL.init, 1) },
      },
      {
        id: "l1",
        label: "L1",
        sublabel: t("ロック", "lock"),
        icon: "lock",
        x: 50,
        y: 27,
        initial: { rows: lockRows(REVERSED_MODEL.init, "L1") },
      },
      {
        id: "l2",
        label: "L2",
        sublabel: t("ロック", "lock"),
        icon: "lock",
        x: 50,
        y: 73,
        initial: { rows: lockRows(REVERSED_MODEL.init, "L2") },
      },
      {
        id: "checker",
        label: t("モデル検査器", "Model checker"),
        sublabel: t("動けない状態を探す", "looks for stuck states"),
        icon: "checker",
        x: 86,
        y: 50,
        initial: { isHidden: true },
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
    steps: [
      {
        id: "orders",
        kind: "spec",
        title: t("ロックを取る順を書く", "Write the lock order"),
        actor: "t1",
        to: ["l1", "l2"],
        summary: t(
          `T1は${orderText(REVERSED_MODEL, "T1")}、T2は${orderText(REVERSED_MODEL, "T2")}の順で取る`,
          `T1 takes ${orderText(REVERSED_MODEL, "T1")}, T2 takes ${orderText(REVERSED_MODEL, "T2")}`,
        ),
        explain: t(
          "2つのスレッドは、どちらもL1とL2の両方を持ってから仕事をし、終わったら両方を手放す。ただし取る順が違う。ロックは持ち主がいる間、他のスレッドは取れない。",
          "Both threads do their work only after holding both L1 and L2, and release both when done. But they take them in different orders. While a lock has an owner, no other thread can take it.",
        ),
        set: {
          t1: { rows: { [takeOrder]: orderText(REVERSED_MODEL, "T1") } },
          t2: { rows: { [takeOrder]: orderText(REVERSED_MODEL, "T2") } },
        },
      },
      {
        id: "explore",
        kind: "explore",
        title: t("全部の状態をたどる", "Walk every state"),
        actor: "checker",
        to: ["l1", "l2"],
        summary: t(
          `${REVERSED.stateCount}状態・${REVERSED.transitionCount}遷移をたどり、動けない状態を探す`,
          `Walks ${REVERSED.stateCount} states and ${REVERSED.transitionCount} transitions, looking for stuck states`,
        ),
        explain: t(
          `検査器は${REVERSED.stateCount}状態をたどりながら、「終わりではないのに、できる操作が1つも無い状態」を探す。これがデッドロック。両方のスレッドが手放し終えた状態は正しい終わりなので数えない。`,
          `While walking ${REVERSED.stateCount} states, the checker looks for "a state that is not the end but has no action at all". That is a deadlock. The state where both threads have released everything is a proper end, so it is not counted.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("状態", "states")]: t(
                `${REVERSED.stateCount}個`,
                `${REVERSED.stateCount}`,
              ),
              [t("遷移", "transitions")]: t(
                `${REVERSED.transitionCount}本`,
                `${REVERSED.transitionCount}`,
              ),
            },
          },
        },
        simplified: t(
          "TLC はデッドロックの検査が既定で有効で、正しく終わった状態も「動けない」と報告する。そのため実務では終わりの状態に足踏み（何も変えない遷移）を足すか、検査を切る。ここでは isFinal で終わりの状態を分けている。CSP の検査器 FDR にも、想定していない所で止まらないこと（デッドロックフリー性）を調べる deadlock free の表明がある。",
          'TLC checks for deadlock by default and reports even a properly finished state as "stuck". So in practice you add a stuttering step (a transition that changes nothing) to the final state, or turn the check off. Here isFinal sets the final states apart. FDR, the CSP checker, also has a "deadlock free" assertion that checks the system never stops where it should not (deadlock freedom).',
        ),
      },
      {
        id: "t1-takes",
        kind: "found",
        title: name(DEADLOCK[1]!.action!),
        actor: "t1",
        to: ["l1"],
        summary: t(
          `1手目: ${DEADLOCK[1]!.action}`,
          `Step 1: ${name(DEADLOCK[1]!.action!)}`,
        ),
        explain: t(
          `検査器が見つけた手順を再生する。まず T1が1つ目の${heldBy(DEADLOCK[1]!.state, "T1").join("・")}を取る。次は${wantedBy(REVERSED_MODEL, DEADLOCK[1]!.state, 0)}を取りに行く。`,
          `Replay the steps the checker found. First T1 takes its first lock, ${heldBy(DEADLOCK[1]!.state, "T1").join(", ")}. Next it goes for ${wantedBy(REVERSED_MODEL, DEADLOCK[1]!.state, 0)}.`,
        ),
        set: {
          t1: { tone: "wait", rows: threadRows(REVERSED_MODEL, DEADLOCK[1]!.state, 0) },
          l1: { tone: "wait", rows: lockRows(DEADLOCK[1]!.state, "L1") },
        },
      },
      {
        id: "t2-takes",
        kind: "found",
        title: name(DEADLOCK[2]!.action!),
        actor: "t2",
        to: ["l2"],
        summary: t(
          `2手目: ${DEADLOCK[2]!.action}`,
          `Step 2: ${name(DEADLOCK[2]!.action!)}`,
        ),
        explain: t(
          `T1が${wantedBy(REVERSED_MODEL, DEADLOCK[1]!.state, 0)}を取る前に T2が動き、T2にとって1つ目の${heldBy(DEADLOCK[2]!.state, "T2").join("・")}を取る。これで2つのロックはどちらも持ち主がいる。`,
          `Before T1 takes ${wantedBy(REVERSED_MODEL, DEADLOCK[1]!.state, 0)}, T2 moves and takes its own first lock, ${heldBy(DEADLOCK[2]!.state, "T2").join(", ")}. Now both locks have an owner.`,
        ),
        set: {
          t2: { tone: "wait", rows: threadRows(REVERSED_MODEL, DEADLOCK[2]!.state, 1) },
          l2: { tone: "wait", rows: lockRows(DEADLOCK[2]!.state, "L2") },
        },
      },
      {
        id: "stuck",
        kind: "found",
        title: t("どちらも動けない", "Neither can move"),
        actor: "checker",
        to: ["t1", "t2"],
        summary: t(
          `できる操作が${STUCK_ENABLED.length}個で、終わりでもない。${DEADLOCK_MOVES}手でデッドロック`,
          `${STUCK_ENABLED.length} actions possible, and it is not the end: deadlock in ${stepsText(DEADLOCK_MOVES)}`,
        ),
        explain: t(
          `T1はT2の持つ${wantedBy(REVERSED_MODEL, STUCK_STATE, 0)}を、T2はT1の持つ${wantedBy(REVERSED_MODEL, STUCK_STATE, 1)}を待っている。どちらも相手が手放すまで進めず、相手も同じなので、できる操作は${STUCK_ENABLED.length}個になる。終わり${IS_STUCK_FINAL ? "の状態" : "ではない"}のに止まったので、検査器はデッドロックとして手順を返す。`,
          `T1 waits for ${wantedBy(REVERSED_MODEL, STUCK_STATE, 0)}, held by T2, and T2 waits for ${wantedBy(REVERSED_MODEL, STUCK_STATE, 1)}, held by T1. Neither can go on until the other releases, and the other is in the same position, so ${STUCK_ENABLED.length} actions are possible. It stopped ${IS_STUCK_FINAL ? "in the final state" : "without being the end"}, so the checker returns the steps as a deadlock.`,
        ),
        set: {
          t1: { tone: "bad" },
          t2: { tone: "bad" },
          l1: { tone: "bad" },
          l2: { tone: "bad" },
          checker: {
            tone: "bad",
            rows: {
              [t("デッドロック", "deadlock")]: t(
                `${DEADLOCK_MOVES}手で発見`,
                `found in ${stepsText(DEADLOCK_MOVES)}`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("検査器が返した手順", "Steps the checker returned"),
            fields: DEADLOCK.slice(1).map((step, index) => ({
              label: t(`${index + 1}手目`, `Step ${index + 1}`),
              value: name(step.action ?? ""),
            })),
          },
        ],
      },
      {
        id: "fix",
        kind: "fix",
        title: t("同じ順で取るように直す", "Fix: same order for all"),
        actor: "checker",
        to: ["t1", "t2"],
        summary: t(
          `T2も${orderText(SAME_MODEL, "T2")}の順にすると、${SAME.stateCount}状態のどこにもデッドロックは無い`,
          `With T2 also taking ${orderText(SAME_MODEL, "T2")}, none of the ${SAME.stateCount} states deadlocks`,
        ),
        explain: t(
          `全員が同じ順（${orderText(SAME_MODEL, "T1")}）でロックを取るように直す。L1を取れた方だけがL2に進めるので、互いに待ち合う形ができない。もう一度たどると${SAME.stateCount}状態でデッドロックは${SAME.deadlock ? "残った" : "見つからない"}。`,
          `Change it so everyone takes the locks in the same order (${orderText(SAME_MODEL, "T1")}). Only the thread that got L1 can move on to L2, so no cycle of waiting can form. Walking again, ${SAME.stateCount} states, and a deadlock ${SAME.deadlock ? "remains" : "is not found"}.`,
        ),
        set: {
          t1: { tone: "ok", rows: threadRows(REVERSED_MODEL, REVERSED_MODEL.init, 0) },
          t2: {
            tone: "ok",
            rows: {
              ...threadRows(SAME_MODEL, REVERSED_MODEL.init, 1),
              [takeOrder]: orderText(SAME_MODEL, "T2"),
            },
          },
          l1: { tone: "idle", rows: lockRows(REVERSED_MODEL.init, "L1") },
          l2: { tone: "idle", rows: lockRows(REVERSED_MODEL.init, "L2") },
          checker: {
            tone: "ok",
            rows: {
              [t("状態", "states")]: t(`${SAME.stateCount}個`, `${SAME.stateCount}`),
              [t("遷移", "transitions")]: t(
                `${SAME.transitionCount}本`,
                `${SAME.transitionCount}`,
              ),
              [t("デッドロック", "deadlock")]: SAME.deadlock ? t("あり", "yes") : none,
            },
          },
        },
      },
    ],
    lab: {
      title: t("T2の取る順を変える", "Change T2's lock order"),
      hint: t(
        "「同じ」なら T2もL1 → L2、「逆」なら L2 → L1の順で取る。T1はいつもL1 → L2。",
        '"same" makes T2 also take L1 → L2; "reversed" makes it take L2 → L1. T1 always takes L1 → L2.',
      ),
      inputs: [
        {
          id: "order",
          label: t("T2の取る順（同じ / 逆）", "T2's order (same / reversed)"),
          initial: t("逆", "reversed"),
        },
      ],
      compute: (values): Field[] => {
        const isSameOrder = parseOrder(values.order);
        const model = lockModel(isSameOrder);
        const result = check(model);
        const trace = result.deadlock;
        return [
          { label: t("T1の順", "T1 order"), value: orderText(model, "T1") },
          { label: t("T2の順", "T2 order"), value: orderText(model, "T2") },
          {
            label: t("たどった状態", "States explored"),
            value: t(`${result.stateCount}個`, `${result.stateCount}`),
          },
          {
            label: t("デッドロック", "Deadlock"),
            value: trace
              ? t(
                  `あり（${trace.length - 1}手）`,
                  `yes (${stepsText(trace.length - 1)})`,
                )
              : none,
            tone: trace ? "bad" : "ok",
          },
          {
            label: t("手順", "Steps"),
            value: trace
              ? displayNames(
                  trace.slice(1).map((step) => step.action ?? ""),
                  language,
                )
              : none,
          },
        ];
      },
    },
  };
}
