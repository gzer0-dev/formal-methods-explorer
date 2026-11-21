import { translator, type Language } from "../../core/i18n";
import type { Lesson, Step } from "../../core/types";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";
import {
  formatArray,
  hasNoDuplicates,
  MAX_LENGTH,
  MAX_VALUE,
  removeAdjacentDuplicates,
  runPropertyTest,
  shrinkCandidates,
  type Property,
} from "../pbt";

// 演習: シード7で性質ベーステストを流し、縮めきった反例の長さを答える（元は exerciseModel.ts の問6）。
// 条件は exerciseModel.ts・propertyTest.ts と同じ。変えるとレッスンで見た反例と正解が食い違う。
// 既定の図は性質・生成器・縮め方の決まりだけを見せ、見つかった反例は出さない。答えを入れると、
// 反例が見つかる所から1回ずつ縮める様子と、もう縮まらない理由が図に足される。
const SEED = 7;
const RUNS = 100;
// 性質: 出力に重複が無い、かつ入力にあった値が全部出力に残っている。
const PROPERTY: Property = (input, output) =>
  hasNoDuplicates(output) && input.every((value) => output.includes(value));

const RESULT = lazy(() =>
  runPropertyTest(removeAdjacentDuplicates, PROPERTY, { seed: SEED, runs: RUNS }),
);

type Translate = (ja: string, en: string) => string;

/** 縮める1回で何が変わったか。要素を1つ消したか、値を1つ小さくしたか（shrinkCandidates の2種類）。 */
type ShrinkChange =
  { kind: "remove"; value: number } | { kind: "lower"; from: number; to: number };

function changeBetween(before: number[], after: number[]): ShrinkChange {
  if (after.length < before.length) {
    const index = before.findIndex((value, i) => value !== after[i]);
    const removedAt = index === -1 ? before.length - 1 : index;
    return { kind: "remove", value: before[removedAt] };
  }
  const index = before.findIndex((value, i) => value !== after[i]);
  return { kind: "lower", from: before[index], to: after[index] };
}

export function exerciseShrunkLesson(language: Language): Lesson {
  const t: Translate = translator(language);
  const inputKey = t("入力", "input");
  const outputKey = t("出力", "output");
  const resultKey = t("結果", "result");
  const ruleKey = t("縮め方", "how");
  const currentKey = t("いま", "now");
  const lengthKey = t("長さ", "length");

  function setupSteps(): Step[] {
    return [
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
          "対象は配列から重複を取り除く関数で、誤った実装（隣どうしだけ比べる）を使う。性質は「出力に重複が無く、入力の値が全部出力に残る」。どの入力でも成り立つべきことだけを書き、入力は道具に作らせる。",
          'The subject is a function that removes duplicates from an array, using a buggy version that compares only neighbours. The property is "the output has no duplicates and keeps every input value". You write only what must hold for every input and let the tool make the inputs.',
        ),
        set: {
          property: {
            rows: {
              [t("性質1", "property 1")]: t("出力に重複が無い", "no duplicates"),
              [t("性質2", "property 2")]: t("入力の値が全部残る", "all inputs kept"),
            },
          },
        },
      },
      {
        id: "generate",
        kind: "run",
        title: t(`シード${SEED}で流す`, `Run with seed ${SEED}`),
        actor: "generator",
        to: ["subject"],
        summary: t(
          `シード${SEED}で配列を作り、${RUNS}回まで関数に通す`,
          `Make arrays with seed ${SEED} and pass up to ${RUNS} of them through the function`,
        ),
        explain: t(
          `生成器が長さ0〜${MAX_LENGTH}、値0〜${MAX_VALUE}の配列を作り、対象の関数に渡す。性質が破れたらそこで止まる。シード（乱数の種）が決まっているので、何度流しても同じ入力の並びになる。`,
          `The generator makes arrays of length 0-${MAX_LENGTH} with values 0-${MAX_VALUE} and passes them to the function. It stops as soon as the property breaks. The seed (the starting value for the random numbers) is fixed, so every run produces the same sequence of inputs.`,
        ),
        set: {
          generator: {
            tone: "wait",
            rows: { [t("最大", "up to")]: t(`${RUNS}回`, `${RUNS} runs`) },
          },
        },
      },
      {
        id: "question",
        kind: "explore",
        title: t("縮めた反例の長さは", "How long once shrunk?"),
        actor: "shrinker",
        to: ["subject"],
        summary: t(
          "見つかった反例を縮めきると、配列の長さがいくつになるかを答える",
          "Answer how long the array is once the counterexample is fully shrunk",
        ),
        explain: t(
          `重複を取り除く関数の誤った実装（隣どうしだけ比べる）に、性質ベーステストをシード${SEED}で${RUNS}回まで流す。性質は「出力に重複が無く、入力の値が全部残る」。縮小器は「要素を1つ消す」「値を0や1つ小さい値にする」を試し、性質が破れたままの候補に乗り換え続ける。見つかった反例を縮めきると、配列の長さ（要素の数）はいくつか。下の「答え合わせ」に数を入れると、縮める様子がこの図に足される。ヒント: 隣どうしが違う値で、同じ値がどこかに2回あれば破れる。`,
          `Run a property-based test, with seed ${SEED} and up to ${RUNS} runs, against a buggy function that removes duplicates (it compares only neighbours). The property is "the output has no duplicates and keeps every input value". The shrinker tries "remove one element" and "make a value 0 or one smaller", and keeps switching to a candidate that still breaks the property. Once the counterexample is fully shrunk, what is the array's length (number of elements)? Enter a number under "Check your answer" below and the shrinking is added to this diagram. Hint: it breaks when neighbours differ but some value appears twice.`,
        ),
        set: {
          generator: { tone: "idle" },
          shrinker: {
            isHidden: false,
            tone: "wait",
            rows: { [ruleKey]: t("消す・小さくする", "remove or lower") },
          },
        },
        simplified: t(
          "fast-check などの実物は、縮め方の候補がもっと多く、値の型ごとに縮め方を持っている。ここでは「要素を1つ消す」「値を小さくする」だけを欲張りに試している。",
          'Real tools such as fast-check try many more shrink candidates and know how to shrink each type of value. Here it greedily tries only "remove one element" and "make a value smaller".',
        ),
      },
    ];
  }

  function shrinkTitle(index: number, change: ShrinkChange): string {
    if (change.kind === "remove") {
      return t(
        `${index}回目: ${change.value}を消す`,
        `Shrink ${index}: remove ${change.value}`,
      );
    }
    return t(
      `${index}回目: ${change.from}を${change.to}に`,
      `Shrink ${index}: ${change.from} becomes ${change.to}`,
    );
  }

  function shrinkExplain(change: ShrinkChange, after: number[]): string {
    const output = formatArray(removeAdjacentDuplicates(after));
    if (change.kind === "remove") {
      return t(
        `要素${change.value}を1つ消した${formatArray(after)}でも、出力は${output}で重複が残る。まだ性質が破れるので、こちらに乗り換える。`,
        `With one ${change.value} removed, ${formatArray(after)} gives ${output}, which still has a duplicate. It still breaks the property, so the shrinker switches to it.`,
      );
    }
    return t(
      `どの要素を消しても性質が破れなくなるので、値を小さくする候補に移る。${change.from}を${change.to}にした${formatArray(after)}でも、出力は${output}で破れたまま。`,
      `Removing any element no longer breaks the property, so the shrinker moves on to making values smaller. With ${change.from} changed to ${change.to}, ${formatArray(after)} still fails: the output is ${output}.`,
    );
  }

  function solutionSteps(): Step[] {
    const result = RESULT();
    if (!result.failing || !result.shrunk) return [];
    const failing = result.failing;
    const shrunk = result.shrunk;
    const found: Step = {
      id: "found",
      kind: "found",
      title: t("反例が見つかる", "A counterexample is found"),
      actor: "property",
      to: ["subject"],
      summary: t(
        `${result.runs}回目の入力${formatArray(failing)}で性質が破れる`,
        `On run ${result.runs}, input ${formatArray(failing)} breaks the property`,
      ),
      explain: t(
        `${result.runs}回目に作った${formatArray(failing)}を通すと、出力は${formatArray(removeAdjacentDuplicates(failing))}で重複が残る。長さ${failing.length}のままでは、どこが悪いか読み取りにくい。ここから縮小器が縮めていく。`,
        `Passing ${formatArray(failing)}, made on run ${result.runs}, gives ${formatArray(removeAdjacentDuplicates(failing))}, which still has a duplicate. At length ${failing.length} it is hard to see what is wrong, so the shrinker starts cutting it down.`,
      ),
      set: {
        generator: {
          rows: {
            [t("見つけた回", "found on")]: t(
              `${result.runs}回目`,
              `run ${result.runs}`,
            ),
          },
        },
        subject: {
          tone: "bad",
          rows: {
            [inputKey]: formatArray(failing),
            [outputKey]: formatArray(removeAdjacentDuplicates(failing)),
          },
        },
        property: {
          tone: "bad",
          rows: { [resultKey]: t("重複が残った", "duplicate left") },
        },
        shrinker: {
          rows: {
            [currentKey]: formatArray(failing),
            [lengthKey]: String(failing.length),
          },
        },
      },
    };

    const shrinks: Step[] = result.shrinkSteps.slice(1).map((after, i) => {
      const before = result.shrinkSteps[i];
      const change = changeBetween(before, after);
      return {
        id: `shrink-${i + 1}`,
        kind: "explore",
        title: shrinkTitle(i + 1, change),
        actor: "shrinker",
        to: ["subject"],
        summary: t(
          `${formatArray(before)} → ${formatArray(after)}（長さ${after.length}）`,
          `${formatArray(before)} → ${formatArray(after)} (length ${after.length})`,
        ),
        explain: shrinkExplain(change, after),
        set: {
          subject: {
            rows: {
              [inputKey]: formatArray(after),
              [outputKey]: formatArray(removeAdjacentDuplicates(after)),
            },
          },
          shrinker: {
            rows: {
              [currentKey]: formatArray(after),
              [lengthKey]: String(after.length),
            },
          },
        },
      };
    });

    const candidates = shrinkCandidates(shrunk);
    const stuck: Step = {
      id: "stuck",
      kind: "found",
      title: t("もう縮まらない", "Nothing smaller fails"),
      actor: "shrinker",
      to: ["property"],
      summary: t(
        `${formatArray(shrunk)}の候補${candidates.length}個は、どれも性質を守る`,
        `All ${candidates.length} candidates from ${formatArray(shrunk)} keep the property`,
      ),
      explain: t(
        `${formatArray(shrunk)}から作れる候補${candidates.length}個（1つ消す・値を小さくする）を全部試しても、性質が破れるものは無い。要素を1つ消すと長さ${shrunk.length - 1}になり、同じ値が隣どうしでない並びが作れない。縮めきった反例の長さは${shrunk.length}で、「離れた同じ値を取り除けない」という原因が一目で分かる。`,
        `Trying all ${candidates.length} candidates from ${formatArray(shrunk)} (remove one, or make a value smaller), none breaks the property. Removing an element leaves length ${shrunk.length - 1}, too short for equal values that are not neighbours. The fully shrunk counterexample has length ${shrunk.length}, and the cause, "equal values apart are not removed", is obvious at a glance.`,
      ),
      set: {
        property: {
          rows: {
            [resultKey]: t(
              `${formatArray(shrunk)}で破れる`,
              `fails on ${formatArray(shrunk)}`,
            ),
          },
        },
        shrinker: {
          tone: "bad",
          rows: { [ruleKey]: null },
        },
      },
    };
    return [found, ...shrinks, stuck];
  }

  return buildExerciseLesson(
    {
      id: "exercise-shrunk",
      title: t("演習: 縮めた反例の長さ", "Exercise: length after shrinking"),
      subtitle: t(
        "縮めきった反例の配列は、長さいくつか",
        "How long is the fully shrunk counterexample?",
      ),
      summary: t(
        `シード${SEED}で性質ベーステストを流し、縮めきった反例の長さを答える。答えを入れると、反例が1回ずつ縮んでいく様子を図で追える。`,
        `Run a property-based test with seed ${SEED} and answer how long the fully shrunk counterexample is. Once you answer, you can follow the counterexample shrinking one step at a time.`,
      ),
      intro: [
        t(
          "「性質ベーステスト」で見た、重複を取り除く関数の誤った実装を使う。道具が乱数で作った入力で反例を見つけ、それを縮めきったときの配列の長さを答える問題である。",
          'This uses the buggy "remove duplicates" function from "Property-based testing". The tool finds a counterexample among random inputs, and you answer how long the array is once it is fully shrunk.',
        ),
        t(
          "図はまず性質・生成器・縮め方の決まりだけを見せ、見つかった反例は答えるまで出さない。下の「答え合わせ」に数を入れると、対象の関数のカードに入力と出力が出て、縮小器のカードで配列が1回ずつ短くなっていく。",
          'The diagram first shows only the property, the generator and the shrinking rules, and keeps the counterexample hidden until you answer. When you enter a number under "Check your answer", the function card shows each input and output, and the shrinker card shows the array getting shorter one step at a time.',
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t(
            "重複を取り除く関数（誤った実装）",
            'Buggy "remove duplicates" function',
          ),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("数（半角数字）", "A number (digits)"),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t("性質ベーステスト", '"Property-based testing"'),
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
            rows: { [t("実装", "impl")]: t("隣どうしだけ見る", "neighbours only") },
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
      answerType: "number",
      answerLabel: t("あなたの答え（要素の数）", "Your answer (elements)"),
      hint: t(
        "縮めきった反例の長さ（要素の数）を入れる。入れると、図に縮める様子が足される。",
        "Enter the length (number of elements) of the fully shrunk counterexample. The shrinking is then added to the diagram.",
      ),
      verdictActor: "shrinker",
      setupSteps: setupSteps(),
      solve: () => {
        const result = RESULT();
        if (!result.failing || !result.shrunk) {
          return {
            answer: 0,
            reason: t("反例が見つからなかった。", "No counterexample was found."),
          };
        }
        return {
          answer: result.shrunk.length,
          reason: t(
            `${result.runs}回目の入力${formatArray(result.failing)}で破れ、縮めきると${formatArray(result.shrunk)}になる。出力は${formatArray(removeAdjacentDuplicates(result.shrunk))}で重複が残る。これより要素を減らすと、隣どうしでない重複が作れない。`,
            `It breaks on run ${result.runs} with input ${formatArray(result.failing)}, and shrinks to ${formatArray(result.shrunk)}. The output is ${formatArray(removeAdjacentDuplicates(result.shrunk))}, which still has a duplicate. With fewer elements you cannot have a duplicate that is not adjacent.`,
          ),
        };
      },
      solutionSteps: () => solutionSteps(),
    },
    language,
  );
}
