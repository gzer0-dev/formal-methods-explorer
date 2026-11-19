import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { displayName, displayNames } from "../labels";
import { check, type Model } from "../modelCheck";
import {
  checkLtl,
  type DoorPosition,
  type DoorState,
  doorModel,
  type LtlFormula,
  type LtlResult,
} from "../ltl";

interface FormulaInfo {
  formula: LtlFormula;
  /** 記号で書いた式（日本語・英語） */
  symbol: { ja: string; en: string };
  /** 読み方（日本語・英語） */
  reading: { ja: string; en: string };
}

const FORMULAS: FormulaInfo[] = [
  {
    formula: { kind: "always", p: "safe" },
    symbol: { ja: "□安全", en: "□safe" },
    reading: {
      ja: "いつでも、開いているときに呼び出しが残っていない",
      en: "at all times, no call is left pending while the door is open",
    },
  },
  {
    formula: { kind: "eventually", p: "open" },
    symbol: { ja: "◇開", en: "◇open" },
    reading: { ja: "いつか必ず開く", en: "it eventually opens" },
  },
  {
    formula: { kind: "alwaysEventually", p: "closed" },
    symbol: { ja: "□◇閉", en: "□◇closed" },
    reading: {
      ja: "何度でも閉じた状態に戻る",
      en: "it returns to closed again and again",
    },
  },
  {
    formula: { kind: "eventuallyAlways", p: "open" },
    symbol: { ja: "◇□開", en: "◇□open" },
    reading: {
      ja: "いつかから先は、ずっと開いたまま",
      en: "from some point on, it stays open",
    },
  },
  {
    formula: { kind: "leadsTo", p: "requested", q: "open" },
    symbol: { ja: "□(呼び出し → ◇開)", en: "□(called → ◇open)" },
    reading: {
      ja: "呼ばれたら、いつか必ず開く",
      en: "once called, it eventually opens",
    },
  },
];

function formulaOf(kind: LtlFormula["kind"]): FormulaInfo {
  return FORMULAS.find((info) => info.formula.kind === kind)!;
}

const ALWAYS = formulaOf("always");
const EVENTUALLY = formulaOf("eventually");
const ALWAYS_EVENTUALLY = formulaOf("alwaysEventually");
const EVENTUALLY_ALWAYS = formulaOf("eventuallyAlways");
const LEADS_TO = formulaOf("leadsTo");

const GOOD = doorModel(false);
const BUGGY = doorModel(true);
const GOOD_STATES = check(GOOD.model).stateCount;

const GOOD_RESULTS = new Map(
  FORMULAS.map((info) => [info.formula.kind, checkLtl(GOOD, info.formula)]),
);
function goodResult(info: FormulaInfo): LtlResult {
  return GOOD_RESULTS.get(info.formula.kind)!;
}
const BUG_LEADS_TO = checkLtl(BUGGY, LEADS_TO.formula);

// 反例の手順の形を確かめる: 最後の「呼ぶ」の直後に「閉まりきる」が来て、呼び出しが消える。
if (BUG_LEADS_TO.holds || !BUG_LEADS_TO.trace || !BUG_LEADS_TO.cycle) {
  throw new Error("取りこぼす扉で、呼べば開くが破れていない");
}
// 関数の中でも null でないと分かるよう、確かめた後の値を型つきで持つ。
const BUG_TRACE: string[] = BUG_LEADS_TO.trace;
const BUG_CYCLE: string[] = BUG_LEADS_TO.cycle;
const LAST_PRESS = BUG_TRACE.lastIndexOf("呼ぶ");
if (LAST_PRESS < 0 || BUG_TRACE[LAST_PRESS + 1] !== "閉まりきる") {
  throw new Error(`取りこぼしの反例が想定の形ではない: ${BUG_TRACE.join(" → ")}`);
}

const POSITION_TEXT: Record<DoorPosition, { ja: string; en: string }> = {
  closed: { ja: "閉じている", en: "closed" },
  opening: { ja: "開く途中", en: "opening" },
  open: { ja: "開いている", en: "open" },
  closing: { ja: "閉まる途中", en: "closing" },
};

/** 動きの名前の並びを、初期状態から順にたどった状態の並びにする。 */
function replay(model: Model<DoorState>, names: string[]): DoorState[] {
  const states = [model.init];
  for (const name of names) {
    const current = states.at(-1)!;
    const action = model.actions.find((a) => a.name === name && a.enabled(current));
    if (!action) throw new Error(`反例の手順をたどれない: ${name}`);
    states.push(action.next(current));
  }
  return states;
}

const BUG_STATES = replay(BUGGY.model, BUG_TRACE);
const BEFORE_LOSS = BUG_STATES[LAST_PRESS + 1]!;
const AFTER_LOSS = BUG_STATES[LAST_PRESS + 2]!;

const EVENTUALLY_RESULT = goodResult(EVENTUALLY);
const EVENTUALLY_ALWAYS_RESULT = goodResult(EVENTUALLY_ALWAYS);

function parseBuggy(text: string | undefined): boolean {
  // 「取りこぼし」（英語では lossy）と書いたときだけ誤った扉。読めない入力は既定の「正しい」に戻す
  const value = text ?? "";
  return value.includes("取りこぼ") || /lossy/i.test(value);
}

function parseFormula(text: string | undefined): FormulaInfo {
  const trimmed = (text ?? "").trim();
  const byNumber = Number.parseInt(trimmed, 10);
  if (byNumber >= 1 && byNumber <= FORMULAS.length) return FORMULAS[byNumber - 1]!;
  const bySymbol = FORMULAS.find(
    (info) => info.symbol.ja === trimmed || info.symbol.en === trimmed,
  );
  return bySymbol ?? LEADS_TO;
}

export function ltlDoorLesson(language: Language): Lesson {
  const t = translator(language);
  const name = (action: string) => displayName(action, language);
  const symbol = (info: FormulaInfo) => info.symbol[language];
  const reading = (info: FormulaInfo) => info.reading[language];
  const position = (door: DoorPosition) => POSITION_TEXT[door][language];
  const yesNo = (value: boolean) => (value ? t("あり", "yes") : t("なし", "no"));
  const doorKey = t("扉", "door");
  const callKey = t("呼び出し", "call");
  const formulaKey = t("式", "formula");
  const resultKey = t("結果", "result");
  const moveKey = t("動き", "moves");

  function doorRows(state: DoorState): Record<string, string> {
    return { [doorKey]: position(state.door), [callKey]: yesNo(state.requested) };
  }

  function doorText(state: DoorState): string {
    return t(
      `扉=${position(state.door)}・呼び出し=${yesNo(state.requested)}`,
      `door=${position(state.door)}, call=${yesNo(state.requested)}`,
    );
  }

  function stepsText(trace: string[]): string {
    return trace.length === 0
      ? t("最初の状態から", "from the initial state")
      : displayNames(trace, language);
  }

  function cycleText(cycle: string[] | null): string {
    if (cycle === null)
      return t("なし（□の反例は有限の手順）", "none (a □ counterexample is finite)");
    if (cycle.length === 0) return t("動けないまま止まり続ける", "stays stuck forever");
    return t(
      `「${cycle.join(" → ")}」を繰り返す`,
      `repeats "${displayNames(cycle, language)}"`,
    );
  }

  /** 反例の実行を1文にする（例: 「最初の状態から「待つ」を繰り返す」）。 */
  function runText(result: LtlResult): string {
    const trace = result.trace ?? [];
    if (result.cycle === null) return stepsText(trace);
    const head =
      trace.length === 0
        ? t("最初の状態から", "from the initial state, ")
        : t(
            `「${trace.join(" → ")}」の後、`,
            `after "${displayNames(trace, language)}", `,
          );
    return `${head}${cycleText(result.cycle)}`;
  }

  function holdsText(result: LtlResult): string {
    return result.holds ? t("成り立つ", "holds") : t("成り立たない", "does not hold");
  }

  function resultFields(result: LtlResult): Field[] {
    if (result.holds)
      return [{ label: t("結果", "Result"), value: holdsText(result), tone: "ok" }];
    return [
      { label: t("結果", "Result"), value: holdsText(result), tone: "bad" },
      {
        label: t("反例の手順", "Counterexample"),
        value: stepsText(result.trace ?? []),
        isCode: true,
      },
      { label: t("輪", "Loop"), value: cycleText(result.cycle), tone: "bad" },
    ];
  }

  return {
    id: "ltl-door",
    category: "model",
    title: t("時相論理を読む", "Reading temporal logic"),
    subtitle: t(
      "エレベーターの扉で、□・◇・□◇・◇□を読む",
      "Reading □, ◇, □◇ and ◇□ on an elevator door",
    ),
    summary: t(
      `エレベーターの扉で、時相論理（LTL）のよく使う形を読む。正しい扉は「呼ばれたら、いつか必ず開く」が成り立ち、呼び出しを取りこぼす扉は、閉まる途中で押した呼び出しが消えて破れる。`,
      `Read the common forms of temporal logic (LTL) on an elevator door. The correct door satisfies "once called, it eventually opens"; the door that loses calls breaks it, because a call made while closing disappears.`,
    ),
    intro: [
      t(
        "時相論理は、「いつでも」「いつか必ず」のように、時間の流れに沿った性質を書くための式の書き方である。ここでは LTL（線形時相論理）の記号 □（いつでも）と ◇（いつか必ず）を、エレベーターの扉を例に読む。",
        'Temporal logic is a way to write properties along the flow of time, such as "always" and "eventually". Here we read the LTL (linear temporal logic) symbols □ (always) and ◇ (eventually), using an elevator door as the example.',
      ),
      t(
        "不変条件（いつ見ても成り立っていてほしい条件）は □ の形で、レッスン「いつか必ず終わるか」の性質は ◇ の形に当たる。記号の並べ方で意味が大きく変わるので、仕様を読むときも、テストの合否の条件を決めるときも、読み違えないことが大事になる。",
        'An invariant (a condition that should hold whenever you look) has the □ form, and the property in the lesson "Does it ever finish?" has the ◇ form. The order of the symbols changes the meaning a lot, so reading them correctly matters both when reading a spec and when deciding a test\'s pass condition.',
      ),
      t(
        "図では、時相論理の式のカードが記号ごとに切り替わり、扉の動きに対して成り立つかどうかを見る。そのあと呼び出しを取りこぼす扉に切り替わったとき、利用者の呼び出しが扉のカードの上でどう扱われるかが分かれ目になる。",
        "In the diagram, the formula card switches symbol by symbol; see whether each holds for the door's behaviour. The turning point comes after switching to the door that loses calls: watch what happens to the user's call on the door card.",
      ),
    ],
    facts: [
      {
        label: t("扉の状態", "Door states"),
        value: t(`${GOOD_STATES}個`, `${GOOD_STATES}`),
      },
      {
        label: t("正しい扉", "Correct door"),
        value: FORMULAS.map(
          (info) => `${symbol(info)}${goodResult(info).holds ? "○" : "×"}`,
        ).join(t("・", ", ")),
      },
      {
        label: t("取りこぼす扉", "Lossy door"),
        value: t(
          `${symbol(LEADS_TO)}が${holdsText(BUG_LEADS_TO)}`,
          `${symbol(LEADS_TO)} ${holdsText(BUG_LEADS_TO)}`,
        ),
        tone: "bad",
      },
      {
        label: t("実物の道具", "Real tools"),
        value: t("TLA+ と TLC（時相論理）", "TLA+ and TLC (temporal logic)"),
      },
    ],
    actors: [
      {
        id: "user",
        label: t("利用者", "User"),
        sublabel: t("呼ぶ・待つ（しなくてもよい）", "calls or waits (optional)"),
        icon: "person",
        x: 14,
        y: 50,
      },
      {
        id: "door",
        label: t("エレベーターの扉", "Elevator door"),
        sublabel: t("動けるうちは止まらない", "never stops while it can move"),
        icon: "device",
        x: 38,
        y: 50,
        initial: { rows: doorRows(GOOD.model.init) },
      },
      {
        id: "formula",
        label: t("時相論理の式", "Temporal formula"),
        sublabel: t("実行全体についての性質", "a property of whole runs"),
        icon: "contract",
        x: 62,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("破れる実行を探す", "looks for breaking runs"),
        icon: "checker",
        x: 86,
        y: 50,
        initial: { isHidden: true },
      },
    ],
    stageHeight: 300,
    links: [
      { from: "user", to: "door" },
      { from: "formula", to: "door" },
      { from: "checker", to: "formula" },
    ],
    steps: [
      {
        id: "model",
        kind: "spec",
        title: t("扉の動きを書く", "Model the door"),
        actor: "user",
        to: ["door"],
        summary: t(
          `利用者が呼ぶと扉が開き、閉じる。状態は${GOOD_STATES}個`,
          `When the user calls, the door opens and closes. ${GOOD_STATES} states`,
        ),
        explain: t(
          `扉は閉じている→開く途中→開いている→閉まる途中→閉じていると動き、利用者は呼ぶか待つ。扉の動きは、できる限り止まらない（弱い公平性、weak fairness）とし、利用者の動きはしなくてもよいとする。呼ぶかどうかは利用者の自由だが、扉が勝手に止まることはない、という前提。`,
          `The door goes closed → opening → open → closing → closed, and the user either calls or waits. The door's moves never stop while possible (weak fairness), while the user's moves are optional. Whether to call is up to the user, but the door never stops on its own: that is the assumption.`,
        ),
        set: { door: { rows: doorRows(GOOD.model.init) } },
        detail: [
          {
            title: t("動きの分け方", "Who moves"),
            fields: [
              {
                label: t("利用者の動き", "User moves"),
                value: `${name("呼ぶ")}${t("・", ", ")}${name("待つ")}`,
                note: t("しなくてもよい", "optional"),
              },
              {
                label: t("扉の動き", "Door moves"),
                value: ["開き始める", "開ききる", "閉まり始める", "閉まりきる"]
                  .map(name)
                  .join(t("・", ", ")),
                note: t("動ける限り止まらない", "never stop while possible"),
              },
            ],
          },
        ],
      },
      {
        id: "always",
        kind: "explore",
        title: t("□ いつでも", "□ always"),
        actor: "formula",
        to: ["door"],
        summary: t(
          `${symbol(ALWAYS)}（${reading(ALWAYS)}）: ${holdsText(goodResult(ALWAYS))}`,
          `${symbol(ALWAYS)} (${reading(ALWAYS)}): ${holdsText(goodResult(ALWAYS))}`,
        ),
        explain: t(
          `□p は「どの時点でも p」と読む。不変条件と同じで、たどれる状態を全部見て、p でない状態が1つでもあれば破れる。${symbol(ALWAYS)}は、開ききると呼び出しが消えるので${holdsText(goodResult(ALWAYS))}。`,
          `□p reads "p at every point". Like an invariant, it looks at every reachable state and breaks if even one state is not p. ${symbol(ALWAYS)} ${holdsText(goodResult(ALWAYS))}, because the call is cleared once the door is fully open.`,
        ),
        set: {
          formula: {
            isHidden: false,
            tone: "ok",
            rows: {
              [formulaKey]: symbol(ALWAYS),
              [resultKey]: holdsText(goodResult(ALWAYS)),
            },
          },
        },
      },
      {
        id: "eventually",
        kind: "found",
        title: t("◇ いつか必ず", "◇ eventually"),
        actor: "formula",
        to: ["user"],
        summary: t(
          `${symbol(EVENTUALLY)}（${reading(EVENTUALLY)}）: ${holdsText(EVENTUALLY_RESULT)}。反例は${runText(EVENTUALLY_RESULT)}`,
          `${symbol(EVENTUALLY)} (${reading(EVENTUALLY)}): ${holdsText(EVENTUALLY_RESULT)}. Counterexample: ${runText(EVENTUALLY_RESULT)}`,
        ),
        explain: t(
          `◇p は「いつか必ず p になる」と読む。${symbol(EVENTUALLY)}は${holdsText(EVENTUALLY_RESULT)}。反例は、${runText(EVENTUALLY_RESULT)}実行で、利用者は呼ばなくてもよいので、扉は開く理由がない。レッスン「いつか必ず終わるか」の性質も、この ◇ の形。`,
          `◇p reads "p eventually becomes true". ${symbol(EVENTUALLY)} ${holdsText(EVENTUALLY_RESULT)}. The counterexample is the run that, ${runText(EVENTUALLY_RESULT)}; the user does not have to call, so the door has no reason to open. The property in the lesson "Does it ever finish?" also has this ◇ form.`,
        ),
        set: {
          formula: {
            tone: "bad",
            rows: {
              [formulaKey]: symbol(EVENTUALLY),
              [resultKey]: holdsText(EVENTUALLY_RESULT),
            },
          },
          user: { tone: "wait", rows: { [moveKey]: t("待つだけ", "only waits") } },
        },
        detail: [
          {
            title: t("反例", "Counterexample"),
            fields: resultFields(EVENTUALLY_RESULT),
          },
        ],
      },
      {
        id: "always-eventually",
        kind: "explore",
        title: t("□◇ 何度でも戻る", "□◇ again and again"),
        actor: "formula",
        to: ["door"],
        summary: t(
          `${symbol(ALWAYS_EVENTUALLY)}（${reading(ALWAYS_EVENTUALLY)}）: ${holdsText(goodResult(ALWAYS_EVENTUALLY))}`,
          `${symbol(ALWAYS_EVENTUALLY)} (${reading(ALWAYS_EVENTUALLY)}): ${holdsText(goodResult(ALWAYS_EVENTUALLY))}`,
        ),
        explain: t(
          `□◇p は「どの時点から見ても、その先でいつか p」、つまり p に何度でも戻ると読む。扉は開いても動ける限り閉まりに向かい、止まらないので、${symbol(ALWAYS_EVENTUALLY)}は${holdsText(goodResult(ALWAYS_EVENTUALLY))}。`,
          `□◇p reads "from any point, p eventually comes later", that is, p returns again and again. Even after opening, the door heads toward closing as long as it can move and never stops, so ${symbol(ALWAYS_EVENTUALLY)} ${holdsText(goodResult(ALWAYS_EVENTUALLY))}.`,
        ),
        set: {
          user: { tone: "idle", rows: { [moveKey]: null } },
          formula: {
            tone: "ok",
            rows: {
              [formulaKey]: symbol(ALWAYS_EVENTUALLY),
              [resultKey]: holdsText(goodResult(ALWAYS_EVENTUALLY)),
            },
          },
        },
      },
      {
        id: "eventually-always",
        kind: "found",
        title: t("◇□ いつかからずっと", "◇□ from some point on"),
        actor: "formula",
        to: ["door"],
        summary: t(
          `${symbol(EVENTUALLY_ALWAYS)}（${reading(EVENTUALLY_ALWAYS)}）: ${holdsText(EVENTUALLY_ALWAYS_RESULT)}`,
          `${symbol(EVENTUALLY_ALWAYS)} (${reading(EVENTUALLY_ALWAYS)}): ${holdsText(EVENTUALLY_ALWAYS_RESULT)}`,
        ),
        explain: t(
          `◇□p は「いつかから先は、ずっと p」と読む。${symbol(EVENTUALLY_ALWAYS)}は${holdsText(EVENTUALLY_ALWAYS_RESULT)}。反例は、${runText(EVENTUALLY_ALWAYS_RESULT)}実行で、扉は閉じたまま一度も開かない。呼んで開いた実行でも、${symbol(ALWAYS_EVENTUALLY)}が成り立つとおり必ず閉じた状態に戻るので、ずっと開いたままにはならない。□◇ と ◇□ は記号の順が違うだけで、意味は大きく違う。`,
          `◇□p reads "from some point on, p forever". ${symbol(EVENTUALLY_ALWAYS)} ${holdsText(EVENTUALLY_ALWAYS_RESULT)}. The counterexample is the run that, ${runText(EVENTUALLY_ALWAYS_RESULT)}, where the door stays closed and never opens. Even in a run where someone calls and it opens, it always returns to closed, as ${symbol(ALWAYS_EVENTUALLY)} holding shows, so it never stays open. □◇ and ◇□ differ only in the order of the symbols, but their meanings differ a lot.`,
        ),
        set: {
          formula: {
            tone: "bad",
            rows: {
              [formulaKey]: symbol(EVENTUALLY_ALWAYS),
              [resultKey]: holdsText(EVENTUALLY_ALWAYS_RESULT),
            },
          },
        },
        detail: [
          {
            title: t("反例", "Counterexample"),
            fields: resultFields(EVENTUALLY_ALWAYS_RESULT),
          },
        ],
      },
      {
        id: "leads-to",
        kind: "explore",
        title: t("□(p → ◇q) 応答", "□(p → ◇q) response"),
        actor: "checker",
        to: ["formula"],
        summary: t(
          `${symbol(LEADS_TO)}（${reading(LEADS_TO)}）: 正しい扉では${holdsText(goodResult(LEADS_TO))}`,
          `${symbol(LEADS_TO)} (${reading(LEADS_TO)}): ${holdsText(goodResult(LEADS_TO))} for the correct door`,
        ),
        explain: t(
          `□(p → ◇q) は「p になったら、いつか必ず q」と読み、要求に応答するかを言う（leads to と呼ぶ）。正しい扉では、呼び出しのある状態のどこから始めても、開かないまま回り続ける輪は見つからず、${symbol(LEADS_TO)}は${holdsText(goodResult(LEADS_TO))}。`,
          `□(p → ◇q) reads "once p, eventually q" and says whether a request gets a response (called "leads to"). For the correct door, starting from any state with a pending call, no loop that keeps going without opening is found, so ${symbol(LEADS_TO)} ${holdsText(goodResult(LEADS_TO))}.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "ok",
            rows: { [t("正しい扉", "correct door")]: holdsText(goodResult(LEADS_TO)) },
          },
          formula: {
            tone: "ok",
            rows: {
              [formulaKey]: symbol(LEADS_TO),
              [resultKey]: holdsText(goodResult(LEADS_TO)),
            },
          },
        },
      },
      {
        id: "lost-call",
        kind: "found",
        title: t("取りこぼす扉", "The lossy door"),
        actor: "checker",
        to: ["door"],
        summary: t(
          `取りこぼす扉の反例: ${runText(BUG_LEADS_TO)}`,
          `Counterexample for the lossy door: ${runText(BUG_LEADS_TO)}`,
        ),
        explain: t(
          `閉まりきるときに呼び出しを消してしまう扉では、${symbol(LEADS_TO)}が${holdsText(BUG_LEADS_TO)}。閉まる途中で「${BUG_TRACE[LAST_PRESS]}」が起き、呼び出しが残ったまま「${BUG_TRACE[LAST_PRESS + 1]}」で消える。その後は${cycleText(BUG_CYCLE)}だけで、扉は開かない。押したのに開かない、という利用者から見えるバグになる。`,
          `For a door that clears the call when it finishes closing, ${symbol(LEADS_TO)} ${holdsText(BUG_LEADS_TO)}. "${name(BUG_TRACE[LAST_PRESS]!)}" happens while closing, and the pending call is cleared by "${name(BUG_TRACE[LAST_PRESS + 1]!)}". After that it only ${cycleText(BUG_CYCLE)}, and the door never opens. The user sees a bug: they pressed the button, but it did not open.`,
        ),
        set: {
          door: { tone: "bad", rows: doorRows(AFTER_LOSS) },
          checker: {
            tone: "bad",
            rows: { [t("取りこぼす扉", "lossy door")]: holdsText(BUG_LEADS_TO) },
          },
          formula: { tone: "bad", rows: { [resultKey]: holdsText(BUG_LEADS_TO) } },
        },
        detail: [
          {
            title: t("反例の手順と扉の状態", "Counterexample and door state"),
            fields: BUG_TRACE.map((action, index) => ({
              label: `${index + 1}. ${name(action)}`,
              value: doorText(BUG_STATES[index + 1]!),
              tone: index === LAST_PRESS + 1 ? ("bad" as const) : undefined,
            })),
          },
          {
            title: t("消える直前と直後", "Just before and after the loss"),
            fields: [
              { label: t("直前", "Before"), value: doorText(BEFORE_LOSS) },
              { label: t("直後", "After"), value: doorText(AFTER_LOSS), tone: "bad" },
              { label: t("輪", "Loop"), value: cycleText(BUG_CYCLE), tone: "bad" },
            ],
          },
        ],
        simplified: t(
          "同じモデルを TLA+ で書き（specs/tla/Door.tla）、TLC で □(呼び出し → ◇開)・□◇閉・◇□開・□安全の4つの性質を2つの扉で確かめ、8件とも結果が一致した。◇開は TLA+ 側では書いていない。公平性の置き方は作りが違う。TLA+ では扉の各動きに弱い公平性（WF）を付け、ここの検査器は「扉が動けるのに利用者の動きだけで回る輪」を反例から除いている。この扉では結果が一致する。",
          'The same model is written in TLA+ (specs/tla/Door.tla), and TLC checked the four properties □(called → ◇open), □◇closed, ◇□open and □safe on both doors; all 8 results matched. ◇open is not written on the TLA+ side. Fairness is set up differently: TLA+ puts weak fairness (WF) on each door move, while this checker excludes from counterexamples "loops made only of user moves while the door could move". For this door the results agree.',
        ),
      },
      {
        id: "test",
        kind: "test",
        title: t("テストでの ◇", "◇ in tests"),
        actor: "checker",
        to: ["user"],
        summary: t(
          "テストでは「いつか必ず」を待ち時間の上限つきで確かめる",
          'Tests check "eventually" with a timeout',
        ),
        explain: t(
          "テストは有限の時間しか見られないので、◇ を「○秒以内に開く」と上限つきで確かめる。上限を超えても「いつか開く」かは分からず、上限内に開いても取りこぼしの並びを通っていなければ見逃す。反例の手順（閉まる途中で呼ぶ）をそのままテストの手順にすると、狙って再現できる。",
          'A test can only watch for a finite time, so it checks ◇ with a limit such as "opens within N seconds". Going past the limit does not tell you whether it would eventually open, and opening within the limit misses the bug if the run never went through the losing order. Using the counterexample (call while closing) directly as the test steps reproduces it on purpose.',
        ),
        set: {
          checker: { tone: "ok" },
          user: {
            tone: "ok",
            rows: {
              [t("テスト", "test")]: t("閉まる途中で呼ぶ", "call while closing"),
            },
          },
        },
      },
    ],
    lab: {
      title: t("扉と式を選ぶ", "Pick a door and a formula"),
      hint: t(
        `扉は「正しい」か「取りこぼし」。式は番号か記号で選ぶ: ${FORMULAS.map((info, i) => `${i + 1}=${info.symbol.ja}`).join("、")}。`,
        `The door is "correct" or "lossy". Pick the formula by number or symbol: ${FORMULAS.map((info, i) => `${i + 1}=${info.symbol.en}`).join(", ")}.`,
      ),
      inputs: [
        {
          id: "door",
          label: t("扉（正しい / 取りこぼし）", "Door (correct / lossy)"),
          initial: t("取りこぼし", "lossy"),
        },
        {
          id: "formula",
          label: t("式（1〜5か記号）", "Formula (1-5 or symbol)"),
          initial: "5",
        },
      ],
      compute: (values): Field[] => {
        const isBuggy = parseBuggy(values.door);
        const info = parseFormula(values.formula);
        const result = checkLtl(doorModel(isBuggy), info.formula);
        return [
          {
            label: t("扉", "Door"),
            value: isBuggy
              ? t("呼び出しを取りこぼす", "loses calls")
              : t("正しい", "correct"),
          },
          { label: t("式", "Formula"), value: symbol(info) },
          { label: t("読み方", "Reading"), value: reading(info) },
          ...resultFields(result),
        ];
      },
    },
  };
}
