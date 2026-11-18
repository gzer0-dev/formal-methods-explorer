import type { Field, Lesson } from "../../core/types";
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
  /** 記号で書いた式 */
  symbol: string;
  /** 日本語での読み方 */
  reading: string;
}

const FORMULAS: FormulaInfo[] = [
  {
    formula: { kind: "always", p: "safe" },
    symbol: "□安全",
    reading: "いつでも、開いているときに呼び出しが残っていない",
  },
  {
    formula: { kind: "eventually", p: "open" },
    symbol: "◇開",
    reading: "いつか必ず開く",
  },
  {
    formula: { kind: "alwaysEventually", p: "closed" },
    symbol: "□◇閉",
    reading: "何度でも閉じた状態に戻る",
  },
  {
    formula: { kind: "eventuallyAlways", p: "open" },
    symbol: "◇□開",
    reading: "いつかから先は、ずっと開いたまま",
  },
  {
    formula: { kind: "leadsTo", p: "requested", q: "open" },
    symbol: "□(呼び出し → ◇開)",
    reading: "呼ばれたら、いつか必ず開く",
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
const BUG_TRACE = BUG_LEADS_TO.trace;
const BUG_CYCLE = BUG_LEADS_TO.cycle;
if (BUG_LEADS_TO.holds || !BUG_TRACE || !BUG_CYCLE) {
  throw new Error("取りこぼす扉で、呼べば開くが破れていない");
}
const LAST_PRESS = BUG_TRACE.lastIndexOf("呼ぶ");
if (LAST_PRESS < 0 || BUG_TRACE[LAST_PRESS + 1] !== "閉まりきる") {
  throw new Error(`取りこぼしの反例が想定の形ではない: ${BUG_TRACE.join(" → ")}`);
}

const POSITION_TEXT: Record<DoorPosition, string> = {
  closed: "閉じている",
  opening: "開く途中",
  open: "開いている",
  closing: "閉まる途中",
};

function doorRows(state: DoorState): Record<string, string> {
  return { 扉: POSITION_TEXT[state.door], 呼び出し: state.requested ? "あり" : "なし" };
}

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

function stepsText(trace: string[]): string {
  return trace.length === 0 ? "最初の状態から" : trace.join(" → ");
}

function cycleText(cycle: string[] | null): string {
  if (cycle === null) return "なし（□の反例は有限の手順）";
  if (cycle.length === 0) return "動けないまま止まり続ける";
  return `「${cycle.join(" → ")}」を繰り返す`;
}

/** 反例の実行を1文にする（例: 「最初の状態から「待つ」を繰り返す」）。 */
function runText(result: LtlResult): string {
  const trace = result.trace ?? [];
  const head = trace.length === 0 ? "最初の状態から" : `「${trace.join(" → ")}」の後、`;
  return result.cycle === null ? stepsText(trace) : `${head}${cycleText(result.cycle)}`;
}

function holdsText(result: LtlResult): string {
  return result.holds ? "成り立つ" : "成り立たない";
}

function resultFields(result: LtlResult): Field[] {
  if (result.holds) return [{ label: "結果", value: "成り立つ", tone: "ok" }];
  return [
    { label: "結果", value: "成り立たない", tone: "bad" },
    { label: "反例の手順", value: stepsText(result.trace ?? []), isCode: true },
    { label: "輪", value: cycleText(result.cycle), tone: "bad" },
  ];
}

const EVENTUALLY_RESULT = goodResult(EVENTUALLY);
const EVENTUALLY_ALWAYS_RESULT = goodResult(EVENTUALLY_ALWAYS);

function parseBuggy(text: string | undefined): boolean {
  // 「取りこぼし」と書いたときだけ誤った扉。読めない入力は既定の「正しい」に戻す
  return (text ?? "").includes("取りこぼ");
}

function parseFormula(text: string | undefined): FormulaInfo {
  const trimmed = (text ?? "").trim();
  const byNumber = Number.parseInt(trimmed, 10);
  if (byNumber >= 1 && byNumber <= FORMULAS.length) return FORMULAS[byNumber - 1]!;
  const bySymbol = FORMULAS.find((info) => info.symbol === trimmed);
  return bySymbol ?? LEADS_TO;
}

export const ltlDoorLesson: Lesson = {
  id: "ltl-door",
  category: "model",
  title: "時相論理を読む",
  subtitle: "エレベーターの扉で、□・◇・□◇・◇□を読む",
  summary: `エレベーターの扉で、時相論理（LTL）のよく使う形を読む。正しい扉は「呼ばれたら、いつか必ず開く」が成り立ち、呼び出しを取りこぼす扉は、閉まる途中で押した呼び出しが消えて破れる。`,
  facts: [
    { label: "扉の状態", value: `${GOOD_STATES}個` },
    {
      label: "正しい扉",
      value: FORMULAS.map(
        (info) => `${info.symbol}${goodResult(info).holds ? "○" : "×"}`,
      ).join("・"),
    },
    {
      label: "取りこぼす扉",
      value: `${LEADS_TO.symbol}が${holdsText(BUG_LEADS_TO)}`,
      tone: "bad",
    },
    { label: "実物の道具", value: "TLA+ と TLC（時相論理）" },
  ],
  actors: [
    {
      id: "user",
      label: "利用者",
      sublabel: "呼ぶ・待つ（しなくてもよい）",
      icon: "person",
      x: 14,
      y: 50,
    },
    {
      id: "door",
      label: "エレベーターの扉",
      sublabel: "動けるうちは止まらない",
      icon: "device",
      x: 38,
      y: 50,
      initial: { rows: doorRows(GOOD.model.init) },
    },
    {
      id: "formula",
      label: "時相論理の式",
      sublabel: "実行全体についての性質",
      icon: "contract",
      x: 62,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "破れる実行を探す",
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
      title: "扉の動きを書く",
      actor: "user",
      to: ["door"],
      summary: `利用者が呼ぶと扉が開き、閉じる。状態は${GOOD_STATES}個`,
      explain: `扉は閉じている→開く途中→開いている→閉まる途中→閉じていると動き、利用者は呼ぶか待つ。扉の動きは、できる限り止まらない（弱い公平性、weak fairness）とし、利用者の動きはしなくてもよいとする。呼ぶかどうかは利用者の自由だが、扉が勝手に止まることはない、という前提。`,
      set: { door: { rows: doorRows(GOOD.model.init) } },
      detail: [
        {
          title: "動きの分け方",
          fields: [
            { label: "利用者の動き", value: "呼ぶ・待つ", note: "しなくてもよい" },
            {
              label: "扉の動き",
              value: "開き始める・開ききる・閉まり始める・閉まりきる",
              note: "動ける限り止まらない",
            },
          ],
        },
      ],
    },
    {
      id: "always",
      kind: "explore",
      title: "□ いつでも",
      actor: "formula",
      to: ["door"],
      summary: `${ALWAYS.symbol}（${ALWAYS.reading}）: ${holdsText(goodResult(ALWAYS))}`,
      explain: `□p は「どの時点でも p」と読む。不変条件と同じで、たどれる状態を全部見て、p でない状態が1つでもあれば破れる。${ALWAYS.symbol}は、開ききると呼び出しが消えるので${holdsText(goodResult(ALWAYS))}。`,
      set: {
        formula: {
          isHidden: false,
          tone: "ok",
          rows: { 式: ALWAYS.symbol, 結果: holdsText(goodResult(ALWAYS)) },
        },
      },
    },
    {
      id: "eventually",
      kind: "found",
      title: "◇ いつか必ず",
      actor: "formula",
      to: ["user"],
      summary: `${EVENTUALLY.symbol}（${EVENTUALLY.reading}）: ${holdsText(EVENTUALLY_RESULT)}。反例は${runText(EVENTUALLY_RESULT)}`,
      explain: `◇p は「いつか必ず p になる」と読む。${EVENTUALLY.symbol}は${holdsText(EVENTUALLY_RESULT)}。反例は、${runText(EVENTUALLY_RESULT)}実行で、利用者は呼ばなくてもよいので、扉は開く理由がない。レッスン「いつか必ず終わるか」の性質も、この ◇ の形。`,
      set: {
        formula: {
          tone: "bad",
          rows: { 式: EVENTUALLY.symbol, 結果: holdsText(EVENTUALLY_RESULT) },
        },
        user: { tone: "wait", rows: { 動き: "待つだけ" } },
      },
      detail: [{ title: "反例", fields: resultFields(EVENTUALLY_RESULT) }],
    },
    {
      id: "always-eventually",
      kind: "explore",
      title: "□◇ 何度でも戻る",
      actor: "formula",
      to: ["door"],
      summary: `${ALWAYS_EVENTUALLY.symbol}（${ALWAYS_EVENTUALLY.reading}）: ${holdsText(goodResult(ALWAYS_EVENTUALLY))}`,
      explain: `□◇p は「どの時点から見ても、その先でいつか p」、つまり p に何度でも戻ると読む。扉は開いても動ける限り閉まりに向かい、止まらないので、${ALWAYS_EVENTUALLY.symbol}は${holdsText(goodResult(ALWAYS_EVENTUALLY))}。`,
      set: {
        user: { tone: "idle", rows: { 動き: null } },
        formula: {
          tone: "ok",
          rows: {
            式: ALWAYS_EVENTUALLY.symbol,
            結果: holdsText(goodResult(ALWAYS_EVENTUALLY)),
          },
        },
      },
    },
    {
      id: "eventually-always",
      kind: "found",
      title: "◇□ いつかからずっと",
      actor: "formula",
      to: ["door"],
      summary: `${EVENTUALLY_ALWAYS.symbol}（${EVENTUALLY_ALWAYS.reading}）: ${holdsText(EVENTUALLY_ALWAYS_RESULT)}`,
      explain: `◇□p は「いつかから先は、ずっと p」と読む。${EVENTUALLY_ALWAYS.symbol}は${holdsText(EVENTUALLY_ALWAYS_RESULT)}。反例は、${runText(EVENTUALLY_ALWAYS_RESULT)}実行で、扉は閉じたまま一度も開かない。呼んで開いた実行でも、□◇閉が成り立つとおり必ず閉じた状態に戻るので、ずっと開いたままにはならない。□◇ と ◇□ は記号の順が違うだけで、意味は大きく違う。`,
      set: {
        formula: {
          tone: "bad",
          rows: {
            式: EVENTUALLY_ALWAYS.symbol,
            結果: holdsText(EVENTUALLY_ALWAYS_RESULT),
          },
        },
      },
      detail: [{ title: "反例", fields: resultFields(EVENTUALLY_ALWAYS_RESULT) }],
    },
    {
      id: "leads-to",
      kind: "explore",
      title: "□(p → ◇q) 応答",
      actor: "checker",
      to: ["formula"],
      summary: `${LEADS_TO.symbol}（${LEADS_TO.reading}）: 正しい扉では${holdsText(goodResult(LEADS_TO))}`,
      explain: `□(p → ◇q) は「p になったら、いつか必ず q」と読み、要求に応答するかを言う（leads to と呼ぶ）。正しい扉では、呼び出しのある状態のどこから始めても、開かないまま回り続ける輪は見つからず、${LEADS_TO.symbol}は${holdsText(goodResult(LEADS_TO))}。`,
      set: {
        checker: {
          isHidden: false,
          tone: "ok",
          rows: { 正しい扉: holdsText(goodResult(LEADS_TO)) },
        },
        formula: {
          tone: "ok",
          rows: { 式: LEADS_TO.symbol, 結果: holdsText(goodResult(LEADS_TO)) },
        },
      },
    },
    {
      id: "lost-call",
      kind: "found",
      title: "取りこぼす扉",
      actor: "checker",
      to: ["door"],
      summary: `取りこぼす扉の反例: ${runText(BUG_LEADS_TO)}`,
      explain: `閉まりきるときに呼び出しを消してしまう扉では、${LEADS_TO.symbol}が${holdsText(BUG_LEADS_TO)}。閉まる途中で「${BUG_TRACE[LAST_PRESS]}」が起き、呼び出しが残ったまま「${BUG_TRACE[LAST_PRESS + 1]}」で消える。その後は${cycleText(BUG_CYCLE)}だけで、扉は開かない。押したのに開かない、という利用者から見えるバグになる。`,
      set: {
        door: { tone: "bad", rows: doorRows(AFTER_LOSS) },
        checker: { tone: "bad", rows: { 取りこぼす扉: holdsText(BUG_LEADS_TO) } },
        formula: { tone: "bad", rows: { 結果: holdsText(BUG_LEADS_TO) } },
      },
      detail: [
        {
          title: "反例の手順と扉の状態",
          fields: BUG_TRACE.map((name, index) => ({
            label: `${index + 1}. ${name}`,
            value: `扉=${POSITION_TEXT[BUG_STATES[index + 1]!.door]}・呼び出し=${BUG_STATES[index + 1]!.requested ? "あり" : "なし"}`,
            tone: index === LAST_PRESS + 1 ? ("bad" as const) : undefined,
          })),
        },
        {
          title: "消える直前と直後",
          fields: [
            {
              label: "直前",
              value: `扉=${POSITION_TEXT[BEFORE_LOSS.door]}・呼び出し=${BEFORE_LOSS.requested ? "あり" : "なし"}`,
            },
            {
              label: "直後",
              value: `扉=${POSITION_TEXT[AFTER_LOSS.door]}・呼び出し=${AFTER_LOSS.requested ? "あり" : "なし"}`,
              tone: "bad",
            },
            { label: "輪", value: cycleText(BUG_CYCLE), tone: "bad" },
          ],
        },
      ],
      simplified:
        "同じモデルを TLA+ で書き（specs/tla/Door.tla）、TLC で □(呼び出し → ◇開)・□◇閉・◇□開・□安全の4つの性質を2つの扉で確かめ、8件とも結果が一致した。◇開は TLA+ 側では書いていない。公平性の置き方は作りが違う。TLA+ では扉の各動きに弱い公平性（WF）を付け、ここの検査器は「扉が動けるのに利用者の動きだけで回る輪」を反例から除いている。この扉では結果が一致する。",
    },
    {
      id: "test",
      kind: "test",
      title: "テストでの ◇",
      actor: "checker",
      to: ["user"],
      summary: "テストでは「いつか必ず」を待ち時間の上限つきで確かめる",
      explain:
        "テストは有限の時間しか見られないので、◇ を「○秒以内に開く」と上限つきで確かめる。上限を超えても「いつか開く」かは分からず、上限内に開いても取りこぼしの並びを通っていなければ見逃す。反例の手順（閉まる途中で呼ぶ）をそのままテストの手順にすると、狙って再現できる。",
      set: {
        checker: { tone: "ok" },
        user: { tone: "ok", rows: { テスト: "閉まる途中で呼ぶ" } },
      },
    },
  ],
  lab: {
    title: "扉と式を選ぶ",
    hint: `扉は「正しい」か「取りこぼし」。式は番号か記号で選ぶ: ${FORMULAS.map((info, i) => `${i + 1}=${info.symbol}`).join("、")}。`,
    inputs: [
      { id: "door", label: "扉（正しい / 取りこぼし）", initial: "取りこぼし" },
      { id: "formula", label: "式（1〜5か記号）", initial: "5" },
    ],
    compute: (values): Field[] => {
      const isBuggy = parseBuggy(values.door);
      const info = parseFormula(values.formula);
      const result = checkLtl(doorModel(isBuggy), info.formula);
      return [
        { label: "扉", value: isBuggy ? "呼び出しを取りこぼす" : "正しい" },
        { label: "式", value: info.symbol },
        { label: "読み方", value: info.reading },
        ...resultFields(result),
      ];
    },
  },
};
