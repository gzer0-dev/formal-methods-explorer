// パズルを検査器で解く（Roscoe TPC 15.1 の考え方。パズルは自作: 川渡りの型の変種）。
// 番人が舟で、猫・小鳥・金魚鉢・犬を向こう岸へ運ぶ。舟は重さの上限まで載せられ、番人が居ない岸で猫を他の誰かと残すと、猫がちょっかいを出す。
// 規則を部品のプロセスにし、「全員が向こう岸に着いた」ときだけ起きる solved を仕様で禁じると、検査器の反例がそのまま解き方になる。
// 検査器は幅優先なので、反例は最短の解き方になる。
// produces: ITEMS・PuzzleConfig・puzzleProcess・neverSolved・solvePuzzle・cargoesFor ／ consumes: csp.ts の演算子・explore・traceRefines。

import {
  type Env,
  type Proc,
  STOP,
  ext,
  explore,
  par,
  pre,
  ref,
  traceRefines,
} from "./csp";

/** 運ぶもの。重さは舟に載せられる量を決める。並びは猫が先（猫がちょっかいを出す相手は、この並びの後ろから数える）。 */
export const ITEMS = [
  { name: "cat", weight: 1 },
  { name: "bird", weight: 1 },
  { name: "fish", weight: 2 },
  { name: "dog", weight: 2 },
] as const;

export type ItemName = (typeof ITEMS)[number]["name"];

export interface PuzzleConfig {
  /** 舟に載せられる重さの上限（番人は数えない）。 */
  capacity: number;
  /** 猫がちょっかいを出す相手の数（bird・fish・dog の先頭から何匹か）。0 なら誰とも残してよい。 */
  catTargets: number;
}

export const PUZZLE_CONFIG: PuzzleConfig = { capacity: 2, catTargets: 3 };

const choice = (choices: Proc[]): Proc =>
  choices.length === 0 ? STOP : ext(...choices);

/** 舟に載せられる組み合わせ。空（番人だけで漕ぐ）も含む。名前は "alone" か、載せるものを _ でつないだもの。 */
export function cargoesFor(capacity: number): string[] {
  const result: string[] = [];
  const count = ITEMS.length;
  for (let mask = 0; mask < 1 << count; mask += 1) {
    const chosen = ITEMS.filter((_, index) => (mask >> index) & 1);
    const weight = chosen.reduce((sum, item) => sum + item.weight, 0);
    if (weight > capacity) continue;
    result.push(
      chosen.length === 0 ? "alone" : chosen.map((item) => item.name).join("_"),
    );
  }
  return result;
}

const cargoItems = (cargo: string): string[] =>
  cargo === "alone" ? [] : cargo.split("_");

/** 渡しのイベント。こちら岸（L）から向こう岸（R）は over、戻りは back。 */
const trip = (side: string, cargo: string) =>
  `${side === "L" ? "over" : "back"}.${cargo}`;
const flip = (side: string) => (side === "L" ? "R" : "L");

export const PUZZLE_ENV: Env = {
  // 番人: いる岸から、載せられる組み合わせのどれかで漕ぐ。向こう岸にいれば solved にも加わる。
  KEEPER: (side: string, capacity: number) => {
    const trips = cargoesFor(capacity).map((cargo) =>
      pre(trip(side, cargo), ref("KEEPER", flip(side), capacity)),
    );
    return choice(side === "R" ? [...trips, pre("solved", STOP)] : trips);
  },
  // 運ぶもの: 自分のいる岸から出る渡しで、自分を載せたものにだけ加わる（番人と同じ岸にいないと乗れない）。
  ITEM: (name: string, side: string, capacity: number) => {
    const trips = cargoesFor(capacity)
      .filter((cargo) => cargoItems(cargo).includes(name))
      .map((cargo) => pre(trip(side, cargo), ref("ITEM", name, flip(side), capacity)));
    return choice(side === "R" ? [...trips, pre("solved", STOP)] : trips);
  },
  // 規則: 番人・a・b のいる岸を覚え、番人の居ない岸に a と b を残す渡しを断る。
  RULE: (
    a: string,
    b: string,
    keeper: string,
    at: string,
    bt: string,
    capacity: number,
  ) =>
    choice(
      cargoesFor(capacity).flatMap((cargo) => {
        const items = cargoItems(cargo);
        const nextKeeper = flip(keeper);
        const nextA = items.includes(a) ? nextKeeper : at;
        const nextB = items.includes(b) ? nextKeeper : bt;
        if (nextA === nextB && nextA !== nextKeeper) return [];
        return [
          pre(
            trip(keeper, cargo),
            ref("RULE", a, b, nextKeeper, nextA, nextB, capacity),
          ),
        ];
      }),
    ),
  // 仕様: どの渡しをしてもよいが、solved だけは決して起きない。
  NEVER_SOLVED: (capacity: number) =>
    choice(
      cargoesFor(capacity).flatMap((cargo) =>
        ["L", "R"].map((side) => pre(trip(side, cargo), ref("NEVER_SOLVED", capacity))),
      ),
    ),
};

/** 猫と、ちょっかいを出す相手の組（規則の部品になる）。 */
export function rulePairs(config: PuzzleConfig): [ItemName, ItemName][] {
  return ITEMS.slice(1, 1 + config.catTargets).map((item) => ["cat", item.name]);
}

/** 渡しのイベントを全部。 */
function allTrips(capacity: number): string[] {
  return cargoesFor(capacity).flatMap((cargo) => [trip("L", cargo), trip("R", cargo)]);
}

/**
 * 部品（番人・運ぶもの・規則）を、アルファベットの重なりで同期させて並べた全体。
 * アルファベットは展開して集めず、決めて書く。重すぎて舟に載らないものは渡しのイベントを1つも起こせないが、
 * solved には必ず加わらないといけない（展開して集めると solved が抜け、置き去りのまま solved が起きた）。
 */
export function puzzleProcess(config: PuzzleConfig): Proc {
  const trips = allTrips(config.capacity);
  const parts: { proc: Proc; alphabet: string[] }[] = [
    { proc: ref("KEEPER", "L", config.capacity), alphabet: [...trips, "solved"] },
    ...ITEMS.map((item) => ({
      proc: ref("ITEM", item.name, "L", config.capacity),
      alphabet: [
        ...trips.filter((ev) => cargoItems(ev.split(".")[1]!).includes(item.name)),
        "solved",
      ],
    })),
    ...rulePairs(config).map(([a, b]) => ({
      proc: ref("RULE", a, b, "L", "L", "L", config.capacity),
      alphabet: trips,
    })),
  ];
  const [first, ...rest] = parts;
  let whole = first!.proc;
  const seen = new Set(first!.alphabet);
  for (const part of rest) {
    whole = par(
      whole,
      part.alphabet.filter((ev) => seen.has(ev)),
      part.proc,
    );
    for (const ev of part.alphabet) seen.add(ev);
  }
  return whole;
}

export function neverSolved(config: PuzzleConfig): Proc {
  return ref("NEVER_SOLVED", config.capacity);
}

export interface PuzzleResult {
  /** 仕様「solved は起きない」の反例＝最短の解き方（最後が solved）。解けなければ null。 */
  solution: string[] | null;
  /** パズル全体の状態の数。 */
  stateCount: number;
}

export function solvePuzzle(config: PuzzleConfig): PuzzleResult {
  const puzzle = puzzleProcess(config);
  const result = traceRefines(neverSolved(config), puzzle, PUZZLE_ENV);
  return {
    solution: result.counterexample,
    stateCount: explore(puzzle, PUZZLE_ENV).stateCount,
  };
}

export interface BankState {
  /** この渡しのイベント。 */
  trip: string;
  /** 渡った後に番人がいる岸。 */
  keeper: "L" | "R";
  /** 渡った後のこちら岸と向こう岸にいるもの（ITEMS の並び順）。 */
  left: ItemName[];
  right: ItemName[];
}

/** 解き方（solved を除く渡しの並び）をなぞり、渡しごとの岸の様子を返す。図のカードに出す。 */
export function replaySolution(solution: string[]): BankState[] {
  const sides = new Map<ItemName, "L" | "R">(ITEMS.map((item) => [item.name, "L"]));
  let keeper: "L" | "R" = "L";
  const result: BankState[] = [];
  for (const event of solution) {
    if (event === "solved") break;
    keeper = keeper === "L" ? "R" : "L";
    for (const name of cargoItems(event.split(".")[1]!))
      sides.set(name as ItemName, keeper);
    result.push({
      trip: event,
      keeper,
      left: ITEMS.filter((item) => sides.get(item.name) === "L").map(
        (item) => item.name,
      ),
      right: ITEMS.filter((item) => sides.get(item.name) === "R").map(
        (item) => item.name,
      ),
    });
  }
  return result;
}
