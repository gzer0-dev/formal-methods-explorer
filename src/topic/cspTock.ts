// 離散時間を tock イベントで数える（Roscoe TPC 第14章の考え方。例は自作の「依頼に応答するサーバー」）。
// 時間の1刻みを、全員が同期する tock で表す。「依頼から n tock 以内に応答する」は、依頼の後・応答の前に
// n+1 回目の tock が来ないというトレースの仕様になる。安全性なので、時間を止めてしまう（tock を断る）モデルは
// 空虚に満たしてしまう。そこで tock 以外を隠して TICKING（tock をずっと続ける）と比べ、時間が進み続けるかを別に調べる。
// request は環境の入力なので遅らせてよい（Lazy 抽象化）。request まで普通に隠すと、環境が無限の速さで依頼できる前提になる。
// produces: TOCK_ENV・server・deadlineSpec・checkDeadline・checkTimeProgress・checkTimeProgressEager・TICKING ／ consumes: csp.ts の演算子と詳細化。

import {
  type Env,
  ext,
  failuresDivergencesRefines,
  failuresRefines,
  hide,
  lazyAbstraction,
  pre,
  type Proc,
  ref,
  STOP,
  traceRefines,
} from "./csp";

/** 時間を止める上限を付けないとき（正しく tock を続ける）の印。 */
export const NO_TOCK_LIMIT = -1;

export const TOCK_ENV: Env = {
  // 待っている間は時間が進む（tock）。依頼（request）を受けたら作業に入る。
  SERVER: (delay: number, tockLimit: number) =>
    ext(
      pre("request", ref("WORK", 0, delay, tockLimit)),
      pre("tock", ref("SERVER", delay, tockLimit)),
    ),
  // 作業は delay tock かかる。終わったら tock を待たずに応答する（応答はサーバー自身の出力なので、すぐ起きる）。
  // tockLimit を付けると「k が上限に着いたら tock を書かない」誤り: 応答もできず、時間も進まない。
  WORK: (k: number, delay: number, tockLimit: number) => {
    if (k >= delay) return pre("reply", ref("SERVER", delay, tockLimit));
    if (tockLimit !== NO_TOCK_LIMIT && k >= tockLimit) return STOP;
    return pre("tock", ref("WORK", k + 1, delay, tockLimit));
  },
  // 仕様: 依頼の後、応答の前に来てよい tock は deadline 回まで。それを超える tock を仕様は起こせない。
  DEADLINE: (deadline: number) =>
    ext(
      pre("request", ref("DWAIT", 0, deadline)),
      pre("tock", ref("DEADLINE", deadline)),
    ),
  DWAIT: (k: number, deadline: number) =>
    k < deadline
      ? ext(
          pre("reply", ref("DEADLINE", deadline)),
          pre("tock", ref("DWAIT", k + 1, deadline)),
        )
      : pre("reply", ref("DEADLINE", deadline)),
  TICKING: () => pre("tock", ref("TICKING")),
};

/** 応答まで delay tock かかるサーバー。tockLimit を付けると、その数の tock で時間を止めてしまう誤りの版になる。 */
export function server(delay: number, tockLimit: number = NO_TOCK_LIMIT): Proc {
  return ref("SERVER", delay, tockLimit);
}

/** 仕様「依頼から deadline tock 以内に応答する」。 */
export function deadlineSpec(deadline: number): Proc {
  return ref("DEADLINE", deadline);
}

/** 時間がずっと進み続けるプロセス。 */
export const TICKING: Proc = ref("TICKING");

/** 期限の仕様をトレース詳細化で調べる。反例は、仕様が許さない tock が来た所までの最短の並び。 */
export function checkDeadline(deadline: number, impl: Proc) {
  return traceRefines(deadlineSpec(deadline), impl, TOCK_ENV);
}

/**
 * 時間が進み続けるか（環境の入力を遅らせてよいとする形）。request は依頼する側（環境）からの入力なので、
 * 環境がいつ送ってもよく、送らずに待たせてもよい。そこで request は Lazy 抽象化（いつでも起きうるが、起きなくてもよい）で隠し、
 * サーバー自身の出力 reply は普通に隠して、TICKING と安定失敗で比べる。安定した状態で tock を断れば「時間が止まる」反例になる。
 * Lazy 抽象化は発散を生むので、発散は見ない（⊑F）。
 */
export function checkTimeProgress(impl: Proc) {
  return failuresRefines(
    TICKING,
    hide(lazyAbstraction(impl, ["request"]), ["reply"]),
    TOCK_ENV,
  );
}

/**
 * 比べるための形: request まで普通に隠して ⊑FD で比べる。これは「環境が request をいくらでも速く送れる」と仮定したことになり、
 * tock を挟まずに依頼と応答を繰り返せるサーバーは発散（有限の時間に無限の動き）として反例になる。
 */
export function checkTimeProgressEager(impl: Proc) {
  return failuresDivergencesRefines(
    TICKING,
    hide(impl, ["request", "reply"]),
    TOCK_ENV,
  );
}
