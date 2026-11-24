import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { checkLaw, explore, failuresRefines, traceRefines } from "../csp";
import {
  CAPACITY,
  collapseTopValue,
  DATA_ENV,
  dedupFilter,
  fifoPair,
  fifoSpec,
  FILTER_MEMORY,
  stackBuffer,
  uniqueSpec,
} from "../cspDataIndependence";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

const COUNTS = [1, 2, 3] as const;
const STACK = COUNTS.map((count) =>
  traceRefines(fifoSpec(count), stackBuffer(count), DATA_ENV),
);
const STACK_STATES = COUNTS.map(
  (count) => explore(stackBuffer(count), DATA_ENV).stateCount,
);
const FIFO_HOLDS = COUNTS.map(
  (count) => failuresRefines(fifoSpec(count), fifoPair(count), DATA_ENV).holds,
);
const [STACK_ONE, STACK_TWO, STACK_THREE] = STACK as [
  (typeof STACK)[0],
  (typeof STACK)[0],
  (typeof STACK)[0],
];
const SAME_COUNTEREXAMPLE =
  JSON.stringify(STACK_TWO.counterexample) ===
  JSON.stringify(STACK_THREE.counterexample);
const STACK_COLLAPSE = checkLaw(
  collapseTopValue(stackBuffer(3), 3),
  stackBuffer(2),
  DATA_ENV,
);
const FILTER_TWO = traceRefines(uniqueSpec(2), dedupFilter(FILTER_MEMORY, 2), DATA_ENV);
const FILTER_THREE = traceRefines(
  uniqueSpec(3),
  dedupFilter(FILTER_MEMORY, 3),
  DATA_ENV,
);
const FILTER_COLLAPSED = collapseTopValue(dedupFilter(FILTER_MEMORY, 3), 3);
const FILTER_COLLAPSE_SAME = checkLaw(
  FILTER_COLLAPSED,
  dedupFilter(FILTER_MEMORY, 2),
  DATA_ENV,
).traces;
const FILTER_COLLAPSE_BREAKS = !traceRefines(uniqueSpec(2), FILTER_COLLAPSED, DATA_ENV)
  .holds;
const MEMORIES = [1, 2, 3] as const;
const MAX_COUNT = 4;
// 覚える数ごとに、仕様を破る最も少ない値の種類（値1〜MAX_COUNT で破れなければ null）。
const FIRST_BREAKING = MEMORIES.map((memory) => {
  for (let count = 1; count <= MAX_COUNT; count += 1)
    if (!traceRefines(uniqueSpec(count), dedupFilter(memory, count), DATA_ENV).holds)
      return count;
  return null;
});

function listText(events: string[], language: Language): string {
  if (events.length === 0) return language === "ja" ? "⟨⟩（空）" : "⟨⟩ (empty)";
  return `⟨${events.join(", ")}⟩`;
}

function parseCount(text: string | undefined, fallback: number, max: number): number {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, 1), max);
}

export function cspDataIndependenceLesson(language: Language): Lesson {
  const t = translator(language);
  const holdsText = (holds: boolean) =>
    holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
  const countRow = t("値の種類", "values");
  const resultRow = t("結果", "result");
  const valuesText = (count: number) =>
    count === 1
      ? t("1つ（0だけ）", "1 (only 0)")
      : t(`${count}つ（0〜${count - 1}）`, `${count} (0-${count - 1})`);
  const stackResult = (index: number) => {
    const result = STACK[index]!;
    return result.holds
      ? t("⊑T 成り立つ", "⊑T holds")
      : listText(result.counterexample ?? [], language);
  };
  return {
    id: "csp-data-independence",
    category: "protocol",
    title: t("データ独立性", "Data independence"),
    subtitle: t(
      "値の種類を小さくしても、結論が変わらないわけ",
      "Why shrinking the set of values need not change the answer",
    ),
    summary: t(
      `値を比べないスタックは、受け取った順に渡す仕様を破るが、値1つで調べると見逃し、値2つでも3つでも同じ反例 ${listText(STACK_TWO.counterexample ?? [], language)} が見つかる。直近${FILTER_MEMORY}つを覚えて重複を捨てる仕組みは値を比べるので、値2つでは仕様との ⊑T が${holdsText(FILTER_TWO.holds)}が、値3つで忘れた値をもう一度渡す。`,
      `A stack, which never compares values, slips past a spec that passes values on in order with one value, and breaks it with the same counterexample ${listText(STACK_TWO.counterexample ?? [], language)} with two values and with three. A filter that remembers the last ${FILTER_MEMORY} values and drops repeats compares values: with two values the spec ${holdsText(FILTER_TWO.holds)}, but with three it passes on a forgotten value a second time.`,
    ),
    intro: [
      t(
        "データ独立性（data independence）は、値を受け取って溜めて渡すだけで、値に計算を施さないプロセスの性質である（値どうしが等しいかを比べることだけは許す）。値どうしを比べもしないプロセスなら、値が0と1の2種類でも、0〜999の千種類でも、振る舞いの形は同じになる。だから小さい値の集まりで調べた結論を、大きい集まりに持ち越せる。ただし少なすぎると誤りを見逃すので、何種類あれば足りるかを見極める。",
        "Data independence is the property of a process that only takes values in, stores them and passes them on, without computing on them (testing whether two values are equal is the one thing allowed). If a process does not even compare values, the shape of its behaviour is the same whether there are two values, 0 and 1, or a thousand, 0 to 999. So a conclusion checked with a small set of values carries over to a large one. But too few values can miss an error, so you need to know how many are enough.",
      ),
      t(
        "モデル検査は値の種類が増えるほど状態が増え、テストも全部の値は試せない。何種類の値で調べれば十分かが分かれば、小さいモデルの全探索で、どの値でも成り立つと言える。ただし値を比べたり、値で分岐したりするプロセスでは、必要な種類の数が増える。",
        "Model checking gets more states as the number of values grows, and tests cannot try every value either. If we know how many values are enough, an exhaustive search of a small model tells us the result holds for any values. But for a process that compares values or branches on them, the number needed goes up.",
      ),
      t(
        "図では、上の段の「値の種類」を1つ・2つ・3つと増やしながら、検査器の結果が変わるかを見る。前半は値を比べないスタック、後半は値を比べる重複よけである。",
        'In the diagram, raise "values" in the top row from one to two to three and see whether the checker\'s result changes. The first half uses a stack that never compares values; the second half a repeat filter that does.',
      ),
    ],
    facts: [
      {
        label: t("スタックと仕様（⊑T）", "Stack vs spec (⊑T)"),
        value: t(
          `値1つ: ${stackResult(0)}、値2つ: ${stackResult(1)}、値3つ: ${stackResult(2)}`,
          `1 value: ${stackResult(0)}; 2: ${stackResult(1)}; 3: ${stackResult(2)}`,
        ),
      },
      {
        label: t("スタックの状態", "Stack states"),
        value: t(
          `値1つ: ${STACK_STATES[0]}、値2つ: ${STACK_STATES[1]}、値3つ: ${STACK_STATES[2]}`,
          `1 value: ${STACK_STATES[0]}; 2: ${STACK_STATES[1]}; 3: ${STACK_STATES[2]}`,
        ),
      },
      {
        label: t(
          `重複よけ（${FILTER_MEMORY}つ覚える）と仕様（⊑T）`,
          `Repeat filter (remembers ${FILTER_MEMORY}) vs spec (⊑T)`,
        ),
        value: t(
          `値2つ: ${holdsText(FILTER_TWO.holds)}、値3つ: ${FILTER_THREE.holds ? holdsText(true) : listText(FILTER_THREE.counterexample ?? [], language)}`,
          `2 values: ${holdsText(FILTER_TWO.holds)}; 3: ${FILTER_THREE.holds ? holdsText(true) : listText(FILTER_THREE.counterexample ?? [], language)}`,
        ),
        tone: FILTER_THREE.holds ? "ok" : "bad",
      },
      {
        label: t("参考", "Reference"),
        value: t(
          `${TPC_BOOK} 15.3節（データ独立性）`,
          `${TPC_BOOK_EN}, §15.3 (data independence)`,
        ),
      },
    ],
    actors: [
      {
        id: "values",
        label: t("値の種類", "Values"),
        sublabel: t("0 から順に", "counted from 0"),
        icon: "variable",
        x: 14,
        y: 27,
        initial: { rows: { [countRow]: valuesText(1) } },
      },
      {
        id: "stack",
        label: t("スタック", "Stack"),
        sublabel: t(
          `${CAPACITY}つ溜め、後から出す`,
          `holds ${CAPACITY}, last out first`,
        ),
        icon: "queue",
        x: 50,
        y: 27,
      },
      {
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: t("受け取った順に渡す", "passes on in order"),
        icon: "spec",
        x: 86,
        y: 27,
      },
      {
        id: "filter",
        label: t("重複よけ", "Repeat filter"),
        sublabel: t(
          `直近${FILTER_MEMORY}つを覚える`,
          `remembers the last ${FILTER_MEMORY}`,
        ),
        icon: "process",
        x: 50,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("値の種類ごとに調べる", "checks per value set"),
        icon: "checker",
        x: 86,
        y: 73,
      },
    ],
    links: [
      { from: "values", to: "stack" },
      { from: "stack", to: "spec" },
      { from: "values", to: "filter" },
      { from: "spec", to: "checker" },
    ],
    steps: [
      {
        id: "carry",
        kind: "spec",
        title: t("値を運ぶだけ", "Only carrying values"),
        actor: "stack",
        to: ["spec"],
        summary: t(
          `スタックは${CAPACITY}つまで受け取り、後に入れたものから出す。値を比べないし、値で分岐もしない`,
          `The stack takes up to ${CAPACITY} values and outputs the last one in first. It never compares values or branches on them`,
        ),
        explain: t(
          "仕様は、受け取った順に渡す容量2のバッファ。スタックは出す順が逆なので、仕様を満たさないはずである。どちらも値をただ溜めて渡すだけで、値がいくつであるかによって動きを変えない。",
          "The spec is a buffer of capacity 2 that passes values on in the order received. The stack outputs in the reverse order, so it should not meet the spec. Both only store and pass values, and neither acts differently depending on what a value is.",
        ),
        set: {
          stack: {
            rows: {
              [t("出す順", "order out")]: t("後に入れた順", "last in, first out"),
              [t("値を比べる", "compares values")]: t("しない", "no"),
            },
          },
          spec: {
            rows: { [t("出す順", "order out")]: t("受け取った順", "as received") },
          },
        },
      },
      {
        id: "one-value",
        kind: "explore",
        title: t("値1つでは見逃す", "One value misses it"),
        actor: "checker",
        to: ["stack"],
        summary: t(
          `値が0だけだと、スタックと仕様の ⊑T が${holdsText(STACK_ONE.holds)}（${STACK_STATES[0]}状態）`,
          `With only the value 0, the stack ${STACK_ONE.holds ? "meets" : "breaks"} the spec under ⊑T (${STACK_STATES[0]} states)`,
        ),
        explain: t(
          "値が1種類しかないと、出す順を入れ替えても出てくるのは同じ0の並びなので、順の違いが外から見えない。値の種類を小さくしすぎると、こうして誤りを見逃す。この仕様は値の中身（出す順）を気にするので、値1つで足りる場合には当たらない。",
          "With only one value, swapping the order still produces the same row of 0s, so the difference in order is invisible from outside. Make the set of values too small and an error slips past like this. This spec cares about the values themselves (their order), so it is not a case where one value is enough.",
        ),
        set: {
          values: { tone: "wait", rows: { [countRow]: valuesText(1) } },
          checker: {
            tone: STACK_ONE.holds ? "wait" : "bad",
            rows: { [countRow]: "1", [resultRow]: stackResult(0) },
          },
        },
      },
      {
        id: "two-values",
        kind: "found",
        title: t("値2つで見つかる", "Two values find it"),
        actor: "checker",
        to: ["stack"],
        summary: t(
          `値が0と1なら、${listText(STACK_TWO.counterexample ?? [], language)} で仕様を破る（${STACK_STATES[1]}状態）`,
          `With 0 and 1, it breaks the spec with ${listText(STACK_TWO.counterexample ?? [], language)} (${STACK_STATES[1]} states)`,
        ),
        explain: t(
          "0を入れてから1を入れると、スタックは後の1を先に出す。仕様はこの時点で先の0しか出さないので、仕様に無いトレースになる。違う値が2つあれば、順の入れ替えが見える。",
          "Put in 0 and then 1, and the stack outputs the later 1 first. At that point the spec would output only the earlier 0, so the trace is not one the spec has. With two different values, a swap in order becomes visible.",
        ),
        set: {
          values: { rows: { [countRow]: valuesText(2) } },
          stack: { tone: "bad" },
          checker: {
            tone: STACK_TWO.holds ? "ok" : "bad",
            rows: { [countRow]: "2", [resultRow]: stackResult(1) },
          },
        },
      },
      {
        id: "three-values",
        kind: "found",
        title: t("値3つでも同じ", "Three give the same"),
        actor: "checker",
        to: ["stack"],
        summary: t(
          `値を3つにしても、反例は${SAME_COUNTEREXAMPLE ? "同じ" : "違う"} ${listText(STACK_THREE.counterexample ?? [], language)}。状態は${STACK_STATES[1]}から${STACK_STATES[2]}に増える`,
          `With three values the counterexample is ${SAME_COUNTEREXAMPLE ? "the same" : "different"}, ${listText(STACK_THREE.counterexample ?? [], language)}. States grow from ${STACK_STATES[1]} to ${STACK_STATES[2]}`,
        ),
        explain: t(
          `値を増やすと調べる状態は増えるが、結論は変わらない。受け取った順に渡す正しいセル2つの列も、値1つ・2つ・3つのどれで調べても仕様との ⊑F が${holdsText(FIFO_HOLDS.every(Boolean))}。`,
          `More values mean more states to check, but the conclusion does not change. A correct pair of cells that passes values on in order also ${FIFO_HOLDS.every(Boolean) ? "meets" : "fails"} the spec under ⊑F whether checked with one, two or three values.`,
        ),
        set: {
          values: { rows: { [countRow]: valuesText(3) } },
          checker: {
            rows: {
              [countRow]: "3",
              [resultRow]: stackResult(2),
              [t("正しいセルの列", "correct cells")]: holdsText(
                FIFO_HOLDS.every(Boolean),
              ),
            },
          },
        },
      },
      {
        id: "why",
        kind: "spec",
        title: t("なぜ同じになるか", "Why they agree"),
        actor: "values",
        to: ["stack"],
        summary: t(
          `3つ目の値2を1に読み替えると、値3つのスタックは値2つのスタックと${STACK_COLLAPSE.failuresDivergences ? "区別できない" : "区別できる"}`,
          `Reading the third value, 2, as 1 makes the three-value stack ${STACK_COLLAPSE.failuresDivergences ? "indistinguishable from" : "distinguishable from"} the two-value one`,
        ),
        explain: t(
          `スタックは値を見て動きを変えないので、名前の付け替えで値2を1に写しても、値2つのスタックと同じ振る舞いになる（⊑FD が両向きに${holdsText(STACK_COLLAPSE.failuresDivergences)}）。値を比べないので、値3つの実行は、写し方をうまく選べば値2つの実行として読める（反例なら、反例に関わる2つの値を残して写す）。仕様も値を比べないなら、値2つで調べた結論がそれより多いどの値でも同じになる。`,
          `The stack never acts on what a value is, so renaming 2 to 1 gives the same behaviour as the two-value stack (⊑FD ${holdsText(STACK_COLLAPSE.failuresDivergences)} both ways). Because it never compares values, a three-value run can be read as a two-value run if the mapping is chosen well (for a counterexample, keep the two values it depends on apart). If the spec does not compare values either, the conclusion checked with two values is the same for any larger number.`,
        ),
        simplified: t(
          "本の定理には、仕様の形についての条件（隠蔽や名前の付け替えを使わず、どの枝に進んだかが次のイベントで分かること）もある。ここの仕様はそれを満たすが、説明では省いた。",
          "The theorem in the book also has a condition on the form of the spec (no hiding or renaming, and the next event tells which branch was taken). The spec here meets it, but the explanation leaves it out.",
        ),
        set: {
          values: { tone: "ok", rows: { [countRow]: t("2を1に写す", "map 2 to 1") } },
          stack: {
            tone: "idle",
            rows: {
              [t("写した後", "after mapping")]: t(
                `値2つと${STACK_COLLAPSE.failuresDivergences ? "等しい" : "違う"}`,
                STACK_COLLAPSE.failuresDivergences ? "same as two" : "differs from two",
              ),
            },
          },
        },
      },
      {
        id: "filter",
        kind: "spec",
        title: t("値を比べる重複よけ", "A filter compares values"),
        actor: "filter",
        to: ["spec"],
        summary: t(
          `重複よけは直近に渡した値を${FILTER_MEMORY}つまで覚え、覚えている値が来たら捨てる。仕様は「どの値も高々1回しか渡さない」`,
          `The filter remembers up to the last ${FILTER_MEMORY} values it passed on and drops any value it remembers. The spec: never pass on the same value twice`,
        ),
        explain: t(
          `同じ通知を何度も送らないよう、最近送った分だけを覚えておく仕組みを想定した。新しい値は渡して覚え、あふれたら最も古いものを忘れる。来た値を覚えている値と比べ、その結果で分岐するので、値2つで足りるという条件から外れる。値が2つだけなら両方とも覚えておけるので、仕様との ⊑T が${holdsText(FILTER_TWO.holds)}。`,
          `Picture a mechanism that avoids sending the same notification twice by remembering only what it sent recently. A new value is passed on and remembered, and the oldest is forgotten when memory is full. It compares each value with the remembered ones and branches on the result, so it falls outside the condition under which two values are enough. With only two values it can remember both, so the spec ${holdsText(FILTER_TWO.holds)}.`,
        ),
        set: {
          filter: {
            isHidden: false,
            rows: { [t("値を比べる", "compares values")]: t("する", "yes") },
          },
          spec: {
            rows: {
              [t("出す順", "order out")]: null,
              [t("同じ値", "same value")]: t("高々1回", "at most once"),
            },
          },
          values: { tone: "idle", rows: { [countRow]: valuesText(2) } },
          checker: {
            tone: FILTER_TWO.holds ? "ok" : "bad",
            rows: {
              [countRow]: "2",
              [resultRow]: t(
                `⊑T ${holdsText(FILTER_TWO.holds)}`,
                `⊑T ${holdsText(FILTER_TWO.holds)}`,
              ),
              [t("正しいセルの列", "correct cells")]: null,
            },
          },
        },
      },
      {
        id: "filter-three",
        kind: "found",
        title: t("値3つで2回渡す", "Three values, passed twice"),
        actor: "checker",
        to: ["filter"],
        summary: t(
          `値が3つになると、${listText(FILTER_THREE.counterexample ?? [], language)} で同じ値を2回渡す`,
          `With three values, ${listText(FILTER_THREE.counterexample ?? [], language)} passes the same value on twice`,
        ),
        explain: t(
          `3つの違う値を渡すと、覚えていられるのは後の${FILTER_MEMORY}つだけで、最初の値を忘れる。次に最初の値が来ると新しい値として渡してしまう。値2を1に写したものは値2つの重複よけと${FILTER_COLLAPSE_SAME ? "区別できない" : "区別でき"}、仕様も${FILTER_COLLAPSE_BREAKS ? "破る" : "破らない"}。値を比べるプロセスでは、値2つで調べた結論を持ち越せるとは限らない。`,
          `After three different values, only the last ${FILTER_MEMORY} are remembered and the first is forgotten. When the first value comes again, it is passed on as new. The version with 2 mapped to 1 ${FILTER_COLLAPSE_SAME ? "cannot be told apart from" : "can be told apart from"} the two-value filter and ${FILTER_COLLAPSE_BREAKS ? "breaks" : "meets"} the spec. For a process that compares values, a conclusion checked with two values does not necessarily carry over.`,
        ),
        set: {
          values: { tone: "bad", rows: { [countRow]: valuesText(3) } },
          filter: {
            tone: "bad",
            rows: {
              [t("覚えている", "remembers")]: (FILTER_THREE.counterexample ?? [])
                .filter((event) => event.startsWith("out."))
                .slice(-1 - FILTER_MEMORY, -1)
                .map((event) => event.split(".")[1])
                .join(", "),
            },
          },
          checker: {
            tone: FILTER_THREE.holds ? "ok" : "bad",
            rows: {
              [countRow]: "3",
              [resultRow]: t(
                `⊑T ${holdsText(FILTER_THREE.holds)}`,
                `⊑T ${holdsText(FILTER_THREE.holds)}`,
              ),
            },
          },
        },
        simplified: t(
          "本では、等しいときにだけ先へ進む比較なら、値を比べても多くの結果がそのまま保たれるとしている。この重複よけは等しくないときに値を渡すので、それには当たらない。",
          "The book notes that comparisons which only let the process go on when values are equal keep many of these results. This filter passes a value on when it is not equal, so it is not such a case.",
        ),
      },
      {
        id: "threshold",
        kind: "fix",
        title: t("必要な数を見積もる", "Estimate how many"),
        actor: "checker",
        to: ["values"],
        summary: t(
          `覚える数を1・2・3にすると、仕様を破る最も少ない値の種類は${FIRST_BREAKING.map((count) => count ?? "なし").join("・")}`,
          `Remembering 1, 2 or 3 values, the fewest values that break the spec are ${FIRST_BREAKING.map((count) => count ?? "none").join(", ")}`,
        ),
        explain: t(
          "値を忘れさせるには、覚えておける数より多い種類の値が要る。だから覚える数が増えると、調べるのに要る値の種類も増える。値を比べるときは、値2つで済ませず、覚える値の数と比べ方から必要な数を見積もってから調べる。見積もりの条件は本の15.3節にある。",
          "To make the filter forget a value takes more kinds of value than it can remember. So the more it remembers, the more values the check needs. When values are compared, do not settle for two; estimate the number needed from how many values are kept and how they are compared, then check. The conditions for the estimate are in §15.3 of the book.",
        ),
        set: {
          values: {
            tone: "ok",
            rows: { [countRow]: t("覚える数+1", "memory + 1") },
          },
          filter: { tone: "idle" },
        },
        simplified: t(
          `見積もりの数は、このページでは式から計算していない（覚える数1〜3・値1〜${MAX_COUNT}で実際に調べた結果だけを示している）。本では、仕様が値をどう使うか・値をいくつ覚えるか・1回に何個の値を受け取るかから、足りる数を求める条件を述べている。`,
          `This page does not compute the estimate from a formula; it only shows results actually checked with memory 1 to 3 and 1 to ${MAX_COUNT} values. The book gives conditions for finding a sufficient number from how the spec uses values, how many values are kept, and how many are taken in one event.`,
        ),
      },
    ],
    lab: {
      title: t("値の種類を変える", "Change the number of values"),
      hint: t(
        "値の種類（1〜4）と、重複よけが覚える数（1〜3）を入れる。スタックは値2つ以上で同じ反例になり、重複よけは値の種類が覚える数より多いと破れる。",
        "Enter the number of values (1-4) and how many the filter remembers (1-3). The stack gives the same counterexample from two values upwards, and the filter fails once there are more values than it remembers.",
      ),
      inputs: [
        { id: "count", label: t("値の種類", "Values"), initial: "2" },
        {
          id: "memory",
          label: t("覚える数", "Memory"),
          initial: String(FILTER_MEMORY),
        },
      ],
      compute: (values): Field[] => {
        const count = parseCount(values.count, 2, 4);
        const stack = traceRefines(fifoSpec(count), stackBuffer(count), DATA_ENV);
        const cells = failuresRefines(fifoSpec(count), fifoPair(count), DATA_ENV);
        const memory = parseCount(values.memory, FILTER_MEMORY, 3);
        const filter = traceRefines(
          uniqueSpec(count),
          dedupFilter(memory, count),
          DATA_ENV,
        );
        return [
          {
            label: t("スタック ⊑T", "Stack ⊑T"),
            value: stack.holds
              ? holdsText(true)
              : t(
                  `${holdsText(false)}（${listText(stack.counterexample ?? [], language)}）`,
                  `${holdsText(false)} (${listText(stack.counterexample ?? [], language)})`,
                ),
            tone: stack.holds ? "ok" : "bad",
          },
          {
            label: t("正しいセルの列 ⊑F", "Correct cells ⊑F"),
            value: holdsText(cells.holds),
            tone: cells.holds ? "ok" : "bad",
          },
          {
            label: t("重複よけ ⊑T", "Filter ⊑T"),
            value: filter.holds
              ? holdsText(true)
              : t(
                  `${holdsText(false)}（${listText(filter.counterexample ?? [], language)}）`,
                  `${holdsText(false)} (${listText(filter.counterexample ?? [], language)})`,
                ),
            tone: filter.holds ? "ok" : "bad",
          },
          {
            label: t("スタックの状態", "Stack states"),
            value: String(explore(stackBuffer(count), DATA_ENV).stateCount),
          },
        ];
      },
    },
  };
}
