// CSP の応用のレッスン（抽象化・匿名性・取り消し）で使うモデル。例はこのサイトで作ったもの。
// 食事する暗号学者だけは、広く知られた古典の問題（Chaum の匿名の支払いの手順）をそのまま使う。

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
  SKIP,
  STOP,
} from "./csp";
import { PHILOSOPHER_ENV, philosophers } from "./cspModels";

// ---- 抽象化: 3人の哲学者のうち、哲学者0が左のフォークを取る・置くだけを見る ----

const PEOPLE = 3;

function forkEventsOf(isAsymmetric: boolean): string[] {
  const events: string[] = [];
  for (let i = 0; i < PEOPLE; i += 1) {
    const forks = [i, (i + 1) % PEOPLE];
    if (isAsymmetric && i === PEOPLE - 1) forks.reverse();
    for (const j of forks) events.push(`pick.${i}.${j}`, `put.${i}.${j}`);
  }
  return events;
}

export const FOCUS_EVENTS = ["pick.0.0", "put.0.0"];

export const FOCUS_ENV: Env = {
  ...PHILOSOPHER_ENV,
  // 抽象化した仕様: 哲学者0は左のフォークを取って置く、を繰り返すだけ
  Focus: () => pre("pick.0.0", pre("put.0.0", ref("Focus"))),
};

export const FOCUS_SPEC: Proc = ref("Focus");

/** 哲学者0の左のフォークの取る・置く以外を全部隠した全体。 */
export function focusOnPhilosopher0(isAsymmetric: boolean): Proc {
  const hidden = forkEventsOf(isAsymmetric).filter((ev) => !FOCUS_EVENTS.includes(ev));
  return hide(philosophers(PEOPLE, isAsymmetric), hidden);
}

// ---- 食事する暗号学者: 3人がコインを使い、誰が払ったかを明かさずに「誰かが払ったか」だけを伝える ----

/** 暗号学者 i が見るのは、自分のコイン i と右隣のコイン i+1。コイン j を見るのは暗号学者 j と j-1。 */
function rightOf(i: number): number {
  return (i + 1) % PEOPLE;
}

function coin(j: number): Proc {
  // コインの裏表は外から決められない（内部選択）。決まった値を、持ち主 j が見てから、左隣 j-1 が見る。
  // 見る順を決めておくのは、並びの組み合わせで状態が増えすぎないようにするため（見える発言には影響しない）。
  const flip = (v: number) =>
    pre(
      `look.${j}.${j}.${v}`,
      pre(`look.${(j + PEOPLE - 1) % PEOPLE}.${j}.${v}`, STOP),
    );
  return int(flip(0), flip(1));
}

function cryptographer(i: number, hasPaid: boolean): Proc {
  // 2枚のコインが同じなら 0、違えば 1 を言う。払った人だけは逆を言う。言い終えたら止まる。
  return ext(
    ...[0, 1].map((a) =>
      pre(
        `look.${i}.${i}.${a}`,
        ext(
          ...[0, 1].map((b) =>
            pre(
              `look.${i}.${rightOf(i)}.${b}`,
              pre(`say.${i}.${a ^ b ^ (hasPaid ? 1 : 0)}`, STOP),
            ),
          ),
        ),
      ),
    ),
  );
}

function lookEvents(i: number): string[] {
  return [i, rightOf(i)].flatMap((j) => [0, 1].map((v) => `look.${i}.${j}.${v}`));
}

export const CRYPTO_ENV: Env = {};

/**
 * payer は払った暗号学者（null なら誰も払っていない＝上司が払った）。
 * 外から見えるのは発言（say.i.x）だけ。leakCoins なら暗号学者0の見たコインも外に漏れる。
 */
export function cryptographers(payer: number | null, leakCoins: boolean): Proc {
  const people = interleave(
    ...Array.from({ length: PEOPLE }, (_, i) => cryptographer(i, payer === i)),
  );
  const coins = interleave(...Array.from({ length: PEOPLE }, (_, j) => coin(j)));
  const looks = Array.from({ length: PEOPLE }, (_, i) => lookEvents(i)).flat();
  const hidden = leakCoins ? looks.filter((ev) => !lookEvents(0).includes(ev)) : looks;
  return hide(par(people, looks, coins), hidden);
}

/** 発言の値の排他的論理和。誰かが払っていれば 1、誰も払っていなければ 0 になる。 */
export function parityOf(trace: string[]): number {
  return trace
    .filter((ev) => ev.startsWith("say."))
    .reduce((acc, ev) => acc ^ Number(ev.split(".")[2]), 0);
}

// ---- 送受信待ちの取り消し: 落ちうる通信路で、依頼と応答をやり取りする ----

export type CancelMode = "wait" | "timeout" | "cancel";

export const CANCEL_ENV: Env = {};

function client(mode: CancelMode): Proc {
  const success = pre("resp", pre("done", SKIP));
  if (mode === "wait") return pre("req", success);
  const giveUp =
    mode === "cancel"
      ? pre("timeout", pre("cancel", pre("giveup", SKIP)))
      : pre("timeout", pre("giveup", SKIP));
  return pre("req", ext(success, giveUp));
}

/**
 * サーバー: 依頼を受けた後、通信路で落ちたか（内部選択）で分かれる。届けば処理して応答を返す。
 * cancel のときは、応答を返す前でも、依頼が落ちて何も来なかったときでも、取り消しを受け付けて終わる。
 */
function server(mode: CancelMode): Proc {
  const reply =
    mode === "cancel" ? ext(pre("resp", SKIP), pre("cancel", SKIP)) : pre("resp", SKIP);
  const lost = mode === "cancel" ? pre("cancel", SKIP) : SKIP;
  return pre("req", int(pre("work", reply), lost));
}

export function cancelSystem(mode: CancelMode): Proc {
  return par(client(mode), ["req", "resp", "cancel"], server(mode));
}
