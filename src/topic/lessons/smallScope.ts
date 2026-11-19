import { translator, type Language } from "../../core/i18n";
import type { ActorPatch, Field, Lesson } from "../../core/types";
import { describeBossesIn } from "../labels";
import { PEOPLE, checkBossInstances, isOwnAncestor } from "../smallScope";
import type { BossInstance } from "../smallScope";

const FREE = checkBossInstances({ forbidSelf: false, forbidCycle: false });
const NO_SELF = checkBossInstances({ forbidSelf: true, forbidCycle: false });
const NO_CYCLE = checkBossInstances({ forbidSelf: true, forbidCycle: true });
const FREE_COUNTER = FREE.firstCounterexample!;
const NO_SELF_COUNTER = NO_SELF.firstCounterexample!;

/** 上司をたどって自分に戻る人（自分の上司筋になっている人）。 */
function peopleInLoop(instance: BossInstance): string[] {
  return PEOPLE.filter((person) => isOwnAncestor(instance, person));
}

// 「あり」（英語では yes）のときだけ制約を付ける。
function parseOn(text: string | undefined): boolean {
  const value = text ?? "";
  return value.includes("あり") || /yes/i.test(value);
}

export function smallScopeLesson(language: Language): Lesson {
  const t = translator(language);
  const describe = (instance: BossInstance) => describeBossesIn(instance, language);
  const shapes = (n: number) => t(`${n}通り`, `${n}`);
  const bossKey = t("上司", "boss");
  const selfKey = t("自分を上司", "self as boss");
  const loopKey = t("輪", "loops");
  const shapeCountKey = t("形の数", "shapes");
  const shapeKey = t("形", "shapes");
  const counterKey = t("反例", "counterexamples");
  const allowed = t("禁止しない", "allowed");
  const forbidden = t("禁止", "forbidden");
  const ofShapes = (bad: number, total: number) =>
    t(`${total}通り中${bad}通りが反例`, `${bad} of ${total} are counterexamples`);

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
          rows: { [bossKey]: instance[person] ?? t("なし", "none") },
        },
      ]),
    );
  }

  const idlePeople: Record<string, ActorPatch> = Object.fromEntries(
    PEOPLE.map((person) => [person, { tone: "idle", rows: { [bossKey]: "?" } }]),
  );

  const personActor = (id: (typeof PEOPLE)[number], x: number) => ({
    id,
    label: t(`${id} さん`, id),
    sublabel: t("上司は0人か1人", "0 or 1 boss"),
    icon: "person",
    x,
    y: 27,
    initial: { rows: { [bossKey]: "?" } },
  });

  return {
    id: "small-scope",
    category: "spec",
    title: t("小さな範囲で全部調べる", "Checking every small case"),
    subtitle: t(
      "3人の「上司」の関係を全部作る",
      'Build every "boss" relation among three people',
    ),
    summary: t(
      `3人の「上司」の関係を、あり得る形をすべて作って調べる。制約なしでは${FREE.total}通り中${FREE.counterexampleCount}通り、「自分を上司にしない」を足すと${NO_SELF.total}通り中${NO_SELF.counterexampleCount}通りが反例。「輪を作らない」まで足すと${NO_CYCLE.total}通りで反例${NO_CYCLE.counterexampleCount}。`,
      `Check the "boss" relation among three people by building every possible shape. With no constraints, ${FREE.counterexampleCount} of ${FREE.total} are counterexamples; adding "no one is their own boss" leaves ${NO_SELF.counterexampleCount} of ${NO_SELF.total}. Adding "no loops" as well gives ${NO_CYCLE.total} shapes and ${NO_CYCLE.counterexampleCount} counterexamples.`,
    ),
    intro: [
      t(
        "小さな範囲で全部調べるとは、登場する人や物の数を少なく区切り、その中であり得る形を漏らさず作って確かめるやり方である。Alloy という道具がこの考え方で動く。",
        "Checking every small case means capping the number of people or things at a small size and building and checking every possible shape within that limit. The tool Alloy works this way.",
      ),
      t(
        "データどうしの関係（ここでは誰が誰の上司か）は、テストデータを手で作ると、思いついた形しか試せない。前のレッスンがひとつの関数の入力を総当たりしたのに対し、ここでは関係の形そのものを総当たりする。",
        "For relations between data (here, who is whose boss), hand-made test data only tries the shapes you think of. The previous lesson tried every input to one function; here we try every shape of the relation itself.",
      ),
      t(
        "図では、A さん・B さん・C さんのカードと、制約のカードを見る。アナライザが反例を見つけるたびに制約が足され、次にどんな形の反例が残るかが分かれ目になる。",
        "In the diagram, look at the cards for A, B and C and the constraints card. Each time the analyzer finds a counterexample a constraint is added, and the turning point is what shape of counterexample remains next.",
      ),
    ],
    facts: [
      {
        label: t("人数", "People"),
        value: t(
          `${PEOPLE.length}人（${PEOPLE.join("・")}）`,
          `${PEOPLE.length} (${PEOPLE.join(", ")})`,
        ),
      },
      {
        label: t("制約なし", "No constraints"),
        value: ofShapes(FREE.counterexampleCount, FREE.total),
        tone: "bad",
      },
      {
        label: t("制約2つ", "Two constraints"),
        value: ofShapes(NO_CYCLE.counterexampleCount, NO_CYCLE.total),
        tone: "ok",
      },
      { label: t("実物の道具", "Real tools"), value: "Alloy" },
    ],
    actors: [
      personActor("A", 14),
      personActor("B", 50),
      personActor("C", 86),
      {
        id: "rules",
        label: t("制約", "Constraints"),
        sublabel: t("あり得る形を絞る", "narrow the possible shapes"),
        icon: "spec",
        x: 30,
        y: 73,
        initial: { rows: { [selfKey]: allowed, [loopKey]: allowed } },
      },
      {
        id: "analyzer",
        label: t("アナライザ", "Analyzer"),
        sublabel: t("形を全部作って調べる", "builds and checks every shape"),
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
        title: t("関係を書く", "Write the relation"),
        actor: "rules",
        to: [...PEOPLE],
        summary: t(
          `${PEOPLE.length}人それぞれに、上司を「なし」か誰か1人で決める`,
          `For each of the ${PEOPLE.length} people, the boss is "none" or one person`,
        ),
        explain: t(
          `登場するのは${PEOPLE.join("・")}の${PEOPLE.length}人。各人の上司は「なし」か${PEOPLE.length}人のうち誰か1人なので、選び方は${PEOPLE.length + 1}通り。3人分を組み合わせると、あり得る形は全部で${FREE.total}通りになる。`,
          `There are ${PEOPLE.length} people: ${PEOPLE.join(", ")}. Each person's boss is "none" or one of the ${PEOPLE.length}, so there are ${PEOPLE.length + 1} choices. Combining all three gives ${FREE.total} possible shapes in total.`,
        ),
        set: { rules: { rows: { [shapeCountKey]: shapes(FREE.total) } } },
      },
      {
        id: "write-property",
        kind: "spec",
        title: t("性質を書く", "Write the property"),
        actor: "analyzer",
        to: [...PEOPLE],
        summary: t(
          "確かめたい性質は「誰も自分の上司筋ではない」",
          'The property to check: "no one is above themselves in the chain of bosses"',
        ),
        explain: t(
          "上司の上司、そのまた上司とたどって自分に戻るなら、その人は自分の上司筋になっている。組織図としてあり得ないので、「誰も自分の上司筋ではない」を確かめたい性質にする。",
          'If following boss, boss\'s boss and so on leads back to yourself, you are above yourself in the chain. That is impossible in an org chart, so "no one is above themselves in the chain" is the property to check.',
        ),
        set: {
          analyzer: {
            isHidden: false,
            rows: {
              [t("性質", "property")]: t(
                "誰も自分の上司筋でない",
                "no one is their own ancestor",
              ),
            },
          },
        },
      },
      {
        id: "explore",
        kind: "explore",
        title: t("制約なしで全部作る", "Build all, no constraints"),
        actor: "analyzer",
        to: [...PEOPLE],
        summary: t(
          `${FREE.total}通りを全部作り、${FREE.counterexampleCount}通りで性質が破れる`,
          `Build all ${FREE.total}; the property breaks in ${FREE.counterexampleCount}`,
        ),
        explain: t(
          `アナライザは、制約を満たす形を範囲内で全部作り、1つずつ性質を当てる。制約なしの${FREE.total}通りのうち${FREE.counterexampleCount}通りで、誰かが自分の上司筋になった。Alloy は「多くの不具合は小さな例で見つかる」という小さな範囲仮説（small scope hypothesis）に立ち、人数を少なく区切る代わりに、その中は漏れなく調べる。`,
          `The analyzer builds every shape within the scope that meets the constraints and applies the property to each. Of the ${FREE.total} unconstrained shapes, ${FREE.counterexampleCount} have someone above themselves. Alloy rests on the small scope hypothesis ("most bugs show up in small examples"): it caps the number of people low, and in exchange checks everything inside that cap.`,
        ),
        set: {
          analyzer: {
            tone: "wait",
            rows: {
              [shapeKey]: shapes(FREE.total),
              [counterKey]: shapes(FREE.counterexampleCount),
            },
          },
        },
      },
      {
        id: "found-self",
        kind: "found",
        title: t("自分が自分の上司", "Your own boss"),
        actor: "analyzer",
        to: [...PEOPLE],
        summary: t(
          `最初の反例: ${describe(FREE_COUNTER)}`,
          `First counterexample: ${describe(FREE_COUNTER)}`,
        ),
        explain: t(
          `最初の反例は「${describe(FREE_COUNTER)}」。自分を自分の上司にしている人がいる。仕様に「自分を上司にしない」と書いていなかったので、この形も許されていた。`,
          `The first counterexample is "${describe(FREE_COUNTER)}". Someone is their own boss. The spec did not say "no one is their own boss", so this shape was allowed too.`,
        ),
        set: {
          ...showInstance(FREE_COUNTER, peopleInLoop(FREE_COUNTER)),
          analyzer: { tone: "bad" },
        },
      },
      {
        id: "forbid-self",
        kind: "fix",
        title: t("自分を上司にしない", "No one is their own boss"),
        actor: "rules",
        to: ["analyzer"],
        summary: t(
          `制約を足すと${NO_SELF.total}通りに減るが、まだ${NO_SELF.counterexampleCount}通りが反例`,
          `With the constraint, the shapes drop to ${NO_SELF.total}, but ${NO_SELF.counterexampleCount} are still counterexamples`,
        ),
        explain: t(
          `「自分を自分の上司にしない」を制約に足して、もう一度全部作る。形は${NO_SELF.total}通りに減ったが、まだ${NO_SELF.counterexampleCount}通りで性質が破れている。`,
          `Add "no one is their own boss" as a constraint and build everything again. The shapes drop to ${NO_SELF.total}, but the property still breaks in ${NO_SELF.counterexampleCount}.`,
        ),
        set: {
          ...idlePeople,
          rules: {
            rows: { [selfKey]: forbidden, [shapeCountKey]: shapes(NO_SELF.total) },
          },
          analyzer: {
            tone: "wait",
            rows: {
              [shapeKey]: shapes(NO_SELF.total),
              [counterKey]: shapes(NO_SELF.counterexampleCount),
            },
          },
        },
      },
      {
        id: "found-loop",
        kind: "found",
        title: t("2人で輪になる", "A loop of two"),
        actor: "analyzer",
        to: [...PEOPLE],
        summary: t(
          `最初の反例: ${describe(NO_SELF_COUNTER)}`,
          `First counterexample: ${describe(NO_SELF_COUNTER)}`,
        ),
        explain: t(
          `次の反例は「${describe(NO_SELF_COUNTER)}」。互いを上司にしていて、たどると自分に戻る。1人で閉じた輪を禁じても、2人以上の輪は残っていた。`,
          `The next counterexample is "${describe(NO_SELF_COUNTER)}". They are each other's boss, so following the chain leads back to yourself. Forbidding a loop of one still left loops of two or more.`,
        ),
        set: {
          ...showInstance(NO_SELF_COUNTER, peopleInLoop(NO_SELF_COUNTER)),
          analyzer: { tone: "bad" },
        },
      },
      {
        id: "forbid-loop",
        kind: "fix",
        title: t("輪を作らない", "No loops"),
        actor: "rules",
        to: ["analyzer"],
        summary: t(
          `「輪を作らない」を足すと${NO_CYCLE.total}通りすべてで性質が成り立つ`,
          `Adding "no loops" makes the property hold in all ${NO_CYCLE.total} shapes`,
        ),
        explain: t(
          `「上司をたどって自分に戻る輪を作らない」を制約に足す。形は${NO_CYCLE.total}通りになり、反例は${NO_CYCLE.counterexampleCount}通り。3人の範囲では、どの形でも誰も自分の上司筋にならないと確かめられた。`,
          `Add the constraint "no loop where following bosses leads back to yourself". The shapes become ${NO_CYCLE.total}, with ${NO_CYCLE.counterexampleCount} counterexamples. Within the scope of three people, it is confirmed that in every shape no one is above themselves.`,
        ),
        set: {
          ...idlePeople,
          rules: {
            tone: "ok",
            rows: { [loopKey]: forbidden, [shapeCountKey]: shapes(NO_CYCLE.total) },
          },
          analyzer: {
            tone: "ok",
            rows: {
              [shapeKey]: shapes(NO_CYCLE.total),
              [counterKey]: shapes(NO_CYCLE.counterexampleCount),
            },
          },
        },
        simplified: t(
          "Alloy は関係を論理式で書き、範囲内の形を SAT ソルバ（論理式を満たす値の組を探す道具）で探す。ここでは3人の形を TypeScript で全部列挙して1つずつ調べている。どちらも範囲の外（4人以上）は確かめていない。同じ関係を Alloy 6 で書き、64・27・16通りの形と48・11・0通りの反例が一致することを確かめた（リポジトリの specs/alloy/Boss.als）。Alloy で解を数えるときは、性質を「some p: …」でなく集合の内包で書く必要がある（そうしないと p に当てはまる人ごとに同じ形を重ねて数え、48通りが78通りになる）。また、Alloy が最初に見せる反例はソルバ次第で、このページの「最初の反例」と同じとは限らない。",
          'Alloy writes the relation as logical formulas and searches the shapes in scope with a SAT solver (a tool that finds values satisfying a formula). Here every shape for three people is listed in TypeScript and checked one by one. Neither checks outside the scope (four or more people). The same relation written in Alloy 6 matched 64, 27 and 16 shapes and 48, 11 and 0 counterexamples (specs/alloy/Boss.als in the repository). When counting solutions in Alloy, the property must be written as a set comprehension, not "some p: ..." (otherwise the same shape is counted once per person p fits, and 48 becomes 78). Also, which counterexample Alloy shows first depends on the solver and may differ from the "first counterexample" on this page.',
        ),
      },
    ],
    lab: {
      title: t("制約を付け外しする", "Toggle the constraints"),
      hint: t(
        "2つの制約を「あり」「なし」で切り替える。「輪を作らない」は自分1人の輪も含むので、それだけでも反例は0になる。",
        'Switch the two constraints with "yes" and "no". "No loops" includes a loop of one person, so it alone brings the counterexamples to 0.',
      ),
      inputs: [
        {
          id: "self",
          label: t(
            "自分を上司にしない（あり / なし）",
            "No one is their own boss (yes / no)",
          ),
          initial: t("なし", "no"),
        },
        {
          id: "cycle",
          label: t("輪を作らない（あり / なし）", "No loops (yes / no)"),
          initial: t("なし", "no"),
        },
      ],
      compute: (values): Field[] => {
        const forbidSelf = parseOn(values.self);
        const forbidCycle = parseOn(values.cycle);
        const result = checkBossInstances({ forbidSelf, forbidCycle });
        return [
          { label: t("制約を満たす形", "Shapes allowed"), value: shapes(result.total) },
          {
            label: t("反例の数", "Counterexamples"),
            value: shapes(result.counterexampleCount),
            tone: result.counterexampleCount > 0 ? "bad" : "ok",
          },
          {
            label: t("最初の反例", "First counterexample"),
            value: result.firstCounterexample
              ? describe(result.firstCounterexample)
              : t("なし", "none"),
            tone: result.firstCounterexample ? "bad" : "ok",
          },
        ];
      },
    },
  };
}
