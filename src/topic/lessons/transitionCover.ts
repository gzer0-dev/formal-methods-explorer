import { translator, type Language } from "../../core/i18n";
import type { ActorPatch, Field, Lesson } from "../../core/types";
import { coverTransitions, shortestPath } from "../coverage";
import { displayName, displayNames } from "../labels";
import { ORDER_ACTIONS, type OrderStatus, type OrderTransition } from "../models";

const INITIAL: OrderStatus = "未払い";

// 遷移ごとに「そこへ行く最短の道 + その遷移」。捨てる前の候補として画面に見せる。
const CANDIDATES = ORDER_ACTIONS.map((transition) => {
  const prefix = shortestPath(ORDER_ACTIONS, INITIAL, transition.from) ?? [];
  return { transition, path: [...prefix, transition.name] };
});
const TESTS = coverTransitions(ORDER_ACTIONS, INITIAL);
const STATUSES = new Set(ORDER_ACTIONS.flatMap((t) => [t.from, t.to]));
const COVERED = new Set(TESTS.flat());
const DROPPED = CANDIDATES.filter(
  (candidate) => !TESTS.some((test) => test.join() === candidate.path.join()),
);

function endStatus(transitions: OrderTransition[], path: string[]): OrderStatus {
  return path.reduce<OrderStatus>(
    (status, name) =>
      transitions.find((t) => t.name === name && t.from === status)?.to ?? status,
    INITIAL,
  );
}

// 英語の画面で打った遷移の名前（"pay" など）を、計算が読む日本語の名前に戻す表。表示名は labels.ts から作る。
const ENGLISH_TO_TRANSITION = new Map(
  ORDER_ACTIONS.map((transition) => [
    displayName(transition.name, "en").toLowerCase(),
    transition.name,
  ]),
);

function parseNames(text: string | undefined): OrderTransition[] {
  const names = (text ?? "")
    .split(/[,、，]/)
    .map((name) => name.trim())
    .map((name) => ENGLISH_TO_TRANSITION.get(name.toLowerCase()) ?? name);
  const chosen = ORDER_ACTIONS.filter((transition) => names.includes(transition.name));
  return chosen.length > 0 ? chosen : ORDER_ACTIONS;
}

export function transitionCoverLesson(language: Language): Lesson {
  const t = translator(language);
  const formatPath = (path: string[]): string => displayNames(path, language);
  const name = (text: string): string => displayName(text, language);
  const testCount = (count: number): string =>
    t(`${count}本`, count === 1 ? "1 test" : `${count} tests`);
  const transitionCount = (count: number): string =>
    t(`${count}本`, count === 1 ? "1 transition" : `${count} transitions`);
  const coveredText = t(
    `${ORDER_ACTIONS.length}本中${COVERED.size}本`,
    `${COVERED.size} of ${ORDER_ACTIONS.length}`,
  );

  /** テストのカードに出す行。1手ずつ並べ、行の上限（4行）を超えないように最後は終わりの状態だけにする。 */
  const testCard = (index: number): ActorPatch => {
    const path = TESTS[index] ?? [];
    const rows: Record<string, string> = {};
    path.forEach((step, i) => {
      rows[t(`${i + 1}手目`, `step ${i + 1}`)] = name(step);
    });
    rows[t("終わり", "end")] = name(endStatus(ORDER_ACTIONS, path));
    return { isHidden: false, tone: "ok", rows };
  };

  return {
    id: "transition-cover",
    category: "testing",
    title: t("遷移を全部通すテスト", "Covering every transition"),
    subtitle: t(
      "状態遷移のモデルから、テストの手順を作る",
      "Build test steps from a state-transition model",
    ),
    summary: t(
      `注文の状態遷移${ORDER_ACTIONS.length}本を、モデルから作った${TESTS.length}本のテストで全部1回は通す。モデルベーステストの最小の形。`,
      `Pass through all ${ORDER_ACTIONS.length} order transitions at least once with ${testCount(TESTS.length)} built from the model. Model-based testing in its smallest form.`,
    ),
    intro: [
      t(
        "状態遷移のモデル（どの状態からどの操作でどの状態へ移るかを書いた表）から、テストの手順を機械的に作る。モデルを元にテストを作るやり方を、モデルベーステストと呼ぶ。題材は、未払いから始まる注文の状態である。",
        `Build test steps mechanically from a state-transition model (a table of which operation moves from which state to which). Building tests from a model is called model-based testing. The example is the state of an order, starting from ${name(INITIAL)}.`,
      ),
      t(
        "状態遷移テストでは、どの遷移も1回は通すこと（遷移網羅）を目標にすることが多い。ただ、手順を人が考えると、よく通る流れは押さえても分かれ道を落としやすい。「状態と遷移で書く」で見たようなモデルがあれば、その手順を道具に作らせられる。",
        'State-transition testing often aims to pass through every transition at least once (transition coverage). But when people work out the steps, they cover the common flow and tend to miss the branches. With a model like the one in "States and transitions", a tool can work out those steps for you.',
      ),
      t(
        "図では、左のモデルから生成器へ、生成器から右のテストのカードへ伸びる矢印を追う。生成器がいったん候補を作り、ほかの手順に含まれる候補を捨てて減らす場面が転換点で、その後にテストのカードが1枚ずつ現れる。",
        "In the diagram, follow the arrows from the model on the left to the generator, and from the generator to the test cards on the right. The turning point is where the generator first makes candidates, then drops those contained in other steps; after that the test cards appear one by one.",
      ),
    ],
    facts: [
      {
        label: t("状態", "States"),
        value: t(`${STATUSES.size}個`, `${STATUSES.size}`),
      },
      {
        label: t("遷移", "Transitions"),
        value: t(`${ORDER_ACTIONS.length}本`, `${ORDER_ACTIONS.length}`),
      },
      {
        label: t("作ったテスト", "Tests built"),
        value: t(`${TESTS.length}本`, `${TESTS.length}`),
        tone: "ok",
      },
      { label: t("通った遷移", "Transitions covered"), value: coveredText, tone: "ok" },
    ],
    actors: [
      {
        id: "model",
        label: t("状態遷移のモデル", "State model"),
        sublabel: t("注文の状態", "order states"),
        icon: "spec",
        x: 14,
        y: 50,
      },
      {
        id: "generator",
        label: t("生成器", "Generator"),
        sublabel: t("テストの手順を作る", "builds test steps"),
        icon: "gear",
        x: 38,
        y: 50,
      },
      {
        id: "test1",
        label: t("テスト1", "Test 1"),
        icon: "test",
        x: 64,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "test2",
        label: t("テスト2", "Test 2"),
        icon: "test",
        x: 64,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "test3",
        label: t("テスト3", "Test 3"),
        icon: "test",
        x: 86,
        y: 50,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "model", to: "generator" },
      { from: "generator", to: "test1" },
      { from: "generator", to: "test2" },
      { from: "generator", to: "test3" },
    ],
    steps: [
      {
        id: "write-model",
        kind: "spec",
        title: t("状態遷移を書く", "Write the transitions"),
        actor: "model",
        summary: t(
          `注文の状態${STATUSES.size}個と遷移${ORDER_ACTIONS.length}本を書く`,
          `Write the ${STATUSES.size} order states and ${transitionCount(ORDER_ACTIONS.length)}`,
        ),
        explain: t(
          "注文は「未払い」から始まり、支払う・発送する・届ける・取り消す・返金する、の操作で状態が移る。どの状態からどの操作ができるかを、表として書き出したものがモデルになる。",
          `An order starts as "${name(INITIAL)}" and moves between states with the operations ${ORDER_ACTIONS.map((transition) => name(transition.name)).join(", ")}. Writing out, as a table, which operation is possible from which state gives the model.`,
        ),
        set: {
          model: {
            tone: "wait",
            rows: {
              [t("初期状態", "initial")]: name(INITIAL),
              [t("状態", "states")]: t(`${STATUSES.size}個`, `${STATUSES.size}`),
              [t("遷移", "transitions")]: t(
                `${ORDER_ACTIONS.length}本`,
                `${ORDER_ACTIONS.length}`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("遷移の一覧", "All transitions"),
            fields: ORDER_ACTIONS.map((transition) => ({
              label: name(transition.name),
              value: `${name(transition.from)} → ${name(transition.to)}`,
            })),
          },
        ],
      },
      {
        id: "shortest",
        kind: "explore",
        title: t("各遷移への最短の道", "Shortest path to each one"),
        actor: "generator",
        to: ["model"],
        summary: t(
          `遷移ごとに「そこへ行く最短の道＋その遷移」を作り、${CANDIDATES.length}本の候補にする`,
          `For each transition, build "the shortest path there + that transition", giving ${CANDIDATES.length} candidates`,
        ),
        explain: t(
          "遷移を1本ずつ取り上げ、初期状態からその遷移の出発点までの最短の操作列を幅優先で探し、最後にその遷移を足す。こうすると、どの遷移にも必ずそれを通る手順が1本できる。",
          "Take one transition at a time, search breadth-first for the shortest sequence of operations from the initial state to where that transition starts, and add the transition at the end. This way every transition gets one sequence of steps that passes through it.",
        ),
        set: {
          generator: {
            tone: "wait",
            rows: {
              [t("候補", "candidates")]: t(
                `${CANDIDATES.length}本`,
                `${CANDIDATES.length}`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("遷移ごとの候補", "Candidate for each transition"),
            fields: CANDIDATES.map((candidate) => ({
              label: name(candidate.transition.name),
              value: formatPath(candidate.path),
            })),
          },
        ],
      },
      {
        id: "drop",
        kind: "explore",
        title: t("含まれる道を捨てる", "Drop contained paths"),
        actor: "generator",
        summary: t(
          `他の道の先頭部分に含まれる${DROPPED.length}本を捨て、${TESTS.length}本に減らす`,
          `Drop the ${DROPPED.length} that are the start of another path, leaving ${TESTS.length}`,
        ),
        explain: t(
          `「${formatPath(DROPPED[0]?.path ?? [])}」は、もっと長い手順の先頭部分にそのまま含まれている。長い方を流せば同じ遷移を通るので、短い方は捨ててよい。`,
          `"${formatPath(DROPPED[0]?.path ?? [])}" is contained, as is, at the start of a longer sequence. Running the longer one passes through the same transitions, so the shorter one can be dropped.`,
        ),
        set: {
          generator: {
            rows: {
              [t("候補", "candidates")]: t(
                `${CANDIDATES.length}本`,
                `${CANDIDATES.length}`,
              ),
              [t("捨てた", "dropped")]: t(`${DROPPED.length}本`, `${DROPPED.length}`),
              [t("残り", "left")]: t(`${TESTS.length}本`, `${TESTS.length}`),
            },
          },
        },
        detail: [
          {
            title: t("捨てた候補", "Dropped candidates"),
            fields: DROPPED.map((candidate) => ({
              label: name(candidate.transition.name),
              value: formatPath(candidate.path),
              note: t("別の手順の先頭部分", "start of another sequence"),
            })),
          },
        ],
      },
      {
        id: "test1",
        kind: "test",
        title: t("テスト1を作る", "Build test 1"),
        actor: "generator",
        to: ["test1"],
        summary: formatPath(TESTS[0] ?? []),
        explain: t(
          `1本目は${formatPath(TESTS[0] ?? [])}。支払いから配達までの、いちばん長い普通の流れを通る。`,
          `The first is ${formatPath(TESTS[0] ?? [])}. It follows the longest ordinary flow, from payment to delivery.`,
        ),
        set: { test1: testCard(0) },
      },
      {
        id: "test2",
        kind: "test",
        title: t("テスト2を作る", "Build test 2"),
        actor: "generator",
        to: ["test2"],
        summary: formatPath(TESTS[1] ?? []),
        explain: t(
          `2本目は${formatPath(TESTS[1] ?? [])}の1手だけ。支払う前に取り消す流れは、1本目とは最初の操作から分かれるので別のテストになる。`,
          `The second is just one step, ${formatPath(TESTS[1] ?? [])}. Cancelling before paying branches off from the first test at the very first operation, so it is a separate test.`,
        ),
        set: { test2: testCard(1) },
      },
      {
        id: "test3",
        kind: "test",
        title: t("テスト3を作る", "Build test 3"),
        actor: "generator",
        to: ["test3"],
        summary: formatPath(TESTS[2] ?? []),
        explain: t(
          `3本目は${formatPath(TESTS[2] ?? [])}。支払った後に発送ではなく返金へ分かれる流れを通る。`,
          `The third is ${formatPath(TESTS[2] ?? [])}. It follows the flow that, after payment, branches to a refund instead of shipping.`,
        ),
        set: { test3: testCard(2) },
      },
      {
        id: "covered",
        kind: "run",
        title: t("全部の遷移を通った", "Every transition covered"),
        actor: "model",
        to: ["test1", "test2", "test3"],
        summary: t(
          `${TESTS.length}本で遷移${ORDER_ACTIONS.length}本中${COVERED.size}本を通る`,
          `${testCount(TESTS.length)} pass through ${COVERED.size} of the ${ORDER_ACTIONS.length} transitions`,
        ),
        explain: t(
          "3本のテストを合わせると、5本の遷移をどれも1回は通る。手で思いついた順に書くと抜けやすい「支払う前の取り消し」や「支払後の返金」も、モデルから機械的に作れば漏れない。",
          'Together the 3 tests pass through each of the 5 transitions at least once. Cases easy to miss when writing tests as they come to mind, like "cancel before paying" or "refund after paying", are not missed when built mechanically from the model.',
        ),
        set: {
          model: {
            tone: "ok",
            rows: { [t("通った遷移", "covered")]: coveredText },
          },
          generator: { tone: "ok" },
        },
        simplified: t(
          "ここでは「どの遷移も1回は通る」だけを目標にしている。実物のモデルベーステストの道具は、遷移の組み合わせや前提条件、渡すデータまで含めて手順を作り、実装の状態とモデルの状態を毎手比べる。fast-check や Hypothesis にも、状態を持つ対象を操作列で試す仕組みがある。",
          "Here the only goal is \"every transition at least once\". Real model-based testing tools build steps that include combinations of transitions, preconditions and the data passed in, and compare the implementation's state with the model's at every step. fast-check and Hypothesis also have ways to test stateful targets with sequences of operations.",
        ),
      },
    ],
    lab: {
      title: t("遷移を選んで手順を作る", "Pick transitions and build steps"),
      hint: t(
        "遷移の名前をカンマ区切りで選ぶ（支払う・発送する・届ける・取り消す・返金する）。選んだ遷移だけのモデルから、テストの手順を作り直す。初期状態から着けない遷移はテストにならない。",
        `Choose transition names separated by commas (${ORDER_ACTIONS.map((transition) => name(transition.name)).join(", ")}). Test steps are rebuilt from a model with only the chosen transitions. A transition that cannot be reached from the initial state does not become a test.`,
      ),
      inputs: [
        {
          id: "names",
          label: t("遷移（カンマ区切り）", "Transitions (comma-separated)"),
          initial: ORDER_ACTIONS.map((transition) => name(transition.name)).join(","),
        },
      ],
      compute: (values): Field[] => {
        const chosen = parseNames(values.names);
        const tests = coverTransitions(chosen, INITIAL);
        const covered = new Set(tests.flat());
        const unreachable = chosen.filter(
          (transition) => !covered.has(transition.name),
        );
        const namesText = (list: OrderTransition[]): string =>
          list.map((transition) => name(transition.name)).join(t("・", ", "));
        return [
          { label: t("選んだ遷移", "Chosen transitions"), value: namesText(chosen) },
          {
            label: t("テストの本数", "Tests"),
            value: t(`${tests.length}本`, `${tests.length}`),
          },
          ...tests.map((path, i) => ({
            label: t(`テスト${i + 1}`, `Test ${i + 1}`),
            value: formatPath(path),
            note: t(
              `終わり: ${endStatus(chosen, path)}`,
              `end: ${name(endStatus(chosen, path))}`,
            ),
          })),
          {
            label: t("着けない遷移", "Unreachable"),
            value: unreachable.length > 0 ? namesText(unreachable) : t("なし", "none"),
            tone: unreachable.length > 0 ? "bad" : "ok",
          },
        ];
      },
    },
  };
}
