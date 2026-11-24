import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { explore, failuresRefines, TAU, traceRefines } from "../csp";
import { bufferSpec, cellChain, PIPE_ENV, SAMPLE_RUN } from "../cspPipes";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

const CAPACITY = 2;
const SPEC = bufferSpec(CAPACITY);
const PAIR = cellChain(2);
// 2つのセルと、2要素のバッファの仕様が、失敗で等しいか（両向きの ⊑F）。
const PAIR_REFINES = failuresRefines(SPEC, PAIR, PIPE_ENV).holds;
const SPEC_REFINES_PAIR = failuresRefines(PAIR, SPEC, PIPE_ENV).holds;
const SINGLE = failuresRefines(SPEC, cellChain(1), PIPE_ENV);
const TRIPLE = traceRefines(SPEC, cellChain(3), PIPE_ENV);
const PAIR_LTS = explore(PAIR, PIPE_ENV);
const HIDDEN_MOVES = PAIR_LTS.edges.filter((edge) => edge.ev === TAU).length;
const [IN_FIRST, LINK_MOVE, IN_SECOND, OUT_FIRST] = SAMPLE_RUN as [
  string,
  string,
  string,
  string,
];
const LINK_CHANNEL = LINK_MOVE.split(".")[0]!;

function listText(events: string[], language: Language): string {
  if (events.length === 0) return language === "ja" ? "⟨⟩（空）" : "⟨⟩ (empty)";
  return `⟨${events.join(", ")}⟩`;
}

function parseCount(text: string | undefined, fallback: number, max: number): number {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, 1), max);
}

export function cspPipesLesson(language: Language): Lesson {
  const t = translator(language);
  const holdsText = (holds: boolean) =>
    holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
  const valueRow = t("溜めている値", "holding");
  return {
    id: "csp-pipes",
    category: "csp",
    title: t("名前を付け替えてつなぐ", "Linking by renaming"),
    subtitle: t(
      "1つだけ溜めるセルを並べて、バッファを作る",
      "Chain one-place cells into a buffer",
    ),
    summary: t(
      `1つだけ溜めるセルの出口と入口を同じ名前 ${LINK_CHANNEL} に付け替えて並べ、${LINK_CHANNEL} を隠すと、2つ溜められるバッファになる。2要素のバッファの仕様とは両向きの失敗詳細化で${PAIR_REFINES && SPEC_REFINES_PAIR ? "等しい" : "等しくない"}。セル1つは2つ目の入力を断り、セル3つは溜めすぎて仕様を破る。`,
      `Rename the exit of one one-place cell and the entrance of another to the same name, ${LINK_CHANNEL}, put them side by side and hide ${LINK_CHANNEL}: you get a buffer that holds two. Against the two-place buffer spec, failures refinement both ways ${PAIR_REFINES && SPEC_REFINES_PAIR ? "holds, so they are equal" : "does not hold"}. One cell refuses the second input; three cells hold too many and break the spec.`,
    ),
    intro: [
      t(
        "名前の付け替え（renaming）は、プロセスのイベントの名前を書き換える演算子である。同じ部品を何個も使うとき、部品ごとに定義を書き直さず、つなぐ所の名前だけを付け替えて並べられる。",
        "Renaming is an operator that rewrites the names of a process's events. When you use the same component many times, you do not rewrite its definition for each copy; you rename only the points where they connect and put them side by side.",
      ),
      t(
        "ここでは、値を1つだけ受け取って渡すセルを2つつなぐ。1つ目の出口と2つ目の入口を同じ名前にして同期させ、その間を隠すと、外からは入口と出口だけを持つ1つのバッファに見える。キューを書かずに部品の組み合わせでバッファを作れるかを、仕様と比べて確かめる。",
        "Here two cells that each take one value and pass it on are linked. The first cell's exit and the second's entrance get the same name and synchronise, and hiding the link makes the pair look from outside like one buffer with just an entrance and an exit. We check against a spec whether a buffer can be built from components, without writing a queue.",
      ),
      t(
        "図では、上の段のセルのカードにある「溜めている値」が、入力・受け渡し・出力のたびにどう動くかを追う。最後の3つのステップで、セルの数を2から1や3に変えると、仕様のどこを破るかを比べる。",
        `In the diagram, follow how "holding" on the cell cards in the top row changes with each input, hand-over and output. In the last three steps, compare where the spec breaks when the number of cells changes from two to one or three.`,
      ),
    ],
    facts: [
      {
        label: t("2つのセルと仕様", "Two cells vs spec"),
        value: t(
          `⊑F は両向きとも${holdsText(PAIR_REFINES && SPEC_REFINES_PAIR)}`,
          `⊑F both ways ${holdsText(PAIR_REFINES && SPEC_REFINES_PAIR)}`,
        ),
        tone: PAIR_REFINES && SPEC_REFINES_PAIR ? "ok" : "bad",
      },
      {
        label: t("つないだバッファの状態", "States of the chain"),
        value: t(
          `${PAIR_LTS.stateCount}状態（隠した動き${HIDDEN_MOVES}本）`,
          `${PAIR_LTS.stateCount} states (${HIDDEN_MOVES} hidden moves)`,
        ),
      },
      {
        label: t("参考", "Reference"),
        value: t(
          `${TPC_BOOK} 3.2節（名前の付け替え）・4.1節（パイプ）・5.1節（パイプとバッファ）`,
          `${TPC_BOOK_EN}, §3.2 (renaming), §4.1 (piping), §5.1 (pipes and buffers)`,
        ),
      },
    ],
    actors: [
      {
        id: "cell1",
        label: t("セル1", "Cell 1"),
        sublabel: t("1つだけ溜める", "holds one"),
        icon: "queue",
        x: 20,
        y: 27,
      },
      {
        id: "link",
        label: LINK_CHANNEL,
        sublabel: t("つなぐ名前", "linking name"),
        icon: "network",
        x: 50,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "cell2",
        label: t("セル2", "Cell 2"),
        sublabel: t("1つだけ溜める", "holds one"),
        icon: "queue",
        x: 80,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: t(`${CAPACITY}要素のバッファ`, `${CAPACITY}-place buffer`),
        icon: "spec",
        x: 30,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("詳細化を調べる", "checks refinement"),
        icon: "checker",
        x: 70,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "cell1", to: "link" },
      { from: "link", to: "cell2" },
      { from: "spec", to: "checker" },
    ],
    steps: [
      {
        id: "cell",
        kind: "spec",
        title: t("1つだけ溜めるセル", "A one-place cell"),
        actor: "cell1",
        summary: t(
          "in.x で値を受け取り、out.x で渡してから、次を受け取る",
          "Take a value on in.x, pass it on out.x, then take the next",
        ),
        explain: t(
          "セルは in.x を受け取ると、同じ値を out.x で渡すまで次を受け取らない。溜められるのは1つだけで、値（0 か 1）が何でも同じ動きをする。",
          "After taking in.x, the cell takes nothing more until it has passed the same value on out.x. It holds only one, and behaves the same whatever the value (0 or 1).",
        ),
        set: {
          cell1: {
            rows: {
              [t("定義", "definition")]: "in.x → out.x",
              [valueRow]: t("なし", "none"),
            },
          },
        },
      },
      {
        id: "rename",
        kind: "spec",
        title: t("名前を付け替える", "Rename the ends"),
        actor: "cell1",
        to: ["link", "cell2"],
        summary: t(
          `セル1の out と、セル2の in を ${LINK_CHANNEL} に付け替える`,
          `Rename cell 1's out and cell 2's in to ${LINK_CHANNEL}`,
        ),
        explain: t(
          `同じ定義のセルを2つ使い、1つ目は出口の out.x を ${LINK_CHANNEL}.x に、2つ目は入口の in.x を ${LINK_CHANNEL}.x に付け替える。定義は書き直さず、名前の表だけを渡す。`,
          `Use two cells with the same definition. In the first, rename the exit out.x to ${LINK_CHANNEL}.x; in the second, rename the entrance in.x to ${LINK_CHANNEL}.x. The definition is not rewritten; only a table of names is supplied.`,
        ),
        set: {
          link: { isHidden: false },
          cell2: {
            isHidden: false,
            rows: {
              [t("定義", "definition")]: `${LINK_CHANNEL}.x → out.x`,
              [valueRow]: t("なし", "none"),
            },
          },
          cell1: { rows: { [t("定義", "definition")]: `in.x → ${LINK_CHANNEL}.x` } },
        },
      },
      {
        id: "first-in",
        kind: "run",
        title: t(`${IN_FIRST} を受け取る`, `Take ${IN_FIRST}`),
        actor: "cell1",
        summary: t(
          `外から ${IN_FIRST} が来て、セル1が値を溜める`,
          `${IN_FIRST} arrives from outside and cell 1 holds the value`,
        ),
        explain: t(
          `${LINK_CHANNEL} は2つのセルが同期するイベントにしてある。入口の in はセル1だけが持つので、セル1が1人で受け取れる。`,
          `${LINK_CHANNEL} is made an event the two cells synchronise on. Only cell 1 has the entrance in, so it can take the input on its own.`,
        ),
        set: { cell1: { tone: "wait", rows: { [valueRow]: IN_FIRST.split(".")[1]! } } },
      },
      {
        id: "hand-over",
        kind: "run",
        title: t("隣へ受け渡す", "Hand it over"),
        actor: "cell1",
        to: ["link", "cell2"],
        summary: t(
          `${LINK_MOVE} で、セル1の値がセル2へ移る`,
          `On ${LINK_MOVE}, cell 1's value moves to cell 2`,
        ),
        explain: t(
          `セル1の出口とセル2の入口は同じ名前なので、${LINK_MOVE} は両方がそろって起きる。値はセル2に移り、セル1は空いて次を受け取れる。`,
          `Cell 1's exit and cell 2's entrance have the same name, so ${LINK_MOVE} happens with both together. The value moves to cell 2, and cell 1 is free to take the next.`,
        ),
        set: {
          link: { tone: "ok", rows: { [t("通った", "passed")]: LINK_MOVE } },
          cell1: { tone: "idle", rows: { [valueRow]: t("なし", "none") } },
          cell2: { tone: "wait", rows: { [valueRow]: LINK_MOVE.split(".")[1]! } },
        },
      },
      {
        id: "second-in",
        kind: "run",
        title: t("2つ溜まる", "Two are held"),
        actor: "cell1",
        summary: t(
          `${IN_SECOND} も受け取り、2つのセルで2つの値を溜める`,
          `It also takes ${IN_SECOND}, so the two cells hold two values`,
        ),
        explain: t(
          `セル1は空いたので ${IN_SECOND} を受け取れる。この時点で、セル2に先の値、セル1に後の値が並んで溜まっている。セル1つでは、ここで次の入力を受け取れなかった。`,
          `Cell 1 is free, so it takes ${IN_SECOND}. Now cell 2 holds the earlier value and cell 1 the later one, in a row. A single cell could not have taken this input.`,
        ),
        set: {
          cell1: { tone: "wait", rows: { [valueRow]: IN_SECOND.split(".")[1]! } },
        },
      },
      {
        id: "first-out",
        kind: "run",
        title: t("先の値から出る", "First in, first out"),
        actor: "cell2",
        summary: t(
          `${OUT_FIRST} で、先に入れた値がセル2から出る`,
          `On ${OUT_FIRST}, the value put in first leaves cell 2`,
        ),
        explain: t(
          `出口の out はセル2だけが持つので、先に入れた値が ${OUT_FIRST} で先に出る。受け取った順に渡すバッファの動きになっている。`,
          `Only cell 2 has the exit out, so the value put in first comes out first, on ${OUT_FIRST}. This is how a buffer that passes values on in the order received behaves.`,
        ),
        set: { cell2: { tone: "ok", rows: { [valueRow]: t("なし", "none") } } },
      },
      {
        id: "hide",
        kind: "spec",
        title: t("間を隠す", "Hide the link"),
        actor: "link",
        summary: t(
          `${LINK_CHANNEL} を隠すと、外から見えるのは in と out だけになる`,
          `Hiding ${LINK_CHANNEL} leaves only in and out visible from outside`,
        ),
        explain: t(
          `${LINK_CHANNEL} の受け渡しを隠蔽すると、外からは見えない動き（τ）になる。つないだ全体は${PAIR_LTS.stateCount}状態で、そのうち隠した動きが${HIDDEN_MOVES}本ある。これを1つのバッファとして仕様と比べる。`,
          `Hiding the hand-over on ${LINK_CHANNEL} turns it into a move invisible from outside (τ). The whole chain has ${PAIR_LTS.stateCount} states, with ${HIDDEN_MOVES} hidden moves. We now compare it with a spec as a single buffer.`,
        ),
        set: {
          link: {
            tone: "idle",
            rows: { [t("通った", "passed")]: t("τ（隠した）", "τ (hidden)") },
          },
          cell1: { tone: "idle", rows: { [valueRow]: t("なし", "none") } },
          cell2: { tone: "idle", rows: { [valueRow]: t("なし", "none") } },
        },
      },
      {
        id: "compare",
        kind: "fix",
        title: t("仕様と等しい", "Equal to the spec"),
        actor: "checker",
        to: ["spec"],
        summary: t(
          `${CAPACITY}要素のバッファの仕様と、失敗詳細化を両向きに調べて${PAIR_REFINES && SPEC_REFINES_PAIR ? "どちらも成り立つ" : "成り立たない向きがある"}`,
          `Failures refinement against the ${CAPACITY}-place buffer spec ${PAIR_REFINES && SPEC_REFINES_PAIR ? "holds in both directions" : "fails in at least one direction"}`,
        ),
        explain: t(
          `仕様は「受け取った順に渡し、溜まっている数が${CAPACITY}より少ない間は入力を断らない」バッファで、キューの長さで書いた。実装（セル2つ）から仕様、仕様から実装の両向きで ⊑F が${holdsText(PAIR_REFINES && SPEC_REFINES_PAIR)}ので、2つは外から見て区別できない。`,
          `The spec is a buffer that passes values on in the order received and never refuses input while it holds fewer than ${CAPACITY}; it is written with the length of a queue. ⊑F ${holdsText(PAIR_REFINES && SPEC_REFINES_PAIR)} in both directions, implementation (two cells) against spec and spec against implementation, so the two cannot be told apart from outside.`,
        ),
        set: {
          spec: {
            isHidden: false,
            rows: {
              [t("溜められる数", "capacity")]: String(CAPACITY),
              [t("渡す順", "order")]: t("受け取った順", "as received"),
            },
          },
          checker: {
            isHidden: false,
            tone: PAIR_REFINES && SPEC_REFINES_PAIR ? "ok" : "bad",
            rows: {
              [t("仕様 ⊑F 実装", "spec ⊑F impl")]: holdsText(PAIR_REFINES),
              [t("実装 ⊑F 仕様", "impl ⊑F spec")]: holdsText(SPEC_REFINES_PAIR),
            },
          },
        },
      },
      {
        id: "one-cell",
        kind: "found",
        title: t("セル1つでは足りない", "One cell is not enough"),
        actor: "checker",
        to: ["spec"],
        summary: t(
          `セル1つは、${listText(SINGLE.counterexample?.trace ?? [], language)} の後に {${(SINGLE.counterexample?.refusal ?? []).join(", ")}} を断る`,
          `One cell refuses {${(SINGLE.counterexample?.refusal ?? []).join(", ")}} after ${listText(SINGLE.counterexample?.trace ?? [], language)}`,
        ),
        explain: t(
          `セルが1つだと、1つ受け取った後は渡すまで次を受け取れない。仕様はまだ${CAPACITY}つ目を受け取れる時点なので、入力を断る失敗が仕様に無く、⊑F が${holdsText(SINGLE.holds)}。トレースだけなら断ることは見えないので、⊑T では見分けられない。`,
          `With one cell, after taking one value it cannot take the next until it passes it on. At that point the spec can still take a ${CAPACITY === 2 ? "second" : "further"} one, so refusing input is a failure the spec does not have, and ⊑F ${holdsText(SINGLE.holds)}. Traces alone do not show refusals, so ⊑T cannot tell them apart.`,
        ),
        set: {
          checker: {
            tone: SINGLE.holds ? "ok" : "bad",
            rows: {
              [t("セルの数", "cells")]: "1",
              [t("結果", "result")]: t(
                `⊑F ${holdsText(SINGLE.holds)}`,
                `⊑F ${holdsText(SINGLE.holds)}`,
              ),
            },
          },
        },
      },
      {
        id: "three-cells",
        kind: "found",
        title: t("セル3つは溜めすぎ", "Three cells hold too many"),
        actor: "checker",
        to: ["spec"],
        summary: t(
          `セル3つは ${listText(TRIPLE.counterexample ?? [], language)} で、仕様に無いトレースになる`,
          `Three cells produce ${listText(TRIPLE.counterexample ?? [], language)}, a trace the spec does not have`,
        ),
        explain: t(
          `セルを3つつなぐと、出す前に3つまで受け取れる。仕様は${CAPACITY}つ溜まると入力を受け付けないので、3つ目の入力が仕様に無いトレースになり、⊑T の段階で${holdsText(TRIPLE.holds)}。`,
          `Linking three cells lets it take up to three before any output. The spec takes no input once it holds ${CAPACITY}, so the third input gives a trace the spec does not have, and refinement ${holdsText(TRIPLE.holds)} already at ⊑T.`,
        ),
        set: {
          checker: {
            rows: {
              [t("セルの数", "cells")]: "3",
              [t("結果", "result")]: t(
                `⊑T ${holdsText(TRIPLE.holds)}`,
                `⊑T ${holdsText(TRIPLE.holds)}`,
              ),
            },
          },
        },
        simplified: t(
          "流す値は 0 と 1 の2つだけにした。セルも仕様も値によって動きを変えないので、値の数を増やしても結論は変わらない（データ独立性）。",
          "Only two values, 0 and 1, are passed. Neither the cells nor the spec act differently depending on the value, so using more values would not change the conclusion (data independence).",
        ),
      },
    ],
    lab: {
      title: t("セルの数と容量を変える", "Change the cells and the capacity"),
      hint: t(
        "つなぐセルの数（1〜4）と、仕様のバッファの容量（1〜4）を入れる。セルの数と容量が同じときだけ、両向きの ⊑F が成り立つ。",
        "Enter the number of cells to link (1-4) and the capacity of the buffer spec (1-4). Failures refinement holds both ways only when the two are equal.",
      ),
      inputs: [
        { id: "cells", label: t("セルの数", "Cells"), initial: "2" },
        {
          id: "capacity",
          label: t("仕様の容量", "Spec capacity"),
          initial: String(CAPACITY),
        },
      ],
      compute: (values): Field[] => {
        const cells = parseCount(values.cells, 2, 4);
        const capacity = parseCount(values.capacity, CAPACITY, 4);
        const chain = cellChain(cells);
        const spec = bufferSpec(capacity);
        const forward = failuresRefines(spec, chain, PIPE_ENV);
        const backward = failuresRefines(chain, spec, PIPE_ENV);
        const fields: Field[] = [
          {
            label: t("仕様 ⊑F セルの列", "spec ⊑F cells"),
            value: holdsText(forward.holds),
            tone: forward.holds ? "ok" : "bad",
          },
          {
            label: t("セルの列 ⊑F 仕様", "cells ⊑F spec"),
            value: holdsText(backward.holds),
            tone: backward.holds ? "ok" : "bad",
          },
        ];
        if (forward.counterexample) {
          const { trace, refusal } = forward.counterexample;
          fields.push({
            label: t("反例", "Counterexample"),
            value:
              refusal.length > 0
                ? t(
                    `${listText(trace, language)} の後に {${refusal.join(", ")}} を断る`,
                    `refuses {${refusal.join(", ")}} after ${listText(trace, language)}`,
                  )
                : t(
                    `${listText(trace, language)} は仕様に無い`,
                    `${listText(trace, language)} is not in the spec`,
                  ),
          });
        }
        return fields;
      },
    },
  };
}
