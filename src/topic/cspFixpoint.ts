// 再帰の意味を不動点として求める（Roscoe TPC 8.2・9.2 の範囲。例は自作の券売機）。
// 再帰 P = F(P) の本体 F を関数で持ち、STOP から F を n 回当てた近似 Fⁿ(STOP) のトレースを長さごとに数える。
// ガードのある再帰では、近似が1回ごとに長いトレースまで P と一致していき、その極限が P になる。
// ガードの無い P = P では、近似は STOP から動かず、どのプロセスも方程式を満たしてしまう。
// produces: FIXPOINT・approximation・traceCountsByLength・isGuarded・solvesEquation・UNWIND_EVENT
// consumes: csp.ts の演算子・moves・checkLaw。

import {
  type Env,
  type Proc,
  checkLaw,
  ext,
  hide,
  moves,
  pre,
  procKey,
  ref,
  STOP,
  TAU,
  TICK,
} from "./csp";

/** 再帰の本体 F。引数 x が「自分自身を呼ぶ所」に入る。 */
export type Body = (x: Proc) => Proc;

/** 名前を開く（再帰を1回ほどく）たびに起こす合図。隠すと τ になり、Roscoe の操作的意味論の「展開は τ」を表す。 */
export const UNWIND_EVENT = "unwind";

export interface Recursion {
  body: Body;
  env: Env;
  /** 再帰で書いたプロセス P そのもの。ガードが無いときは csp.ts に渡すと展開が終わらないので、渡さないこと。 */
  recursive: Proc;
  /** 名前を開くたびに unwind を起こし、それを隠したもの。展開そのものを τ として数える。 */
  unwound: Proc;
}

function recursion(name: string, body: Body): Recursion {
  const env: Env = {
    [name]: () => body(ref(name)),
    // F を n 回当てた近似。0 回なら STOP。
    [`${name}_APPROX`]: (n: number) =>
      n <= 0 ? STOP : body(ref(`${name}_APPROX`, n - 1)),
    [`${name}_UNWIND`]: () => pre(UNWIND_EVENT, body(ref(`${name}_UNWIND`))),
  };
  return {
    body,
    env,
    recursive: ref(name),
    unwound: hide(ref(`${name}_UNWIND`), [UNWIND_EVENT]),
  };
}

/**
 * 例の再帰。ticket はお金を入れると券か返金のどちらかを選べる券売機、coin はお金を受け取り続けるだけのもの、
 * self はガードの無い P = P。
 */
export const FIXPOINT = {
  ticket: recursion("TICKET", (x) =>
    pre("coin", ext(pre("ticket", x), pre("refund", x))),
  ),
  coin: recursion("COIN", (x) => pre("coin", x)),
  self: recursion("SELF", (x) => x),
};

export type RecursionId = keyof typeof FIXPOINT;

/** 近似 Fⁿ(STOP)。 */
export function approximation(rec: Recursion, n: number): Proc {
  const name = (rec.recursive as Extract<Proc, { k: "ref" }>).name;
  return ref(`${name}_APPROX`, n);
}

function tauClosure(start: Proc[], env: Env): Map<string, Proc> {
  const closure = new Map<string, Proc>();
  const queue = [...start];
  while (queue.length > 0) {
    const p = queue.shift()!;
    const key = procKey(p);
    if (closure.has(key)) continue;
    closure.set(key, p);
    for (const m of moves(p, env)) if (m.ev === TAU) queue.push(m.to);
  }
  return closure;
}

/**
 * 長さ 0〜maxLength の見えるトレースを長さごとに数える。✓ は数えない。
 * 「いまいうる状態の集まり」でたどるので、同じトレースを2回数えない。
 */
export function traceCountsByLength(root: Proc, env: Env, maxLength: number): number[] {
  const counts = [1];
  let layer = [tauClosure([root], env)];
  for (let length = 1; length <= maxLength; length += 1) {
    const next: Map<string, Proc>[] = [];
    for (const states of layer) {
      const byEvent = new Map<string, Proc[]>();
      for (const state of states.values()) {
        for (const m of moves(state, env)) {
          if (m.ev === TAU || m.ev === TICK) continue;
          byEvent.set(m.ev, [...(byEvent.get(m.ev) ?? []), m.to]);
        }
      }
      for (const targets of byEvent.values()) next.push(tauClosure(targets, env));
    }
    counts.push(next.length);
    layer = next;
  }
  return counts;
}

const SELF_CALL_NAME = "__SELF_CALL";

/**
 * ガードがあるか: 本体の中の自分を呼ぶ所が、どれも前置の後ろにあり、隠蔽の内側に無いか。
 * 隠蔽が自分を呼ぶ所にかかる再帰（P = a → (P \ {a}) など）は、前置で足したイベントを隠蔽が消してしまうので、
 * Roscoe TPC 3.1 の決まりに合わせてガードに数えない。
 */
export function isGuarded(body: Body): boolean {
  const walk = (p: Proc, isUnderPrefix: boolean, isUnderHide: boolean): boolean => {
    switch (p.k) {
      case "ref":
        return p.name !== SELF_CALL_NAME || (isUnderPrefix && !isUnderHide);
      case "prefix":
        return walk(p.next, true, isUnderHide);
      case "ext":
      case "int":
      case "seq":
      case "par":
        return (
          walk(p.l, isUnderPrefix, isUnderHide) && walk(p.r, isUnderPrefix, isUnderHide)
        );
      case "hide":
        return walk(p.p, isUnderPrefix, true);
      case "rename":
        return walk(p.p, isUnderPrefix, isUnderHide);
      default:
        return true;
    }
  };
  return walk(body(ref(SELF_CALL_NAME)), false, false);
}

/** 候補 Q が方程式 X = F(X) を満たすか（F(Q) と Q が、トレース・失敗・失敗発散のそれぞれで等しいか）。 */
export function solvesEquation(body: Body, candidate: Proc, env: Env) {
  return checkLaw(body(candidate), candidate, env);
}
