// 非干渉（独立性）: 高い利用者（hi）のイベントを Lazy 抽象化で隠し、低い利用者（lo）から見たプロセスが決定的なら、
// 高い側が何をしても低い側の見え方は変わらない＝漏れない、と判定する（Roscoe TPC 12.4 の考え方。例は自作）。
// 題材は2人で使うプリンタ。刷った紙を置く受け皿を共有すると、高い利用者が紙を取らないだけで低い利用者が送れなくなる。
// produces: lowView・spoolerSystem・NONINTERFERENCE_ENV・HIGH_EVENTS・LOW_EVENTS・LEAK_RUN・HELD_CAPACITY・Design・Abstraction
// consumes: csp.ts の演算子と lazyAbstraction。

import {
  type Env,
  type Proc,
  ext,
  hide,
  interleave,
  lazyAbstraction,
  par,
  pre,
  ref,
} from "./csp";

/**
 * shared: 受け皿が1つ／separate: 受け皿を分ける／
 * held: 留め置き印刷（送った仕事は、本人がプリンタの前で取り出すまで、2人で共有する2件分の記憶領域に残る）。
 */
export type Design = "shared" | "separate" | "held";

/** 留め置き印刷の記憶領域に置ける仕事の数（2人の合計）。 */
export const HELD_CAPACITY = 2;
/** lazy: 高い利用者はいつ止まってもよい／eager: ただ隠す（高い利用者は必ず続ける、と当てにする）。 */
export type Abstraction = "lazy" | "eager";

export const HIGH_EVENTS = ["hi.send", "hi.take"];
export const LOW_EVENTS = ["lo.send", "lo.take"];
/** 中の動き（刷る）。どの設計でも外からは見えないので、先に隠す。 */
const INTERNAL_EVENTS = ["print.hi", "print.lo"];

/** 漏れる実行の例: 高い利用者が送って、紙を取らない。この後、受け皿が1つの設計では lo.send を起こせない。 */
export const LEAK_RUN = ["hi.send"];

export const NONINTERFERENCE_ENV: Env = {
  // 高い利用者。送るのは合わせて jobs 回まで（刷れた紙を取るのはいつでもよい）。
  // 回数を限るのは、隠した高いイベントだけで回る輪（発散）を作らないため。
  HIGH: (jobs: number) =>
    jobs > 0
      ? ext(pre("hi.send", ref("HIGH", jobs - 1)), pre("hi.take", ref("HIGH", jobs)))
      : pre("hi.take", ref("HIGH", 0)),
  // 受け皿が1つ: 誰かの紙が載っている間は、どちらも次を送れない。
  TRAY: () =>
    ext(
      pre("hi.send", pre("print.hi", pre("hi.take", ref("TRAY")))),
      pre("lo.send", pre("print.lo", pre("lo.take", ref("TRAY")))),
    ),
  // 受け皿を分けた版。それぞれの受け皿は自分の紙だけを載せる。
  HI_TRAY: () => pre("hi.send", pre("print.hi", pre("hi.take", ref("HI_TRAY")))),
  LO_TRAY: () => pre("lo.send", pre("print.lo", pre("lo.take", ref("LO_TRAY")))),
  // 刷る機械は1台を共有する。刷るのは一瞬で、刷り終えた紙を持ち続けない。
  ENGINE: () => ext(pre("print.hi", ref("ENGINE")), pre("print.lo", ref("ENGINE"))),
  // 留め置き印刷: 送った仕事は記憶領域に置かれ、本人が取り出す（take、その場で刷られる）まで残る。
  // 記憶領域は2人で共有し、合わせて HELD_CAPACITY 件までしか置けない。
  HELD: (high: number, low: number) => {
    const isFull = high + low >= HELD_CAPACITY;
    const choices: Proc[] = [];
    if (!isFull) {
      choices.push(pre("hi.send", ref("HELD", high + 1, low)));
      choices.push(pre("lo.send", ref("HELD", high, low + 1)));
    }
    if (high > 0) choices.push(pre("hi.take", ref("HELD", high - 1, low)));
    if (low > 0) choices.push(pre("lo.take", ref("HELD", high, low - 1)));
    return ext(...choices);
  },
};

function spooler(design: Design): Proc {
  if (design === "shared")
    return par(ref("TRAY"), ["print.hi", "print.lo"], ref("ENGINE"));
  if (design === "separate") {
    return par(
      interleave(ref("HI_TRAY"), ref("LO_TRAY")),
      ["print.hi", "print.lo"],
      ref("ENGINE"),
    );
  }
  return ref("HELD", 0, 0);
}

/** プリンタと高い利用者を合わせた全体。中の動きは隠し、見えるのは hi.* と lo.* だけ。低い利用者は環境として外に置く。 */
export function spoolerSystem(design: Design, highJobs: number): Proc {
  return hide(
    par(spooler(design), HIGH_EVENTS, ref("HIGH", highJobs)),
    INTERNAL_EVENTS,
  );
}

/** 低い利用者から見たプロセス。高い利用者のイベントを Lazy 抽象化（または、ただの隠蔽）で見えなくする。 */
export function lowView(
  design: Design,
  highJobs: number,
  abstraction: Abstraction,
): Proc {
  const system = spoolerSystem(design, highJobs);
  return abstraction === "lazy"
    ? lazyAbstraction(system, HIGH_EVENTS)
    : hide(system, HIGH_EVENTS);
}
