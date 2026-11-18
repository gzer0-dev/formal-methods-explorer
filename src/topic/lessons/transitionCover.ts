import type { ActorPatch, Field, Lesson } from "../../core/types";
import { coverTransitions, shortestPath } from "../coverage";
import { ORDER_ACTIONS, type OrderStatus, type OrderTransition } from "../models";

const INITIAL: OrderStatus = "未払い";

// 遷移ごとに「そこへ行く最短の道 + その遷移」。捨てる前の候補として画面に見せる。
const CANDIDATES = ORDER_ACTIONS.map((transition) => {
  const prefix = shortestPath(ORDER_ACTIONS, INITIAL, transition.from) ?? [];
  return { transition, path: [...prefix, transition.name] };
});
const TESTS = coverTransitions(ORDER_ACTIONS, INITIAL);
const STATUSES = new Set(ORDER_ACTIONS.flatMap((t) => [t.from, t.to]));
const COVERED = new Set(TESTS.flat());
const DROPPED = CANDIDATES.filter(
  (candidate) => !TESTS.some((test) => test.join() === candidate.path.join()),
);

function endStatus(transitions: OrderTransition[], path: string[]): OrderStatus {
  return path.reduce<OrderStatus>(
    (status, name) =>
      transitions.find((t) => t.name === name && t.from === status)?.to ?? status,
    INITIAL,
  );
}

function formatPath(path: string[]): string {
  return path.join(" → ");
}

/** テストのカードに出す行。1手ずつ並べ、行の上限（4行）を超えないように最後は終わりの状態だけにする。 */
function testCard(index: number): ActorPatch {
  const path = TESTS[index] ?? [];
  const rows: Record<string, string> = {};
  path.forEach((name, i) => {
    rows[`${i + 1}手目`] = name;
  });
  rows["終わり"] = endStatus(ORDER_ACTIONS, path);
  return { isHidden: false, tone: "ok", rows };
}

function parseNames(text: string | undefined): OrderTransition[] {
  const names = (text ?? "").split(/[,、，]/).map((name) => name.trim());
  const chosen = ORDER_ACTIONS.filter((transition) => names.includes(transition.name));
  return chosen.length > 0 ? chosen : ORDER_ACTIONS;
}

export const transitionCoverLesson: Lesson = {
  id: "transition-cover",
  category: "testing",
  title: "遷移を全部通すテスト",
  subtitle: "状態遷移のモデルから、テストの手順を作る",
  summary: `注文の状態遷移${ORDER_ACTIONS.length}本を、モデルから作った${TESTS.length}本のテストで全部1回は通す。モデルベーステストの最小の形。`,
  facts: [
    { label: "状態", value: `${STATUSES.size}個` },
    { label: "遷移", value: `${ORDER_ACTIONS.length}本` },
    { label: "作ったテスト", value: `${TESTS.length}本`, tone: "ok" },
    {
      label: "通った遷移",
      value: `${ORDER_ACTIONS.length}本中${COVERED.size}本`,
      tone: "ok",
    },
  ],
  actors: [
    {
      id: "model",
      label: "状態遷移のモデル",
      sublabel: "注文の状態",
      icon: "spec",
      x: 14,
      y: 50,
    },
    {
      id: "generator",
      label: "生成器",
      sublabel: "テストの手順を作る",
      icon: "gear",
      x: 38,
      y: 50,
    },
    {
      id: "test1",
      label: "テスト1",
      icon: "test",
      x: 64,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "test2",
      label: "テスト2",
      icon: "test",
      x: 64,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "test3",
      label: "テスト3",
      icon: "test",
      x: 86,
      y: 50,
      initial: { isHidden: true },
    },
  ],
  links: [
    { from: "model", to: "generator" },
    { from: "generator", to: "test1" },
    { from: "generator", to: "test2" },
    { from: "generator", to: "test3" },
  ],
  steps: [
    {
      id: "write-model",
      kind: "spec",
      title: "状態遷移を書く",
      actor: "model",
      summary: `注文の状態${STATUSES.size}個と遷移${ORDER_ACTIONS.length}本を書く`,
      explain:
        "注文は「未払い」から始まり、支払う・発送する・届ける・取り消す・返金する、の操作で状態が移る。どの状態からどの操作ができるかを、表として書き出したものがモデルになる。",
      set: {
        model: {
          tone: "wait",
          rows: {
            初期状態: INITIAL,
            状態: `${STATUSES.size}個`,
            遷移: `${ORDER_ACTIONS.length}本`,
          },
        },
      },
      detail: [
        {
          title: "遷移の一覧",
          fields: ORDER_ACTIONS.map((t) => ({
            label: t.name,
            value: `${t.from} → ${t.to}`,
          })),
        },
      ],
    },
    {
      id: "shortest",
      kind: "explore",
      title: "各遷移への最短の道",
      actor: "generator",
      to: ["model"],
      summary: `遷移ごとに「そこへ行く最短の道＋その遷移」を作り、${CANDIDATES.length}本の候補にする`,
      explain:
        "遷移を1本ずつ取り上げ、初期状態からその遷移の出発点までの最短の操作列を幅優先で探し、最後にその遷移を足す。こうすると、どの遷移にも必ずそれを通る手順が1本できる。",
      set: {
        generator: { tone: "wait", rows: { 候補: `${CANDIDATES.length}本` } },
      },
      detail: [
        {
          title: "遷移ごとの候補",
          fields: CANDIDATES.map((candidate) => ({
            label: candidate.transition.name,
            value: formatPath(candidate.path),
          })),
        },
      ],
    },
    {
      id: "drop",
      kind: "explore",
      title: "含まれる道を捨てる",
      actor: "generator",
      summary: `他の道の先頭部分に含まれる${DROPPED.length}本を捨て、${TESTS.length}本に減らす`,
      explain: `「${formatPath(DROPPED[0]?.path ?? [])}」は、もっと長い手順の先頭部分にそのまま含まれている。長い方を流せば同じ遷移を通るので、短い方は捨ててよい。`,
      set: {
        generator: {
          rows: {
            候補: `${CANDIDATES.length}本`,
            捨てた: `${DROPPED.length}本`,
            残り: `${TESTS.length}本`,
          },
        },
      },
      detail: [
        {
          title: "捨てた候補",
          fields: DROPPED.map((candidate) => ({
            label: candidate.transition.name,
            value: formatPath(candidate.path),
            note: "別の手順の先頭部分",
          })),
        },
      ],
    },
    {
      id: "test1",
      kind: "test",
      title: "テスト1を作る",
      actor: "generator",
      to: ["test1"],
      summary: formatPath(TESTS[0] ?? []),
      explain: `1本目は${formatPath(TESTS[0] ?? [])}。支払いから配達までの、いちばん長い普通の流れを通る。`,
      set: { test1: testCard(0) },
    },
    {
      id: "test2",
      kind: "test",
      title: "テスト2を作る",
      actor: "generator",
      to: ["test2"],
      summary: formatPath(TESTS[1] ?? []),
      explain: `2本目は${formatPath(TESTS[1] ?? [])}の1手だけ。支払う前に取り消す流れは、1本目とは最初の操作から分かれるので別のテストになる。`,
      set: { test2: testCard(1) },
    },
    {
      id: "test3",
      kind: "test",
      title: "テスト3を作る",
      actor: "generator",
      to: ["test3"],
      summary: formatPath(TESTS[2] ?? []),
      explain: `3本目は${formatPath(TESTS[2] ?? [])}。支払った後に発送ではなく返金へ分かれる流れを通る。`,
      set: { test3: testCard(2) },
    },
    {
      id: "covered",
      kind: "run",
      title: "全部の遷移を通った",
      actor: "model",
      to: ["test1", "test2", "test3"],
      summary: `${TESTS.length}本で遷移${ORDER_ACTIONS.length}本中${COVERED.size}本を通る`,
      explain:
        "3本のテストを合わせると、5本の遷移をどれも1回は通る。手で思いついた順に書くと抜けやすい「支払う前の取り消し」や「支払後の返金」も、モデルから機械的に作れば漏れない。",
      set: {
        model: {
          tone: "ok",
          rows: { 通った遷移: `${ORDER_ACTIONS.length}本中${COVERED.size}本` },
        },
        generator: { tone: "ok" },
      },
      simplified:
        "ここでは「どの遷移も1回は通る」だけを目標にしている。実物のモデルベーステストの道具は、遷移の組み合わせや前提条件、渡すデータまで含めて手順を作り、実装の状態とモデルの状態を毎手比べる。fast-check や Hypothesis にも、状態を持つ対象を操作列で試す仕組みがある。",
    },
  ],
  lab: {
    title: "遷移を選んで手順を作る",
    hint: "遷移の名前をカンマ区切りで選ぶ（支払う・発送する・届ける・取り消す・返金する）。選んだ遷移だけのモデルから、テストの手順を作り直す。初期状態から着けない遷移はテストにならない。",
    inputs: [
      {
        id: "names",
        label: "遷移（カンマ区切り）",
        initial: ORDER_ACTIONS.map((t) => t.name).join(","),
      },
    ],
    compute: (values): Field[] => {
      const chosen = parseNames(values.names);
      const tests = coverTransitions(chosen, INITIAL);
      const covered = new Set(tests.flat());
      const unreachable = chosen.filter((t) => !covered.has(t.name));
      return [
        { label: "選んだ遷移", value: chosen.map((t) => t.name).join("・") },
        { label: "テストの本数", value: `${tests.length}本` },
        ...tests.map((path, i) => ({
          label: `テスト${i + 1}`,
          value: formatPath(path),
          note: `終わり: ${endStatus(chosen, path)}`,
        })),
        {
          label: "着けない遷移",
          value:
            unreachable.length > 0 ? unreachable.map((t) => t.name).join("・") : "なし",
          tone: unreachable.length > 0 ? "bad" : "ok",
        },
      ];
    },
  },
};
