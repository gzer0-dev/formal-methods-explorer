import type { Field, Lesson } from "../../core/types";
import {
  formatArray,
  hasNoDuplicates,
  MAX_LENGTH,
  MAX_VALUE,
  removeAdjacentDuplicates,
  runPropertyTest,
  uniqueValues,
  type Property,
} from "../pbt";

const SEED = 7;
const RUNS = 100;

// 性質: 出力に重複が無い、かつ入力にあった値が全部出力に残っている。
const PROPERTY: Property = (input, output) =>
  hasNoDuplicates(output) && input.every((value) => output.includes(value));

const BUGGY = runPropertyTest(removeAdjacentDuplicates, PROPERTY, {
  seed: SEED,
  runs: RUNS,
});
const CORRECT = runPropertyTest(uniqueValues, PROPERTY, { seed: SEED, runs: RUNS });
// 誤った実装では反例が必ず見つかる（pbt の期待値で確かめてある）。
const FAILING = BUGGY.failing!;
const SHRUNK = BUGGY.shrunk!;
const SHRUNK_OUTPUT = removeAdjacentDuplicates(SHRUNK);
const FAILING_OUTPUT = removeAdjacentDuplicates(FAILING);

function parseSeed(text: string | undefined): number {
  const value = Number.parseInt(text ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : SEED;
}

export const propertyTestLesson: Lesson = {
  id: "property-test",
  category: "testing",
  title: "性質ベーステスト",
  subtitle: "入力を作らせて、成り立つべき性質を確かめる",
  summary: `「重複を取り除く」関数を、例ではなく性質で試す。隣どうしだけ見る誤った実装は${BUGGY.runs}回目で反例が見つかり、${formatArray(SHRUNK)}まで縮められる。`,
  intro: [
    "性質ベーステストは、入力と期待する答えを1組ずつ書く代わりに、どの入力でも成り立つべき関係（性質）を書き、入力は道具に乱数で作らせて確かめるテストである。ここからは、モデルで学んだ考え方をふだんのテストへ持ち帰る。",
    "これまでのモデル検査は、モデルの状態を全部たどった。実装のコードは全部たどれないが、性質を書いておけば、人が思いつかない入力をまとめて試せる。例を並べるテストで抜けやすい組み合わせを、道具に探させるやり方である。",
    "図では、左の生成器から対象の関数を通って性質のカードへ流れる矢印を追う。性質のカードが失敗の色に変わるところが反例の見つかった時点で、その後に現れる縮小器が、反例を読みやすい形まで短くしていく。",
  ],
  facts: [
    { label: "試す回数", value: `最大${RUNS}回` },
    { label: "反例が出た回", value: `${BUGGY.runs}回目`, tone: "bad" },
    { label: "縮めた反例", value: formatArray(SHRUNK), tone: "bad" },
    { label: "実物の道具", value: "fast-check・Hypothesis" },
  ],
  actors: [
    {
      id: "generator",
      label: "生成器",
      sublabel: `長さ0〜${MAX_LENGTH}・値0〜${MAX_VALUE}`,
      icon: "dice",
      x: 14,
      y: 50,
      initial: { rows: { シード: String(SEED) } },
    },
    {
      id: "subject",
      label: "対象の関数",
      sublabel: "重複を取り除く",
      icon: "process",
      x: 38,
      y: 50,
      initial: { rows: { 実装: "隣どうしだけ見る" } },
    },
    {
      id: "property",
      label: "性質",
      sublabel: "どの入力でも成り立つ",
      icon: "contract",
      x: 62,
      y: 50,
    },
    {
      id: "shrinker",
      label: "縮小器",
      sublabel: "反例を小さくする",
      icon: "shrink",
      x: 86,
      y: 50,
      initial: { isHidden: true },
    },
  ],
  stageHeight: 300,
  links: [
    { from: "generator", to: "subject" },
    { from: "subject", to: "property" },
    { from: "property", to: "shrinker" },
  ],
  steps: [
    {
      id: "write-property",
      kind: "spec",
      title: "性質を書く",
      actor: "property",
      to: ["subject"],
      summary: "「重複が無い」かつ「入力の値が全部残る」を書く",
      explain:
        "例を書くテストは「[1,1,2] なら [1,2]」のように入力と答えを1組ずつ書く。性質を書くテストは、どの入力でも成り立つべきこと（出力に重複が無い、入力の値が全部出力にある）だけを書き、入力は道具に作らせる。",
      set: {
        property: { rows: { 性質1: "出力に重複が無い", 性質2: "入力の値が全部残る" } },
      },
      detail: [
        {
          title: "2種類のテストの書き方",
          fields: [
            { label: "例を書くテスト", value: "入力と期待する出力を、人が1組ずつ書く" },
            {
              label: "性質を書くテスト",
              value: "どの入力でも成り立つ関係を書き、入力は道具が作る",
            },
          ],
        },
      ],
    },
    {
      id: "generate",
      kind: "run",
      title: "入力を作って流す",
      actor: "generator",
      to: ["subject"],
      summary: `シード${SEED}で配列を作り、1回ずつ関数に通す`,
      explain: `生成器が長さ0〜${MAX_LENGTH}、値0〜${MAX_VALUE}の配列を作り、対象の関数に渡す。シード（乱数の種）を決めておくと、同じ入力の並びを何度でも作り直せる。`,
      set: {
        generator: { tone: "wait", rows: { 試した回数: `${BUGGY.runs - 1}回` } },
        property: { tone: "ok", rows: { 結果: "ここまで成り立つ" } },
      },
      simplified:
        "fast-check や Hypothesis の生成器は、空の配列や境界の値を混ぜるなど、偏りを付けて入力を作る。ここでは一様な乱数で作っている。",
    },
    {
      id: "found",
      kind: "found",
      title: "反例が見つかる",
      actor: "property",
      to: ["subject"],
      summary: `${BUGGY.runs}回目の入力${formatArray(FAILING)}で性質が破れる`,
      explain: `${BUGGY.runs}回目に作った${formatArray(FAILING)}を通すと、出力は${formatArray(FAILING_OUTPUT)}で重複が残る。隣どうしだけを比べているので、離れた場所にある同じ値を取り除けない。`,
      set: {
        generator: { tone: "idle", rows: { 試した回数: `${BUGGY.runs}回` } },
        subject: {
          tone: "bad",
          rows: { 入力: formatArray(FAILING), 出力: formatArray(FAILING_OUTPUT) },
        },
        property: { tone: "bad", rows: { 結果: "重複が残った" } },
      },
    },
    {
      id: "shrink",
      kind: "explore",
      title: "反例を縮める",
      actor: "shrinker",
      to: ["subject"],
      summary: `要素を消したり値を小さくしたりして${BUGGY.shrinkSteps.length - 1}回縮める`,
      explain:
        "縮小器（shrink）は、反例から要素を1つ消した配列や、値を0や1つ小さい値に変えた配列を試す。まだ性質が破れる候補があればそれに乗り換え、もう縮まらなくなるまで続ける。",
      set: {
        shrinker: {
          isHidden: false,
          tone: "wait",
          rows: { 最初: formatArray(FAILING), 縮めた: formatArray(SHRUNK) },
        },
        subject: {
          rows: { 入力: formatArray(SHRUNK), 出力: formatArray(SHRUNK_OUTPUT) },
        },
      },
      detail: [
        {
          title: "縮める途中の反例",
          fields: BUGGY.shrinkSteps.map((values, i) => ({
            label: i === 0 ? "見つかった反例" : `${i}回目`,
            value: formatArray(values),
            note: `出力${formatArray(removeAdjacentDuplicates(values))}`,
          })),
        },
      ],
      simplified:
        "ここの縮小器は「候補を順に試し、最初に破れたものへ乗り換える」だけの単純なもの。fast-check や Hypothesis は値の型ごとに縮め方を持ち、もっと賢く小さな反例にたどり着く。",
    },
    {
      id: "read-shrunk",
      kind: "found",
      title: "縮めた反例を読む",
      actor: "shrinker",
      to: ["property"],
      summary: `${formatArray(SHRUNK)}なら、離れた同じ値が原因だとすぐ分かる`,
      explain: `最初の反例${formatArray(FAILING)}は長く、どこが悪いか読み取りにくい。縮めた${formatArray(SHRUNK)}は、同じ値が間に別の値を挟んで並んでいるだけなので、「隣しか見ていない」という原因が一目で分かる。`,
      set: {
        shrinker: { tone: "bad" },
        property: { rows: { 結果: `${formatArray(SHRUNK)}で破れる` } },
      },
    },
    {
      id: "fix",
      kind: "fix",
      title: "正しい実装に替える",
      actor: "subject",
      to: ["property"],
      summary: `出てきた値を覚える実装は、${CORRECT.runs}回すべて通る`,
      explain: `一度出てきた値を覚えておき、2回目以降を捨てる実装に替える。同じシード${SEED}で${CORRECT.runs}回試しても、性質は一度も破れない。`,
      set: {
        subject: {
          tone: "ok",
          rows: { 実装: "出た値を覚える", 入力: null, 出力: null },
        },
        property: {
          tone: "ok",
          rows: { 結果: CORRECT.failing ? "破れた" : `${CORRECT.runs}回とも成り立つ` },
        },
        shrinker: { tone: "idle", rows: { 最初: null, 縮めた: "不要" } },
        generator: { rows: { 試した回数: `${CORRECT.runs}回` } },
      },
      simplified:
        "通ったのは、この生成器で作った100個の入力についてだけで、全部の入力で正しいと証明したわけではない。全部を確かめるには、モデル検査や証明の道具を使う。",
    },
  ],
  lab: {
    title: "シードを変える",
    hint: "シード（乱数の種）を変えると、作られる入力の並びが変わる。何回目で見つかるか、最初の反例、縮めた反例がどう変わるかを見る。",
    inputs: [{ id: "seed", label: "シード（0以上の整数）", initial: String(SEED) }],
    compute: (values): Field[] => {
      const seed = parseSeed(values.seed);
      const result = runPropertyTest(removeAdjacentDuplicates, PROPERTY, {
        seed,
        runs: RUNS,
      });
      if (!result.failing || !result.shrunk) {
        return [
          { label: "シード", value: String(seed) },
          { label: "反例", value: `${RUNS}回で見つからず`, tone: "ok" },
        ];
      }
      return [
        { label: "シード", value: String(seed) },
        { label: "見つかった回", value: `${result.runs}回目`, tone: "bad" },
        { label: "最初の反例", value: formatArray(result.failing), isCode: true },
        {
          label: "縮めた反例",
          value: formatArray(result.shrunk),
          tone: "bad",
          isCode: true,
        },
        { label: "縮めた回数", value: `${result.shrinkSteps.length - 1}回` },
      ];
    },
  },
};
