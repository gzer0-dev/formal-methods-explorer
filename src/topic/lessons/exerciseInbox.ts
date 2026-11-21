import { translator, type Language } from "../../core/i18n";
import type { Lesson, Step } from "../../core/types";
import { acceptsTrace, starvation } from "../csp";
import { POOL_ENV, poolSystem } from "../cspMore";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";

// 演習: 先着順の受け箱で、客Bが飢餓になるか（exerciseCsp.ts の問7を1レッスンにしたもの）。
// 既定の図は問題の設定だけを見せ、取り出しの順や検査器の結果は出さない。答えを入れると、
// Bが先に入れた依頼が先に取り出される様子と、検査器の結果（好きな順の受け箱との比べ）が図に足される。

type Translate = (ja: string, en: string) => string;

/** 反例の時点を文の頭に置く形にする（exerciseCsp.ts と同じ）。 */
function traceText(trace: string[], t: Translate): string {
  return trace.length > 0
    ? t(`${trace.join(" → ")}の後`, `After ${trace.join(" → ")}`)
    : t("最初の時点で", "At the start");
}

// 図で1手ずつ見せる並び: Bが先に入れ、Aが後から入れ、受け箱が1つ渡し、サーバーが応答する。
// 並びはここで選んだものだが、モデルが起こせるか（と、Aを先に渡せないこと）は solutionSteps で検査器に確かめさせる。
const WALK = ["req.B", "req.A", "take.B", "resp.B"];
const OVERTAKE = ["req.B", "req.A", "take.A"];

// 正解の計算は exerciseCsp.ts の問7と同じ関数・同じモデル。
const RESULT = lazy(() => {
  const fifo = poolSystem("fifo");
  return {
    fifo: starvation(fifo, POOL_ENV, "req.B", "resp.B"),
    anyOrder: starvation(poolSystem("anyOrder"), POOL_ENV, "req.B", "resp.B"),
    isWalkAccepted: acceptsTrace(fifo, POOL_ENV, WALK).isAccepted,
    isOvertakeAccepted: acceptsTrace(fifo, POOL_ENV, OVERTAKE).isAccepted,
  };
});

function setupSteps(t: Translate): Step[] {
  return [
    {
      id: "shared",
      kind: "spec",
      title: t("1つの受け箱を共用", "Share one inbox"),
      actor: "box",
      summary: t(
        "客AとBが1つの受け箱へ依頼を入れ、1つのサーバーが取り出して応答する",
        "Clients A and B put requests into one inbox, and one server takes them and responds",
      ),
      explain: t(
        "客は req.客（依頼を受け箱に入れる）をして、resp.客（応答をもらう）を待ち、また依頼する。サーバーは take.客（受け箱から1つ取り出す）をして、その客に応答する。受け箱には客ごとに依頼が1つまで入る。",
        "A client does req.c (puts a request in the inbox), waits for resp.c (gets the response), then requests again. The server does take.c (takes one request from the inbox) and responds to that client. The inbox holds at most one request per client.",
      ),
      set: { box: { tone: "idle" }, server: { tone: "idle" } },
      simplified: t(
        "式はこのサイトのモデル（cspMore.ts）の書き方で、実物の CSPM（FDR の記法）とは書き方が違う。",
        "The expressions use this site's model notation (cspMore.ts), which differs from real CSPM (the FDR notation).",
      ),
    },
    {
      id: "fifo-rule",
      kind: "spec",
      title: t("先着順に渡す", "Hand over first come"),
      actor: "box",
      to: ["server"],
      summary: t(
        "受け箱は、いちばん先に入った依頼だけをサーバーに渡す",
        "The inbox hands the server only the request that arrived first",
      ),
      explain: t(
        "この受け箱は先着順の列で、入った順に並べ、先頭の依頼だけをサーバーに渡す。客はいつでも依頼を入れられ、サーバーがどの客の依頼を受け取るかは、受け箱の先頭で決まる。",
        "This inbox is a first-come queue: it lines requests up in the order they arrive and hands only the front one to the server. Clients can put in requests at any time, and which client's request the server gets is decided by the front of the inbox.",
      ),
      set: {
        box: { tone: "wait" },
        clientA: {
          rows: { [t("状態", "status")]: t("依頼を繰り返す", "keeps asking") },
        },
        clientB: {
          rows: { [t("状態", "status")]: t("依頼を繰り返す", "keeps asking") },
        },
      },
    },
    {
      id: "question",
      kind: "explore",
      title: t("Bは待たされ続けるか", "Can B wait forever?"),
      actor: "checker",
      to: ["server"],
      summary: t(
        "先着順の受け箱で、客Bが飢餓になるかを答える",
        "With a first-come, first-served inbox, can client B starve?",
      ),
      explain: t(
        "Bが依頼を入れた後、応答をもらえないまま回り続ける実行（飢餓）はあるか。下の「答え合わせ」に「はい」か「いいえ」を入れると、受け箱が依頼を渡す順と、検査器の結果がこの図に足される。ヒント: Bより後に入った依頼が、Bより先に取り出されることはあるか。",
        'After B puts in a request, is there a run that keeps going without B ever getting a reply (starvation)? Enter "yes" or "no" under "Check your answer" below and the order in which the inbox hands over requests, and the checker\'s result, are added to this diagram. Hint: can a request that arrived after B\'s be taken out before it?',
      ),
      set: {
        checker: {
          tone: "wait",
          rows: { [t("問い", "question")]: t("Bは飢餓になる？", "Can B starve?") },
        },
      },
      simplified: t(
        "飢餓の判定は公平性を仮定しない（Aばかりが選ばれ続ける実行も数える）。ProB では LTL の式で同じことを調べて照合している。",
        "The starvation check assumes no fairness (runs where A keeps being chosen also count). ProB checks the same thing with an LTL formula, and the results are cross-checked.",
      ),
    },
  ];
}

function solutionSteps(t: Translate): Step[] {
  const result = RESULT();
  if (!result.isWalkAccepted || result.isOvertakeAccepted) {
    throw new Error("先着順の受け箱が、Bの依頼を先に渡す並びになっていない");
  }
  if (result.fifo !== null) {
    throw new Error("先着順の受け箱で飢餓が見つかった（図の説明の前提と違う）");
  }
  const anyOrder = result.anyOrder;
  const [reqB, reqA, takeB, respB] = WALK as [string, string, string, string];
  const status = t("状態", "status");
  const holds = t("中身", "holds");
  return [
    {
      id: "walk-req-b",
      kind: "run",
      title: t(`1手目: ${reqB}`, `Step 1: ${reqB}`),
      actor: "clientB",
      to: ["box"],
      summary: t("Bが先に依頼を入れる", "B puts in a request first"),
      explain: t(
        "Bが依頼を受け箱に入れ、応答を待つ。受け箱の列の先頭はBになる。",
        "B puts a request into the inbox and waits for the response. B is now at the front of the queue.",
      ),
      set: {
        clientB: { tone: "wait", rows: { [status]: t("応答待ち", "awaiting reply") } },
        box: { rows: { [holds]: "B" } },
        checker: { rows: { [t("問い", "question")]: null } },
      },
    },
    {
      id: "walk-req-a",
      kind: "run",
      title: t(`2手目: ${reqA}`, `Step 2: ${reqA}`),
      actor: "clientA",
      to: ["box"],
      summary: t("Aが後から依頼を入れる", "A puts in a request after B"),
      explain: t(
        "Aも依頼を入れる。先着順なので、Aの依頼はBの後ろに並ぶ。",
        "A also puts in a request. The inbox is first come, so A's request lines up behind B's.",
      ),
      set: {
        clientA: { tone: "wait", rows: { [status]: t("応答待ち", "awaiting reply") } },
        box: { rows: { [holds]: t("B、A", "B, A") } },
      },
    },
    {
      id: "walk-take-b",
      kind: "explore",
      title: t(`3手目: ${takeB}`, `Step 3: ${takeB}`),
      actor: "box",
      to: ["server"],
      summary: t(
        `先頭のBが渡される。${OVERTAKE.join(" → ")}はモデルが起こせない`,
        `B, at the front, is handed over. The model cannot do ${OVERTAKE.join(" → ")}`,
      ),
      explain: t(
        `受け箱がサーバーに渡せるのは先頭のBだけ。検査器に${OVERTAKE.join(" → ")}を与えると、先着順のモデルはAを先に渡す動きを受け付けなかった。後から入ったAが、Bを追い越すことはない。`,
        `The inbox can hand the server only B, at the front. Given ${OVERTAKE.join(" → ")}, the first-come model did not accept handing A over first. A, which arrived later, never overtakes B.`,
      ),
      set: {
        box: { tone: "ok", rows: { [holds]: "A" } },
        server: { tone: "wait", rows: { [t("処理中", "serving")]: "B" } },
      },
    },
    {
      id: "walk-resp-b",
      kind: "fix",
      title: t(`4手目: ${respB}`, `Step 4: ${respB}`),
      actor: "server",
      to: ["clientB"],
      summary: t("Bが応答をもらう", "B gets its reply"),
      explain: t(
        "サーバーがBに応答する。Bが依頼を入れた時点で列にいた依頼はBより前の分だけなので、Bの順番は必ず回ってくる。",
        "The server replies to B. When B put in its request, only requests ahead of it were in the queue, so B's turn always comes.",
      ),
      set: {
        server: { tone: "idle", rows: { [t("処理中", "serving")]: null } },
        clientB: { tone: "ok", rows: { [status]: t("応答をもらった", "got a reply") } },
      },
    },
    {
      id: "no-loop",
      kind: "fix",
      title: t("輪は見つからない", "No loop is found"),
      actor: "checker",
      to: ["server", "clientB"],
      summary: t(
        "先着順: Bが応答をもらえないまま回る輪は無い",
        "First come: there is no loop where B never gets a reply",
      ),
      explain: t(
        "検査器は、Bが依頼してから応答をもらうまでの間に、応答を含まない輪で回り続けられるかを全部の状態でたどったが、見つからなかった。この判定は公平性を仮定しないので、サーバーの選び方に頼らず、受け箱の規則だけでBは必ず応答をもらう。",
        "The checker searched every state for a loop without B's reply between B's request and the reply, and found none. The check assumes no fairness, so B always gets a reply because of the inbox's rule alone, not because of how the server chooses.",
      ),
      set: {
        clientA: { tone: "idle", rows: { [status]: null } },
        checker: {
          tone: "ok",
          rows: { [t("先着順", "first come")]: t("飢餓なし", "no starvation") },
        },
      },
    },
    {
      id: "any-order",
      kind: "found",
      title: t("好きな順の受け箱なら", "With an any-order inbox"),
      actor: "checker",
      to: ["box", "clientA"],
      summary: anyOrder
        ? t(
            `好きな順: ${traceText(anyOrder.trace, t)}、${anyOrder.cycle.join(" → ")}を繰り返せる`,
            `Any order: ${traceText(anyOrder.trace, t)}, it can repeat ${anyOrder.cycle.join(" → ")}`,
          )
        : t("好きな順でも飢餓は無い", "No starvation with any order either"),
      explain: anyOrder
        ? t(
            `比べるために、入っている依頼のどれでも渡せる受け箱を同じ検査にかけると、${traceText(anyOrder.trace, t)}、${anyOrder.cycle.join(" → ")}を繰り返す輪が見つかった。Aの依頼ばかりが先に渡されると、Bは待たされ続ける。先着順にしたことで、この輪が消えている。`,
            `For comparison, the inbox that may hand over any of its requests goes through the same check. ${traceText(anyOrder.trace, t)}, it finds a loop repeating ${anyOrder.cycle.join(" → ")}. If A's request is always handed over first, B keeps waiting. Making the inbox first come removes this loop.`,
          )
        : t(
            "比べるために、入っている依頼のどれでも渡せる受け箱も同じ検査にかけたが、輪は見つからなかった。",
            "For comparison, the inbox that may hand over any of its requests also went through the same check, and no loop was found.",
          ),
      set: {
        box: { tone: anyOrder ? "bad" : "ok" },
        checker: {
          rows: {
            [t("好きな順", "any order")]: anyOrder
              ? t("飢餓あり", "starvation")
              : t("飢餓なし", "no starvation"),
          },
        },
      },
    },
  ];
}

export function exerciseInboxLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-inbox",
      title: t("演習: 先着順の受け箱", "Exercise: a first-come inbox"),
      subtitle: t(
        "先着順の受け箱で、客Bは待たされ続けるか",
        "With a first-come inbox, can customer B wait forever?",
      ),
      summary: t(
        "客AとBが共用する先着順の受け箱で、Bが応答をもらえないまま待たされ続ける（飢餓）ことがあるかを答える。答えを入れると、依頼が渡される順と検査器の結果を図で追える。",
        "For a first-come inbox shared by clients A and B, answer whether B can be kept waiting forever without a reply (starvation). Once you answer, you can follow the order requests are handed over and the checker's result.",
      ),
      intro: [
        t(
          "「共用チャネルと飢餓」で見た、2人の客と1つのサーバーが共用する受け箱を使う。受け箱は先着順で、いちばん先に入った依頼だけをサーバーに渡す。",
          'This uses the inbox shared by two clients and one server from "Shared channels and starvation". The inbox is first come: it hands the server only the request that arrived first.',
        ),
        t(
          "図はまず、客と受け箱とサーバーの関係だけを見せる。答えを入れると、依頼を1手ずつ入れて取り出す様子と検査器の結果が足されるので、受け箱の「中身」の並びがどう変わるかを追う。",
          "The diagram first shows only how the clients, the inbox and the server relate. Once you answer, requests going in and out one step at a time and the checker's result are added, so follow how the inbox's \"holds\" changes.",
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t("共用の受け箱", "Shared inbox"),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("「はい」か「いいえ」", '"yes" or "no"'),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t("共用チャネルと飢餓", '"Shared channels and starvation"'),
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
          initial: { rows: { [t("取り出し", "takes")]: t("先着順", "first come") } },
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
        },
      ],
      links: [
        { from: "clientA", to: "box" },
        { from: "clientB", to: "box" },
        { from: "box", to: "server" },
        { from: "checker", to: "server" },
      ],
      answerType: "yesno",
      answerLabel: t("あなたの答え（はい／いいえ）", "Your answer (yes / no)"),
      hint: t(
        "Bが飢餓になりうるなら「はい」、ならないなら「いいえ」を入れる。入れると、図に依頼の渡される順と検査器の結果が足される。",
        'Enter "yes" if B can starve, "no" if not. The order requests are handed over and the checker\'s result are then added to the diagram.',
      ),
      verdictActor: "checker",
      // 既定の見本には日本語の「はい」「いいえ」が入っていて、英語のレッスンの訳し忘れの検査に掛かるので、言語ごとに渡す。
      samples: language === "ja" ? ["はい", "いいえ", "yes", "x"] : ["yes", "no", "x"],
      setupSteps: setupSteps(t),
      solve: () => {
        const { fifo, anyOrder } = RESULT();
        const anyOrderText = anyOrder
          ? t(
              `好きな順の受け箱なら、${traceText(anyOrder.trace, t)}、${anyOrder.cycle.join(" → ")}を繰り返して、Bは待たされ続ける。`,
              ` With an inbox that hands out requests in any order, B can be kept waiting. ${traceText(anyOrder.trace, t)}, it can repeat ${anyOrder.cycle.join(" → ")} forever.`,
            )
          : "";
        return {
          answer: fifo !== null,
          reason: fifo
            ? t(
                `${traceText(fifo.trace, t)}、${fifo.cycle.join(" → ")}を繰り返して、Bは応答をもらえない。`,
                `${traceText(fifo.trace, t)}, repeating ${fifo.cycle.join(" → ")}, B never gets a reply.`,
              )
            : t(
                `先着順なら、Bの依頼より後に入ったAの依頼が先に取り出されることはないので、Bはいつか応答をもらう。${anyOrderText}`,
                `First-come, first-served means a request from A that arrived after B's is never taken out first, so B eventually gets a reply.${anyOrderText}`,
              ),
        };
      },
      solutionSteps: () => solutionSteps(t),
    },
    language,
  );
}
