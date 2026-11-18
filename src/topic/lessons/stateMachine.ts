import type { Actor, Field, Lesson, Link } from "../../core/types";
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

function exitsText(status: OrderStatus): string {
  const names = actionsFrom(status);
  return names.length > 0 ? names.join("・") : "なし（終わり）";
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

const DEFAULT_PLAN = ["支払う", "発送する"];

function parsePlan(text: string | undefined): string[] {
  const names = (text ?? "")
    .split(/[,、，\s→]+/)
    .map((name) => name.trim())
    .filter((name) => name !== "");
  return names.length > 0 ? names : DEFAULT_PLAN;
}

const actors: Actor[] = [
  ...STATUS_ACTORS.map((entry): Actor => ({
    id: entry.id,
    label: entry.status,
    sublabel: entry.status === INIT_STATUS ? "初期状態" : "状態",
    icon: "state",
    x: entry.x,
    y: entry.y,
  })),
  {
    id: "checker",
    label: "モデル検査器",
    sublabel: "全部の状態をたどる",
    icon: "checker",
    x: 87,
    y: 73,
    initial: { isHidden: true },
  },
];

const links: Link[] = [
  ...ORDER_ACTIONS.map((transition) => ({
    from: actorOf(transition.from),
    to: actorOf(transition.to),
  })),
  { from: "checker", to: "unpaid" },
];

export const stateMachineLesson: Lesson = {
  id: "state-machine",
  category: "model",
  title: "状態と遷移で書く",
  subtitle: "注文を「状態」と「状態を変える操作」で書く",
  summary: `注文がとりうる状態を並べ、状態を変える操作（遷移）を ${ORDER_ACTIONS.length} つ書く。これだけで、どの順に操作したら何が起きるかを機械がたどれる。TLA+ の Init（初期状態）と Next（次の状態への遷移）に当たる。`,
  facts: [
    { label: "状態", value: `${RESULT.stateCount} 個` },
    { label: "遷移", value: `${RESULT.transitionCount} 本` },
    { label: "初期状態", value: INIT_STATUS },
    { label: "実物の道具", value: "TLA+ の Init と Next" },
  ],
  actors,
  links,
  steps: [
    {
      id: "init",
      kind: "spec",
      title: "初期状態を決める",
      actor: "unpaid",
      summary: `注文は「${INIT_STATUS}」から始まる`,
      explain: `まず、システムが最初にどの状態にいるかを決める。注文は必ず「${INIT_STATUS}」から始まる。TLA+ ではこれを Init という式に書く。`,
      set: { unpaid: { tone: "wait", rows: { いま: "ここ" } } },
      detail: [
        {
          title: "注文がとりうる状態",
          fields: STATUS_ACTORS.map((entry) => ({
            label: entry.status,
            value: entry.status === INIT_STATUS ? "初期状態" : "操作で移る先",
          })),
        },
      ],
    },
    {
      id: "transitions",
      kind: "spec",
      title: "遷移を書く",
      actor: "unpaid",
      to: ["paid", "cancelled"],
      summary: `状態を変える操作を ${ORDER_ACTIONS.length} つ、「どこから・どこへ」の組で書く`,
      explain:
        "次に、状態を変える操作（遷移）を「どの状態からできて、どの状態に移るか」の組で書く。書いていない操作はできない、というのが大事な点。TLA+ ではこれを Next という式に書く。",
      set: Object.fromEntries(
        STATUS_ACTORS.map((entry) => [
          entry.id,
          { rows: { できる操作: exitsText(entry.status) } },
        ]),
      ),
      detail: [
        {
          title: "遷移の一覧",
          fields: ORDER_ACTIONS.map((transition) => ({
            label: transition.name,
            value: `${transition.from} → ${transition.to}`,
          })),
        },
      ],
      simplified:
        'TLA+ では、たとえば Pay == status = "未払い" /\\ status\' = "支払済み" のように、いまの値と次の値（\' 付き）の関係を論理式で書く。ここでは同じ中身を表で書き、TypeScript の関数にしている。',
    },
    {
      id: "pay",
      kind: "run",
      title: "支払う",
      actor: "unpaid",
      to: ["paid"],
      summary: `「支払う」で ${PAY.status} に移る`,
      explain: `いまの状態「${INIT_STATUS}」から「支払う」はできるので、注文は「${PAY.status}」に移る。状態が変わると、できる操作も変わる。`,
      set: {
        unpaid: { tone: "idle", rows: { いま: null } },
        [actorOf(PAY.status)]: { tone: "wait", rows: { いま: "ここ" } },
      },
    },
    {
      id: "ship",
      kind: "run",
      title: "発送する",
      actor: "paid",
      to: ["shipped"],
      summary: `「発送する」で ${SHIP.status} に移る`,
      explain: `「${PAY.status}」からは「発送する」ができるので、「${SHIP.status}」に移る。ここまでの操作の列を「実行」と呼ぶ。`,
      set: {
        [actorOf(PAY.status)]: { tone: "idle", rows: { いま: null } },
        [actorOf(SHIP.status)]: { tone: "wait", rows: { いま: "ここ" } },
      },
    },
    {
      id: "cannot-cancel",
      kind: "run",
      title: "取り消せない",
      actor: "shipped",
      summary: `「${CANCEL_LATE.status}」から「${FAILED_ACTION}」はできない`,
      explain: `続けて「${FAILED_ACTION}」を試すが、「${CANCEL_LATE.status}」から出る遷移に「${FAILED_ACTION}」は無いので、${(CANCEL_LATE.failedAt ?? 0) + 1} 番目の操作で止まる。遷移を表に書いたことで、「発送後に取り消せるか」に仕様の上で答えが出る。`,
      set: {
        [actorOf(CANCEL_LATE.status)]: {
          tone: "bad",
          rows: { 試した操作: FAILED_ACTION },
        },
      },
      detail: [
        {
          title: "試した操作の列",
          fields: CANCEL_PLAN.map((name, index) => ({
            label: `${index + 1} 番目`,
            value: name,
            tone: index === CANCEL_LATE.failedAt ? "bad" : "ok",
            note: index === CANCEL_LATE.failedAt ? "できない" : "できた",
          })),
        },
      ],
    },
    {
      id: "explore-all",
      kind: "explore",
      title: "全部の状態をたどる",
      actor: "checker",
      to: ["unpaid"],
      summary: `初期状態から ${RESULT.stateCount} 状態・${RESULT.transitionCount} 遷移をすべてたどる`,
      explain: `初期状態と遷移が書けたので、モデル検査器は初期状態から行ける状態を全部たどれる。${RESULT.stateCount} 状態・${RESULT.transitionCount} 遷移を調べ、「発送したなら支払済み」は${RESULT.violation ? "破れた" : "どこでも成り立つ"}。終わりの状態（${FINAL_STATUSES.join("・")}）以外で止まる所も${RESULT.deadlock ? "あった" : "無い"}。`,
      set: {
        [actorOf(CANCEL_LATE.status)]: { tone: "idle", rows: { 試した操作: null } },
        ...Object.fromEntries(
          FINAL_STATUSES.map((status) => [actorOf(status), { tone: "ok" as const }]),
        ),
        checker: {
          isHidden: false,
          tone: RESULT.violation ? "bad" : "ok",
          rows: {
            状態: `${RESULT.stateCount} 個`,
            遷移: `${RESULT.transitionCount} 本`,
            違反: RESULT.violation ? "あり" : "なし",
          },
        },
      },
      simplified:
        "このモデルの状態は「注文の状態」と「支払ったか」の組だが、正しい仕様では 2 つが連動しているので、状態の数は注文の状態の数と同じになる。TLC は同じことを TLA+ の Init と Next から行う。",
    },
  ],
  lab: {
    title: "操作の列を当てる",
    hint: `操作の名前を「,」で区切って並べる。使える名前: ${ORDER_ACTIONS.map((t) => t.name).join("・")}。その状態から出る遷移が無い操作は、そこで止まる。`,
    inputs: [{ id: "plan", label: "操作の列", initial: DEFAULT_PLAN.join(",") }],
    compute: (values): Field[] => {
      const plan = parsePlan(values.plan);
      const run = runOrder(plan);
      const isFailed = run.failedAt !== null;
      return [
        { label: "当てた操作", value: plan.join(" → ") },
        { label: "最後の状態", value: run.status },
        {
          label: "できなかった操作",
          value: isFailed
            ? `${run.failedAt! + 1} 番目の「${plan[run.failedAt!]}」`
            : "なし",
          tone: isFailed ? "bad" : "ok",
        },
        { label: "次にできる操作", value: exitsText(run.status) },
      ];
    },
  },
};
