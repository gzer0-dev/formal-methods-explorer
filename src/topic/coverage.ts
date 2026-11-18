// 状態遷移のモデルから、全部の遷移を1回は通るテストの手順を作る（モデルベーステストの最小形）。

export interface Transition<S extends string> {
  name: string;
  from: S;
  to: S;
}

/** 初期状態から target までの最短の操作列。幅優先。着けなければ null。 */
export function shortestPath<S extends string>(
  transitions: Transition<S>[],
  initial: S,
  target: S,
): string[] | null {
  const paths = new Map<S, string[]>([[initial, []]]);
  const queue: S[] = [initial];
  for (let head = 0; head < queue.length; head += 1) {
    const state = queue[head]!;
    if (state === target) return paths.get(state)!;
    for (const transition of transitions) {
      if (transition.from !== state || paths.has(transition.to)) continue;
      paths.set(transition.to, [...paths.get(state)!, transition.name]);
      queue.push(transition.to);
    }
  }
  return null;
}

function isPrefixOf(short: string[], long: string[]): boolean {
  return short.length < long.length && short.every((name, i) => long[i] === name);
}

/**
 * 遷移ごとに「そこへ行く最短の道 + その遷移」を作り、別の道の先頭部分に含まれる道は捨てる。
 * 着けない遷移は道を作れないので含めない。
 */
export function coverTransitions<S extends string>(
  transitions: Transition<S>[],
  initial: S,
): string[][] {
  const paths: string[][] = [];
  for (const transition of transitions) {
    const prefix = shortestPath(transitions, initial, transition.from);
    if (prefix) paths.push([...prefix, transition.name]);
  }
  return paths.filter(
    (path, i) =>
      !paths.some((other) => isPrefixOf(path, other)) &&
      paths.findIndex((other) => other.join() === path.join()) === i,
  );
}
