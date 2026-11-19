import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { displayName } from "../labels";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import { explore } from "../csp";
import { runNetwork, SORT_IMPL_WIRINGS, visibleLog } from "../sortImpl";
import {
  comparatorProcess,
  type Comparator,
  networkModel,
  SORT_ENV,
  SORT_SIZE,
  SORT_VALUES,
  sortSpec,
  WIRINGS,
} from "../sortModels";

const COMPARATORS = WIRINGS.correct;
const NETWORK_LTS = explore(networkModel("correct"), SORT_ENV);
const SPEC_LTS = explore(sortSpec(), SORT_ENV);
const ONE_COMPARATOR_LTS = explore(comparatorProcess(COMPARATORS[0]!), SORT_ENV);
// 0と1 を3つ並べる入力の数（0-1原理で調べれば足りる入力の全部）
const INPUT_COUNT = SORT_VALUES.length ** SORT_SIZE;

const DEFAULT_INPUT = [1, 0, 1];
const DEFAULT_SEED = 1;
const SAMPLE = runNetwork(SORT_IMPL_WIRINGS.correct, DEFAULT_INPUT, DEFAULT_SEED);
const SAMPLE_VISIBLE = visibleLog(SAMPLE.log);
const SAMPLE_INTERNAL_COUNT = SAMPLE.log.length - SAMPLE_VISIBLE.length;

/** 線（チャネル）の名前の一覧。入口 in.*・出口 out.*・内部の線 w.* に分ける。 */
function channelsOf(c: Comparator): string[] {
  return [c.a, c.b, c.lo, c.hi];
}
const ALL_CHANNELS = [...new Set(COMPARATORS.flatMap(channelsOf))];
const INPUT_CHANNELS = ALL_CHANNELS.filter((ch) => ch.startsWith("in.")).sort();
const OUTPUT_CHANNELS = ALL_CHANNELS.filter((ch) => ch.startsWith("out.")).sort();
const INTERNAL_CHANNELS = ALL_CHANNELS.filter((ch) => ch.startsWith("w.")).sort();

function isSorted(values: number[]): boolean {
  return values.every((v, k) => k === 0 || values[k - 1]! <= v);
}

function parseInput(text: string | undefined): number[] {
  const values = (text ?? "")
    .split(/[,、\s]+/)
    .filter((part) => part !== "")
    .map(Number);
  const isValid =
    values.length === SORT_SIZE && values.every((v) => SORT_VALUES.includes(v));
  return isValid ? values : DEFAULT_INPUT;
}

function parseSeed(text: string | undefined): number {
  const seed = Number((text ?? "").trim());
  return Number.isInteger(seed) && seed > 0 ? seed : DEFAULT_SEED;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function caseDesignLesson(language: Language): Lesson {
  const t = translator(language);
  // 比較器の名前（「比較器1」）。文中は displayName のまま、カードの名前だけ英語で頭を大文字にする。
  const name = (index: number) => displayName(COMPARATORS[index]!.name, language);
  const cardName = (index: number) =>
    language === "ja" ? name(index) : capitalize(name(index));
  const separator = t("・", ", ");
  const comparatorRows = (c: Comparator): Record<string, string> => ({
    [t("入口", "inputs")]: `${c.a}${separator}${c.b}`,
    [t("小さい方", "smaller")]: c.lo,
    [t("大きい方", "larger")]: c.hi,
  });
  return {
    id: "case-design",
    category: "case",
    title: t("並行版を設計する", "Designing the concurrent version"),
    subtitle: t(
      "構造 → 動作 → 仕様の順にモデルを書く",
      "Model the structure → behaviour → spec, in that order",
    ),
    summary: t(
      `3つの値を並べ替えるネットワークを、比較器${COMPARATORS.length}つと線の構造、比較器ごとのプロセス、逐次の仕様の順にモデルにする。並行版は${NETWORK_LTS.stateCount}状態、仕様は${SPEC_LTS.stateCount}状態。`,
      `A network that sorts three values is modelled in order: the structure of ${COMPARATORS.length} comparators and their wires, a process for each comparator, then a sequential spec. The concurrent version has ${NETWORK_LTS.stateCount} states; the spec has ${SPEC_LTS.stateCount}.`,
    ),
    intro: [
      t(
        "ここから3本のレッスンで、1つの題材を設計から検証、実装まで通して扱う。題材は、比較器（2つの値を比べて小さい方と大きい方に分けて出す部品）を線でつないだ、値を並べ替えるネットワークである。",
        "The next three lessons take one example all the way from design through verification to implementation. The example is a network that sorts values, built by wiring together comparators (parts that compare two values and send out the smaller and the larger separately).",
      ),
      t(
        "比較器は同時に動くので、どの順で動いても正しく並ぶかを、手で書いたテストだけで確かめきるのは難しい。先にモデルを構造・動作・仕様の順に書いておくと、次のレッスンで検査器にかけ、その次で実装のテストに使える。",
        "The comparators run at the same time, so hand-written tests alone can hardly show that the output is sorted in every order they might run. Writing the model first, as structure, behaviour and spec, lets the next lesson run it through the checker and the one after use it to test the implementation.",
      ),
      t(
        "図では「入口」から比較器のカードを通って「出口」へ値が流れる配線を追う。比較器1つの動きを書いてからそれらを並行に組み合わせる所と、並行を使わない「仕様」のカードを別に書く所が要になる。",
        'In the diagram, follow the wiring as values flow from "Input" through the comparator cards to "Output". The key points are writing one comparator\'s behaviour before composing them in parallel, and writing the "Spec" card separately, without concurrency.',
      ),
    ],
    facts: [
      {
        label: t("比較器", "Comparators"),
        value: t(`${COMPARATORS.length}つ`, `${COMPARATORS.length}`),
      },
      {
        label: t("並行版のモデル", "Concurrent model"),
        value: t(
          `${NETWORK_LTS.stateCount}状態・${NETWORK_LTS.transitionCount}遷移`,
          `${NETWORK_LTS.stateCount} states, ${NETWORK_LTS.transitionCount} transitions`,
        ),
      },
      {
        label: t("逐次の仕様", "Sequential spec"),
        value: t(
          `${SPEC_LTS.stateCount}状態・${SPEC_LTS.transitionCount}遷移`,
          `${SPEC_LTS.stateCount} states, ${SPEC_LTS.transitionCount} transitions`,
        ),
      },
      {
        label: t("値", "Values"),
        value: t(
          `${SORT_VALUES.join("と")}だけ（0-1原理）`,
          `${SORT_VALUES.join(" and ")} only (0-1 principle)`,
        ),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 10.1節（CSPによるモデル化）`,
          `${CSP_BOOK_EN}, section 10.1 (modelling in CSP)`,
        ),
      },
    ],
    actors: [
      {
        id: "in",
        label: t("入口", "Input"),
        sublabel: INPUT_CHANNELS.join(separator),
        icon: "queue",
        x: 14,
        y: 27,
      },
      {
        id: "c1",
        label: cardName(0),
        sublabel: t("2つを比べる", "compares two"),
        icon: "process",
        x: 38,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "c2",
        label: cardName(1),
        sublabel: t("2つを比べる", "compares two"),
        icon: "process",
        x: 62,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "out",
        label: t("出口", "Output"),
        sublabel: OUTPUT_CHANNELS.join(separator),
        icon: "queue",
        x: 86,
        y: 27,
      },
      {
        id: "c3",
        label: cardName(2),
        sublabel: t("2つを比べる", "compares two"),
        icon: "process",
        x: 50,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: t("逐次の並べ替え", "sequential sort"),
        icon: "spec",
        x: 86,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "in", to: "c1" },
      { from: "in", to: "c2" },
      { from: "c1", to: "c2" },
      { from: "c1", to: "c3" },
      { from: "c2", to: "c3" },
      { from: "c2", to: "out" },
      { from: "c3", to: "out" },
    ],
    steps: [
      {
        id: "subject",
        kind: "spec",
        title: t("題材を決める", "Pick the example"),
        actor: "in",
        to: ["out"],
        summary: t(
          `3つの値（0か1）を受け取り、小さい順に並べて出す。入力は${INPUT_COUNT}通り`,
          `Take three values (0 or 1) and output them in ascending order. There are ${INPUT_COUNT} inputs`,
        ),
        explain: t(
          `題材は、3つの値を小さい順に並べ替える「並べ替えネットワーク」。値は0と1に絞る。比較器だけでできたネットワークは、0と1 の入力を全部並べ替えられれば、どんな値でも並べ替えられる（0-1原理）ので、${INPUT_COUNT}通りを全部調べれば足りる。`,
          `The example is a "sorting network" that puts three values in ascending order. Values are limited to 0 and 1. A network made only of comparators that sorts every input of 0s and 1s sorts any values (the 0-1 principle), so checking all ${INPUT_COUNT} inputs is enough.`,
        ),
        set: {
          in: {
            tone: "wait",
            rows: { [t("値", "values")]: SORT_VALUES.join(t(" か ", " or ")) },
          },
          out: {
            tone: "idle",
            rows: { [t("期待", "expected")]: t("小さい順", "ascending") },
          },
        },
        detail: [
          {
            title: t(
              "この事例の進め方（3本のレッスン）",
              "How this case study goes (three lessons)",
            ),
            fields: [
              {
                label: t("並行版を設計する", "Designing the concurrent version"),
                value: t(
                  "構造のモデル → 動作のモデル → 仕様のモデル",
                  "structure model → behaviour model → spec model",
                ),
              },
              {
                label: t(
                  "逐次の仕様と等価を示す",
                  "Proving it equivalent to a sequential spec",
                ),
                value: t(
                  "詳細化・デッドロック・発散を検査",
                  "check refinement, deadlock and divergence",
                ),
              },
              {
                label: t(
                  "実装をモデルで検査する",
                  "Checking the implementation against the model",
                ),
                value: t(
                  "実装のログを仕様で判定",
                  "judge the implementation's logs with the spec",
                ),
              },
              {
                label: t("参考にした流れ", "Flow followed"),
                value: t(
                  "参考文献の第10章と同じ順。題材はこのサイトの自作",
                  "Same order as chapter 10 of the reference. The example is this site's own",
                ),
              },
            ],
          },
        ],
      },
      {
        id: "structure",
        kind: "spec",
        title: t("構造: 比較器と線", "Structure: comparators, wires"),
        actor: "c1",
        to: ["c2", "c3"],
        summary: t(
          `比較器${COMPARATORS.length}つを、内部の線${INTERNAL_CHANNELS.join("・")}でつなぐ`,
          `Connect ${COMPARATORS.length} comparators with the internal wires ${INTERNAL_CHANNELS.join(", ")}`,
        ),
        explain: t(
          `まず「何がどこにつながっているか」だけを決める。比較器は2つの値を受け取り、小さい方を lo の出口へ、大きい方を hi の出口へ出す部品。${name(0)}で in.0 と in.1 を比べ、その大きい方と in.2 を${name(1)}で比べて最大を決め、残りの2つを${name(2)}で比べる。`,
          `First decide only what is connected to what. A comparator takes two values and sends the smaller to its lo output and the larger to its hi output. ${capitalize(name(0))} compares in.0 and in.1, ${name(1)} compares the larger of those with in.2 to find the maximum, and ${name(2)} compares the remaining two.`,
        ),
        set: {
          c1: { isHidden: false, tone: "idle", rows: comparatorRows(COMPARATORS[0]!) },
          c2: { isHidden: false, tone: "idle", rows: comparatorRows(COMPARATORS[1]!) },
          c3: { isHidden: false, tone: "idle", rows: comparatorRows(COMPARATORS[2]!) },
        },
        detail: [
          {
            title: t("線の名前", "Wire names"),
            fields: [
              {
                label: t("入口", "Inputs"),
                value: INPUT_CHANNELS.join(separator),
                isCode: true,
              },
              {
                label: t("内部の線", "Internal wires"),
                value: INTERNAL_CHANNELS.join(separator),
                isCode: true,
              },
              {
                label: t("出口", "Outputs"),
                value: OUTPUT_CHANNELS.join(separator),
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "配線はモデルと実装の両方が同じ表（WIRINGS）から作る。片方だけ直すと、後で照合する意味が無くなるため。",
          "Both the model and the implementation build their wiring from the same table (WIRINGS). Fixing only one of them would make the later comparison meaningless.",
        ),
      },
      {
        id: "behaviour",
        kind: "spec",
        title: t("動作: 比較器のプロセス", "Behaviour: comparator process"),
        actor: "c1",
        summary: t(
          `比較器1つは「2本から受け取り、2本へ出す」プロセス（${ONE_COMPARATOR_LTS.stateCount}状態）`,
          `One comparator is a process that "takes from two wires and sends to two" (${ONE_COMPARATOR_LTS.stateCount} states)`,
        ),
        explain: t(
          `次に部品1つの動きを書く。比較器のプロセスは、入口の2本からどちらが先でも値を受け取り、小さい方と大きい方を2本の出口へ（どちらが先でも）出して終わる。in.0.1 は「入口 in.0 で値1を受け渡す」というイベント（出来事）で、比較器1つだけでも${ONE_COMPARATOR_LTS.stateCount}状態・${ONE_COMPARATOR_LTS.transitionCount}遷移ある。`,
          `Next, write the behaviour of one part. The comparator process takes a value from each of its two inputs, in either order, then sends the smaller and the larger to its two outputs (in either order) and finishes. in.0.1 is an event (something that happens) meaning "value 1 is passed on input in.0". Even a single comparator has ${ONE_COMPARATOR_LTS.stateCount} states and ${ONE_COMPARATOR_LTS.transitionCount} transitions.`,
        ),
        set: {
          c1: {
            tone: "wait",
            rows: {
              [t("状態", "states")]: t(
                `${ONE_COMPARATOR_LTS.stateCount}個`,
                `${ONE_COMPARATOR_LTS.stateCount}`,
              ),
            },
          },
        },
        detail: [
          {
            title: t(
              "このサイトの書き方（比較器のプロセス）",
              "This site's notation (comparator process)",
            ),
            fields: [
              {
                label: t("受け取る", "Take"),
                value: t(
                  "a.x → b.y → … □ b.y → a.x → …（どちらが先でもよい）",
                  "a.x → b.y → … □ b.y → a.x → … (either order)",
                ),
                isCode: true,
              },
              {
                label: t("出す", "Send"),
                value: "lo.min(x,y) → hi.max(x,y) → SKIP □ hi… → lo… → SKIP",
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "実物の CSPM（FDR の記法）では、チャネルを宣言して c?x のような入力の書き方を使う。このサイトは値ごとにイベントを並べた短い式で見せている。",
          "Real CSPM (the notation of FDR) declares channels and uses input syntax such as c?x. This site shows short expressions that list one event per value.",
        ),
      },
      {
        id: "compose",
        kind: "explore",
        title: t("並行に組み合わせる", "Compose in parallel"),
        actor: "c3",
        to: ["c1", "c2"],
        summary: t(
          `比較器${COMPARATORS.length}つを並行合成すると${NETWORK_LTS.stateCount}状態・${NETWORK_LTS.transitionCount}遷移`,
          `Composing ${COMPARATORS.length} comparators in parallel gives ${NETWORK_LTS.stateCount} states and ${NETWORK_LTS.transitionCount} transitions`,
        ),
        explain: t(
          `部品のプロセスを並行合成する。2つの比較器がつながる線（${INTERNAL_CHANNELS.join("・")}）のイベントだけは、送る側と受け取る側がそろって初めて起きる。どの比較器から動くかの順番が全部入るので、全体は${NETWORK_LTS.stateCount}状態・${NETWORK_LTS.transitionCount}遷移になる。`,
          `Compose the part processes in parallel. Events on the wires that connect two comparators (${INTERNAL_CHANNELS.join(", ")}) happen only when the sender and the receiver are both ready. Every order in which the comparators can move is included, so the whole has ${NETWORK_LTS.stateCount} states and ${NETWORK_LTS.transitionCount} transitions.`,
        ),
        set: {
          c1: { tone: "ok", rows: { [t("状態", "states")]: null } },
          c2: { tone: "ok" },
          c3: {
            tone: "ok",
            rows: {
              [t("全体", "whole")]: t(
                `${NETWORK_LTS.stateCount}状態`,
                `${NETWORK_LTS.stateCount} states`,
              ),
            },
          },
        },
      },
      {
        id: "spec",
        kind: "spec",
        title: t("仕様: 逐次の並べ替え", "Spec: a sequential sort"),
        actor: "spec",
        to: ["out"],
        summary: t(
          `仕様は「3つ受け取ってから、並べて出す」逐次のプロセス（${SPEC_LTS.stateCount}状態）`,
          `The spec is a sequential process that "takes all three, then outputs them sorted" (${SPEC_LTS.stateCount} states)`,
        ),
        explain: t(
          `最後に、外から見てどう振る舞えばよいかを、並行を使わずに書く。仕様は入口の${SORT_SIZE}つをどの順でも受け取り終えてから、並べた値を out.0・out.1・out.2 へ（どの順でも）出す。内部の線は出てこず、${SPEC_LTS.stateCount}状態・${SPEC_LTS.transitionCount}遷移になる。`,
          `Finally, write how it should behave from the outside, without concurrency. The spec takes all ${SORT_SIZE} inputs in any order, and only then sends the sorted values to out.0, out.1 and out.2 (in any order). No internal wires appear, and it has ${SPEC_LTS.stateCount} states and ${SPEC_LTS.transitionCount} transitions.`,
        ),
        set: {
          spec: {
            isHidden: false,
            tone: "ok",
            rows: {
              [t("受け取る", "takes")]: t("in.0〜in.2 を全部", "all of in.0-in.2"),
              [t("出す", "sends")]: t("並べて out.0〜out.2", "sorted to out.0-out.2"),
              [t("状態", "states")]: t(
                `${SPEC_LTS.stateCount}個`,
                `${SPEC_LTS.stateCount}`,
              ),
            },
          },
        },
        simplified: t(
          "「全部受け取ってから出す」はこの仕様で決めたこと。次のレッスンで、並行版がこの仕様と同じ振る舞いになるかを調べる。",
          '"Take everything before sending" is a choice made in this spec. The next lesson checks whether the concurrent version behaves the same as this spec.',
        ),
      },
      {
        id: "run-once",
        kind: "run",
        title: t("1回動かしてみる", "Run it once"),
        actor: "in",
        to: ["c1", "c2"],
        summary: t(
          `入力${DEFAULT_INPUT.join(",")}を実装で動かすと、出力は${SAMPLE.output.join(",")}`,
          `Running the implementation on ${DEFAULT_INPUT.join(",")} outputs ${SAMPLE.output.join(",")}`,
        ),
        explain: t(
          `同じ配線で書いた実装（3本目のレッスンで詳しく見る）に${DEFAULT_INPUT.join(",")}を入れると、${SAMPLE.log.length}回の受け渡しが起き、出力は${SAMPLE.output.join(",")}になる。そのうち${SAMPLE_INTERNAL_COUNT}回は内部の線で、外から見えるのは入口と出口の${SAMPLE_VISIBLE.length}回だけ。`,
          `Feeding ${DEFAULT_INPUT.join(",")} to an implementation built from the same wiring (covered in the third lesson) causes ${SAMPLE.log.length} hand-offs, and the output is ${SAMPLE.output.join(",")}. ${SAMPLE_INTERNAL_COUNT} of them are on internal wires; only the ${SAMPLE_VISIBLE.length} on inputs and outputs are visible from outside.`,
        ),
        set: {
          in: {
            tone: "ok",
            rows: {
              [t("値", "values")]: null,
              [t("入力", "input")]: DEFAULT_INPUT.join(","),
            },
          },
          out: {
            tone: isSorted(SAMPLE.output) ? "ok" : "bad",
            rows: {
              [t("期待", "expected")]: null,
              [t("出力", "output")]: SAMPLE.output.join(","),
            },
          },
        },
        detail: [
          {
            title: t(
              `実装のログ（シード${DEFAULT_SEED}）`,
              `Implementation log (seed ${DEFAULT_SEED})`,
            ),
            fields: SAMPLE.log.map((ev, index) => ({
              label: `${index + 1}`,
              value: ev,
              note: ev.startsWith("w.") ? t("内部の線", "internal wire") : undefined,
              isCode: true,
            })),
          },
        ],
      },
    ],
    lab: {
      title: t("入力を変えて動かす", "Run with other inputs"),
      hint: t(
        "0か1 を3つ、カンマで区切って入れる（例: 1,0,1）。シードを変えると受け渡しの順が変わる。",
        "Enter three values, each 0 or 1, separated by commas (e.g. 1,0,1). Changing the seed changes the order of hand-offs.",
      ),
      inputs: [
        {
          id: "input",
          label: t("入力（0か1 を3つ）", "Input (three 0s or 1s)"),
          initial: DEFAULT_INPUT.join(","),
        },
        {
          id: "seed",
          label: t("シード（1以上の整数）", "Seed (integer, 1 or more)"),
          initial: String(DEFAULT_SEED),
        },
      ],
      compute: (values): Field[] => {
        const input = parseInput(values.input);
        const seed = parseSeed(values.seed);
        const run = runNetwork(SORT_IMPL_WIRINGS.correct, input, seed);
        const sorted = isSorted(run.output);
        return [
          { label: t("入力", "Input"), value: input.join(",") },
          { label: t("シード", "Seed"), value: String(seed) },
          {
            label: t("出力", "Output"),
            value: run.output.join(","),
            tone: sorted ? "ok" : "bad",
            note: sorted
              ? t("小さい順に並んだ", "sorted ascending")
              : t("並んでいない", "not sorted"),
          },
          {
            label: t("見えるログ", "Visible log"),
            value: visibleLog(run.log).join(", "),
            isCode: true,
          },
          {
            label: t("全部のログ", "Full log"),
            value: run.log.join(", "),
            isCode: true,
          },
        ];
      },
    },
  };
}
