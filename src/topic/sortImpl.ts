// 並べ替えネットワークの「実装」。Go の goroutine とチャネルのように、プロセスを並行に動かし、
// チャネルの送受信は送り手と受け手がそろったときだけ起きる（ランデブー）。どの組から動かすかはシード付きの乱数で決め、
// 実行のたびに違う順で動く並行実行を、再現できる形で作る。起きた送受信は「チャネル.値」のログに残す。

import { mulberry32 } from "./pbt";
import { type Comparator, SORT_SIZE, WIRINGS } from "./sortModels";

export const SORT_IMPL_WIRINGS = WIRINGS;

type Op =
  | { kind: "send"; channel: string; value: number }
  | { kind: "recv"; channels: string[] };
type Received = { channel: string; value: number };
type Task = Generator<Op, void, Received | undefined>;

/** 比較器: 入口の2本から（来た順に）受け取り、小さい方を lo へ、大きい方を hi へ送る。 */
function* comparator(c: Comparator): Task {
  const got = new Map<string, number>();
  while (got.size < 2) {
    const received = (yield {
      kind: "recv",
      channels: [c.a, c.b].filter((ch) => !got.has(ch)),
    })!;
    got.set(received.channel, received.value);
  }
  const x = got.get(c.a)!;
  const y = got.get(c.b)!;
  yield { kind: "send", channel: c.lo, value: Math.min(x, y) };
  yield { kind: "send", channel: c.hi, value: Math.max(x, y) };
}

function* feeder(position: number, value: number): Task {
  yield { kind: "send", channel: `in.${position}`, value };
}

function* collector(output: number[]): Task {
  const remaining = new Set(Array.from({ length: SORT_SIZE }, (_, k) => `out.${k}`));
  while (remaining.size > 0) {
    const received = (yield { kind: "recv", channels: [...remaining] })!;
    remaining.delete(received.channel);
    output[Number(received.channel.split(".")[1])] = received.value;
  }
}

export interface NetworkRun {
  log: string[];
  output: number[];
  /** 全員が最後まで動いたか。false なら途中で動けなくなった（デッドロック）。 */
  isFinished: boolean;
}

export function runNetwork(
  wiring: Comparator[],
  input: number[],
  seed: number,
): NetworkRun {
  const random = mulberry32(seed);
  const output: number[] = [];
  const tasks: Task[] = [
    ...input.map((value, position) => feeder(position, value)),
    ...wiring.map(comparator),
    collector(output),
  ];
  const pending = new Map<Task, Op>();
  for (const task of tasks) {
    const first = task.next();
    if (!first.done) pending.set(task, first.value);
  }

  const log: string[] = [];
  for (;;) {
    const pairs: { sender: Task; receiver: Task; channel: string; value: number }[] =
      [];
    for (const [sender, op] of pending) {
      if (op.kind !== "send") continue;
      for (const [receiver, other] of pending) {
        if (other.kind === "recv" && other.channels.includes(op.channel)) {
          pairs.push({ sender, receiver, channel: op.channel, value: op.value });
        }
      }
    }
    if (pairs.length === 0) break;
    const pair = pairs[Math.floor(random() * pairs.length)]!;
    log.push(`${pair.channel}.${pair.value}`);
    const advance = (task: Task, value: Received | undefined) => {
      const next = task.next(value);
      if (next.done) pending.delete(task);
      else pending.set(task, next.value);
    };
    advance(pair.sender, undefined);
    advance(pair.receiver, { channel: pair.channel, value: pair.value });
  }
  return { log, output, isFinished: pending.size === 0 };
}

/** ログから外に見えるイベント（入口 in と出口 out）だけを残す。内部の線（w.*）の作りに関係なく、仕様で判定するため。 */
export function visibleLog(log: string[]): string[] {
  return log.filter((ev) => ev.startsWith("in.") || ev.startsWith("out."));
}
