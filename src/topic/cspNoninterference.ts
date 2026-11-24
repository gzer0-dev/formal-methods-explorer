// 非干渉（独立性）: 高い利用者（hi）のイベントを Lazy 抽象化で隠し、低い利用者（lo）から見たプロセスが決定的なら、
// 高い側が何をしても低い側の見え方は変わらない＝漏れない、と判定する（Roscoe TPC 12.4 の考え方。例は自作）。
// 題材は2人で使うプリンタ。刷った紙を置く受け皿を共有すると、高い利用者が紙を取らないだけで低い利用者が送れなくなる。
// produces: lowView・spoolerSystem・NONINTERFERENCE_ENV・HIGH_EVENTS・LOW_EVENTS・LEAK_RUN・Design・Abstraction
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

/** shared: 受け皿が1つ／separate: 受け皿を分ける／queue: 受け皿は分けるが、前に共有の1枠の待ち行列がある。 */
export type Design = "shared" | "separate" | "queue";
/** lazy: 高い利用者はいつ止まってもよい／eager: ただ隠す（高い利用者は必ず続ける、と当てにする）。 */
export type Abstraction = "lazy" | "eager";

export const HIGH_EVENTS = ["hi.send", "hi.take"];
export const LOW_EVENTS = ["lo.send", "lo.take"];
/** 中の動き（刷る・待ち行列から取り出す）。どの設計でも外からは見えないので、先に隠す。 */
const INTERNAL_EVENTS = ["print.hi", "print.lo", "pick.hi", "pick.lo"];

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
  // 待ち行列のある版: 送った仕事は1枠の待ち行列に入り、機械が取り出して刷り、各自の受け皿に置く。
  SLOT: () =>
    ext(
      pre("hi.send", pre("pick.hi", ref("SLOT"))),
      pre("lo.send", pre("pick.lo", ref("SLOT"))),
    ),
  // 機械は取り出した仕事を受け皿に置くまで、次を取り出さない（受け皿が埋まっていると待つ）。
  QUEUE_ENGINE: () =>
    ext(
      pre("pick.hi", pre("print.hi", ref("QUEUE_ENGINE"))),
      pre("pick.lo", pre("print.lo", ref("QUEUE_ENGINE"))),
    ),
  QUEUE_HI_TRAY: () => pre("print.hi", pre("hi.take", ref("QUEUE_HI_TRAY"))),
  QUEUE_LO_TRAY: () => pre("print.lo", pre("lo.take", ref("QUEUE_LO_TRAY"))),
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
  return par(
    par(ref("SLOT"), ["pick.hi", "pick.lo"], ref("QUEUE_ENGINE")),
    ["print.hi", "print.lo"],
    interleave(ref("QUEUE_HI_TRAY"), ref("QUEUE_LO_TRAY")),
  );
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
