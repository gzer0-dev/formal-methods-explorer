import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import {
  checkLaw,
  ext,
  type Failure,
  failuresRefines,
  int,
  type LawCheck,
  moves,
  par,
  pre,
  type Proc,
  STOP,
} from "../csp";

// 法則の両辺に使う小さなプロセス（csp.test.ts と同じ組）。
const P: Proc = pre("p", STOP);
const Q: Proc = pre("q", STOP);

interface LawPair {
  id: string;
  name: string;
  /** 英語の画面での名前。name と同じなら省く。 */
  nameEn?: string;
  left: Proc;
  right: Proc;
  leftText: string;
  rightText: string;
}

const PAIRS: LawPair[] = [
  {
    id: "1",
    name: "P □ STOP = P",
    left: ext(P, STOP),
    right: P,
    leftText: "P □ STOP",
    rightText: "P",
  },
  {
    id: "2",
    name: "P □ Q = Q □ P",
    left: ext(P, Q),
    right: ext(Q, P),
    leftText: "P □ Q",
    rightText: "Q □ P",
  },
  {
    id: "3",
    name: "(a → P) □ (a → Q) = a → (P ⊓ Q)",
    left: ext(pre("a", P), pre("a", Q)),
    right: pre("a", int(P, Q)),
    leftText: "(a → P) □ (a → Q)",
    rightText: "a → (P ⊓ Q)",
  },
  {
    id: "4",
    name: "a → (P □ Q) と (a → P) □ (a → Q)",
    nameEn: "a → (P □ Q) vs (a → P) □ (a → Q)",
    left: pre("a", ext(P, Q)),
    right: ext(pre("a", P), pre("a", Q)),
    leftText: "a → (P □ Q)",
    rightText: "(a → P) □ (a → Q)",
  },
];

const [STOP_LAW, COMMUTE_LAW, SAME_EVENT_LAW, NOT_LAW] = PAIRS as [
  LawPair,
  LawPair,
  LawPair,
  LawPair,
];

function check(pair: LawPair): LawCheck {
  return checkLaw(pair.left, pair.right, {});
}

const STOP_RESULT = check(STOP_LAW);
const COMMUTE_RESULT = check(COMMUTE_LAW);
const SAME_EVENT_RESULT = check(SAME_EVENT_LAW);
const NOT_LAW_RESULT = check(NOT_LAW);
// 法則ではない組で、どちら向きの失敗詳細化が破れるか（左を仕様、右を実装にした向き）。
const NOT_LAW_FAILURE = failuresRefines(NOT_LAW.left, NOT_LAW.right, {});
const NOT_LAW_REVERSE = failuresRefines(NOT_LAW.right, NOT_LAW.left, {});
if (!NOT_LAW_FAILURE.counterexample) {
  throw new Error("a → (P □ Q) ⊑F (a → P) □ (a → Q) の反例が見つからない");
}
const NOT_LAW_COUNTER: Failure = NOT_LAW_FAILURE.counterexample;
// a → (P □ Q) が a の後に差し出すイベント
const AFTER_A_OFFERS = moves(ext(P, Q), {}).map((m) => m.ev);

// 部品ごとに確かめれば全体も成り立つ: 等しい2つを、同じ外側の式（周りの部品）に入れても等しいまま。
const CONTEXT_EVENT = "b";
const IN_CHOICE = checkLaw(
  ext(SAME_EVENT_LAW.left, pre(CONTEXT_EVENT, STOP)),
  ext(SAME_EVENT_LAW.right, pre(CONTEXT_EVENT, STOP)),
  {},
);
const IN_PARALLEL = checkLaw(
  par(SAME_EVENT_LAW.left, [], pre(CONTEXT_EVENT, STOP)),
  par(SAME_EVENT_LAW.right, [], pre(CONTEXT_EVENT, STOP)),
  {},
);

function pairName(pair: LawPair, language: Language): string {
  return language === "ja" ? pair.name : (pair.nameEn ?? pair.name);
}

function yesNo(isEqual: boolean, language: Language): string {
  const t = translator(language);
  return isEqual ? t("等しい", "equal") : t("等しくない", "not equal");
}

function isLaw(result: LawCheck): boolean {
  return result.traces && result.failures && result.failuresDivergences;
}

function lawRows(result: LawCheck, language: Language): Record<string, string> {
  const t = translator(language);
  return {
    [t("トレース", "traces")]: yesNo(result.traces, language),
    [t("失敗", "failures")]: yesNo(result.failures, language),
    [t("失敗発散", "failures-div.")]: yesNo(result.failuresDivergences, language),
  };
}

function failureText(failure: Failure): string {
  const trace = failure.trace.length > 0 ? `⟨${failure.trace.join(", ")}⟩` : "⟨⟩";
  return `(${trace}, {${failure.refusal.join(", ")}})`;
}

function lawFields(result: LawCheck, language: Language): Field[] {
  const t = translator(language);
  return [
    {
      label: t("トレースで", "By traces"),
      value: yesNo(result.traces, language),
      tone: result.traces ? "ok" : "bad",
    },
    {
      label: t("失敗で", "By failures"),
      value: yesNo(result.failures, language),
      tone: result.failures ? "ok" : "bad",
    },
    {
      label: t("失敗発散で", "By failures-divergences"),
      value: yesNo(result.failuresDivergences, language),
      tone: result.failuresDivergences ? "ok" : "bad",
    },
  ];
}

function parsePair(text: string | undefined): LawPair {
  const trimmed = (text ?? "").trim();
  // 読めない入力は既定の組（4: 法則ではない組）に戻す
  return PAIRS.find((pair) => pair.id === trimmed) ?? NOT_LAW;
}

export function cspLawsLesson(language: Language): Lesson {
  const t = translator(language);
  const lawText = (result: LawCheck) =>
    isLaw(result) ? t("法則", "a law") : t("法則ではない", "not a law");
  const holdsText = (holds: boolean) =>
    holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
  const list = (events: string[]) => t(events.join("・"), events.join(", "));
  const notLawName = pairName(NOT_LAW, language);
  const formula = t("式", "expression");
  const afterA = t("a の後", "after a");
  return {
    id: "csp-laws",
    category: "csp",
    title: t("代数法則を確かめる", "Checking algebraic laws"),
    subtitle: t(
      "式の書き換えが正しいかを、詳細化を両向きに調べて確かめる",
      "Check a rewrite by testing refinement both ways",
    ),
    summary: t(
      `「P □ STOP = P」のような CSP の法則を、検査器で詳細化を両向きに調べて確かめる。a → (P □ Q) と (a → P) □ (a → Q) はトレースでは${yesNo(NOT_LAW_RESULT.traces, language)}が、失敗では${yesNo(NOT_LAW_RESULT.failures, language)}。`,
      `Check CSP laws such as "P □ STOP = P" by having the checker test refinement in both directions. a → (P □ Q) and (a → P) □ (a → Q) are ${yesNo(NOT_LAW_RESULT.traces, language)} by traces, but ${yesNo(NOT_LAW_RESULT.failures, language)} by failures.`,
    ),
    intro: [
      t(
        "代数法則は、算数の x + 0 = x のように、CSP の式どうしが等しいことを表す決まりだ。2つのプロセスが等しいとは、互いに相手を詳細化すること、つまり左右のどちらを仕様にしても詳細化が成り立つことを指す。",
        "An algebraic law, like x + 0 = x in arithmetic, states that two CSP expressions are equal. Two processes are equal when each refines the other, that is, refinement holds whichever side you take as the spec.",
      ),
      t(
        "法則を使うと、式を書き換えて仕様を短くしたり、2つの書き方が同じ振る舞いかを判断したりできる。リファクタリングの前後で振る舞いが変わらないかを確かめる作業に近い。見た目が似ていても等しくない組があり、それはトレースを比べるだけでは分からない。",
        "With laws you can rewrite expressions to shorten a spec, or decide whether two ways of writing something behave the same. It is close to checking that a refactoring did not change behaviour. Some pairs look alike yet are not equal, and comparing traces alone will not tell you.",
      ),
      t(
        "図では、検査器が左辺と右辺のカードを両向きに比べ、比べ方ごとの答えを見る。同じイベントで始まる外部選択が内部選択と同じになる場面と、トレースは同じなのに失敗で食い違う組が要点になる。",
        "In the diagram, the checker compares the left-hand and right-hand cards in both directions, and you see the answer for each kind of comparison. The key moments are an external choice whose branches start with the same event turning out equal to an internal choice, and a pair with the same traces that differs on failures.",
      ),
    ],
    facts: [
      {
        label: STOP_LAW.name,
        value: lawText(STOP_RESULT),
        tone: isLaw(STOP_RESULT) ? "ok" : "bad",
      },
      {
        label: SAME_EVENT_LAW.name,
        value: lawText(SAME_EVENT_RESULT),
        tone: isLaw(SAME_EVENT_RESULT) ? "ok" : "bad",
      },
      {
        label: notLawName,
        value: lawText(NOT_LAW_RESULT),
        tone: isLaw(NOT_LAW_RESULT) ? "ok" : "bad",
      },
      {
        label: t("失敗の反例", "Failure counterexample"),
        value: failureText(NOT_LAW_COUNTER),
        tone: "bad",
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 6.6節（CSPの基礎）`,
          `${CSP_BOOK_EN}, section 6.6 (foundations of CSP)`,
        ),
      },
    ],
    actors: [
      {
        id: "left",
        label: t("左辺", "Left side"),
        sublabel: STOP_LAW.leftText,
        icon: "process",
        x: 14,
        y: 50,
      },
      {
        id: "right",
        label: t("右辺", "Right side"),
        sublabel: STOP_LAW.rightText,
        icon: "process",
        x: 38,
        y: 50,
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("詳細化を両向きに", "refinement both ways"),
        icon: "checker",
        x: 62,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "context",
        label: t("周りの部品", "Surrounding parts"),
        sublabel: t(
          `□ ${CONTEXT_EVENT} → STOP など`,
          `□ ${CONTEXT_EVENT} → STOP, etc.`,
        ),
        icon: "route",
        x: 86,
        y: 50,
        initial: { isHidden: true },
      },
    ],
    stageHeight: 300,
    links: [
      { from: "checker", to: "left" },
      { from: "checker", to: "right" },
      { from: "context", to: "checker" },
    ],
    steps: [
      {
        id: "laws",
        kind: "spec",
        title: t("法則で式を書き換える", "Rewrite with laws"),
        actor: "left",
        to: ["right"],
        summary: t(
          `${STOP_LAW.name}: 動けない STOP を選択肢に足しても何も変わらない`,
          `${STOP_LAW.name}: adding the stuck STOP as an option changes nothing`,
        ),
        explain: t(
          "CSP には、算数の「x + 0 = x」のような代数法則がある。P □ STOP = P は、外部選択 □ に、何もしない STOP を足しても、選べる中身は P のままという法則。法則を使えば、式を書き換えて2つのプロセスが等しいことを示せる。",
          'CSP has algebraic laws like "x + 0 = x" in arithmetic. P □ STOP = P says that adding STOP, which does nothing, to an external choice □ leaves the available options the same as P. With laws you can rewrite expressions to show that two processes are equal.',
        ),
        set: {
          left: { tone: "wait", rows: { [formula]: STOP_LAW.leftText } },
          right: { tone: "wait", rows: { [formula]: STOP_LAW.rightText } },
        },
        detail: [
          {
            title: t("このレッスンで使う部品", "Parts used in this lesson"),
            fields: [
              { label: "P", value: "p → STOP", isCode: true },
              { label: "Q", value: "q → STOP", isCode: true },
            ],
          },
        ],
        simplified: t(
          "式はこのサイトのモデル（csp.ts）に合わせた短い書き方で、実物の CSPM（FDR の記法）とは書き方が違う（□ は []、⊓ は |~|）。",
          "The expressions are short forms matching this site's model (csp.ts) and differ from real CSPM (the notation used by FDR): □ is [] and ⊓ is |~|.",
        ),
      },
      {
        id: "both-ways",
        kind: "explore",
        title: t("両向きの詳細化で確かめる", "Check refinement both ways"),
        actor: "checker",
        to: ["left", "right"],
        summary: t(
          `左 ⊑ 右 と 右 ⊑ 左 を3種類の比べ方で調べ、どれも${yesNo(isLaw(STOP_RESULT), language)}`,
          `Check left ⊑ right and right ⊑ left with all three comparisons: ${yesNo(isLaw(STOP_RESULT), language)} in each`,
        ),
        explain: t(
          "2つが等しいとは、互いに相手を詳細化すること。検査器で「左を仕様、右を実装」と「右を仕様、左を実装」の両方を調べれば、法則が成り立つかを書き換えなしで確かめられる。トレース・失敗・失敗発散の3種類で、それぞれ答えを出す。",
          'Two processes are equal when each refines the other. By checking both "left as spec, right as implementation" and "right as spec, left as implementation", the checker confirms a law without any rewriting. It gives an answer for each of traces, failures and failures-divergences.',
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "ok",
            rows: lawRows(STOP_RESULT, language),
          },
          left: { tone: "ok" },
          right: { tone: "ok" },
        },
        simplified: t(
          "この組は ProB でも失敗発散詳細化（[FD=）を両向きに確かめ、結果が一致した（specs/csp）。",
          "This pair was also checked with ProB for failures-divergences refinement ([FD=) in both directions, and the results agreed (specs/csp).",
        ),
      },
      {
        id: "commute",
        kind: "explore",
        title: t("□ は並べる順を問わない", "□ ignores the order"),
        actor: "checker",
        to: ["left", "right"],
        summary: t(
          `${COMMUTE_LAW.name}は、3種類とも${yesNo(isLaw(COMMUTE_RESULT), language)}`,
          `${COMMUTE_LAW.name}: ${yesNo(isLaw(COMMUTE_RESULT), language)} under all three`,
        ),
        explain: t(
          "外部選択は、差し出す選択肢を左右どちらに書いても、環境から見た選べる中身は同じ。検査器でも3種類の比べ方すべてで等しくなる。",
          "For external choice, whichever side you write each option on, the options the environment can choose from are the same. The checker finds them equal under all three comparisons.",
        ),
        set: {
          left: { tone: "ok", rows: { [formula]: COMMUTE_LAW.leftText } },
          right: { tone: "ok", rows: { [formula]: COMMUTE_LAW.rightText } },
          checker: { tone: "ok", rows: lawRows(COMMUTE_RESULT, language) },
        },
        simplified: t(
          "同じ組を ProB でも確かめ、失敗発散で両向きに等しいことが一致した（リポジトリの specs/csp）。",
          "The same pair was checked with ProB too, and it agreed that they are equal both ways under failures-divergences (specs/csp in the repository).",
        ),
      },
      {
        id: "same-event",
        kind: "explore",
        title: t("同じ a の選択は内部選択", "Same-a choice is internal"),
        actor: "checker",
        to: ["left", "right"],
        summary: t(
          `${SAME_EVENT_LAW.name}は、3種類とも${yesNo(isLaw(SAME_EVENT_RESULT), language)}`,
          `${SAME_EVENT_LAW.name}: ${yesNo(isLaw(SAME_EVENT_RESULT), language)} under all three`,
        ),
        explain: t(
          "外部選択の両側が同じイベント a で始まると、環境は a を起こせても、どちらの a かは選べない。だから先は P と Q のどちらかをプロセスが勝手に決める内部選択 ⊓ と同じになる。「□ は環境が選ぶ」と覚えていると直感に反するので、ここは要点になる。",
          'When both sides of an external choice start with the same event a, the environment can perform a but cannot choose which a. So what follows is the same as internal choice ⊓, where the process itself decides between P and Q. This goes against the intuition that "□ means the environment chooses", which makes it a key point.',
        ),
        set: {
          left: { tone: "ok", rows: { [formula]: SAME_EVENT_LAW.leftText } },
          right: { tone: "ok", rows: { [formula]: SAME_EVENT_LAW.rightText } },
          checker: { tone: "ok", rows: lawRows(SAME_EVENT_RESULT, language) },
        },
        simplified: t(
          "この組は ProB でも失敗発散詳細化（[FD=）を両向きに確かめ、結果が一致した（specs/csp）。",
          "This pair was also checked with ProB for failures-divergences refinement ([FD=) in both directions, and the results agreed (specs/csp).",
        ),
      },
      {
        id: "not-law",
        kind: "found",
        title: t("似ているが法則ではない", "Looks alike, but not a law"),
        actor: "checker",
        to: ["left", "right"],
        summary: t(
          `${NOT_LAW.name}: トレースでは${yesNo(NOT_LAW_RESULT.traces, language)}が、失敗では${yesNo(NOT_LAW_RESULT.failures, language)}。反例${failureText(NOT_LAW_COUNTER)}`,
          `${notLawName}: ${yesNo(NOT_LAW_RESULT.traces, language)} by traces, but ${yesNo(NOT_LAW_RESULT.failures, language)} by failures. Counterexample ${failureText(NOT_LAW_COUNTER)}`,
        ),
        explain: t(
          `どちらも a の後に p か q が起きるので、トレースは同じ。ところが${NOT_LAW.rightText}は a の時点で片方の先へ勝手に進むので、a の後に${NOT_LAW_COUNTER.refusal.join("・")}を拒否できる。${NOT_LAW.leftText}は a の後も両方を差し出すので拒否しない。`,
          `In both, p or q happens after a, so the traces are the same. But ${NOT_LAW.rightText} commits to one branch on its own at a, so after a it can refuse ${list(NOT_LAW_COUNTER.refusal)}. ${NOT_LAW.leftText} still offers both after a, so it does not refuse.`,
        ),
        set: {
          left: {
            tone: "ok",
            rows: {
              [formula]: NOT_LAW.leftText,
              [afterA]: t(
                `${AFTER_A_OFFERS.join("・")}を受け付ける`,
                `accepts ${list(AFTER_A_OFFERS)}`,
              ),
            },
          },
          right: {
            tone: "bad",
            rows: {
              [formula]: NOT_LAW.rightText,
              [afterA]: t(
                `${NOT_LAW_COUNTER.refusal.join("・")}を拒否できる`,
                `can refuse ${list(NOT_LAW_COUNTER.refusal)}`,
              ),
            },
          },
          checker: { tone: "bad", rows: lawRows(NOT_LAW_RESULT, language) },
        },
        detail: [
          {
            title: t("向きごとの失敗詳細化", "Failures refinement in each direction"),
            fields: [
              {
                label: `${NOT_LAW.leftText} ⊑F ${NOT_LAW.rightText}`,
                value: holdsText(NOT_LAW_FAILURE.holds),
                tone: NOT_LAW_FAILURE.holds ? "ok" : "bad",
              },
              {
                label: t("その反例", "Its counterexample"),
                value: failureText(NOT_LAW_COUNTER),
                tone: "bad",
              },
              {
                label: `${NOT_LAW.rightText} ⊑F ${NOT_LAW.leftText}`,
                value: holdsText(NOT_LAW_REVERSE.holds),
                tone: NOT_LAW_REVERSE.holds ? "ok" : "bad",
              },
            ],
          },
        ],
        simplified: t(
          "この組は ProB でもトレース詳細化（[T=）が成り立ち、失敗詳細化（[F=）が破れることを片向きで確かめ、結果が一致した（specs/csp）。",
          "For this pair, ProB was also used to check, in one direction, that trace refinement ([T=) holds and failures refinement ([F=) fails, and the results agreed (specs/csp).",
        ),
      },
      {
        id: "compose",
        kind: "test",
        title: t("部品ごとに確かめる", "Check part by part"),
        actor: "context",
        to: ["checker"],
        summary: t(
          `等しい2つを「□ ${CONTEXT_EVENT} → STOP」や並行合成の中に入れても、失敗発散で${yesNo(IN_CHOICE.failuresDivergences && IN_PARALLEL.failuresDivergences, language)}`,
          `Put the equal pair inside "□ ${CONTEXT_EVENT} → STOP" or a parallel composition, and they stay ${yesNo(IN_CHOICE.failuresDivergences && IN_PARALLEL.failuresDivergences, language)} under failures-divergences`,
        ),
        explain: t(
          `詳細化は、どの演算子で組み立てても保たれる。だから部品ごとに「仕様を満たす」と確かめれば、組み立てた全体も成り立つ。${SAME_EVENT_LAW.name}の両辺を同じ周りの部品に入れて比べても、検査器の答えは変わらない。単体テストを積んで全体を信じる考え方に近いが、こちらはどの組み合わせでも保証される。`,
          `Refinement is preserved by every operator you build with. So if you check that each part satisfies its spec, the assembled whole does too. Putting both sides of ${SAME_EVENT_LAW.name} into the same surrounding parts and comparing does not change the checker's answer. It is like trusting the whole because the unit tests pass, except that here it is guaranteed for every combination.`,
        ),
        set: {
          context: {
            isHidden: false,
            tone: "ok",
            rows: {
              [t("□ の中", "inside □")]: yesNo(isLaw(IN_CHOICE), language),
              [t("並行合成の中", "inside |||")]: yesNo(isLaw(IN_PARALLEL), language),
            },
          },
          checker: { tone: "ok", rows: lawRows(IN_PARALLEL, language) },
        },
        detail: [
          {
            title: t("周りの部品に入れて比べた式", "Expressions compared in context"),
            fields: [
              {
                label: t("□ の中", "Inside □"),
                value: t(
                  `(${SAME_EVENT_LAW.leftText}) □ (${CONTEXT_EVENT} → STOP) と (${SAME_EVENT_LAW.rightText}) □ (${CONTEXT_EVENT} → STOP)`,
                  `(${SAME_EVENT_LAW.leftText}) □ (${CONTEXT_EVENT} → STOP) vs (${SAME_EVENT_LAW.rightText}) □ (${CONTEXT_EVENT} → STOP)`,
                ),
                isCode: true,
              },
              {
                label: t("並行合成の中", "Inside parallel composition"),
                value: t(
                  `(${SAME_EVENT_LAW.leftText}) ||| (${CONTEXT_EVENT} → STOP) と (${SAME_EVENT_LAW.rightText}) ||| (${CONTEXT_EVENT} → STOP)`,
                  `(${SAME_EVENT_LAW.leftText}) ||| (${CONTEXT_EVENT} → STOP) vs (${SAME_EVENT_LAW.rightText}) ||| (${CONTEXT_EVENT} → STOP)`,
                ),
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "ここで見せたのは2つの周りの部品での確認だけで、「どの演算子でも保たれる」こと自体の証明ではない（証明は書籍 6.6節の考え方を参照）。||| は同期しない並行合成（インタリーブ）。",
          "This only shows checks in two surrounding contexts; it is not a proof that refinement is preserved by every operator (for the proof, see the approach in section 6.6 of the book). ||| is parallel composition without synchronisation (interleaving).",
        ),
      },
    ],
    lab: {
      title: t("組を選んで3種類で比べる", "Pick a pair and compare three ways"),
      hint: PAIRS.map((pair) => `${pair.id}: ${pairName(pair, language)}`).join(
        t(" ／ ", " / "),
      ),
      inputs: [
        {
          id: "pair",
          label: t("組の番号（1〜4）", "Pair number (1-4)"),
          initial: NOT_LAW.id,
        },
      ],
      compute: (values): Field[] => {
        const pair = parsePair(values.pair);
        const result = check(pair);
        const forward = failuresRefines(pair.left, pair.right, {});
        const backward = failuresRefines(pair.right, pair.left, {});
        const counter = forward.counterexample ?? backward.counterexample;
        return [
          { label: t("組", "Pair"), value: pairName(pair, language) },
          ...lawFields(result, language),
          {
            label:
              backward.counterexample && !forward.counterexample
                ? t(
                    "失敗の反例（右辺を仕様にした向き）",
                    "Failure counterexample (right side as spec)",
                  )
                : t(
                    "失敗の反例（左辺を仕様にした向き）",
                    "Failure counterexample (left side as spec)",
                  ),
            value: counter ? failureText(counter) : t("なし", "none"),
            tone: counter ? "bad" : "ok",
          },
        ];
      },
    },
  };
}
