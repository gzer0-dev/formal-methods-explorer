import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import { deadlocks, explore } from "../csp";
import { CANCEL_ENV, type CancelMode, cancelSystem } from "../cspCases";

const MODES: CancelMode[] = ["wait", "timeout", "cancel"];

const MODE_LABEL: Record<CancelMode, string> = {
  wait: "待ち続ける",
  timeout: "タイムアウトだけ",
  cancel: "取り消しあり",
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

function traceText(trace: string[]): string {
  return trace.length > 0 ? trace.join(" → ") : "なし（最初から）";
}

function deadlockText(result: Result): string {
  return result.deadlockCount > 0 ? `${result.deadlockCount}個` : "なし";
}

function parseMode(text: string | undefined): CancelMode {
  const trimmed = (text ?? "").trim();
  if (trimmed.includes("取り消し") || trimmed === "cancel") return "cancel";
  if (trimmed.includes("タイムアウト") || trimmed === "timeout") return "timeout";
  // 読めない入力は既定の「待ち続ける」に戻す
  return "wait";
}

export const cspCancelLesson: Lesson = {
  id: "csp-cancel",
  category: "apply",
  title: "待ちを取り消す",
  subtitle: "タイムアウトした後、相手はどうなるか",
  summary: `落ちうる通信路で依頼と応答をやり取りする。応答を待ち続けると止まり、タイムアウトで諦めるだけだと遅れて返そうとしたサーバーが止まる。取り消しを送ると${CANCEL.stateCount}状態のどこにもデッドロックは${CANCEL.deadlockCount > 0 ? "残る" : "無い"}。`,
  facts: [
    {
      label: MODE_LABEL.wait,
      value: `${WAIT.stateCount}状態・デッドロック${deadlockText(WAIT)}`,
      tone: "bad",
    },
    {
      label: MODE_LABEL.timeout,
      value: `${TIMEOUT.stateCount}状態・デッドロック${deadlockText(TIMEOUT)}`,
      tone: "bad",
    },
    {
      label: MODE_LABEL.cancel,
      value: `${CANCEL.stateCount}状態・デッドロック${deadlockText(CANCEL)}`,
      tone: "ok",
    },
    { label: "参考文献", value: `${CSP_BOOK} 9.2節（送受信待ちの取消）` },
  ],
  actors: [
    {
      id: "client",
      label: "クライアント",
      sublabel: "依頼して応答を待つ",
      icon: "person",
      x: 14,
      y: 50,
      initial: { rows: { やり方: MODE_LABEL.wait } },
    },
    {
      id: "channel",
      label: "通信路",
      sublabel: "依頼が落ちることがある",
      icon: "network",
      x: 38,
      y: 50,
    },
    {
      id: "server",
      label: "サーバー",
      sublabel: "処理して応答を返す",
      icon: "server",
      x: 62,
      y: 50,
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "動けない状態を探す",
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
      title: "依頼と応答を書く",
      actor: "client",
      to: ["channel", "server"],
      summary:
        "req（依頼）→ resp（応答）→ done（受け取り完了）。依頼は途中で落ちることがある",
      explain:
        "クライアントは req で依頼し、resp で応答を受け取って done で終わる。サーバーは依頼を受けた後、届いていれば work で処理して resp を返し、通信路で落ちていれば何もしない。落ちるかどうかはサーバー側が勝手に決める（内部選択 ⊓）ので、クライアントからは選べない。",
      set: {
        channel: { tone: "wait", rows: { 依頼: "届く ⊓ 落ちる" } },
        server: { rows: { 届いたら: "work → resp" } },
      },
      detail: [
        {
          title: "このサイトのモデル（待ち続ける版）",
          fields: [
            { label: "Client", value: "req → resp → done → SKIP", isCode: true },
            {
              label: "Server",
              value: "req → (work → resp → SKIP ⊓ SKIP)",
              isCode: true,
            },
            {
              label: "全体",
              value: "Client [| req, resp, cancel |] Server",
              isCode: true,
            },
          ],
        },
      ],
      simplified:
        "式はこのサイトのモデル（cspCases.ts）に合わせた短い書き方で、実物の CSPM（FDR の記法）とは書き方が違う。依頼が落ちることを、通信路のプロセスを別に置かずサーバーの内部選択で表した。",
    },
    {
      id: "wait",
      kind: "found",
      title: "落ちると待ち続ける",
      actor: "checker",
      to: ["client"],
      summary: `${WAIT.stateCount}状態にデッドロック${deadlockText(WAIT)}。手順は${traceText(WAIT_TRACE)}だけ`,
      explain: `検査器が返したデッドロックの手順は${traceText(WAIT_TRACE)}。依頼が落ちる動きは外から見えない τ なので、手順には出ない。サーバーは何も受け取らずに終わり、クライアントは来ない resp を待ち続けて止まる。`,
      set: {
        checker: {
          isHidden: false,
          tone: "bad",
          rows: { 状態: `${WAIT.stateCount}個`, デッドロック: deadlockText(WAIT) },
        },
        channel: { tone: "bad", rows: { 依頼: "落ちた" } },
        client: { tone: "bad", rows: { 待つ: "resp（来ない）" } },
      },
    },
    {
      id: "timeout",
      kind: "fix",
      title: "タイムアウトで諦める",
      actor: "client",
      to: ["server"],
      summary: "resp が来なければ timeout → giveup（諦める）で終わる",
      explain:
        "クライアントに、応答が来なければ timeout（タイムアウト）して giveup（諦める）で終わる道を足す。どちらになるかは外から選ばれる（外部選択 □）。依頼が落ちたときは、これで待ち続けなくなる。",
      set: {
        client: { tone: "wait", rows: { やり方: MODE_LABEL.timeout, 待つ: null } },
        channel: { tone: "wait", rows: { 依頼: "届く ⊓ 落ちる" } },
        checker: { tone: "idle" },
      },
      detail: [
        {
          title: "このサイトのモデル（タイムアウトだけの版）",
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
      title: "遅れた応答が止まる",
      actor: "checker",
      to: ["server"],
      summary: `${TIMEOUT.stateCount}状態にデッドロック${deadlockText(TIMEOUT)}: ${traceText(TIMEOUT_TRACE)}`,
      explain: `今度はクライアントが${traceText(TIMEOUT_TRACE.slice(0, TIMEOUT_TRACE.indexOf("giveup") + 1))}で諦めた後、届いていた依頼をサーバーが${AFTER_GIVEUP.join(" → ")}と処理する。サーバーは resp を返そうとするが、受け取る相手はもういないので止まる。分散システムで起きやすい「タイムアウト後の遅れた応答」の不具合が、モデルの段階で見つかった。`,
      set: {
        checker: {
          tone: "bad",
          rows: {
            状態: `${TIMEOUT.stateCount}個`,
            デッドロック: deadlockText(TIMEOUT),
          },
        },
        client: { tone: "ok", rows: { 終わり: "giveup" } },
        server: { tone: "bad", rows: { 待つ: "resp の相手（いない）" } },
      },
      detail: [
        {
          title: "検査器が返した手順",
          fields: TIMEOUT_TRACE.map((ev, index) => ({
            label: `${index + 1}手目`,
            value: ev,
          })),
        },
      ],
    },
    {
      id: "cancel",
      kind: "fix",
      title: "取り消しを送る",
      actor: "client",
      to: ["server"],
      summary:
        "timeout の後に cancel を送り、サーバーは応答の前でも、依頼が落ちていても受け付ける",
      explain:
        "クライアントはタイムアウトしたら cancel（取り消し）を送ってから諦める。サーバーは、処理の後で resp か cancel のどちらかを受け付け、依頼が落ちていた場合も cancel を受け付けて終わる。どの道でも、相手の動きを受け取る側が必ずいるようにした。",
      set: {
        client: { tone: "wait", rows: { やり方: MODE_LABEL.cancel, 終わり: null } },
        server: { tone: "wait", rows: { 待つ: "resp か cancel" } },
        channel: { tone: "idle" },
        checker: { tone: "idle" },
      },
      detail: [
        {
          title: "このサイトのモデル（取り消しありの版）",
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
      title: "デッドロックなし",
      actor: "checker",
      to: ["client", "server"],
      summary: `${CANCEL.stateCount}状態・${CANCEL.transitionCount}遷移をたどり、デッドロック${deadlockText(CANCEL)}`,
      explain: `たどり直すと${CANCEL.stateCount}状態・${CANCEL.transitionCount}遷移のどこにもデッドロックは${CANCEL.deadlockCount > 0 ? "残った" : "無い"}。届いた依頼も落ちた依頼も、タイムアウトの後は cancel で必ず片が付き、両方が正しく終わる（✓ を出す）。`,
      set: {
        checker: {
          tone: CANCEL.deadlockCount > 0 ? "bad" : "ok",
          rows: { 状態: `${CANCEL.stateCount}個`, デッドロック: deadlockText(CANCEL) },
        },
        client: { tone: "ok" },
        server: { tone: "ok", rows: { 待つ: null } },
        channel: { tone: "ok" },
      },
      simplified:
        "同じモデルを ProB で確かめ、待ち続ける版とタイムアウトだけの版はデッドロックし、取り消しありはしないことが一致した。ProB は正しく終わった状態もデッドロックと報告するので、照合では終わった後に idle を繰り返す形にした（specs/csp）。",
    },
    {
      id: "test",
      kind: "test",
      title: "相手側まで確かめる",
      actor: "checker",
      to: ["server"],
      summary: "タイムアウトのテストは、相手が後でどうなるかまで見る",
      explain:
        "タイムアウトのテストは「クライアントがエラーを返したか」だけで終わりがちだが、ここで止まったのはサーバーの方だった。遅れて届いた依頼の処理、返し先の無い応答、取り消しの受け付けまで、相手側のその後を確かめるテストを足す。",
      set: { checker: { tone: "idle" } },
    },
  ],
  lab: {
    title: "3つのやり方を比べる",
    hint: "やり方は「待ち続ける」「タイムアウト」「取り消し」のどれか。",
    inputs: [{ id: "mode", label: "やり方", initial: MODE_LABEL.wait }],
    compute: (values): Field[] => {
      const mode = parseMode(values.mode);
      const result = analyze(mode);
      return [
        { label: "やり方", value: MODE_LABEL[mode] },
        { label: "状態", value: `${result.stateCount}個` },
        { label: "遷移", value: `${result.transitionCount}本` },
        {
          label: "デッドロック",
          value: deadlockText(result),
          tone: result.deadlockCount > 0 ? "bad" : "ok",
        },
        {
          label: "最短の手順",
          value: result.shortest ? traceText(result.shortest) : "なし",
          isCode: true,
        },
      ];
    },
  },
};
