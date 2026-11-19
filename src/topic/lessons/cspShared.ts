import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import { deadlocks, divergence, explore, type Starvation, starvation } from "../csp";
import { POOL_CLIENTS, POOL_ENV, type PoolMode, poolSystem } from "../cspMore";

type Translate = (ja: string, en: string) => string;

// どの判定も数ミリ秒で終わるので、最上位で必要な分だけ呼ぶ。
const ANY = poolSystem("anyOrder");
const FIFO = poolSystem("fifo");
const ANY_LTS = explore(ANY, POOL_ENV);
const FIFO_LTS = explore(FIFO, POOL_ENV);
const ANY_DEADLOCKS = deadlocks(ANY, POOL_ENV);
const ANY_DIVERGENCE = divergence(ANY, POOL_ENV);
const ANY_STARVATION = starvation(ANY, POOL_ENV, "req.B", "resp.B");
if (!ANY_STARVATION) {
  throw new Error("好きな順の受け箱で、B の飢餓が見つからない");
}
const STARVE = ANY_STARVATION;
const FIFO_STARVATION = starvation(FIFO, POOL_ENV, "req.B", "resp.B");

function eventsText(events: string[], t: Translate): string {
  return events.length > 0 ? events.join(" → ") : t("なし", "none");
}

function starvationText(result: Starvation | null, t: Translate): string {
  if (!result) return t("なし（必ず応答をもらえる）", "none (always gets a response)");
  return t(
    `${eventsText(result.trace, t)}の後、${eventsText(result.cycle, t)}を繰り返せる`,
    `after ${eventsText(result.trace, t)}, can repeat ${eventsText(result.cycle, t)}`,
  );
}

function modeName(mode: PoolMode, t: Translate): string {
  return mode === "anyOrder" ? t("好きな順", "any order") : t("先着順", "first come");
}

function parseMode(text: string | undefined): PoolMode {
  // 「先着」（英語は first / fifo）と書いたときだけ先着順にする。それ以外は既定の「好きな順」に戻す。
  const lower = (text ?? "").toLowerCase();
  const isFifo =
    lower.includes("先着") || lower.includes("first") || lower.includes("fifo");
  return isFifo ? "fifo" : "anyOrder";
}

function parseClient(text: string | undefined): string {
  // 客の名前（A / B）を探し、無ければ既定の B に戻す。
  const upper = (text ?? "").toUpperCase();
  return POOL_CLIENTS.find((who) => upper.includes(who)) ?? "B";
}

export function cspSharedLesson(language: Language): Lesson {
  const t = translator(language);
  const events = (list: string[]) => eventsText(list, t);
  const yesNo = (value: unknown) => (value ? t("あり", "yes") : t("なし", "no"));
  return {
    id: "csp-shared",
    category: "apply",
    title: t("共用チャネルと飢餓", "Shared channels and starvation"),
    subtitle: t(
      "止まらないのに、1人だけ永遠に待たされる",
      "Nothing stops, yet one client waits forever",
    ),
    summary: t(
      `2人の客が1つの受け箱を共用し、サーバーが好きな依頼を取り出すと、Bが頼んだままAだけが回り続ける実行がある（飢餓）。先着順にすると${FIFO_STARVATION ? "まだ起きる" : "起きない"}。`,
      `Two clients share one inbox. If the server may take any request, there is a run where B waits while only A keeps going (starvation). With first come, first served, it ${FIFO_STARVATION ? "still happens" : "does not happen"}.`,
    ),
    intro: [
      t(
        "複数の客が1つのチャネルを共用し、1つのサーバーが依頼を取り出して応答する形を扱う。飢餓（starvation）とは、全体は動き続けているのに、特定の誰かだけが永遠に順番を得られない状態をいう。",
        "Several clients share one channel, and one server takes requests and responds. Starvation means the system as a whole keeps running, yet one particular client never gets its turn.",
      ),
      t(
        "飢餓では全体が止まらないので、デッドロックの検査でも、時間制限の無いテストでも気づきにくい。これまでの「止まるか」に加えて、「誰もがいつか先へ進めるか」を検査で確かめる。",
        'Because nothing stops, neither a deadlock check nor a test without a time limit easily notices it. On top of "does it stop?", we now check "does everyone eventually make progress?".',
      ),
      t(
        "図では「客A」「客B」から「受け箱」へ入る依頼と、「サーバー」が取り出す順を追う。Bの依頼が受け箱に入った後、次に取り出されるのが誰の依頼かに注目し、受け箱の規則を変えたときの違いを見る。",
        "In the diagram, follow the requests from Client A and Client B into the Inbox, and the order in which the Server takes them. After B's request enters the inbox, watch whose request is taken next, and how that changes when the inbox rule changes.",
      ),
    ],
    facts: [
      {
        label: t("好きな順", "Any order"),
        value: t(
          `飢餓${ANY_STARVATION ? "あり" : "なし"}（${ANY_LTS.stateCount}状態）`,
          `starvation: ${ANY_STARVATION ? "yes" : "no"} (${ANY_LTS.stateCount} states)`,
        ),
        tone: ANY_STARVATION ? "bad" : "ok",
      },
      {
        label: t("先着順", "First come"),
        value: t(
          `飢餓${FIFO_STARVATION ? "あり" : "なし"}（${FIFO_LTS.stateCount}状態）`,
          `starvation: ${FIFO_STARVATION ? "yes" : "no"} (${FIFO_LTS.stateCount} states)`,
        ),
        tone: FIFO_STARVATION ? "bad" : "ok",
      },
      {
        label: t("好きな順の輪", "Loop with any order"),
        value: events(STARVE.cycle),
        tone: "bad",
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 8.1節（共用チャネル）`,
          `${CSP_BOOK_EN}, section 8.1 (shared channels)`,
        ),
      },
    ],
    actors: [
      {
        id: "clientA",
        label: t("客A", "Client A"),
        sublabel: t("依頼を繰り返す", "keeps requesting"),
        icon: "person",
        x: 14,
        y: 27,
      },
      {
        id: "clientB",
        label: t("客B", "Client B"),
        sublabel: t("依頼を繰り返す", "keeps requesting"),
        icon: "person",
        x: 14,
        y: 73,
      },
      {
        id: "box",
        label: t("受け箱", "Inbox"),
        sublabel: t("2人で共用", "shared by two"),
        icon: "queue",
        x: 40,
        y: 27,
        initial: { rows: { [t("取り出し", "takes")]: modeName("anyOrder", t) } },
      },
      {
        id: "server",
        label: t("サーバー", "Server"),
        sublabel: t("取り出して応答", "takes and responds"),
        icon: "server",
        x: 66,
        y: 27,
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("Bが待たされ続けるか", "does B wait forever?"),
        icon: "checker",
        x: 66,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "clientA", to: "box" },
      { from: "clientB", to: "box" },
      { from: "box", to: "server" },
      { from: "checker", to: "server" },
    ],
    steps: [
      {
        id: "shared",
        kind: "spec",
        title: t("1つの受け箱を共用", "Share one inbox"),
        actor: "box",
        summary: t(
          `客AとBが1つの受け箱へ依頼を入れ、1つのサーバーが取り出す（${ANY_LTS.stateCount}状態）`,
          `Clients A and B put requests into one inbox, and one server takes them (${ANY_LTS.stateCount} states)`,
        ),
        explain: t(
          `客は req.客（依頼を受け箱に入れる）をして、resp.客（応答をもらう）を待ち、また依頼する。サーバーは take.客（受け箱から1つ取り出す）をして、その客に応答する。1つのチャネルを複数の客が共用する多対1の形で、全体は${ANY_LTS.stateCount}状態になる。`,
          `A client does req.c (puts a request in the inbox), waits for resp.c (gets the response), then requests again. The server does take.c (takes one request from the inbox) and responds to that client. Many clients share one channel, a many-to-one shape, and the whole system has ${ANY_LTS.stateCount} states.`,
        ),
        set: { box: { tone: "idle" }, server: { tone: "idle" } },
        simplified: t(
          "式はこのサイトのモデル（cspMore.ts）の書き方で、実物の CSPM（FDR の記法）とは書き方が違う。受け箱には客ごとに依頼が1つまでしか入らない。",
          "The expressions use this site's model notation (cspMore.ts), which differs from real CSPM (the FDR notation). The inbox holds at most one request per client.",
        ),
      },
      {
        id: "request",
        kind: "run",
        title: t("Bが依頼を入れる", "B puts in a request"),
        actor: "clientB",
        to: ["box"],
        summary: t(
          `${events(STARVE.trace)}: Bの依頼が受け箱に入る`,
          `${events(STARVE.trace)}: B's request enters the inbox`,
        ),
        explain: t(
          "Bが依頼を受け箱に入れ、応答を待つ。受け箱のこの版は、入っている依頼のうちどれをサーバーに渡してもよい（好きな順）。",
          "B puts a request into the inbox and waits for the response. This version of the inbox may hand any of its requests to the server (any order).",
        ),
        set: {
          clientB: {
            tone: "wait",
            rows: { [t("状態", "status")]: t("応答待ち", "awaiting response") },
          },
          box: { rows: { [t("中身", "holds")]: "B" } },
        },
      },
      {
        id: "starve",
        kind: "found",
        title: t("Aだけが回り続ける", "Only A keeps going"),
        actor: "checker",
        to: ["server", "clientA"],
        summary: t(
          `好きな順: ${starvationText(ANY_STARVATION, t)}`,
          `Any order: ${starvationText(ANY_STARVATION, t)}`,
        ),
        explain: t(
          `検査器は「${events(STARVE.trace)}の後、${events(STARVE.cycle)}をいつまでも繰り返せる」という輪を見つけた。サーバーが毎回Aの依頼を先に取り出すと、Bの依頼は受け箱に入ったまま、応答 resp.B は永遠に来ない。これを飢餓（starvation）と呼ぶ。`,
          `The checker found a loop: "after ${events(STARVE.trace)}, ${events(STARVE.cycle)} can repeat forever". If the server always takes A's request first, B's request stays in the inbox and the response resp.B never comes. This is called starvation.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "bad",
            rows: { [t("輪", "loop")]: events(STARVE.cycle) },
          },
          clientA: {
            tone: "ok",
            rows: { [t("状態", "status")]: t("回り続ける", "keeps going") },
          },
          clientB: { tone: "bad" },
        },
        detail: [
          {
            title: t("検査器が返した飢餓", "Starvation the checker returned"),
            fields: [
              {
                label: t("輪に入るまで", "Before the loop"),
                value: events(STARVE.trace),
                isCode: true,
              },
              {
                label: t("繰り返す輪", "Repeating loop"),
                value: events(STARVE.cycle),
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "同じモデルを ProB で LTL の式 G([req.B] ⇒ F [resp.B])（Bが頼んだら、いつか必ず応答をもらう）で確かめ、好きな順は反例あり、先着順は成り立つことが一致した（specs/csp）。",
          "We checked the same model in ProB with the LTL formula G([req.B] ⇒ F [resp.B]) (if B requests, it eventually gets a response). ProB agreed: any order has a counterexample, and first come holds (specs/csp).",
        ),
      },
      {
        id: "notStuck",
        kind: "explore",
        title: t("止まってはいない", "Nothing is stuck"),
        actor: "checker",
        to: ["box", "server"],
        summary: t(
          `デッドロック${ANY_DEADLOCKS.length}件、発散${ANY_DIVERGENCE ? "あり" : "なし"}`,
          `${ANY_DEADLOCKS.length} ${ANY_DEADLOCKS.length === 1 ? "deadlock" : "deadlocks"}, divergence: ${ANY_DIVERGENCE ? "yes" : "no"}`,
        ),
        explain: t(
          `同じ全体を調べると、デッドロックは${ANY_DEADLOCKS.length}件で、発散（見えない動きだけの輪）も${ANY_DIVERGENCE ? "ある" : "無い"}。全体は止まらず動き続けているのに、特定の客だけが永遠に待たされる。デッドロックの検査だけでは見つからない不具合になる。`,
          `Checking the same system finds ${ANY_DEADLOCKS.length} ${ANY_DEADLOCKS.length === 1 ? "deadlock" : "deadlocks"}, and ${ANY_DIVERGENCE ? "there is" : "there is no"} divergence (a loop of invisible moves only). The system never stops, yet one client waits forever. A deadlock check alone cannot find this bug.`,
        ),
        set: {
          server: {
            tone: "ok",
            rows: {
              [t("デッドロック", "deadlocks")]: t(
                `${ANY_DEADLOCKS.length}件`,
                `${ANY_DEADLOCKS.length}`,
              ),
            },
          },
        },
      },
      {
        id: "fifo",
        kind: "fix",
        title: t("先着順にする", "Switch to first come"),
        actor: "box",
        to: ["server"],
        summary: t(
          `先着順の受け箱: 飢餓${FIFO_STARVATION ? "あり" : "なし"}（${FIFO_LTS.stateCount}状態）`,
          `First-come inbox: ${FIFO_STARVATION ? "starvation" : "no starvation"} (${FIFO_LTS.stateCount} states)`,
        ),
        explain: t(
          `受け箱を、いちばん先に入った依頼だけを渡す先着順の列に変える。Bが先に入れた依頼は、Aが次に入れる依頼より先に取り出されるので、検査器は飢餓を${FIFO_STARVATION ? "まだ見つけた" : "見つけなかった"}。状態は${FIFO_LTS.stateCount}個になる。`,
          `Change the inbox to a first-come queue that only hands over the oldest request. B's earlier request is taken before A's next one, so the checker ${FIFO_STARVATION ? "still found" : "found no"} starvation. There are ${FIFO_LTS.stateCount} states.`,
        ),
        set: {
          box: {
            tone: "ok",
            rows: {
              [t("取り出し", "takes")]: modeName("fifo", t),
              [t("中身", "holds")]: null,
            },
          },
          clientB: {
            tone: FIFO_STARVATION ? "bad" : "ok",
            rows: {
              [t("状態", "status")]: FIFO_STARVATION
                ? t("待たされうる", "may wait")
                : t("必ず応答", "always answered"),
            },
          },
          clientA: { tone: "ok", rows: { [t("状態", "status")]: null } },
          checker: {
            tone: FIFO_STARVATION ? "bad" : "ok",
            rows: {
              [t("輪", "loop")]: FIFO_STARVATION
                ? events(FIFO_STARVATION.cycle)
                : t("なし", "none"),
            },
          },
        },
      },
      {
        id: "testing",
        kind: "test",
        title: t("取り出し順を疑う", "Question the take order"),
        actor: "checker",
        to: ["box"],
        summary: t(
          "ワーカープールやメッセージキューの取り出し順の規則を検査する",
          "Check the take-order rules of worker pools and message queues",
        ),
        explain: t(
          "ワーカープールやメッセージキューで、優先度や取り出し順の設計を誤ると同じことが起きる。この検査は公平性（いつか全員に順番が来るという仮定）を置かないので、実装のスケジューラが公平でも、取り出し順の規則そのものが不公平なら見つかる。",
          "The same thing happens in worker pools and message queues when priorities or take order are designed wrong. This check assumes no fairness (that everyone eventually gets a turn), so even if the real scheduler is fair, it finds a take-order rule that is itself unfair.",
        ),
        set: { box: { tone: "ok" }, checker: { tone: "idle" } },
        simplified: t(
          "このサイトの飢餓の検査は、依頼してから応答までの間に、応答を含まない輪で回り続けられるかを探す。公平性は仮定していない。",
          "This site's starvation check looks for a loop without the response that can repeat between a request and its response. It assumes no fairness.",
        ),
      },
    ],
    lab: {
      title: t("受け箱と見る客", "Inbox and client to watch"),
      hint: t(
        "受け箱に「好きな順」か「先着順」、見る客に「A」か「B」を書くと、その客が頼んだまま待たされ続ける輪（飢餓）があるかを出す。",
        'Enter "any order" or "first come" for the inbox and "A" or "B" for the client. It shows whether there is a loop where that client waits forever after requesting (starvation).',
      ),
      inputs: [
        {
          id: "mode",
          label: t("受け箱（好きな順 / 先着順）", "Inbox (any order / first come)"),
          initial: t("好きな順", "any order"),
        },
        { id: "client", label: t("見る客（A / B）", "Client (A / B)"), initial: "B" },
      ],
      compute: (values): Field[] => {
        const mode = parseMode(values.mode);
        const who = parseClient(values.client);
        const system = poolSystem(mode);
        const lts = explore(system, POOL_ENV);
        const result = starvation(system, POOL_ENV, `req.${who}`, `resp.${who}`);
        return [
          { label: t("受け箱", "Inbox"), value: modeName(mode, t) },
          { label: t("見る客", "Client"), value: who },
          {
            label: t("状態", "States"),
            value: t(`${lts.stateCount}個`, `${lts.stateCount}`),
          },
          {
            label: t("飢餓", "Starvation"),
            value: yesNo(result),
            tone: result ? "bad" : "ok",
          },
          {
            label: t("輪", "Loop"),
            value: starvationText(result, t),
            tone: result ? "bad" : "ok",
          },
        ];
      },
    },
  };
}
