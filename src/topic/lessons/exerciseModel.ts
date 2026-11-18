import type { Actor, Lesson, Link, Step } from "../../core/types";
import { type ExerciseQuestion, gradeExercise } from "../exercise";
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
import { checkBossInstances, describeBosses } from "../smallScope";

// 問題の条件。どれも、出題範囲のレッスン（lostUpdate・deadlock・liveness・smallScope・propertyTest）と同じにしてある。
// 条件を変えると、レッスンで見た数と演習の正解が食い違う。
const PROCESS_COUNT = 3;
const RETRY_LIMIT = 2;
const PBT_SEED = 7;
const PBT_RUNS = 100;
// propertyTest.ts と同じ性質: 出力に重複が無い、かつ入力にあった値が全部出力に残っている。
const PBT_PROPERTY: Property = (input, output) =>
  hasNoDuplicates(output) && input.every((value) => output.includes(value));

interface ModelQuestion extends ExerciseQuestion {
  id: string;
  kind: string;
  subject: string;
  summary: string;
  explain: string;
  simplified?: string;
}

function actionsText(trace: { action: string | null }[]): string {
  return trace
    .slice(1)
    .map((step) => step.action ?? "")
    .join(" → ");
}

// 正解は solve の中で計算する（答え合わせのときに初めて呼ばれる）。手で書いた正解の値は置かない。
const QUESTIONS: ModelQuestion[] = [
  {
    id: "q1-three-processes",
    title: "問1 3つで消える並び",
    kind: "explore",
    subject: "カウンタ",
    answerType: "number",
    summary: `カウンタを${PROCESS_COUNT}つのプロセスにしたとき、更新が消える並びを数える`,
    explain: `「テストが見逃すバグ」のカウンタを、${PROCESS_COUNT}つのプロセスにする。どれも「読む」「書く」の2手で count に1を足す。最後に count が${PROCESS_COUNT}にならない並びは何通りか。ヒント: 並びの総数から、どのプロセスも他と読み書きが重ならない並びを引く。`,
    solve: () => {
      const runs = countExecutions(
        counterModel(PROCESS_COUNT, false),
        isCounterCorrect,
      );
      return {
        answer: runs.bad,
        reason: `${PROCESS_COUNT}つのプロセスが2手ずつ動く並びは${runs.total}通り。正しく終わるのは、読んでから書くまでに他のプロセスが割り込まない${runs.good}通りだけで、残りの${runs.bad}通りでは誰かの更新が消える。`,
      };
    },
  },
  {
    id: "q2-shortest",
    title: "問2 最短の反例の手数",
    kind: "found",
    subject: "カウンタ",
    answerType: "number",
    summary: "2つのプロセスのカウンタで、最短の反例が何手かを答える",
    explain:
      "2つのプロセスのカウンタを、モデル検査器で調べる。不変条件「全員が終わったら count は2」を破る反例のうち、いちばん短いものは何手か。ヒント: 検査器は幅優先（近い状態から順に）でたどる。",
    solve: () => {
      const trace = check(counterModel(2, false)).violation;
      if (!trace) return { answer: 0, reason: "反例が見つからなかった。" };
      return {
        answer: trace.length - 1,
        reason: `幅優先でたどるので、最初に見つかった反例が最短になる。手順は${actionsText(trace)}。2人とも書く前に読まないと更新は消えないので、これより短くはならない。`,
      };
    },
    simplified:
      "TLC も幅優先でたどるので、同じモデルを TLA+ で書くと同じ長さの反例が出る（リポジトリの specs/tla/Counter.tla）。",
  },
  {
    id: "q3-same-order",
    title: "問3 同じ順でロック",
    kind: "fix",
    subject: "2つのロック",
    answerType: "yesno",
    summary: "2つのスレッドがロックを同じ順に取るとき、デッドロックするかを答える",
    explain:
      "2つのスレッドが L1と L2を両方取ってから仕事をする。2つとも「L1 → L2」の同じ順で取るとき、デッドロック（互いに相手を待って動けなくなること）は起きるか。ヒント: 1つ目を取れなかったスレッドが、何を持ったまま待つかを考える。",
    solve: () => {
      const same = check(lockModel(true));
      const reversed = check(lockModel(false));
      const reversedText = reversed.deadlock
        ? `取る順が逆なら${reversed.deadlock.length - 1}手（${actionsText(reversed.deadlock)}）で止まる。`
        : "";
      return {
        answer: same.deadlock !== null,
        reason: `同じ順なら、L1を取れなかった方は何も持たずに待つので、互いに待ち合う輪ができない。${same.stateCount}状態を全部たどっても、動けなくなる状態は無かった。${reversedText}`,
      };
    },
  },
  {
    id: "q4-unlimited-retry",
    title: "問4 上限の無いリトライ",
    kind: "explore",
    subject: "リトライ付きのジョブ",
    answerType: "yesno",
    summary: "リトライに上限が無いとき、「いつか必ず終わる」が成り立つかを答える",
    explain:
      "失敗したら待ちに戻してやり直すジョブで、やり直しの回数に上限を付けない。このとき「ジョブはいつか必ず成功か断念で終わる」は成り立つか。ヒント: 成功できる場面でも、毎回失敗する実行があり得る。",
    solve: () => {
      const unlimited = checkEventually(jobModel(null), isJobFinished);
      const limited = checkEventually(jobModel(RETRY_LIMIT), isJobFinished);
      const cycleText = unlimited.cycle ? `（${actionsText(unlimited.cycle)}）` : "";
      return {
        answer: unlimited.holds,
        reason: `失敗して待ちに戻る輪${cycleText}を回り続ける実行があり、終わらない。上限を${RETRY_LIMIT}回にすると${limited.holds ? "成り立つ" : "成り立たない"}。`,
      };
    },
    simplified:
      "この検査器は公平性（成功できる状態が続くなら、いつかは成功する、などの仮定）を置かず、失敗し続ける実行も反例に数える。TLA+ で強い公平性 SF(Succeed) を置くと、上限が無くても成り立つ。",
  },
  {
    id: "q5-no-self-boss",
    title: "問5 自分を上司にしない",
    kind: "spec",
    subject: "上司の関係（3人）",
    answerType: "number",
    summary: "制約「自分を上司にしない」だけを入れたとき、反例が何通り残るかを数える",
    explain:
      "A・B・Cの3人に、それぞれ上司を1人か「なし」で決める。制約「自分を自分の上司にしない」だけを入れて、あり得る形を全部作る。性質「上司をたどっても自分に戻らない」を破る形は何通りか。ヒント: 2人や3人で回る輪は、この制約では消えない。",
    solve: () => {
      const result = checkBossInstances({ forbidSelf: true, forbidCycle: false });
      const example = result.firstCounterexample
        ? `例: ${describeBosses(result.firstCounterexample)}。`
        : "";
      return {
        answer: result.counterexampleCount,
        reason: `制約を満たす形は${result.total}通りで、そのうち${result.counterexampleCount}通りに2人以上で回る輪が残る。${example}輪そのものを禁じる制約が要る。`,
      };
    },
    simplified:
      "Alloy では形を SAT ソルバーで探し、数を数えるには解を1つずつ列挙する。ここでは3人の形を全部作って数えている（リポジトリの specs/alloy/Boss.als で同じ数を照合済み）。",
  },
  {
    id: "q6-shrunk",
    title: "問6 縮めた反例の長さ",
    kind: "test",
    subject: "性質ベーステスト",
    answerType: "number",
    summary: `シード${PBT_SEED}で性質ベーステストを流し、縮めた反例の長さを答える`,
    explain: `重複を取り除く関数の誤った実装（隣どうしだけ比べる）に、性質ベーステストをシード${PBT_SEED}で${PBT_RUNS}回まで流す。性質は「出力に重複が無く、入力の値が全部残る」。見つかった反例を縮めきると、配列の長さ（要素の数）はいくつか。ヒント: 隣どうしが違う値で、同じ値がどこかに2回あれば破れる。`,
    solve: () => {
      const result = runPropertyTest(removeAdjacentDuplicates, PBT_PROPERTY, {
        seed: PBT_SEED,
        runs: PBT_RUNS,
      });
      if (!result.failing || !result.shrunk) {
        return { answer: 0, reason: "反例が見つからなかった。" };
      }
      return {
        answer: result.shrunk.length,
        reason: `${result.runs}回目の入力${formatArray(result.failing)}で破れ、縮めきると${formatArray(result.shrunk)}になる。出力は${formatArray(removeAdjacentDuplicates(result.shrunk))}で重複が残る。これより要素を減らすと、隣どうしでない重複が作れない。`,
      };
    },
    simplified:
      "fast-check などの実物は、縮め方の候補がもっと多く、値の型ごとに縮め方を持っている。ここでは「要素を1つ消す」「値を小さくする」だけを欲張りに試している。",
  },
];

const ACTORS: Actor[] = [
  {
    id: "question",
    label: "問題",
    sublabel: "モデル検査の演習",
    icon: "document",
    x: 20,
    y: 50,
  },
  {
    id: "you",
    label: "あなた",
    sublabel: "答えを考える",
    icon: "person",
    x: 50,
    y: 50,
  },
  {
    id: "checker",
    label: "検査器",
    sublabel: "答え合わせ",
    icon: "checker",
    x: 80,
    y: 50,
  },
];

const LINKS: Link[] = [
  { from: "question", to: "you" },
  { from: "you", to: "checker" },
];

function answerTypeText(question: ExerciseQuestion): string {
  return question.answerType === "number" ? "数" : "はい／いいえ";
}

function stepOf(question: ModelQuestion, index: number): Step {
  return {
    id: question.id,
    kind: question.kind,
    title: question.title,
    actor: "question",
    to: ["you"],
    summary: question.summary,
    explain: question.explain,
    set: {
      question: { rows: { 番号: `問${index + 1}`, 題材: question.subject } },
      you: { tone: "wait", rows: { 答えの形: answerTypeText(question) } },
      checker: { rows: { 入れる番号: String(index + 1) } },
    },
    ...(question.simplified ? { simplified: question.simplified } : {}),
  };
}

export const exerciseModelLesson: Lesson = {
  id: "exercise-model",
  category: "exercise",
  title: "演習: モデル検査",
  subtitle: "学んだことを、自分で答えて確かめる",
  summary: `カウンタ・ロック・リトライ・上司の関係・性質ベーステストから${QUESTIONS.length}問。答えは下の欄に入れると、このページの検査器が計算して答え合わせをする。`,
  facts: [
    { label: "問題の数", value: `${QUESTIONS.length}問` },
    { label: "答え方", value: "数は半角数字、ほかは「はい」か「いいえ」" },
    {
      label: "出題範囲",
      value:
        "テストが見逃すバグ、デッドロック、活性、小さな範囲の全探索、性質ベーステスト",
    },
  ],
  actors: ACTORS,
  stageHeight: 300,
  links: LINKS,
  steps: QUESTIONS.map(stepOf),
  lab: {
    title: "答え合わせ",
    hint: "問題の番号と答えを入れる。正解は、レッスンと同じ計算関数でその場で求める。",
    inputs: [
      { id: "number", label: `問題の番号（1〜${QUESTIONS.length}）`, initial: "1" },
      { id: "answer", label: "あなたの答え", initial: "" },
    ],
    compute: gradeExercise(QUESTIONS),
  },
};
