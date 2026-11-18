import type { Actor, Field, Lesson, Step } from "../../core/types";
import { check } from "../modelCheck";
import {
  counterModel,
  describeCounter,
  runSchedule,
  type CounterState,
} from "../models";

const RESULT = check(counterModel(2, false));
// 反例の手順。TRACE[0] は初期状態、TRACE[i] は i 手目の後の状態。
const TRACE = RESULT.violation!;
const MOVE_COUNT = TRACE.length - 1;
const ACTIONS = TRACE.slice(1).map((step) => step.action!);
const REPLAY = runSchedule(ACTIONS, false);
// 幅優先なので、反例の手数は不変条件を破る状態が最初に現れる深さと同じ。
const SHALLOWER_STATE_COUNT = RESULT.levels
  .slice(0, MOVE_COUNT)
  .reduce((sum, n) => sum + n, 0);

/** describeCounter の「A:読む前 B:手元=0 count=0」をカードの行に分ける。 */
function counterRows(state: CounterState): Record<string, string> {
  return Object.fromEntries(
    describeCounter(state)
      .split(" ")
      .map((part) => {
        const separator = part.includes(":") ? ":" : "=";
        const [name, ...rest] = part.split(separator);
        return [name!, rest.join(separator)];
      }),
  );
}

function stateId(index: number): string {
  return `s${index}`;
}

// 上の段に初期状態から3手目まで、違反した状態は右下に置く（右下から左へ親をたどる）。
const POSITIONS: [number, number][] = [
  [14, 27],
  [38, 27],
  [62, 27],
  [86, 27],
  [86, 73],
];

const stateActors: Actor[] = TRACE.map((_, index) => {
  const [x, y] = POSITIONS[index]!;
  const isLast = index === MOVE_COUNT;
  return {
    id: stateId(index),
    label: index === 0 ? "初期状態" : `${index}手目の後`,
    sublabel: isLast ? "不変条件を破る" : undefined,
    icon: "state",
    x,
    y,
    initial: { isHidden: true },
  };
});

/** 違反した状態から1つ親へ戻るステップ。 */
function backStep(index: number): Step {
  const child = TRACE[index]!;
  const parent = TRACE[index - 1]!;
  const isRoot = index - 1 === 0;
  return {
    id: `back-${index}`,
    kind: "found",
    title: `${index - 1 === 0 ? "初期状態" : `${index - 1}手目`}へ戻る`,
    actor: stateId(index),
    to: [stateId(index - 1)],
    summary: `「${child.action}」で来たと覚えているので、その前の状態へ戻る`,
    explain: `この状態は「親の状態から『${child.action}』で来た」と覚えている。親の「${describeCounter(parent.state)}」を開く。${isRoot ? "親は初期状態で、その先に親は無いので、ここで戻るのをやめる。" : "親にも同じく来た道が書いてあるので、さらに戻れる。"}`,
    set: {
      [stateId(index)]: { rows: { 来た操作: child.action! } },
      [stateId(index - 1)]: {
        isHidden: false,
        tone: isRoot ? "ok" : "wait",
        rows: counterRows(parent.state),
      },
    },
  };
}

function parseCount(text: string | undefined): number {
  const value = Number.parseInt(text ?? "", 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 4) : 2;
}

export const counterexampleLesson: Lesson = {
  id: "counterexample",
  category: "model",
  title: "反例を読む",
  subtitle: "違反した状態から、来た道を逆にたどる",
  summary: `検査器は、各状態が「どこから・どの操作で来たか」を覚えている。違反した状態から親を${MOVE_COUNT}回たどると、そこへ至る手順（反例）が戻ってくる。幅優先でたどったので、これより短い手順は無い。`,
  facts: [
    { label: "反例の手数", value: `${MOVE_COUNT}手`, tone: "bad" },
    { label: "破る状態の深さ", value: String(MOVE_COUNT) },
    { label: "それより浅い状態", value: `${SHALLOWER_STATE_COUNT}個（違反なし）` },
    { label: "実物の道具", value: "TLC のエラートレース" },
  ],
  actors: [
    {
      id: "checker",
      label: "モデル検査器",
      sublabel: "親の控えを持つ",
      icon: "checker",
      x: 14,
      y: 73,
    },
    ...stateActors,
  ],
  links: [
    ...TRACE.slice(1).map((_, i) => ({ from: stateId(i), to: stateId(i + 1) })),
    { from: "checker", to: stateId(MOVE_COUNT) },
  ],
  steps: [
    {
      id: "found",
      kind: "found",
      title: "違反した状態を見る",
      actor: "checker",
      to: [stateId(MOVE_COUNT)],
      summary: `深さ${MOVE_COUNT}で、両方終わったのに count=${TRACE[MOVE_COUNT]!.state.count}の状態を見つけた`,
      explain: `検査器は「${describeCounter(TRACE[MOVE_COUNT]!.state)}」で不変条件「全員が終わったら count は2」が破れているのを見つけた。この状態だけでは、どんな順で動いたらここに着くのか分からない。手順が無いと、開発者は再現も修正もできない。`,
      set: {
        [stateId(MOVE_COUNT)]: {
          isHidden: false,
          tone: "bad",
          rows: counterRows(TRACE[MOVE_COUNT]!.state),
        },
        checker: { tone: "bad", rows: { 違反: `${RESULT.violationCount}個` } },
      },
      simplified:
        "ここでの「親の控え」は、訪問済みの Map に状態ごとに入れた「親の鍵」と「操作の名前」。TLC も状態の指紋ごとに親を覚えていて、同じやり方でエラートレースを組み立てる。",
    },
    ...Array.from({ length: MOVE_COUNT }, (_, i) => backStep(MOVE_COUNT - i)),
    {
      id: "reorder",
      kind: "found",
      title: "並べ直して読む",
      actor: "checker",
      to: [stateId(0)],
      summary: `逆にたどった手順を前から並べると「${ACTIONS.join(" → ")}」`,
      explain: `戻ってきた道を逆順にすると、初期状態から違反までの手順になる。Aが読み、書く前に Bも同じ値を読むので、後から書いた Bが Aの更新を上書きする。このページの反例は、こうして組み立てたもの。`,
      set: {
        checker: { rows: { 手順: `${MOVE_COUNT}手` } },
      },
      detail: [
        {
          title: "反例（前から読む）",
          fields: TRACE.map((step, index) => ({
            label: index === 0 ? "初期状態" : `${index}手目`,
            value: step.action ?? "（始まり）",
            note: describeCounter(step.state),
            tone: index === MOVE_COUNT ? ("bad" as const) : undefined,
          })),
        },
      ],
    },
    {
      id: "shortest",
      kind: "explore",
      title: "最短の手順になる",
      actor: "checker",
      to: [stateId(MOVE_COUNT)],
      summary: `深さ${MOVE_COUNT - 1}までの${SHALLOWER_STATE_COUNT}状態に違反は無かった`,
      explain: `幅優先探索は浅い状態から順に調べるので、最初に見つかった違反は最も少ない手数で着ける。深さ${MOVE_COUNT - 1}までの${SHALLOWER_STATE_COUNT}状態はどれも不変条件を満たしていた。だから${MOVE_COUNT}手より短い反例は無い。`,
      set: {
        checker: { rows: { 最短: "はい" } },
      },
      simplified: `このカウンタはどの並びでも${MOVE_COUNT}手で終わるので、最短であることの利点は見えにくい。輪や回り道のあるモデルを深さ優先でたどると、遠回りした長い反例が返ることがあり、幅優先の利点はそこで効く。`,
    },
    {
      id: "replay",
      kind: "test",
      title: "手順を再生して確かめる",
      actor: "checker",
      to: [stateId(0)],
      summary: `反例の手順をそのまま動かすと count=${REPLAY.count}になる`,
      explain: `反例はただの手順の列なので、そのまま実装に当てて再生できる。順を決めて動かすと count は${REPLAY.count}になり、${REPLAY.isCorrect ? "正しく終わる" : "毎回同じ失敗を再現できる"}。これをテストに残せば、直した後に戻っていないかを見張れる。`,
      set: {
        checker: { rows: { 再生: `count=${REPLAY.count}` } },
      },
    },
  ],
  lab: {
    title: "プロセスの数を変える",
    hint: "プロセスが増えると、反例の手数も増える。幅優先なので、どの数でも出てくるのは最短の手順。",
    inputs: [{ id: "count", label: "プロセスの数（1〜4）", initial: "2" }],
    compute: (values): Field[] => {
      const processCount = parseCount(values.count);
      const result = check(counterModel(processCount, false));
      const trace = result.violation;
      if (!trace) {
        return [
          { label: "プロセスの数", value: String(processCount) },
          { label: "最短の反例", value: "なし", tone: "ok" },
          { label: "たどった状態", value: `${result.stateCount}個` },
        ];
      }
      const actions = trace.slice(1).map((step) => step.action ?? "");
      return [
        { label: "プロセスの数", value: String(processCount) },
        { label: "最短の反例", value: `${actions.length}手`, tone: "bad" },
        { label: "手順", value: actions.join(" → ") },
        {
          label: "最後の状態",
          value: describeCounter(trace.at(-1)!.state),
          tone: "bad",
        },
        { label: "破る状態の数", value: `${result.violationCount}個` },
      ];
    },
  },
};
