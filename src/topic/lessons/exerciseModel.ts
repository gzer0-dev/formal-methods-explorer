import { translator, type Language } from "../../core/i18n";
import type { Actor, Lesson, Link, Step } from "../../core/types";
import { type ExerciseQuestion, gradeExercise, lazy } from "../exercise";
import { displayNames, describeBossesIn } from "../labels";
import { check, checkEventually, countExecutions } from "../modelCheck";
import {
  counterModel,
  isCounterCorrect,
  isJobFinished,
  jobModel,
  lockModel,
} from "../models";
import {
  formatArray,
  hasNoDuplicates,
  removeAdjacentDuplicates,
  runPropertyTest,
  type Property,
} from "../pbt";
import { checkBossInstances } from "../smallScope";

// 問題の条件。どれも、出題範囲のレッスン（lostUpdate・deadlock・liveness・smallScope・propertyTest）と同じにしてある。
// 条件を変えると、レッスンで見た数と演習の正解が食い違う。
const PROCESS_COUNT = 3;
const RETRY_LIMIT = 2;
const PBT_SEED = 7;
const PBT_RUNS = 100;
// propertyTest.ts と同じ性質: 出力に重複が無い、かつ入力にあった値が全部出力に残っている。
const PBT_PROPERTY: Property = (input, output) =>
  hasNoDuplicates(output) && input.every((value) => output.includes(value));

// 正解の計算。答え合わせのときに初めて呼ばれ、言語をまたいで使い回す（手で書いた正解の値は置かない）。
const Q1_RUNS = lazy(() =>
  countExecutions(counterModel(PROCESS_COUNT, false), isCounterCorrect),
);
const Q2_TRACE = lazy(() => check(counterModel(2, false)).violation);
const Q3_LOCKS = lazy(() => ({
  same: check(lockModel(true)),
  reversed: check(lockModel(false)),
}));
const Q4_JOBS = lazy(() => ({
  unlimited: checkEventually(jobModel(null), isJobFinished),
  limited: checkEventually(jobModel(RETRY_LIMIT), isJobFinished),
}));
const Q5_BOSSES = lazy(() =>
  checkBossInstances({ forbidSelf: true, forbidCycle: false }),
);
const Q6_PBT = lazy(() =>
  runPropertyTest(removeAdjacentDuplicates, PBT_PROPERTY, {
    seed: PBT_SEED,
    runs: PBT_RUNS,
  }),
);

type Translate = (ja: string, en: string) => string;

interface ModelQuestion extends ExerciseQuestion {
  id: string;
  kind: string;
  subject: string;
  summary: string;
  explain: string;
  simplified?: string;
}

function actionsText(trace: { action: string | null }[], language: Language): string {
  return displayNames(
    trace.slice(1).map((step) => step.action ?? ""),
    language,
  );
}

function questionsOf(language: Language): ModelQuestion[] {
  const t: Translate = translator(language);
  return [
    {
      id: "q1-three-processes",
      title: t("問1 3つで消える並び", "Q1 Lost updates with three"),
      kind: "explore",
      subject: t("カウンタ", "Counter"),
      answerType: "number",
      summary: t(
        `カウンタを${PROCESS_COUNT}つのプロセスにしたとき、更新が消える並びを数える`,
        `Count the interleavings that lose an update with ${PROCESS_COUNT} processes`,
      ),
      explain: t(
        `「テストが見逃すバグ」のカウンタを、${PROCESS_COUNT}つのプロセスにする。どれも「読む」「書く」の2手で count に1を足す。最後に count が${PROCESS_COUNT}にならない並びは何通りか。ヒント: 並びの総数から、どのプロセスも他と読み書きが重ならない並びを引く。`,
        `Take the counter from "The bug your tests miss" and use ${PROCESS_COUNT} processes. Each adds 1 to count in two steps, "read" and "write". How many interleavings end with count not equal to ${PROCESS_COUNT}? Hint: from the total, subtract the interleavings where no process's read and write overlap with another's.`,
      ),
      solve: () => {
        const runs = Q1_RUNS();
        return {
          answer: runs.bad,
          reason: t(
            `${PROCESS_COUNT}つのプロセスが2手ずつ動く並びは${runs.total}通り。正しく終わるのは、読んでから書くまでに他のプロセスが割り込まない${runs.good}通りだけで、残りの${runs.bad}通りでは誰かの更新が消える。`,
            `With ${PROCESS_COUNT} processes taking two steps each there are ${runs.total} interleavings. Only the ${runs.good} where no other process slips in between a read and its write end correctly; in the other ${runs.bad}, someone's update is lost.`,
          ),
        };
      },
    },
    {
      id: "q2-shortest",
      title: t("問2 最短の反例の手数", "Q2 Shortest counterexample"),
      kind: "found",
      subject: t("カウンタ", "Counter"),
      answerType: "number",
      summary: t(
        "2つのプロセスのカウンタで、最短の反例が何手かを答える",
        "How many steps is the shortest counterexample for two processes?",
      ),
      explain: t(
        "2つのプロセスのカウンタを、モデル検査器で調べる。不変条件「全員が終わったら count は2」を破る反例のうち、いちばん短いものは何手か。ヒント: 検査器は幅優先（近い状態から順に）でたどる。",
        'Check the two-process counter with the model checker. Of the counterexamples that break the invariant "when everyone is done, count is 2", how many steps is the shortest? Hint: the checker searches breadth-first (nearest states first).',
      ),
      solve: () => {
        const trace = Q2_TRACE();
        if (!trace) {
          return {
            answer: 0,
            reason: t("反例が見つからなかった。", "No counterexample was found."),
          };
        }
        return {
          answer: trace.length - 1,
          reason: t(
            `幅優先でたどるので、最初に見つかった反例が最短になる。手順は${actionsText(trace, language)}。2人とも書く前に読まないと更新は消えないので、これより短くはならない。`,
            `The search is breadth-first, so the first counterexample found is the shortest. The steps are ${actionsText(trace, language)}. An update is lost only if both read before either writes, so it cannot be shorter.`,
          ),
        };
      },
      simplified: t(
        "TLC も幅優先でたどるので、同じモデルを TLA+ で書くと同じ長さの反例が出る（リポジトリの specs/tla/Counter.tla）。",
        "TLC also searches breadth-first, so the same model written in TLA+ gives a counterexample of the same length (specs/tla/Counter.tla in the repository).",
      ),
    },
    {
      id: "q3-same-order",
      title: t("問3 同じ順でロック", "Q3 Locks in the same order"),
      kind: "fix",
      subject: t("2つのロック", "Two locks"),
      answerType: "yesno",
      summary: t(
        "2つのスレッドがロックを同じ順に取るとき、デッドロックするかを答える",
        "Do two threads deadlock when they take the locks in the same order?",
      ),
      explain: t(
        "2つのスレッドが L1と L2を両方取ってから仕事をする。2つとも「L1 → L2」の同じ順で取るとき、デッドロック（互いに相手を待って動けなくなること）は起きるか。ヒント: 1つ目を取れなかったスレッドが、何を持ったまま待つかを考える。",
        'Two threads each take both L1 and L2 before doing their work. If both take them in the same order, "L1 → L2", can a deadlock (each waiting on the other, so neither can move) happen? Hint: think about what a thread is holding while it waits for the first lock.',
      ),
      solve: () => {
        const { same, reversed } = Q3_LOCKS();
        const reversedText = reversed.deadlock
          ? t(
              `取る順が逆なら${reversed.deadlock.length - 1}手（${actionsText(reversed.deadlock, language)}）で止まる。`,
              `In opposite orders it gets stuck in ${reversed.deadlock.length - 1} steps (${actionsText(reversed.deadlock, language)}).`,
            )
          : "";
        return {
          answer: same.deadlock !== null,
          reason: t(
            `同じ順なら、L1を取れなかった方は何も持たずに待つので、互いに待ち合う輪ができない。${same.stateCount}状態を全部たどっても、動けなくなる状態は無かった。${reversedText}`,
            `In the same order, the thread that misses L1 waits holding nothing, so no cycle of waiting can form. Walking all ${same.stateCount} states found no state where they are stuck. ${reversedText}`,
          ).trim(),
        };
      },
    },
    {
      id: "q4-unlimited-retry",
      title: t("問4 上限の無いリトライ", "Q4 Retries without a limit"),
      kind: "explore",
      subject: t("リトライ付きのジョブ", "Job with retries"),
      answerType: "yesno",
      summary: t(
        "リトライに上限が無いとき、「いつか必ず終わる」が成り立つかを答える",
        'With unlimited retries, does "it always finishes eventually" hold?',
      ),
      explain: t(
        "失敗したら待ちに戻してやり直すジョブで、やり直しの回数に上限を付けない。このとき「ジョブはいつか必ず成功か断念で終わる」は成り立つか。ヒント: 成功できる場面でも、毎回失敗する実行があり得る。",
        'A job that goes back to waiting and tries again after a failure, with no limit on retries. Does "the job always ends eventually, by succeeding or giving up" hold? Hint: even when it could succeed, there can be a run that fails every time.',
      ),
      solve: () => {
        const { unlimited, limited } = Q4_JOBS();
        const cycleText = unlimited.cycle
          ? t(
              `（${actionsText(unlimited.cycle, language)}）`,
              ` (${actionsText(unlimited.cycle, language)})`,
            )
          : "";
        return {
          answer: unlimited.holds,
          reason: t(
            `失敗して待ちに戻る輪${cycleText}を回り続ける実行があり、終わらない。上限を${RETRY_LIMIT}回にすると${limited.holds ? "成り立つ" : "成り立たない"}。`,
            `There is a run that keeps going round the loop of failing and returning to waiting${cycleText}, and never ends. With a limit of ${RETRY_LIMIT} retries it ${limited.holds ? "holds" : "still does not hold"}.`,
          ),
        };
      },
      simplified: t(
        "この検査器は公平性（成功できる状態が続くなら、いつかは成功する、などの仮定）を置かず、失敗し続ける実行も反例に数える。TLA+ で強い公平性 SF(Succeed) を置くと、上限が無くても成り立つ。",
        'This checker assumes no fairness (assumptions such as "if success stays possible, it eventually succeeds"), so a run that keeps failing counts as a counterexample. With strong fairness SF(Succeed) in TLA+, it holds even without a limit.',
      ),
    },
    {
      id: "q5-no-self-boss",
      title: t("問5 自分を上司にしない", "Q5 No one is their own boss"),
      kind: "spec",
      subject: t("上司の関係（3人）", "Boss relation (3 people)"),
      answerType: "number",
      summary: t(
        "制約「自分を上司にしない」だけを入れたとき、反例が何通り残るかを数える",
        'Count the counterexamples left with only "no one is their own boss"',
      ),
      explain: t(
        "A・B・Cの3人に、それぞれ上司を1人か「なし」で決める。制約「自分を自分の上司にしない」だけを入れて、あり得る形を全部作る。性質「上司をたどっても自分に戻らない」を破る形は何通りか。ヒント: 2人や3人で回る輪は、この制約では消えない。",
        'Give each of A, B and C one boss or "none". Add only the constraint "no one is their own boss" and build every possible shape. How many shapes break the property "following bosses never leads back to yourself"? Hint: loops through two or three people are not ruled out by this constraint.',
      ),
      solve: () => {
        const result = Q5_BOSSES();
        const example = result.firstCounterexample
          ? t(
              `例: ${describeBossesIn(result.firstCounterexample, language)}。`,
              `Example: ${describeBossesIn(result.firstCounterexample, language)}. `,
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
      simplified: t(
        "Alloy では形を SAT ソルバーで探し、数を数えるには解を1つずつ列挙する。ここでは3人の形を全部作って数えている（リポジトリの specs/alloy/Boss.als で同じ数を照合済み）。",
        "Alloy searches for shapes with a SAT solver, and counting them means listing solutions one by one. Here every shape for three people is built and counted (the same numbers are cross-checked in specs/alloy/Boss.als in the repository).",
      ),
    },
    {
      id: "q6-shrunk",
      title: t("問6 縮めた反例の長さ", "Q6 Length after shrinking"),
      kind: "test",
      subject: t("性質ベーステスト", "Property-based testing"),
      answerType: "number",
      summary: t(
        `シード${PBT_SEED}で性質ベーステストを流し、縮めた反例の長さを答える`,
        `Run a property-based test with seed ${PBT_SEED}; how long is the shrunk counterexample?`,
      ),
      explain: t(
        `重複を取り除く関数の誤った実装（隣どうしだけ比べる）に、性質ベーステストをシード${PBT_SEED}で${PBT_RUNS}回まで流す。性質は「出力に重複が無く、入力の値が全部残る」。見つかった反例を縮めきると、配列の長さ（要素の数）はいくつか。ヒント: 隣どうしが違う値で、同じ値がどこかに2回あれば破れる。`,
        `Run a property-based test, with seed ${PBT_SEED} and up to ${PBT_RUNS} runs, against a buggy function that removes duplicates (it compares only neighbours). The property is "the output has no duplicates and keeps every input value". Once the counterexample is fully shrunk, what is the array's length (number of elements)? Hint: it breaks when neighbours differ but some value appears twice.`,
      ),
      solve: () => {
        const result = Q6_PBT();
        if (!result.failing || !result.shrunk) {
          return {
            answer: 0,
            reason: t("反例が見つからなかった。", "No counterexample was found."),
          };
        }
        return {
          answer: result.shrunk.length,
          reason: t(
            `${result.runs}回目の入力${formatArray(result.failing)}で破れ、縮めきると${formatArray(result.shrunk)}になる。出力は${formatArray(removeAdjacentDuplicates(result.shrunk))}で重複が残る。これより要素を減らすと、隣どうしでない重複が作れない。`,
            `It breaks on run ${result.runs} with input ${formatArray(result.failing)}, and shrinks to ${formatArray(result.shrunk)}. The output is ${formatArray(removeAdjacentDuplicates(result.shrunk))}, which still has a duplicate. With fewer elements you cannot have a duplicate that is not adjacent.`,
          ),
        };
      },
      simplified: t(
        "fast-check などの実物は、縮め方の候補がもっと多く、値の型ごとに縮め方を持っている。ここでは「要素を1つ消す」「値を小さくする」だけを欲張りに試している。",
        'Real tools such as fast-check try many more shrink candidates and know how to shrink each type of value. Here it greedily tries only "remove one element" and "make a value smaller".',
      ),
    },
  ];
}

const LINKS: Link[] = [
  { from: "question", to: "you" },
  { from: "you", to: "checker" },
];

function actorsOf(t: Translate): Actor[] {
  return [
    {
      id: "question",
      label: t("問題", "Question"),
      sublabel: t("モデル検査の演習", "model checking"),
      icon: "document",
      x: 20,
      y: 50,
    },
    {
      id: "you",
      label: t("あなた", "You"),
      sublabel: t("答えを考える", "thinks it over"),
      icon: "person",
      x: 50,
      y: 50,
    },
    {
      id: "checker",
      label: t("検査器", "Checker"),
      sublabel: t("答え合わせ", "grades it"),
      icon: "checker",
      x: 80,
      y: 50,
    },
  ];
}

function stepOf(question: ModelQuestion, index: number, t: Translate): Step {
  const answerTypeText =
    question.answerType === "number"
      ? t("数", "number")
      : t("はい／いいえ", "yes / no");
  return {
    id: question.id,
    kind: question.kind,
    title: question.title,
    actor: "question",
    to: ["you"],
    summary: question.summary,
    explain: question.explain,
    set: {
      question: {
        rows: {
          [t("番号", "number")]: t(`問${index + 1}`, `Q${index + 1}`),
          [t("題材", "subject")]: question.subject,
        },
      },
      you: { tone: "wait", rows: { [t("答えの形", "answer")]: answerTypeText } },
      checker: { rows: { [t("入れる番号", "enter")]: String(index + 1) } },
    },
    ...(question.simplified ? { simplified: question.simplified } : {}),
  };
}

export function exerciseModelLesson(language: Language): Lesson {
  const t = translator(language);
  const questions = questionsOf(language);
  return {
    id: "exercise-model",
    category: "exercise",
    title: t("演習: モデル検査", "Exercises: model checking"),
    subtitle: t(
      "学んだことを、自分で答えて確かめる",
      "Check what you learned by answering yourself",
    ),
    summary: t(
      `カウンタ・ロック・リトライ・上司の関係・性質ベーステストから${questions.length}問。答えは下の欄に入れると、このページの検査器が計算して答え合わせをする。`,
      `${questions.length} questions on the counter, locks, retries, the boss relation and property-based testing. Enter your answer in the box below and the checker in this page computes the answer and grades it.`,
    ),
    intro: [
      t(
        "モデル検査と性質ベーステストのレッスンで見た題材を、条件を少し変えて自分で答える演習である。図を見て分かったつもりのことが、自分の手で使えるかを確かめる。",
        "These exercises take the examples from the model checking and property-based testing lessons, change the conditions a little, and ask you to answer. They check whether what seemed clear in the diagrams is something you can use yourself.",
      ),
      t(
        "どの並びで壊れるか、何通りあるか、止まるかどうかを自分で見積もれると、テストで狙うべき場面を絞りやすくなる。外したときは、答え合わせに出る理由を読み、元のレッスンの図に戻って見直すとよい。",
        "If you can estimate which orders break, how many there are, and whether it gets stuck, it becomes easier to pick the cases your tests should aim at. If you get one wrong, read the explanation shown with the result and go back to the diagram in the original lesson.",
      ),
      t(
        "図は1問ずつ進む。問題のカードの説明とヒントを読んで答えを考え、下の「答え合わせ」の欄に、検査器のカードに出ている番号と自分の答えを入れて確かめる。",
        'The diagram moves one question at a time. Read the description and hint on the question card, work out your answer, then enter the number shown on the checker card and your answer in the "Check your answer" box below.',
      ),
    ],
    facts: [
      {
        label: t("問題の数", "Questions"),
        value: t(`${questions.length}問`, `${questions.length}`),
      },
      {
        label: t("答え方", "How to answer"),
        value: t(
          "数は半角数字、ほかは「はい」か「いいえ」",
          'Numbers in digits, otherwise "yes" or "no"',
        ),
      },
      {
        label: t("出題範囲", "Covers"),
        value: t(
          "テストが見逃すバグ、デッドロック、活性、小さな範囲の全探索、性質ベーステスト",
          '"The bug your tests miss", "Finding deadlocks", "Does it ever finish?", "Checking every small case", "Property-based testing"',
        ),
      },
    ],
    actors: actorsOf(t),
    stageHeight: 300,
    links: LINKS,
    steps: questions.map((question, index) => stepOf(question, index, t)),
    lab: {
      title: t("答え合わせ", "Check your answer"),
      hint: t(
        "問題の番号と答えを入れる。正解は、レッスンと同じ計算関数でその場で求める。",
        "Enter the question number and your answer. The correct answer is computed on the spot with the same functions the lessons use.",
      ),
      inputs: [
        {
          id: "number",
          label: t(
            `問題の番号（1〜${questions.length}）`,
            `Question number (1-${questions.length})`,
          ),
          initial: "1",
        },
        { id: "answer", label: t("あなたの答え", "Your answer"), initial: "" },
      ],
      compute: gradeExercise(questions, language),
    },
  };
}
