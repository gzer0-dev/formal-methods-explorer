import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
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
  const trimmed = (text ?? "").trim().toLowerCase();
  if (trimmed.includes("覚えない") || trimmed.includes("forget")) return true;
  // 読めない入力は既定の「覚える」に戻す
  return false;
}

function parseSession(text: string | undefined): string {
  const trimmed = (text ?? "").trim();
  return trimmed === "s2" ? "s2" : "s1";
}

export function cspChannelPassingLesson(language: Language): Lesson {
  const t = translator(language);
  const satisfies = (holds: boolean) =>
    holds ? t("満たす", "satisfied") : t("満たさない", "not satisfied");
  const states = (count: number) => t(`${count}個`, `${count}`);
  const none = t("なし", "none");
  return {
    id: "csp-channel-passing",
    category: "apply",
    title: t("チャネルを渡す", "Passing channels"),
    subtitle: t(
      "渡したセッションの名前で、その後の通信先が決まる",
      "The session name handed over decides where the client talks next",
    ),
    summary: t(
      `振り分け役が空いているセッション（s1・s2）を客に渡し、客はそのセッションで話してから返す。空きを覚える振り分け役は「渡したら返されるまでほかの人に渡さない」を満たし、覚えない役は「${traceText(COUNTEREXAMPLE)}」で同じセッションを2人に渡す。`,
      `A balancer hands a free session (s1 or s2) to a client, who talks on it and then returns it. A balancer that remembers which sessions are free satisfies "once handed out, never given to anyone else until returned"; one that forgets hands the same session to two clients with "${traceText(COUNTEREXAMPLE)}".`,
    ),
    intro: [
      t(
        "チャネル渡しとは、チャネルの名前そのものを値として送り、受け取った側がその名前で次の通信先を決める書き方である。ここでは振り分け役が、空いているセッションの名前を客に渡す。",
        "Channel passing means sending the name of a channel itself as a value; the receiver uses that name to decide where it communicates next. Here a balancer hands the name of a free session to a client.",
      ),
      t(
        "同じセッションを2人に貸してしまう誤りは、借りる・返すのタイミングが重なったときにしか起きないので、テストで偶然に出会うのを待つのは心もとない。検査器なら、渡し方の順番をすべてたどって確かめられる。",
        "Lending one session to two clients only happens when borrowing and returning overlap in time, so waiting for a test to hit it by chance is unreliable. A checker can walk every order of hand-outs and confirm it.",
      ),
      t(
        "図では「振り分け役」から客へ渡るセッション名と、客がそのセッションで話す流れを追う。検査器は s1の受け渡しだけに絞って見ている。振り分け役を空きを覚えない版に替えたとき、s1が誰に渡るかが分かれ目になる。",
        "In the diagram, follow the session name going from the Balancer to a client, and the client talking on that session. The checker looks only at how s1 is handed out. The key moment is who gets s1 once the balancer is swapped for one that forgets which sessions are free.",
      ),
    ],
    facts: [
      {
        label: t("空きを覚える役", "Remembering balancer"),
        value: t(
          `${OK_STATES}状態・仕様を${OK_RESULT.holds ? "満たす" : "満たさない"}`,
          `${OK_STATES} states, spec ${satisfies(OK_RESULT.holds)}`,
        ),
        tone: "ok",
      },
      {
        label: t("空きを覚えない役", "Forgetful balancer"),
        value: t(
          `${BUG_STATES}状態・反例${traceText(COUNTEREXAMPLE)}`,
          `${BUG_STATES} states, counterexample ${traceText(COUNTEREXAMPLE)}`,
        ),
        tone: "bad",
      },
      { label: t("見たセッション", "Session watched"), value: WATCHED },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 9.1節（チャネル渡し）`,
          `${CSP_BOOK_EN}, section 9.1 (channel passing)`,
        ),
      },
    ],
    actors: [
      {
        id: "clientA",
        label: t("客A", "Client A"),
        sublabel: t("受け取ったセッションで話す", "talks on the session it got"),
        icon: "person",
        x: 14,
        y: 27,
        initial: { rows: { [t("セッション", "session")]: none } },
      },
      {
        id: "balancer",
        label: t("振り分け役", "Balancer"),
        sublabel: t("空いているセッションを渡す", "hands out free sessions"),
        icon: "server",
        x: 50,
        y: 27,
        initial: { rows: { [t("空き", "free")]: t("s1・s2", "s1, s2") } },
      },
      {
        id: "clientB",
        label: t("客B", "Client B"),
        sublabel: t("受け取ったセッションで話す", "talks on the session it got"),
        icon: "person",
        x: 86,
        y: 27,
        initial: { rows: { [t("セッション", "session")]: none } },
      },
      {
        id: "s1",
        label: t("セッション s1", "Session s1"),
        sublabel: t("talk.客.s1 で話す", "talk on talk.c.s1"),
        icon: "network",
        x: 26,
        y: 73,
        initial: { rows: { [t("使う人", "users")]: none } },
      },
      {
        id: "s2",
        label: t("セッション s2", "Session s2"),
        sublabel: t("talk.客.s2 で話す", "talk on talk.c.s2"),
        icon: "network",
        x: 50,
        y: 73,
        initial: { rows: { [t("使う人", "users")]: none } },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("s1の受け渡しだけを見る", "watches only s1 hand-outs"),
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
        title: t("空きを客に渡す", "Hand a free session out"),
        actor: "balancer",
        to: ["clientA"],
        summary: t(
          `${ROUND[0]}: 振り分け役が客Aにセッション s1を渡す`,
          `${ROUND[0]}: the balancer hands session s1 to client A`,
        ),
        explain: t(
          "イベント assign.A.s1 は「振り分け役が客Aにセッション s1を渡した」という意味。振り分け役は空いているセッションを覚えていて、渡した s1を空きから外す。",
          'The event assign.A.s1 means "the balancer handed session s1 to client A". The balancer remembers which sessions are free and removes s1 from the free list once it is handed out.',
        ),
        set: {
          balancer: { rows: { [t("空き", "free")]: "s2" } },
          clientA: { tone: "wait", rows: { [t("セッション", "session")]: "s1" } },
          s1: { tone: "wait", rows: { [t("使う人", "users")]: "A" } },
        },
      },
      {
        id: "talk",
        kind: "run",
        title: t("渡された名前で話す", "Talk on the name received"),
        actor: "clientA",
        to: ["s1"],
        summary: t(
          `${ROUND[1]}: 客Aは受け取った s1で話す`,
          `${ROUND[1]}: client A talks on the s1 it received`,
        ),
        explain: t(
          "talk.A.s1 は「客Aがセッション s1で話した」という意味。客は渡された名前 s1を覚え、その後の通信先をそれで決める。渡すデータがチャネルの名前で、どこで話すかがそれで変わる。この形をチャネル渡しと呼ぶ。",
          'talk.A.s1 means "client A talked on session s1". The client keeps the name s1 it was given and uses it to decide where it communicates next. The data passed is a channel name, and it changes where the talking happens. This pattern is called channel passing.',
        ),
        set: {
          clientA: { tone: "ok" },
          s1: { tone: "ok", rows: { [t("使う人", "users")]: "A" } },
        },
        detail: [
          {
            title: t(
              "1回の受け渡し（モデルが起こせる並び）",
              "One hand-out (a trace the model can perform)",
            ),
            fields: [
              { label: t("並び", "Trace"), value: traceText(ROUND), isCode: true },
            ],
          },
          {
            title: t(
              "客のモデル（このサイトの書き方）",
              "Client model (this site's notation)",
            ),
            fields: [
              {
                label: t("客A", "Client A"),
                value:
                  "Client(A) = □ s ∈ {s1, s2} • assign.A.s → talk.A.s → release.A.s → Client(A)",
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "このサイトのモデルは、渡すセッションの名前をイベント名の一部（assign.A.s1）として書き、受け取った名前ごとに分かれる。照合に使った CSPM（specs/csp/Models.csp）では、assign を客とセッションの組を運ぶチャネルとして宣言し、名前をデータとして流している。式はこのサイトのモデル（cspSession.ts）に合わせたもので、実物の CSPM（FDR の記法）とは書き方が違う。",
          "This site's model writes the session name as part of the event name (assign.A.s1) and branches on each name received. The CSPM used for the cross-check (specs/csp/Models.csp) declares assign as a channel carrying a client-and-session pair, so the name flows as data. The expressions follow this site's model (cspSession.ts) and differ from real CSPM (the FDR notation).",
        ),
      },
      {
        id: "release",
        kind: "run",
        title: t("返して空きに戻す", "Return it to the free list"),
        actor: "clientA",
        to: ["balancer"],
        summary: t(
          `${ROUND[2]}: 客Aが s1を返し、振り分け役の空きに戻る`,
          `${ROUND[2]}: client A returns s1, and it is free again at the balancer`,
        ),
        explain: t(
          "release.A.s1 は「客Aがセッション s1を返した」という意味。振り分け役は s1を空きに戻し、次の客に渡せるようになる。",
          'release.A.s1 means "client A returned session s1". The balancer marks s1 as free again, so it can hand it to the next client.',
        ),
        set: {
          balancer: { rows: { [t("空き", "free")]: t("s1・s2", "s1, s2") } },
          clientA: { tone: "idle", rows: { [t("セッション", "session")]: none } },
          s1: { tone: "idle", rows: { [t("使う人", "users")]: none } },
        },
      },
      {
        id: "spec",
        kind: "spec",
        title: t("s1の受け渡しを見る", "Watch how s1 is handed out"),
        actor: "checker",
        to: ["balancer"],
        summary: t(
          `仕様: s1を渡したら、返されるまでほかの人に渡さない（全体は${OK_STATES}状態）`,
          `Spec: once s1 is handed out, nobody else gets it until it is returned (${OK_STATES} states in all)`,
        ),
        explain: t(
          `仕様は「s1を誰かに渡したら、その人が返すまで、ほかの人には渡さない」。全体（${OK_STATES}状態）のうち、s1の assign と release だけを残し、talk と s2の動きは隠す。見たい性質に関係する動きだけを比べると、仕様を短く書ける。`,
          `The spec is "once s1 is handed to someone, nobody else gets it until that client returns it". From the whole system (${OK_STATES} states), keep only the assign and release events for s1 and hide talk and everything about s2. Comparing only the events that matter for the property keeps the spec short.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "wait",
            rows: { [t("仕様", "spec")]: t("渡す→返す→…", "hand out→return→…") },
          },
        },
        detail: [
          {
            title: t("仕様（このサイトの書き方）", "Spec (this site's notation)"),
            fields: [
              {
                label: "Exclusive(s1)",
                value: "□ c ∈ {A, B} • assign.c.s1 → release.c.s1 → Exclusive(s1)",
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "式はこのサイトのモデル（cspSession.ts）に合わせたもので、実物の CSPM（FDR の記法）とは書き方が違う。",
          "The expressions follow this site's model (cspSession.ts) and differ from real CSPM (the FDR notation).",
        ),
      },
      {
        id: "holds",
        kind: "explore",
        title: t("覚える役は満たす", "Remembering one satisfies it"),
        actor: "checker",
        to: ["balancer"],
        summary: t(
          `空きを覚える振り分け役は、トレース詳細化で仕様を${OK_RESULT.holds ? "満たす" : "満たさない"}`,
          `Under trace refinement, the remembering balancer: spec ${satisfies(OK_RESULT.holds)}`,
        ),
        explain: t(
          `空きを覚える振り分け役は、使用中の s1を渡さない。s1の受け渡しだけを見たとき、起こせる並びはどれも仕様が起こせる並びに含まれる（トレース詳細化が成り立つ）。${OK_STATES}状態を全部たどって確かめた。`,
          `A balancer that remembers what is free never hands out s1 while it is in use. Looking only at how s1 is handed out, every trace it can perform is one the spec can perform too (trace refinement holds). This was confirmed by walking all ${OK_STATES} states.`,
        ),
        set: {
          checker: {
            tone: "ok",
            rows: {
              [t("結果", "result")]: t("満たす", "satisfied"),
              [t("状態", "states")]: states(OK_STATES),
            },
          },
          balancer: { tone: "ok" },
        },
        simplified: t(
          "同じモデルを ProB で確かめ、結果と反例が一致した（specs/csp）。照合したのは s1を見た場合の2件（覚える役・覚えない役）だけ。",
          "Checking the same models with ProB gave the same results and counterexample (specs/csp). Only the two cases watching s1 (remembering and forgetful balancer) were cross-checked.",
        ),
      },
      {
        id: "forgetful",
        kind: "found",
        title: t("覚えない役は2人に", "Forgetful one serves two"),
        actor: "balancer",
        to: ["clientA", "clientB"],
        summary: t(
          `空きを覚えない振り分け役の反例: ${traceText(COUNTEREXAMPLE)}`,
          `Counterexample for the forgetful balancer: ${traceText(COUNTEREXAMPLE)}`,
        ),
        explain: t(
          `使用中かを覚えない振り分け役（${BUG_STATES}状態）では、「${COUNTEREXAMPLE[0]}」の直後に「${COUNTEREXAMPLE[1]}」が起きる。客${FIRST.client}がまだ返していない${WATCHED}を客${SECOND.client}にも渡すので、2人が同じセッションで話し、ほかの人の会話に混ざる。`,
          `With a balancer that does not remember what is in use (${BUG_STATES} states), "${COUNTEREXAMPLE[1]}" happens right after "${COUNTEREXAMPLE[0]}". It also hands ${WATCHED}, which client ${FIRST.client} has not returned yet, to client ${SECOND.client}, so both talk on the same session and get mixed into each other's conversation.`,
        ),
        set: {
          balancer: {
            tone: "bad",
            rows: { [t("空き", "free")]: t("覚えていない", "not tracked") },
          },
          [`client${FIRST.client}`]: {
            tone: "bad",
            rows: { [t("セッション", "session")]: WATCHED },
          },
          [`client${SECOND.client}`]: {
            tone: "bad",
            rows: { [t("セッション", "session")]: WATCHED },
          },
          s1: {
            tone: "bad",
            rows: {
              [t("使う人", "users")]: t(
                `${FIRST.client}と${SECOND.client}`,
                `${FIRST.client} and ${SECOND.client}`,
              ),
            },
          },
          checker: {
            tone: "bad",
            rows: {
              [t("結果", "result")]: t("破れた", "fails"),
              [t("状態", "states")]: states(BUG_STATES),
            },
          },
        },
        detail: [
          {
            title: t("検査器が見つけた最短の反例", "Shortest counterexample found"),
            fields: COUNTEREXAMPLE.map((event, index) => ({
              label: t(`${index + 1}手目`, `Step ${index + 1}`),
              value: event,
              isCode: true,
            })),
          },
          {
            title: t(
              "その後に起こせる並び（2人が同じセッションで話す）",
              "What can happen next (both talk on one session)",
            ),
            fields: [
              { label: t("並び", "Trace"), value: traceText(MIXED), isCode: true },
            ],
          },
        ],
      },
      {
        id: "test",
        kind: "test",
        title: t("混線をテストで見る", "Test for crossed sessions"),
        actor: "checker",
        to: ["clientA", "clientB"],
        summary: t(
          "接続プールやセッション管理の「使用中」の扱いを、反例の並びでテストする",
          'Test the "in use" handling of a connection pool or session manager with the counterexample\'s order',
        ),
        explain: t(
          `接続プールやセッション管理で「使用中」の管理を誤ると、同じ接続を2つの処理が使い、応答が入れ替わる混線が起きる。テストでは、反例と同じく「返す前に別の客が借りる」並びを作り、同じ接続が2人に渡らないことを確かめる。`,
          `If a connection pool or session manager gets "in use" tracking wrong, two tasks use the same connection and their responses get swapped. In the test, build the same order as the counterexample, "another client borrows before it is returned", and check that one connection is never given to two clients.`,
        ),
        set: {
          checker: {
            tone: "ok",
            rows: {
              [t("テスト", "test")]: t(
                "返す前に別の客が借りる",
                "borrow before it is returned",
              ),
            },
          },
        },
      },
    ],
    lab: {
      title: t(
        "振り分け役と見るセッションを変える",
        "Change the balancer and the session watched",
      ),
      hint: t(
        "振り分け役は「覚える」か「覚えない」、見るセッションは「s1」か「s2」。覚えない役は、どちらのセッションでも2人に渡してしまう。",
        'Enter "remembers" or "forgets" for the balancer, and "s1" or "s2" for the session to watch. The forgetful balancer hands either session to two clients.',
      ),
      inputs: [
        {
          id: "balancer",
          label: t("振り分け役（覚える / 覚えない）", "Balancer (remembers / forgets)"),
          initial: t("覚えない", "forgets"),
        },
        {
          id: "session",
          label: t("見るセッション（s1 / s2）", "Session watched (s1 / s2)"),
          initial: "s1",
        },
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
          {
            label: t("振り分け役", "Balancer"),
            value: isForgetful
              ? t("空きを覚えない", "forgets what is free")
              : t("空きを覚える", "remembers what is free"),
          },
          { label: t("見るセッション", "Session watched"), value: session },
          {
            label: t("全体の状態", "States in all"),
            value: states(explore(system, SESSION_ENV).stateCount),
          },
          {
            label: t("仕様を満たすか", "Spec satisfied?"),
            value: result.holds ? t("満たす", "yes") : t("満たさない", "no"),
            tone: result.holds ? "ok" : "bad",
          },
          {
            label: t("反例", "Counterexample"),
            value: result.counterexample ? traceText(result.counterexample) : none,
            tone: result.counterexample ? "bad" : "ok",
            isCode: result.counterexample !== null,
          },
        ];
      },
    },
  };
}
