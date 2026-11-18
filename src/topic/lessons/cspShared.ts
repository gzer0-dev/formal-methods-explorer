import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import { deadlocks, divergence, explore, type Starvation, starvation } from "../csp";
import { POOL_CLIENTS, POOL_ENV, type PoolMode, poolSystem } from "../cspMore";

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

function eventsText(events: string[]): string {
  return events.length > 0 ? events.join(" → ") : "なし";
}

function starvationText(result: Starvation | null): string {
  if (!result) return "なし（必ず応答をもらえる）";
  return `${eventsText(result.trace)}の後、${eventsText(result.cycle)}を繰り返せる`;
}

function modeName(mode: PoolMode): string {
  return mode === "anyOrder" ? "好きな順" : "先着順";
}

function parseMode(text: string | undefined): PoolMode {
  // 「先着」と書いたときだけ先着順にする。それ以外は既定の「好きな順」に戻す。
  return (text ?? "").includes("先着") ? "fifo" : "anyOrder";
}

function parseClient(text: string | undefined): string {
  // 客の名前（A / B）を探し、無ければ既定の B に戻す。
  const upper = (text ?? "").toUpperCase();
  return POOL_CLIENTS.find((who) => upper.includes(who)) ?? "B";
}

export const cspSharedLesson: Lesson = {
  id: "csp-shared",
  category: "apply",
  title: "共用チャネルと飢餓",
  subtitle: "止まらないのに、1人だけ永遠に待たされる",
  summary: `2人の客が1つの受け箱を共用し、サーバーが好きな依頼を取り出すと、Bが頼んだままAだけが回り続ける実行がある（飢餓）。先着順にすると${FIFO_STARVATION ? "まだ起きる" : "起きない"}。`,
  facts: [
    {
      label: "好きな順",
      value: `飢餓${ANY_STARVATION ? "あり" : "なし"}（${ANY_LTS.stateCount}状態）`,
      tone: ANY_STARVATION ? "bad" : "ok",
    },
    {
      label: "先着順",
      value: `飢餓${FIFO_STARVATION ? "あり" : "なし"}（${FIFO_LTS.stateCount}状態）`,
      tone: FIFO_STARVATION ? "bad" : "ok",
    },
    {
      label: "好きな順の輪",
      value: eventsText(STARVE.cycle),
      tone: "bad",
    },
    { label: "参考文献", value: `${CSP_BOOK} 8.1節（共用チャネル）` },
  ],
  actors: [
    {
      id: "clientA",
      label: "客A",
      sublabel: "依頼を繰り返す",
      icon: "person",
      x: 14,
      y: 27,
    },
    {
      id: "clientB",
      label: "客B",
      sublabel: "依頼を繰り返す",
      icon: "person",
      x: 14,
      y: 73,
    },
    {
      id: "box",
      label: "受け箱",
      sublabel: "2人で共用",
      icon: "queue",
      x: 40,
      y: 27,
      initial: { rows: { 取り出し: modeName("anyOrder") } },
    },
    {
      id: "server",
      label: "サーバー",
      sublabel: "取り出して応答",
      icon: "server",
      x: 66,
      y: 27,
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "Bが待たされ続けるか",
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
      title: "1つの受け箱を共用",
      actor: "box",
      summary: `客AとBが1つの受け箱へ依頼を入れ、1つのサーバーが取り出す（${ANY_LTS.stateCount}状態）`,
      explain: `客は req.客（依頼を受け箱に入れる）をして、resp.客（応答をもらう）を待ち、また依頼する。サーバーは take.客（受け箱から1つ取り出す）をして、その客に応答する。1つのチャネルを複数の客が共用する多対1の形で、全体は${ANY_LTS.stateCount}状態になる。`,
      set: { box: { tone: "idle" }, server: { tone: "idle" } },
      simplified:
        "式はこのサイトのモデル（cspMore.ts）の書き方で、実物の CSPM（FDR の記法）とは書き方が違う。受け箱には客ごとに依頼が1つまでしか入らない。",
    },
    {
      id: "request",
      kind: "run",
      title: "Bが依頼を入れる",
      actor: "clientB",
      to: ["box"],
      summary: `${eventsText(STARVE.trace)}: Bの依頼が受け箱に入る`,
      explain:
        "Bが依頼を受け箱に入れ、応答を待つ。受け箱のこの版は、入っている依頼のうちどれをサーバーに渡してもよい（好きな順）。",
      set: {
        clientB: { tone: "wait", rows: { 状態: "応答待ち" } },
        box: { rows: { 中身: "B" } },
      },
    },
    {
      id: "starve",
      kind: "found",
      title: "Aだけが回り続ける",
      actor: "checker",
      to: ["server", "clientA"],
      summary: `好きな順: ${starvationText(ANY_STARVATION)}`,
      explain: `検査器は「${eventsText(STARVE.trace)}の後、${eventsText(STARVE.cycle)}をいつまでも繰り返せる」という輪を見つけた。サーバーが毎回Aの依頼を先に取り出すと、Bの依頼は受け箱に入ったまま、応答 resp.B は永遠に来ない。これを飢餓（starvation）と呼ぶ。`,
      set: {
        checker: {
          isHidden: false,
          tone: "bad",
          rows: { 輪: eventsText(STARVE.cycle) },
        },
        clientA: { tone: "ok", rows: { 状態: "回り続ける" } },
        clientB: { tone: "bad" },
      },
      detail: [
        {
          title: "検査器が返した飢餓",
          fields: [
            { label: "輪に入るまで", value: eventsText(STARVE.trace), isCode: true },
            { label: "繰り返す輪", value: eventsText(STARVE.cycle), isCode: true },
          ],
        },
      ],
      simplified:
        "同じモデルを ProB で LTL の式 G([req.B] ⇒ F [resp.B])（Bが頼んだら、いつか必ず応答をもらう）で確かめ、好きな順は反例あり、先着順は成り立つことが一致した（specs/csp）。",
    },
    {
      id: "notStuck",
      kind: "explore",
      title: "止まってはいない",
      actor: "checker",
      to: ["box", "server"],
      summary: `デッドロック${ANY_DEADLOCKS.length}件、発散${ANY_DIVERGENCE ? "あり" : "なし"}`,
      explain: `同じ全体を調べると、デッドロックは${ANY_DEADLOCKS.length}件で、発散（見えない動きだけの輪）も${ANY_DIVERGENCE ? "ある" : "無い"}。全体は止まらず動き続けているのに、特定の客だけが永遠に待たされる。デッドロックの検査だけでは見つからない不具合になる。`,
      set: {
        server: { tone: "ok", rows: { デッドロック: `${ANY_DEADLOCKS.length}件` } },
      },
    },
    {
      id: "fifo",
      kind: "fix",
      title: "先着順にする",
      actor: "box",
      to: ["server"],
      summary: `先着順の受け箱: 飢餓${FIFO_STARVATION ? "あり" : "なし"}（${FIFO_LTS.stateCount}状態）`,
      explain: `受け箱を、いちばん先に入った依頼だけを渡す先着順の列に変える。Bが先に入れた依頼は、Aが次に入れる依頼より先に取り出されるので、検査器は飢餓を${FIFO_STARVATION ? "まだ見つけた" : "見つけなかった"}。状態は${FIFO_LTS.stateCount}個になる。`,
      set: {
        box: { tone: "ok", rows: { 取り出し: modeName("fifo"), 中身: null } },
        clientB: {
          tone: FIFO_STARVATION ? "bad" : "ok",
          rows: { 状態: FIFO_STARVATION ? "待たされうる" : "必ず応答" },
        },
        clientA: { tone: "ok", rows: { 状態: null } },
        checker: {
          tone: FIFO_STARVATION ? "bad" : "ok",
          rows: { 輪: FIFO_STARVATION ? eventsText(FIFO_STARVATION.cycle) : "なし" },
        },
      },
    },
    {
      id: "testing",
      kind: "test",
      title: "取り出し順を疑う",
      actor: "checker",
      to: ["box"],
      summary: "ワーカープールやメッセージキューの取り出し順の規則を検査する",
      explain:
        "ワーカープールやメッセージキューで、優先度や取り出し順の設計を誤ると同じことが起きる。この検査は公平性（いつか全員に順番が来るという仮定）を置かないので、実装のスケジューラが公平でも、取り出し順の規則そのものが不公平なら見つかる。",
      set: { box: { tone: "ok" }, checker: { tone: "idle" } },
      simplified:
        "このサイトの飢餓の検査は、依頼してから応答までの間に、応答を含まない輪で回り続けられるかを探す。公平性は仮定していない。",
    },
  ],
  lab: {
    title: "受け箱と見る客",
    hint: "受け箱に「好きな順」か「先着順」、見る客に「A」か「B」を書くと、その客が頼んだまま待たされ続ける輪（飢餓）があるかを出す。",
    inputs: [
      { id: "mode", label: "受け箱（好きな順 / 先着順）", initial: "好きな順" },
      { id: "client", label: "見る客（A / B）", initial: "B" },
    ],
    compute: (values): Field[] => {
      const mode = parseMode(values.mode);
      const who = parseClient(values.client);
      const system = poolSystem(mode);
      const lts = explore(system, POOL_ENV);
      const result = starvation(system, POOL_ENV, `req.${who}`, `resp.${who}`);
      return [
        { label: "受け箱", value: modeName(mode) },
        { label: "見る客", value: who },
        { label: "状態", value: `${lts.stateCount}個` },
        {
          label: "飢餓",
          value: result ? "あり" : "なし",
          tone: result ? "bad" : "ok",
        },
        {
          label: "輪",
          value: starvationText(result),
          tone: result ? "bad" : "ok",
        },
      ];
    },
  },
};
