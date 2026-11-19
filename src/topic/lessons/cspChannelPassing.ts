import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import { acceptsTrace, explore, traceRefines } from "../csp";
import {
  SESSION_ENV,
  sessionExclusiveSpec,
  sessionSystem,
  sessionView,
} from "../cspSession";

const WATCHED = "s1";
const OK_STATES = explore(sessionSystem(false), SESSION_ENV).stateCount;
const BUG_STATES = explore(sessionSystem(true), SESSION_ENV).stateCount;
const OK_RESULT = traceRefines(
  sessionExclusiveSpec(WATCHED),
  sessionView(sessionSystem(false), WATCHED),
  SESSION_ENV,
);
const BUG_RESULT = traceRefines(
  sessionExclusiveSpec(WATCHED),
  sessionView(sessionSystem(true), WATCHED),
  SESSION_ENV,
);
if (OK_RESULT.holds === false || !BUG_RESULT.counterexample) {
  throw new Error("チャネル渡しの結果が想定と違う（覚える役は成立、覚えない役は反例）");
}
const COUNTEREXAMPLE = BUG_RESULT.counterexample;

/** 「assign.A.s1」を客とセッションに分ける。想定の形でなければ止める。 */
function parseEvent(event: string): { verb: string; client: string; session: string } {
  const [verb, client, session, ...rest] = event.split(".");
  if (!verb || !client || !session || rest.length > 0) {
    throw new Error(`イベントの形が想定と違う: ${event}`);
  }
  return { verb, client, session };
}

const BUG_EVENTS = COUNTEREXAMPLE.map(parseEvent);
if (
  BUG_EVENTS.length !== 2 ||
  BUG_EVENTS.some((e) => e.verb !== "assign" || e.session !== WATCHED) ||
  BUG_EVENTS[0]!.client === BUG_EVENTS[1]!.client
) {
  throw new Error(`覚えない役の反例が想定の形ではない: ${COUNTEREXAMPLE.join(" → ")}`);
}
const [FIRST, SECOND] = BUG_EVENTS as [
  (typeof BUG_EVENTS)[number],
  (typeof BUG_EVENTS)[number],
];

// 反例の後、2人とも同じセッションで話せる（会話が混ざる）ことを確かめる。
const MIXED = [
  ...COUNTEREXAMPLE,
  `talk.${FIRST.client}.${WATCHED}`,
  `talk.${SECOND.client}.${WATCHED}`,
];
if (!acceptsTrace(sessionSystem(true), SESSION_ENV, MIXED).isAccepted) {
  throw new Error(`反例の後に2人が同じセッションで話せない: ${MIXED.join(" → ")}`);
}

// 1回の受け渡しの流れ。モデルが本当に起こせる並びかを確かめてから見せる。
const ROUND = ["assign.A.s1", "talk.A.s1", "release.A.s1"];
const ROUND_CHECK = acceptsTrace(sessionSystem(false), SESSION_ENV, ROUND);
if (!ROUND_CHECK.isAccepted) {
  throw new Error(`受け渡しの並びをモデルが起こせない: ${ROUND.join(" → ")}`);
}

function traceText(trace: string[]): string {
  return trace.join(" → ");
}

function parseForgetful(text: string | undefined): boolean {
  const trimmed = (text ?? "").trim();
  if (trimmed.includes("覚えない")) return true;
  // 読めない入力は既定の「覚える」に戻す
  return false;
}

function parseSession(text: string | undefined): string {
  const trimmed = (text ?? "").trim();
  return trimmed === "s2" ? "s2" : "s1";
}

export const cspChannelPassingLesson: Lesson = {
  id: "csp-channel-passing",
  category: "apply",
  title: "チャネルを渡す",
  subtitle: "渡したセッションの名前で、その後の通信先が決まる",
  summary: `振り分け役が空いているセッション（s1・s2）を客に渡し、客はそのセッションで話してから返す。空きを覚える振り分け役は「渡したら返されるまでほかの人に渡さない」を満たし、覚えない役は「${traceText(COUNTEREXAMPLE)}」で同じセッションを2人に渡す。`,
  intro: [
    "チャネル渡しとは、チャネルの名前そのものを値として送り、受け取った側がその名前で次の通信先を決める書き方である。ここでは振り分け役が、空いているセッションの名前を客に渡す。",
    "同じセッションを2人に貸してしまう誤りは、借りる・返すのタイミングが重なったときにしか起きないので、テストで偶然に出会うのを待つのは心もとない。検査器なら、渡し方の順番をすべてたどって確かめられる。",
    "図では「振り分け役」から客へ渡るセッション名と、客がそのセッションで話す流れを追う。検査器は s1の受け渡しだけに絞って見ている。振り分け役を空きを覚えない版に替えたとき、s1が誰に渡るかが分かれ目になる。",
  ],
  facts: [
    {
      label: "空きを覚える役",
      value: `${OK_STATES}状態・仕様を${OK_RESULT.holds ? "満たす" : "満たさない"}`,
      tone: "ok",
    },
    {
      label: "空きを覚えない役",
      value: `${BUG_STATES}状態・反例${traceText(COUNTEREXAMPLE)}`,
      tone: "bad",
    },
    { label: "見たセッション", value: WATCHED },
    { label: "参考文献", value: `${CSP_BOOK} 9.1節（チャネル渡し）` },
  ],
  actors: [
    {
      id: "clientA",
      label: "客A",
      sublabel: "受け取ったセッションで話す",
      icon: "person",
      x: 14,
      y: 27,
      initial: { rows: { セッション: "なし" } },
    },
    {
      id: "balancer",
      label: "振り分け役",
      sublabel: "空いているセッションを渡す",
      icon: "server",
      x: 50,
      y: 27,
      initial: { rows: { 空き: "s1・s2" } },
    },
    {
      id: "clientB",
      label: "客B",
      sublabel: "受け取ったセッションで話す",
      icon: "person",
      x: 86,
      y: 27,
      initial: { rows: { セッション: "なし" } },
    },
    {
      id: "s1",
      label: "セッション s1",
      sublabel: "talk.客.s1 で話す",
      icon: "network",
      x: 26,
      y: 73,
      initial: { rows: { 使う人: "なし" } },
    },
    {
      id: "s2",
      label: "セッション s2",
      sublabel: "talk.客.s2 で話す",
      icon: "network",
      x: 50,
      y: 73,
      initial: { rows: { 使う人: "なし" } },
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "s1の受け渡しだけを見る",
      icon: "checker",
      x: 76,
      y: 73,
      initial: { isHidden: true },
    },
  ],
  links: [
    { from: "balancer", to: "clientA" },
    { from: "balancer", to: "clientB" },
    { from: "clientA", to: "s1" },
    { from: "clientB", to: "s2" },
    { from: "checker", to: "balancer" },
  ],
  steps: [
    {
      id: "assign",
      kind: "spec",
      title: "空きを客に渡す",
      actor: "balancer",
      to: ["clientA"],
      summary: `${ROUND[0]}: 振り分け役が客Aにセッション s1を渡す`,
      explain:
        "イベント assign.A.s1 は「振り分け役が客Aにセッション s1を渡した」という意味。振り分け役は空いているセッションを覚えていて、渡した s1を空きから外す。",
      set: {
        balancer: { rows: { 空き: "s2" } },
        clientA: { tone: "wait", rows: { セッション: "s1" } },
        s1: { tone: "wait", rows: { 使う人: "A" } },
      },
    },
    {
      id: "talk",
      kind: "run",
      title: "渡された名前で話す",
      actor: "clientA",
      to: ["s1"],
      summary: `${ROUND[1]}: 客Aは受け取った s1で話す`,
      explain:
        "talk.A.s1 は「客Aがセッション s1で話した」という意味。客は渡された名前 s1を覚え、その後の通信先をそれで決める。渡すデータがチャネルの名前で、どこで話すかがそれで変わる。この形をチャネル渡しと呼ぶ。",
      set: {
        clientA: { tone: "ok" },
        s1: { tone: "ok", rows: { 使う人: "A" } },
      },
      detail: [
        {
          title: "1回の受け渡し（モデルが起こせる並び）",
          fields: [{ label: "並び", value: traceText(ROUND), isCode: true }],
        },
        {
          title: "客のモデル（このサイトの書き方）",
          fields: [
            {
              label: "客A",
              value:
                "Client(A) = □ s ∈ {s1, s2} • assign.A.s → talk.A.s → release.A.s → Client(A)",
              isCode: true,
            },
          ],
        },
      ],
      simplified:
        "このサイトのモデルは、渡すセッションの名前をイベント名の一部（assign.A.s1）として書き、受け取った名前ごとに分かれる。照合に使った CSPM（specs/csp/Models.csp）では、assign を客とセッションの組を運ぶチャネルとして宣言し、名前をデータとして流している。式はこのサイトのモデル（cspSession.ts）に合わせたもので、実物の CSPM（FDR の記法）とは書き方が違う。",
    },
    {
      id: "release",
      kind: "run",
      title: "返して空きに戻す",
      actor: "clientA",
      to: ["balancer"],
      summary: `${ROUND[2]}: 客Aが s1を返し、振り分け役の空きに戻る`,
      explain:
        "release.A.s1 は「客Aがセッション s1を返した」という意味。振り分け役は s1を空きに戻し、次の客に渡せるようになる。",
      set: {
        balancer: { rows: { 空き: "s1・s2" } },
        clientA: { tone: "idle", rows: { セッション: "なし" } },
        s1: { tone: "idle", rows: { 使う人: "なし" } },
      },
    },
    {
      id: "spec",
      kind: "spec",
      title: "s1の受け渡しを見る",
      actor: "checker",
      to: ["balancer"],
      summary: `仕様: s1を渡したら、返されるまでほかの人に渡さない（全体は${OK_STATES}状態）`,
      explain: `仕様は「s1を誰かに渡したら、その人が返すまで、ほかの人には渡さない」。全体（${OK_STATES}状態）のうち、s1の assign と release だけを残し、talk と s2の動きは隠す。見たい性質に関係する動きだけを比べると、仕様を短く書ける。`,
      set: {
        checker: { isHidden: false, tone: "wait", rows: { 仕様: "渡す→返す→…" } },
      },
      detail: [
        {
          title: "仕様（このサイトの書き方）",
          fields: [
            {
              label: "Exclusive(s1)",
              value: "□ c ∈ {A, B} • assign.c.s1 → release.c.s1 → Exclusive(s1)",
              isCode: true,
            },
          ],
        },
      ],
      simplified:
        "式はこのサイトのモデル（cspSession.ts）に合わせたもので、実物の CSPM（FDR の記法）とは書き方が違う。",
    },
    {
      id: "holds",
      kind: "explore",
      title: "覚える役は満たす",
      actor: "checker",
      to: ["balancer"],
      summary: `空きを覚える振り分け役は、トレース詳細化で仕様を${OK_RESULT.holds ? "満たす" : "満たさない"}`,
      explain: `空きを覚える振り分け役は、使用中の s1を渡さない。s1の受け渡しだけを見たとき、起こせる並びはどれも仕様が起こせる並びに含まれる（トレース詳細化が成り立つ）。${OK_STATES}状態を全部たどって確かめた。`,
      set: {
        checker: { tone: "ok", rows: { 結果: "満たす", 状態: `${OK_STATES}個` } },
        balancer: { tone: "ok" },
      },
      simplified:
        "同じモデルを ProB で確かめ、結果と反例が一致した（specs/csp）。照合したのは s1を見た場合の2件（覚える役・覚えない役）だけ。",
    },
    {
      id: "forgetful",
      kind: "found",
      title: "覚えない役は2人に",
      actor: "balancer",
      to: ["clientA", "clientB"],
      summary: `空きを覚えない振り分け役の反例: ${traceText(COUNTEREXAMPLE)}`,
      explain: `使用中かを覚えない振り分け役（${BUG_STATES}状態）では、「${COUNTEREXAMPLE[0]}」の直後に「${COUNTEREXAMPLE[1]}」が起きる。客${FIRST.client}がまだ返していない${WATCHED}を客${SECOND.client}にも渡すので、2人が同じセッションで話し、ほかの人の会話に混ざる。`,
      set: {
        balancer: { tone: "bad", rows: { 空き: "覚えていない" } },
        [`client${FIRST.client}`]: { tone: "bad", rows: { セッション: WATCHED } },
        [`client${SECOND.client}`]: { tone: "bad", rows: { セッション: WATCHED } },
        s1: { tone: "bad", rows: { 使う人: `${FIRST.client}と${SECOND.client}` } },
        checker: { tone: "bad", rows: { 結果: "破れた", 状態: `${BUG_STATES}個` } },
      },
      detail: [
        {
          title: "検査器が見つけた最短の反例",
          fields: COUNTEREXAMPLE.map((event, index) => ({
            label: `${index + 1}手目`,
            value: event,
            isCode: true,
          })),
        },
        {
          title: "その後に起こせる並び（2人が同じセッションで話す）",
          fields: [{ label: "並び", value: traceText(MIXED), isCode: true }],
        },
      ],
    },
    {
      id: "test",
      kind: "test",
      title: "混線をテストで見る",
      actor: "checker",
      to: ["clientA", "clientB"],
      summary: "接続プールやセッション管理の「使用中」の扱いを、反例の並びでテストする",
      explain: `接続プールやセッション管理で「使用中」の管理を誤ると、同じ接続を2つの処理が使い、応答が入れ替わる混線が起きる。テストでは、反例と同じく「返す前に別の客が借りる」並びを作り、同じ接続が2人に渡らないことを確かめる。`,
      set: {
        checker: { tone: "ok", rows: { テスト: "返す前に別の客が借りる" } },
      },
    },
  ],
  lab: {
    title: "振り分け役と見るセッションを変える",
    hint: "振り分け役は「覚える」か「覚えない」、見るセッションは「s1」か「s2」。覚えない役は、どちらのセッションでも2人に渡してしまう。",
    inputs: [
      { id: "balancer", label: "振り分け役（覚える / 覚えない）", initial: "覚えない" },
      { id: "session", label: "見るセッション（s1 / s2）", initial: "s1" },
    ],
    compute: (values): Field[] => {
      const isForgetful = parseForgetful(values.balancer);
      const session = parseSession(values.session);
      const system = sessionSystem(isForgetful);
      const result = traceRefines(
        sessionExclusiveSpec(session),
        sessionView(system, session),
        SESSION_ENV,
      );
      return [
        { label: "振り分け役", value: isForgetful ? "空きを覚えない" : "空きを覚える" },
        { label: "見るセッション", value: session },
        { label: "全体の状態", value: `${explore(system, SESSION_ENV).stateCount}個` },
        {
          label: "仕様を満たすか",
          value: result.holds ? "満たす" : "満たさない",
          tone: result.holds ? "ok" : "bad",
        },
        {
          label: "反例",
          value: result.counterexample ? traceText(result.counterexample) : "なし",
          tone: result.counterexample ? "bad" : "ok",
          isCode: result.counterexample !== null,
        },
      ];
    },
  },
};
