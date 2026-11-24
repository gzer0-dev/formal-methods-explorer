import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import {
  type BankState,
  cargoesFor,
  ITEMS,
  PUZZLE_CONFIG,
  replaySolution,
  rulePairs,
  solvePuzzle,
} from "../cspPuzzle";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

// 図で解く設定と、比べる2つの設定（舟が小さい・猫がおとなしい）。計算はここで1回だけ。
const RESULT = solvePuzzle(PUZZLE_CONFIG);
const SOLUTION = RESULT.solution ?? [];
const BANKS = replaySolution(SOLUTION);
const TRIPS = BANKS.length;
const CARGOES = cargoesFor(PUZZLE_CONFIG.capacity);
const RULES = rulePairs(PUZZLE_CONFIG);
const SMALL_BOAT = solvePuzzle({ ...PUZZLE_CONFIG, capacity: 1 });
const CALM_CAT = solvePuzzle({ ...PUZZLE_CONFIG, catTargets: 0 });
const CALM_TRIPS = CALM_CAT.solution ? CALM_CAT.solution.length - 1 : 0;
const SOLVED_EVENT = SOLUTION.at(-1) ?? "solved";

// 9回の渡しを3回ずつ3つのステップに分けて見せる。
const GROUP_SIZE = 3;
const GROUPS = Array.from({ length: Math.ceil(TRIPS / GROUP_SIZE) }, (_, index) =>
  BANKS.slice(index * GROUP_SIZE, (index + 1) * GROUP_SIZE),
);

const itemList = (names: readonly string[], none: string) =>
  names.length === 0 ? none : names.join(", ");

function parseCount(text: string | undefined, fallback: number, max: number): number {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, 0), max);
}

export function cspPuzzleLesson(language: Language): Lesson {
  const t = translator(language);
  const none = t("なし", "none");
  const rowItems = t("いるもの", "items");
  const rowKeeper = t("番人", "keeper");
  const here = t("いる", "here");
  const away = t("いない", "away");
  const bankRows = (bank: BankState, side: "L" | "R") => ({
    [rowItems]: itemList(side === "L" ? bank.left : bank.right, none),
    [rowKeeper]: bank.keeper === side ? here : away,
  });
  const tripsText = (count: number) => t(`${count}回`, `${count} crossings`);

  const tripSteps = GROUPS.map((group, index) => {
    const first = index * GROUP_SIZE + 1;
    const last = first + group.length - 1;
    const end = group.at(-1)!;
    const isLast = index === GROUPS.length - 1;
    const rows: Record<string, string | null> = {};
    group.forEach((bank, offset) => {
      rows[`${first + offset}`] = bank.trip;
    });
    // 前のステップの行を消す（カードは4行まで）。
    for (let earlier = 1; earlier < first; earlier += 1) rows[`${earlier}`] = null;
    return {
      id: `trips-${first}`,
      kind: "run" as const,
      title: isLast
        ? t("最後に solved", "Finally, solved")
        : t(`${first}〜${last}回目の渡し`, `Crossings ${first} to ${last}`),
      actor: "boat",
      to: ["left", "right"],
      summary: t(
        `${group.map((bank) => bank.trip).join("、")}${isLast ? `、そして ${SOLVED_EVENT}` : ""}`,
        `${group.map((bank) => bank.trip).join(", ")}${isLast ? `, then ${SOLVED_EVENT}` : ""}`,
      ),
      explain: isLast
        ? t(
            `最後に全員が向こう岸にそろい、番人と4つの荷物がそろって ${SOLVED_EVENT} を起こす。ここで仕様が受け付けないイベントが起きたので、検査器はこの並びを反例として返した。`,
            `In the end everyone is on the far bank, and the keeper and all four items together perform ${SOLVED_EVENT}. The spec does not accept that event, so the checker returned this sequence as its counterexample.`,
          )
        : index === 0
          ? t(
              "猫は誰とも残せないので、まず猫を運ぶ。番人が戻るときは何も載せず（alone）、こちら岸には猫のいない組だけが残る。",
              "The cat cannot be left with anyone, so it goes first. The keeper comes back with nothing (alone), leaving only cat-free company on the near bank.",
            )
          : t(
              "向こう岸に猫と誰かを残せないので、猫を一度こちら岸へ連れ戻す。猫と小鳥は合わせて重さ2なので、一緒に運べる。",
              "The cat cannot be left with anyone on the far bank either, so it is taken back to the near bank for a while. The cat and the bird weigh 2 together, so they can travel together.",
            ),
      set: {
        boat: { tone: "ok" as const, rows },
        left: { rows: bankRows(end, "L") },
        right: { tone: isLast ? ("ok" as const) : undefined, rows: bankRows(end, "R") },
        ...(isLast
          ? {
              checker: {
                tone: "bad" as const,
                rows: {
                  [t("結果", "result")]: t(
                    `${SOLVED_EVENT} が起きた`,
                    `${SOLVED_EVENT} happened`,
                  ),
                },
              },
            }
          : {}),
      },
    };
  });

  return {
    id: "csp-puzzle",
    category: "apply",
    title: t("パズルを検査器で解く", "Solving a puzzle with a checker"),
    subtitle: t(
      "「解けた」を仕様で禁じると、反例が解き方になる",
      "Forbid “solved” in the spec, and the counterexample is the solution",
    ),
    summary: t(
      `番人が舟で猫・小鳥・金魚鉢・犬を運ぶ川渡りのパズルを CSP で書き、「solved は起きない」という仕様と比べる。検査器の反例は${tripsText(TRIPS)}の渡しと ${SOLVED_EVENT} で、幅優先で探すのでこれが最短の解き方になる。舟が重さ1までなら解けず、猫が誰にもちょっかいを出さなければ${tripsText(CALM_TRIPS)}で済む。`,
      `A river-crossing puzzle in which a keeper ferries a cat, a bird, a goldfish bowl and a dog is written in CSP and compared with the spec “solved never happens”. The checker's counterexample is ${tripsText(TRIPS)} followed by ${SOLVED_EVENT}; because the search is breadth-first, this is the shortest solution. With a boat that carries only weight 1 there is no solution, and if the cat bothers no one it takes ${tripsText(CALM_TRIPS)}.`,
    ),
    intro: [
      t(
        "検査器は、仕様を破る実行が無いかを全部の状態について探す。この性質を逆に使うと、パズルが解ける。パズルの決まりをプロセスで書き、「解けた」ときだけ起きるイベントを用意して、仕様で「そのイベントは決して起きない」と言い切る。仕様が破れたら、その反例が解き方そのものになる。",
        "A checker searches every state for a run that breaks the spec. Turned around, this solves puzzles. Write the puzzle's rules as processes, add an event that happens only when the puzzle is solved, and state in the spec that this event never happens. If the spec fails, its counterexample is the solution itself.",
      ),
      t(
        "人が手で解くと、行き止まりを見落としたり、もっと短い手順に気づかなかったりする。検査器は状態を幅優先でたどるので、見つかった反例は手数が最も少ない。解けないパズルなら、仕様が成り立つことが「どう動かしても解けない」という証明になる。テストで何通りか試しても、こうは言えない。",
        "Solving by hand, you can miss a dead end or overlook a shorter route. The checker explores states breadth-first, so the counterexample it finds has the fewest moves. If the puzzle has no solution, the spec holding is a proof that no sequence of moves solves it, which trying a handful of cases in a test could never show.",
      ),
      t(
        "図では、上の段の「こちら岸」と「向こう岸」のカードで、誰がどちらにいるかを追う。真ん中の舟のカードに、検査器が返した渡しを3回ずつ並べる。下の段の規則と検査器のカードで、何が禁じられ、何が見つかったかを見る。",
        "In the diagram, follow who is where on the near-bank and far-bank cards in the top row. The boat card in the middle lists the crossings the checker returned, three at a time. The rule and checker cards in the bottom row show what is forbidden and what was found.",
      ),
    ],
    facts: [
      {
        label: t("最短の解き方", "Shortest solution"),
        value: t(
          `${tripsText(TRIPS)}の渡しと ${SOLVED_EVENT}（全体${RESULT.stateCount}状態）`,
          `${tripsText(TRIPS)} and ${SOLVED_EVENT} (${RESULT.stateCount} states in all)`,
        ),
        tone: RESULT.solution ? "ok" : "bad",
      },
      {
        label: t("舟が重さ1まで", "Boat carries weight 1"),
        value: SMALL_BOAT.solution
          ? t(
              `${tripsText(SMALL_BOAT.solution.length - 1)}で解ける`,
              `solved in ${tripsText(SMALL_BOAT.solution.length - 1)}`,
            )
          : t("解けない（仕様が成り立つ）", "no solution (the spec holds)"),
      },
      {
        label: t("猫がおとなしい", "Calm cat"),
        value: t(
          `${tripsText(CALM_TRIPS)}で解ける`,
          `solved in ${tripsText(CALM_TRIPS)}`,
        ),
      },
      {
        label: t("参考", "Reference"),
        value: t(
          `${TPC_BOOK} 15.1節（組み合わせの問題: 規則と戦術）`,
          `${TPC_BOOK_EN}, §15.1 (combinatorial systems: rules and tactics)`,
        ),
      },
    ],
    actors: [
      {
        id: "left",
        label: t("こちら岸", "Near bank"),
        sublabel: t("出発する岸", "start"),
        icon: "state",
        x: 20,
        y: 27,
      },
      {
        id: "boat",
        label: t("舟", "Boat"),
        sublabel: t(
          `重さ${PUZZLE_CONFIG.capacity}まで`,
          `up to weight ${PUZZLE_CONFIG.capacity}`,
        ),
        icon: "route",
        x: 50,
        y: 27,
      },
      {
        id: "right",
        label: t("向こう岸", "Far bank"),
        sublabel: t("着く岸", "goal"),
        icon: "state",
        x: 80,
        y: 27,
      },
      {
        id: "rules",
        label: t("規則", "Rules"),
        sublabel: t("番人の居ない岸", "bank without keeper"),
        icon: "contract",
        x: 30,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("幅優先で探す", "breadth-first"),
        icon: "checker",
        x: 70,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "left", to: "boat" },
      { from: "boat", to: "right" },
      { from: "rules", to: "boat" },
      { from: "checker", to: "rules" },
    ],
    steps: [
      {
        id: "setup",
        kind: "spec",
        title: t("岸と舟と荷物", "Banks, boat and cargo"),
        actor: "left",
        to: ["boat"],
        summary: t(
          `番人が猫（cat）・小鳥（bird）・金魚鉢（fish）・犬（dog）を向こう岸へ運ぶ。舟は重さ${PUZZLE_CONFIG.capacity}まで`,
          `The keeper ferries a cat, a bird, a goldfish bowl (fish) and a dog to the far bank. The boat carries up to weight ${PUZZLE_CONFIG.capacity}`,
        ),
        explain: t(
          `重さは${ITEMS.map((item) => `${item.name}が${item.weight}`).join("、")}。番人だけが舟を漕げる。載せ方は${CARGOES.length}通り（${CARGOES.join("・")}）で、行きは over、帰りは back のイベントにした。どの荷物も、番人と同じ岸にいるときしか乗れない。`,
          `The weights are ${ITEMS.map((item) => `${item.name} ${item.weight}`).join(", ")}. Only the keeper can row. There are ${CARGOES.length} ways to load the boat (${CARGOES.join(", ")}); a crossing out is an over event and a crossing back is a back event. An item can board only when it is on the same bank as the keeper.`,
        ),
        set: {
          left: {
            rows: {
              [rowItems]: itemList(
                ITEMS.map((item) => item.name),
                none,
              ),
              [rowKeeper]: here,
            },
          },
          boat: {
            rows: {
              [t("載せ方", "loads")]: t(
                `${CARGOES.length}通り`,
                String(CARGOES.length),
              ),
            },
          },
          right: { rows: { [rowItems]: none, [rowKeeper]: away } },
        },
      },
      {
        id: "rules",
        kind: "spec",
        title: t("規則を部品にする", "Rules as processes"),
        actor: "rules",
        to: ["boat"],
        summary: t(
          `番人の居ない岸に猫を残すと、${RULES.map(([, other]) => other).join("・")}にちょっかいを出す。組ごとに、それを禁じるプロセスを並べる`,
          `Left on a bank without the keeper, the cat bothers the ${RULES.map(([, other]) => other).join(", ")}. A process for each pair forbids it`,
        ),
        explain: t(
          `規則のプロセスは、番人と猫と相手のいる岸を覚え、渡った後に猫と相手が番人の居ない岸に残る渡しには加わらない。渡しのイベントは全部の部品で同期させるので、規則が1つでも断れば、その渡しは起きない。${RULES.length}つの規則を足すだけで、決まりを1か所にまとめて書かずに済む。`,
          `Each rule process remembers which bank the keeper, the cat and the other item are on, and refuses to join any crossing that would leave the cat and that item together without the keeper. Crossing events are synchronised across every component, so if a single rule refuses, the crossing cannot happen. Adding ${RULES.length} rules is enough; the constraints never have to be written in one place.`,
        ),
        set: {
          rules: {
            isHidden: false,
            rows: Object.fromEntries(
              RULES.map(([cat, other], index) => [
                t(`規則${index + 1}`, `rule ${index + 1}`),
                `${cat} + ${other}`,
              ]),
            ),
          },
        },
      },
      {
        id: "spec",
        kind: "spec",
        title: t("solved を仕様で禁じる", "Forbid solved in the spec"),
        actor: "checker",
        to: ["rules"],
        summary: t(
          `全員が向こう岸にそろったときだけ ${SOLVED_EVENT} が起きる。仕様は「渡しは何をしてもよいが ${SOLVED_EVENT} は起きない」`,
          `${SOLVED_EVENT} happens only when everyone is on the far bank. The spec says “any crossing may happen, but ${SOLVED_EVENT} never does”`,
        ),
        explain: t(
          `${SOLVED_EVENT} は番人と4つの荷物が全員で同期するイベントで、どれも向こう岸にいるときしか出さない。この仕様にトレース詳細化（⊑T）で比べると、仕様に無いトレースは ${SOLVED_EVENT} を含むものだけになる。`,
          `${SOLVED_EVENT} is an event the keeper and all four items synchronise on, and each offers it only when on the far bank. Compared with this spec by trace refinement (⊑T), the only traces the spec lacks are those containing ${SOLVED_EVENT}.`,
        ),
        set: {
          checker: {
            isHidden: false,
            rows: {
              [t("仕様", "spec")]: t(
                `${SOLVED_EVENT} は起きない`,
                `${SOLVED_EVENT} never happens`,
              ),
              [t("比べ方", "check")]: "⊑T",
            },
          },
        },
      },
      {
        id: "found",
        kind: "found",
        title: t("反例が解き方になる", "The counterexample solves it"),
        actor: "checker",
        to: ["rules", "boat"],
        summary: t(
          `仕様は破れ、反例は${tripsText(TRIPS)}の渡しの後の ${SOLVED_EVENT}。全体で${RESULT.stateCount}状態をたどった`,
          `The spec fails; the counterexample is ${SOLVED_EVENT} after ${tripsText(TRIPS)}. The search visited ${RESULT.stateCount} states in all`,
        ),
        explain: t(
          `検査器は、初めの状態から近い順に（幅優先で）状態をたどり、仕様が受け付けないイベントに最初に出会った所で止まる。だから反例の渡しは、どの解き方よりも少ない。ここから3つのステップで、その手順を頭からなぞる。`,
          `The checker explores states nearest the start first (breadth-first) and stops at the first event the spec does not accept, so no solution uses fewer crossings than this counterexample. The next three steps replay it from the beginning.`,
        ),
        set: {
          checker: {
            tone: "bad",
            rows: {
              [t("結果", "result")]: t("仕様が破れた", "spec fails"),
              [t("反例の長さ", "length")]: t(
                `${tripsText(TRIPS)}＋${SOLVED_EVENT}`,
                `${tripsText(TRIPS)} + ${SOLVED_EVENT}`,
              ),
            },
          },
        },
      },
      ...tripSteps,
      {
        id: "compare",
        kind: "explore",
        title: t("条件を変えて比べる", "Change the conditions"),
        actor: "checker",
        to: ["boat", "rules"],
        summary: t(
          `舟が重さ1までなら${SMALL_BOAT.solution ? "解ける" : "解けず、仕様が成り立つ"}。猫がおとなしければ${tripsText(CALM_TRIPS)}で済む`,
          `With a boat for weight 1 ${SMALL_BOAT.solution ? "it is solvable" : "there is no solution and the spec holds"}. With a calm cat it takes ${tripsText(CALM_TRIPS)}`,
        ),
        explain: t(
          `重さ1の舟には金魚鉢も犬も載らないので、どう動かしても ${SOLVED_EVENT} は起きず、仕様が成り立つ。これが「解けない」ことの証明になる。規則を外すと、猫と小鳥を一緒に運ぶなどして${tripsText(CALM_TRIPS)}で済むので、${tripsText(TRIPS - CALM_TRIPS)}ぶんは規則を守るための回り道だと分かる。`,
          `A boat for weight 1 cannot carry the goldfish bowl or the dog, so ${SOLVED_EVENT} never happens however you move, and the spec holds. That is a proof that the puzzle cannot be solved. Without the rules it takes only ${tripsText(CALM_TRIPS)}, for example by carrying the cat and the bird together, so ${tripsText(TRIPS - CALM_TRIPS)} of the route are detours forced by the rules.`,
        ),
        set: {
          checker: {
            tone: "idle",
            rows: {
              [t("重さ1の舟", "weight-1 boat")]: SMALL_BOAT.solution
                ? tripsText(SMALL_BOAT.solution.length - 1)
                : t("解けない", "no solution"),
              [t("規則なし", "no rules")]: tripsText(CALM_TRIPS),
              [t("結果", "result")]: null,
              [t("反例の長さ", "length")]: null,
            },
          },
        },
        simplified: t(
          `パズルは川渡りの型を自分で作り替えたもの。検査器の反例は、同じ手数の解き方が複数あれば、そのうちの1つだけを返す。ProB にも同じモデルを書いて照合したが、ProB の反例は最短とは限らず、11回の渡しの解き方を返した。最短が${TRIPS}回であることは、ProB でも「${TRIPS}回渡るまで solved は起きない」という仕様との比較で確かめた。`,
          `The puzzle is a home-made variation on the river-crossing type. When several solutions share the same number of moves, the checker returns only one of them. The same model was written for ProB as a cross-check; ProB's counterexample is not always the shortest and it returned an 11-crossing solution. That ${TRIPS} is the shortest was confirmed in ProB too, by comparing with a spec in which solved cannot happen before ${TRIPS} crossings.`,
        ),
      },
    ],
    lab: {
      title: t("舟の大きさと猫の気性を変える", "Change the boat and the cat"),
      hint: t(
        "舟に載せられる重さ（0〜4）と、猫がちょっかいを出す相手の数（0〜3。bird・fish・dog の順に数える）を入れる。検査器の反例（最短の解き方）か、解けないことが出る。",
        "Enter the weight the boat can carry (0 to 4) and how many others the cat bothers (0 to 3, counted in the order bird, fish, dog). The result is either the checker's counterexample (the shortest solution) or a proof that there is none.",
      ),
      inputs: [
        {
          id: "capacity",
          label: t("舟の重さ", "Boat weight"),
          initial: String(PUZZLE_CONFIG.capacity),
        },
        {
          id: "targets",
          label: t("猫の相手の数", "Cat's targets"),
          initial: String(PUZZLE_CONFIG.catTargets),
        },
      ],
      compute: (values): Field[] => {
        const capacity = parseCount(values.capacity, PUZZLE_CONFIG.capacity, 4);
        const catTargets = parseCount(values.targets, PUZZLE_CONFIG.catTargets, 3);
        const result = solvePuzzle({ capacity, catTargets });
        const fields: Field[] = [
          {
            label: t("仕様「solved は起きない」", "Spec “solved never happens”"),
            value: result.solution
              ? t("破れた（解ける）", "fails (solvable)")
              : t("成り立つ（解けない）", "holds (no solution)"),
            tone: result.solution ? "ok" : "bad",
          },
          {
            label: t("状態数", "States"),
            value: String(result.stateCount),
          },
        ];
        if (result.solution) {
          fields.push({
            label: t("最短の解き方", "Shortest solution"),
            value: t(
              `${tripsText(result.solution.length - 1)}: ${result.solution.join(", ")}`,
              `${tripsText(result.solution.length - 1)}: ${result.solution.join(", ")}`,
            ),
          });
        }
        return fields;
      },
    },
  };
}
