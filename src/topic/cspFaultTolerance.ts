// 故障を隠して耐故障を示す（Roscoe TPC 12.3 の考え方。例は自作）。
// 値を1つ覚える記憶を、同じ値を全部のディスクに書く制御役で作る（鏡のように書く）。ディスクは crash.i で壊れ、
// 壊れたディスクは書き込みを黙って捨て、読み出しには err.i を返す。故障のイベントは Lazy 抽象化で隠す
// （起きてもよいが、起きると当てにしない）。回数を限るときは、故障を数えるプロセスと並べてから隠す。
// produces: mirroredStore・faultView・noFaults・isFaultTolerant・registerSpec・toleratedFaults・crashEvents・FAULT_ENV・FAULT_VALUES・CRASH_ONE_RUN
// consumes: csp.ts の演算子・lazyAbstraction・failuresRefines。

import {
  type Env,
  type Proc,
  ext,
  failuresRefines,
  hide,
  interleave,
  lazyAbstraction,
  par,
  pre,
  ref,
  STOP,
} from "./csp";

/** 覚える値。0 と 1 の2つで足りる（どの値も同じに扱う）。 */
export const FAULT_VALUES = [0, 1] as const;

/** 図で追う実行の例: 1 を書き、ディスク1が壊れ、それでも 1 を読める。 */
export const CRASH_ONE_RUN = ["write.1", "crash.1", "read.1"];

const range = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

export function crashEvents(disks: number): string[] {
  return range(disks).map((i) => `crash.${i}`);
}

/** 制御役とディスクの間のやりとり（外からは見えない）。 */
function internalEvents(disks: number): string[] {
  return range(disks).flatMap((i) => [
    ...FAULT_VALUES.map((v) => `put.${i}.${v}`),
    ...FAULT_VALUES.map((v) => `get.${i}.${v}`),
    `err.${i}`,
  ]);
}

export const FAULT_ENV: Env = {
  // 仕様: 値を1つ覚える記憶。いつでも書け、いつでも最後に書いた値を読める（はじめは0）。
  REG: (value: number) =>
    ext(
      ...FAULT_VALUES.map((x) => pre(`write.${x}`, ref("REG", x))),
      pre(`read.${value}`, ref("REG", value)),
    ),
  // 動いているディスク。書かれた値を覚え、読まれたら返す。いつ壊れてもよい。
  DISK: (i: number, value: number) =>
    ext(
      ...FAULT_VALUES.map((x) => pre(`put.${i}.${x}`, ref("DISK", i, x))),
      pre(`get.${i}.${value}`, ref("DISK", i, value)),
      pre(`crash.${i}`, ref("DEAD", i)),
    ),
  // 壊れたディスク。書き込みは受け取って捨て、読み出しには err を返す（止まったことが制御役に分かる）。
  DEAD: (i: number) =>
    ext(
      ...FAULT_VALUES.map((x) => pre(`put.${i}.${x}`, ref("DEAD", i))),
      pre(`err.${i}`, ref("DEAD", i)),
    ),
  // 制御役。書き込みは全部のディスクへ順に送る。読み出しの前に、1台目から順に、壊れていないディスクの値を取りに行く。
  CTL: (disks: number) =>
    ext(
      ...FAULT_VALUES.map((x) => pre(`write.${x}`, ref("PUT", disks, 1, x))),
      ref("FETCH", disks, 1),
    ),
  PUT: (disks: number, i: number, x: number) =>
    i > disks ? ref("CTL", disks) : pre(`put.${i}.${x}`, ref("PUT", disks, i + 1, x)),
  // 全部のディスクが壊れていたら、制御役は何もできずに止まる。
  FETCH: (disks: number, i: number) =>
    i > disks
      ? STOP
      : ext(
          ...FAULT_VALUES.map((v) => pre(`get.${i}.${v}`, ref("OFFER", disks, v))),
          pre(`err.${i}`, ref("FETCH", disks, i + 1)),
        ),
  // 取ってきた値を読ませる。読まれる前に書き込みが来ても受け付ける。
  OFFER: (disks: number, value: number) =>
    ext(
      pre(`read.${value}`, ref("CTL", disks)),
      ...FAULT_VALUES.map((x) => pre(`write.${x}`, ref("PUT", disks, 1, x))),
    ),
  // 故障を数えるプロセス。合わせて remaining 回まで、どのディスクの故障も起こせる。
  LIMIT: (disks: number, remaining: number) =>
    remaining > 0
      ? ext(
          ...crashEvents(disks).map((ev) =>
            pre(ev, ref("LIMIT", disks, remaining - 1)),
          ),
        )
      : STOP,
};

export function registerSpec(): Proc {
  return ref("REG", 0);
}

/** 制御役とディスク disks 台。中のやりとりは隠し、見えるのは write・read と crash だけ。 */
export function mirroredStore(disks: number): Proc {
  const allDisks = interleave(...range(disks).map((i) => ref("DISK", i, 0)));
  const internal = internalEvents(disks);
  return hide(par(ref("CTL", disks), internal, allDisks), internal);
}

/**
 * 外から見た記憶。故障の回数を limit 回までに限ってから（null なら限らない）、故障のイベントを Lazy 抽象化で隠す。
 * 上限0は「故障を起こさせない」（故障を STOP と同期させるのと同じ）。
 */
export function faultView(disks: number, limit: number | null): Proc {
  const crashes = crashEvents(disks);
  const store = mirroredStore(disks);
  const limited =
    limit === null ? store : par(store, crashes, ref("LIMIT", disks, limit));
  return lazyAbstraction(limited, crashes);
}

/** 仕様を満たしたまま許せる故障の回数（上限を0から増やして、初めて破れる1つ手前）。 */
export function toleratedFaults(disks: number): number {
  let limit = 0;
  while (
    limit <= disks &&
    failuresRefines(registerSpec(), faultView(disks, limit + 1), FAULT_ENV).holds
  ) {
    limit += 1;
  }
  return limit;
}

/** 故障を起こさせない系（本の NoFaults）: 故障のイベントを STOP と同期させる。故障は起きないので隠す必要もない。 */
export function noFaults(disks: number): Proc {
  return par(mirroredStore(disks), crashEvents(disks), STOP);
}

/**
 * 本の耐故障の定義: NoFaults ⊑F Lazy(系)。故障が（limit 回まで）起きても、故障の無い系より悪くならないか。
 * 機能の仕様（REG）を満たすかは問わないので、REG との比較は別に調べる（NoFaults について調べれば足りる）。
 */
export function isFaultTolerant(disks: number, limit: number | null): boolean {
  return failuresRefines(noFaults(disks), faultView(disks, limit), FAULT_ENV).holds;
}
