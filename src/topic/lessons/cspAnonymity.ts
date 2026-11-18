import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import { acceptsTrace, completeTraces, failuresRefines, traceRefines } from "../csp";
import { CRYPTO_ENV, cryptographers, parityOf } from "../cspCases";

const PEOPLE = 3;
const INDEXES = Array.from({ length: PEOPLE }, (_, i) => i);
const PAYERS: (number | null)[] = [...INDEXES, null];

/** 終わった発言の並びの集まりを、順序によらない1つの文字列にする（集まりどうしを比べるため）。 */
function traceSetKey(traces: string[][]): string {
  return traces
    .map((trace) => trace.join(","))
    .sort()
    .join("|");
}

function payerText(payer: number | null): string {
  return payer === null ? "誰も払っていない" : `暗号学者${payer}`;
}

function traceText(trace: string[]): string {
  return trace.join(" → ");
}

// 詳細化の比較は1回で数百ミリ秒かかる。最上位で呼ぶのは「0と1」の組の4回（トレースと失敗を両向き）だけにし、
// ほかの組は completeTraces（数ミリ秒）で示すか、lab の compute に回す。
const PAID_0 = cryptographers(0, false);
const PAID_1 = cryptographers(1, false);
const TRACES_EQUAL_01 =
  traceRefines(PAID_0, PAID_1, CRYPTO_ENV).holds &&
  traceRefines(PAID_1, PAID_0, CRYPTO_ENV).holds;
const FAILURES_EQUAL_01 =
  failuresRefines(PAID_0, PAID_1, CRYPTO_ENV).holds &&
  failuresRefines(PAID_1, PAID_0, CRYPTO_ENV).holds;

const COMPLETE = new Map(
  PAYERS.map((payer) => [
    payer,
    completeTraces(cryptographers(payer, false), CRYPTO_ENV),
  ]),
);
function completeOf(payer: number | null): string[][] {
  return COMPLETE.get(payer)!;
}
const PAID_COUNT = completeOf(0).length;
const NONE_COUNT = completeOf(null).length;
/** その並びの集まりで、発言の排他的論理和がとる値（重複なし）。 */
function paritiesOf(traces: string[][]): number[] {
  return [...new Set(traces.map(parityOf))].sort();
}
const PAID_PARITIES = paritiesOf(INDEXES.flatMap((i) => completeOf(i)));
const NONE_PARITIES = paritiesOf(completeOf(null));
const SAME_SET_012 = INDEXES.every(
  (i) => traceSetKey(completeOf(i)) === traceSetKey(completeOf(0)),
);
const SAME_SET_PAID_NONE = traceSetKey(completeOf(0)) === traceSetKey(completeOf(null));
const EXAMPLE = completeOf(0)[0]!;
const COUNT_TEXT =
  PAID_COUNT === NONE_COUNT
    ? `払った人がいてもいなくても${PAID_COUNT}通り`
    : `払った人がいるときは${PAID_COUNT}通り、いないときは${NONE_COUNT}通り`;

// 暗号学者0の見たコインが漏れる版。1が払ったときの並びのうち、0が払ったモデルでは起こせないものを1本探す。
const LEAK_COMPLETE = new Map(
  INDEXES.map((payer) => [
    payer,
    completeTraces(cryptographers(payer, true), CRYPTO_ENV),
  ]),
);
const LEAK_EXAMPLE = LEAK_COMPLETE.get(0)![0]!;
const LEAK_PAID_0 = cryptographers(0, true);
const FOUND = LEAK_COMPLETE.get(1)!
  .map((trace) => ({ trace, check: acceptsTrace(LEAK_PAID_0, CRYPTO_ENV, trace) }))
  .find(({ check }) => !check.isAccepted);
if (!FOUND) throw new Error("漏れがあるのに、暗号学者0と1の発言の並びが区別できない");
const LEAK_WITNESS = FOUND.trace;
const LEAK_PREFIX = LEAK_WITNESS.slice(0, FOUND.check.acceptedCount + 1);
/** 反例の先頭「look.0.0.a → look.0.1.b → say.0.x」から、0が払っていないと分かる理由を組み立てる。 */
function leakReason(prefix: string[]): string {
  const match = prefix
    .join(" ")
    .match(/^look\.0\.0\.(\d) look\.0\.1\.(\d) say\.0\.(\d)$/);
  if (!match) throw new Error(`漏れの反例が想定の形ではない: ${prefix.join(" ")}`);
  const [a, b, said] = match.slice(1).map(Number) as [number, number, number];
  // 払っていない人は a xor b を言う。反例は1が払った版の並びなので、0は払っていない言い方をしているはず。
  if (said !== (a ^ b))
    throw new Error("漏れの反例で、暗号学者0が払った人の言い方をしている");
  return `コインが${a}と${b}で2枚が${a === b ? "同じ" : "違う"}とき、${said}と言うのは払っていない人なので、0は払っていないと分かる。`;
}
const LEAK_REASON = leakReason(LEAK_PREFIX);
const LEAK_SAME_SET_12 =
  traceSetKey(LEAK_COMPLETE.get(1)!) === traceSetKey(LEAK_COMPLETE.get(2)!);

function parsePayer(text: string | undefined, fallback: number | null): number | null {
  const trimmed = (text ?? "").trim();
  if (trimmed === "なし") return null;
  const n = Number.parseInt(trimmed, 10);
  // 読めない入力・範囲外は既定値に戻す
  if (Number.isNaN(n) || n < 0 || n >= PEOPLE) return fallback;
  return n;
}

function parseLeak(text: string | undefined, fallback: boolean): boolean {
  const trimmed = (text ?? "").trim();
  if (trimmed.includes("あり")) return true;
  if (trimmed.includes("なし")) return false;
  return fallback;
}

function caseText(payer: number | null, leak: boolean): string {
  return `${payerText(payer)}・漏れ${leak ? "あり" : "なし"}`;
}

export const cspAnonymityLesson: Lesson = {
  id: "csp-anonymity",
  category: "apply",
  title: "誰が払ったかを隠す",
  subtitle: "外から区別できないことを、詳細化で確かめる",
  summary: `食事する暗号学者の手順を${PEOPLE}人で書き、外から見える発言だけを比べる。誰が払っても振る舞いは区別できず、誰かが払ったかどうかだけは発言から分かる。コインが漏れると匿名性が崩れる。`,
  facts: [
    {
      label: "0と1が払った場合",
      value: `トレース${TRACES_EQUAL_01 ? "等しい" : "違う"}・失敗${FAILURES_EQUAL_01 ? "等しい" : "違う"}`,
      tone: TRACES_EQUAL_01 && FAILURES_EQUAL_01 ? "ok" : "bad",
    },
    {
      label: "発言の並び",
      value: `${PAID_COUNT}通り（排他的論理和は払った人ありで${PAID_PARITIES.join("・")}、なしで${NONE_PARITIES.join("・")}）`,
    },
    {
      label: "暗号学者0のコインが漏れる",
      value: `0と1は区別できる、1と2は区別${LEAK_SAME_SET_12 ? "できない" : "できる"}`,
      tone: "bad",
    },
    { label: "参考文献", value: `${CSP_BOOK} 7.4節（匿名性の検証例）` },
  ],
  actors: [
    ...INDEXES.map((i) => ({
      id: `c${i}`,
      label: `暗号学者${i}`,
      sublabel: `コイン${i}とコイン${(i + 1) % PEOPLE}を見る`,
      icon: "person",
      x: [14, 38, 62][i]!,
      y: 27,
      initial: { rows: { 払った: "？" } },
    })),
    {
      id: "coins",
      label: "コイン",
      sublabel: `${PEOPLE}枚、隣どうしで共有`,
      icon: "dice",
      x: 14,
      y: 73,
      initial: { rows: { 裏表: "見えない" } },
    },
    {
      id: "observer",
      label: "外から見る人",
      sublabel: "発言 say だけ見える",
      icon: "person",
      x: 50,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "振る舞いを比べる",
      icon: "checker",
      x: 86,
      y: 50,
      initial: { isHidden: true },
    },
  ],
  links: [
    ...INDEXES.map((i) => ({ from: "coins", to: `c${i}` })),
    ...INDEXES.map((i) => ({ from: `c${i}`, to: "observer" })),
    { from: "checker", to: "observer" },
  ],
  steps: [
    {
      id: "coins",
      kind: "spec",
      title: "隣とコインを共有",
      actor: "coins",
      to: INDEXES.map((i) => `c${i}`),
      summary: `暗号学者iはコインiとコインi+1を見る。look.i.j.v は「iがコインjでvを見た」`,
      explain: `${PEOPLE}人が丸く座り、隣どうしの間にコインを1枚ずつ置く。各自は自分のコインと右隣のコインの2枚を見る。イベント look.0.1.0 は「暗号学者0がコイン1を見たら0だった」という意味で、外からは見えない（隠す）。`,
      set: {
        coins: { tone: "wait", rows: { 裏表: "投げて決まる" } },
        ...Object.fromEntries(
          INDEXES.map((i) => [
            `c${i}`,
            { rows: { 見る: `コイン${i}・${(i + 1) % PEOPLE}` } },
          ]),
        ),
      },
      detail: [
        {
          title: "見る動きも含めた並びの例（暗号学者0が払い、0のコインが漏れる版）",
          fields: [{ label: "並び", value: traceText(LEAK_EXAMPLE), isCode: true }],
        },
      ],
      simplified:
        "Chaum の古典の手順をそのまま使う。モデルを小さくするために、コインを見る順を持ち主→左隣に固定した（発言には影響しない）。式はこのサイトのモデル（cspCases.ts）に合わせたもので、実物の CSPM（FDR の記法）とは書き方が違う。",
    },
    {
      id: "say",
      kind: "spec",
      title: "同じなら0を言う",
      actor: "c0",
      to: ["observer"],
      summary: `2枚が同じなら0、違えば1を言う。払った人だけ逆を言う。say.i.x は「iがxと言った」`,
      explain: `各自は見た2枚が同じなら0、違えば1を言う（say.0.1 は「暗号学者0が1と言った」）。食事代を払った人だけは逆を言う。外から見える（隠さない）のは、この発言だけにする。`,
      set: {
        observer: { isHidden: false, tone: "idle", rows: { 見える: "say.i.x だけ" } },
        c0: { rows: { 言う: "同じなら0、違えば1" } },
      },
      detail: [
        {
          title: "暗号学者0が払ったときの発言の並びの例",
          fields: [{ label: "並び", value: traceText(EXAMPLE), isCode: true }],
        },
      ],
    },
    {
      id: "parity",
      kind: "run",
      title: "発言を全部数える",
      actor: "observer",
      summary: `並びは${PAID_COUNT}通り。排他的論理和は払った人がいれば${PAID_PARITIES.join("・")}、いなければ${NONE_PARITIES.join("・")}`,
      explain: `終わりまで動いた実行の発言の並びを全部集めると、${COUNT_TEXT}。どの並びでも、3つの発言の排他的論理和（1の数が奇数なら1）は、払った人がいれば${PAID_PARITIES.join("・")}、いなければ${NONE_PARITIES.join("・")}になる。各コインは2人に1回ずつ数えられて打ち消し合い、払った人の「逆」だけが残るため。`,
      set: {
        observer: {
          tone: "ok",
          rows: { 誰かが払った: `排他的論理和が${PAID_PARITIES.join("・")}` },
        },
      },
      simplified: `並びは completeTraces で全部数えた。払った人がいる・いないの2つは、発言の並びの集まりも${SAME_SET_PAID_NONE ? "同じ" : "違う"}（排他的論理和で区別できる）。`,
    },
    {
      id: "compare",
      kind: "explore",
      title: "0と1を比べる",
      actor: "checker",
      to: ["observer"],
      summary: `暗号学者0が払った場合と1が払った場合: トレース${TRACES_EQUAL_01 ? "等しい" : "違う"}・失敗${FAILURES_EQUAL_01 ? "等しい" : "違う"}`,
      explain: `匿名性は「誰が払っても、外から見える振る舞いが等しい」と書ける。0が払ったモデルと1が払ったモデルを、トレースと失敗の詳細化で両向きに比べると、どちらも${TRACES_EQUAL_01 && FAILURES_EQUAL_01 ? "等しい" : "等しくない"}。発言をどれだけ見ても、0と1のどちらが払ったかは決められない。`,
      set: {
        checker: {
          isHidden: false,
          tone: TRACES_EQUAL_01 && FAILURES_EQUAL_01 ? "ok" : "bad",
          rows: {
            トレース: TRACES_EQUAL_01 ? "等しい" : "違う",
            失敗: FAILURES_EQUAL_01 ? "等しい" : "違う",
          },
        },
        c0: { tone: "ok" },
        c1: { tone: "ok" },
      },
      simplified:
        "同じ組を ProB で確かめ、結果が一致した（specs/csp）。ほかの組（1と2など）の詳細化の比較は時間がかかるので、下の実験で選んだときだけ計算する。",
    },
    {
      id: "all",
      kind: "explore",
      title: "3人とも同じ並び",
      actor: "checker",
      to: INDEXES.map((i) => `c${i}`),
      summary: `0・1・2のどれが払っても、終わった発言の並びの集まりは${SAME_SET_012 ? "同じ" : "違う"}`,
      explain: `0・1・2のどれが払った場合も、終わりまで動いた発言の並び${PAID_COUNT}通りの集まりは${SAME_SET_012 ? "同じ" : "違う"}。外から見る人に分かるのは「誰かが払った」ことだけで、誰かまでは分からない。`,
      set: {
        ...Object.fromEntries(
          INDEXES.map((i) => [
            `c${i}`,
            { tone: "ok" as const, rows: { 払った: "外からは不明" } },
          ]),
        ),
        observer: { rows: { 誰が: SAME_SET_012 ? "分からない" : "分かる" } },
      },
    },
    {
      id: "leak",
      kind: "found",
      title: "コインが漏れると",
      actor: "checker",
      to: ["c0", "observer"],
      summary: `暗号学者0の見たコインが漏れると、0と1は区別できる: ${traceText(LEAK_PREFIX)}`,
      explain: `暗号学者0の look も外から見えるようにすると、1が払ったときの並び${traceText(LEAK_PREFIX)}を、0が払ったモデルは起こせない。${LEAK_REASON}ただし1と2の間は、終わった並びの集まりが${LEAK_SAME_SET_12 ? "同じままで区別できない" : "違い、区別できる"}。`,
      set: {
        c0: { tone: "bad", rows: { 払った: "外から分かる" } },
        observer: { tone: "bad", rows: { 見える: "say と暗号学者0の look" } },
        checker: { tone: "bad", rows: { 漏れ: "0と1を区別できる" } },
      },
      detail: [
        {
          title: "暗号学者1が払ったときの並び（0が払ったモデルでは起こせない）",
          fields: [
            { label: "並び", value: traceText(LEAK_WITNESS), isCode: true },
            {
              label: "起こせた所まで",
              value: `先頭から${FOUND.check.acceptedCount}個`,
            },
          ],
        },
      ],
      simplified:
        "0と1の区別は acceptsTrace（並びをモデルが起こせるか）で示した。トレース詳細化での比較は下の実験で確かめられる。",
    },
    {
      id: "test",
      kind: "test",
      title: "漏らさないも検査できる",
      actor: "checker",
      to: ["observer"],
      summary:
        "セキュリティの性質も「2つの振る舞いが外から区別できない」として比べられる",
      explain:
        "「秘密を漏らさない」は、テストで1回の実行を見ても確かめにくい。秘密だけを変えた2つのモデルを作り、外から見える振る舞いを詳細化で比べれば、同じ道具で検査できる。テストに落とすなら「秘密だけを変えて何度も実行し、外に出るログの集まりが同じか」を見る形になる。",
      set: { checker: { tone: "ok" }, observer: { tone: "idle" } },
    },
  ],
  lab: {
    title: "2つの場合を比べる",
    hint: "払った人は「0・1・2・なし」、漏れは「あり・なし」（暗号学者0の見たコインが外に出る）。区別できない組は、比較に少し時間がかかる。",
    inputs: [
      { id: "payerA", label: "1つ目: 払った人", initial: "0" },
      { id: "leakA", label: "1つ目: 漏れ", initial: "あり" },
      { id: "payerB", label: "2つ目: 払った人", initial: "1" },
      { id: "leakB", label: "2つ目: 漏れ", initial: "あり" },
    ],
    compute: (values): Field[] => {
      const payerA = parsePayer(values.payerA, 0);
      const leakA = parseLeak(values.leakA, true);
      const payerB = parsePayer(values.payerB, 1);
      const leakB = parseLeak(values.leakB, true);
      const header: Field[] = [
        { label: "1つ目", value: caseText(payerA, leakA) },
        { label: "2つ目", value: caseText(payerB, leakB) },
      ];
      if (payerA === payerB && leakA === leakB) {
        return [
          ...header,
          { label: "区別", value: "同じモデルなので区別できない", tone: "ok" },
        ];
      }
      const a = cryptographers(payerA, leakA);
      const b = cryptographers(payerB, leakB);
      // 片向きで破れたら、もう片向きは調べない（区別できることはもう分かっている）
      const forward = traceRefines(a, b, CRYPTO_ENV);
      const backward = forward.holds ? traceRefines(b, a, CRYPTO_ENV) : null;
      const witness = forward.counterexample ?? backward?.counterexample ?? null;
      if (!witness) {
        return [
          ...header,
          { label: "区別（トレース）", value: "できない", tone: "ok" },
        ];
      }
      const owner = forward.counterexample ? "2つ目" : "1つ目";
      return [
        ...header,
        { label: "区別（トレース）", value: "できる", tone: "bad" },
        {
          label: `${owner}だけが起こせる並び`,
          value: traceText(witness),
          isCode: true,
        },
      ];
    },
  },
};
