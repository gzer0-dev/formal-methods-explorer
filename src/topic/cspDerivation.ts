// 1手の動きが、どの遷移規則をどう重ねてできたか（導出）を組み立てる。
// csp.ts の moves は「いちばん外側の演算子の規則」しか返さないため、内側の SeqTick や IntCh1 が見えない。
// ここでは部分プロセスにも moves を当て、イベントと行き先（procKey）が合う手を前提として探す。
// 規則名はすべて moves の戻り値から取り、意味論を書き直さない（csp.ts とずれないようにするため）。
//
// produces: derivationOf / derivationText / tauOrigin / pathWithTau / nextStepsFor / Derivation / TakenMove
// consumes: csp.ts の explore・moves・procKey・TAU・TICK と Proc・Env・Move の型

import {
  type Env,
  explore,
  type Move,
  moves,
  type Proc,
  procKey,
  TAU,
  TICK,
} from "./csp";

export interface Derivation {
  rule: string;
  ev: string;
  /** この規則を当てるのに使った、部分プロセスの手（同期なら左右の2つ）。 */
  premises: Derivation[];
}

type Of<K extends Proc["k"]> = Extract<Proc, { k: K }>;

function unfoldName(p: Of<"ref">, env: Env): Proc {
  const definition = env[p.name];
  if (!definition) throw new Error(`定義の無いプロセス: ${p.name}`);
  return (definition as (...args: (string | number)[]) => Proc)(...p.args);
}

/** 部分プロセス sub の手のうち、イベントが ev で（指定があれば）行き先が to の手。 */
function premiseOf(sub: Proc, env: Env, ev: string, to: Proc | null): Derivation {
  const toKey = to ? procKey(to) : null;
  const found = moves(sub, env).find(
    (m) => m.ev === ev && (toKey === null || procKey(m.to) === toKey),
  );
  if (!found) throw new Error(`前提の手が見つからない: ${procKey(sub)} --${ev}-->`);
  return derivationOf(sub, env, found);
}

/** 隠蔽の前提: 隠したイベントのどれか（Hide1）か、同じイベント（Hide2・HideTick）。 */
function hidePremise(p: Of<"hide">, env: Env, move: Move): Derivation {
  if (move.rule === "HideTick") return premiseOf(p.p, env, TICK, null);
  const inner = (move.to as Of<"hide">).p;
  if (move.rule === "Hide2") return premiseOf(p.p, env, move.ev, inner);
  const innerKey = procKey(inner);
  const found = moves(p.p, env).find(
    (m) => p.set.includes(m.ev) && procKey(m.to) === innerKey,
  );
  if (!found) throw new Error(`隠したイベントの手が見つからない: ${procKey(p)}`);
  return derivationOf(p.p, env, found);
}

function premisesOf(p: Proc, env: Env, move: Move): Derivation[] {
  switch (move.rule) {
    case "Prefix":
    case "Skip":
    case "IntCh1":
    case "IntCh2":
    case "ParTerm":
      return [];
    case "PName":
      return [premiseOf(unfoldName(p as Of<"ref">, env), env, move.ev, move.to)];
    case "ExtCh1":
      return [premiseOf((p as Of<"ext">).l, env, move.ev, move.to)];
    case "ExtCh2":
      return [premiseOf((p as Of<"ext">).r, env, move.ev, move.to)];
    case "ExtChTau1":
      return [premiseOf((p as Of<"ext">).l, env, TAU, (move.to as Of<"ext">).l)];
    case "ExtChTau2":
      return [premiseOf((p as Of<"ext">).r, env, TAU, (move.to as Of<"ext">).r)];
    case "Par1":
      return [premiseOf((p as Of<"par">).l, env, move.ev, (move.to as Of<"par">).l)];
    case "Par2":
      return [premiseOf((p as Of<"par">).r, env, move.ev, (move.to as Of<"par">).r)];
    case "ParTick1":
      return [premiseOf((p as Of<"par">).l, env, TICK, null)];
    case "ParTick2":
      return [premiseOf((p as Of<"par">).r, env, TICK, null)];
    case "ParSync": {
      const par = p as Of<"par">;
      const to = move.to as Of<"par">;
      return [
        premiseOf(par.l, env, move.ev, to.l),
        premiseOf(par.r, env, move.ev, to.r),
      ];
    }
    case "Hide1":
    case "Hide2":
    case "HideTick":
      return [hidePremise(p as Of<"hide">, env, move)];
    case "Seq":
      return [premiseOf((p as Of<"seq">).l, env, move.ev, (move.to as Of<"seq">).l)];
    case "SeqTick":
      return [premiseOf((p as Of<"seq">).l, env, TICK, null)];
    default:
      throw new Error(`知らない遷移規則: ${move.rule}`);
  }
}

/** p から move の手が、どの規則をどう重ねてできたか。move は moves(p, env) の戻り値の1つを渡す。 */
export function derivationOf(p: Proc, env: Env, move: Move): Derivation {
  return { rule: move.rule, ev: move.ev, premises: premisesOf(p, env, move) };
}

/**
 * 導出を「外側の規則(内側の規則, …)」の形で書く。前提が1つで同じ規則が続く段は「×n」にまとめる
 * （選択肢の多い □ は左から重ねた形なので、ExtCh1 が何段も続いて読めなくなるため）。
 */
export function derivationText(d: Derivation): string {
  let count = 1;
  let inner = d;
  while (inner.premises.length === 1 && inner.premises[0]!.rule === d.rule) {
    inner = inner.premises[0]!;
    count += 1;
  }
  const head = count > 1 ? `${d.rule}×${count}` : d.rule;
  if (inner.premises.length === 0) return head;
  return `${head}(${inner.premises.map(derivationText).join(", ")})`;
}

/** τ の手で、見えない動きを生んだ規則（τ を出している中でいちばん内側の規則）。 */
export function tauOrigin(d: Derivation): string {
  const inner = d.premises.find((premise) => premise.ev === TAU);
  return inner ? tauOrigin(inner) : d.rule;
}

export interface TakenMove {
  move: Move;
  derivation: Derivation;
}

function takeMove(p: Proc, env: Env, move: Move): TakenMove {
  return { move, derivation: derivationOf(p, env, move) };
}

/** そのイベントまでの最短の手順を、τ も含めて1手ずつ（規則の導出付きで）返す。着かなければ null。 */
export function pathWithTau(root: Proc, env: Env, ev: string): TakenMove[] | null {
  const lts = explore(root, env);
  const last = lts.edges.find((edge) => edge.ev === ev);
  if (!last) return null;
  // 幅優先の親をさかのぼって、通った状態の鍵とイベントを並べる
  const keys = [last.from];
  const events = [ev];
  for (
    let cursor = lts.parent.get(last.from);
    cursor;
    cursor = lts.parent.get(cursor.from)
  ) {
    keys.unshift(cursor.from);
    events.unshift(cursor.ev);
  }
  keys.push(last.to);
  return events.map((stepEv, index) => {
    const state = lts.states.get(keys[index]!)!;
    const nextKey = keys[index + 1]!;
    const move = moves(state, env).find(
      (m) => m.ev === stepEv && procKey(m.to) === nextKey,
    )!;
    return takeMove(state, env, move);
  });
}

/**
 * 今の状態から τ だけを幅優先でたどり、ev を起こせる状態までの最短の τ の手と、その ev の手を返す。
 * 起こせなければ null。先頭の τ に決め打ちしないのは、内部選択の片側でしか起こせないイベントがあるため。
 */
export function nextStepsFor(state: Proc, env: Env, ev: string): TakenMove[] | null {
  const queue: { state: Proc; path: TakenMove[] }[] = [{ state, path: [] }];
  const seen = new Set([procKey(state)]);
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]!;
    const all = moves(current.state, env);
    const hit = all.find((m) => m.ev === ev);
    if (hit) return [...current.path, takeMove(current.state, env, hit)];
    for (const m of all) {
      if (m.ev !== TAU || seen.has(procKey(m.to))) continue;
      seen.add(procKey(m.to));
      queue.push({
        state: m.to,
        path: [...current.path, takeMove(current.state, env, m)],
      });
    }
  }
  return null;
}
