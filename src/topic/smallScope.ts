// Alloy の考え方（小さな範囲で、あり得る形を全部作って反例を探す）を、3人の「上司」の関係で再現する。

export const PEOPLE = ["A", "B", "C"] as const;
export type Person = (typeof PEOPLE)[number];

/** 各人の上司。null は上司なし。 */
export type BossInstance = Record<Person, Person | null>;

export interface BossOptions {
  /** 制約: 自分を自分の上司にしない。 */
  forbidSelf: boolean;
  /** 制約: 上司をたどって自分に戻る輪を作らない。 */
  forbidCycle: boolean;
}

export interface BossCheck {
  /** 制約を満たす形の数。 */
  total: number;
  /** 確かめたい性質「誰も自分の上司筋ではない」を破る形の数。 */
  counterexampleCount: number;
  firstCounterexample: BossInstance | null;
}

/** 上司をたどって自分に戻るか。3人なら3回たどれば十分。 */
export function isOwnAncestor(instance: BossInstance, person: Person): boolean {
  let cursor = instance[person];
  for (let i = 0; i < PEOPLE.length && cursor !== null; i += 1) {
    if (cursor === person) return true;
    cursor = instance[cursor];
  }
  return false;
}

function hasCycle(instance: BossInstance): boolean {
  return PEOPLE.some((person) => isOwnAncestor(instance, person));
}

function allInstances(): BossInstance[] {
  const choices: (Person | null)[] = [null, ...PEOPLE];
  const instances: BossInstance[] = [];
  for (const a of choices) {
    for (const b of choices) {
      for (const c of choices) instances.push({ A: a, B: b, C: c });
    }
  }
  return instances;
}

export function checkBossInstances(options: BossOptions): BossCheck {
  const instances = allInstances().filter((instance) => {
    const hasSelf = PEOPLE.some((person) => instance[person] === person);
    if (options.forbidSelf && hasSelf) return false;
    if (options.forbidCycle && hasCycle(instance)) return false;
    return true;
  });
  const counterexamples = instances.filter(hasCycle);
  return {
    total: instances.length,
    counterexampleCount: counterexamples.length,
    firstCounterexample: counterexamples[0] ?? null,
  };
}

export function describeBosses(instance: BossInstance): string {
  return PEOPLE.map((person) => `${person}→${instance[person] ?? "なし"}`).join("、");
}
