import type { Actor, Lesson, Link, Step } from "../../core/types";
import {
  acceptsTrace,
  completeTraces,
  deadlocks,
  determinism,
  failuresRefines,
  starvation,
  traceRefines,
} from "../csp";
import { CRYPTO_ENV, cryptographers, parityOf } from "../cspCases";
import {
  COUNTER_ENV,
  counterObserved,
  PHILOSOPHER_ENV,
  philosophers,
  PRINTER_ENV,
  printerImpl,
  printerSpec,
} from "../cspModels";
import { POOL_ENV, poolSystem } from "../cspMore";
import { type ExerciseQuestion, gradeExercise } from "../exercise";
import { runNetwork, SORT_IMPL_WIRINGS, visibleLog } from "../sortImpl";
import { SORT_ENV, SORT_SIZE, SORT_VALUES, sortSpec } from "../sortModels";

// 問題の条件。出題範囲のレッスン（cspDeadlock・cspAnonymity・caseImplement）と同じにしてある。
const PHILOSOPHER_COUNT = 4;
const SORT_SEED_COUNT = 20;
const SORT_SEEDS = Array.from({ length: SORT_SEED_COUNT }, (_, k) => k + 1);

/** 0と1を3つ並べた入力の全部（caseImplement.ts と同じ数え方）。軽いので最上位で作る。 */
function allSortInputs(): number[][] {
  let inputs: number[][] = [[]];
  for (let k = 0; k < SORT_SIZE; k += 1) {
    inputs = inputs.flatMap((prefix) => SORT_VALUES.map((v) => [...prefix, v]));
  }
  return inputs;
}
const SORT_INPUTS = allSortInputs();
const SORT_RUN_COUNT = SORT_INPUTS.length * SORT_SEEDS.length;

function isSorted(values: number[]): boolean {
  return values.every((v, k) => k === 0 || values[k - 1]! <= v);
}

function traceText(trace: string[]): string {
  return trace.length > 0 ? `${trace.join(" → ")}の後` : "最初の時点で";
}

interface CspQuestion extends ExerciseQuestion {
  id: string;
  kind: string;
  subject: string;
  summary: string;
  explain: string;
  simplified?: string;
}

// 正解は solve の中で計算する（答え合わせのときに初めて呼ばれる）。詳細化の比較は重いので、最上位では呼ばない。
const QUESTIONS: CspQuestion[] = [
  {
    id: "q1-printer-trace",
    title: "問1 プリンタとトレース",
    kind: "spec",
    subject: "プリンタ",
    answerType: "yesno",
    summary: "プリンタの実装が、トレース詳細化で仕様を満たすかを答える",
    explain:
      "プリンタの仕様は「利用者がモノクロ（mono）かカラー（color）を選べば、いつでも刷る（print）」。実装は、カラーのインクが少ないと、機械が勝手にモノクロしか受け付けない状態に入ることがある。実装は仕様をトレース詳細化（実装が起こすイベントの並びが、どれも仕様でも起こせること）で満たすか。ヒント: トレースは「起こしたこと」だけを記録する。",
    solve: () => {
      const result = traceRefines(printerSpec(), printerImpl(), PRINTER_ENV);
      return {
        answer: result.holds,
        reason: result.holds
          ? "実装が起こすのは、モノクロかカラーを選んで刷る並びだけで、どれも仕様でも起こせる。カラーを断ることは「起こさなかった」だけなので、トレースには表れない。"
          : `${result.counterexample?.join(" → ") ?? ""}は仕様で起こせない。`,
      };
    },
    simplified:
      "FDR では Spec [T= Impl と書いて調べる。ここでは CSP の小さな実装をこのページで動かしている（ProB で同じ結果を照合済み）。",
  },
  {
    id: "q2-printer-failures",
    title: "問2 プリンタと失敗",
    kind: "found",
    subject: "プリンタ",
    answerType: "yesno",
    summary: "同じプリンタが、失敗詳細化で仕様を満たすかを答える",
    explain:
      "同じプリンタを、失敗詳細化（起こせる並びに加えて、安定した状態で断れるイベントも、仕様の範囲に収まること）で比べる。実装は仕様を満たすか。ヒント: 利用者がカラーを頼もうとした時点で、実装の機械がどんな状態にいうるかを考える。",
    solve: () => {
      const result = failuresRefines(printerSpec(), printerImpl(), PRINTER_ENV);
      if (result.holds) {
        return {
          answer: true,
          reason: "実装が断れるイベントは、どの時点でも仕様も断れる。",
        };
      }
      const failure = result.counterexample!;
      return {
        answer: false,
        reason: `${traceText(failure.trace)}、仕様なら必ず受け付ける {${failure.refusal.join(", ")}}を、実装は機械が勝手にモノクロだけの状態に入ることで断れる。トレースでは見えなかった違いが、失敗では見える。`,
      };
    },
  },
  {
    id: "q3-philosophers",
    title: "問3 4人の哲学者",
    kind: "explore",
    subject: "食事する哲学者",
    answerType: "number",
    summary: `哲学者${PHILOSOPHER_COUNT}人が全員左から取るとき、デッドロックまでの最短の手数を答える`,
    explain: `食事する哲学者を${PHILOSOPHER_COUNT}人にする。全員が左のフォークを取ってから右のフォークを取る。デッドロック（誰も動けなくなること）に至る最短の手順は何手か。1手は「哲学者がフォークを1本取る」のようなイベント1つ。ヒント: 誰も2本目を取れなくなるのは、どんなときか。`,
    solve: () => {
      const traces = deadlocks(philosophers(PHILOSOPHER_COUNT, false), PHILOSOPHER_ENV);
      if (traces.length === 0) return { answer: 0, reason: "デッドロックは無かった。" };
      // deadlocks は短い順を約束しないので、長さで最短を選ぶ（cspDeadlock.ts と同じ）。
      const shortest = traces.reduce((best, trace) =>
        trace.length < best.length ? trace : best,
      );
      return {
        answer: shortest.length,
        reason: `最短の手順は${shortest.join(" → ")}（pick.i.j は「哲学者iがフォークjを取る」）。全員が左を1本ずつ持つと、右のフォークは隣の人が持っているので、誰も先へ進めない。`,
      };
    },
  },
  {
    id: "q4-cryptographers",
    title: "問4 払った人は分かるか",
    kind: "explore",
    subject: "食事する暗号学者",
    answerType: "yesno",
    summary: "暗号学者0が払ったときと1が払ったときを、外から区別できるかを答える",
    explain:
      "3人の暗号学者の食事で、外から見えるのは各人の発言（0か1）だけ。払ったのが暗号学者0のときと暗号学者1のときで、外から見える振る舞いを区別できるか。区別できないとは、トレースと失敗の詳細化が両向きとも成り立つこと。ヒント: 払った人は逆を言うが、聞き手には誰のコインが何だったかが見えない。",
    solve: () => {
      const paid0 = cryptographers(0, false);
      const paid1 = cryptographers(1, false);
      const isSameTraces =
        traceRefines(paid0, paid1, CRYPTO_ENV).holds &&
        traceRefines(paid1, paid0, CRYPTO_ENV).holds;
      const isSameFailures =
        failuresRefines(paid0, paid1, CRYPTO_ENV).holds &&
        failuresRefines(paid1, paid0, CRYPTO_ENV).holds;
      const isIndistinguishable = isSameTraces && isSameFailures;
      const parities = [...new Set(completeTraces(paid0, CRYPTO_ENV).map(parityOf))];
      return {
        answer: !isIndistinguishable,
        reason: isIndistinguishable
          ? `トレースも失敗も両向きの詳細化が成り立ち、外から見える振る舞いは同じ。発言の排他的論理和はいつも${parities.join("・")}なので「誰かが払った」ことは分かるが、誰かは分からない。`
          : "どちらかの向きの詳細化が破れ、外から区別できる。",
      };
    },
    simplified:
      "コインを見る順を固定し、言い終えたら止まるモデルにして状態を減らしている（発言の並びには影響しない）。",
  },
  {
    id: "q5-sort-result-test",
    title: "問5 結果だけ見るテスト",
    kind: "test",
    subject: "並べ替えネットワーク",
    answerType: "number",
    summary: `比較器を1つ忘れた実装を${SORT_RUN_COUNT}回動かし、結果のテストが落ちる回数を答える`,
    explain: `3つの値を並べ替えるネットワークで、最後の比較器を付け忘れた実装を動かす。0と1の入力${SORT_INPUTS.length}通りを、動く順を決める乱数のシード${SORT_SEED_COUNT}個でそれぞれ動かす（計${SORT_RUN_COUNT}回）。出力が並んでいるかだけを見るテストは、何回落ちるか。ヒント: 忘れた比較器が要るのは、どんな入力のときか。`,
    solve: () => {
      const trials = SORT_INPUTS.flatMap((input) =>
        SORT_SEEDS.map((seed) => {
          const run = runNetwork(SORT_IMPL_WIRINGS.missingLast, input, seed);
          return {
            input,
            isSortedOutput: isSorted(run.output),
            isAccepted: acceptsTrace(sortSpec(), SORT_ENV, visibleLog(run.log))
              .isAccepted,
          };
        }),
      );
      const unsorted = trials.filter((t) => !t.isSortedOutput);
      const rejected = trials.filter((t) => !t.isAccepted).length;
      const failingInputs = [
        ...new Set(unsorted.map((t) => `(${t.input.join(",")})`)),
      ].join("、");
      return {
        answer: unsorted.length,
        reason: `出力が並ばなかったのは入力${failingInputs || "なし"}の回だけ。ほかの入力は、比較器が足りなくても偶然並ぶ。同じ${SORT_RUN_COUNT}回を仕様での判定にかけると${rejected}回落ちる。`,
      };
    },
    simplified:
      "実装は Go のチャネル風の小さな実行環境で、どの組から動くかをシード付きの乱数で決めている。仕様での判定は、「全部読んでから出す」という仕様の決まりを破った回も数える。",
  },
  {
    id: "q6-counter-determinism",
    title: "問6 カウンタの決定性",
    kind: "found",
    subject: "ロック無しのカウンタ",
    answerType: "yesno",
    summary: "ロック無しのカウンタが決定的かを答える",
    explain:
      "ロック無しで2人が count に1を足すカウンタを、外からは「終わった（finish）」と「結果（result.n）」だけが見えるプロセスとして見る。このプロセスは決定的か。決定的とは、同じイベントの並びの後で、受け付けるイベントがいつも同じこと。ヒント: テストを何回も流したとき、結果は毎回同じか。",
    solve: () => {
      const result = determinism(counterObserved(false), COUNTER_ENV);
      const witness = result.witness;
      const witnessText =
        witness?.kind === "refusal"
          ? `${traceText(witness.trace)}、${witness.event}を受け付けることも断ることもある。`
          : witness?.kind === "divergence"
            ? `${traceText(witness.trace)}、外から見えない動きだけで回り続けられる。`
            : "";
      return {
        answer: result.isDeterministic,
        reason: result.isDeterministic
          ? "どの並びの後でも、受け付けるイベントは同じだった。"
          : `${witnessText}同じテストでも、内部の動く順しだいで結果が変わる（揺れるテストの原因）。`,
      };
    },
  },
  {
    id: "q7-fifo-starvation",
    title: "問7 先着順の受け箱",
    kind: "fix",
    subject: "共用の受け箱",
    answerType: "yesno",
    summary: "先着順の受け箱で、客Bが飢餓になるかを答える",
    explain:
      "客AとBが1つの受け箱に依頼を入れ、1つのサーバーが取り出して応答する。受け箱は先着順で、いちばん先に入った依頼だけを渡す。Bが依頼を入れた後、応答をもらえないまま回り続ける実行（飢餓）はあるか。ヒント: Bより後に入った依頼が、Bより先に取り出されることはあるか。",
    solve: () => {
      const fifo = starvation(poolSystem("fifo"), POOL_ENV, "req.B", "resp.B");
      const anyOrder = starvation(poolSystem("anyOrder"), POOL_ENV, "req.B", "resp.B");
      const anyOrderText = anyOrder
        ? `好きな順の受け箱なら、${traceText(anyOrder.trace)}、${anyOrder.cycle.join(" → ")}を繰り返して、Bは待たされ続ける。`
        : "";
      return {
        answer: fifo !== null,
        reason: fifo
          ? `${traceText(fifo.trace)}、${fifo.cycle.join(" → ")}を繰り返して、Bは応答をもらえない。`
          : `先着順なら、Bの依頼より後に入ったAの依頼が先に取り出されることはないので、Bはいつか応答をもらう。${anyOrderText}`,
      };
    },
    simplified:
      "飢餓の判定は公平性を仮定しない（Aばかりが選ばれ続ける実行も数える）。ProB では LTL の式で同じことを調べて照合している。",
  },
];

const ACTORS: Actor[] = [
  {
    id: "question",
    label: "問題",
    sublabel: "CSP の演習",
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

function stepOf(question: CspQuestion, index: number): Step {
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

export const exerciseCspLesson: Lesson = {
  id: "exercise-csp",
  category: "exercise",
  title: "演習: CSP",
  subtitle: "詳細化・デッドロック・決定性・飢餓を自分で答える",
  summary: `プリンタ・哲学者・暗号学者・並べ替えネットワーク・カウンタ・受け箱から${QUESTIONS.length}問。答えは下の欄に入れると、このページの CSP の検査器が計算して答え合わせをする。`,
  facts: [
    { label: "問題の数", value: `${QUESTIONS.length}問` },
    { label: "答え方", value: "数は半角数字、ほかは「はい」か「いいえ」" },
    {
      label: "出題範囲",
      value: "詳細化、デッドロック、匿名性、事例（並べ替え）、決定性、飢餓",
    },
  ],
  actors: ACTORS,
  stageHeight: 300,
  links: LINKS,
  steps: QUESTIONS.map(stepOf),
  lab: {
    title: "答え合わせ",
    hint: "問題の番号と答えを入れる。正解は、レッスンと同じ計算関数でその場で求める（問4と問5は少し時間がかかる）。",
    inputs: [
      { id: "number", label: `問題の番号（1〜${QUESTIONS.length}）`, initial: "1" },
      { id: "answer", label: "あなたの答え", initial: "" },
    ],
    compute: gradeExercise(QUESTIONS),
  },
};
