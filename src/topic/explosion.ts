// 状態爆発の例: 食事する哲学者を、CSP を使わずに「各人の進み具合とフォークの持ち主」の組で素朴に書いたモデル。
// CSP のモデル（cspModels.ts）と状態数が一致することをテストで確かめ、そのうえで対称性による削減を数える。

import { type Action, check, type Model } from "./modelCheck";

export interface TableState {
  /** 各哲学者の進み具合。0=左を待つ 1=右を待つ 2=両方持って食べている 3=右を置き、左を持っている */
  pcs: number[];
  /** 各フォークの持ち主。null は空き */
  owners: (number | null)[];
}

function keyOf(state: TableState): string {
  return `${state.pcs.join("")}|${state.owners.map((o) => (o === null ? "-" : o)).join("")}`;
}

/** 全員が左（自分の番号のフォーク）から取る、対称なモデル。 */
export function philosopherTupleModel(n: number): Model<TableState> {
  const actions: Action<TableState>[] = [];
  for (let i = 0; i < n; i += 1) {
    const left = i;
    const right = (i + 1) % n;
    const set = (
      s: TableState,
      pc: number,
      fork: number,
      owner: number | null,
    ): TableState => ({
      pcs: s.pcs.map((v, k) => (k === i ? pc : v)),
      owners: s.owners.map((v, k) => (k === fork ? owner : v)),
    });
    actions.push(
      {
        name: `${i}が左を取る`,
        enabled: (s) => s.pcs[i] === 0 && s.owners[left] === null,
        next: (s) => set(s, 1, left, i),
      },
      {
        name: `${i}が右を取る`,
        enabled: (s) => s.pcs[i] === 1 && s.owners[right] === null,
        next: (s) => set(s, 2, right, i),
      },
      {
        name: `${i}が右を置く`,
        enabled: (s) => s.pcs[i] === 2,
        next: (s) => set(s, 3, right, null),
      },
      {
        name: `${i}が左を置く`,
        enabled: (s) => s.pcs[i] === 3,
        next: (s) => set(s, 0, left, null),
      },
    );
  }
  return {
    init: {
      pcs: Array.from({ length: n }, () => 0),
      owners: Array.from({ length: n }, () => null),
    },
    actions,
    key: keyOf,
  };
}

/** 全員を r 席ずつ回した配置。対称なモデルでは、回した配置も同じように振る舞う。 */
function rotate(state: TableState, r: number): TableState {
  const n = state.pcs.length;
  const pcs = Array.from({ length: n }, (_, i) => state.pcs[(i - r + n) % n]!);
  const owners = Array.from({ length: n }, (_, j) => {
    const owner = state.owners[(j - r + n) % n]!;
    return owner === null ? null : (owner + r) % n;
  });
  return { pcs, owners };
}

/** 回して同じになる配置を1つに数えたときの状態数（対称性による削減）。 */
export function symmetricStateCount(n: number): number {
  const canonical = new Set<string>();
  for (const state of check(philosopherTupleModel(n)).order) {
    const keys = Array.from({ length: n }, (_, r) => keyOf(rotate(state, r)));
    canonical.add(keys.sort()[0]!);
  }
  return canonical.size;
}
