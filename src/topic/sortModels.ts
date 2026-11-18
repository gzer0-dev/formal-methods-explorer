// 一気通貫の事例: 3つの値を並べ替える「並べ替えネットワーク」。
// 比較器（2つの値を受け取り、小さい方と大きい方を別々の出口へ出すプロセス）を線でつなぎ、並行に動かす。
// 値は 0 と 1 だけで調べる。比較器だけでできたネットワークは、0 と 1 の入力を全部並べ替えられれば、
// どんな値でも並べ替えられる（0-1 原理）ので、小さな範囲で全部調べる意味がある。
//
// 配線（WIRINGS）はモデルと実装（sortImpl.ts）の両方がここから作る。片方だけ直すと照合の意味が無くなるため。

import { type Env, ext, hide, interleave, par, pre, type Proc, ref, SKIP } from "./csp";

export const SORT_VALUES = [0, 1];
export const SORT_SIZE = 3;

export interface Comparator {
  name: string;
  /** 入口の2本 */
  a: string;
  b: string;
  /** 小さい方を出す出口と、大きい方を出す出口 */
  lo: string;
  hi: string;
}

export type WiringName = "correct" | "missingLast";

export const WIRINGS: Record<WiringName, Comparator[]> = {
  // 1と2番目を比べ、その大きい方と3番目を比べて最大を決め、残りの2つを比べる（3入力の標準的な並べ替えネットワーク）
  correct: [
    { name: "比較器1", a: "in.0", b: "in.1", lo: "w.a", hi: "w.b" },
    { name: "比較器2", a: "w.b", b: "in.2", lo: "w.c", hi: "out.2" },
    { name: "比較器3", a: "w.a", b: "w.c", lo: "out.0", hi: "out.1" },
  ],
  // 最後の比較器を忘れた配線: 1・2番目の小さい方をそのまま out.0 に出してしまう
  missingLast: [
    { name: "比較器1", a: "in.0", b: "in.1", lo: "out.0", hi: "w.b" },
    { name: "比較器2", a: "w.b", b: "in.2", lo: "out.1", hi: "out.2" },
  ],
};

function eventsOf(channel: string): string[] {
  return SORT_VALUES.map((v) => `${channel}.${v}`);
}

function emit(lo: string, hi: string, small: number, large: number): Proc {
  // 2つの出口へは、どちらから先に出してもよい
  return ext(
    pre(`${lo}.${small}`, pre(`${hi}.${large}`, SKIP)),
    pre(`${hi}.${large}`, pre(`${lo}.${small}`, SKIP)),
  );
}

/** 比較器1つ分のプロセス。入口の2本はどちらから先に受け取ってもよい。 */
export function comparatorProcess(c: Comparator): Proc {
  const afterBoth = (x: number, y: number) =>
    emit(c.lo, c.hi, Math.min(x, y), Math.max(x, y));
  return ext(
    ...SORT_VALUES.flatMap((x) => [
      pre(
        `${c.a}.${x}`,
        ext(...SORT_VALUES.map((y) => pre(`${c.b}.${y}`, afterBoth(x, y)))),
      ),
      pre(
        `${c.b}.${x}`,
        ext(...SORT_VALUES.map((y) => pre(`${c.a}.${y}`, afterBoth(y, x)))),
      ),
    ]),
  );
}

function channelsOf(c: Comparator): string[] {
  return [c.a, c.b, c.lo, c.hi];
}

/** 比較器を全部並行合成した全体。2つの比較器がつながる線のイベントだけ、両方がそろって起きる。 */
export function networkModel(wiring: WiringName): Proc {
  const comparators = WIRINGS[wiring];
  let composed = comparatorProcess(comparators[0]!);
  let usedChannels = new Set(channelsOf(comparators[0]!));
  for (const c of comparators.slice(1)) {
    const shared = channelsOf(c).filter((ch) => usedChannels.has(ch));
    composed = par(composed, shared.flatMap(eventsOf), comparatorProcess(c));
    usedChannels = new Set([...usedChannels, ...channelsOf(c)]);
  }
  return composed;
}

/** 内部の線（w.*）を隠し、外から見えるのを入口（in.*）と出口（out.*）だけにした全体。 */
export function observedNetwork(wiring: WiringName): Proc {
  const internal = [...new Set(WIRINGS[wiring].flatMap(channelsOf))].filter((ch) =>
    ch.startsWith("w."),
  );
  return hide(networkModel(wiring), internal.flatMap(eventsOf));
}

export const SORT_ENV: Env = {
  // read は「位置ごとの読んだ値」を1文字ずつ並べた文字列。まだ読んでいない位置は "-"。
  SortIn: (read: string) => {
    const unread = [...read].flatMap((ch, k) => (ch === "-" ? [k] : []));
    if (unread.length === 0) {
      const sorted = [...read].map(Number).sort((x, y) => x - y);
      return interleave(...sorted.map((v, k) => pre(`out.${k}.${v}`, SKIP)));
    }
    return ext(
      ...unread.flatMap((k) =>
        SORT_VALUES.map((v) =>
          pre(`in.${k}.${v}`, ref("SortIn", read.slice(0, k) + v + read.slice(k + 1))),
        ),
      ),
    );
  },
};

/** 逐次の仕様: 3つの値を（どの順でも）受け取り終えたら、並べた値を out.0・out.1・out.2 へ（どの順でも）出す。 */
export function sortSpec(): Proc {
  return ref("SortIn", "-".repeat(SORT_SIZE));
}
