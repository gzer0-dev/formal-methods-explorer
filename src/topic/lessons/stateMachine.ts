import { translator, type Language } from "../../core/i18n";
import type { Actor, Field, Lesson, Link } from "../../core/types";
import { displayName, displayNames } from "../labels";
import { check } from "../modelCheck";
import { ORDER_ACTIONS, orderModel, runOrder, type OrderStatus } from "../models";

const MODEL = orderModel(false);
const RESULT = check(MODEL);
const INIT_STATUS = MODEL.init.status;

// 図の配置。上の段は「払って届く」本筋、下の段は途中で終わる脇道。
const STATUS_ACTORS: { id: string; status: OrderStatus; x: number; y: number }[] = [
  { id: "unpaid", status: "未払い", x: 12, y: 27 },
  { id: "paid", status: "支払済み", x: 37, y: 27 },
  { id: "shipped", status: "発送済み", x: 62, y: 27 },
  { id: "delivered", status: "配達済み", x: 87, y: 27 },
  { id: "cancelled", status: "取消済み", x: 12, y: 73 },
  { id: "refunded", status: "返金済み", x: 37, y: 73 },
];

function actorOf(status: OrderStatus): string {
  return STATUS_ACTORS.find((entry) => entry.status === status)!.id;
}

function actionsFrom(status: OrderStatus): string[] {
  return ORDER_ACTIONS.filter((transition) => transition.from === status).map(
    (transition) => transition.name,
  );
}

function exitsText(status: OrderStatus, language: Language): string {
  const names = actionsFrom(status);
  if (names.length === 0) return language === "ja" ? "なし（終わり）" : "none (final)";
  return names
    .map((name) => displayName(name, language))
    .join(language === "ja" ? "・" : ", ");
}

const FINAL_STATUSES = STATUS_ACTORS.map((entry) => entry.status).filter(
  (status) => actionsFrom(status).length === 0,
);

// 本筋の再生: 払って、発送して、そのあと取り消そうとする（できない操作の例）。
const PAY = runOrder(["支払う"]);
const SHIP = runOrder(["支払う", "発送する"]);
const CANCEL_PLAN = ["支払う", "発送する", "取り消す"];
const CANCEL_LATE = runOrder(CANCEL_PLAN);
const FAILED_ACTION = CANCEL_PLAN[CANCEL_LATE.failedAt ?? 0]!;
const FAILED_POSITION = (CANCEL_LATE.failedAt ?? 0) + 1;

const DEFAULT_PLAN = ["支払う", "発送する"];

// lab では英語の操作名（pay など）も受け付け、モデルの識別子（支払う など）に戻す。
const ACTION_BY_ENGLISH = new Map(
  ORDER_ACTIONS.map((transition) => [
    displayName(transition.name, "en"),
    transition.name,
  ]),
);

function parsePlan(text: string | undefined): string[] {
  const names = (text ?? "")
    .split(/[,、，\s→]+/)
    .map((name) => name.trim())
    .filter((name) => name !== "")
    .map((name) => ACTION_BY_ENGLISH.get(name.toLowerCase()) ?? name);
  return names.length > 0 ? names : DEFAULT_PLAN;
}

function ordinal(position: number): string {
  const lastTwo = position % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${position}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[position % 10] ?? "th";
  return `${position}${suffix}`;
}

const links: Link[] = [
  ...ORDER_ACTIONS.map((transition) => ({
    from: actorOf(transition.from),
    to: actorOf(transition.to),
  })),
];

export function stateMachineLesson(language: Language): Lesson {
  const t = translator(language);
  const name = (text: string) => displayName(text, language);
  const now = t("いま", "now");
  const here = t("ここ", "here");
  const tried = t("試した操作", "tried");
  const actors: Actor[] = [
    ...STATUS_ACTORS.map((entry): Actor => ({
      id: entry.id,
      label: name(entry.status),
      sublabel:
        entry.status === INIT_STATUS
          ? t("初期状態", "initial state")
          : t("状態", "state"),
      icon: "state",
      x: entry.x,
      y: entry.y,
    })),
    {
      id: "checker",
      label: t("モデル検査器", "Model checker"),
      sublabel: t("全部の状態をたどる", "walks every state"),
      icon: "checker",
      x: 87,
      y: 73,
      initial: { isHidden: true },
    },
  ];
  return {
    id: "state-machine",
    category: "model",
    title: t("状態と遷移で書く", "States and transitions"),
    subtitle: t(
      "注文を「状態」と「状態を変える操作」で書く",
      "Describe an order as states and the actions that change them",
    ),
    summary: t(
      `注文がとりうる状態を並べ、状態を変える操作（遷移）を${ORDER_ACTIONS.length}つ書く。これだけで、どの順に操作したら何が起きるかを機械がたどれる。TLA+ の Init（初期状態）と Next（次の状態への遷移）に当たる。`,
      `List the states an order can be in and write the ${ORDER_ACTIONS.length} actions (transitions) that change them. That alone lets a machine trace what happens for any order of actions. It corresponds to Init (the initial state) and Next (the transitions to the next state) in TLA+.`,
    ),
    intro: [
      t(
        "状態機械は、システムを「いまどの状態にいるか」と「どの操作でどの状態に移るか（遷移）」の組で書く方法である。ここでは注文を例に、未払いや支払済みといった状態と、支払う・発送するといった操作を書く。",
        "A state machine describes a system as a pair: which state it is in now, and which action moves it to which state (a transition). Here, using an order as the example, we write states such as unpaid and paid, and actions such as pay and ship.",
      ),
      t(
        "テストは書いた手順だけを試すが、状態と遷移を表にしておけば、どの順に操作したら何が起きるかを機械が全部たどれる。前のレッスンで見た TLA+ も、この形で仕様を書く。",
        "A test tries only the steps you wrote, but once states and transitions are in a table, a machine can trace what happens for every order of actions. TLA+, seen in the previous lesson, writes specs in this form too.",
      ),
      t(
        "図では、「いま」の印が状態のカードを移っていく様子を追う。発送済みのカードから取り消しを試す場面が分かれ目で、遷移の表に無い操作がどう扱われるかを見る。",
        'In the diagram, follow the "now" marker as it moves between state cards. The turning point is trying to cancel from the shipped card: watch how an action missing from the transition table is handled.',
      ),
    ],
    facts: [
      {
        label: t("状態", "States"),
        value: t(`${RESULT.stateCount}個`, `${RESULT.stateCount}`),
      },
      {
        label: t("遷移", "Transitions"),
        value: t(`${RESULT.transitionCount}本`, `${RESULT.transitionCount}`),
      },
      { label: t("初期状態", "Initial state"), value: name(INIT_STATUS) },
      {
        label: t("実物の道具", "Real tools"),
        value: t("TLA+ の Init と Next", "Init and Next in TLA+"),
      },
    ],
    actors,
    links,
    steps: [
      {
        id: "init",
        kind: "spec",
        title: t("初期状態を決める", "Pick the initial state"),
        actor: "unpaid",
        summary: t(
          `注文は「${INIT_STATUS}」から始まる`,
          `An order starts as "${name(INIT_STATUS)}"`,
        ),
        explain: t(
          `まず、システムが最初にどの状態にいるかを決める。注文は必ず「${INIT_STATUS}」から始まる。TLA+ ではこれを Init という式に書く。`,
          `First decide which state the system starts in. An order always starts as "${name(INIT_STATUS)}". In TLA+ this is written as a formula called Init.`,
        ),
        set: { unpaid: { tone: "wait", rows: { [now]: here } } },
        detail: [
          {
            title: t("注文がとりうる状態", "States an order can be in"),
            fields: STATUS_ACTORS.map((entry) => ({
              label: name(entry.status),
              value:
                entry.status === INIT_STATUS
                  ? t("初期状態", "initial state")
                  : t("操作で移る先", "reached by an action"),
            })),
          },
        ],
      },
      {
        id: "transitions",
        kind: "spec",
        title: t("遷移を書く", "Write the transitions"),
        actor: "unpaid",
        to: ["paid", "cancelled"],
        summary: t(
          `状態を変える操作を${ORDER_ACTIONS.length}つ、「どこから・どこへ」の組で書く`,
          `Write the ${ORDER_ACTIONS.length} actions as "from where, to where" pairs`,
        ),
        explain: t(
          "次に、状態を変える操作（遷移）を「どの状態からできて、どの状態に移るか」の組で書く。書いていない操作はできない、というのが大事な点。TLA+ ではこれを Next という式に書く。",
          "Next, write each action (transition) as a pair: which state it can happen in, and which state it moves to. The key point is that an action you did not write cannot happen. In TLA+ this is written as a formula called Next.",
        ),
        set: Object.fromEntries(
          STATUS_ACTORS.map((entry) => [
            entry.id,
            {
              rows: { [t("できる操作", "can do")]: exitsText(entry.status, language) },
            },
          ]),
        ),
        detail: [
          {
            title: t("遷移の一覧", "All transitions"),
            fields: ORDER_ACTIONS.map((transition) => ({
              label: name(transition.name),
              value: `${name(transition.from)} → ${name(transition.to)}`,
            })),
          },
        ],
        simplified: t(
          'TLA+ では、たとえば Pay == status = "unpaid" /\\ status\' = "paid" のように、いまの値と次の値（\' 付き）の関係を論理式で書く。TLA+ の文字列には日本語を書けないので、状態の名前は英字にする。ここでは同じ中身を表で書き、TypeScript の関数にしている。TLA+ で書いた同じ仕様はリポジトリの specs/tla/Order.tla にある。',
          'In TLA+ you write the relation between the current value and the next value (primed) as a logical formula, for example Pay == status = "unpaid" /\\ status\' = "paid". TLA+ strings cannot contain Japanese, so the state names there are in English letters. Here the same content is written as a table and turned into TypeScript functions. The same spec in TLA+ is in specs/tla/Order.tla in the repository.',
        ),
      },
      {
        id: "pay",
        kind: "run",
        title: t("支払う", "Pay"),
        actor: "unpaid",
        to: ["paid"],
        summary: t(
          `「支払う」で${PAY.status}に移る`,
          `"${name("支払う")}" moves it to ${name(PAY.status)}`,
        ),
        explain: t(
          `いまの状態「${INIT_STATUS}」から「支払う」はできるので、注文は「${PAY.status}」に移る。状態が変わると、できる操作も変わる。`,
          `"${name("支払う")}" is allowed from the current state "${name(INIT_STATUS)}", so the order moves to "${name(PAY.status)}". When the state changes, the actions you can do change too.`,
        ),
        set: {
          unpaid: { tone: "idle", rows: { [now]: null } },
          [actorOf(PAY.status)]: { tone: "wait", rows: { [now]: here } },
        },
      },
      {
        id: "ship",
        kind: "run",
        title: t("発送する", "Ship"),
        actor: "paid",
        to: ["shipped"],
        summary: t(
          `「発送する」で${SHIP.status}に移る`,
          `"${name("発送する")}" moves it to ${name(SHIP.status)}`,
        ),
        explain: t(
          `「${PAY.status}」からは「発送する」ができるので、「${SHIP.status}」に移る。ここまでの操作の列を「実行」と呼ぶ。`,
          `"${name("発送する")}" is allowed from "${name(PAY.status)}", so it moves to "${name(SHIP.status)}". A sequence of actions like this is called an execution.`,
        ),
        set: {
          [actorOf(PAY.status)]: { tone: "idle", rows: { [now]: null } },
          [actorOf(SHIP.status)]: { tone: "wait", rows: { [now]: here } },
        },
      },
      {
        id: "cannot-cancel",
        kind: "run",
        title: t("取り消せない", "Cannot cancel"),
        actor: "shipped",
        summary: t(
          `「${CANCEL_LATE.status}」から「${FAILED_ACTION}」はできない`,
          `"${name(FAILED_ACTION)}" is not allowed from "${name(CANCEL_LATE.status)}"`,
        ),
        explain: t(
          `続けて「${FAILED_ACTION}」を試すが、「${CANCEL_LATE.status}」から出る遷移に「${FAILED_ACTION}」は無いので、${FAILED_POSITION}番目の操作で止まる。遷移を表に書いたことで、「発送後に取り消せるか」に仕様の上で答えが出る。`,
          `Next we try "${name(FAILED_ACTION)}", but no transition named "${name(FAILED_ACTION)}" leaves "${name(CANCEL_LATE.status)}", so it stops at the ${ordinal(FAILED_POSITION)} action. Because the transitions are written in a table, the spec itself answers "can you cancel after shipping?"`,
        ),
        set: {
          [actorOf(CANCEL_LATE.status)]: {
            tone: "bad",
            rows: { [tried]: name(FAILED_ACTION) },
          },
        },
        detail: [
          {
            title: t("試した操作の列", "Actions tried"),
            fields: CANCEL_PLAN.map((action, index) => ({
              label: t(`${index + 1}番目`, ordinal(index + 1)),
              value: name(action),
              tone: index === CANCEL_LATE.failedAt ? "bad" : "ok",
              note:
                index === CANCEL_LATE.failedAt
                  ? t("できない", "not allowed")
                  : t("できた", "done"),
            })),
          },
        ],
      },
      {
        id: "explore-all",
        kind: "explore",
        title: t("全部の状態をたどる", "Walk every state"),
        actor: "checker",
        summary: t(
          `初期状態から${RESULT.stateCount}状態・${RESULT.transitionCount}遷移をすべてたどる`,
          `Walks all ${RESULT.stateCount} states and ${RESULT.transitionCount} transitions from the initial state`,
        ),
        explain: t(
          `初期状態と遷移が書けたので、モデル検査器は初期状態から行ける状態を全部たどれる。${RESULT.stateCount}状態・${RESULT.transitionCount}遷移を調べ、「発送したなら支払済み」は${RESULT.violation ? "破れた" : "どこでも成り立つ"}。終わりの状態（${FINAL_STATUSES.join("・")}）以外で止まる所も${RESULT.deadlock ? "あった" : "無い"}。`,
          `With the initial state and transitions written, the model checker can walk every state reachable from the start. It checks ${RESULT.stateCount} states and ${RESULT.transitionCount} transitions, and "if shipped, then paid" ${RESULT.violation ? "is broken" : "holds everywhere"}. ${RESULT.deadlock ? "There is" : "There is no"} place where it gets stuck other than the final states (${FINAL_STATUSES.map(name).join(", ")}).`,
        ),
        set: {
          [actorOf(CANCEL_LATE.status)]: { tone: "idle", rows: { [tried]: null } },
          ...Object.fromEntries(
            FINAL_STATUSES.map((status) => [actorOf(status), { tone: "ok" as const }]),
          ),
          checker: {
            isHidden: false,
            tone: RESULT.violation ? "bad" : "ok",
            rows: {
              [t("状態", "states")]: t(
                `${RESULT.stateCount}個`,
                `${RESULT.stateCount}`,
              ),
              [t("遷移", "transitions")]: t(
                `${RESULT.transitionCount}本`,
                `${RESULT.transitionCount}`,
              ),
              [t("違反", "violation")]: RESULT.violation
                ? t("あり", "yes")
                : t("なし", "none"),
            },
          },
        },
        simplified: t(
          "このモデルの状態は「注文の状態」と「支払ったか」の組だが、正しい仕様では2つが連動しているので、状態の数は注文の状態の数と同じになる。TLC は同じことを TLA+ の Init と Next から行う。",
          'A state of this model is a pair of "order status" and "has it been paid", but in the correct spec the two move together, so the number of states equals the number of order statuses. TLC does the same from Init and Next in TLA+.',
        ),
      },
    ],
    lab: {
      title: t("操作の列を当てる", "Apply a sequence of actions"),
      hint: t(
        `操作の名前を「,」で区切って並べる。使える名前: ${ORDER_ACTIONS.map((transition) => transition.name).join("・")}。その状態から出る遷移が無い操作は、そこで止まる。`,
        `List action names separated by ",". Names you can use: ${ORDER_ACTIONS.map((transition) => name(transition.name)).join(", ")}. An action with no transition from the current state stops the run there.`,
      ),
      inputs: [
        {
          id: "plan",
          label: t("操作の列", "Actions"),
          initial: DEFAULT_PLAN.map(name).join(","),
        },
      ],
      compute: (values): Field[] => {
        const plan = parsePlan(values.plan);
        const run = runOrder(plan);
        const isFailed = run.failedAt !== null;
        return [
          { label: t("当てた操作", "Applied"), value: displayNames(plan, language) },
          { label: t("最後の状態", "Final state"), value: name(run.status) },
          {
            label: t("できなかった操作", "Not allowed"),
            value: isFailed
              ? t(
                  `${run.failedAt! + 1}番目の「${plan[run.failedAt!]}」`,
                  `the ${ordinal(run.failedAt! + 1)}, "${name(plan[run.failedAt!]!)}"`,
                )
              : t("なし", "none"),
            tone: isFailed ? "bad" : "ok",
          },
          {
            label: t("次にできる操作", "Can do next"),
            value: exitsText(run.status, language),
          },
        ];
      },
    },
  };
}
