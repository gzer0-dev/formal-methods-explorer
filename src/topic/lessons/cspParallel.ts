import type { ActorPatch, Field, Lesson, Step } from "../../core/types";
import { CSP_BOOK } from "../references";
import { explore, traceTo } from "../csp";
import { ADDERS, counterSystem, COUNTER_ENV } from "../cspModels";

const NAIVE_LTS = explore(counterSystem(false), COUNTER_ENV);
const LOCKED_LTS = explore(counterSystem(true), COUNTER_ENV);
const NAIVE_TRACE = traceTo(counterSystem(false), COUNTER_ENV, "result.1")!;
const LOCKED_LOST = traceTo(counterSystem(true), COUNTER_ENV, "result.1");
const LOCKED_GOOD = traceTo(counterSystem(true), COUNTER_ENV, "result.2")!;
// 全員が1ずつ足したときの正しい結果。
const EXPECTED = ADDERS.length;

const ACTOR_OF: Record<string, string> = { A: "a", B: "b" };

type Event =
  | { op: "read" | "write"; who: string; value: string }
  | { op: "finish" }
  | { op: "result"; value: string };

/** イベント名「read.A.0」などを読む。書式が変わったら、画面に変な値を出す前にここで止める。 */
function parseEvent(event: string): Event {
  const parts = event.split(".");
  const [op, first, second] = parts;
  if ((op === "read" || op === "write") && parts.length === 3 && ACTOR_OF[first!])
    return { op, who: first!, value: second! };
  if (op === "finish" && parts.length === 1) return { op };
  if (op === "result" && parts.length === 2) return { op, value: first! };
  throw new Error(`イベント名を読めない: ${event}`);
}

/** 反例の手順の各イベントを、図のステップにする。手元の値はそれまでの読みから組み立てる。 */
function replaySteps(trace: string[]): Step[] {
  const inHand: Record<string, string | null> = { A: null, B: null };
  return trace.map((event, index): Step => {
    const parsed = parseEvent(event);
    const id = `ev-${index + 1}`;
    if (parsed.op === "read") {
      const other = ADDERS.find((who) => who !== parsed.who)!;
      const isSameAsOther = inHand[other] === parsed.value;
      inHand[parsed.who] = parsed.value;
      return {
        id,
        kind: "found",
        title: `${parsed.who}が${parsed.value}を読む`,
        actor: ACTOR_OF[parsed.who]!,
        to: ["var"],
        summary: `${event}: ${parsed.who}が変数の値${parsed.value}を読む`,
        explain: isSameAsOther
          ? `${other}がまだ書いていないので、${parsed.who}も同じ${parsed.value}を読める。${event} は Var(${parsed.value}) と足し手${parsed.who}の両方が起こせるイベントなので、2つがそろって1手進む。`
          : `${event} は「${parsed.who}が値${parsed.value}を読んだ」という意味。Var(${parsed.value}) と足し手${parsed.who}の両方がこのイベントを起こせるので、2つが手をつないで1手進む。`,
        set: {
          [ACTOR_OF[parsed.who]!]: { tone: "wait", rows: { 手元: parsed.value } },
        },
      };
    }
    if (parsed.op === "write") {
      const read = inHand[parsed.who];
      inHand[parsed.who] = null;
      return {
        id,
        kind: "found",
        title: `${parsed.who}が${parsed.value}を書く`,
        actor: ACTOR_OF[parsed.who]!,
        to: ["var"],
        summary: `${event}: ${parsed.who}が手元の${read}に1を足した${parsed.value}を書く`,
        explain: `${parsed.who}は読んだ${read}に1を足し、${event} で${parsed.value}を書く。Var はどの値の書き込みも受け付け、Var(${parsed.value}) になる。${parsed.who}の手順はここで終わる。`,
        set: {
          [ACTOR_OF[parsed.who]!]: { tone: "ok", rows: { 手元: null, 状態: "書いた" } },
          var: { rows: { 値: parsed.value } },
        },
      };
    }
    if (parsed.op === "finish") {
      return {
        id,
        kind: "found",
        title: "全員が終わる",
        actor: "var",
        to: ["a", "b"],
        summary: "finish: 足し手が全員終わったことを、変数と合わせる",
        explain:
          "finish は「足し手が全員終わった」という合図。AとBの両方が終わってから起こせる決まりで、Var も同期するので、ここから先は値が変わらない。",
        set: { var: { tone: "wait", rows: { 合図: "finish" } } },
      };
    }
    return {
      id,
      kind: "found",
      title: `結果は${parsed.value}`,
      actor: "var",
      to: ["checker"],
      summary: `${event}: 2回足したのに結果は${parsed.value}。更新が1回消えた`,
      explain: `Var は最後に result.${parsed.value}（結果の値）を出す。正しくは${EXPECTED}のはずが${parsed.value}になった。サイト1本目と同じ「更新が消える」並びを、CSP の検査器も見つけた。`,
      set: {
        var: {
          tone: "bad",
          rows: { 合図: null, 結果: parsed.value, 期待: String(EXPECTED) },
        },
        a: { tone: "bad" },
        b: { tone: "bad" },
        checker: { tone: "bad", rows: { 反例: `${trace.length}手` } },
      },
      detail: [
        {
          title: `result.${parsed.value} までの最短の手順`,
          fields: trace.map((ev, i) => ({
            label: `${i + 1}手目`,
            value: ev,
            isCode: true,
          })),
        },
      ],
    };
  });
}

function parseLock(text: string | undefined): boolean {
  return (text ?? "").includes("あり");
}

const LOCKED_PATCH: Record<string, ActorPatch> = {
  lock: { isHidden: false, tone: "ok", rows: { 持ち主: "空き" } },
  var: { tone: "ok", rows: { 値: String(EXPECTED), 結果: null, 期待: null } },
  a: { tone: "ok", rows: { 状態: null } },
  b: { tone: "ok", rows: { 状態: null } },
  checker: {
    tone: "ok",
    rows: {
      状態: `${LOCKED_LTS.stateCount}個`,
      遷移: `${LOCKED_LTS.transitionCount}本`,
      反例: LOCKED_LOST ? `${LOCKED_LOST.length}手` : "着かない",
    },
  },
};

export const cspParallelLesson: Lesson = {
  id: "csp-parallel",
  category: "csp",
  title: "並行合成と同期",
  subtitle: "共有変数もプロセスとして書く",
  summary: `変数と2つの足し手を、読み書きのイベントで手をつなぐように並行合成する。全部たどると${NAIVE_LTS.stateCount}状態・${NAIVE_LTS.transitionCount}遷移で、${NAIVE_TRACE.length}手で result.1 に着く。ロックもプロセスとして足すと、result.1 には着かない。`,
  intro: [
    "並行合成は、複数のプロセスを同時に動かし、決めておいたイベント（同期集合）だけは両方がそろったときに一緒に起こす組み合わせ方だ。CSP では共有の変数も、読み書きのイベントを受け付けるプロセスとして書く。",
    "「テストが見逃すバグ」で見た、更新が消えるカウンタを CSP で書き直す。テストでは読み書きの順が実行のたびに変わるので再現しにくいが、検査器はありうる順をすべてたどる。",
    "図では、足し手と変数のカードの間で、読み書きの矢印が1本ずつ進むのを追う。Aがまだ書いていないうちにBが同じ値を読む所が分かれ目になる。最後にロックのカードが加わり、その順で進めなくなる様子を見る。",
  ],
  facts: [
    { label: "状態（ロックなし）", value: `${NAIVE_LTS.stateCount}個` },
    { label: "遷移（ロックなし）", value: `${NAIVE_LTS.transitionCount}本` },
    { label: "result.1 まで", value: `${NAIVE_TRACE.length}手`, tone: "bad" },
    { label: "状態（ロックあり）", value: `${LOCKED_LTS.stateCount}個` },
    { label: "参考文献", value: `${CSP_BOOK} 2.4節（並行合成とチャネル）` },
  ],
  actors: [
    {
      id: "a",
      label: "足し手A",
      sublabel: "Adder(A)",
      icon: "process",
      x: 14,
      y: 27,
    },
    {
      id: "b",
      label: "足し手B",
      sublabel: "Adder(B)",
      icon: "process",
      x: 14,
      y: 73,
    },
    {
      id: "var",
      label: "変数",
      sublabel: "Var(x)",
      icon: "variable",
      x: 50,
      y: 50,
      initial: { rows: { 値: "0" } },
    },
    {
      id: "lock",
      label: "ロック",
      sublabel: "Lock",
      icon: "lock",
      x: 86,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "全部の並びをたどる",
      icon: "checker",
      x: 86,
      y: 73,
      initial: { isHidden: true },
    },
  ],
  links: [
    { from: "a", to: "var" },
    { from: "b", to: "var" },
    { from: "lock", to: "a" },
    { from: "checker", to: "var" },
  ],
  steps: [
    {
      id: "compose",
      kind: "spec",
      title: "変数と足し手をつなぐ",
      actor: "var",
      to: ["a", "b"],
      summary: `変数 Var(x) と足し手A・Bを、read と write で同期させて並行合成する（${NAIVE_LTS.stateCount}状態）`,
      explain: `変数も「read.人.値（その人が値を読む）と write.人.値（その人が値を書く）を受け付けるプロセス」Var(x) として書く。足し手は「読んで1足して書く」プロセスで、Var と並行合成する。並行合成では、同期集合に入れたイベントは両方がそろったときだけ起きるので、Var(0) のときは値0の読み出し（read.A.0 か read.B.0）しか起きない。`,
      set: {
        checker: {
          isHidden: false,
          tone: "wait",
          rows: {
            状態: `${NAIVE_LTS.stateCount}個`,
            遷移: `${NAIVE_LTS.transitionCount}本`,
          },
        },
      },
      detail: [
        {
          title: "このサイトの書き方",
          fields: [
            {
              label: "Var(x)",
              value:
                "(read.人.x → Var(x)) □ (write.人.y → Var(y)) □ (finish → result.x → SKIP)",
              isCode: true,
            },
            {
              label: "Adder(人)",
              value: "read.人.x → write.人.(x+1) → SKIP",
              isCode: true,
            },
            {
              label: "全体",
              value:
                "Var(0) [| read, write, finish |] ((Adder(A) ||| Adder(B)) ; finish → SKIP)",
              isCode: true,
            },
            {
              label: "[| X |]",
              value: "X のイベントは両方がそろって起きる（並行合成）",
            },
            { label: "|||", value: "同期せずに好きな順で入り混じる（インターリーブ）" },
          ],
        },
      ],
      simplified:
        "実物の CSPM（FDR の記法）では、イベントを channel で宣言し、並行合成を [| … |] と書くなど、書き方が違う。このサイトは記号で短く見せている。値は0〜2に丸め、finish と result.値 は結果を外から見るためにこのサイトで足したイベント。",
    },
    ...replaySteps(NAIVE_TRACE),
    {
      id: "add-lock",
      kind: "fix",
      title: "ロックもプロセスで足す",
      actor: "lock",
      to: ["a"],
      summary: `Lock を並行合成に足すと${LOCKED_LTS.stateCount}状態・${LOCKED_LTS.transitionCount}遷移、result.1 には${LOCKED_LOST ? "着く" : "着かない"}`,
      explain: `ロックも「lock.人（取る）の後は unlock.人（手放す）まで、ほかの人の lock を受け付けない」プロセスとして書き、足し手と lock・unlock で同期させる。足し手の手順は「取る→読む→書く→手放す」に変わるだけで、変数の定義は直さない。全部たどると result.1 には${LOCKED_LOST ? "着く" : "着かず"}、result.${EXPECTED} だけに着く。`,
      set: LOCKED_PATCH,
      detail: [
        {
          title: `ロックありで result.${EXPECTED} に着く最短の手順`,
          fields: LOCKED_GOOD.map((ev, i) => ({
            label: `${i + 1}手目`,
            value: ev,
            isCode: true,
          })),
        },
      ],
      simplified:
        "このモデルは2つの足し手が1回ずつ足すだけの小さな例で、FDR のような実物の検査器は、ずっと大きな状態空間を同じ考え方でたどる。状態数と遷移数には、足し手が終わったときの見えない動き（τ）も入っている。手順の「6手」は見えるイベントだけを数えたもの。図ではロックとAの間だけに線を引いているが、Bとも同じように同期している。",
    },
  ],
  lab: {
    title: "ロックのあり・なしを比べる",
    hint: "「あり」にするとロックのプロセスが加わる。状態は増えるが、result.1 に着く手順は消える。",
    inputs: [{ id: "lock", label: "ロック（あり / なし）", initial: "なし" }],
    compute: (values): Field[] => {
      const withLock = parseLock(values.lock);
      const system = counterSystem(withLock);
      const lts = explore(system, COUNTER_ENV);
      const lost = traceTo(system, COUNTER_ENV, "result.1");
      return [
        { label: "ロック", value: withLock ? "あり" : "なし" },
        { label: "状態", value: `${lts.stateCount}個` },
        { label: "遷移", value: `${lts.transitionCount}本` },
        {
          label: "result.1 までの手順",
          value: lost ? lost.join(" → ") : "着かない",
          tone: lost ? "bad" : "ok",
          isCode: lost !== null,
        },
      ];
    },
  },
};
