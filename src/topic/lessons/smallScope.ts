import type { ActorPatch, Field, Lesson } from "../../core/types";
import {
  PEOPLE,
  checkBossInstances,
  describeBosses,
  isOwnAncestor,
} from "../smallScope";
import type { BossInstance } from "../smallScope";

const FREE = checkBossInstances({ forbidSelf: false, forbidCycle: false });
const NO_SELF = checkBossInstances({ forbidSelf: true, forbidCycle: false });
const NO_CYCLE = checkBossInstances({ forbidSelf: true, forbidCycle: true });
const FREE_COUNTER = FREE.firstCounterexample!;
const NO_SELF_COUNTER = NO_SELF.firstCounterexample!;

/** 反例の形を、3人のカードの「上司」の行に写す。自分の上司筋になっている人は赤にする。 */
function showInstance(
  instance: BossInstance,
  badPeople: string[],
): Record<string, ActorPatch> {
  return Object.fromEntries(
    PEOPLE.map((person) => [
      person,
      {
        tone: badPeople.includes(person) ? "bad" : "idle",
        rows: { 上司: instance[person] ?? "なし" },
      },
    ]),
  );
}

/** 上司をたどって自分に戻る人（自分の上司筋になっている人）。 */
function peopleInLoop(instance: BossInstance): string[] {
  return PEOPLE.filter((person) => isOwnAncestor(instance, person));
}

function parseOn(text: string | undefined): boolean {
  return (text ?? "").includes("あり");
}

const IDLE_PEOPLE: Record<string, ActorPatch> = Object.fromEntries(
  PEOPLE.map((person) => [person, { tone: "idle", rows: { 上司: "?" } }]),
);

export const smallScopeLesson: Lesson = {
  id: "small-scope",
  category: "spec",
  title: "小さな範囲で全部調べる",
  subtitle: "3人の「上司」の関係を全部作る",
  summary: `3人の「上司」の関係を、あり得る形をすべて作って調べる。制約なしでは${FREE.total}通り中${FREE.counterexampleCount}通り、「自分を上司にしない」を足すと${NO_SELF.total}通り中${NO_SELF.counterexampleCount}通りが反例。「輪を作らない」まで足すと${NO_CYCLE.total}通りで反例${NO_CYCLE.counterexampleCount}。`,
  intro: [
    "小さな範囲で全部調べるとは、登場する人や物の数を少なく区切り、その中であり得る形を漏らさず作って確かめるやり方である。Alloy という道具がこの考え方で動く。",
    "データどうしの関係（ここでは誰が誰の上司か）は、テストデータを手で作ると、思いついた形しか試せない。前のレッスンがひとつの関数の入力を総当たりしたのに対し、ここでは関係の形そのものを総当たりする。",
    "図では、A さん・B さん・C さんのカードと、制約のカードを見る。アナライザが反例を見つけるたびに制約が足され、次にどんな形の反例が残るかが分かれ目になる。",
  ],
  facts: [
    { label: "人数", value: `${PEOPLE.length}人（${PEOPLE.join("・")}）` },
    {
      label: "制約なし",
      value: `${FREE.total}通り中${FREE.counterexampleCount}通りが反例`,
      tone: "bad",
    },
    {
      label: "制約2つ",
      value: `${NO_CYCLE.total}通り中${NO_CYCLE.counterexampleCount}通りが反例`,
      tone: "ok",
    },
    { label: "実物の道具", value: "Alloy" },
  ],
  actors: [
    {
      id: "A",
      label: "A さん",
      sublabel: "上司は0人か1人",
      icon: "person",
      x: 14,
      y: 27,
      initial: { rows: { 上司: "?" } },
    },
    {
      id: "B",
      label: "B さん",
      sublabel: "上司は0人か1人",
      icon: "person",
      x: 50,
      y: 27,
      initial: { rows: { 上司: "?" } },
    },
    {
      id: "C",
      label: "C さん",
      sublabel: "上司は0人か1人",
      icon: "person",
      x: 86,
      y: 27,
      initial: { rows: { 上司: "?" } },
    },
    {
      id: "rules",
      label: "制約",
      sublabel: "あり得る形を絞る",
      icon: "spec",
      x: 30,
      y: 73,
      initial: { rows: { 自分を上司: "禁止しない", 輪: "禁止しない" } },
    },
    {
      id: "analyzer",
      label: "アナライザ",
      sublabel: "形を全部作って調べる",
      icon: "checker",
      x: 70,
      y: 73,
      initial: { isHidden: true },
    },
  ],
  links: [
    { from: "rules", to: "analyzer" },
    { from: "analyzer", to: "A" },
    { from: "analyzer", to: "B" },
    { from: "analyzer", to: "C" },
  ],
  steps: [
    {
      id: "write-relation",
      kind: "spec",
      title: "関係を書く",
      actor: "rules",
      to: [...PEOPLE],
      summary: `${PEOPLE.length}人それぞれに、上司を「なし」か誰か1人で決める`,
      explain: `登場するのは${PEOPLE.join("・")}の${PEOPLE.length}人。各人の上司は「なし」か${PEOPLE.length}人のうち誰か1人なので、選び方は${PEOPLE.length + 1}通り。3人分を組み合わせると、あり得る形は全部で${FREE.total}通りになる。`,
      set: { rules: { rows: { 形の数: `${FREE.total}通り` } } },
    },
    {
      id: "write-property",
      kind: "spec",
      title: "性質を書く",
      actor: "analyzer",
      to: [...PEOPLE],
      summary: "確かめたい性質は「誰も自分の上司筋ではない」",
      explain:
        "上司の上司、そのまた上司とたどって自分に戻るなら、その人は自分の上司筋になっている。組織図としてあり得ないので、「誰も自分の上司筋ではない」を確かめたい性質にする。",
      set: {
        analyzer: { isHidden: false, rows: { 性質: "誰も自分の上司筋でない" } },
      },
    },
    {
      id: "explore",
      kind: "explore",
      title: "制約なしで全部作る",
      actor: "analyzer",
      to: [...PEOPLE],
      summary: `${FREE.total}通りを全部作り、${FREE.counterexampleCount}通りで性質が破れる`,
      explain: `アナライザは、制約を満たす形を範囲内で全部作り、1つずつ性質を当てる。制約なしの${FREE.total}通りのうち${FREE.counterexampleCount}通りで、誰かが自分の上司筋になった。Alloy は「多くの不具合は小さな例で見つかる」という小さな範囲仮説（small scope hypothesis）に立ち、人数を少なく区切る代わりに、その中は漏れなく調べる。`,
      set: {
        analyzer: {
          tone: "wait",
          rows: { 形: `${FREE.total}通り`, 反例: `${FREE.counterexampleCount}通り` },
        },
      },
    },
    {
      id: "found-self",
      kind: "found",
      title: "自分が自分の上司",
      actor: "analyzer",
      to: [...PEOPLE],
      summary: `最初の反例: ${describeBosses(FREE_COUNTER)}`,
      explain: `最初の反例は「${describeBosses(FREE_COUNTER)}」。自分を自分の上司にしている人がいる。仕様に「自分を上司にしない」と書いていなかったので、この形も許されていた。`,
      set: {
        ...showInstance(FREE_COUNTER, peopleInLoop(FREE_COUNTER)),
        analyzer: { tone: "bad" },
      },
    },
    {
      id: "forbid-self",
      kind: "fix",
      title: "自分を上司にしない",
      actor: "rules",
      to: ["analyzer"],
      summary: `制約を足すと${NO_SELF.total}通りに減るが、まだ${NO_SELF.counterexampleCount}通りが反例`,
      explain: `「自分を自分の上司にしない」を制約に足して、もう一度全部作る。形は${NO_SELF.total}通りに減ったが、まだ${NO_SELF.counterexampleCount}通りで性質が破れている。`,
      set: {
        ...IDLE_PEOPLE,
        rules: { rows: { 自分を上司: "禁止", 形の数: `${NO_SELF.total}通り` } },
        analyzer: {
          tone: "wait",
          rows: {
            形: `${NO_SELF.total}通り`,
            反例: `${NO_SELF.counterexampleCount}通り`,
          },
        },
      },
    },
    {
      id: "found-loop",
      kind: "found",
      title: "2人で輪になる",
      actor: "analyzer",
      to: [...PEOPLE],
      summary: `最初の反例: ${describeBosses(NO_SELF_COUNTER)}`,
      explain: `次の反例は「${describeBosses(NO_SELF_COUNTER)}」。互いを上司にしていて、たどると自分に戻る。1人で閉じた輪を禁じても、2人以上の輪は残っていた。`,
      set: {
        ...showInstance(NO_SELF_COUNTER, peopleInLoop(NO_SELF_COUNTER)),
        analyzer: { tone: "bad" },
      },
    },
    {
      id: "forbid-loop",
      kind: "fix",
      title: "輪を作らない",
      actor: "rules",
      to: ["analyzer"],
      summary: `「輪を作らない」を足すと${NO_CYCLE.total}通りすべてで性質が成り立つ`,
      explain: `「上司をたどって自分に戻る輪を作らない」を制約に足す。形は${NO_CYCLE.total}通りになり、反例は${NO_CYCLE.counterexampleCount}通り。3人の範囲では、どの形でも誰も自分の上司筋にならないと確かめられた。`,
      set: {
        ...IDLE_PEOPLE,
        rules: { tone: "ok", rows: { 輪: "禁止", 形の数: `${NO_CYCLE.total}通り` } },
        analyzer: {
          tone: "ok",
          rows: {
            形: `${NO_CYCLE.total}通り`,
            反例: `${NO_CYCLE.counterexampleCount}通り`,
          },
        },
      },
      simplified:
        "Alloy は関係を論理式で書き、範囲内の形を SAT ソルバ（論理式を満たす値の組を探す道具）で探す。ここでは3人の形を TypeScript で全部列挙して1つずつ調べている。どちらも範囲の外（4人以上）は確かめていない。同じ関係を Alloy 6 で書き、64・27・16通りの形と48・11・0通りの反例が一致することを確かめた（リポジトリの specs/alloy/Boss.als）。Alloy で解を数えるときは、性質を「some p: …」でなく集合の内包で書く必要がある（そうしないと p に当てはまる人ごとに同じ形を重ねて数え、48通りが78通りになる）。また、Alloy が最初に見せる反例はソルバ次第で、このページの「最初の反例」と同じとは限らない。",
    },
  ],
  lab: {
    title: "制約を付け外しする",
    hint: "2つの制約を「あり」「なし」で切り替える。「輪を作らない」は自分1人の輪も含むので、それだけでも反例は0になる。",
    inputs: [
      { id: "self", label: "自分を上司にしない（あり / なし）", initial: "なし" },
      { id: "cycle", label: "輪を作らない（あり / なし）", initial: "なし" },
    ],
    compute: (values): Field[] => {
      const forbidSelf = parseOn(values.self);
      const forbidCycle = parseOn(values.cycle);
      const result = checkBossInstances({ forbidSelf, forbidCycle });
      return [
        { label: "制約を満たす形", value: `${result.total}通り` },
        {
          label: "反例の数",
          value: `${result.counterexampleCount}通り`,
          tone: result.counterexampleCount > 0 ? "bad" : "ok",
        },
        {
          label: "最初の反例",
          value: result.firstCounterexample
            ? describeBosses(result.firstCounterexample)
            : "なし",
          tone: result.firstCounterexample ? "bad" : "ok",
        },
      ];
    },
  },
};
