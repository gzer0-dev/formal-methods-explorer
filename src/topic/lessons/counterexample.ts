import { translator, type Language } from "../../core/i18n";
import type { Actor, Field, Lesson, Step } from "../../core/types";
import { describeCounterIn, displayName, displayNames } from "../labels";
import { check } from "../modelCheck";
import { counterModel, runSchedule, type CounterState } from "../models";

const RESULT = check(counterModel(2, false));
// 反例の手順。TRACE[0] は初期状態、TRACE[i] は i 手目の後の状態。
const TRACE = RESULT.violation!;
const MOVE_COUNT = TRACE.length - 1;
const ACTIONS = TRACE.slice(1).map((step) => step.action!);
const REPLAY = runSchedule(ACTIONS, false);
// 幅優先なので、反例の手数は不変条件を破る状態が最初に現れる深さと同じ。
const SHALLOWER_STATE_COUNT = RESULT.levels
  .slice(0, MOVE_COUNT)
  .reduce((sum, n) => sum + n, 0);

/** describeCounterIn の「A:読む前 B:手元=0 count=0」をカードの行に分ける。 */
function counterRows(state: CounterState, language: Language): Record<string, string> {
  return Object.fromEntries(
    describeCounterIn(state, language)
      .split(" ")
      .map((part) => {
        const separator = part.includes(":") ? ":" : "=";
        const [name, ...rest] = part.split(separator);
        return [name!, rest.join(separator)];
      }),
  );
}

function stateId(index: number): string {
  return `s${index}`;
}

function stepsText(count: number): string {
  return `${count} ${count === 1 ? "step" : "steps"}`;
}

// 上の段に初期状態から3手目まで、違反した状態は右下に置く（右下から左へ親をたどる）。
const POSITIONS: [number, number][] = [
  [14, 27],
  [38, 27],
  [62, 27],
  [86, 27],
  [86, 73],
];

function parseCount(text: string | undefined): number {
  const value = Number.parseInt(text ?? "", 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 4) : 2;
}

export function counterexampleLesson(language: Language): Lesson {
  const t = translator(language);
  const describe = (state: CounterState) => describeCounterIn(state, language);
  const rowsOf = (state: CounterState) => counterRows(state, language);
  const name = (action: string) => displayName(action, language);
  const steps = (count: number) => t(`${count}手`, stepsText(count));
  const initialState = t("初期状態", "Initial state");

  const stateActors: Actor[] = TRACE.map((_, index) => {
    const [x, y] = POSITIONS[index]!;
    const isLast = index === MOVE_COUNT;
    return {
      id: stateId(index),
      label: index === 0 ? initialState : t(`${index}手目の後`, `After step ${index}`),
      sublabel: isLast ? t("不変条件を破る", "breaks the invariant") : undefined,
      icon: "state",
      x,
      y,
      initial: { isHidden: true },
    };
  });

  /** 違反した状態から1つ親へ戻るステップ。 */
  function backStep(index: number): Step {
    const child = TRACE[index]!;
    const parent = TRACE[index - 1]!;
    const isRoot = index - 1 === 0;
    const action = name(child.action!);
    return {
      id: `back-${index}`,
      kind: "found",
      title: isRoot
        ? t("初期状態へ戻る", "Back to the initial state")
        : t(`${index - 1}手目へ戻る`, `Back to step ${index - 1}`),
      actor: stateId(index),
      to: [stateId(index - 1)],
      summary: t(
        `「${child.action}」で来たと覚えているので、その前の状態へ戻る`,
        `It remembers arriving by "${action}", so go back to the state before`,
      ),
      explain: t(
        `この状態は「親の状態から『${child.action}』で来た」と覚えている。親の「${describe(parent.state)}」を開く。${isRoot ? "親は初期状態で、その先に親は無いので、ここで戻るのをやめる。" : "親にも同じく来た道が書いてあるので、さらに戻れる。"}`,
        `This state remembers "I came from my parent by '${action}'". Open the parent, "${describe(parent.state)}". ${isRoot ? "The parent is the initial state and has no parent of its own, so the walk back stops here." : "The parent also records how it was reached, so we can keep going back."}`,
      ),
      set: {
        [stateId(index)]: { rows: { [t("来た操作", "came by")]: action } },
        [stateId(index - 1)]: {
          isHidden: false,
          tone: isRoot ? "ok" : "wait",
          rows: rowsOf(parent.state),
        },
      },
    };
  }

  return {
    id: "counterexample",
    category: "model",
    title: t("反例を読む", "Reading a counterexample"),
    subtitle: t(
      "違反した状態から、来た道を逆にたどる",
      "Walk back from the violating state along the path that led there",
    ),
    summary: t(
      `検査器は、各状態が「どこから・どの操作で来たか」を覚えている。違反した状態から親を${MOVE_COUNT}回たどると、そこへ至る手順（反例）が戻ってくる。幅優先でたどったので、これより短い手順は無い。`,
      `The checker remembers, for each state, where it came from and by which action. Following parents ${MOVE_COUNT} times from the violating state gives back the steps that lead there (the counterexample). Because the search was breadth-first, no shorter sequence exists.`,
    ),
    intro: [
      t(
        "反例は、確かめたい性質が破れるまでの操作の手順である。前のレッスンの幅優先探索で違反した状態が見つかっても、その状態だけでは、どんな順で動いたらそこに着くのかが分からない。",
        "A counterexample is the sequence of actions that leads to the property you are checking being broken. Even when the breadth-first search in the previous lesson finds a violating state, that state alone does not tell you which order of moves gets there.",
      ),
      t(
        "開発者に必要なのは「この順で動かすと壊れる」という再現手順である。反例はそのまま再現手順として使えるので、テストの仕事ではバグ報告や回帰テスト（直した後に同じバグが戻っていないかを見るテスト）の材料になる。",
        'What developers need is a reproduction: "run it in this order and it breaks". A counterexample works directly as one, so in testing work it feeds bug reports and regression tests (tests that check the same bug has not come back after a fix).',
      ),
      t(
        "図では、違反した状態のカードから、一つ前の状態のカードへ戻っていく動きを追う。初期状態のカードに着いて戻るのをやめ、たどった道を前から並べ直す場面が分かれ目になる。",
        "In the diagram, follow the walk from the violating state's card back to the card of the state before it. The turning point is reaching the initial state's card, stopping, and putting the path back in forward order.",
      ),
    ],
    facts: [
      {
        label: t("反例の手数", "Counterexample length"),
        value: steps(MOVE_COUNT),
        tone: "bad",
      },
      { label: t("破る状態の深さ", "Depth of violation"), value: String(MOVE_COUNT) },
      {
        label: t("それより浅い状態", "Shallower states"),
        value: t(
          `${SHALLOWER_STATE_COUNT}個（違反なし）`,
          `${SHALLOWER_STATE_COUNT} (no violation)`,
        ),
      },
      {
        label: t("実物の道具", "Real tools"),
        value: t("TLC のエラートレース", "TLC error trace"),
      },
    ],
    actors: [
      {
        id: "checker",
        label: t("モデル検査器", "Model checker"),
        sublabel: t("親の控えを持つ", "keeps each parent"),
        icon: "checker",
        x: 14,
        y: 73,
      },
      ...stateActors,
    ],
    links: [
      ...TRACE.slice(1).map((_, i) => ({ from: stateId(i), to: stateId(i + 1) })),
      { from: "checker", to: stateId(MOVE_COUNT) },
    ],
    steps: [
      {
        id: "found",
        kind: "found",
        title: t("違反した状態を見る", "Look at the violating state"),
        actor: "checker",
        to: [stateId(MOVE_COUNT)],
        summary: t(
          `深さ${MOVE_COUNT}で、両方終わったのに count=${TRACE[MOVE_COUNT]!.state.count}の状態を見つけた`,
          `At depth ${MOVE_COUNT}, found a state where both are done but count=${TRACE[MOVE_COUNT]!.state.count}`,
        ),
        explain: t(
          `検査器は「${describe(TRACE[MOVE_COUNT]!.state)}」で不変条件「全員が終わったら count は2」が破れているのを見つけた。この状態だけでは、どんな順で動いたらここに着くのか分からない。手順が無いと、開発者は再現も修正もできない。`,
          `The checker found that "${describe(TRACE[MOVE_COUNT]!.state)}" breaks the invariant "when everyone is done, count is 2". This state alone does not say which order of moves reaches it. Without the steps, a developer can neither reproduce nor fix it.`,
        ),
        set: {
          [stateId(MOVE_COUNT)]: {
            isHidden: false,
            tone: "bad",
            rows: rowsOf(TRACE[MOVE_COUNT]!.state),
          },
          checker: {
            tone: "bad",
            rows: {
              [t("違反", "violations")]: t(
                `${RESULT.violationCount}個`,
                `${RESULT.violationCount}`,
              ),
            },
          },
        },
        simplified: t(
          "ここでの「親の控え」は、訪問済みの Map に状態ごとに入れた「親の鍵」と「操作の名前」。TLC も状態の指紋ごとに親を覚えていて、同じやり方でエラートレースを組み立てる。",
          'The "record of the parent" here is the parent\'s key and the action name, stored per state in the visited Map. TLC also remembers a parent for each state fingerprint and builds its error trace the same way.',
        ),
      },
      ...Array.from({ length: MOVE_COUNT }, (_, i) => backStep(MOVE_COUNT - i)),
      {
        id: "reorder",
        kind: "found",
        title: t("並べ直して読む", "Read it in forward order"),
        actor: "checker",
        to: [stateId(0)],
        summary: t(
          `逆にたどった手順を前から並べると「${ACTIONS.join(" → ")}」`,
          `Put in forward order, the steps are "${displayNames(ACTIONS, language)}"`,
        ),
        explain: t(
          `戻ってきた道を逆順にすると、初期状態から違反までの手順になる。Aが読み、書く前に Bも同じ値を読むので、後から書いた Bが Aの更新を上書きする。このページの反例は、こうして組み立てたもの。`,
          `Reversing the path we walked back gives the steps from the initial state to the violation. A reads, and before it writes, B reads the same value, so B, writing last, overwrites A's update. The counterexamples on this site are built this way.`,
        ),
        set: {
          checker: { rows: { [t("手順", "steps")]: steps(MOVE_COUNT) } },
        },
        detail: [
          {
            title: t("反例（前から読む）", "Counterexample (forward)"),
            fields: TRACE.map((step, index) => ({
              label: index === 0 ? initialState : t(`${index}手目`, `Step ${index}`),
              value: step.action ? name(step.action) : t("（始まり）", "(start)"),
              note: describe(step.state),
              tone: index === MOVE_COUNT ? ("bad" as const) : undefined,
            })),
          },
        ],
      },
      {
        id: "shortest",
        kind: "explore",
        title: t("最短の手順になる", "It is the shortest"),
        actor: "checker",
        to: [stateId(MOVE_COUNT)],
        summary: t(
          `深さ${MOVE_COUNT - 1}までの${SHALLOWER_STATE_COUNT}状態に違反は無かった`,
          `None of the ${SHALLOWER_STATE_COUNT} states up to depth ${MOVE_COUNT - 1} had a violation`,
        ),
        explain: t(
          `幅優先探索は浅い状態から順に調べるので、最初に見つかった違反は最も少ない手数で着ける。深さ${MOVE_COUNT - 1}までの${SHALLOWER_STATE_COUNT}状態はどれも不変条件を満たしていた。だから${MOVE_COUNT}手より短い反例は無い。`,
          `Breadth-first search checks shallow states first, so the first violation found is reachable in the fewest steps. All ${SHALLOWER_STATE_COUNT} states up to depth ${MOVE_COUNT - 1} satisfied the invariant. So no counterexample is shorter than ${stepsText(MOVE_COUNT)}.`,
        ),
        set: {
          checker: { rows: { [t("最短", "shortest")]: t("はい", "yes") } },
        },
        simplified: t(
          `このカウンタはどの並びでも${MOVE_COUNT}手で終わるので、最短であることの利点は見えにくい。輪や回り道のあるモデルを深さ優先でたどると、遠回りした長い反例が返ることがあり、幅優先の利点はそこで効く。`,
          `This counter finishes in ${stepsText(MOVE_COUNT)} in every order, so the benefit of being shortest is hard to see. Depth-first search on a model with loops or detours can return a long, roundabout counterexample, and that is where breadth-first pays off.`,
        ),
      },
      {
        id: "replay",
        kind: "test",
        title: t("手順を再生して確かめる", "Replay the steps"),
        actor: "checker",
        to: [stateId(0)],
        summary: t(
          `反例の手順をそのまま動かすと count=${REPLAY.count}になる`,
          `Running the counterexample as is ends with count=${REPLAY.count}`,
        ),
        explain: t(
          `反例はただの手順の列なので、そのまま実装に当てて再生できる。順を決めて動かすと count は${REPLAY.count}になり、${REPLAY.isCorrect ? "正しく終わる" : "毎回同じ失敗を再現できる"}。これをテストに残せば、直した後に戻っていないかを見張れる。`,
          `A counterexample is just a list of steps, so it can be replayed against the implementation as is. Running in that fixed order gives count=${REPLAY.count}, and ${REPLAY.isCorrect ? "it ends correctly" : "the same failure reproduces every time"}. Keeping it as a test guards against the bug coming back after a fix.`,
        ),
        set: {
          checker: { rows: { [t("再生", "replay")]: `count=${REPLAY.count}` } },
        },
      },
    ],
    lab: {
      title: t("プロセスの数を変える", "Change the number of processes"),
      hint: t(
        "プロセスが増えると、反例の手数も増える。幅優先なので、どの数でも出てくるのは最短の手順。",
        "With more processes the counterexample gets longer. Because the search is breadth-first, what comes out is always the shortest one.",
      ),
      inputs: [
        {
          id: "count",
          label: t("プロセスの数（1〜4）", "Processes (1-4)"),
          initial: "2",
        },
      ],
      compute: (values): Field[] => {
        const processCount = parseCount(values.count);
        const result = check(counterModel(processCount, false));
        const trace = result.violation;
        const processes = {
          label: t("プロセスの数", "Processes"),
          value: String(processCount),
        };
        if (!trace) {
          return [
            processes,
            {
              label: t("最短の反例", "Shortest counterexample"),
              value: t("なし", "none"),
              tone: "ok",
            },
            {
              label: t("たどった状態", "States explored"),
              value: t(`${result.stateCount}個`, `${result.stateCount}`),
            },
          ];
        }
        const actions = trace.slice(1).map((step) => step.action ?? "");
        return [
          processes,
          {
            label: t("最短の反例", "Shortest counterexample"),
            value: steps(actions.length),
            tone: "bad",
          },
          { label: t("手順", "Steps"), value: displayNames(actions, language) },
          {
            label: t("最後の状態", "Final state"),
            value: describe(trace.at(-1)!.state),
            tone: "bad",
          },
          {
            label: t("破る状態の数", "Violating states"),
            value: t(`${result.violationCount}個`, `${result.violationCount}`),
          },
        ];
      },
    },
  };
}
