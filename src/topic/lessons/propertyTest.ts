import { translator, type Language } from "../../core/i18n";
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

function runsText(n: number): string {
  return n === 1 ? "1 run" : `${n} runs`;
}

export function propertyTestLesson(language: Language): Lesson {
  const t = translator(language);
  return {
    id: "property-test",
    category: "testing",
    title: t("性質ベーステスト", "Property-based testing"),
    subtitle: t(
      "入力を作らせて、成り立つべき性質を確かめる",
      "Let the tool make inputs and check a property that must hold",
    ),
    summary: t(
      `「重複を取り除く」関数を、例ではなく性質で試す。隣どうしだけ見る誤った実装は${BUGGY.runs}回目で反例が見つかり、${formatArray(SHRUNK)}まで縮められる。`,
      `Test a "remove duplicates" function with a property instead of examples. The buggy version that only looks at neighbours fails on run ${BUGGY.runs}, and the counterexample shrinks to ${formatArray(SHRUNK)}.`,
    ),
    intro: [
      t(
        "性質ベーステストは、入力と期待する答えを1組ずつ書く代わりに、どの入力でも成り立つべき関係（性質）を書き、入力は道具に乱数で作らせて確かめるテストである。ここからは、モデルで学んだ考え方をふだんのテストへ持ち帰る。",
        "Property-based testing writes, instead of one input and expected answer at a time, a relation that must hold for every input (a property), and lets the tool generate random inputs to check it. From here on, we take the ideas learned with models back to everyday testing.",
      ),
      t(
        "これまでのモデル検査は、モデルの状態を全部たどった。実装のコードは全部たどれないが、性質を書いておけば、人が思いつかない入力をまとめて試せる。例を並べるテストで抜けやすい組み合わせを、道具に探させるやり方である。",
        "The model checking so far walked every state of a model. You cannot walk every state of real code, but once a property is written, you can try many inputs nobody would think of. It lets the tool hunt for the combinations that example-based tests tend to miss.",
      ),
      t(
        "図では、左の生成器から対象の関数を通って性質のカードへ流れる矢印を追う。性質のカードが失敗の色に変わるところが反例の見つかった時点で、その後に現れる縮小器が、反例を読みやすい形まで短くしていく。",
        "In the diagram, follow the arrows from the generator on the left, through the function under test, to the property card. The moment the property card turns to the failure colour is when a counterexample is found; the shrinker that appears next cuts it down to a form that is easy to read.",
      ),
    ],
    facts: [
      {
        label: t("試す回数", "Runs"),
        value: t(`最大${RUNS}回`, `up to ${RUNS}`),
      },
      {
        label: t("反例が出た回", "Failed on run"),
        value: t(`${BUGGY.runs}回目`, `${BUGGY.runs}`),
        tone: "bad",
      },
      {
        label: t("縮めた反例", "Shrunk counterexample"),
        value: formatArray(SHRUNK),
        tone: "bad",
      },
      {
        label: t("実物の道具", "Real tools"),
        value: t("fast-check・Hypothesis", "fast-check, Hypothesis"),
      },
    ],
    actors: [
      {
        id: "generator",
        label: t("生成器", "Generator"),
        sublabel: t(
          `長さ0〜${MAX_LENGTH}・値0〜${MAX_VALUE}`,
          `length 0-${MAX_LENGTH}, values 0-${MAX_VALUE}`,
        ),
        icon: "dice",
        x: 14,
        y: 50,
        initial: { rows: { [t("シード", "seed")]: String(SEED) } },
      },
      {
        id: "subject",
        label: t("対象の関数", "Function"),
        sublabel: t("重複を取り除く", "removes duplicates"),
        icon: "process",
        x: 38,
        y: 50,
        initial: {
          rows: {
            [t("実装", "impl")]: t("隣どうしだけ見る", "neighbours only"),
          },
        },
      },
      {
        id: "property",
        label: t("性質", "Property"),
        sublabel: t("どの入力でも成り立つ", "holds for every input"),
        icon: "contract",
        x: 62,
        y: 50,
      },
      {
        id: "shrinker",
        label: t("縮小器", "Shrinker"),
        sublabel: t("反例を小さくする", "makes it smaller"),
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
        title: t("性質を書く", "Write the property"),
        actor: "property",
        to: ["subject"],
        summary: t(
          "「重複が無い」かつ「入力の値が全部残る」を書く",
          'Write "no duplicates" and "every input value is kept"',
        ),
        explain: t(
          "例を書くテストは「[1,1,2] なら [1,2]」のように入力と答えを1組ずつ書く。性質を書くテストは、どの入力でも成り立つべきこと（出力に重複が無い、入力の値が全部出力にある）だけを書き、入力は道具に作らせる。",
          'An example-based test writes one input and answer at a time, like "[1,1,2] gives [1,2]". A property-based test writes only what must hold for every input (the output has no duplicates, every input value is in the output) and lets the tool make the inputs.',
        ),
        set: {
          property: {
            rows: {
              [t("性質1", "property 1")]: t("出力に重複が無い", "no duplicates"),
              [t("性質2", "property 2")]: t("入力の値が全部残る", "all inputs kept"),
            },
          },
        },
        detail: [
          {
            title: t("2種類のテストの書き方", "Two ways to write a test"),
            fields: [
              {
                label: t("例を書くテスト", "Example-based test"),
                value: t(
                  "入力と期待する出力を、人が1組ずつ書く",
                  "A person writes each input and expected output",
                ),
              },
              {
                label: t("性質を書くテスト", "Property-based test"),
                value: t(
                  "どの入力でも成り立つ関係を書き、入力は道具が作る",
                  "Write a relation that holds for every input; the tool makes the inputs",
                ),
              },
            ],
          },
        ],
      },
      {
        id: "generate",
        kind: "run",
        title: t("入力を作って流す", "Generate inputs and run"),
        actor: "generator",
        to: ["subject"],
        summary: t(
          `シード${SEED}で配列を作り、1回ずつ関数に通す`,
          `Make arrays with seed ${SEED} and pass them through the function one by one`,
        ),
        explain: t(
          `生成器が長さ0〜${MAX_LENGTH}、値0〜${MAX_VALUE}の配列を作り、対象の関数に渡す。シード（乱数の種）を決めておくと、同じ入力の並びを何度でも作り直せる。`,
          `The generator makes arrays of length 0-${MAX_LENGTH} with values 0-${MAX_VALUE} and passes them to the function under test. Fixing the seed (the starting value for the random numbers) lets you recreate the same sequence of inputs any number of times.`,
        ),
        set: {
          generator: {
            tone: "wait",
            rows: {
              [t("試した回数", "runs")]: t(`${BUGGY.runs - 1}回`, `${BUGGY.runs - 1}`),
            },
          },
          property: {
            tone: "ok",
            rows: { [t("結果", "result")]: t("ここまで成り立つ", "holds so far") },
          },
        },
        simplified: t(
          "fast-check や Hypothesis の生成器は、空の配列や境界の値を混ぜるなど、偏りを付けて入力を作る。ここでは一様な乱数で作っている。",
          "The generators in fast-check and Hypothesis bias their inputs, for example by mixing in empty arrays and boundary values. Here they are made with uniform random numbers.",
        ),
      },
      {
        id: "found",
        kind: "found",
        title: t("反例が見つかる", "A counterexample is found"),
        actor: "property",
        to: ["subject"],
        summary: t(
          `${BUGGY.runs}回目の入力${formatArray(FAILING)}で性質が破れる`,
          `On run ${BUGGY.runs}, input ${formatArray(FAILING)} breaks the property`,
        ),
        explain: t(
          `${BUGGY.runs}回目に作った${formatArray(FAILING)}を通すと、出力は${formatArray(FAILING_OUTPUT)}で重複が残る。隣どうしだけを比べているので、離れた場所にある同じ値を取り除けない。`,
          `Passing ${formatArray(FAILING)}, made on run ${BUGGY.runs}, gives ${formatArray(FAILING_OUTPUT)}, which still has a duplicate. Because it compares only neighbours, it cannot remove equal values that are apart.`,
        ),
        set: {
          generator: {
            tone: "idle",
            rows: { [t("試した回数", "runs")]: t(`${BUGGY.runs}回`, `${BUGGY.runs}`) },
          },
          subject: {
            tone: "bad",
            rows: {
              [t("入力", "input")]: formatArray(FAILING),
              [t("出力", "output")]: formatArray(FAILING_OUTPUT),
            },
          },
          property: {
            tone: "bad",
            rows: { [t("結果", "result")]: t("重複が残った", "duplicate left") },
          },
        },
      },
      {
        id: "shrink",
        kind: "explore",
        title: t("反例を縮める", "Shrink the counterexample"),
        actor: "shrinker",
        to: ["subject"],
        summary: t(
          `要素を消したり値を小さくしたりして${BUGGY.shrinkSteps.length - 1}回縮める`,
          `Shrink it ${BUGGY.shrinkSteps.length - 1} ${BUGGY.shrinkSteps.length - 1 === 1 ? "time" : "times"} by removing elements or making values smaller`,
        ),
        explain: t(
          "縮小器（shrink）は、反例から要素を1つ消した配列や、値を0や1つ小さい値に変えた配列を試す。まだ性質が破れる候補があればそれに乗り換え、もう縮まらなくなるまで続ける。",
          "The shrinker tries arrays with one element removed from the counterexample, or with a value changed to 0 or one less. If a candidate still breaks the property it switches to that one, and keeps going until nothing smaller works.",
        ),
        set: {
          shrinker: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("最初", "first")]: formatArray(FAILING),
              [t("縮めた", "shrunk")]: formatArray(SHRUNK),
            },
          },
          subject: {
            rows: {
              [t("入力", "input")]: formatArray(SHRUNK),
              [t("出力", "output")]: formatArray(SHRUNK_OUTPUT),
            },
          },
        },
        detail: [
          {
            title: t("縮める途中の反例", "Counterexamples while shrinking"),
            fields: BUGGY.shrinkSteps.map((values, i) => ({
              label:
                i === 0 ? t("見つかった反例", "Found") : t(`${i}回目`, `Shrink ${i}`),
              value: formatArray(values),
              note: t(
                `出力${formatArray(removeAdjacentDuplicates(values))}`,
                `output ${formatArray(removeAdjacentDuplicates(values))}`,
              ),
            })),
          },
        ],
        simplified: t(
          "ここの縮小器は「候補を順に試し、最初に破れたものへ乗り換える」だけの単純なもの。fast-check や Hypothesis は値の型ごとに縮め方を持ち、もっと賢く小さな反例にたどり着く。",
          'The shrinker here is a simple one that only "tries candidates in order and switches to the first that fails". fast-check and Hypothesis know how to shrink each type of value and reach small counterexamples more cleverly.',
        ),
      },
      {
        id: "read-shrunk",
        kind: "found",
        title: t("縮めた反例を読む", "Read the shrunk counterexample"),
        actor: "shrinker",
        to: ["property"],
        summary: t(
          `${formatArray(SHRUNK)}なら、離れた同じ値が原因だとすぐ分かる`,
          `With ${formatArray(SHRUNK)}, it is clear at once that equal values apart are the cause`,
        ),
        explain: t(
          `最初の反例${formatArray(FAILING)}は長く、どこが悪いか読み取りにくい。縮めた${formatArray(SHRUNK)}は、同じ値が間に別の値を挟んで並んでいるだけなので、「隣しか見ていない」という原因が一目で分かる。`,
          `The first counterexample ${formatArray(FAILING)} is long, and it is hard to see what is wrong. The shrunk ${formatArray(SHRUNK)} is just equal values with another value between them, so the cause, "it only looks at neighbours", is obvious at a glance.`,
        ),
        set: {
          shrinker: { tone: "bad" },
          property: {
            rows: {
              [t("結果", "result")]: t(
                `${formatArray(SHRUNK)}で破れる`,
                `fails on ${formatArray(SHRUNK)}`,
              ),
            },
          },
        },
      },
      {
        id: "fix",
        kind: "fix",
        title: t("正しい実装に替える", "Switch to a correct version"),
        actor: "subject",
        to: ["property"],
        summary: t(
          `出てきた値を覚える実装は、${CORRECT.runs}回すべて通る`,
          `A version that remembers values it has seen passes all ${CORRECT.runs} runs`,
        ),
        explain: t(
          `一度出てきた値を覚えておき、2回目以降を捨てる実装に替える。同じシード${SEED}で${CORRECT.runs}回試しても、性質は一度も破れない。`,
          `Switch to a version that remembers each value it has seen and drops later copies. Running ${runsText(CORRECT.runs)} with the same seed ${SEED}, the property never breaks.`,
        ),
        set: {
          subject: {
            tone: "ok",
            rows: {
              [t("実装", "impl")]: t("出た値を覚える", "remembers values"),
              [t("入力", "input")]: null,
              [t("出力", "output")]: null,
            },
          },
          property: {
            tone: "ok",
            rows: {
              [t("結果", "result")]: CORRECT.failing
                ? t("破れた", "failed")
                : t(`${CORRECT.runs}回とも成り立つ`, `holds in all ${CORRECT.runs}`),
            },
          },
          shrinker: {
            tone: "idle",
            rows: {
              [t("最初", "first")]: null,
              [t("縮めた", "shrunk")]: t("不要", "not needed"),
            },
          },
          generator: {
            rows: {
              [t("試した回数", "runs")]: t(`${CORRECT.runs}回`, `${CORRECT.runs}`),
            },
          },
        },
        simplified: t(
          "通ったのは、この生成器で作った100個の入力についてだけで、全部の入力で正しいと証明したわけではない。全部を確かめるには、モデル検査や証明の道具を使う。",
          "It passed only for the 100 inputs this generator made; that does not prove it correct for every input. To check every input, use model checking or a proof tool.",
        ),
      },
    ],
    lab: {
      title: t("シードを変える", "Change the seed"),
      hint: t(
        "シード（乱数の種）を変えると、作られる入力の並びが変わる。何回目で見つかるか、最初の反例、縮めた反例がどう変わるかを見る。",
        "Changing the seed (the starting value for the random numbers) changes the sequence of inputs. Watch how the run that finds it, the first counterexample and the shrunk counterexample change.",
      ),
      inputs: [
        {
          id: "seed",
          label: t("シード（0以上の整数）", "Seed (integer, 0 or more)"),
          initial: String(SEED),
        },
      ],
      compute: (values): Field[] => {
        const seed = parseSeed(values.seed);
        const result = runPropertyTest(removeAdjacentDuplicates, PROPERTY, {
          seed,
          runs: RUNS,
        });
        if (!result.failing || !result.shrunk) {
          return [
            { label: t("シード", "Seed"), value: String(seed) },
            {
              label: t("反例", "Counterexample"),
              value: t(`${RUNS}回で見つからず`, `none in ${runsText(RUNS)}`),
              tone: "ok",
            },
          ];
        }
        const shrinkCount = result.shrinkSteps.length - 1;
        return [
          { label: t("シード", "Seed"), value: String(seed) },
          {
            label: t("見つかった回", "Found on run"),
            value: t(`${result.runs}回目`, `${result.runs}`),
            tone: "bad",
          },
          {
            label: t("最初の反例", "First counterexample"),
            value: formatArray(result.failing),
            isCode: true,
          },
          {
            label: t("縮めた反例", "Shrunk counterexample"),
            value: formatArray(result.shrunk),
            tone: "bad",
            isCode: true,
          },
          {
            label: t("縮めた回数", "Shrink steps"),
            value: t(`${shrinkCount}回`, `${shrinkCount}`),
          },
        ];
      },
    },
  };
}
