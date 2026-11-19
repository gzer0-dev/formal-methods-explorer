import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
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

function comparatorRows(c: Comparator): Record<string, string> {
  return { 入口: `${c.a}・${c.b}`, 小さい方: c.lo, 大きい方: c.hi };
}

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

export const caseDesignLesson: Lesson = {
  id: "case-design",
  category: "case",
  title: "並行版を設計する",
  subtitle: "構造 → 動作 → 仕様の順にモデルを書く",
  summary: `3つの値を並べ替えるネットワークを、比較器${COMPARATORS.length}つと線の構造、比較器ごとのプロセス、逐次の仕様の順にモデルにする。並行版は${NETWORK_LTS.stateCount}状態、仕様は${SPEC_LTS.stateCount}状態。`,
  intro: [
    "ここから3本のレッスンで、1つの題材を設計から検証、実装まで通して扱う。題材は、比較器（2つの値を比べて小さい方と大きい方に分けて出す部品）を線でつないだ、値を並べ替えるネットワークである。",
    "比較器は同時に動くので、どの順で動いても正しく並ぶかを、手で書いたテストだけで確かめきるのは難しい。先にモデルを構造・動作・仕様の順に書いておくと、次のレッスンで検査器にかけ、その次で実装のテストに使える。",
    "図では「入口」から比較器のカードを通って「出口」へ値が流れる配線を追う。比較器1つの動きを書いてからそれらを並行に組み合わせる所と、並行を使わない「仕様」のカードを別に書く所が要になる。",
  ],
  facts: [
    { label: "比較器", value: `${COMPARATORS.length}つ` },
    {
      label: "並行版のモデル",
      value: `${NETWORK_LTS.stateCount}状態・${NETWORK_LTS.transitionCount}遷移`,
    },
    {
      label: "逐次の仕様",
      value: `${SPEC_LTS.stateCount}状態・${SPEC_LTS.transitionCount}遷移`,
    },
    { label: "値", value: `${SORT_VALUES.join("と")}だけ（0-1原理）` },
    { label: "参考文献", value: `${CSP_BOOK} 10.1節（CSPによるモデル化）` },
  ],
  actors: [
    {
      id: "in",
      label: "入口",
      sublabel: INPUT_CHANNELS.join("・"),
      icon: "queue",
      x: 14,
      y: 27,
    },
    {
      id: "c1",
      label: COMPARATORS[0]!.name,
      sublabel: "2つを比べる",
      icon: "process",
      x: 38,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "c2",
      label: COMPARATORS[1]!.name,
      sublabel: "2つを比べる",
      icon: "process",
      x: 62,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "out",
      label: "出口",
      sublabel: OUTPUT_CHANNELS.join("・"),
      icon: "queue",
      x: 86,
      y: 27,
    },
    {
      id: "c3",
      label: COMPARATORS[2]!.name,
      sublabel: "2つを比べる",
      icon: "process",
      x: 50,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "spec",
      label: "仕様",
      sublabel: "逐次の並べ替え",
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
      title: "題材を決める",
      actor: "in",
      to: ["out"],
      summary: `3つの値（0か1）を受け取り、小さい順に並べて出す。入力は${INPUT_COUNT}通り`,
      explain: `題材は、3つの値を小さい順に並べ替える「並べ替えネットワーク」。値は0と1に絞る。比較器だけでできたネットワークは、0と1 の入力を全部並べ替えられれば、どんな値でも並べ替えられる（0-1原理）ので、${INPUT_COUNT}通りを全部調べれば足りる。`,
      set: {
        in: { tone: "wait", rows: { 値: SORT_VALUES.join(" か ") } },
        out: { tone: "idle", rows: { 期待: "小さい順" } },
      },
      detail: [
        {
          title: "この事例の進め方（3本のレッスン）",
          fields: [
            {
              label: "並行版を設計する",
              value: "構造のモデル → 動作のモデル → 仕様のモデル",
            },
            {
              label: "逐次の仕様と等価を示す",
              value: "詳細化・デッドロック・発散を検査",
            },
            { label: "実装をモデルで検査する", value: "実装のログを仕様で判定" },
            {
              label: "参考にした流れ",
              value: "参考文献の第10章と同じ順。題材はこのサイトの自作",
            },
          ],
        },
      ],
    },
    {
      id: "structure",
      kind: "spec",
      title: "構造: 比較器と線",
      actor: "c1",
      to: ["c2", "c3"],
      summary: `比較器${COMPARATORS.length}つを、内部の線${INTERNAL_CHANNELS.join("・")}でつなぐ`,
      explain: `まず「何がどこにつながっているか」だけを決める。比較器は2つの値を受け取り、小さい方を lo の出口へ、大きい方を hi の出口へ出す部品。${COMPARATORS[0]!.name}で in.0 と in.1 を比べ、その大きい方と in.2 を${COMPARATORS[1]!.name}で比べて最大を決め、残りの2つを${COMPARATORS[2]!.name}で比べる。`,
      set: {
        c1: { isHidden: false, tone: "idle", rows: comparatorRows(COMPARATORS[0]!) },
        c2: { isHidden: false, tone: "idle", rows: comparatorRows(COMPARATORS[1]!) },
        c3: { isHidden: false, tone: "idle", rows: comparatorRows(COMPARATORS[2]!) },
      },
      detail: [
        {
          title: "線の名前",
          fields: [
            { label: "入口", value: INPUT_CHANNELS.join("・"), isCode: true },
            { label: "内部の線", value: INTERNAL_CHANNELS.join("・"), isCode: true },
            { label: "出口", value: OUTPUT_CHANNELS.join("・"), isCode: true },
          ],
        },
      ],
      simplified:
        "配線はモデルと実装の両方が同じ表（WIRINGS）から作る。片方だけ直すと、後で照合する意味が無くなるため。",
    },
    {
      id: "behaviour",
      kind: "spec",
      title: "動作: 比較器のプロセス",
      actor: "c1",
      summary: `比較器1つは「2本から受け取り、2本へ出す」プロセス（${ONE_COMPARATOR_LTS.stateCount}状態）`,
      explain: `次に部品1つの動きを書く。比較器のプロセスは、入口の2本からどちらが先でも値を受け取り、小さい方と大きい方を2本の出口へ（どちらが先でも）出して終わる。in.0.1 は「入口 in.0 で値1を受け渡す」というイベント（出来事）で、比較器1つだけでも${ONE_COMPARATOR_LTS.stateCount}状態・${ONE_COMPARATOR_LTS.transitionCount}遷移ある。`,
      set: {
        c1: { tone: "wait", rows: { 状態: `${ONE_COMPARATOR_LTS.stateCount}個` } },
      },
      detail: [
        {
          title: "このサイトの書き方（比較器のプロセス）",
          fields: [
            {
              label: "受け取る",
              value: "a.x → b.y → … □ b.y → a.x → …（どちらが先でもよい）",
              isCode: true,
            },
            {
              label: "出す",
              value: "lo.min(x,y) → hi.max(x,y) → SKIP □ hi… → lo… → SKIP",
              isCode: true,
            },
          ],
        },
      ],
      simplified:
        "実物の CSPM（FDR の記法）では、チャネルを宣言して c?x のような入力の書き方を使う。このサイトは値ごとにイベントを並べた短い式で見せている。",
    },
    {
      id: "compose",
      kind: "explore",
      title: "並行に組み合わせる",
      actor: "c3",
      to: ["c1", "c2"],
      summary: `比較器${COMPARATORS.length}つを並行合成すると${NETWORK_LTS.stateCount}状態・${NETWORK_LTS.transitionCount}遷移`,
      explain: `部品のプロセスを並行合成する。2つの比較器がつながる線（${INTERNAL_CHANNELS.join("・")}）のイベントだけは、送る側と受け取る側がそろって初めて起きる。どの比較器から動くかの順番が全部入るので、全体は${NETWORK_LTS.stateCount}状態・${NETWORK_LTS.transitionCount}遷移になる。`,
      set: {
        c1: { tone: "ok", rows: { 状態: null } },
        c2: { tone: "ok" },
        c3: { tone: "ok", rows: { 全体: `${NETWORK_LTS.stateCount}状態` } },
      },
    },
    {
      id: "spec",
      kind: "spec",
      title: "仕様: 逐次の並べ替え",
      actor: "spec",
      to: ["out"],
      summary: `仕様は「3つ受け取ってから、並べて出す」逐次のプロセス（${SPEC_LTS.stateCount}状態）`,
      explain: `最後に、外から見てどう振る舞えばよいかを、並行を使わずに書く。仕様は入口の${SORT_SIZE}つをどの順でも受け取り終えてから、並べた値を out.0・out.1・out.2 へ（どの順でも）出す。内部の線は出てこず、${SPEC_LTS.stateCount}状態・${SPEC_LTS.transitionCount}遷移になる。`,
      set: {
        spec: {
          isHidden: false,
          tone: "ok",
          rows: {
            受け取る: "in.0〜in.2 を全部",
            出す: "並べて out.0〜out.2",
            状態: `${SPEC_LTS.stateCount}個`,
          },
        },
      },
      simplified:
        "「全部受け取ってから出す」はこの仕様で決めたこと。次のレッスンで、並行版がこの仕様と同じ振る舞いになるかを調べる。",
    },
    {
      id: "run-once",
      kind: "run",
      title: "1回動かしてみる",
      actor: "in",
      to: ["c1", "c2"],
      summary: `入力${DEFAULT_INPUT.join(",")}を実装で動かすと、出力は${SAMPLE.output.join(",")}`,
      explain: `同じ配線で書いた実装（3本目のレッスンで詳しく見る）に${DEFAULT_INPUT.join(",")}を入れると、${SAMPLE.log.length}回の受け渡しが起き、出力は${SAMPLE.output.join(",")}になる。そのうち${SAMPLE_INTERNAL_COUNT}回は内部の線で、外から見えるのは入口と出口の${SAMPLE_VISIBLE.length}回だけ。`,
      set: {
        in: { tone: "ok", rows: { 値: null, 入力: DEFAULT_INPUT.join(",") } },
        out: {
          tone: isSorted(SAMPLE.output) ? "ok" : "bad",
          rows: { 期待: null, 出力: SAMPLE.output.join(",") },
        },
      },
      detail: [
        {
          title: `実装のログ（シード${DEFAULT_SEED}）`,
          fields: SAMPLE.log.map((ev, index) => ({
            label: `${index + 1}`,
            value: ev,
            note: ev.startsWith("w.") ? "内部の線" : undefined,
            isCode: true,
          })),
        },
      ],
    },
  ],
  lab: {
    title: "入力を変えて動かす",
    hint: "0か1 を3つ、カンマで区切って入れる（例: 1,0,1）。シードを変えると受け渡しの順が変わる。",
    inputs: [
      { id: "input", label: "入力（0か1 を3つ）", initial: DEFAULT_INPUT.join(",") },
      { id: "seed", label: "シード（1以上の整数）", initial: String(DEFAULT_SEED) },
    ],
    compute: (values): Field[] => {
      const input = parseInput(values.input);
      const seed = parseSeed(values.seed);
      const run = runNetwork(SORT_IMPL_WIRINGS.correct, input, seed);
      const sorted = isSorted(run.output);
      return [
        { label: "入力", value: input.join(",") },
        { label: "シード", value: String(seed) },
        {
          label: "出力",
          value: run.output.join(","),
          tone: sorted ? "ok" : "bad",
          note: sorted ? "小さい順に並んだ" : "並んでいない",
        },
        { label: "見えるログ", value: visibleLog(run.log).join(", "), isCode: true },
        { label: "全部のログ", value: run.log.join(", "), isCode: true },
      ];
    },
  },
};
