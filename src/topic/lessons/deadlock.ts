import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import { check, type Model } from "../modelCheck";
import { lockModel, type LockName, type LockState } from "../models";

const THREADS = ["T1", "T2"];
const LOCKS: LockName[] = ["L1", "L2"];

const REVERSED_MODEL = lockModel(false);
const REVERSED = check(REVERSED_MODEL);
const SAME = check(lockModel(true));
// デッドロックへの手順。DEADLOCK[0] は初期状態。
const DEADLOCK = REVERSED.deadlock!;
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

function threadRows(model: Model<LockState>, state: LockState, threadIndex: number) {
  const thread = THREADS[threadIndex]!;
  const held = heldBy(state, thread);
  const wanted = wantedBy(model, state, threadIndex);
  return {
    持っている: held.length > 0 ? held.join("・") : "なし",
    次に取る: wanted ?? "なし",
  };
}

function lockRows(state: LockState, lock: LockName) {
  return { 持ち主: state.owners[lock] ?? "空き" };
}

const STUCK_ENABLED = REVERSED_MODEL.actions.filter((action) =>
  action.enabled(STUCK_STATE),
);
const IS_STUCK_FINAL = REVERSED_MODEL.isFinal!(STUCK_STATE);

function parseOrder(text: string | undefined): boolean {
  // 「同じ」と書いたときだけ同じ順にする。それ以外（空や読めない入力）は既定の「逆」に戻す。
  return (text ?? "").includes("同");
}

export const deadlockLesson: Lesson = {
  id: "deadlock",
  category: "model",
  title: "デッドロックを見つける",
  subtitle: "2つのスレッドが、互いの持つロックを待ち続ける",
  summary: `T1は${orderText(REVERSED_MODEL, "T1")}、T2は${orderText(REVERSED_MODEL, "T2")}の順でロックを取る。検査器は${REVERSED.stateCount}状態をたどり、${DEADLOCK.length - 1}手で両方が動けなくなる手順を見つける。全員が同じ順で取るように直すと消える。`,
  facts: [
    { label: "たどった状態", value: `${REVERSED.stateCount}個` },
    { label: "デッドロックまで", value: `${DEADLOCK.length - 1}手`, tone: "bad" },
    {
      label: "同じ順にした後",
      value: SAME.deadlock ? "デッドロックあり" : "デッドロックなし",
      tone: "ok",
    },
    { label: "実物の道具", value: "TLC のデッドロック検査" },
    {
      label: "参考文献",
      value: `${CSP_BOOK} 3.2.4〜3.2.5節（FDR の表明と食事する哲学者）`,
    },
  ],
  actors: [
    {
      id: "t1",
      label: "T1",
      sublabel: "スレッド",
      icon: "process",
      x: 14,
      y: 27,
      initial: { rows: threadRows(REVERSED_MODEL, REVERSED_MODEL.init, 0) },
    },
    {
      id: "t2",
      label: "T2",
      sublabel: "スレッド",
      icon: "process",
      x: 14,
      y: 73,
      initial: { rows: threadRows(REVERSED_MODEL, REVERSED_MODEL.init, 1) },
    },
    {
      id: "l1",
      label: "L1",
      sublabel: "ロック",
      icon: "lock",
      x: 50,
      y: 27,
      initial: { rows: lockRows(REVERSED_MODEL.init, "L1") },
    },
    {
      id: "l2",
      label: "L2",
      sublabel: "ロック",
      icon: "lock",
      x: 50,
      y: 73,
      initial: { rows: lockRows(REVERSED_MODEL.init, "L2") },
    },
    {
      id: "checker",
      label: "モデル検査器",
      sublabel: "動けない状態を探す",
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
      title: "ロックを取る順を書く",
      actor: "t1",
      to: ["l1", "l2"],
      summary: `T1は${orderText(REVERSED_MODEL, "T1")}、T2は${orderText(REVERSED_MODEL, "T2")}の順で取る`,
      explain:
        "2つのスレッドは、どちらもL1とL2の両方を持ってから仕事をし、終わったら両方を手放す。ただし取る順が違う。ロックは持ち主がいる間、他のスレッドは取れない。",
      set: {
        t1: { rows: { 取る順: orderText(REVERSED_MODEL, "T1") } },
        t2: { rows: { 取る順: orderText(REVERSED_MODEL, "T2") } },
      },
    },
    {
      id: "explore",
      kind: "explore",
      title: "全部の状態をたどる",
      actor: "checker",
      to: ["l1", "l2"],
      summary: `${REVERSED.stateCount}状態・${REVERSED.transitionCount}遷移をたどり、動けない状態を探す`,
      explain: `検査器は${REVERSED.stateCount}状態をたどりながら、「終わりではないのに、できる操作が1つも無い状態」を探す。これがデッドロック。両方のスレッドが手放し終えた状態は正しい終わりなので数えない。`,
      set: {
        checker: {
          isHidden: false,
          tone: "wait",
          rows: {
            状態: `${REVERSED.stateCount}個`,
            遷移: `${REVERSED.transitionCount}本`,
          },
        },
      },
      simplified:
        "TLC はデッドロックの検査が既定で有効で、正しく終わった状態も「動けない」と報告する。そのため実務では終わりの状態に足踏み（何も変えない遷移）を足すか、検査を切る。ここでは isFinal で終わりの状態を分けている。CSP の検査器 FDR にも、想定していない所で止まらないこと（デッドロックフリー性）を調べる deadlock free の表明がある。",
    },
    {
      id: "t1-takes",
      kind: "found",
      title: `${DEADLOCK[1]!.action}`,
      actor: "t1",
      to: ["l1"],
      summary: `1手目: ${DEADLOCK[1]!.action}`,
      explain: `検査器が見つけた手順を再生する。まず T1が1つ目の${heldBy(DEADLOCK[1]!.state, "T1").join("・")}を取る。次は${wantedBy(REVERSED_MODEL, DEADLOCK[1]!.state, 0)}を取りに行く。`,
      set: {
        t1: { tone: "wait", rows: threadRows(REVERSED_MODEL, DEADLOCK[1]!.state, 0) },
        l1: { tone: "wait", rows: lockRows(DEADLOCK[1]!.state, "L1") },
      },
    },
    {
      id: "t2-takes",
      kind: "found",
      title: `${DEADLOCK[2]!.action}`,
      actor: "t2",
      to: ["l2"],
      summary: `2手目: ${DEADLOCK[2]!.action}`,
      explain: `T1が${wantedBy(REVERSED_MODEL, DEADLOCK[1]!.state, 0)}を取る前に T2が動き、T2にとって1つ目の${heldBy(DEADLOCK[2]!.state, "T2").join("・")}を取る。これで2つのロックはどちらも持ち主がいる。`,
      set: {
        t2: { tone: "wait", rows: threadRows(REVERSED_MODEL, DEADLOCK[2]!.state, 1) },
        l2: { tone: "wait", rows: lockRows(DEADLOCK[2]!.state, "L2") },
      },
    },
    {
      id: "stuck",
      kind: "found",
      title: "どちらも動けない",
      actor: "checker",
      to: ["t1", "t2"],
      summary: `できる操作が${STUCK_ENABLED.length}個で、終わりでもない。${DEADLOCK.length - 1}手でデッドロック`,
      explain: `T1はT2の持つ${wantedBy(REVERSED_MODEL, STUCK_STATE, 0)}を、T2はT1の持つ${wantedBy(REVERSED_MODEL, STUCK_STATE, 1)}を待っている。どちらも相手が手放すまで進めず、相手も同じなので、できる操作は${STUCK_ENABLED.length}個になる。終わり${IS_STUCK_FINAL ? "の状態" : "ではない"}のに止まったので、検査器はデッドロックとして手順を返す。`,
      set: {
        t1: { tone: "bad" },
        t2: { tone: "bad" },
        l1: { tone: "bad" },
        l2: { tone: "bad" },
        checker: {
          tone: "bad",
          rows: { デッドロック: `${DEADLOCK.length - 1}手で発見` },
        },
      },
      detail: [
        {
          title: "検査器が返した手順",
          fields: DEADLOCK.slice(1).map((step, index) => ({
            label: `${index + 1}手目`,
            value: step.action ?? "",
          })),
        },
      ],
    },
    {
      id: "fix",
      kind: "fix",
      title: "同じ順で取るように直す",
      actor: "checker",
      to: ["t1", "t2"],
      summary: `T2も${orderText(lockModel(true), "T2")}の順にすると、${SAME.stateCount}状態のどこにもデッドロックは無い`,
      explain: `全員が同じ順（${orderText(lockModel(true), "T1")}）でロックを取るように直す。L1を取れた方だけがL2に進めるので、互いに待ち合う形ができない。もう一度たどると${SAME.stateCount}状態でデッドロックは${SAME.deadlock ? "残った" : "見つからない"}。`,
      set: {
        t1: { tone: "ok", rows: threadRows(REVERSED_MODEL, REVERSED_MODEL.init, 0) },
        t2: {
          tone: "ok",
          rows: {
            ...threadRows(lockModel(true), REVERSED_MODEL.init, 1),
            取る順: orderText(lockModel(true), "T2"),
          },
        },
        l1: { tone: "idle", rows: lockRows(REVERSED_MODEL.init, "L1") },
        l2: { tone: "idle", rows: lockRows(REVERSED_MODEL.init, "L2") },
        checker: {
          tone: "ok",
          rows: {
            状態: `${SAME.stateCount}個`,
            遷移: `${SAME.transitionCount}本`,
            デッドロック: SAME.deadlock ? "あり" : "なし",
          },
        },
      },
    },
  ],
  lab: {
    title: "T2の取る順を変える",
    hint: "「同じ」なら T2もL1 → L2、「逆」なら L2 → L1の順で取る。T1はいつもL1 → L2。",
    inputs: [{ id: "order", label: "T2の取る順（同じ / 逆）", initial: "逆" }],
    compute: (values): Field[] => {
      const isSameOrder = parseOrder(values.order);
      const model = lockModel(isSameOrder);
      const result = check(model);
      const trace = result.deadlock;
      return [
        { label: "T1の順", value: orderText(model, "T1") },
        { label: "T2の順", value: orderText(model, "T2") },
        { label: "たどった状態", value: `${result.stateCount}個` },
        {
          label: "デッドロック",
          value: trace ? `あり（${trace.length - 1}手）` : "なし",
          tone: trace ? "bad" : "ok",
        },
        {
          label: "手順",
          value: trace
            ? trace
                .slice(1)
                .map((step) => step.action ?? "")
                .join(" → ")
            : "なし",
        },
      ];
    },
  },
};
