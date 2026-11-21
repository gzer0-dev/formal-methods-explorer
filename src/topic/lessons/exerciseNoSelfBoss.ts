import { translator, type Language } from "../../core/i18n";
import type { ActorPatch, Lesson, Step } from "../../core/types";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";
import { describeBossesIn } from "../labels";
import {
  type BossInstance,
  checkBossInstances,
  isOwnAncestor,
  PEOPLE,
  type Person,
} from "../smallScope";

// 演習: 制約「自分を上司にしない」だけを入れたとき、反例が何通り残るか（元は exerciseModel.ts の問5）。
// 既定の図は3人と制約・性質だけを見せ、形の数や反例の例は出さない。答えを入れると、
// 制約で絞った形の数・2人の輪と3人の輪の例・その数え方が図に足される。
const NO_SELF = lazy(() =>
  checkBossInstances({ forbidSelf: true, forbidCycle: false }),
);
const FREE = lazy(() => checkBossInstances({ forbidSelf: false, forbidCycle: false }));

/** 上司をたどって自分に戻る人（輪に入っている人）。 */
function peopleInLoop(instance: BossInstance): Person[] {
  return PEOPLE.filter((person) => isOwnAncestor(instance, person));
}

/** 「自分を上司にしない」を満たす形を全部作る（数え方の内訳を見せるため。総数は checkBossInstances と同じになる）。 */
function noSelfInstances(): BossInstance[] {
  const choicesOf = (person: Person) => [null, ...PEOPLE.filter((p) => p !== person)];
  const instances: BossInstance[] = [];
  for (const a of choicesOf("A")) {
    for (const b of choicesOf("B")) {
      for (const c of choicesOf("C")) instances.push({ A: a, B: b, C: c });
    }
  }
  return instances;
}

// 反例を輪の人数で分ける。2人の輪は「輪になる組」ごとに、残る1人の上司の選び方の数だけある。
const BREAKDOWN = lazy(() => {
  const counterexamples = noSelfInstances().filter(
    (instance) => peopleInLoop(instance).length > 0,
  );
  const twoLoops = counterexamples.filter((i) => peopleInLoop(i).length === 2);
  const threeLoops = counterexamples.filter((i) => peopleInLoop(i).length === 3);
  const pairs = new Set(twoLoops.map((i) => peopleInLoop(i).join("")));
  return {
    twoLoops,
    threeLoops,
    pairCount: pairs.size,
    choicesPerPerson: PEOPLE.length,
  };
});

type Translate = (ja: string, en: string) => string;

export function exerciseNoSelfBossLesson(language: Language): Lesson {
  const t: Translate = translator(language);
  const describe = (instance: BossInstance) => describeBossesIn(instance, language);
  const shapes = (n: number) => t(`${n}通り`, `${n}`);
  const bossKey = t("上司", "boss");
  const selfKey = t("自分を上司", "self as boss");
  const loopKey = t("輪", "loops");
  const propertyKey = t("性質", "property");
  const shapeKey = t("形", "shapes");
  const counterKey = t("反例", "counterexamples");

  /** 形を3人のカードの「上司」の行に写す。輪に入っている人は赤にする。 */
  function showInstance(instance: BossInstance): Record<string, ActorPatch> {
    const inLoop = peopleInLoop(instance);
    return Object.fromEntries(
      PEOPLE.map((person) => [
        person,
        {
          tone: inLoop.includes(person) ? "bad" : "idle",
          rows: { [bossKey]: instance[person] ?? t("なし", "none") },
        },
      ]),
    );
  }

  const unknownPeople: Record<string, ActorPatch> = Object.fromEntries(
    PEOPLE.map((person) => [person, { tone: "idle", rows: { [bossKey]: "?" } }]),
  );

  const personActor = (id: Person, x: number) => ({
    id,
    label: t(`${id} さん`, id),
    sublabel: t("上司は0人か1人", "0 or 1 boss"),
    icon: "person",
    x,
    y: 27,
    initial: { rows: { [bossKey]: "?" } },
  });

  // 性質を破らない形の例（一列に並ぶ組織図）。答えの手掛かりにならないよう、反例でない形だけを見せる。
  const chain: BossInstance = { A: null, B: "A", C: "B" };

  function setupSteps(): Step[] {
    const free = FREE();
    return [
      {
        id: "write-relation",
        kind: "spec",
        title: t("3人の上司を決める", "Choose three bosses"),
        actor: "rules",
        to: [...PEOPLE],
        summary: t(
          `${PEOPLE.join("・")}の${PEOPLE.length}人に、上司を「なし」か誰か1人で決める`,
          `Give each of ${PEOPLE.join(", ")} a boss: "none" or one person`,
        ),
        explain: t(
          `各人の上司は「なし」か${PEOPLE.length}人のうち誰か1人で、選び方は${PEOPLE.length + 1}通り。制約が何も無ければ、3人分を組み合わせて${free.total}通りの形があり得る。`,
          `Each person's boss is "none" or one of the ${PEOPLE.length}, so there are ${PEOPLE.length + 1} choices. With no constraints, combining all three gives ${free.total} possible shapes.`,
        ),
        set: {
          rules: {
            rows: {
              [selfKey]: t("禁止しない", "allowed"),
              [loopKey]: t("禁止しない", "allowed"),
            },
          },
        },
      },
      {
        id: "constraint",
        kind: "spec",
        title: t("自分を上司にしない", "No one is their own boss"),
        actor: "rules",
        to: ["analyzer"],
        summary: t(
          "制約は「自分を上司にしない」だけ。性質は「上司をたどっても自分に戻らない」",
          'The only constraint is "no one is their own boss". The property: "following bosses never leads back to yourself"',
        ),
        explain: t(
          `制約「自分を自分の上司にしない」だけを入れ、輪そのものは禁じない。アナライザは制約を満たす形を全部作り、性質「上司をたどっても自分に戻らない」を1つずつ当てる。たとえば「${describe(chain)}」は一列に並ぶので、性質を守る。`,
          `Add only the constraint "no one is their own boss", and do not forbid loops themselves. The analyzer builds every shape that meets the constraint and applies the property "following bosses never leads back to yourself" to each. For example, "${describe(chain)}" is a single line, so it keeps the property.`,
        ),
        set: {
          ...showInstance(chain),
          A: { tone: "ok", rows: { [bossKey]: t("なし", "none") } },
          B: { tone: "ok" },
          C: { tone: "ok" },
          rules: { tone: "wait", rows: { [selfKey]: t("禁止", "forbidden") } },
          analyzer: {
            isHidden: false,
            rows: {
              [propertyKey]: t("自分に戻らない", "never back to self"),
            },
          },
        },
      },
      {
        id: "question",
        kind: "explore",
        title: t("反例は何通りか", "How many counterexamples?"),
        actor: "analyzer",
        to: [...PEOPLE],
        summary: t(
          "制約を満たす形のうち、性質を破る形が何通りあるかを答える",
          "Answer how many of the allowed shapes break the property",
        ),
        explain: t(
          "A・B・Cの3人に、それぞれ上司を1人か「なし」で決める。制約「自分を自分の上司にしない」だけを入れて、あり得る形を全部作る。性質「上司をたどっても自分に戻らない」を破る形は何通りか。下の「答え合わせ」に数を入れると、制約で絞った形と反例の数え方がこの図に足される。ヒント: 2人や3人で回る輪は、この制約では消えない。",
          'Give each of A, B and C one boss or "none". Add only the constraint "no one is their own boss" and build every possible shape. How many shapes break the property "following bosses never leads back to yourself"? Enter a number under "Check your answer" below and the allowed shapes and how to count the counterexamples are added to this diagram. Hint: loops through two or three people are not ruled out by this constraint.',
        ),
        set: {
          ...unknownPeople,
          rules: { tone: "idle" },
          analyzer: {
            tone: "wait",
            rows: { [t("問い", "question")]: t("反例は何通り？", "How many?") },
          },
        },
        simplified: t(
          "Alloy では形を SAT ソルバーで探し、数を数えるには解を1つずつ列挙する。ここでは3人の形を全部作って数えている（リポジトリの specs/alloy/Boss.als で同じ数を照合済み）。",
          "Alloy searches for shapes with a SAT solver, and counting them means listing solutions one by one. Here every shape for three people is built and counted (the same numbers are cross-checked in specs/alloy/Boss.als in the repository).",
        ),
      },
    ];
  }

  function solutionSteps(): Step[] {
    const result = NO_SELF();
    const free = FREE();
    const { twoLoops, threeLoops, pairCount, choicesPerPerson } = BREAKDOWN();
    const twoExample = twoLoops[0];
    const threeExample = threeLoops[0];
    const steps: Step[] = [
      {
        id: "narrow",
        kind: "explore",
        title: t("制約で形を絞る", "Narrow the shapes"),
        actor: "rules",
        to: ["analyzer"],
        summary: t(
          `${free.total}通りのうち、制約を満たすのは${result.total}通り`,
          `Of the ${free.total} shapes, ${result.total} meet the constraint`,
        ),
        explain: t(
          `自分を上司にできないので、各人の上司は「なし」か他の2人で${choicesPerPerson}通り。3人分で${result.total}通りの形が残る。アナライザはこの${result.total}通りに性質を当てる。`,
          `Since no one can be their own boss, each person's boss is "none" or one of the other two: ${choicesPerPerson} choices. For three people, ${result.total} shapes remain, and the analyzer applies the property to each of them.`,
        ),
        set: {
          rules: { tone: "ok" },
          analyzer: {
            tone: "wait",
            rows: {
              [t("問い", "question")]: null,
              [shapeKey]: shapes(result.total),
            },
          },
        },
      },
    ];
    if (twoExample) {
      steps.push({
        id: "loop-of-two",
        kind: "found",
        title: t("2人で輪になる", "A loop of two"),
        actor: "analyzer",
        to: [...PEOPLE],
        summary: t(
          `反例: ${describe(twoExample)}`,
          `Counterexample: ${describe(twoExample)}`,
        ),
        explain: t(
          `「${describe(twoExample)}」では、${peopleInLoop(twoExample).join("と")}が互いを上司にしていて、たどると自分に戻る。誰も自分を直接は上司にしていないので、制約は守っている。このような2人の輪は${twoLoops.length}通りある。`,
          `In "${describe(twoExample)}", ${peopleInLoop(twoExample).join(" and ")} are each other's boss, so following the chain leads back to yourself. No one is directly their own boss, so the constraint holds. There are ${twoLoops.length} shapes with a loop of two like this.`,
        ),
        set: {
          ...showInstance(twoExample),
          analyzer: {
            tone: "bad",
            rows: { [t("2人の輪", "loops of 2")]: shapes(twoLoops.length) },
          },
        },
      });
    }
    if (threeExample) {
      steps.push({
        id: "loop-of-three",
        kind: "found",
        title: t("3人で輪になる", "A loop of three"),
        actor: "analyzer",
        to: [...PEOPLE],
        summary: t(
          `反例: ${describe(threeExample)}`,
          `Counterexample: ${describe(threeExample)}`,
        ),
        explain: t(
          `「${describe(threeExample)}」では、3人がひと回りの輪になっている。回る向きが2つあるので、3人の輪は${threeLoops.length}通り。`,
          `In "${describe(threeExample)}", all three form one loop. A loop can go round in two directions, so there are ${threeLoops.length} shapes with a loop of three.`,
        ),
        set: {
          ...showInstance(threeExample),
          analyzer: {
            rows: { [t("3人の輪", "loops of 3")]: shapes(threeLoops.length) },
          },
        },
      });
    }
    steps.push({
      id: "count",
      kind: "found",
      title: t("反例を数える", "Count the counterexamples"),
      actor: "analyzer",
      to: ["rules"],
      summary: t(
        `${twoLoops.length}通りと${threeLoops.length}通りで、反例は${result.counterexampleCount}通り`,
        `${twoLoops.length} plus ${threeLoops.length}: ${result.counterexampleCount} counterexamples`,
      ),
      explain: t(
        `2人の輪は、輪になる組が${pairCount}組あり、残る1人の上司の選び方が${twoLoops.length / Math.max(pairCount, 1)}通りずつで${twoLoops.length}通り。これに3人の輪の${threeLoops.length}通りを足して、${result.total}通り中${result.counterexampleCount}通りが反例になる。自分1人の輪を禁じても2人以上の輪は残るので、輪そのものを禁じる制約が要る。`,
        `For loops of two, there are ${pairCount} pairs that can form the loop, and the remaining person has ${twoLoops.length / Math.max(pairCount, 1)} choices of boss each, giving ${twoLoops.length}. Adding the ${threeLoops.length} loops of three, ${result.counterexampleCount} of the ${result.total} shapes are counterexamples. Forbidding a loop of one still leaves loops of two or more, so you need a constraint that forbids loops themselves.`,
      ),
      set: {
        ...unknownPeople,
        analyzer: {
          tone: "bad",
          rows: {
            [propertyKey]: null,
            [t("2人の輪", "loops of 2")]: null,
            [t("3人の輪", "loops of 3")]: null,
            [counterKey]: shapes(result.counterexampleCount),
          },
        },
      },
    });
    return steps;
  }

  return buildExerciseLesson(
    {
      id: "exercise-no-self-boss",
      title: t("演習: 自分を上司にしない", "Exercise: not your own boss"),
      subtitle: t(
        "制約1つで、上司の輪は何通り残るか",
        "With one constraint, how many boss loops remain?",
      ),
      summary: t(
        "3人の上司の関係に制約「自分を上司にしない」だけを入れたとき、反例が何通り残るかを答える。答えを入れると、残った輪の形と数え方を図で追える。",
        'Answer how many counterexamples remain when the boss relation among three people has only the constraint "no one is their own boss". Once you answer, you can follow the loops that remain and how to count them.',
      ),
      intro: [
        t(
          "「小さな範囲で全部調べる」で見た3人の上司の関係を使う。制約を1つだけ入れて、性質「上司をたどっても自分に戻らない」を破る形がいくつ残るかを数える問題である。",
          'This uses the boss relation among three people from "Checking every small case". With only one constraint, count how many shapes still break the property "following bosses never leads back to yourself".',
        ),
        t(
          "図はまず3人のカードと制約・性質だけを見せる。下の「答え合わせ」に数を入れると、残る反例の形が3人のカードに写される。輪に入った人のカードが赤になるので、何人で回る輪が残るかを見る。",
          'The diagram first shows only the three people\'s cards, the constraint and the property. When you enter a number under "Check your answer", the counterexamples that remain are shown on the three cards. The cards of the people in a loop turn red, so look at how many people each remaining loop goes through.',
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t("上司の関係（3人）", "Boss relation (3 people)"),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("数（半角数字）", "A number (digits)"),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t("小さな範囲で全部調べる", '"Checking every small case"'),
        },
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
      answerType: "number",
      answerLabel: t("あなたの答え（反例の数）", "Your answer (counterexamples)"),
      hint: t(
        "性質を破る形の数を入れる。入れると、図に残る反例の形と数え方が足される。",
        "Enter the number of shapes that break the property. The remaining counterexamples and how to count them are then added to the diagram.",
      ),
      verdictActor: "analyzer",
      setupSteps: setupSteps(),
      solve: () => {
        const result = NO_SELF();
        const example = result.firstCounterexample
          ? t(
              `例: ${describe(result.firstCounterexample)}。`,
              `Example: ${describe(result.firstCounterexample)}. `,
            )
          : "";
        return {
          answer: result.counterexampleCount,
          reason: t(
            `制約を満たす形は${result.total}通りで、そのうち${result.counterexampleCount}通りに2人以上で回る輪が残る。${example}輪そのものを禁じる制約が要る。`,
            `${result.total} shapes satisfy the constraint, and ${result.counterexampleCount} of them still have a loop through two or more people. ${example}You need a constraint that forbids loops themselves.`,
          ),
        };
      },
      solutionSteps: () => solutionSteps(),
    },
    language,
  );
}
