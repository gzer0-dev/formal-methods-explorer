// CSP のレッスンで通して使うモデル。どれも csp.ts の計算にそのまま渡せる形にしてある。
// 例はこのサイトで作ったもの（書籍の例を写していない）。食事する哲学者だけは、広く知られた古典の問題をそのまま使う。

import {
  type Env,
  ext,
  hide,
  int,
  interleave,
  par,
  pre,
  type Proc,
  ref,
  seq,
  SKIP,
} from "./csp";

// ---- カウンタ: 共有変数を「読み書きを受け付けるプロセス」として書く ----

export const COUNTER_VALUES = [0, 1, 2];
export const ADDERS = ["A", "B"];
const MAX_VALUE = COUNTER_VALUES.at(-1)!;

const readEvents = ADDERS.flatMap((who) =>
  COUNTER_VALUES.map((v) => `read.${who}.${v}`),
);
const writeEvents = ADDERS.flatMap((who) =>
  COUNTER_VALUES.map((v) => `write.${who}.${v}`),
);
const lockEvents = ADDERS.flatMap((who) => [`lock.${who}`, `unlock.${who}`]);

/** 読んだ値に 1 を足して書く手順。値は 0〜2 の範囲で扱う（2 を超えない）。 */
function readThenWrite(who: string, after: Proc): Proc {
  return ext(
    ...COUNTER_VALUES.map((x) =>
      pre(`read.${who}.${x}`, pre(`write.${who}.${Math.min(x + 1, MAX_VALUE)}`, after)),
    ),
  );
}

export const COUNTER_ENV: Env = {
  // 変数: いまの値の読み出し・書き込み・最後の値の報告を受け付ける
  Var: (x: number) =>
    ext(
      ...ADDERS.map((who) => pre(`read.${who}.${x}`, ref("Var", x))),
      ...ADDERS.flatMap((who) =>
        COUNTER_VALUES.map((y) => pre(`write.${who}.${y}`, ref("Var", y))),
      ),
      pre("finish", pre(`result.${x}`, SKIP)),
    ),
  Adder: (who: string) => readThenWrite(who, SKIP),
  LockedAdder: (who: string) =>
    pre(`lock.${who}`, readThenWrite(who, pre(`unlock.${who}`, SKIP))),
  // ロック: 取った人が手放すまで、ほかの人は取れない
  Lock: () =>
    ext(
      ...ADDERS.map((who) => pre(`lock.${who}`, pre(`unlock.${who}`, ref("Lock")))),
      pre("finish", SKIP),
    ),
};

/** 2 つの足し手と変数（withLock ならロックも）を並行合成した全体。全員が終わると finish し、変数が result.値 を出す。 */
export function counterSystem(withLock: boolean): Proc {
  const adder = withLock ? "LockedAdder" : "Adder";
  const adders = seq(
    interleave(...ADDERS.map((who) => ref(adder, who))),
    pre("finish", SKIP),
  );
  const base = par(ref("Var", 0), [...readEvents, ...writeEvents, "finish"], adders);
  return withLock ? par(base, [...lockEvents, "finish"], ref("Lock")) : base;
}

/** 外から見えるのを finish と result だけにした全体（仕様と比べるため、読み書きとロックを隠す）。 */
export function counterObserved(withLock: boolean): Proc {
  return hide(counterSystem(withLock), [...readEvents, ...writeEvents, ...lockEvents]);
}

/** 仕様: 全員が終わったら、結果は必ず 2。 */
export const RESULT_SPEC: Proc = pre("finish", pre(`result.${ADDERS.length}`, SKIP));

// ---- プリンタ: 利用者が選ぶ（外部選択）か、機械が勝手に決める（内部選択）か ----

export const PRINTER_ENV: Env = {
  // 仕様: モノクロもカラーも、利用者が選べばいつでも刷る
  Spec: () =>
    ext(
      pre("mono", pre("print", ref("Spec"))),
      pre("color", pre("print", ref("Spec"))),
    ),
  // 実装: カラーのインクが少ないと、機械が勝手にモノクロしか受け付けない状態になることがある
  Impl: () =>
    int(
      ext(
        pre("mono", pre("print", ref("Impl"))),
        pre("color", pre("print", ref("Impl"))),
      ),
      pre("mono", pre("print", ref("Impl"))),
    ),
};

export const printerSpec = (): Proc => ref("Spec");
export const printerImpl = (): Proc => ref("Impl");

// ---- 食事する哲学者: 丸いテーブルに n 人、両隣のフォークを2本取ってから食べる ----

function forksOf(i: number, n: number, isAsymmetric: boolean): [number, number] {
  const left = i;
  const right = (i + 1) % n;
  // 最後の1人だけ右から取ると、全員が1本ずつ持って待つ輪ができない
  return isAsymmetric && i === n - 1 ? [right, left] : [left, right];
}

export const PHILOSOPHER_ENV: Env = {
  Phil: (i: number, n: number, asym: number) => {
    const [first, second] = forksOf(i, n, asym === 1);
    return pre(
      `pick.${i}.${first}`,
      pre(
        `pick.${i}.${second}`,
        pre(`put.${i}.${second}`, pre(`put.${i}.${first}`, ref("Phil", i, n, asym))),
      ),
    );
  },
  // フォーク j は、左側の哲学者 j と右側の哲学者 j-1 のどちらかに取られ、置かれるまで次に取られない
  Fork: (j: number, n: number) =>
    ext(
      ...[j, (j - 1 + n) % n].map((i) =>
        pre(`pick.${i}.${j}`, pre(`put.${i}.${j}`, ref("Fork", j, n))),
      ),
    ),
};

export function philosophers(n: number, isAsymmetric: boolean): Proc {
  const asym = isAsymmetric ? 1 : 0;
  const people = Array.from({ length: n }, (_, i) => ref("Phil", i, n, asym));
  const forks = Array.from({ length: n }, (_, j) => ref("Fork", j, n));
  const forkEvents = Array.from({ length: n }, (_, i) =>
    forksOf(i, n, isAsymmetric).flatMap((j) => [`pick.${i}.${j}`, `put.${i}.${j}`]),
  ).flat();
  return par(interleave(...people), forkEvents, interleave(...forks));
}

// ---- リトライするジョブ: 隠すと発散（ライブロック）になる ----

export const JOB_ENV: Env = {
  // retries が -1 なら何度でもやり直す
  Job: (retries: number) =>
    pre(
      "start",
      ext(
        pre("succeed", SKIP),
        retries === 0
          ? pre("giveup", SKIP)
          : pre("fail", ref("Job", retries < 0 ? -1 : retries - 1)),
      ),
    ),
};

/** isHidden なら start と fail を外から見えない動きにする（呼び出し側には成功か断念しか見えない）。 */
export function jobSystem(maxRetries: number | null, isHidden: boolean): Proc {
  const job = ref("Job", maxRetries ?? -1);
  return isHidden ? hide(job, ["start", "fail"]) : job;
}
