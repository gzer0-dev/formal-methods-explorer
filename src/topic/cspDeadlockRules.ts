// デッドロックを規則で避ける（Roscoe TPC 13.1・13.2・13.5 の範囲。例は自作: 仕事がファイルを借りて使う）。
// ネットワークを部品（プロセス）の並びとして持ち、全体の検査（全状態をたどる）と、隣り合う2つだけを並べた局所の判定を並べて見せる。
// produces: NETWORKS・findDeadlock・composeNetwork ／ consumes: csp.ts の演算子と moves・explore。

import {
  type Env,
  type Proc,
  STOP,
  TAU,
  TICK,
  ext,
  explore,
  moves,
  par,
  pre,
  ref,
} from "./csp";

/** ネットワークの部品の1つ。role は資源の順序の規則で「ファイル」と「仕事」を見分けるのに使う。 */
export interface Component {
  name: string;
  role: "job" | "file" | "keeper";
  proc: Proc;
}

export interface Network {
  id: string;
  components: Component[];
}

/** ファイルの順序。資源の順序の規則では、仕事はこの順にしか取らない。 */
export const FILE_ORDER = ["X", "Y", "Z"] as const;

const choice = (choices: Proc[]): Proc =>
  choices.length === 0 ? STOP : ext(...choices);

// 仕事の動き。mode は "plain"・"ticket"（入る前に入場券を取り、出たら返す）・"note:<ファイル>"（使い終えてから通知を読む）。
export const DEADLOCK_ENV: Env = {
  JOB: (name: string, first: string, second: string, mode: string) => {
    const again = ref("JOB", name, first, second, mode);
    const noteFrom = mode.startsWith("note:") ? mode.slice("note:".length) : "";
    const tail = noteFrom === "" ? again : pre(`note.${noteFrom}.${name}`, again);
    const work = pre(
      `take.${name}.${first}`,
      pre(
        `take.${name}.${second}`,
        pre(
          `use.${name}`,
          pre(
            `drop.${name}.${second}`,
            pre(
              `drop.${name}.${first}`,
              mode === "ticket" ? pre(`leave.${name}`, tail) : tail,
            ),
          ),
        ),
      ),
    );
    return mode === "ticket" ? pre(`enter.${name}`, work) : work;
  },
  // 使う仕事の誰か1人に貸し、返されるまで他に貸さない。
  FILE: (name: string, users: string) =>
    choice(
      users
        .split(",")
        .map((user) =>
          pre(
            `take.${user}.${name}`,
            pre(`drop.${user}.${name}`, ref("FILE", name, users)),
          ),
        ),
    ),
  // 貸す前に、決まった相手へ変更の通知を届けようとするファイル（相手が通知を読むのは使い終えた後）。
  NOTIFY_FILE: (name: string, users: string, target: string) =>
    pre(
      `note.${name}.${target}`,
      choice(
        users
          .split(",")
          .map((user) =>
            pre(
              `take.${user}.${name}`,
              pre(`drop.${user}.${name}`, ref("NOTIFY_FILE", name, users, target)),
            ),
          ),
      ),
    ),
  // 入場券を total 枚持ち、いま中にいる仕事（inside）を覚える。中にいない仕事にだけ入場券を渡し、中にいる仕事からだけ返してもらう。
  // 誰が中にいるかを覚えないと、係と仕事の2つだけを並べたときに「中にいない仕事に返却を求める」状態ができ、局所の判定が衝突と見誤る。
  KEEPER: (inside: string, total: number, jobs: string) => {
    const names = jobs.split(",");
    const members = inside === "" ? [] : inside.split(",");
    const choices: Proc[] = [];
    for (const name of names) {
      if (members.includes(name)) {
        const rest = members.filter((member) => member !== name).join(",");
        choices.push(pre(`leave.${name}`, ref("KEEPER", rest, total, jobs)));
      } else if (members.length < total) {
        const more = names
          .filter((other) => other === name || members.includes(other))
          .join(",");
        choices.push(pre(`enter.${name}`, ref("KEEPER", more, total, jobs)));
      }
    }
    return choice(choices);
  },
};

const job = (
  name: string,
  first: string,
  second: string,
  mode = "plain",
): Component => ({
  name,
  role: "job",
  proc: ref("JOB", name, first, second, mode),
});
const file = (name: string, users: string[]): Component => ({
  name,
  role: "file",
  proc: ref("FILE", name, users.join(",")),
});

/** レッスンで比べるネットワーク。どれも自作の例。 */
export const NETWORKS = {
  // 木: X–A–Y–B–Z の一本道。B は Z を先に取る。
  tree: {
    id: "tree",
    components: [
      job("A", "X", "Y"),
      job("B", "Z", "Y"),
      file("X", ["A"]),
      file("Y", ["A", "B"]),
      file("Z", ["B"]),
    ],
  },
  // 木のままで、Y が「貸す前に A へ通知を届ける」ファイルになった。A は使い終えてから通知を読む。
  treeNotify: {
    id: "treeNotify",
    components: [
      job("A", "X", "Y", "note:Y"),
      job("B", "Z", "Y"),
      file("X", ["A"]),
      { name: "Y", role: "file", proc: ref("NOTIFY_FILE", "Y", "A,B", "A") },
      file("Z", ["B"]),
    ],
  },
  // 輪: A は X→Y、B は Y→Z、C は Z→X の順に取る。
  ring: ringNetwork(false, 0),
  // 輪のまま、C も X→Z の順（ファイルの順序どおり）に取る。
  ringOrdered: ringNetwork(true, 0),
  // 輪の取り方（C は Z→X）のまま、入場券を2枚だけ配る係を足す。
  ringTickets: ticketNetwork(2),
} satisfies Record<string, Network>;

/** 輪の取り方のまま、入場券を tickets 枚配る係を足したネットワーク。 */
export function ticketNetwork(tickets: number): Network {
  return ringNetwork(false, tickets);
}

/**
 * 3つの仕事と3つのファイルの輪。isOrdered なら C も X→Z（ファイルの順序どおり）、でなければ Z→X の順に取る。
 * tickets が 1 以上なら、入場券をその枚数だけ配る係を足し、仕事は入場券を取ってからファイルを取る。
 */
export function ringNetwork(isOrdered: boolean, tickets: number): Network {
  const mode = tickets > 0 ? "ticket" : "plain";
  const components: Component[] = [
    job("A", "X", "Y", mode),
    job("B", "Y", "Z", mode),
    isOrdered ? job("C", "X", "Z", mode) : job("C", "Z", "X", mode),
    file("X", ["A", "C"]),
    file("Y", ["A", "B"]),
    file("Z", ["B", "C"]),
  ];
  if (tickets > 0)
    components.push({
      name: "K",
      role: "keeper",
      proc: ref("KEEPER", "", tickets, "A,B,C"),
    });
  const id = `ring${isOrdered ? "Ordered" : ""}${tickets > 0 ? `Tickets${tickets}` : ""}`;
  return { id, components };
}

/** 部品を1つ外したネットワーク（部分ネットワーク）。 */
export function withoutComponent(network: Network, name: string): Network {
  return {
    id: `${network.id}-${name}`,
    components: network.components.filter((component) => component.name !== name),
  };
}

const alphabetCache = new Map<string, Set<string>>();

/** 部品が起こしうる見えるイベントの集まり（その部品だけを展開して集める）。 */
export function alphabetOf(component: Component): Set<string> {
  const key = JSON.stringify(component.proc);
  const cached = alphabetCache.get(key);
  if (cached) return cached;
  const events = new Set(
    explore(component.proc, DEADLOCK_ENV)
      .edges.map((edge) => edge.ev)
      .filter((ev) => ev !== TAU && ev !== TICK),
  );
  alphabetCache.set(key, events);
  return events;
}

/** csp.ts の並行合成でつないだ全体（アルファベットの重なりで同期させる）。全体の検査を csp.ts の deadlocks と突き合わせるのに使う。 */
export function composeNetwork(network: Network): Proc {
  const [first, ...rest] = network.components;
  let whole = first!.proc;
  const seen = new Set(alphabetOf(first!));
  for (const component of rest) {
    const alphabet = alphabetOf(component);
    whole = par(
      whole,
      [...alphabet].filter((ev) => seen.has(ev)),
      component.proc,
    );
    for (const ev of alphabet) seen.add(ev);
  }
  return whole;
}

export interface NetworkDeadlock {
  /** デッドロックまでの最短の手順。 */
  trace: string[];
  /** デッドロックした時点の、部品ごとの状態。 */
  states: Proc[];
}

/** 部品の状態の組から1手で行ける先。イベントは、そのイベントをアルファベットに持つ部品が全員そろって起こす。 */
function networkSteps(network: Network, states: Proc[]): { ev: string; to: Proc[] }[] {
  const alphabets = network.components.map(alphabetOf);
  const movesOf = states.map((state) => moves(state, DEADLOCK_ENV));
  const result: { ev: string; to: Proc[] }[] = [];
  movesOf.forEach((list, index) => {
    for (const move of list) {
      if (move.ev !== TAU) continue;
      const to = [...states];
      to[index] = move.to;
      result.push({ ev: TAU, to });
    }
  });
  const events = new Set(movesOf.flat().map((move) => move.ev));
  for (const ev of events) {
    if (ev === TAU || ev === TICK) continue;
    const participants = alphabets.flatMap((alphabet, index) =>
      alphabet.has(ev) ? [index] : [],
    );
    let combos: Proc[][] = [[...states]];
    for (const index of participants) {
      const next = movesOf[index]!.filter((move) => move.ev === ev);
      combos = combos.flatMap((combo) =>
        next.map((move) => {
          const to = [...combo];
          to[index] = move.to;
          return to;
        }),
      );
    }
    for (const to of combos) result.push({ ev, to });
  }
  return result;
}

const stateKey = (states: Proc[]) =>
  states.map((state) => JSON.stringify(state)).join("|");

/** 全体の状態を幅優先でたどった状態の数（デッドロックが見つかっても止めずに全部数える）。 */
export function networkStateCount(network: Network): number {
  const start = network.components.map((component) => component.proc);
  const seen = new Set([stateKey(start)]);
  const queue: Proc[][] = [start];
  for (let head = 0; head < queue.length; head += 1) {
    for (const step of networkSteps(network, queue[head]!)) {
      const toKey = stateKey(step.to);
      if (seen.has(toKey)) continue;
      seen.add(toKey);
      queue.push(step.to);
    }
  }
  return seen.size;
}

/** 全体の状態を幅優先でたどり、どの部品も動けない状態（デッドロック）を探す。最初に見つかったものが最短。 */
export function findDeadlock(network: Network): NetworkDeadlock | null {
  const start = network.components.map((component) => component.proc);
  const parent = new Map<string, { from: string; ev: string } | null>([
    [stateKey(start), null],
  ]);
  const queue: Proc[][] = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const states = queue[head]!;
    const key = stateKey(states);
    const steps = networkSteps(network, states);
    if (steps.length === 0) {
      const trace: string[] = [];
      let cursor = parent.get(key);
      while (cursor) {
        if (cursor.ev !== TAU) trace.unshift(cursor.ev);
        cursor = parent.get(cursor.from);
      }
      return { trace, states };
    }
    for (const step of steps) {
      const toKey = stateKey(step.to);
      if (parent.has(toKey)) continue;
      parent.set(toKey, { from: key, ev: step.ev });
      queue.push(step.to);
    }
  }
  return null;
}

/** 2つ以上の部品のアルファベットに入っているイベント（ネットワークの語彙）。これ以外のイベントは誰にも止められない。 */
export function vocabularyOf(network: Network): Set<string> {
  const counts = new Map<string, number>();
  for (const component of network.components)
    for (const ev of alphabetOf(component)) counts.set(ev, (counts.get(ev) ?? 0) + 1);
  return new Set([...counts].filter(([, count]) => count >= 2).map(([ev]) => ev));
}

function offersOf(state: Proc): Set<string> | null {
  const list = moves(state, DEADLOCK_ENV);
  // τ で動ける状態は安定していないので、待っているとは言わない。
  if (list.some((move) => move.ev === TAU)) return null;
  return new Set(list.map((move) => move.ev));
}

/**
 * from から to への「受け付けられない依頼」（TPC 13.1 の ungranted request）があるか。
 * 2つとも語彙の外のイベント（使う・τ）を起こせず、from が to と共有するイベントを出しているのに、2つが合意できるイベントが無い。
 */
export function hasUngrantedRequest(
  from: Proc,
  to: Proc,
  shared: Set<string>,
  vocabulary: Set<string>,
): boolean {
  const fromOffers = offersOf(from);
  const toOffers = offersOf(to);
  if (!fromOffers || !toOffers) return false;
  const insideVocabulary = (offers: Set<string>) =>
    [...offers].every((ev) => vocabulary.has(ev));
  if (!insideVocabulary(fromOffers) || !insideVocabulary(toOffers)) return false;
  const requests = [...fromOffers].filter((ev) => shared.has(ev));
  if (requests.length === 0) return false;
  return ![...shared].some((ev) => fromOffers.has(ev) && toOffers.has(ev));
}

export interface PairVerdict {
  /** 通信の図の辺の両端（部品の名前）。 */
  ends: [string, string];
  /** 互いに相手への受け付けられない依頼を持つ状態がある（衝突）。 */
  hasConflict: boolean;
  /** 衝突し、しかも片方は相手にしか依頼を出していない（強い衝突。木でもデッドロックしうる）。 */
  hasStrongConflict: boolean;
  /** 衝突が起きる状態までの、2つだけを並べたときの最短の手順。衝突が無ければ null。 */
  conflictTrace: string[] | null;
  /** 2つだけを並べてたどった状態の数。 */
  stateCount: number;
}

/** 隣り合う2つだけを、共有するイベントで同期させて並べ、全部の状態で衝突を調べる。他の部品とのイベントは自由に起こせる（全体より広く調べるので、衝突が無ければ全体でも無い）。 */
function judgePair(network: Network, left: Component, right: Component): PairVerdict {
  const vocabulary = vocabularyOf(network);
  const leftAlphabet = alphabetOf(left);
  const shared = new Set([...alphabetOf(right)].filter((ev) => leftAlphabet.has(ev)));
  const pairNetwork: Network = {
    id: `${left.name}-${right.name}`,
    components: [left, right],
  };
  const start = [left.proc, right.proc];
  const parent = new Map<string, { from: string; ev: string } | null>([
    [stateKey(start), null],
  ]);
  const queue: Proc[][] = [start];
  let conflict: { key: string; isStrong: boolean } | null = null;
  let strongFound = false;
  for (let head = 0; head < queue.length; head += 1) {
    const [l, r] = queue[head] as [Proc, Proc];
    const key = stateKey([l, r]);
    if (
      hasUngrantedRequest(l, r, shared, vocabulary) &&
      hasUngrantedRequest(r, l, shared, vocabulary)
    ) {
      const onlyToOther = (state: Proc) =>
        [...(offersOf(state) ?? [])].every((ev) => shared.has(ev));
      const isStrong = onlyToOther(l) || onlyToOther(r);
      if (!conflict || (isStrong && !conflict.isStrong)) conflict = { key, isStrong };
      strongFound ||= isStrong;
    }
    for (const step of networkSteps(pairNetwork, [l, r])) {
      const toKey = stateKey(step.to);
      if (parent.has(toKey)) continue;
      parent.set(toKey, { from: key, ev: step.ev });
      queue.push(step.to);
    }
  }
  return {
    ends: [left.name, right.name],
    hasConflict: conflict !== null,
    hasStrongConflict: strongFound,
    conflictTrace: conflict ? traceFrom(parent, conflict.key) : null,
    stateCount: parent.size,
  };
}

function traceFrom(
  parent: Map<string, { from: string; ev: string } | null>,
  key: string,
): string[] {
  const trace: string[] = [];
  let cursor = parent.get(key);
  while (cursor) {
    if (cursor.ev !== TAU) trace.unshift(cursor.ev);
    cursor = parent.get(cursor.from);
  }
  return trace;
}

/** 通信の図の辺（アルファベットが重なる部品の組）。 */
export function communicationEdges(network: Network): [Component, Component][] {
  const edges: [Component, Component][] = [];
  network.components.forEach((left, index) => {
    const leftAlphabet = alphabetOf(left);
    for (const right of network.components.slice(index + 1))
      if ([...alphabetOf(right)].some((ev) => leftAlphabet.has(ev)))
        edges.push([left, right]);
  });
  return edges;
}

/** つながっていて、辺の数が部品の数より1少なければ木（輪が無い）。 */
function isTreeGraph(network: Network, edges: [Component, Component][]): boolean {
  const names = network.components.map((component) => component.name);
  if (edges.length !== names.length - 1) return false;
  const reached = new Set([names[0]!]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [left, right] of edges) {
      if (reached.has(left.name) !== reached.has(right.name)) {
        reached.add(left.name);
        reached.add(right.name);
        grew = true;
      }
    }
  }
  return reached.size === names.length;
}

/** その仕事が、ファイルを持ったまま、順序で前のファイルを取りに行くことがあるか（仕事1つだけを展開して調べる）。 */
function takesOutOfOrder(component: Component): boolean {
  const rank = (name: string) =>
    FILE_ORDER.indexOf(name as (typeof FILE_ORDER)[number]);
  const seen = new Set<string>();
  const queue: { state: Proc; held: string[] }[] = [
    { state: component.proc, held: [] },
  ];
  for (let head = 0; head < queue.length; head += 1) {
    const { state, held } = queue[head]!;
    const key = `${JSON.stringify(state)}|${held.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const move of moves(state, DEADLOCK_ENV)) {
      const [action, , fileName] = move.ev.split(".");
      let next = held;
      if (action === "take" && fileName) {
        if (held.some((name) => rank(name) > rank(fileName))) return true;
        next = [...held, fileName];
      } else if (action === "drop" && fileName) {
        next = held.filter((name) => name !== fileName);
      }
      queue.push({ state: move.to, held: next });
    }
  }
  return false;
}

/** その部品だけを動かしても止まる状態が無いか（TPC の「いつでも何かできる」前提）。 */
function isBusy(component: Component): boolean {
  const lts = explore(component.proc, DEADLOCK_ENV);
  const busy = new Set(lts.edges.map((edge) => edge.from));
  return [...lts.states.keys()].every((key) => busy.has(key));
}

export interface LocalAnalysis {
  pairs: PairVerdict[];
  /** 部品がどれも、単独では止まらない。 */
  isEveryComponentBusy: boolean;
  isTree: boolean;
  /** ファイルの順序を破って取る仕事の名前。 */
  outOfOrderJobs: string[];
  /** 局所の判定だけで「デッドロックしない」と言えた規則。言えなければ null（デッドロックするとは限らない）。 */
  provedBy: "tree" | "order" | null;
}

/**
 * 局所の判定。木の規則（TPC 13.1 の規則1）: 通信の図が木で、強い衝突の組が無ければデッドロックしない。
 * 資源の順序の規則（13.2.3）: 仕事とファイルだけのネットワークで、衝突の組が無く、どの仕事もファイルの順序どおりに取るならデッドロックしない。
 */
export function localAnalysis(network: Network): LocalAnalysis {
  const edges = communicationEdges(network);
  const pairs = edges.map(([left, right]) => judgePair(network, left, right));
  const isEveryComponentBusy = network.components.every(isBusy);
  const isTree = isTreeGraph(network, edges);
  const outOfOrderJobs = network.components
    .filter((component) => component.role === "job" && takesOutOfOrder(component))
    .map((component) => component.name);
  const onlyJobsAndFiles = network.components.every(
    (component) => component.role !== "keeper",
  );
  let provedBy: LocalAnalysis["provedBy"] = null;
  if (isEveryComponentBusy && isTree && pairs.every((pair) => !pair.hasStrongConflict))
    provedBy = "tree";
  else if (
    isEveryComponentBusy &&
    onlyJobsAndFiles &&
    outOfOrderJobs.length === 0 &&
    pairs.every((pair) => !pair.hasConflict)
  )
    provedBy = "order";
  return { pairs, isEveryComponentBusy, isTree, outOfOrderJobs, provedBy };
}

/** デッドロックした状態で、受け付けられない依頼を出している向き（from → to）の一覧。 */
export function ungrantedRequestsAt(
  network: Network,
  states: Proc[],
): [string, string][] {
  const vocabulary = vocabularyOf(network);
  const index = new Map(network.components.map((component, i) => [component.name, i]));
  const result: [string, string][] = [];
  for (const [left, right] of communicationEdges(network)) {
    const leftAlphabet = alphabetOf(left);
    const shared = new Set([...alphabetOf(right)].filter((ev) => leftAlphabet.has(ev)));
    const l = states[index.get(left.name)!]!;
    const r = states[index.get(right.name)!]!;
    if (hasUngrantedRequest(l, r, shared, vocabulary))
      result.push([left.name, right.name]);
    if (hasUngrantedRequest(r, l, shared, vocabulary))
      result.push([right.name, left.name]);
  }
  return result;
}
