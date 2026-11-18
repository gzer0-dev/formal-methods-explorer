// レッスンで通して使うモデル。どれも modelCheck.ts の検査器にそのまま渡せる形にしてある。

import type { Action, Model } from "./modelCheck";

// ---- カウンタ: 複数のプロセスが共有の変数 count に 1 を足す ----

export type CounterPc = "read" | "write" | "done";

export interface CounterState {
  pcs: CounterPc[];
  /** 読んだ値を覚えておく各プロセスの手元の変数。読む前と書いた後は null。 */
  tmps: (number | null)[];
  count: number;
}

const PROCESS_NAMES = ["A", "B", "C", "D"];

function processName(index: number): string {
  return PROCESS_NAMES[index] ?? `P${index + 1}`;
}

function withProcess(
  state: CounterState,
  index: number,
  pc: CounterPc,
  tmp: number | null,
  count: number,
): CounterState {
  return {
    pcs: state.pcs.map((value, i) => (i === index ? pc : value)),
    tmps: state.tmps.map((value, i) => (i === index ? tmp : value)),
    count,
  };
}

export function isCounterCorrect(state: CounterState): boolean {
  return state.count === state.pcs.length;
}

/**
 * isAtomic が false なら「count を読む」「読んだ値 + 1 を書く」の 2 手に分かれる（よくある実装）。
 * true なら 1 手で足す（ロックや原子的な命令を使った実装）。
 */
export function counterModel(
  processCount: number,
  isAtomic: boolean,
): Model<CounterState> {
  const actions: Action<CounterState>[] = [];
  for (let i = 0; i < processCount; i += 1) {
    const name = processName(i);
    if (isAtomic) {
      actions.push({
        name: `${name} が足す`,
        enabled: (s) => s.pcs[i] === "read",
        next: (s) => withProcess(s, i, "done", null, s.count + 1),
      });
      continue;
    }
    actions.push(
      {
        name: `${name} が読む`,
        enabled: (s) => s.pcs[i] === "read",
        next: (s) => withProcess(s, i, "write", s.count, s.count),
      },
      {
        name: `${name} が書く`,
        enabled: (s) => s.pcs[i] === "write",
        next: (s) => withProcess(s, i, "done", null, (s.tmps[i] ?? 0) + 1),
      },
    );
  }
  const isAllDone = (s: CounterState) => s.pcs.every((pc) => pc === "done");
  return {
    init: {
      pcs: Array.from({ length: processCount }, () => "read"),
      tmps: Array.from({ length: processCount }, () => null),
      count: 0,
    },
    actions,
    key: (s) => `${s.pcs.join(",")}|${s.tmps.join(",")}|${s.count}`,
    invariant: (s) => !isAllDone(s) || isCounterCorrect(s),
    isFinal: isAllDone,
  };
}

export interface ScheduleResult {
  count: number;
  isCorrect: boolean;
}

/** 決めた順にプロセスを動かす（反例をテストとして再現する）。順に無い操作名や、動けない操作は例外にする。 */
export function runSchedule(schedule: string[], isAtomic: boolean): ScheduleResult {
  const processCount = new Set(schedule.map((step) => step.split(" ")[0])).size;
  const model = counterModel(processCount, isAtomic);
  let state = model.init;
  for (const step of schedule) {
    const action = model.actions.find((candidate) => candidate.name === step);
    if (!action || !action.enabled(state))
      throw new Error(`この順では動けない: ${step}`);
    state = action.next(state);
  }
  return { count: state.count, isCorrect: isCounterCorrect(state) };
}

export function describeCounter(state: CounterState): string {
  return state.pcs
    .map((pc, i) => {
      const tmp = state.tmps[i];
      const label = pc === "read" ? "読む前" : pc === "write" ? `手元=${tmp}` : "済";
      return `${processName(i)}:${label}`;
    })
    .concat(`count=${state.count}`)
    .join(" ");
}

// ---- 2 つのロック: 2 つのスレッドが L1 と L2 を両方取ってから仕事をする ----

export type LockName = "L1" | "L2";

export interface LockState {
  /** 0=1つ目待ち 1=2つ目待ち 2=両方持っている 3=終わり */
  pcs: [number, number];
  owners: Record<LockName, string | null>;
}

/** isSameOrder が false なら T2 は L2 → L1 の順で取る（T1 は常に L1 → L2）。 */
export function lockModel(isSameOrder: boolean): Model<LockState> {
  const orders: [LockName, LockName][] = [
    ["L1", "L2"],
    isSameOrder ? ["L1", "L2"] : ["L2", "L1"],
  ];
  const actions: Action<LockState>[] = [];
  orders.forEach((order, i) => {
    const thread = `T${i + 1}`;
    const setPc = (s: LockState, pc: number): LockState["pcs"] =>
      i === 0 ? [pc, s.pcs[1]] : [s.pcs[0], pc];
    order.forEach((lock, position) => {
      actions.push({
        name: `${thread} が ${lock} を取る`,
        enabled: (s) => s.pcs[i] === position && s.owners[lock] === null,
        next: (s) => ({
          pcs: setPc(s, position + 1),
          owners: { ...s.owners, [lock]: thread },
        }),
      });
    });
    actions.push({
      name: `${thread} が手放す`,
      enabled: (s) => s.pcs[i] === 2,
      next: (s) => ({ pcs: setPc(s, 3), owners: { L1: null, L2: null } }),
    });
  });
  return {
    init: { pcs: [0, 0], owners: { L1: null, L2: null } },
    actions,
    key: (s) => `${s.pcs.join(",")}|${s.owners.L1}|${s.owners.L2}`,
    isFinal: (s) => s.pcs[0] === 3 && s.pcs[1] === 3,
  };
}

// ---- リトライ付きのジョブ: 失敗したら待ちに戻してやり直す ----

export type JobStatus = "待ち" | "実行中" | "成功" | "断念";

export interface JobState {
  status: JobStatus;
  retries: number;
}

export function isJobFinished(state: JobState): boolean {
  return state.status === "成功" || state.status === "断念";
}

/** maxRetries が null なら何度でもやり直す。 */
export function jobModel(maxRetries: number | null): Model<JobState> {
  const canRetry = (s: JobState) => maxRetries === null || s.retries < maxRetries;
  return {
    init: { status: "待ち", retries: 0 },
    actions: [
      {
        name: "実行する",
        enabled: (s) => s.status === "待ち",
        next: (s) => ({ ...s, status: "実行中" }),
      },
      {
        name: "成功する",
        enabled: (s) => s.status === "実行中",
        next: (s) => ({ ...s, status: "成功" }),
      },
      {
        name: "失敗する",
        enabled: (s) => s.status === "実行中" && canRetry(s),
        // 上限が無いときは回数を数えない（数えると状態が無限に増えて検査が終わらない）。
        next: (s) => ({
          status: "待ち",
          retries: maxRetries === null ? 0 : s.retries + 1,
        }),
      },
      {
        name: "諦める",
        enabled: (s) => s.status === "実行中" && !canRetry(s),
        next: (s) => ({ ...s, status: "断念" }),
      },
    ],
    key: (s) => `${s.status}|${s.retries}`,
    isFinal: isJobFinished,
  };
}

// ---- 注文の状態: 支払い・発送・取り消し ----

export type OrderStatus =
  "未払い" | "支払済み" | "発送済み" | "配達済み" | "取消済み" | "返金済み";

export interface OrderTransition {
  name: string;
  from: OrderStatus;
  to: OrderStatus;
}

export const ORDER_ACTIONS: OrderTransition[] = [
  { name: "支払う", from: "未払い", to: "支払済み" },
  { name: "発送する", from: "支払済み", to: "発送済み" },
  { name: "届ける", from: "発送済み", to: "配達済み" },
  { name: "取り消す", from: "未払い", to: "取消済み" },
  { name: "返金する", from: "支払済み", to: "返金済み" },
];

export interface OrderState {
  status: OrderStatus;
  isPaid: boolean;
}

/** hasShipBug が true なら「発送する」の前提条件を書き忘れ、未払いからも発送できてしまう。 */
export function orderModel(hasShipBug: boolean): Model<OrderState> {
  const actions: Action<OrderState>[] = ORDER_ACTIONS.map((transition) => ({
    name: transition.name,
    enabled: (s) =>
      s.status === transition.from ||
      (hasShipBug && transition.name === "発送する" && s.status === "未払い"),
    next: (s) => ({
      status: transition.to,
      isPaid:
        transition.name === "支払う"
          ? true
          : transition.name === "返金する"
            ? false
            : s.isPaid,
    }),
  }));
  const isShipped = (s: OrderState) =>
    s.status === "発送済み" || s.status === "配達済み";
  return {
    init: { status: "未払い", isPaid: false },
    actions,
    key: (s) => `${s.status}|${s.isPaid}`,
    invariant: (s) => !isShipped(s) || s.isPaid,
    isFinal: (s) =>
      s.status === "配達済み" || s.status === "取消済み" || s.status === "返金済み",
  };
}

export interface OrderRun {
  status: OrderStatus;
  /** できなかった操作の位置。全部できたら null。 */
  failedAt: number | null;
}

/** 正しい仕様の注文に操作を順に当てる。 */
export function runOrder(actionNames: string[]): OrderRun {
  const model = orderModel(false);
  let state = model.init;
  for (const [index, name] of actionNames.entries()) {
    const action = model.actions.find((candidate) => candidate.name === name);
    if (!action || !action.enabled(state))
      return { status: state.status, failedAt: index };
    state = action.next(state);
  }
  return { status: state.status, failedAt: null };
}
