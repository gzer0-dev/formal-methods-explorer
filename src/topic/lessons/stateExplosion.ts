import type { Field, Lesson } from "../../core/types";
import { explore, normalizedStateCount } from "../csp";
import { CRYPTO_ENV, cryptographers } from "../cspCases";
import { PHILOSOPHER_ENV, philosophers } from "../cspModels";
import { philosopherTupleModel, symmetricStateCount } from "../explosion";
import { check } from "../modelCheck";

const MIN_PEOPLE = 2;
const MAX_PEOPLE = 7;
const PEOPLE = Array.from(
  { length: MAX_PEOPLE - MIN_PEOPLE + 1 },
  (_, i) => MIN_PEOPLE + i,
);

interface Row {
  people: number;
  full: number;
  symmetric: number;
}

// 2〜7人を1回ずつ計算する（合わせて数十ミリ秒）。同じ計算を二度呼ばない。
const ROWS: Row[] = PEOPLE.map((people) => ({
  people,
  full: check(philosopherTupleModel(people)).stateCount,
  symmetric: symmetricStateCount(people),
}));

function rowOf(people: number): Row {
  return ROWS.find((row) => row.people === people)!;
}

const FIRST = rowOf(MIN_PEOPLE);
const LAST = rowOf(MAX_PEOPLE);
const FOCUS = rowOf(5);

/** CSP のモデルと素朴なモデルの状態数を突き合わせた人数（batch2.test.ts と同じ範囲）。 */
const CSP_MATCH_PEOPLE = [2, 3, 4];
const CSP_MATCHES = CSP_MATCH_PEOPLE.every(
  (n) => explore(philosophers(n, false), PHILOSOPHER_ENV).stateCount === rowOf(n).full,
);
if (!CSP_MATCHES) throw new Error("素朴なモデルと CSP のモデルで状態数が合わない");

const CRYPTO = cryptographers(0, false);
const CRYPTO_STATES = explore(CRYPTO, CRYPTO_ENV).stateCount;
const CRYPTO_NORMALIZED = normalizedStateCount(CRYPTO, CRYPTO_ENV);

function countsText(pick: (row: Row) => number): string {
  return ROWS.map((row) => `${row.people}人${pick(row)}`).join("・");
}

/** 1人増やすごとに何倍になったか（小数1桁）。 */
const GROWTH = ROWS.slice(1).map((row, i) => row.full / ROWS[i]!.full);
const GROWTH_MIN = Math.min(...GROWTH).toFixed(1);
const GROWTH_MAX = Math.max(...GROWTH).toFixed(1);

function divisorText(row: Row): string {
  return (row.full / row.symmetric).toFixed(1);
}

function parsePeople(text: string | undefined): number {
  const value = Number.parseInt((text ?? "").trim(), 10);
  // 読めない入力は既定の5人、範囲外は端に寄せる
  if (Number.isNaN(value)) return 5;
  return Math.min(Math.max(value, MIN_PEOPLE), MAX_PEOPLE);
}

export const stateExplosionLesson: Lesson = {
  id: "state-explosion",
  category: "model",
  title: "状態爆発と戦う",
  subtitle: "数を増やすと状態は急に増える。まとめて数えて減らす",
  summary: `食事する哲学者を${MIN_PEOPLE}人から${MAX_PEOPLE}人に増やすと、状態は${FIRST.full}から${LAST.full}に増える（状態爆発）。回して同じになる配置をまとめる対称性と、見える振る舞いだけを残す正規化で、調べる状態を減らす。`,
  intro: [
    "状態爆発は、モデルに登場する人や部品を増やすと、状態の数が掛け算で急に増える現象である。題材には食事する哲学者（円卓に座った哲学者が、隣どうしで共有するフォークを取り合う、並行処理の定番の問題）を使う。",
    "モデル検査（あり得る状態を機械的に全部たどって確かめること）は全部の状態をたどるので、状態が増えすぎると時間とメモリが足りなくなる。前のレッスンまでの小さなモデルでは問題にならなかったが、実際の設計を検査するときは、状態をどう減らすかを先に考えることになる。",
    "図では、哲学者のモデルのカードで人数が増えたとき、モデル検査器のカードの数がどう伸びるかを見る。そのあと、対称性（全員の席を同じだけ回しても、振る舞いが変わらないこと）と正規化（外から見て区別できない状態をまとめること）のカードが、状態をまとめていく様子を追う。",
  ],
  facts: [
    { label: "状態数", value: countsText((row) => row.full) },
    { label: "対称性で減らした数", value: countsText((row) => row.symmetric) },
    {
      label: "正規化（暗号学者）",
      value: `${CRYPTO_STATES}状態 → ${CRYPTO_NORMALIZED}状態`,
    },
    { label: "実物の道具", value: "TLC の SYMMETRY、FDR の圧縮" },
  ],
  actors: [
    {
      id: "model",
      label: "哲学者のモデル",
      sublabel: "全員が左から取る",
      icon: "people",
      x: 14,
      y: 50,
      initial: { rows: { 人数: `${FIRST.people}人` } },
    },
    {
      id: "checker",
      label: "モデル検査器",
      sublabel: "状態を全部たどる",
      icon: "checker",
      x: 38,
      y: 50,
      initial: { rows: { 状態: `${FIRST.full}個` } },
    },
    {
      id: "symmetry",
      label: "対称性",
      sublabel: "回して同じなら1つ",
      icon: "shrink",
      x: 62,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "normalize",
      label: "正規化",
      sublabel: "見える振る舞いだけ残す",
      icon: "gear",
      x: 86,
      y: 50,
      initial: { isHidden: true },
    },
  ],
  stageHeight: 300,
  links: [
    { from: "model", to: "checker" },
    { from: "checker", to: "symmetry" },
    { from: "symmetry", to: "normalize" },
  ],
  steps: [
    {
      id: "grow",
      kind: "explore",
      title: "人数を増やす",
      actor: "model",
      to: ["checker"],
      summary: `状態数は${countsText((row) => row.full)}`,
      explain: `各哲学者は進み具合（左を待つ・右を待つ・食べる・置く途中）を持ち、フォークにはそれぞれ持ち主がいる。人数を${MIN_PEOPLE}人から${MAX_PEOPLE}人に増やすと、状態は${FIRST.full}から${LAST.full}に増えた。全部の組み合わせを数えるので、人数が増えるたびに掛け算で増える。`,
      set: {
        model: { rows: { 人数: `${LAST.people}人` } },
        checker: { tone: "wait", rows: { 状態: `${LAST.full}個` } },
      },
      detail: [
        {
          title: "人数ごとの状態数",
          fields: ROWS.map((row) => ({
            label: `${row.people}人`,
            value: `${row.full}状態`,
          })),
        },
      ],
      simplified: `ここでは哲学者を CSP を使わずに「各人の進み具合とフォークの持ち主」の組で素朴に書いた。状態数は CSP のモデルと一致し（${CSP_MATCH_PEOPLE.join("・")}人で確かめた）、TLA+ の TLC でも2〜5人の${[2, 3, 4, 5].map((n) => rowOf(n).full).join("・")}が一致した（specs/tla）。`,
    },
    {
      id: "why",
      kind: "explore",
      title: "掛け算で増える",
      actor: "checker",
      summary: `1人増やすごとに状態は${GROWTH_MIN}〜${GROWTH_MAX}倍になる`,
      explain: `1人増やすごとに、状態は${GROWTH_MIN}〜${GROWTH_MAX}倍になった。人数を足すと増え方は掛け算になる（指数的に増える）。これが状態爆発で、モデル検査がすぐ時間とメモリを使い切る主な理由。`,
      set: {
        checker: {
          tone: "bad",
          rows: { 増え方: `${GROWTH_MIN}〜${GROWTH_MAX}倍ずつ` },
        },
      },
      detail: [
        {
          title: "1人増やしたときの倍率",
          fields: ROWS.slice(1).map((row, i) => ({
            label: `${ROWS[i]!.people}人 → ${row.people}人`,
            value: `${GROWTH[i]!.toFixed(1)}倍`,
          })),
        },
      ],
    },
    {
      id: "symmetry",
      kind: "fix",
      title: "回して同じを1つに",
      actor: "symmetry",
      to: ["checker"],
      summary: `対称性: ${countsText((row) => row.symmetric)}`,
      explain: `全員が同じ規則で動くので、全員を1席ずつ回した配置は、回す前と同じように振る舞う。回して同じになる配置を1つに数えると、${FOCUS.people}人では${FOCUS.full}状態が${FOCUS.symmetric}状態になる。1つ調べれば、回した残りも調べたことになる。`,
      set: {
        symmetry: {
          isHidden: false,
          tone: "ok",
          rows: { [`${FOCUS.people}人`]: `${FOCUS.full} → ${FOCUS.symmetric}` },
        },
        model: { rows: { 人数: `${FOCUS.people}人` } },
        checker: { tone: "ok", rows: { 状態: `${FOCUS.symmetric}個`, 増え方: null } },
      },
      detail: [
        {
          title: "回して同じ配置を1つに数えた数",
          fields: ROWS.map((row) => ({
            label: `${row.people}人`,
            value: `${row.full} → ${row.symmetric}状態`,
          })),
        },
      ],
      simplified:
        "TLC には SYMMETRY という指定があり、入れ替えても振る舞いが変わらない値を入れ替えた状態を1つにまとめる。ここでは席が輪になっているので、入れ替えではなく回すことだけを考え、全部の状態を作ってから数え直している（実物は探索の途中でまとめる）。",
    },
    {
      id: "ratio",
      kind: "explore",
      title: "人数分の1に近づく",
      actor: "symmetry",
      to: ["checker"],
      summary: `減った割合は${FIRST.people}人で${divisorText(FIRST)}分の1、${LAST.people}人で${divisorText(LAST)}分の1`,
      explain: `${FIRST.people}人では${FIRST.full}が${FIRST.symmetric}で、${divisorText(FIRST)}分の1にしかならない。全員が同じ進み具合のように、回しても変わらない配置があるため。人数が増えるほどそうした配置の割合が減り、${LAST.people}人では${divisorText(LAST)}分の1と、人数分の1に近づく。`,
      set: {
        symmetry: { rows: { [`${LAST.people}人`]: `${divisorText(LAST)}分の1` } },
      },
      detail: [
        {
          title: "何分の1になったか",
          fields: ROWS.map((row) => ({
            label: `${row.people}人`,
            value: `${divisorText(row)}分の1`,
          })),
        },
      ],
    },
    {
      id: "normalize",
      kind: "fix",
      title: "見える動きだけ残す",
      actor: "normalize",
      to: ["checker"],
      summary: `正規化: 食事する暗号学者は${CRYPTO_STATES}状態が${CRYPTO_NORMALIZED}状態になる`,
      explain: `食事する暗号学者のモデルは${CRYPTO_STATES}状態あるが、外から見えるのは発言だけで、コインを見る動きは隠してある。見える発言の並びが同じなら、内部でどの状態にいるかを区別しないでまとめると、${CRYPTO_NORMALIZED}状態になる。FDR が仕様と比べる前に仕様を正規形にするのと同じ考え方。`,
      set: {
        normalize: {
          isHidden: false,
          tone: "ok",
          rows: { 暗号学者: `${CRYPTO_STATES} → ${CRYPTO_NORMALIZED}` },
        },
      },
      simplified:
        "FDR には正規化（normal）などの圧縮の関数がある。ここでは、内部の動き（τ）だけで行ける状態をまとめ、同じ見える動きの後の状態を1つの組にする部分だけを小さく実装した（組を最小にする処理はしていない）。",
    },
    {
      id: "others",
      kind: "spec",
      title: "ほかの減らし方",
      actor: "checker",
      summary: "半順序削減と合成的な検証も、よく使われる対策",
      explain:
        "半順序削減（partial order reduction）は、互いに影響しない動きの順を入れ替えた並びを1つだけ調べる。合成的な検証（compositional verification）は、部品ごとに確かめた結果を組み合わせて、全体を一度に展開しない。どちらもこのサイトでは計算していない。",
      set: {
        checker: { tone: "idle", rows: { 対策: "対称性・正規化ほか" } },
      },
      detail: [
        {
          title: "状態を減らす主な手",
          fields: [
            { label: "対称性", value: "回したり入れ替えたりして同じ状態をまとめる" },
            { label: "正規化（圧縮）", value: "外から見える振る舞いだけを残す" },
            { label: "半順序削減", value: "影響しない動きの順の入れ替えを省く" },
            { label: "合成的な検証", value: "部品ごとに確かめて組み合わせる" },
          ],
        },
      ],
    },
    {
      id: "test",
      kind: "test",
      title: "テストの同値分割",
      actor: "model",
      to: ["checker"],
      summary: "同じ振る舞いになる入力をまとめるのは、テストの同値分割と同じ考え方",
      explain:
        "対称性で状態をまとめるのは、テストで同じ振る舞いになる入力を1つの代表で済ませる同値分割と同じ考え方。モデルを書くときも、区別しなくてよい値（同じ規則で動く利用者など）を区別しない形で書くと、調べる状態が減る。",
      set: { model: { tone: "ok" }, checker: { tone: "ok" } },
    },
  ],
  lab: {
    title: "人数を変える",
    hint: `人数は${MIN_PEOPLE}〜${MAX_PEOPLE}。${MAX_PEOPLE}人でも数十ミリ秒で数え終わる。人数が増えるほど、減った割合は人数分の1に近づく。`,
    inputs: [
      { id: "people", label: `人数（${MIN_PEOPLE}〜${MAX_PEOPLE}）`, initial: "5" },
    ],
    compute: (values): Field[] => {
      const people = parsePeople(values.people);
      const row = rowOf(people);
      const percent = Math.round((row.symmetric / row.full) * 1000) / 10;
      return [
        { label: "人数", value: `${people}人` },
        { label: "状態数", value: `${row.full}個`, tone: "bad" },
        { label: "対称性で減らした数", value: `${row.symmetric}個`, tone: "ok" },
        {
          label: "減った割合",
          value: `${divisorText(row)}分の1（元の${percent}%）`,
        },
      ];
    },
  },
};
