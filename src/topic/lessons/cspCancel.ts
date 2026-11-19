import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import { deadlocks, explore } from "../csp";
import { CANCEL_ENV, type CancelMode, cancelSystem } from "../cspCases";

const MODES: CancelMode[] = ["wait", "timeout", "cancel"];

const MODE_LABEL: Record<CancelMode, string> = {
  wait: "待ち続ける",
  timeout: "タイムアウトだけ",
  cancel: "取り消しあり",
};

const MODE_LABEL_EN: Record<CancelMode, string> = {
  wait: "wait forever",
  timeout: "timeout only",
  cancel: "with cancel",
};

interface Result {
  stateCount: number;
  transitionCount: number;
  deadlockCount: number;
  /** 最短のデッドロックの手順。無ければ null。 */
  shortest: string[] | null;
}

function analyze(mode: CancelMode): Result {
  const system = cancelSystem(mode);
  const lts = explore(system, CANCEL_ENV);
  const traces = deadlocks(system, CANCEL_ENV);
  // deadlocks は短い順を約束しないので長さで選ぶ
  const shortest =
    traces.length === 0
      ? null
      : traces.reduce((best, trace) => (trace.length < best.length ? trace : best));
  return {
    stateCount: lts.stateCount,
    transitionCount: lts.transitionCount,
    deadlockCount: traces.length,
    shortest,
  };
}

const RESULTS = Object.fromEntries(
  MODES.map((mode) => [mode, analyze(mode)]),
) as Record<CancelMode, Result>;
const WAIT = RESULTS.wait;
const TIMEOUT = RESULTS.timeout;
const CANCEL = RESULTS.cancel;
if (!WAIT.shortest) throw new Error("待ち続ける版でデッドロックが見つからない");
if (!TIMEOUT.shortest?.includes("giveup")) {
  throw new Error("タイムアウトだけの版で、諦めた後のデッドロックが見つからない");
}
const WAIT_TRACE = WAIT.shortest;
const TIMEOUT_TRACE = TIMEOUT.shortest;
// 諦めた後に起きた見えるイベント（遅れて動いたサーバーの動き）
const AFTER_GIVEUP = TIMEOUT_TRACE.slice(TIMEOUT_TRACE.indexOf("giveup") + 1);
const UNTIL_GIVEUP = TIMEOUT_TRACE.slice(0, TIMEOUT_TRACE.indexOf("giveup") + 1);

function parseMode(text: string | undefined): CancelMode {
  const trimmed = (text ?? "").trim().toLowerCase();
  if (trimmed.includes("取り消し") || trimmed.includes("cancel")) return "cancel";
  if (trimmed.includes("タイムアウト") || trimmed.includes("timeout")) return "timeout";
  // 読めない入力は既定の「待ち続ける」に戻す
  return "wait";
}

export function cspCancelLesson(language: Language): Lesson {
  const t = translator(language);
  const modeLabel = (mode: CancelMode) => t(MODE_LABEL[mode], MODE_LABEL_EN[mode]);
  const traceText = (trace: string[]) =>
    trace.length > 0
      ? trace.join(" → ")
      : t("なし（最初から）", "none (from the start)");
  const deadlockText = (result: Result) =>
    result.deadlockCount > 0
      ? t(`${result.deadlockCount}個`, `${result.deadlockCount}`)
      : t("なし", "none");
  const states = (count: number) => t(`${count}個`, `${count}`);
  return {
    id: "csp-cancel",
    category: "apply",
    title: t("待ちを取り消す", "Cancelling a wait"),
    subtitle: t(
      "タイムアウトした後、相手はどうなるか",
      "After a timeout, what happens to the other side?",
    ),
    summary: t(
      `落ちうる通信路で依頼と応答をやり取りする。応答を待ち続けると止まり、タイムアウトで諦めるだけだと遅れて返そうとしたサーバーが止まる。取り消しを送ると${CANCEL.stateCount}状態のどこにもデッドロックは${CANCEL.deadlockCount > 0 ? "残る" : "無い"}。`,
      `A request and a response travel over a channel that can drop messages. Waiting forever for the response gets stuck; just giving up on a timeout leaves the server stuck when it tries to reply late. Sending a cancel ${CANCEL.deadlockCount > 0 ? "still leaves a deadlock" : "leaves no deadlock"} in any of the ${CANCEL.stateCount} states.`,
    ),
    intro: [
      t(
        "依頼を送って応答を待つ処理で、応答が来ないときにどう待ちを終えるかを扱う。依頼は通信路の途中で落ちることがあり、それをサーバー側の内部選択（外から選べない分岐）として書く。",
        "This lesson is about code that sends a request and waits for a response: how should the wait end when no response comes? The request can be dropped on the way, and we write that as an internal choice on the server side (a branch nobody outside can pick).",
      ),
      t(
        "タイムアウトのテストは、待っていた側がエラーを返したかで終わりがちである。しかし待ちを諦めた後も相手は動いていて、止まるのは相手の方かもしれない。デッドロックの検査なら、両方の側のその後をすべてたどれる。",
        "Timeout tests tend to stop at checking that the waiting side returned an error. But the other side keeps running after the wait is abandoned, and it may be the one that gets stuck. A deadlock check follows everything both sides do afterwards.",
      ),
      t(
        "図では「クライアント」「通信路」「サーバー」の3枚を見比べる。待ち続ける版、タイムアウトだけの版、取り消しを送る版と順に直していくので、版ごとにどちらの側が止まるかを追う。",
        "In the diagram, compare the three cards Client, Channel and Server. The design is fixed in turn: wait forever, timeout only, then sending a cancel. For each version, follow which side gets stuck.",
      ),
    ],
    facts: [
      {
        label: modeLabel("wait"),
        value: t(
          `${WAIT.stateCount}状態・デッドロック${deadlockText(WAIT)}`,
          `${WAIT.stateCount} states, deadlocks: ${deadlockText(WAIT)}`,
        ),
        tone: "bad",
      },
      {
        label: modeLabel("timeout"),
        value: t(
          `${TIMEOUT.stateCount}状態・デッドロック${deadlockText(TIMEOUT)}`,
          `${TIMEOUT.stateCount} states, deadlocks: ${deadlockText(TIMEOUT)}`,
        ),
        tone: "bad",
      },
      {
        label: modeLabel("cancel"),
        value: t(
          `${CANCEL.stateCount}状態・デッドロック${deadlockText(CANCEL)}`,
          `${CANCEL.stateCount} states, deadlocks: ${deadlockText(CANCEL)}`,
        ),
        tone: "ok",
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 9.2節（送受信待ちの取消）`,
          `${CSP_BOOK_EN}, section 9.2 (cancelling a send or receive wait)`,
        ),
      },
    ],
    actors: [
      {
        id: "client",
        label: t("クライアント", "Client"),
        sublabel: t("依頼して応答を待つ", "requests, waits for reply"),
        icon: "person",
        x: 14,
        y: 50,
        initial: { rows: { [t("やり方", "design")]: modeLabel("wait") } },
      },
      {
        id: "channel",
        label: t("通信路", "Channel"),
        sublabel: t("依頼が落ちることがある", "may drop the request"),
        icon: "network",
        x: 38,
        y: 50,
      },
      {
        id: "server",
        label: t("サーバー", "Server"),
        sublabel: t("処理して応答を返す", "works, then replies"),
        icon: "server",
        x: 62,
        y: 50,
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("動けない状態を探す", "looks for stuck states"),
        icon: "checker",
        x: 86,
        y: 50,
        initial: { isHidden: true },
      },
    ],
    stageHeight: 300,
    links: [
      { from: "client", to: "channel" },
      { from: "channel", to: "server" },
      { from: "checker", to: "server" },
    ],
    steps: [
      {
        id: "model",
        kind: "spec",
        title: t("依頼と応答を書く", "Write request and response"),
        actor: "client",
        to: ["channel", "server"],
        summary: t(
          "req（依頼）→ resp（応答）→ done（受け取り完了）。依頼は途中で落ちることがある",
          "req (request) → resp (response) → done (received). The request may be dropped on the way",
        ),
        explain: t(
          "クライアントは req で依頼し、resp で応答を受け取って done で終わる。サーバーは依頼を受けた後、届いていれば work で処理して resp を返し、通信路で落ちていれば何もしない。落ちるかどうかはサーバー側が勝手に決める（内部選択 ⊓）ので、クライアントからは選べない。",
          "The client sends req, receives the reply on resp, and ends with done. After the request, the server runs work and returns resp if it arrived, and does nothing if the channel dropped it. Whether it is dropped is decided on the server side on its own (internal choice ⊓), so the client cannot pick.",
        ),
        set: {
          channel: {
            tone: "wait",
            rows: { [t("依頼", "request")]: t("届く ⊓ 落ちる", "arrives ⊓ dropped") },
          },
          server: { rows: { [t("届いたら", "if it arrives")]: "work → resp" } },
        },
        detail: [
          {
            title: t(
              "このサイトのモデル（待ち続ける版）",
              "This site's model (wait forever)",
            ),
            fields: [
              { label: "Client", value: "req → resp → done → SKIP", isCode: true },
              {
                label: "Server",
                value: "req → (work → resp → SKIP ⊓ SKIP)",
                isCode: true,
              },
              {
                label: t("全体", "System"),
                value: "Client [| req, resp, cancel |] Server",
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "式はこのサイトのモデル（cspCases.ts）に合わせた短い書き方で、実物の CSPM（FDR の記法）とは書き方が違う。依頼が落ちることを、通信路のプロセスを別に置かずサーバーの内部選択で表した。",
          "The expressions use this site's short notation from its models (cspCases.ts), which differs from real CSPM (the FDR notation). A dropped request is written as an internal choice in the server rather than as a separate channel process.",
        ),
      },
      {
        id: "wait",
        kind: "found",
        title: t("落ちると待ち続ける", "Dropped: waits forever"),
        actor: "checker",
        to: ["client"],
        summary: t(
          `${WAIT.stateCount}状態にデッドロック${deadlockText(WAIT)}。手順は${traceText(WAIT_TRACE)}だけ`,
          `${WAIT.stateCount} states, deadlocks: ${deadlockText(WAIT)}. The trace is just ${traceText(WAIT_TRACE)}`,
        ),
        explain: t(
          `検査器が返したデッドロックの手順は${traceText(WAIT_TRACE)}。依頼が落ちる動きは外から見えない τ なので、手順には出ない。サーバーは何も受け取らずに終わり、クライアントは来ない resp を待ち続けて止まる。`,
          `The deadlock trace the checker returned is ${traceText(WAIT_TRACE)}. Dropping the request is a τ step invisible from outside, so it does not appear in the trace. The server ends having received nothing, and the client is stuck waiting for a resp that never comes.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "bad",
            rows: {
              [t("状態", "states")]: states(WAIT.stateCount),
              [t("デッドロック", "deadlocks")]: deadlockText(WAIT),
            },
          },
          channel: {
            tone: "bad",
            rows: { [t("依頼", "request")]: t("落ちた", "dropped") },
          },
          client: {
            tone: "bad",
            rows: {
              [t("待つ", "waits for")]: t("resp（来ない）", "resp (never comes)"),
            },
          },
        },
      },
      {
        id: "timeout",
        kind: "fix",
        title: t("タイムアウトで諦める", "Give up on a timeout"),
        actor: "client",
        to: ["server"],
        summary: t(
          "resp が来なければ timeout → giveup（諦める）で終わる",
          "If resp does not come, end with timeout → giveup",
        ),
        explain: t(
          "クライアントに、応答が来なければ timeout（タイムアウト）して giveup（諦める）で終わる道を足す。どちらになるかは外から選ばれる（外部選択 □）。依頼が落ちたときは、これで待ち続けなくなる。",
          "Give the client another path: if no response comes, it takes timeout and ends with giveup. Which path happens is chosen from outside (external choice □). When the request is dropped, the client no longer waits forever.",
        ),
        set: {
          client: {
            tone: "wait",
            rows: {
              [t("やり方", "design")]: modeLabel("timeout"),
              [t("待つ", "waits for")]: null,
            },
          },
          channel: {
            tone: "wait",
            rows: { [t("依頼", "request")]: t("届く ⊓ 落ちる", "arrives ⊓ dropped") },
          },
          checker: { tone: "idle" },
        },
        detail: [
          {
            title: t(
              "このサイトのモデル（タイムアウトだけの版）",
              "This site's model (timeout only)",
            ),
            fields: [
              {
                label: "Client",
                value: "req → (resp → done → SKIP □ timeout → giveup → SKIP)",
                isCode: true,
              },
            ],
          },
        ],
      },
      {
        id: "late",
        kind: "found",
        title: t("遅れた応答が止まる", "The late reply gets stuck"),
        actor: "checker",
        to: ["server"],
        summary: t(
          `${TIMEOUT.stateCount}状態にデッドロック${deadlockText(TIMEOUT)}: ${traceText(TIMEOUT_TRACE)}`,
          `${TIMEOUT.stateCount} states, deadlocks: ${deadlockText(TIMEOUT)}: ${traceText(TIMEOUT_TRACE)}`,
        ),
        explain: t(
          `今度はクライアントが${traceText(UNTIL_GIVEUP)}で諦めた後、届いていた依頼をサーバーが${AFTER_GIVEUP.join(" → ")}と処理する。サーバーは resp を返そうとするが、受け取る相手はもういないので止まる。分散システムで起きやすい「タイムアウト後の遅れた応答」の不具合が、モデルの段階で見つかった。`,
          `This time the client gives up after ${traceText(UNTIL_GIVEUP)}, and then the server handles the request that did arrive: ${AFTER_GIVEUP.join(" → ")}. The server tries to return resp, but nobody is left to receive it, so it gets stuck. The "late reply after a timeout" bug, common in distributed systems, is found while still at the model stage.`,
        ),
        set: {
          checker: {
            tone: "bad",
            rows: {
              [t("状態", "states")]: states(TIMEOUT.stateCount),
              [t("デッドロック", "deadlocks")]: deadlockText(TIMEOUT),
            },
          },
          client: { tone: "ok", rows: { [t("終わり", "ended")]: "giveup" } },
          server: {
            tone: "bad",
            rows: {
              [t("待つ", "waits for")]: t(
                "resp の相手（いない）",
                "someone to take resp (gone)",
              ),
            },
          },
        },
        detail: [
          {
            title: t("検査器が返した手順", "Trace the checker returned"),
            fields: TIMEOUT_TRACE.map((ev, index) => ({
              label: t(`${index + 1}手目`, `Step ${index + 1}`),
              value: ev,
            })),
          },
        ],
      },
      {
        id: "cancel",
        kind: "fix",
        title: t("取り消しを送る", "Send a cancel"),
        actor: "client",
        to: ["server"],
        summary: t(
          "timeout の後に cancel を送り、サーバーは応答の前でも、依頼が落ちていても受け付ける",
          "After timeout the client sends cancel; the server accepts it before replying, and even if the request was dropped",
        ),
        explain: t(
          "クライアントはタイムアウトしたら cancel（取り消し）を送ってから諦める。サーバーは、処理の後で resp か cancel のどちらかを受け付け、依頼が落ちていた場合も cancel を受け付けて終わる。どの道でも、相手の動きを受け取る側が必ずいるようにした。",
          "After a timeout, the client sends cancel and then gives up. After working, the server accepts either resp or cancel, and if the request was dropped it also accepts cancel and ends. On every path, there is always someone to take the other side's action.",
        ),
        set: {
          client: {
            tone: "wait",
            rows: {
              [t("やり方", "design")]: modeLabel("cancel"),
              [t("終わり", "ended")]: null,
            },
          },
          server: {
            tone: "wait",
            rows: { [t("待つ", "waits for")]: t("resp か cancel", "resp or cancel") },
          },
          channel: { tone: "idle" },
          checker: { tone: "idle" },
        },
        detail: [
          {
            title: t(
              "このサイトのモデル（取り消しありの版）",
              "This site's model (with cancel)",
            ),
            fields: [
              {
                label: "Client",
                value: "req → (resp → done → SKIP □ timeout → cancel → giveup → SKIP)",
                isCode: true,
              },
              {
                label: "Server",
                value: "req → (work → (resp → SKIP □ cancel → SKIP) ⊓ cancel → SKIP)",
                isCode: true,
              },
            ],
          },
        ],
      },
      {
        id: "free",
        kind: "explore",
        title: t("デッドロックなし", "No deadlock"),
        actor: "checker",
        to: ["client", "server"],
        summary: t(
          `${CANCEL.stateCount}状態・${CANCEL.transitionCount}遷移をたどり、デッドロック${deadlockText(CANCEL)}`,
          `Walks ${CANCEL.stateCount} states and ${CANCEL.transitionCount} transitions; deadlocks: ${deadlockText(CANCEL)}`,
        ),
        explain: t(
          `たどり直すと${CANCEL.stateCount}状態・${CANCEL.transitionCount}遷移のどこにもデッドロックは${CANCEL.deadlockCount > 0 ? "残った" : "無い"}。届いた依頼も落ちた依頼も、タイムアウトの後は cancel で必ず片が付き、両方が正しく終わる（✓ を出す）。`,
          `Walking it again, ${CANCEL.deadlockCount > 0 ? "a deadlock remains" : "there is no deadlock"} anywhere in the ${CANCEL.stateCount} states and ${CANCEL.transitionCount} transitions. Whether the request arrived or was dropped, cancel always settles it after a timeout, and both sides end correctly (they produce ✓).`,
        ),
        set: {
          checker: {
            tone: CANCEL.deadlockCount > 0 ? "bad" : "ok",
            rows: {
              [t("状態", "states")]: states(CANCEL.stateCount),
              [t("デッドロック", "deadlocks")]: deadlockText(CANCEL),
            },
          },
          client: { tone: "ok" },
          server: { tone: "ok", rows: { [t("待つ", "waits for")]: null } },
          channel: { tone: "ok" },
        },
        simplified: t(
          "同じモデルを ProB で確かめ、待ち続ける版とタイムアウトだけの版はデッドロックし、取り消しありはしないことが一致した。ProB は正しく終わった状態もデッドロックと報告するので、照合では終わった後に idle を繰り返す形にした（specs/csp）。",
          "Checking the same models with ProB agreed: the wait-forever and timeout-only versions deadlock, and the version with cancel does not. ProB also reports a correctly finished state as a deadlock, so the cross-check uses versions that repeat idle after finishing (specs/csp).",
        ),
      },
      {
        id: "test",
        kind: "test",
        title: t("相手側まで確かめる", "Check the other side too"),
        actor: "checker",
        to: ["server"],
        summary: t(
          "タイムアウトのテストは、相手が後でどうなるかまで見る",
          "A timeout test should also check what happens to the other side later",
        ),
        explain: t(
          "タイムアウトのテストは「クライアントがエラーを返したか」だけで終わりがちだが、ここで止まったのはサーバーの方だった。遅れて届いた依頼の処理、返し先の無い応答、取り消しの受け付けまで、相手側のその後を確かめるテストを足す。",
          'Timeout tests often stop at "did the client return an error?", but here it was the server that got stuck. Add tests for what the other side does afterwards: handling a late request, a reply with nowhere to go, and accepting the cancel.',
        ),
        set: { checker: { tone: "idle" } },
      },
    ],
    lab: {
      title: t("3つのやり方を比べる", "Compare the three designs"),
      hint: t(
        "やり方は「待ち続ける」「タイムアウト」「取り消し」のどれか。",
        'Enter "wait forever", "timeout" or "cancel" as the design.',
      ),
      inputs: [
        { id: "mode", label: t("やり方", "Design"), initial: modeLabel("wait") },
      ],
      compute: (values): Field[] => {
        const mode = parseMode(values.mode);
        const result = analyze(mode);
        return [
          { label: t("やり方", "Design"), value: modeLabel(mode) },
          { label: t("状態", "States"), value: states(result.stateCount) },
          {
            label: t("遷移", "Transitions"),
            value: t(`${result.transitionCount}本`, `${result.transitionCount}`),
          },
          {
            label: t("デッドロック", "Deadlocks"),
            value: deadlockText(result),
            tone: result.deadlockCount > 0 ? "bad" : "ok",
          },
          {
            label: t("最短の手順", "Shortest trace"),
            value: result.shortest ? traceText(result.shortest) : t("なし", "none"),
            isCode: true,
          },
        ];
      },
    },
  };
}
