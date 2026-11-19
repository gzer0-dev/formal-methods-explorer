import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { explore, normalizedStateCount } from "../csp";
import { CRYPTO_ENV, cryptographers } from "../cspCases";
import { PHILOSOPHER_ENV, philosophers } from "../cspModels";
import { philosopherTupleModel, symmetricStateCount } from "../explosion";
import { check } from "../modelCheck";

const MIN_PEOPLE = 2;
const MAX_PEOPLE = 7;
const PEOPLE = Array.from(
  { length: MAX_PEOPLE - MIN_PEOPLE + 1 },
  (_, i) => MIN_PEOPLE + i,
);

interface Row {
  people: number;
  full: number;
  symmetric: number;
}

// 2〜7人を1回ずつ計算する（合わせて数十ミリ秒）。同じ計算を二度呼ばない。
const ROWS: Row[] = PEOPLE.map((people) => ({
  people,
  full: check(philosopherTupleModel(people)).stateCount,
  symmetric: symmetricStateCount(people),
}));

function rowOf(people: number): Row {
  return ROWS.find((row) => row.people === people)!;
}

const FIRST = rowOf(MIN_PEOPLE);
const LAST = rowOf(MAX_PEOPLE);
const FOCUS = rowOf(5);
const TLC_PEOPLE = [2, 3, 4, 5];

/** CSP のモデルと素朴なモデルの状態数を突き合わせた人数（batch2.test.ts と同じ範囲）。 */
const CSP_MATCH_PEOPLE = [2, 3, 4];
const CSP_MATCHES = CSP_MATCH_PEOPLE.every(
  (n) => explore(philosophers(n, false), PHILOSOPHER_ENV).stateCount === rowOf(n).full,
);
if (!CSP_MATCHES) throw new Error("素朴なモデルと CSP のモデルで状態数が合わない");

const CRYPTO = cryptographers(0, false);
const CRYPTO_STATES = explore(CRYPTO, CRYPTO_ENV).stateCount;
const CRYPTO_NORMALIZED = normalizedStateCount(CRYPTO, CRYPTO_ENV);

function countsText(pick: (row: Row) => number, language: Language): string {
  if (language === "ja")
    return ROWS.map((row) => `${row.people}人${pick(row)}`).join("・");
  return ROWS.map((row) => `${row.people}: ${pick(row)}`).join(", ");
}

/** 1人増やすごとに何倍になったか（小数1桁）。 */
const GROWTH = ROWS.slice(1).map((row, i) => row.full / ROWS[i]!.full);
const GROWTH_MIN = Math.min(...GROWTH).toFixed(1);
const GROWTH_MAX = Math.max(...GROWTH).toFixed(1);

function divisorText(row: Row): string {
  return (row.full / row.symmetric).toFixed(1);
}

function parsePeople(text: string | undefined): number {
  const value = Number.parseInt((text ?? "").trim(), 10);
  // 読めない入力は既定の5人、範囲外は端に寄せる
  if (Number.isNaN(value)) return 5;
  return Math.min(Math.max(value, MIN_PEOPLE), MAX_PEOPLE);
}

export function stateExplosionLesson(language: Language): Lesson {
  const t = translator(language);
  const people = (n: number) => t(`${n}人`, `${n} people`);
  const counts = (pick: (row: Row) => number) => countsText(pick, language);
  const fraction = (row: Row) => t(`${divisorText(row)}分の1`, `1/${divisorText(row)}`);
  const peopleKey = t("人数", "people");
  const statesKey = t("状態", "states");
  const growthKey = t("増え方", "growth");
  return {
    id: "state-explosion",
    category: "model",
    title: t("状態爆発と戦う", "Fighting state explosion"),
    subtitle: t(
      "数を増やすと状態は急に増える。まとめて数えて減らす",
      "States grow fast as things are added; merge them to count fewer",
    ),
    summary: t(
      `食事する哲学者を${MIN_PEOPLE}人から${MAX_PEOPLE}人に増やすと、状態は${FIRST.full}から${LAST.full}に増える（状態爆発）。回して同じになる配置をまとめる対称性と、見える振る舞いだけを残す正規化で、調べる状態を減らす。`,
      `Growing the dining philosophers from ${MIN_PEOPLE} to ${MAX_PEOPLE} takes the states from ${FIRST.full} to ${LAST.full} (state explosion). Symmetry, which merges arrangements that are the same after rotating, and normalisation, which keeps only visible behaviour, reduce the states to check.`,
    ),
    intro: [
      t(
        "状態爆発は、モデルに登場する人や部品を増やすと、状態の数が掛け算で急に増える現象である。題材には食事する哲学者（円卓に座った哲学者が、隣どうしで共有するフォークを取り合う、並行処理の定番の問題）を使う。",
        "State explosion is when adding people or parts to a model makes the number of states multiply quickly. The example is the dining philosophers (philosophers at a round table competing for the forks they share with their neighbours, a classic concurrency problem).",
      ),
      t(
        "モデル検査（あり得る状態を機械的に全部たどって確かめること）は全部の状態をたどるので、状態が増えすぎると時間とメモリが足りなくなる。前のレッスンまでの小さなモデルでは問題にならなかったが、実際の設計を検査するときは、状態をどう減らすかを先に考えることになる。",
        "Model checking (mechanically walking every possible state) visits every state, so with too many states it runs out of time and memory. It was not a problem for the small models in earlier lessons, but when checking a real design you have to think first about how to reduce the states.",
      ),
      t(
        "図では、哲学者のモデルのカードで人数が増えたとき、モデル検査器のカードの数がどう伸びるかを見る。そのあと、対称性（全員の席を同じだけ回しても、振る舞いが変わらないこと）と正規化（外から見て区別できない状態をまとめること）のカードが、状態をまとめていく様子を追う。",
        "In the diagram, watch how the number on the model checker card grows as people are added on the philosophers card. Then follow the symmetry card (rotating everyone's seat by the same amount does not change the behaviour) and the normalisation card (merging states that look the same from outside) as they merge states.",
      ),
    ],
    facts: [
      { label: t("状態数", "States by people"), value: counts((row) => row.full) },
      {
        label: t("対称性で減らした数", "With symmetry"),
        value: counts((row) => row.symmetric),
      },
      {
        label: t("正規化（暗号学者）", "Normalised (cryptographers)"),
        value: t(
          `${CRYPTO_STATES}状態 → ${CRYPTO_NORMALIZED}状態`,
          `${CRYPTO_STATES} → ${CRYPTO_NORMALIZED} states`,
        ),
      },
      {
        label: t("実物の道具", "Real tools"),
        value: t("TLC の SYMMETRY、FDR の圧縮", "TLC SYMMETRY, FDR compression"),
      },
    ],
    actors: [
      {
        id: "model",
        label: t("哲学者のモデル", "Philosophers model"),
        sublabel: t("全員が左から取る", "all take left first"),
        icon: "people",
        x: 14,
        y: 50,
        initial: { rows: { [peopleKey]: people(FIRST.people) } },
      },
      {
        id: "checker",
        label: t("モデル検査器", "Model checker"),
        sublabel: t("状態を全部たどる", "walks every state"),
        icon: "checker",
        x: 38,
        y: 50,
        initial: { rows: { [statesKey]: t(`${FIRST.full}個`, `${FIRST.full}`) } },
      },
      {
        id: "symmetry",
        label: t("対称性", "Symmetry"),
        sublabel: t("回して同じなら1つ", "same after rotating: one"),
        icon: "shrink",
        x: 62,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "normalize",
        label: t("正規化", "Normalisation"),
        sublabel: t("見える振る舞いだけ残す", "keeps visible behaviour"),
        icon: "gear",
        x: 86,
        y: 50,
        initial: { isHidden: true },
      },
    ],
    stageHeight: 300,
    links: [
      { from: "model", to: "checker" },
      { from: "checker", to: "symmetry" },
      { from: "symmetry", to: "normalize" },
    ],
    steps: [
      {
        id: "grow",
        kind: "explore",
        title: t("人数を増やす", "Add people"),
        actor: "model",
        to: ["checker"],
        summary: t(
          `状態数は${counts((row) => row.full)}`,
          `States by people: ${counts((row) => row.full)}`,
        ),
        explain: t(
          `各哲学者は進み具合（左を待つ・右を待つ・食べる・置く途中）を持ち、フォークにはそれぞれ持ち主がいる。人数を${MIN_PEOPLE}人から${MAX_PEOPLE}人に増やすと、状態は${FIRST.full}から${LAST.full}に増えた。全部の組み合わせを数えるので、人数が増えるたびに掛け算で増える。`,
          `Each philosopher has a progress (waiting for left, waiting for right, eating, putting down), and each fork has an owner. Growing from ${MIN_PEOPLE} to ${MAX_PEOPLE} people took the states from ${FIRST.full} to ${LAST.full}. Every combination is counted, so each added person multiplies the count.`,
        ),
        set: {
          model: { rows: { [peopleKey]: people(LAST.people) } },
          checker: {
            tone: "wait",
            rows: { [statesKey]: t(`${LAST.full}個`, `${LAST.full}`) },
          },
        },
        detail: [
          {
            title: t("人数ごとの状態数", "States by number of people"),
            fields: ROWS.map((row) => ({
              label: people(row.people),
              value: t(`${row.full}状態`, `${row.full} states`),
            })),
          },
        ],
        simplified: t(
          `ここでは哲学者を CSP を使わずに「各人の進み具合とフォークの持ち主」の組で素朴に書いた。状態数は CSP のモデルと一致し（${CSP_MATCH_PEOPLE.join("・")}人で確かめた）、TLA+ の TLC でも2〜5人の${TLC_PEOPLE.map((n) => rowOf(n).full).join("・")}が一致した（specs/tla）。`,
          `Here the philosophers are written plainly, without CSP, as a tuple of each person's progress and each fork's owner. The state counts match the CSP model (checked for ${CSP_MATCH_PEOPLE.join(", ")} people), and TLC on TLA+ also matched ${TLC_PEOPLE.map((n) => rowOf(n).full).join(", ")} for 2-5 people (specs/tla).`,
        ),
      },
      {
        id: "why",
        kind: "explore",
        title: t("掛け算で増える", "It multiplies"),
        actor: "checker",
        summary: t(
          `1人増やすごとに状態は${GROWTH_MIN}〜${GROWTH_MAX}倍になる`,
          `Each added person multiplies the states by ${GROWTH_MIN}-${GROWTH_MAX}`,
        ),
        explain: t(
          `1人増やすごとに、状態は${GROWTH_MIN}〜${GROWTH_MAX}倍になった。人数を足すと増え方は掛け算になる（指数的に増える）。これが状態爆発で、モデル検査がすぐ時間とメモリを使い切る主な理由。`,
          `Each added person multiplied the states by ${GROWTH_MIN}-${GROWTH_MAX}. Adding people makes the growth multiplicative (exponential). This is state explosion, the main reason model checking quickly uses up time and memory.`,
        ),
        set: {
          checker: {
            tone: "bad",
            rows: {
              [growthKey]: t(
                `${GROWTH_MIN}〜${GROWTH_MAX}倍ずつ`,
                `×${GROWTH_MIN}-${GROWTH_MAX} each`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("1人増やしたときの倍率", "Growth per added person"),
            fields: ROWS.slice(1).map((row, i) => ({
              label: t(
                `${ROWS[i]!.people}人 → ${row.people}人`,
                `${ROWS[i]!.people} → ${row.people} people`,
              ),
              value: t(`${GROWTH[i]!.toFixed(1)}倍`, `×${GROWTH[i]!.toFixed(1)}`),
            })),
          },
        ],
      },
      {
        id: "symmetry",
        kind: "fix",
        title: t("回して同じを1つに", "Merge rotations into one"),
        actor: "symmetry",
        to: ["checker"],
        summary: t(
          `対称性: ${counts((row) => row.symmetric)}`,
          `With symmetry: ${counts((row) => row.symmetric)}`,
        ),
        explain: t(
          `全員が同じ規則で動くので、全員を1席ずつ回した配置は、回す前と同じように振る舞う。回して同じになる配置を1つに数えると、${FOCUS.people}人では${FOCUS.full}状態が${FOCUS.symmetric}状態になる。1つ調べれば、回した残りも調べたことになる。`,
          `Everyone follows the same rules, so an arrangement with everyone moved one seat over behaves just like the original. Counting arrangements that match after rotating as one, ${FOCUS.people} people go from ${FOCUS.full} states to ${FOCUS.symmetric}. Checking one covers its rotations too.`,
        ),
        set: {
          symmetry: {
            isHidden: false,
            tone: "ok",
            rows: { [people(FOCUS.people)]: `${FOCUS.full} → ${FOCUS.symmetric}` },
          },
          model: { rows: { [peopleKey]: people(FOCUS.people) } },
          checker: {
            tone: "ok",
            rows: {
              [statesKey]: t(`${FOCUS.symmetric}個`, `${FOCUS.symmetric}`),
              [growthKey]: null,
            },
          },
        },
        detail: [
          {
            title: t("回して同じ配置を1つに数えた数", "Counting rotations as one"),
            fields: ROWS.map((row) => ({
              label: people(row.people),
              value: t(
                `${row.full} → ${row.symmetric}状態`,
                `${row.full} → ${row.symmetric} states`,
              ),
            })),
          },
        ],
        simplified: t(
          "TLC には SYMMETRY という指定があり、入れ替えても振る舞いが変わらない値を入れ替えた状態を1つにまとめる。ここでは席が輪になっているので、入れ替えではなく回すことだけを考え、全部の状態を作ってから数え直している（実物は探索の途中でまとめる）。",
          "TLC has a SYMMETRY setting that merges states differing only by a swap of values that can be swapped without changing behaviour. Here the seats form a ring, so only rotations are considered, not arbitrary swaps, and the count is redone after building every state (the real tool merges during the search).",
        ),
      },
      {
        id: "ratio",
        kind: "explore",
        title: t("人数分の1に近づく", "Approaching 1/n"),
        actor: "symmetry",
        to: ["checker"],
        summary: t(
          `減った割合は${FIRST.people}人で${divisorText(FIRST)}分の1、${LAST.people}人で${divisorText(LAST)}分の1`,
          `Reduced to ${fraction(FIRST)} with ${FIRST.people} people and ${fraction(LAST)} with ${LAST.people}`,
        ),
        explain: t(
          `${FIRST.people}人では${FIRST.full}が${FIRST.symmetric}で、${divisorText(FIRST)}分の1にしかならない。全員が同じ進み具合のように、回しても変わらない配置があるため。人数が増えるほどそうした配置の割合が減り、${LAST.people}人では${divisorText(LAST)}分の1と、人数分の1に近づく。`,
          `With ${FIRST.people} people, ${FIRST.full} becomes ${FIRST.symmetric}, only ${fraction(FIRST)}. That is because some arrangements, such as everyone at the same progress, do not change when rotated. The more people, the smaller the share of such arrangements, and with ${LAST.people} it is ${fraction(LAST)}, close to one over the number of people.`,
        ),
        set: {
          symmetry: { rows: { [people(LAST.people)]: fraction(LAST) } },
        },
        detail: [
          {
            title: t("何分の1になったか", "Reduction factor"),
            fields: ROWS.map((row) => ({
              label: people(row.people),
              value: fraction(row),
            })),
          },
        ],
      },
      {
        id: "normalize",
        kind: "fix",
        title: t("見える動きだけ残す", "Keep only visible moves"),
        actor: "normalize",
        to: ["checker"],
        summary: t(
          `正規化: 食事する暗号学者は${CRYPTO_STATES}状態が${CRYPTO_NORMALIZED}状態になる`,
          `Normalisation: the dining cryptographers go from ${CRYPTO_STATES} states to ${CRYPTO_NORMALIZED}`,
        ),
        explain: t(
          `食事する暗号学者のモデルは${CRYPTO_STATES}状態あるが、外から見えるのは発言だけで、コインを見る動きは隠してある。見える発言の並びが同じなら、内部でどの状態にいるかを区別しないでまとめると、${CRYPTO_NORMALIZED}状態になる。FDR が仕様と比べる前に仕様を正規形にするのと同じ考え方。`,
          `The dining cryptographers model has ${CRYPTO_STATES} states, but only the announcements are visible; looking at the coins is hidden. Merging states without telling apart the internal state whenever the visible announcements so far are the same gives ${CRYPTO_NORMALIZED} states. It is the same idea as FDR putting a spec into normal form before comparing against it.`,
        ),
        set: {
          normalize: {
            isHidden: false,
            tone: "ok",
            rows: {
              [t("暗号学者", "cryptographers")]:
                `${CRYPTO_STATES} → ${CRYPTO_NORMALIZED}`,
            },
          },
        },
        simplified: t(
          "FDR には正規化（normal）などの圧縮の関数がある。ここでは、内部の動き（τ）だけで行ける状態をまとめ、同じ見える動きの後の状態を1つの組にする部分だけを小さく実装した（組を最小にする処理はしていない）。",
          "FDR has compression functions such as normalisation (normal). Here only a small part is implemented: merging states reachable by invisible moves (τ) alone, and grouping the states after the same visible moves into one set (the sets are not minimised).",
        ),
      },
      {
        id: "others",
        kind: "spec",
        title: t("ほかの減らし方", "Other reductions"),
        actor: "checker",
        summary: t(
          "半順序削減と合成的な検証も、よく使われる対策",
          "Partial order reduction and compositional verification are also common",
        ),
        explain: t(
          "半順序削減（partial order reduction）は、互いに影響しない動きの順を入れ替えた並びを1つだけ調べる。合成的な検証（compositional verification）は、部品ごとに確かめた結果を組み合わせて、全体を一度に展開しない。どちらもこのサイトでは計算していない。",
          "Partial order reduction checks only one of the orderings that differ just by swapping moves that do not affect each other. Compositional verification combines results checked part by part instead of expanding the whole system at once. Neither is computed on this site.",
        ),
        set: {
          checker: {
            tone: "idle",
            rows: {
              [t("対策", "remedies")]: t(
                "対称性・正規化ほか",
                "symmetry, normalisation, etc.",
              ),
            },
          },
        },
        detail: [
          {
            title: t("状態を減らす主な手", "Main ways to reduce states"),
            fields: [
              {
                label: t("対称性", "Symmetry"),
                value: t(
                  "回したり入れ替えたりして同じ状態をまとめる",
                  "Merge states that match after rotating or swapping",
                ),
              },
              {
                label: t("正規化（圧縮）", "Normalisation (compression)"),
                value: t(
                  "外から見える振る舞いだけを残す",
                  "Keep only behaviour visible from outside",
                ),
              },
              {
                label: t("半順序削減", "Partial order reduction"),
                value: t(
                  "影響しない動きの順の入れ替えを省く",
                  "Skip reorderings of independent moves",
                ),
              },
              {
                label: t("合成的な検証", "Compositional verification"),
                value: t(
                  "部品ごとに確かめて組み合わせる",
                  "Check each part and combine the results",
                ),
              },
            ],
          },
        ],
      },
      {
        id: "test",
        kind: "test",
        title: t("テストの同値分割", "Like equivalence partitioning"),
        actor: "model",
        to: ["checker"],
        summary: t(
          "同じ振る舞いになる入力をまとめるのは、テストの同値分割と同じ考え方",
          "Grouping inputs that behave the same is the idea behind equivalence partitioning",
        ),
        explain: t(
          "対称性で状態をまとめるのは、テストで同じ振る舞いになる入力を1つの代表で済ませる同値分割と同じ考え方。モデルを書くときも、区別しなくてよい値（同じ規則で動く利用者など）を区別しない形で書くと、調べる状態が減る。",
          "Merging states by symmetry is the same idea as equivalence partitioning in testing, where one representative stands in for inputs that behave the same. When writing a model, too, describing values that need not be told apart (such as users who follow the same rules) without telling them apart reduces the states to check.",
        ),
        set: { model: { tone: "ok" }, checker: { tone: "ok" } },
      },
    ],
    lab: {
      title: t("人数を変える", "Change the number of people"),
      hint: t(
        `人数は${MIN_PEOPLE}〜${MAX_PEOPLE}。${MAX_PEOPLE}人でも数十ミリ秒で数え終わる。人数が増えるほど、減った割合は人数分の1に近づく。`,
        `People from ${MIN_PEOPLE} to ${MAX_PEOPLE}. Even ${MAX_PEOPLE} people are counted in tens of milliseconds. The more people, the closer the reduction gets to one over the number of people.`,
      ),
      inputs: [
        {
          id: "people",
          label: t(
            `人数（${MIN_PEOPLE}〜${MAX_PEOPLE}）`,
            `People (${MIN_PEOPLE}-${MAX_PEOPLE})`,
          ),
          initial: "5",
        },
      ],
      compute: (values): Field[] => {
        const count = parsePeople(values.people);
        const row = rowOf(count);
        const percent = Math.round((row.symmetric / row.full) * 1000) / 10;
        return [
          { label: t("人数", "People"), value: people(count) },
          {
            label: t("状態数", "States"),
            value: t(`${row.full}個`, `${row.full}`),
            tone: "bad",
          },
          {
            label: t("対称性で減らした数", "With symmetry"),
            value: t(`${row.symmetric}個`, `${row.symmetric}`),
            tone: "ok",
          },
          {
            label: t("減った割合", "Reduction"),
            value: t(
              `${divisorText(row)}分の1（元の${percent}%）`,
              `${fraction(row)} (${percent}% of the original)`,
            ),
          },
        ];
      },
    },
  };
}
