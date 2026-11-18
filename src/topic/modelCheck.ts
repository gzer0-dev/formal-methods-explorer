// 小さな明示的状態のモデル検査器。TLA+ の TLC と同じく、初期状態から幅優先で到達できる状態を全部たどる。
// 画面に出す状態数・反例・デッドロックは、すべてこの関数の結果を埋め込む（手書きしない）。

export interface Action<S> {
  name: string;
  enabled(state: S): boolean;
  next(state: S): S;
}

export interface Model<S> {
  init: S;
  actions: Action<S>[];
  /** 同じ状態を1つに数えるための鍵。 */
  key(state: S): string;
  /** いつでも成り立つべき性質（安全性）。省略すると常に成り立つ。 */
  invariant?(state: S): boolean;
  /** 正しく終わった状態。ここで動けなくなるのはデッドロックではない。省略すると「どこで止まってもデッドロック」。 */
  isFinal?(state: S): boolean;
}

/** 手順の1歩。先頭は初期状態で action は null。 */
export interface TraceStep<S> {
  action: string | null;
  state: S;
}

export interface CheckResult<S> {
  stateCount: number;
  transitionCount: number;
  /** 深さごとに初めて見つかった状態の数。levels[0] は初期状態の 1。 */
  levels: number[];
  /** 見つけた順の状態。 */
  order: S[];
  /** 不変条件を破る状態のうち最も浅いものへの手順。幅優先なので最短になる。 */
  violation: TraceStep<S>[] | null;
  violationCount: number;
  deadlock: TraceStep<S>[] | null;
}

interface Visit<S> {
  state: S;
  depth: number;
  parentKey: string | null;
  action: string | null;
}

function traceTo<S>(visits: Map<string, Visit<S>>, key: string): TraceStep<S>[] {
  const reversed: TraceStep<S>[] = [];
  let cursor: string | null = key;
  while (cursor !== null) {
    const visit: Visit<S> = visits.get(cursor)!;
    reversed.push({ action: visit.action, state: visit.state });
    cursor = visit.parentKey;
  }
  return reversed.reverse();
}

function enabledActions<S>(model: Model<S>, state: S): Action<S>[] {
  return model.actions.filter((action) => action.enabled(state));
}

export function check<S>(model: Model<S>): CheckResult<S> {
  const initKey = model.key(model.init);
  const visits = new Map<string, Visit<S>>([
    [initKey, { state: model.init, depth: 0, parentKey: null, action: null }],
  ]);
  const queue: string[] = [initKey];
  const levels: number[] = [1];
  const order: S[] = [];
  let transitionCount = 0;
  let violationKey: string | null = null;
  let violationCount = 0;
  let deadlockKey: string | null = null;

  for (let head = 0; head < queue.length; head += 1) {
    const key = queue[head]!;
    const visit = visits.get(key)!;
    order.push(visit.state);

    const isSafe = model.invariant?.(visit.state) ?? true;
    if (!isSafe) {
      violationCount += 1;
      violationKey ??= key;
    }

    const actions = enabledActions(model, visit.state);
    const isFinal = model.isFinal?.(visit.state) ?? false;
    if (actions.length === 0 && !isFinal) deadlockKey ??= key;

    for (const action of actions) {
      transitionCount += 1;
      const nextState = action.next(visit.state);
      const nextKey = model.key(nextState);
      if (visits.has(nextKey)) continue;
      const depth = visit.depth + 1;
      visits.set(nextKey, {
        state: nextState,
        depth,
        parentKey: key,
        action: action.name,
      });
      levels[depth] = (levels[depth] ?? 0) + 1;
      queue.push(nextKey);
    }
  }

  return {
    stateCount: visits.size,
    transitionCount,
    levels,
    order,
    violation: violationKey === null ? null : traceTo(visits, violationKey),
    violationCount,
    deadlock: deadlockKey === null ? null : traceTo(visits, deadlockKey),
  };
}

export interface ExecutionCount {
  total: number;
  good: number;
  bad: number;
}

/**
 * 初期状態から動けなくなるまでの実行（手順の並び）を全部数え、最後の状態で良し悪しを分ける。
 * 同じ状態に戻る輪があると無限になるので、輪の無いモデルにだけ使う。
 */
export function countExecutions<S>(
  model: Model<S>,
  isGood: (state: S) => boolean,
): ExecutionCount {
  const memo = new Map<string, ExecutionCount>();
  const visit = (state: S): ExecutionCount => {
    const key = model.key(state);
    const cached = memo.get(key);
    if (cached) return cached;
    const actions = enabledActions(model, state);
    let result: ExecutionCount;
    if (actions.length === 0) {
      result = isGood(state)
        ? { total: 1, good: 1, bad: 0 }
        : { total: 1, good: 0, bad: 1 };
    } else {
      result = { total: 0, good: 0, bad: 0 };
      for (const action of actions) {
        const sub = visit(action.next(state));
        result = {
          total: result.total + sub.total,
          good: result.good + sub.good,
          bad: result.bad + sub.bad,
        };
      }
    }
    memo.set(key, result);
    return result;
  };
  return visit(model.init);
}

export interface EventuallyResult<S> {
  holds: boolean;
  /** 目標を通らずに回り続ける実行。初期状態から輪の入口までと、輪を一周して入口に戻るまで。 */
  cycle: TraceStep<S>[] | null;
  /** 目標に着く前に動けなくなる実行。 */
  stuck: TraceStep<S>[] | null;
}

/**
 * 「いつか必ず goal に着く」（活性）を調べる。goal を通らない状態だけをたどり、
 * そこに輪か行き止まりがあれば、その実行が反例になる。公平性の仮定は置かない。
 */
export function checkEventually<S>(
  model: Model<S>,
  goal: (state: S) => boolean,
): EventuallyResult<S> {
  const holdsResult: EventuallyResult<S> = { holds: true, cycle: null, stuck: null };
  if (goal(model.init)) return holdsResult;

  // 深さ優先でたどり、いまの道（path）に同じ状態がまた出たら輪。
  const path: TraceStep<S>[] = [{ action: null, state: model.init }];
  const onPath = new Set<string>([model.key(model.init)]);
  const done = new Set<string>();

  const search = (): EventuallyResult<S> | null => {
    const current = path.at(-1)!.state;
    const actions = enabledActions(model, current);
    if (actions.length === 0) return { holds: false, cycle: null, stuck: [...path] };
    for (const action of actions) {
      const nextState = action.next(current);
      if (goal(nextState)) continue;
      const nextKey = model.key(nextState);
      if (onPath.has(nextKey)) {
        return {
          holds: false,
          cycle: [...path, { action: action.name, state: nextState }],
          stuck: null,
        };
      }
      if (done.has(nextKey)) continue;
      path.push({ action: action.name, state: nextState });
      onPath.add(nextKey);
      const found = search();
      if (found) return found;
      path.pop();
      onPath.delete(nextKey);
      done.add(nextKey);
    }
    return null;
  };

  return search() ?? holdsResult;
}
