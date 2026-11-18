// 時相論理（LTL）のよく使う形を、状態遷移のモデル（modelCheck.ts の Model）で調べる。
// 無限に続く実行を考え、動けなくなった状態はそこで止まり続ける（足踏み）とみなす。
// 公平性: システム自身の動きは、できる限り止まらないものとして扱う（環境の動きは、しなくてもよい）。

import type { Action, Model } from "./modelCheck";

export type LtlFormula =
  | { kind: "always"; p: string } // □p: いつでも p
  | { kind: "eventually"; p: string } // ◇p: いつか必ず p
  | { kind: "alwaysEventually"; p: string } // □◇p: 何度でも p に戻ってくる
  | { kind: "eventuallyAlways"; p: string } // ◇□p: いつかから先はずっと p
  | { kind: "leadsTo"; p: string; q: string }; // □(p → ◇q): p になったら、いつか必ず q

export interface LtlSystem<S> {
  model: Model<S>;
  /** 原子命題（状態について真か偽かを言う名前） */
  props: Record<string, (state: S) => boolean>;
  /** 環境の動き（しなくてもよい）の名前。ここに無い動きは、できる限り止まらないシステムの動き。 */
  environmentActions: string[];
}

export interface LtlResult {
  holds: boolean;
  /** 反例: 初期状態から輪の入口（または破れた状態）までの動きの名前 */
  trace: string[] | null;
  /** 反例の輪（無限に繰り返す部分）の動きの名前。□p の反例では null */
  cycle: string[] | null;
}

interface Graph<S> {
  states: Map<string, S>;
  edges: Map<string, { to: string; action: Action<S> }[]>;
  parent: Map<string, { from: string; action: string } | null>;
}

function buildGraph<S>(model: Model<S>): Graph<S> {
  const initKey = model.key(model.init);
  const states = new Map([[initKey, model.init]]);
  const edges = new Map<string, { to: string; action: Action<S> }[]>();
  const parent = new Map<string, { from: string; action: string } | null>([
    [initKey, null],
  ]);
  const queue = [initKey];
  for (let head = 0; head < queue.length; head += 1) {
    const key = queue[head]!;
    const state = states.get(key)!;
    const out = model.actions
      .filter((a) => a.enabled(state))
      .map((a) => {
        const next = a.next(state);
        const nextKey = model.key(next);
        if (!states.has(nextKey)) {
          states.set(nextKey, next);
          parent.set(nextKey, { from: key, action: a.name });
          queue.push(nextKey);
        }
        return { to: nextKey, action: a };
      });
    edges.set(key, out);
  }
  return { states, edges, parent };
}

function pathTo<S>(graph: Graph<S>, key: string): string[] {
  const reversed: string[] = [];
  let cursor = graph.parent.get(key);
  while (cursor) {
    reversed.push(cursor.action);
    cursor = graph.parent.get(cursor.from);
  }
  return reversed.reverse();
}

/** from から to まで、allowed の状態だけを通る最短の動きの並び（from 自身は allowed でなくてよい）。 */
function pathWithin<S>(
  graph: Graph<S>,
  from: string,
  to: string,
  allowed: (key: string) => boolean,
): string[] {
  const back = new Map<string, { from: string; action: string } | null>([[from, null]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const key = queue[head]!;
    if (key === to) break;
    for (const e of graph.edges.get(key) ?? []) {
      if (back.has(e.to) || !allowed(e.to)) continue;
      back.set(e.to, { from: key, action: e.action.name });
      queue.push(e.to);
    }
  }
  const reversed: string[] = [];
  let cursor = back.get(to);
  while (cursor) {
    reversed.push(cursor.action);
    cursor = back.get(cursor.from);
  }
  return reversed.reverse();
}

/**
 * 「許された状態（allowed）だけを通って無限に続く実行」の輪を、start から探す。
 * システムの動きができる状態で、環境の動きだけを繰り返す輪は「システムが止まり続ける」ので数えない（公平性）。
 * 動けない状態は足踏みの輪とみなす。mustVisit があれば、輪はその状態を1つ以上含む必要がある。
 */
function findLasso<S>(
  system: LtlSystem<S>,
  graph: Graph<S>,
  start: string,
  allowed: (key: string) => boolean,
  mustVisit: (key: string) => boolean = () => true,
): { entry: string; cycle: string[] } | null {
  const isEnv = (name: string) => system.environmentActions.includes(name);
  const systemCanMove = (key: string) =>
    (graph.edges.get(key) ?? []).some((e) => !isEnv(e.action.name));
  const reachable = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const key = stack.pop()!;
    if (reachable.has(key) || !allowed(key)) continue;
    reachable.add(key);
    for (const e of graph.edges.get(key) ?? []) stack.push(e.to);
  }
  for (const key of reachable) {
    const out = graph.edges.get(key) ?? [];
    if (out.length === 0 && mustVisit(key)) return { entry: key, cycle: [] };
  }
  // 各状態について、そこへ戻ってくる輪を幅優先で探す（小さなモデル向け）
  for (const entry of reachable) {
    if (!mustVisit(entry)) continue;
    const back = new Map<string, { from: string; action: string }>();
    const queue = [entry];
    const seen = new Set([entry]);
    for (let head = 0; head < queue.length; head += 1) {
      const key = queue[head]!;
      for (const e of graph.edges.get(key) ?? []) {
        if (!reachable.has(e.to)) continue;
        if (e.to === entry) {
          const cycle = [e.action.name];
          let cursor = key;
          while (cursor !== entry) {
            const step = back.get(cursor)!;
            cycle.unshift(step.action);
            cursor = step.from;
          }
          const cycleStates = [entry];
          let walker = entry;
          for (const name of cycle.slice(0, -1)) {
            walker = (graph.edges.get(walker) ?? []).find(
              (x) => x.action.name === name && reachable.has(x.to),
            )!.to;
            cycleStates.push(walker);
          }
          const onlyEnvWhileSystemCanMove =
            cycle.every((name) => isEnv(name)) && cycleStates.some(systemCanMove);
          if (!onlyEnvWhileSystemCanMove) return { entry, cycle };
          continue;
        }
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        back.set(e.to, { from: key, action: e.action.name });
        queue.push(e.to);
      }
    }
  }
  return null;
}

export function checkLtl<S>(system: LtlSystem<S>, formula: LtlFormula): LtlResult {
  const graph = buildGraph(system.model);
  const prop = (name: string) => {
    const f = system.props[name];
    if (!f) throw new Error(`原子命題が無い: ${name}`);
    return (key: string) => f(graph.states.get(key)!);
  };
  const initKey = system.model.key(system.model.init);
  const ok: LtlResult = { holds: true, trace: null, cycle: null };
  // 反例の手順は「初期状態から start まで」＋「start から輪の入口まで（allowed の中だけを通る）」
  const lasso = (
    found: { entry: string; cycle: string[] } | null,
    start: string = initKey,
    allowed: (key: string) => boolean = () => true,
  ): LtlResult =>
    found
      ? {
          holds: false,
          trace: [
            ...pathTo(graph, start),
            ...pathWithin(graph, start, found.entry, allowed),
          ],
          cycle: found.cycle,
        }
      : ok;

  switch (formula.kind) {
    case "always": {
      const p = prop(formula.p);
      const bad = [...graph.states.keys()].find((key) => !p(key));
      return bad === undefined
        ? ok
        : { holds: false, trace: pathTo(graph, bad), cycle: null };
    }
    case "eventually": {
      const p = prop(formula.p);
      const notP = (key: string) => !p(key);
      return lasso(findLasso(system, graph, initKey, notP), initKey, notP);
    }
    case "alwaysEventually": {
      const p = prop(formula.p);
      for (const key of graph.states.keys()) {
        if (p(key)) continue;
        const notP = (k: string) => !p(k);
        const found = findLasso(system, graph, key, notP);
        if (found) return lasso(found, key, notP);
      }
      return ok;
    }
    case "eventuallyAlways": {
      const p = prop(formula.p);
      return lasso(
        findLasso(
          system,
          graph,
          initKey,
          () => true,
          (key) => !p(key),
        ),
      );
    }
    case "leadsTo": {
      const p = prop(formula.p);
      const q = prop(formula.q);
      for (const key of graph.states.keys()) {
        if (!p(key) || q(key)) continue;
        const notQ = (k: string) => !q(k);
        const found = findLasso(system, graph, key, notQ);
        if (found) return lasso(found, key, notQ);
      }
      return ok;
    }
  }
}

// ---- 例: エレベーターの扉 ----

export type DoorPosition = "closed" | "opening" | "open" | "closing";

export interface DoorState {
  door: DoorPosition;
  requested: boolean;
}

/** hasBug なら、閉まりきったときに呼び出しを消してしまう（閉まる途中で押された呼び出しを取りこぼす）。 */
export function doorModel(hasBug: boolean): LtlSystem<DoorState> {
  const model: Model<DoorState> = {
    init: { door: "closed", requested: false },
    key: (s) => `${s.door}|${s.requested}`,
    actions: [
      {
        name: "呼ぶ",
        enabled: (s) => !s.requested && s.door !== "open",
        next: (s) => ({ ...s, requested: true }),
      },
      {
        name: "待つ",
        enabled: (s) => s.door === "closed" && !s.requested,
        next: (s) => s,
      },
      {
        name: "開き始める",
        enabled: (s) => s.door === "closed" && s.requested,
        next: (s) => ({ ...s, door: "opening" }),
      },
      {
        name: "開ききる",
        enabled: (s) => s.door === "opening",
        next: () => ({ door: "open", requested: false }),
      },
      {
        name: "閉まり始める",
        enabled: (s) => s.door === "open",
        next: (s) => ({ ...s, door: "closing" }),
      },
      {
        name: "閉まりきる",
        enabled: (s) => s.door === "closing",
        next: (s) => ({ door: "closed", requested: hasBug ? false : s.requested }),
      },
    ],
  };
  return {
    model,
    props: {
      requested: (s) => s.requested,
      open: (s) => s.door === "open",
      closed: (s) => s.door === "closed",
      safe: (s) => !(s.door === "open" && s.requested),
    },
    environmentActions: ["呼ぶ", "待つ"],
  };
}
