import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
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

type Translate = ReturnType<typeof translator>;

function payerText(payer: number | null, t: Translate): string {
  return payer === null
    ? t("誰も払っていない", "nobody paid")
    : t(`暗号学者${payer}`, `cryptographer ${payer}`);
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
function countText(t: Translate): string {
  return PAID_COUNT === NONE_COUNT
    ? t(
        `払った人がいてもいなくても${PAID_COUNT}通り`,
        `there are ${PAID_COUNT} whether or not someone paid`,
      )
    : t(
        `払った人がいるときは${PAID_COUNT}通り、いないときは${NONE_COUNT}通り`,
        `there are ${PAID_COUNT} when someone paid and ${NONE_COUNT} when nobody did`,
      );
}

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
const LEAK_ACCEPTED_COUNT = FOUND.check.acceptedCount;
const LEAK_PREFIX = LEAK_WITNESS.slice(0, FOUND.check.acceptedCount + 1);
type LeakParts = { a: number; b: number; said: number };

/** 反例の先頭「look.0.0.a → look.0.1.b → say.0.x」から、0が払っていないと分かる理由の材料を取り出す。 */
function leakParts(prefix: string[]): LeakParts {
  const match = prefix
    .join(" ")
    .match(/^look\.0\.0\.(\d) look\.0\.1\.(\d) say\.0\.(\d)$/);
  if (!match) throw new Error(`漏れの反例が想定の形ではない: ${prefix.join(" ")}`);
  const [a, b, said] = match.slice(1).map(Number) as [number, number, number];
  // 払っていない人は a xor b を言う。反例は1が払った版の並びなので、0は払っていない言い方をしているはず。
  if (said !== (a ^ b))
    throw new Error("漏れの反例で、暗号学者0が払った人の言い方をしている");
  return { a, b, said };
}
const LEAK_PARTS = leakParts(LEAK_PREFIX);

function leakReason({ a, b, said }: LeakParts, t: Translate): string {
  return t(
    `コインが${a}と${b}で2枚が${a === b ? "同じ" : "違う"}とき、${said}と言うのは払っていない人なので、0は払っていないと分かる。`,
    `With coins ${a} and ${b}, the two are ${a === b ? "the same" : "different"}, and saying ${said} is what a non-payer says, so 0 did not pay.`,
  );
}
const LEAK_SAME_SET_12 =
  traceSetKey(LEAK_COMPLETE.get(1)!) === traceSetKey(LEAK_COMPLETE.get(2)!);

function parsePayer(text: string | undefined, fallback: number | null): number | null {
  const trimmed = (text ?? "").trim();
  if (trimmed === "なし" || trimmed.toLowerCase() === "none") return null;
  const n = Number.parseInt(trimmed, 10);
  // 読めない入力・範囲外は既定値に戻す
  if (Number.isNaN(n) || n < 0 || n >= PEOPLE) return fallback;
  return n;
}

function parseLeak(text: string | undefined, fallback: boolean): boolean {
  const trimmed = (text ?? "").trim().toLowerCase();
  if (trimmed.includes("あり") || trimmed.startsWith("yes")) return true;
  if (trimmed.includes("なし") || trimmed.startsWith("no")) return false;
  return fallback;
}

function caseText(payer: number | null, leak: boolean, t: Translate): string {
  return t(
    `${payerText(payer, t)}・漏れ${leak ? "あり" : "なし"}`,
    `${payerText(payer, t)}, leak: ${leak ? "yes" : "no"}`,
  );
}

export function cspAnonymityLesson(language: Language): Lesson {
  const t = translator(language);
  const sameOrDiffer = (isSame: boolean) =>
    isSame ? t("等しい", "equal") : t("違う", "differ");
  const paidParities = PAID_PARITIES.join(t("・", ", "));
  const noneParities = NONE_PARITIES.join(t("・", ", "));
  return {
    id: "csp-anonymity",
    category: "apply",
    title: t("誰が払ったかを隠す", "Who paid?"),
    subtitle: t(
      "外から区別できないことを、詳細化で確かめる",
      "Check with refinement that the outside cannot tell them apart",
    ),
    summary: t(
      `食事する暗号学者の手順を${PEOPLE}人で書き、外から見える発言だけを比べる。誰が払っても振る舞いは区別できず、誰かが払ったかどうかだけは発言から分かる。コインが漏れると匿名性が崩れる。`,
      `Write the dining cryptographers protocol for ${PEOPLE} people and compare only what they say, which is visible from outside. Whoever paid, the behaviour is indistinguishable; only whether someone paid can be read from what they say. If a coin leaks, anonymity breaks.`,
    ),
    intro: [
      t(
        "食事する暗号学者は、誰が食事代を払ったかを明かさずに、誰かが払ったかどうかだけを全員で確かめる手順である。各自は隣と共有するコインを見て、0か1を発言する。",
        "The dining cryptographers is a protocol where everyone learns whether someone paid for dinner without revealing who. Each person looks at the coins shared with their neighbours and says 0 or 1.",
      ),
      t(
        "匿名性（誰がやったかを外から区別できないこと）は、1回の実行のログを見ても確かめられない。払った人だけを変えた2つのモデルを作り、外から見える発言を詳細化で比べれば、これまでと同じ道具で検査できる。",
        "Anonymity (the outside cannot tell who did it) cannot be checked by looking at the log of one run. Build two models that differ only in who paid and compare what they say, as seen from outside, by refinement; then the same tools as before can check it.",
      ),
      t(
        "図では、暗号学者とコインの間で起きる見る動きと、「外から見る人」に届く発言を分けて追う。払った人を入れ替えて比べた後、コインの見え方を外に漏らす場面で結果が変わるかに注目する。",
        'In the diagram, follow the looks between the cryptographers and the coins separately from what they say, which reaches the "Outside observer". After comparing with the payer swapped, watch whether the result changes once a coin\'s value leaks outside.',
      ),
    ],
    facts: [
      {
        label: t("0と1が払った場合", "0 paid vs 1 paid"),
        value: t(
          `トレース${sameOrDiffer(TRACES_EQUAL_01)}・失敗${sameOrDiffer(FAILURES_EQUAL_01)}`,
          `traces ${sameOrDiffer(TRACES_EQUAL_01)}, failures ${sameOrDiffer(FAILURES_EQUAL_01)}`,
        ),
        tone: TRACES_EQUAL_01 && FAILURES_EQUAL_01 ? "ok" : "bad",
      },
      {
        label: t("発言の並び", "Sequences said"),
        value: t(
          `${PAID_COUNT}通り（排他的論理和は払った人ありで${paidParities}、なしで${noneParities}）`,
          `${PAID_COUNT} (XOR is ${paidParities} if someone paid, ${noneParities} if nobody did)`,
        ),
      },
      {
        label: t("暗号学者0のコインが漏れる", "Cryptographer 0's coins leak"),
        value: t(
          `0と1は区別できる、1と2は区別${LEAK_SAME_SET_12 ? "できない" : "できる"}`,
          `0 and 1 can be told apart; 1 and 2 ${LEAK_SAME_SET_12 ? "cannot" : "can"}`,
        ),
        tone: "bad",
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 7.4節（匿名性の検証例）`,
          `${CSP_BOOK_EN}, section 7.4 (verifying anonymity)`,
        ),
      },
    ],
    actors: [
      ...INDEXES.map((i) => ({
        id: `c${i}`,
        label: t(`暗号学者${i}`, `Cryptographer ${i}`),
        sublabel: t(
          `コイン${i}とコイン${(i + 1) % PEOPLE}を見る`,
          `sees coins ${i} and ${(i + 1) % PEOPLE}`,
        ),
        icon: "person",
        x: [14, 38, 62][i]!,
        y: 27,
        initial: { rows: { [t("払った", "paid")]: t("？", "?") } },
      })),
      {
        id: "coins",
        label: t("コイン", "Coins"),
        sublabel: t(`${PEOPLE}枚、隣どうしで共有`, `${PEOPLE}, shared by neighbours`),
        icon: "dice",
        x: 14,
        y: 73,
        initial: { rows: { [t("裏表", "face")]: t("見えない", "hidden") } },
      },
      {
        id: "observer",
        label: t("外から見る人", "Outside observer"),
        sublabel: t("発言 say だけ見える", "sees only say"),
        icon: "person",
        x: 50,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("振る舞いを比べる", "compares behaviour"),
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
        title: t("隣とコインを共有", "Share coins with neighbours"),
        actor: "coins",
        to: INDEXES.map((i) => `c${i}`),
        summary: t(
          `暗号学者iはコインiとコインi+1を見る。look.i.j.v は「iがコインjでvを見た」`,
          `Cryptographer i sees coins i and i+1. look.i.j.v means "i saw v on coin j"`,
        ),
        explain: t(
          `${PEOPLE}人が丸く座り、隣どうしの間にコインを1枚ずつ置く。各自は自分のコインと右隣のコインの2枚を見る。イベント look.0.1.0 は「暗号学者0がコイン1を見たら0だった」という意味で、外からは見えない（隠す）。`,
          `${PEOPLE} people sit in a circle with one coin between each pair of neighbours. Each person sees two coins: their own and the one to the right. The event look.0.1.0 means "cryptographer 0 looked at coin 1 and saw 0", and it is not visible from outside (hidden).`,
        ),
        set: {
          coins: {
            tone: "wait",
            rows: { [t("裏表", "face")]: t("投げて決まる", "set by a toss") },
          },
          ...Object.fromEntries(
            INDEXES.map((i) => [
              `c${i}`,
              {
                rows: {
                  [t("見る", "sees")]: t(
                    `コイン${i}・${(i + 1) % PEOPLE}`,
                    `coins ${i}, ${(i + 1) % PEOPLE}`,
                  ),
                },
              },
            ]),
          ),
        },
        detail: [
          {
            title: t(
              "見る動きも含めた並びの例（暗号学者0が払い、0のコインが漏れる版）",
              "Example sequence including looks (0 paid, 0's coins leak)",
            ),
            fields: [
              {
                label: t("並び", "Sequence"),
                value: traceText(LEAK_EXAMPLE),
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "Chaum の古典の手順をそのまま使う。モデルを小さくするために、コインを見る順を持ち主→左隣に固定した（発言には影響しない）。式はこのサイトのモデル（cspCases.ts）に合わせたもので、実物の CSPM（FDR の記法）とは書き方が違う。",
          "This uses Chaum's classic protocol as is. To keep the model small, the order of looking at coins is fixed to owner → left neighbour (it does not affect what is said). The expressions follow this site's model (cspCases.ts) and differ from real CSPM (the FDR notation).",
        ),
      },
      {
        id: "say",
        kind: "spec",
        title: t("同じなら0を言う", "Same coins: say 0"),
        actor: "c0",
        to: ["observer"],
        summary: t(
          `2枚が同じなら0、違えば1を言う。払った人だけ逆を言う。say.i.x は「iがxと言った」`,
          `Say 0 if the two coins match, 1 if not. Only the payer says the opposite. say.i.x means "i said x"`,
        ),
        explain: t(
          `各自は見た2枚が同じなら0、違えば1を言う（say.0.1 は「暗号学者0が1と言った」）。食事代を払った人だけは逆を言う。外から見える（隠さない）のは、この発言だけにする。`,
          `Each person says 0 if the two coins they saw match, and 1 if they differ (say.0.1 means "cryptographer 0 said 1"). Only the person who paid for dinner says the opposite. Only these statements are visible from outside (not hidden).`,
        ),
        set: {
          observer: {
            isHidden: false,
            tone: "idle",
            rows: { [t("見える", "sees")]: t("say.i.x だけ", "only say.i.x") },
          },
          c0: {
            rows: {
              [t("言う", "says")]: t("同じなら0、違えば1", "0 if same, 1 if not"),
            },
          },
        },
        detail: [
          {
            title: t(
              "暗号学者0が払ったときの発言の並びの例",
              "Example of what is said when cryptographer 0 paid",
            ),
            fields: [
              { label: t("並び", "Sequence"), value: traceText(EXAMPLE), isCode: true },
            ],
          },
        ],
      },
      {
        id: "parity",
        kind: "run",
        title: t("発言を全部数える", "Count everything said"),
        actor: "observer",
        summary: t(
          `並びは${PAID_COUNT}通り。排他的論理和は払った人がいれば${paidParities}、いなければ${noneParities}`,
          `${PAID_COUNT} sequences. The XOR is ${paidParities} if someone paid, ${noneParities} if nobody did`,
        ),
        explain: t(
          `終わりまで動いた実行の発言の並びを全部集めると、${countText(t)}。どの並びでも、3つの発言の排他的論理和（1の数が奇数なら1）は、払った人がいれば${paidParities}、いなければ${noneParities}になる。各コインは2人に1回ずつ数えられて打ち消し合い、払った人の「逆」だけが残るため。`,
          `Collecting what is said in every run that finishes, ${countText(t)}. In every sequence, the XOR of the three statements (1 if the number of 1s is odd) is ${paidParities} if someone paid and ${noneParities} if nobody did. Each coin is counted once by each of two people and cancels out, leaving only the payer's "opposite".`,
        ),
        set: {
          observer: {
            tone: "ok",
            rows: {
              [t("誰かが払った", "someone paid")]: t(
                `排他的論理和が${paidParities}`,
                `XOR is ${paidParities}`,
              ),
            },
          },
        },
        simplified: t(
          `並びは completeTraces で全部数えた。払った人がいる・いないの2つは、発言の並びの集まりも${SAME_SET_PAID_NONE ? "同じ" : "違う"}（排他的論理和で区別できる）。`,
          `All sequences were counted with completeTraces. For "someone paid" and "nobody paid", the sets of sequences are ${SAME_SET_PAID_NONE ? "the same" : "different"} too (XOR tells them apart).`,
        ),
      },
      {
        id: "compare",
        kind: "explore",
        title: t("0と1を比べる", "Compare 0 and 1"),
        actor: "checker",
        to: ["observer"],
        summary: t(
          `暗号学者0が払った場合と1が払った場合: トレース${sameOrDiffer(TRACES_EQUAL_01)}・失敗${sameOrDiffer(FAILURES_EQUAL_01)}`,
          `Cryptographer 0 paid vs 1 paid: traces ${sameOrDiffer(TRACES_EQUAL_01)}, failures ${sameOrDiffer(FAILURES_EQUAL_01)}`,
        ),
        explain: t(
          `匿名性は「誰が払っても、外から見える振る舞いが等しい」と書ける。0が払ったモデルと1が払ったモデルを、トレースと失敗の詳細化で両向きに比べると、どちらも${TRACES_EQUAL_01 && FAILURES_EQUAL_01 ? "等しい" : "等しくない"}。発言をどれだけ見ても、0と1のどちらが払ったかは決められない。`,
          `Anonymity can be stated as "whoever paid, the behaviour visible from outside is equal". Comparing the model where 0 paid with the one where 1 paid, by trace and failures refinement in both directions, both are ${TRACES_EQUAL_01 && FAILURES_EQUAL_01 ? "equal" : "not equal"}. However much you watch what is said, you cannot decide whether 0 or 1 paid.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: TRACES_EQUAL_01 && FAILURES_EQUAL_01 ? "ok" : "bad",
            rows: {
              [t("トレース", "traces")]: sameOrDiffer(TRACES_EQUAL_01),
              [t("失敗", "failures")]: sameOrDiffer(FAILURES_EQUAL_01),
            },
          },
          c0: { tone: "ok" },
          c1: { tone: "ok" },
        },
        simplified: t(
          "同じ組を ProB で確かめ、結果が一致した（specs/csp）。ほかの組（1と2など）の詳細化の比較は時間がかかるので、下の実験で選んだときだけ計算する。",
          "The same pair was checked with ProB and the results agreed (specs/csp). Refinement checks for other pairs (such as 1 and 2) take time, so they are computed only when you pick them in the lab below.",
        ),
      },
      {
        id: "all",
        kind: "explore",
        title: t("3人とも同じ並び", "Same sequences for all three"),
        actor: "checker",
        to: INDEXES.map((i) => `c${i}`),
        summary: t(
          `0・1・2のどれが払っても、終わった発言の並びの集まりは${SAME_SET_012 ? "同じ" : "違う"}`,
          `Whether 0, 1 or 2 paid, the set of finished sequences is ${SAME_SET_012 ? "the same" : "different"}`,
        ),
        explain: t(
          `0・1・2のどれが払った場合も、終わりまで動いた発言の並び${PAID_COUNT}通りの集まりは${SAME_SET_012 ? "同じ" : "違う"}。外から見る人に分かるのは「誰かが払った」ことだけで、誰かまでは分からない。`,
          `Whether 0, 1 or 2 paid, the set of ${PAID_COUNT} sequences said in finished runs is ${SAME_SET_012 ? "the same" : "different"}. The outside observer learns only that "someone paid", not who.`,
        ),
        set: {
          ...Object.fromEntries(
            INDEXES.map((i) => [
              `c${i}`,
              {
                tone: "ok" as const,
                rows: { [t("払った", "paid")]: t("外からは不明", "unknown outside") },
              },
            ]),
          ),
          observer: {
            rows: {
              [t("誰が", "who")]: SAME_SET_012
                ? t("分からない", "cannot tell")
                : t("分かる", "can tell"),
            },
          },
        },
      },
      {
        id: "leak",
        kind: "found",
        title: t("コインが漏れると", "When a coin leaks"),
        actor: "checker",
        to: ["c0", "observer"],
        summary: t(
          `暗号学者0の見たコインが漏れると、0と1は区別できる: ${traceText(LEAK_PREFIX)}`,
          `If the coins cryptographer 0 sees leak, 0 and 1 can be told apart: ${traceText(LEAK_PREFIX)}`,
        ),
        explain: t(
          `暗号学者0の look も外から見えるようにすると、1が払ったときの並び${traceText(LEAK_PREFIX)}を、0が払ったモデルは起こせない。${leakReason(LEAK_PARTS, t)}ただし1と2の間は、終わった並びの集まりが${LEAK_SAME_SET_12 ? "同じままで区別できない" : "違い、区別できる"}。`,
          `If cryptographer 0's look events are also visible from outside, the model where 0 paid cannot produce the sequence ${traceText(LEAK_PREFIX)} from the run where 1 paid. ${leakReason(LEAK_PARTS, t)} Between 1 and 2, however, the sets of finished sequences ${LEAK_SAME_SET_12 ? "stay the same, so they cannot be told apart" : "differ, so they can be told apart"}.`,
        ),
        set: {
          c0: {
            tone: "bad",
            rows: { [t("払った", "paid")]: t("外から分かる", "visible outside") },
          },
          observer: {
            tone: "bad",
            rows: {
              [t("見える", "sees")]: t("say と暗号学者0の look", "say and 0's look"),
            },
          },
          checker: {
            tone: "bad",
            rows: { [t("漏れ", "leak")]: t("0と1を区別できる", "tells 0 from 1") },
          },
        },
        detail: [
          {
            title: t(
              "暗号学者1が払ったときの並び（0が払ったモデルでは起こせない）",
              "Sequence when cryptographer 1 paid (impossible if 0 paid)",
            ),
            fields: [
              {
                label: t("並び", "Sequence"),
                value: traceText(LEAK_WITNESS),
                isCode: true,
              },
              {
                label: t("起こせた所まで", "Possible up to"),
                value: t(
                  `先頭から${LEAK_ACCEPTED_COUNT}個`,
                  `the first ${LEAK_ACCEPTED_COUNT} ${LEAK_ACCEPTED_COUNT === 1 ? "event" : "events"}`,
                ),
              },
            ],
          },
        ],
        simplified: t(
          "0と1の区別は acceptsTrace（並びをモデルが起こせるか）で示した。トレース詳細化での比較は下の実験で確かめられる。",
          "Telling 0 from 1 is shown with acceptsTrace (whether the model can produce the sequence). You can check the comparison by trace refinement in the lab below.",
        ),
      },
      {
        id: "test",
        kind: "test",
        title: t("漏らさないも検査できる", "Not leaking can be checked too"),
        actor: "checker",
        to: ["observer"],
        summary: t(
          "セキュリティの性質も「2つの振る舞いが外から区別できない」として比べられる",
          'Security properties can also be compared as "two behaviours are indistinguishable from outside"',
        ),
        explain: t(
          "「秘密を漏らさない」は、テストで1回の実行を見ても確かめにくい。秘密だけを変えた2つのモデルを作り、外から見える振る舞いを詳細化で比べれば、同じ道具で検査できる。テストに落とすなら「秘密だけを変えて何度も実行し、外に出るログの集まりが同じか」を見る形になる。",
          '"Does not leak the secret" is hard to confirm by looking at one test run. Build two models that differ only in the secret and compare their outside behaviour by refinement, and the same tools can check it. As a test, it becomes "change only the secret, run many times, and check that the set of logs that come out is the same".',
        ),
        set: { checker: { tone: "ok" }, observer: { tone: "idle" } },
      },
    ],
    lab: {
      title: t("2つの場合を比べる", "Compare two cases"),
      hint: t(
        "払った人は「0・1・2・なし」、漏れは「あり・なし」（暗号学者0の見たコインが外に出る）。区別できない組は、比較に少し時間がかかる。",
        'Payer is "0", "1", "2" or "none"; leak is "yes" or "no" (the coins cryptographer 0 sees become visible outside). Pairs that cannot be told apart take a little longer to compare.',
      ),
      inputs: [
        { id: "payerA", label: t("1つ目: 払った人", "Case 1: payer"), initial: "0" },
        {
          id: "leakA",
          label: t("1つ目: 漏れ", "Case 1: leak"),
          initial: t("あり", "yes"),
        },
        { id: "payerB", label: t("2つ目: 払った人", "Case 2: payer"), initial: "1" },
        {
          id: "leakB",
          label: t("2つ目: 漏れ", "Case 2: leak"),
          initial: t("あり", "yes"),
        },
      ],
      compute: (values): Field[] => {
        const payerA = parsePayer(values.payerA, 0);
        const leakA = parseLeak(values.leakA, true);
        const payerB = parsePayer(values.payerB, 1);
        const leakB = parseLeak(values.leakB, true);
        const header: Field[] = [
          { label: t("1つ目", "Case 1"), value: caseText(payerA, leakA, t) },
          { label: t("2つ目", "Case 2"), value: caseText(payerB, leakB, t) },
        ];
        if (payerA === payerB && leakA === leakB) {
          return [
            ...header,
            {
              label: t("区別", "Distinguishable"),
              value: t("同じモデルなので区別できない", "no, it is the same model"),
              tone: "ok",
            },
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
            {
              label: t("区別（トレース）", "Distinguishable (traces)"),
              value: t("できない", "no"),
              tone: "ok",
            },
          ];
        }
        const owner = forward.counterexample
          ? t("2つ目", "case 2")
          : t("1つ目", "case 1");
        return [
          ...header,
          {
            label: t("区別（トレース）", "Distinguishable (traces)"),
            value: t("できる", "yes"),
            tone: "bad",
          },
          {
            label: t(
              `${owner}だけが起こせる並び`,
              `Sequence only ${owner} can produce`,
            ),
            value: traceText(witness),
            isCode: true,
          },
        ];
      },
    },
  };
}
