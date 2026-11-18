// CSP（プロセス代数）の小さな実装。FDR がやっていることの芯（状態遷移の展開・トレース詳細化・失敗詳細化・
// デッドロック・発散）を、レッスンの例が動く範囲で再現する。画面に出す結果は、すべてこのファイルの計算を埋め込む。
//
// 意味論は Roscoe の操作的意味論に沿う: τ は外から見えない動き、✓ は正しく終わった合図。
// 並行合成は同期集合のイベントだけ両方がそろって起き、両方が終わって初めて全体が終わる。

export const TAU = "τ";
export const TICK = "✓";

export type Proc =
  | { k: "stop" }
  | { k: "skip" }
  | { k: "omega" } // 終わった後の状態
  | { k: "prefix"; ev: string; next: Proc }
  | { k: "ext"; l: Proc; r: Proc } // 外部選択 □（環境が選ぶ）
  | { k: "int"; l: Proc; r: Proc } // 内部選択 ⊓（プロセスが勝手に選ぶ）
  | { k: "par"; l: Proc; sync: string[]; r: Proc } // 並行合成 [| sync |]
  | { k: "hide"; p: Proc; set: string[] } // 隠蔽 \ set
  | { k: "seq"; l: Proc; r: Proc } // 逐次合成 ;
  | { k: "ref"; name: string; args: (string | number)[] };

/** 名前付きのプロセスの定義。再帰はここを名前で引く。 */
export type Env = Record<string, (...args: never[]) => Proc>;

export const STOP: Proc = { k: "stop" };
export const SKIP: Proc = { k: "skip" };
const OMEGA: Proc = { k: "omega" };

export function pre(ev: string, next: Proc): Proc {
  return { k: "prefix", ev, next };
}
export function ext(...choices: Proc[]): Proc {
  return choices.reduce((l, r) => ({ k: "ext", l, r }));
}
export function int(...choices: Proc[]): Proc {
  return choices.reduce((l, r) => ({ k: "int", l, r }));
}
export function par(l: Proc, sync: string[], r: Proc): Proc {
  return { k: "par", l, sync: [...new Set(sync)].sort(), r };
}
export function interleave(...procs: Proc[]): Proc {
  return procs.reduce((l, r) => par(l, [], r));
}
export function hide(p: Proc, set: string[]): Proc {
  return { k: "hide", p, set: [...new Set(set)].sort() };
}
export function seq(l: Proc, r: Proc): Proc {
  return { k: "seq", l, r };
}
export function ref(name: string, ...args: (string | number)[]): Proc {
  return { k: "ref", name, args };
}

/** 状態を1つに数えるための鍵。名前付きのプロセスは展開せず名前と引数で書くので、再帰しても有限になる。 */
export function procKey(p: Proc): string {
  switch (p.k) {
    case "stop":
      return "STOP";
    case "skip":
      return "SKIP";
    case "omega":
      return "Ω";
    case "prefix":
      return `${p.ev}→${procKey(p.next)}`;
    case "ext":
      return `(${procKey(p.l)} □ ${procKey(p.r)})`;
    case "int":
      return `(${procKey(p.l)} ⊓ ${procKey(p.r)})`;
    case "par":
      return `(${procKey(p.l)} [|${p.sync.join(",")}|] ${procKey(p.r)})`;
    case "hide":
      return `(${procKey(p.p)} \\ {${p.set.join(",")}})`;
    case "seq":
      return `(${procKey(p.l)} ; ${procKey(p.r)})`;
    case "ref":
      return p.args.length > 0 ? `${p.name}(${p.args.join(",")})` : p.name;
  }
}

export interface Move {
  ev: string;
  to: Proc;
  /** この動きを作った遷移規則の名前（いちばん外側の演算子の規則。Roscoe の操作的意味論の呼び方に合わせる）。 */
  rule: string;
}

/** 組み込みの CHAOS(H): H のイベントをいつでも起こせるが、いつでも止まって全部を断ることもできる（Lazy 抽象化に使う）。 */
const CHAOS = "__CHAOS";

function chaos(events: string[]): Proc {
  const self = ref(CHAOS, events.join("|"));
  return int(STOP, ext(...events.map((ev) => pre(ev, self))));
}

function unfold(p: Extract<Proc, { k: "ref" }>, env: Env): Proc {
  if (p.name === CHAOS) return chaos(String(p.args[0]).split("|"));
  const definition = env[p.name];
  if (!definition) throw new Error(`定義の無いプロセス: ${p.name}`);
  return (definition as (...args: (string | number)[]) => Proc)(...p.args);
}

/** 1手で起きうる動き（操作的意味論）。 */
// 同じ状態の動きは、定義（env）が同じなら毎回同じなので、env ごとに覚えて使い回す。
// 詳細化の比較では同じ状態を何度もたどるので、使い回さないと匿名性の例の比較が数百ミリ秒かかった。
const movesCache = new WeakMap<Env, Map<string, Move[]>>();

export function moves(p: Proc, env: Env): Move[] {
  let cache = movesCache.get(env);
  if (!cache) {
    cache = new Map();
    movesCache.set(env, cache);
  }
  const key = procKey(p);
  const cached = cache.get(key);
  if (cached) return cached;
  const result = computeMoves(p, env);
  cache.set(key, result);
  return result;
}

function computeMoves(p: Proc, env: Env): Move[] {
  switch (p.k) {
    case "stop":
    case "omega":
      return [];
    case "skip":
      return [{ ev: TICK, to: OMEGA, rule: "Skip" }];
    case "prefix":
      return [{ ev: p.ev, to: p.next, rule: "Prefix" }];
    case "ext": {
      // τ は選択を決めない（もう片方も残す）。見えるイベントか ✓ で選択が決まる。
      const left = moves(p.l, env).map((m) =>
        m.ev === TAU
          ? { ev: TAU, to: ext(m.to, p.r), rule: "ExtChTau1" }
          : { ...m, rule: "ExtCh1" },
      );
      const right = moves(p.r, env).map((m) =>
        m.ev === TAU
          ? { ev: TAU, to: ext(p.l, m.to), rule: "ExtChTau2" }
          : { ...m, rule: "ExtCh2" },
      );
      return [...left, ...right];
    }
    case "int":
      return [
        { ev: TAU, to: p.l, rule: "IntCh1" },
        { ev: TAU, to: p.r, rule: "IntCh2" },
      ];
    case "par": {
      if (p.l.k === "omega" && p.r.k === "omega") {
        return [{ ev: TICK, to: OMEGA, rule: "ParTerm" }];
      }
      const sync = new Set(p.sync);
      const result: Move[] = [];
      const leftMoves = moves(p.l, env);
      const rightMoves = moves(p.r, env);
      for (const m of leftMoves) {
        if (m.ev === TICK) {
          result.push({ ev: TAU, to: par(OMEGA, p.sync, p.r), rule: "ParTick1" });
        } else if (!sync.has(m.ev)) {
          result.push({ ev: m.ev, to: par(m.to, p.sync, p.r), rule: "Par1" });
        }
      }
      for (const m of rightMoves) {
        if (m.ev === TICK) {
          result.push({ ev: TAU, to: par(p.l, p.sync, OMEGA), rule: "ParTick2" });
        } else if (!sync.has(m.ev)) {
          result.push({ ev: m.ev, to: par(p.l, p.sync, m.to), rule: "Par2" });
        }
      }
      for (const ml of leftMoves) {
        if (!sync.has(ml.ev)) continue;
        for (const mr of rightMoves) {
          if (mr.ev === ml.ev) {
            result.push({ ev: ml.ev, to: par(ml.to, p.sync, mr.to), rule: "ParSync" });
          }
        }
      }
      return result;
    }
    case "hide": {
      const hidden = new Set(p.set);
      return moves(p.p, env).map((m) => {
        if (m.ev === TICK) return { ev: TICK, to: OMEGA, rule: "HideTick" };
        return hidden.has(m.ev)
          ? { ev: TAU, to: hide(m.to, p.set), rule: "Hide1" }
          : { ev: m.ev, to: hide(m.to, p.set), rule: "Hide2" };
      });
    }
    case "seq":
      return moves(p.l, env).map((m) =>
        m.ev === TICK
          ? { ev: TAU, to: p.r, rule: "SeqTick" }
          : { ev: m.ev, to: seq(m.to, p.r), rule: "Seq" },
      );
    case "ref":
      return moves(unfold(p, env), env).map((m) => ({ ...m, rule: "PName" }));
  }
}

export interface Edge {
  from: string;
  to: string;
  ev: string;
}

export interface Lts {
  root: string;
  stateCount: number;
  transitionCount: number;
  states: Map<string, Proc>;
  edges: Edge[];
  /** 幅優先で最初にたどり着いたときの親と、そのときのイベント。最短の手順を組み立てるのに使う。 */
  parent: Map<string, { from: string; ev: string } | null>;
}

/** 到達できる状態を幅優先で全部たどる。 */
export function explore(root: Proc, env: Env): Lts {
  const rootKey = procKey(root);
  const states = new Map<string, Proc>([[rootKey, root]]);
  const parent = new Map<string, { from: string; ev: string } | null>([
    [rootKey, null],
  ]);
  const edges: Edge[] = [];
  const queue = [rootKey];
  for (let head = 0; head < queue.length; head += 1) {
    const key = queue[head]!;
    for (const m of moves(states.get(key)!, env)) {
      const toKey = procKey(m.to);
      edges.push({ from: key, to: toKey, ev: m.ev });
      if (states.has(toKey)) continue;
      states.set(toKey, m.to);
      parent.set(toKey, { from: key, ev: m.ev });
      queue.push(toKey);
    }
  }
  return {
    root: rootKey,
    stateCount: states.size,
    transitionCount: edges.length,
    states,
    edges,
    parent,
  };
}

/** 初期状態からその状態までの、見えるイベントだけの並び（τ は省く）。 */
export function visibleTraceTo(lts: Lts, key: string): string[] {
  const reversed: string[] = [];
  let cursor = lts.parent.get(key);
  while (cursor) {
    if (cursor.ev !== TAU) reversed.push(cursor.ev);
    cursor = lts.parent.get(cursor.from);
  }
  return reversed.reverse();
}

/** そのイベントが起きるまでの最短の手順（見えるイベントだけ）。起きないなら null。 */
export function traceTo(root: Proc, env: Env, ev: string): string[] | null {
  const lts = explore(root, env);
  // 幅優先で最初に見つけた状態ほど浅いので、edges の順に見れば最短になる。
  const edge = lts.edges.find((candidate) => candidate.ev === ev);
  return edge ? [...visibleTraceTo(lts, edge.from), ev] : null;
}

/** 正しく終わっていないのに、どの動きもできない状態（デッドロック）への手順。 */
export function deadlocks(root: Proc, env: Env): string[][] {
  const lts = explore(root, env);
  const busy = new Set(lts.edges.map((edge) => edge.from));
  return [...lts.states.keys()]
    .filter((key) => !busy.has(key) && lts.states.get(key)!.k !== "omega")
    .map((key) => visibleTraceTo(lts, key));
}

export interface Divergence {
  /** 発散に入るまでの見えるイベント。 */
  trace: string[];
  /** τ だけで回る輪の状態。 */
  cycle: string[];
}

/** 見えない動き（τ）だけで回り続けられる輪（発散、ライブロック）を探す。無ければ null。 */
export function divergence(root: Proc, env: Env): Divergence | null {
  const lts = explore(root, env);
  const tauNext = new Map<string, string[]>();
  for (const edge of lts.edges) {
    if (edge.ev !== TAU) continue;
    tauNext.set(edge.from, [...(tauNext.get(edge.from) ?? []), edge.to]);
  }
  const done = new Set<string>();
  for (const start of lts.states.keys()) {
    if (done.has(start)) continue;
    const path: string[] = [];
    const onPath = new Set<string>();
    const search = (key: string): string[] | null => {
      path.push(key);
      onPath.add(key);
      for (const next of tauNext.get(key) ?? []) {
        if (onPath.has(next)) return [...path.slice(path.indexOf(next)), next];
        if (done.has(next)) continue;
        const found = search(next);
        if (found) return found;
      }
      path.pop();
      onPath.delete(key);
      done.add(key);
      return null;
    };
    const cycle = search(start);
    if (cycle) return { trace: visibleTraceTo(lts, cycle[0]!), cycle };
  }
  return null;
}

// ---- 詳細化（仕様と実装の比較） ----

function initials(p: Proc, env: Env): Set<string> {
  return new Set(
    moves(p, env)
      .map((m) => m.ev)
      .filter((ev) => ev !== TAU),
  );
}

function isStable(p: Proc, env: Env): boolean {
  return moves(p, env).every((m) => m.ev !== TAU);
}

/** 仕様の状態の集まりを、τ で行ける状態まで広げる（仕様のどの状態にいるかは外から分からないため）。 */
function tauClosure(start: Proc[], env: Env): Map<string, Proc> {
  const closure = new Map(start.map((p) => [procKey(p), p]));
  const queue = [...closure.values()];
  while (queue.length > 0) {
    const p = queue.shift()!;
    for (const m of moves(p, env)) {
      if (m.ev !== TAU) continue;
      const key = procKey(m.to);
      if (closure.has(key)) continue;
      closure.set(key, m.to);
      queue.push(m.to);
    }
  }
  return closure;
}

function afterEvent(
  specStates: Map<string, Proc>,
  ev: string,
  env: Env,
): Map<string, Proc> {
  const next: Proc[] = [];
  for (const p of specStates.values()) {
    for (const m of moves(p, env)) if (m.ev === ev) next.push(m.to);
  }
  return tauClosure(next, env);
}

export interface Failure {
  trace: string[];
  /** 実装はこのイベントを全部拒否できるが、仕様では拒否できない。 */
  refusal: string[];
}

export interface RefinementResult<C> {
  holds: boolean;
  counterexample: C | null;
}

interface Pair {
  impl: Proc;
  spec: Map<string, Proc>;
  trace: string[];
}

/**
 * 実装と「仕様のどの状態にいうるか」の組を幅優先でたどる（FDR が仕様を正規化してから比べるのと同じ考え方）。
 * onPair が反例を返したらそこで止める。見えるイベントを仕様が受け付けなければトレースの反例。
 */
function walkPairs<C>(
  spec: Proc,
  impl: Proc,
  env: Env,
  onPair: (pair: Pair) => C | null,
  onTraceViolation: (trace: string[]) => C,
  shouldPrune: (pair: Pair) => boolean = () => false,
): RefinementResult<C> {
  const start: Pair = { impl, spec: tauClosure([spec], env), trace: [] };
  const seen = new Set<string>();
  // 「仕様のいまいうる状態の集まり」とイベントから次の集まりへの行き先を覚えておく。
  // 実装の状態が違っても仕様の集まりは同じになりやすく、τ 閉包の計算を繰り返すと遅いため。
  const nextSpec = new Map<string, Map<string, Proc>>();
  const specKeyOf = (specStates: Map<string, Proc>) =>
    [...specStates.keys()].sort().join("&");
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const pair = queue[head]!;
    const specKey = specKeyOf(pair.spec);
    const key = `${procKey(pair.impl)}|${specKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (shouldPrune(pair)) continue;
    const violation = onPair(pair);
    if (violation) return { holds: false, counterexample: violation };
    for (const m of moves(pair.impl, env)) {
      if (m.ev === TAU) {
        queue.push({ impl: m.to, spec: pair.spec, trace: pair.trace });
        continue;
      }
      const cacheKey = `${specKey}|${m.ev}`;
      let specNext = nextSpec.get(cacheKey);
      if (!specNext) {
        specNext = afterEvent(pair.spec, m.ev, env);
        nextSpec.set(cacheKey, specNext);
      }
      const trace = [...pair.trace, m.ev];
      if (specNext.size === 0)
        return { holds: false, counterexample: onTraceViolation(trace) };
      queue.push({ impl: m.to, spec: specNext, trace });
    }
  }
  return { holds: true, counterexample: null };
}

/** トレース詳細化 Spec ⊑T Impl: 実装のどのトレースも仕様のトレースか。反例は仕様に無い最短のトレース。 */
export function traceRefines(
  spec: Proc,
  impl: Proc,
  env: Env,
): RefinementResult<string[]> {
  return walkPairs(
    spec,
    impl,
    env,
    () => null,
    (trace) => trace,
  );
}

/** 安定した実装の状態で、仕様にない拒否ができるか。できるならその反例。 */
function stableFailureViolation(pair: Pair, env: Env): Failure | null {
  if (!isStable(pair.impl, env)) return null;
  const accepted = initials(pair.impl, env);
  const stableSpecInitials = [...pair.spec.values()]
    .filter((s) => isStable(s, env))
    .map((s) => initials(s, env));
  const specCanRefuse = stableSpecInitials.some((offered) =>
    [...offered].every((ev) => accepted.has(ev)),
  );
  if (specCanRefuse) return null;
  // 反例として見せるのは「仕様ならこの時点で必ず受け付けるのに、実装が拒否できるイベント」。
  const mustAccept = [...(stableSpecInitials[0] ?? [])].filter((ev) =>
    stableSpecInitials.every((offered) => offered.has(ev)),
  );
  return {
    trace: pair.trace,
    refusal: mustAccept.filter((ev) => !accepted.has(ev)).sort(),
  };
}

/**
 * 失敗詳細化 Spec ⊑F Impl（安定失敗モデル）: トレースに加え、実装が安定した状態で拒否できるイベントの集まりを、
 * 仕様もその時点で拒否できるか。反例は、そのトレースと、実装だけが拒否できるイベントの集まり。
 */
export function failuresRefines(
  spec: Proc,
  impl: Proc,
  env: Env,
): RefinementResult<Failure> {
  return walkPairs<Failure>(
    spec,
    impl,
    env,
    (pair) => stableFailureViolation(pair, env),
    (trace) => ({ trace, refusal: [] }),
  );
}

export interface TraceCheck {
  isAccepted: boolean;
  /** 先頭から何個のイベントまで、モデルが起こせたか。 */
  acceptedCount: number;
}

/** 記録したイベントの並び（実装のログなど）を、モデルが起こせるかを判定する。τ は何回挟んでもよい。 */
export function acceptsTrace(root: Proc, env: Env, trace: string[]): TraceCheck {
  let current = tauClosure([root], env);
  for (const [index, ev] of trace.entries()) {
    current = afterEvent(current, ev, env);
    if (current.size === 0) return { isAccepted: false, acceptedCount: index };
  }
  return { isAccepted: true, acceptedCount: trace.length };
}

/**
 * τ だけをたどって、τ の輪に入れるか（その状態から発散できるか）。
 * cache は1回の比較の中で使い回す（同じ状態を何度も調べると、組の数だけ深さ優先の探索が繰り返されて遅くなるため）。
 */
function canDiverge(start: Proc, env: Env, cache: Map<string, boolean>): boolean {
  const onPath = new Set<string>();
  const search = (p: Proc): boolean => {
    const key = procKey(p);
    const known = cache.get(key);
    if (known !== undefined) return known;
    if (onPath.has(key)) return true;
    onPath.add(key);
    let result = false;
    for (const m of moves(p, env)) {
      if (m.ev === TAU && search(m.to)) {
        result = true;
        break;
      }
    }
    onPath.delete(key);
    // 輪の途中で true が分かった状態も、輪に入れるので true として覚えてよい。
    cache.set(key, result);
    return result;
  };
  return search(start);
}

export type FdCounterexample =
  | { kind: "trace"; trace: string[] }
  | { kind: "divergence"; trace: string[] }
  | { kind: "failure"; trace: string[]; refusal: string[] };

/**
 * 失敗発散詳細化 Spec ⊑FD Impl: 失敗詳細化に加え、実装が発散できるトレースでは仕様も発散できること。
 * 仕様が発散した後は「何でもあり」（何をしても、何を拒否しても満たす）とみなし、その先は調べない（発散で厳密）。
 */
export function failuresDivergencesRefines(
  spec: Proc,
  impl: Proc,
  env: Env,
): RefinementResult<FdCounterexample> {
  const cache = new Map<string, boolean>();
  const specDiverges = (pair: Pair) =>
    [...pair.spec.values()].some((s) => canDiverge(s, env, cache));
  return walkPairs<FdCounterexample>(
    spec,
    impl,
    env,
    (pair) => {
      if (canDiverge(pair.impl, env, cache))
        return { kind: "divergence", trace: pair.trace };
      const failure = stableFailureViolation(pair, env);
      return failure ? { kind: "failure", ...failure } : null;
    },
    (trace) => ({ kind: "trace", trace }),
    specDiverges,
  );
}

export interface LawCheck {
  traces: boolean;
  failures: boolean;
  failuresDivergences: boolean;
}

/** 2つのプロセスが等しいか（詳細化を両向きに調べる）を、3つの比べ方それぞれで答える。 */
export function checkLaw(left: Proc, right: Proc, env: Env): LawCheck {
  const both = (refines: (a: Proc, b: Proc, e: Env) => { holds: boolean }) =>
    refines(left, right, env).holds && refines(right, left, env).holds;
  return {
    traces: both(traceRefines),
    failures: both(failuresRefines),
    failuresDivergences: both(failuresDivergencesRefines),
  };
}

/**
 * 最後まで動いた（もう何も起こせない）実行の、見えるイベントの並びを全部集める。
 * 同じ状態から先の並びは1回だけ計算して使い回す。輪のあるプロセスでは終わらないので、輪を見つけたら例外にする。
 */
export function completeTraces(root: Proc, env: Env): string[][] {
  const memo = new Map<string, string[][]>();
  const onPath = new Set<string>();
  const suffixes = (p: Proc): string[][] => {
    const key = procKey(p);
    const cached = memo.get(key);
    if (cached) return cached;
    if (onPath.has(key)) throw new Error("輪のあるプロセスには使えない");
    onPath.add(key);
    const next = moves(p, env);
    const found = new Map<string, string[]>();
    if (next.length === 0) found.set("", []);
    for (const m of next) {
      const isVisible = m.ev !== TAU && m.ev !== TICK;
      for (const rest of suffixes(m.to)) {
        const trace = isVisible ? [m.ev, ...rest] : rest;
        found.set(trace.join(","), trace);
      }
    }
    onPath.delete(key);
    const result = [...found.values()];
    memo.set(key, result);
    return result;
  };
  return suffixes(root);
}

export interface Determinism {
  isDeterministic: boolean;
  /** 非決定的なら、そのトレースの後に「起こせるのに断ることもある」イベント、または発散。 */
  witness:
    | { trace: string[]; event: string; kind: "refusal" }
    | { trace: string[]; kind: "divergence" }
    | null;
}

/**
 * 決定性（FDR の deterministic と同じ定義）: どのトレースの後でも、起こせるイベントを断ることがなく、発散もしない。
 * 実装を「いまいうる状態の集まり」でたどり、集まりの中で起こせるイベントを、安定した別の状態が断れたら非決定的。
 */
export function determinism(root: Proc, env: Env): Determinism {
  const cache = new Map<string, boolean>();
  const start = tauClosure([root], env);
  const seen = new Set<string>();
  const queue: { states: Map<string, Proc>; trace: string[] }[] = [
    { states: start, trace: [] },
  ];
  for (let head = 0; head < queue.length; head += 1) {
    const { states, trace } = queue[head]!;
    const key = [...states.keys()].sort().join("&");
    if (seen.has(key)) continue;
    seen.add(key);
    for (const state of states.values()) {
      if (canDiverge(state, env, cache))
        return { isDeterministic: false, witness: { trace, kind: "divergence" } };
    }
    const possible = [
      ...new Set([...states.values()].flatMap((state) => [...initials(state, env)])),
    ].sort();
    for (const event of possible) {
      const refuses = [...states.values()].some(
        (state) => isStable(state, env) && !initials(state, env).has(event),
      );
      if (refuses)
        return { isDeterministic: false, witness: { trace, event, kind: "refusal" } };
    }
    for (const event of possible) {
      if (event === TICK) continue;
      queue.push({ states: afterEvent(states, event, env), trace: [...trace, event] });
    }
  }
  return { isDeterministic: true, witness: null };
}

/**
 * Lazy 抽象化: 隠すイベント H を、環境が勝手に起こしたり止めたりできるもの（CHAOS(H)）と同期させてから隠す。
 * ただの隠蔽（Eager 抽象化）と違い、隠した動きが続いても「必ず続く」とはみなさない。安定失敗モデルで比べて使う。
 */
export function lazyAbstraction(p: Proc, hidden: string[]): Proc {
  return hide(par(p, hidden, chaos(hidden)), hidden);
}

export interface Starvation {
  /** 依頼してから、輪に入るまでの見えるイベント。 */
  trace: string[];
  /** 応答が来ないまま回り続ける輪の、見えるイベント。 */
  cycle: string[];
}

/**
 * 飢餓: request が起きてから response が起きるまでの間に、response を含まない輪で回り続けられるか。
 * 全体の状態と「いま依頼が未応答か」の組をたどり、未応答の組だけでできた輪を探す。公平性は仮定しない。
 */
export function starvation(
  root: Proc,
  env: Env,
  request: string,
  response: string,
): Starvation | null {
  interface Node {
    proc: Proc;
    isWaiting: boolean;
  }
  const keyOf = (node: Node) => `${node.isWaiting ? 1 : 0}|${procKey(node.proc)}`;
  const nodes = new Map<string, Node>();
  const parent = new Map<string, { from: string; ev: string } | null>();
  const edges = new Map<string, { to: string; ev: string }[]>();
  const start: Node = { proc: root, isWaiting: false };
  nodes.set(keyOf(start), start);
  parent.set(keyOf(start), null);
  const queue = [keyOf(start)];
  for (let head = 0; head < queue.length; head += 1) {
    const key = queue[head]!;
    const node = nodes.get(key)!;
    const out: { to: string; ev: string }[] = [];
    for (const m of moves(node.proc, env)) {
      const isWaiting =
        m.ev === request ? true : m.ev === response ? false : node.isWaiting;
      const next: Node = { proc: m.to, isWaiting };
      const nextKey = keyOf(next);
      out.push({ to: nextKey, ev: m.ev });
      if (!nodes.has(nextKey)) {
        nodes.set(nextKey, next);
        parent.set(nextKey, { from: key, ev: m.ev });
        queue.push(nextKey);
      }
    }
    edges.set(key, out);
  }
  const visibleTrace = (key: string) => {
    const reversed: string[] = [];
    let cursor = parent.get(key);
    while (cursor) {
      if (cursor.ev !== TAU) reversed.push(cursor.ev);
      cursor = parent.get(cursor.from);
    }
    return reversed.reverse();
  };
  // 未応答の状態だけをたどって輪を探す（response の辺は未応答から抜けるので、自然に輪に入らない）。
  const done = new Set<string>();
  for (const startKey of queue) {
    if (!nodes.get(startKey)!.isWaiting || done.has(startKey)) continue;
    const path: { key: string; ev: string }[] = [];
    const onPath = new Map<string, number>();
    const search = (key: string): Starvation | null => {
      onPath.set(key, path.length);
      for (const edge of edges.get(key) ?? []) {
        if (!nodes.get(edge.to)!.isWaiting) continue;
        const index = onPath.get(edge.to);
        if (index !== undefined) {
          const cycleEvents = [
            ...path.slice(index).map((step) => step.ev),
            edge.ev,
          ].filter((ev) => ev !== TAU);
          return { trace: visibleTrace(edge.to), cycle: cycleEvents };
        }
        if (done.has(edge.to)) continue;
        path.push({ key, ev: edge.ev });
        const found = search(edge.to);
        if (found) return found;
        path.pop();
      }
      onPath.delete(key);
      done.add(key);
      return null;
    };
    const found = search(startKey);
    if (found) return found;
  }
  return null;
}

/**
 * 見える振る舞いだけに正規化したときの状態数（FDR が仕様を比べる前に作る正規形の大きさ）。
 * 見えるイベントの並びが同じなら1つに数えるので、隠した動きや内部の選び方の違いは消える。
 */
export function normalizedStateCount(root: Proc, env: Env): number {
  const start = tauClosure([root], env);
  const keyOf = (states: Map<string, Proc>) => [...states.keys()].sort().join("&");
  const seen = new Set<string>([keyOf(start)]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const states = queue[head]!;
    const events = new Set(
      [...states.values()].flatMap((state) => [...initials(state, env)]),
    );
    for (const event of events) {
      const next = afterEvent(states, event, env);
      const key = keyOf(next);
      if (next.size === 0 || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen.size;
}
