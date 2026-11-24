// FDR が仕様を正規化してから実装と比べる手順（Roscoe TPC 11.4・付録 C.1 の範囲。例は自作の問い合わせ窓口）。
// 1段目（前正規形）: 同じトレースの後にいうる状態を1つの節点にまとめる。τ は節点の中に吸い込まれて消え、
//   各節点からは見えるイベントごとに行き先が1つだけになる（決定的なグラフ）。拒否の情報は、節点の中の安定な状態が
//   受け付けるイベントの集まり（最小の受け付け集合）として節点に残す。
// 2段目: 受け付け集合と行き先が同じ節点を、さらに1つにまとめる（強双模倣で割る）。
// 比べるときは、実装の状態と正規形の節点の組を幅優先でたどる。csp.ts の walkPairs が「仕様のいうる状態の集まり」を
// 持ち回るのは、この前正規形の節点をその場で作っているのと同じ。
// produces: NORMAL_ENV・NORMAL_SPEC・NORMAL_IMPLS・preNormalForm・normalForm・checkWithNormalForm
// consumes: csp.ts の演算子・moves・procKey。

import {
  type Env,
  type Failure,
  type Proc,
  ext,
  int,
  moves,
  pre,
  procKey,
  ref,
  TAU,
} from "./csp";

export const NORMAL_ENV: Env = {
  // 依頼 req を受けると、窓口が勝手に ok か busy かを決める（内部選択）。どちらでも、客は cancel で取り下げられる。
  SERVER: () =>
    pre(
      "req",
      ext(
        int(pre("ok", ref("SERVER")), pre("busy", ref("RETRY"))),
        pre("cancel", ref("SERVER")),
      ),
    ),
  // busy の後に戻る所。中身は SERVER と同じだが、別の名前で書いてある（2段目でまとまる）。
  RETRY: () =>
    pre(
      "req",
      ext(
        int(pre("ok", ref("SERVER")), pre("busy", ref("RETRY"))),
        pre("cancel", ref("SERVER")),
      ),
    ),
  // 必ず ok を返し、取り下げにも応じる。
  IMPL_GOOD: () =>
    pre("req", ext(pre("ok", ref("IMPL_GOOD")), pre("cancel", ref("IMPL_GOOD")))),
  // 依頼の前に ok を返してしまう。
  IMPL_EAGER: () => pre("ok", pre("req", ref("IMPL_EAGER"))),
  // ok は返すが、取り下げを受け付けない。
  IMPL_NOCANCEL: () => pre("req", pre("ok", ref("IMPL_NOCANCEL"))),
};

export const NORMAL_SPEC = ref("SERVER");

export const NORMAL_IMPLS = [
  { id: "good", proc: ref("IMPL_GOOD") },
  { id: "eager", proc: ref("IMPL_EAGER") },
  { id: "nocancel", proc: ref("IMPL_NOCANCEL") },
] as const;

export interface NormalNode {
  /** 節点にまとめた元の状態（procKey）。 */
  members: string[];
  /** 最小の受け付け集合: 安定な状態が受け付けるイベントの集まりのうち、ほかを含まないもの。 */
  acceptances: string[][];
  /** τ だけで回り続けられる状態を含むか（失敗発散モデルでは、ここから先を調べない）。 */
  isDivergent: boolean;
}

export interface NormalEdge {
  from: number;
  ev: string;
  to: number;
}

export interface NormalGraph {
  /** 0 番が初めの節点。 */
  nodes: NormalNode[];
  edges: NormalEdge[];
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

/** τ の辺だけをたどって輪に入れるか。 */
function canDivergeNow(p: Proc, env: Env): boolean {
  const onPath = new Set<string>();
  const done = new Set<string>();
  const search = (q: Proc): boolean => {
    const key = procKey(q);
    if (onPath.has(key)) return true;
    if (done.has(key)) return false;
    onPath.add(key);
    for (const m of moves(q, env)) if (m.ev === TAU && search(m.to)) return true;
    onPath.delete(key);
    done.add(key);
    return false;
  };
  return search(p);
}

function isSubset(small: string[], large: Set<string>): boolean {
  return small.every((ev) => large.has(ev));
}

function minimalAcceptances(states: Proc[], env: Env): string[][] {
  const offered = states
    .filter((state) => isStable(state, env))
    .map((state) => [...initials(state, env)].sort());
  const unique = [...new Map(offered.map((set) => [set.join(","), set])).values()];
  return unique
    .filter(
      (set) =>
        !unique.some(
          (other) => other.length < set.length && isSubset(other, new Set(set)),
        ),
    )
    .sort((a, b) => a.join(",").localeCompare(b.join(",")));
}

function sortedEvents(states: Iterable<Proc>, env: Env): string[] {
  return [...new Set([...states].flatMap((state) => [...initials(state, env)]))].sort();
}

/**
 * 1段目（前正規形）: 初めの状態の τ 閉包から始め、見えるイベントごとに「その後にいうる状態の τ 閉包」を次の節点にする。
 * 節点は元の状態の集合なので、最悪では元の状態数の指数だけ増える。
 */
export function preNormalForm(spec: Proc, env: Env): NormalGraph {
  const keyOf = (states: Map<string, Proc>) => [...states.keys()].sort().join("&");
  const start = tauClosure([spec], env);
  const index = new Map<string, number>([[keyOf(start), 0]]);
  const sets = [start];
  const edges: NormalEdge[] = [];
  for (let head = 0; head < sets.length; head += 1) {
    const states = sets[head]!;
    for (const ev of sortedEvents(states.values(), env)) {
      const targets = [...states.values()].flatMap((state) =>
        moves(state, env)
          .filter((m) => m.ev === ev)
          .map((m) => m.to),
      );
      const next = tauClosure(targets, env);
      const key = keyOf(next);
      if (!index.has(key)) {
        index.set(key, sets.length);
        sets.push(next);
      }
      edges.push({ from: head, ev, to: index.get(key)! });
    }
  }
  const nodes = sets.map((states) => ({
    members: [...states.keys()].sort(),
    acceptances: minimalAcceptances([...states.values()], env),
    isDivergent: [...states.values()].some((state) => canDivergeNow(state, env)),
  }));
  return { nodes, edges };
}

/**
 * 2段目: 受け付け集合・発散の有無・各イベントの行き先の組が同じ節点を、1つにまとめる（分割を細かくしていく強双模倣）。
 * まとめた節点の members は、まとめる前の節点の members を合わせたもの。
 */
export function normalForm(spec: Proc, env: Env): NormalGraph {
  const pre = preNormalForm(spec, env);
  const outgoing = pre.nodes.map((_, from) =>
    pre.edges.filter((edge) => edge.from === from),
  );
  // 分けた組を番号で持つ（文字列のまま入れ子にすると、回すたびに長くなるため）。
  const renumber = (keys: string[]) => {
    const ids = new Map<string, string>();
    return keys.map((key) => {
      if (!ids.has(key)) ids.set(key, String(ids.size));
      return ids.get(key)!;
    });
  };
  let classOf = renumber(
    pre.nodes.map((node) => `${JSON.stringify(node.acceptances)}|${node.isDivergent}`),
  );
  for (;;) {
    const refined = renumber(
      pre.nodes.map(
        (_, i) =>
          `${classOf[i]}|${outgoing[i]!.map((edge) => `${edge.ev}>${classOf[edge.to]}`).join(";")}`,
      ),
    );
    const isStableSplit = new Set(refined).size === new Set(classOf).size;
    classOf = refined;
    if (isStableSplit) break;
  }
  // 初めの節点を 0 番にし、出てきた順に番号を振る。
  const numberOf = new Map<string, number>();
  pre.nodes.forEach((_, i) => {
    if (!numberOf.has(classOf[i]!)) numberOf.set(classOf[i]!, numberOf.size);
  });
  const nodes: NormalNode[] = [...numberOf.keys()].map((cls) => {
    const group = pre.nodes.filter((_, i) => classOf[i] === cls);
    return {
      members: group.flatMap((node) => node.members).sort(),
      acceptances: group[0]!.acceptances,
      isDivergent: group[0]!.isDivergent,
    };
  });
  const edgeKeys = new Map<string, NormalEdge>();
  for (const edge of pre.edges) {
    const merged = {
      from: numberOf.get(classOf[edge.from]!)!,
      ev: edge.ev,
      to: numberOf.get(classOf[edge.to]!)!,
    };
    edgeKeys.set(`${merged.from}|${merged.ev}`, merged);
  }
  return { nodes, edges: [...edgeKeys.values()] };
}

export interface PairVisit {
  impl: string;
  node: number;
  trace: string[];
}

export type NormalCounterexample =
  { kind: "trace"; trace: string[] } | ({ kind: "failure" } & Failure);

export interface NormalCheck {
  holds: boolean;
  counterexample: NormalCounterexample | null;
  /** 調べた（実装の状態, 正規形の節点）の組。幅優先の順。 */
  pairs: PairVisit[];
}

/**
 * 正規形と実装の組を幅優先でたどる。実装が見えるイベントを起こしたら正規形の辺をたどり、辺が無ければトレースの反例。
 * model が failures なら、安定な実装の状態の受け付けるイベントが、節点のどの最小の受け付け集合も含まないとき失敗の反例。
 */
export function checkWithNormalForm(
  graph: NormalGraph,
  impl: Proc,
  env: Env,
  model: "traces" | "failures",
): NormalCheck {
  const next = new Map(graph.edges.map((edge) => [`${edge.from}|${edge.ev}`, edge.to]));
  const seen = new Set<string>();
  const pairs: PairVisit[] = [];
  const queue: { impl: Proc; node: number; trace: string[] }[] = [
    { impl, node: 0, trace: [] },
  ];
  const fail = (counterexample: NormalCounterexample): NormalCheck => ({
    holds: false,
    counterexample,
    pairs,
  });
  for (let head = 0; head < queue.length; head += 1) {
    const pair = queue[head]!;
    const implKey = procKey(pair.impl);
    const key = `${implKey}|${pair.node}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ impl: implKey, node: pair.node, trace: pair.trace });
    if (model === "failures" && isStable(pair.impl, env)) {
      const accepted = initials(pair.impl, env);
      const { acceptances } = graph.nodes[pair.node]!;
      if (!acceptances.some((set) => isSubset(set, accepted))) {
        const mustAccept = (acceptances[0] ?? []).filter((ev) =>
          acceptances.every((set) => set.includes(ev)),
        );
        return fail({
          kind: "failure",
          trace: pair.trace,
          refusal: mustAccept.filter((ev) => !accepted.has(ev)).sort(),
        });
      }
    }
    for (const m of moves(pair.impl, env)) {
      if (m.ev === TAU) {
        queue.push({ impl: m.to, node: pair.node, trace: pair.trace });
        continue;
      }
      const trace = [...pair.trace, m.ev];
      const to = next.get(`${pair.node}|${m.ev}`);
      if (to === undefined) return fail({ kind: "trace", trace });
      queue.push({ impl: m.to, node: to, trace });
    }
  }
  return { holds: true, counterexample: null, pairs };
}
