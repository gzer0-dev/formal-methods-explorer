import { translator, type Language } from "../../core/i18n";
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
import { type ExerciseQuestion, gradeExercise, lazy } from "../exercise";
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

type Translate = (ja: string, en: string) => string;

/** 反例の時点を文の頭に置く形にする（「a → bの後」／"After a → b"）。 */
function traceText(trace: string[], t: Translate): string {
  return trace.length > 0
    ? t(`${trace.join(" → ")}の後`, `After ${trace.join(" → ")}`)
    : t("最初の時点で", "At the start");
}

// 正解の計算。答え合わせのときに初めて呼ばれ、言語をまたいで使い回す。詳細化の比較は重いので、最上位では呼ばない。
const Q1_TRACES = lazy(() => traceRefines(printerSpec(), printerImpl(), PRINTER_ENV));
const Q2_FAILURES = lazy(() =>
  failuresRefines(printerSpec(), printerImpl(), PRINTER_ENV),
);
const Q3_SHORTEST = lazy(() => {
  const traces = deadlocks(philosophers(PHILOSOPHER_COUNT, false), PHILOSOPHER_ENV);
  if (traces.length === 0) return null;
  // deadlocks は短い順を約束しないので、長さで最短を選ぶ（cspDeadlock.ts と同じ）。
  return traces.reduce((best, trace) => (trace.length < best.length ? trace : best));
});
const Q4_CRYPTO = lazy(() => {
  const paid0 = cryptographers(0, false);
  const paid1 = cryptographers(1, false);
  const isSameTraces =
    traceRefines(paid0, paid1, CRYPTO_ENV).holds &&
    traceRefines(paid1, paid0, CRYPTO_ENV).holds;
  const isSameFailures =
    failuresRefines(paid0, paid1, CRYPTO_ENV).holds &&
    failuresRefines(paid1, paid0, CRYPTO_ENV).holds;
  const parities = [...new Set(completeTraces(paid0, CRYPTO_ENV).map(parityOf))];
  return { isIndistinguishable: isSameTraces && isSameFailures, parities };
});
const Q5_SORT = lazy(() => {
  const trials = SORT_INPUTS.flatMap((input) =>
    SORT_SEEDS.map((seed) => {
      const run = runNetwork(SORT_IMPL_WIRINGS.missingLast, input, seed);
      return {
        input,
        isSortedOutput: isSorted(run.output),
        isAccepted: acceptsTrace(sortSpec(), SORT_ENV, visibleLog(run.log)).isAccepted,
      };
    }),
  );
  const unsorted = trials.filter((trial) => !trial.isSortedOutput);
  return {
    unsortedCount: unsorted.length,
    rejectedCount: trials.filter((trial) => !trial.isAccepted).length,
    failingInputs: [...new Set(unsorted.map((trial) => `(${trial.input.join(",")})`))],
  };
});
const Q6_DETERMINISM = lazy(() => determinism(counterObserved(false), COUNTER_ENV));
const Q7_STARVATION = lazy(() => ({
  fifo: starvation(poolSystem("fifo"), POOL_ENV, "req.B", "resp.B"),
  anyOrder: starvation(poolSystem("anyOrder"), POOL_ENV, "req.B", "resp.B"),
}));

interface CspQuestion extends ExerciseQuestion {
  id: string;
  kind: string;
  subject: string;
  summary: string;
  explain: string;
  simplified?: string;
}

function questionsOf(language: Language): CspQuestion[] {
  const t: Translate = translator(language);
  return [
    {
      id: "q1-printer-trace",
      title: t("問1 プリンタとトレース", "Q1 The printer and traces"),
      kind: "spec",
      subject: t("プリンタ", "Printer"),
      answerType: "yesno",
      summary: t(
        "プリンタの実装が、トレース詳細化で仕様を満たすかを答える",
        "Does the printer implementation meet the spec under trace refinement?",
      ),
      explain: t(
        "プリンタの仕様は「利用者がモノクロ（mono）かカラー（color）を選べば、いつでも刷る（print）」。実装は、カラーのインクが少ないと、機械が勝手にモノクロしか受け付けない状態に入ることがある。実装は仕様をトレース詳細化（実装が起こすイベントの並びが、どれも仕様でも起こせること）で満たすか。ヒント: トレースは「起こしたこと」だけを記録する。",
        'The printer spec says "whenever the user picks black and white (mono) or colour (color), it prints (print)". In the implementation, when colour ink runs low, the machine may on its own enter a state that accepts only mono. Does the implementation meet the spec under trace refinement (every sequence of events the implementation can do, the spec can do too)? Hint: a trace records only what happened.',
      ),
      solve: () => {
        const result = Q1_TRACES();
        return {
          answer: result.holds,
          reason: result.holds
            ? t(
                "実装が起こすのは、モノクロかカラーを選んで刷る並びだけで、どれも仕様でも起こせる。カラーを断ることは「起こさなかった」だけなので、トレースには表れない。",
                'The implementation only ever picks mono or color and prints, and the spec can do all of that too. Refusing color is just something that "did not happen", so it does not show up in a trace.',
              )
            : t(
                `${result.counterexample?.join(" → ") ?? ""}は仕様で起こせない。`,
                `The spec cannot do ${result.counterexample?.join(" → ") ?? ""}.`,
              ),
        };
      },
      simplified: t(
        "FDR では Spec [T= Impl と書いて調べる。ここでは CSP の小さな実装をこのページで動かしている（ProB で同じ結果を照合済み）。",
        "In FDR you check this by writing Spec [T= Impl. Here a small CSP implementation runs in this page (the same result is cross-checked with ProB).",
      ),
    },
    {
      id: "q2-printer-failures",
      title: t("問2 プリンタと失敗", "Q2 The printer and failures"),
      kind: "found",
      subject: t("プリンタ", "Printer"),
      answerType: "yesno",
      summary: t(
        "同じプリンタが、失敗詳細化で仕様を満たすかを答える",
        "Does the same printer meet the spec under failures refinement?",
      ),
      explain: t(
        "同じプリンタを、失敗詳細化（起こせる並びに加えて、安定した状態で断れるイベントも、仕様の範囲に収まること）で比べる。実装は仕様を満たすか。ヒント: 利用者がカラーを頼もうとした時点で、実装の機械がどんな状態にいうるかを考える。",
        "Compare the same printer under failures refinement (besides the sequences it can do, the events it can refuse in a stable state must also stay within the spec). Does the implementation meet the spec? Hint: think about what state the machine can be in when the user tries to ask for colour.",
      ),
      solve: () => {
        const result = Q2_FAILURES();
        if (result.holds) {
          return {
            answer: true,
            reason: t(
              "実装が断れるイベントは、どの時点でも仕様も断れる。",
              "At every point, any event the implementation can refuse, the spec can refuse too.",
            ),
          };
        }
        const failure = result.counterexample!;
        return {
          answer: false,
          reason: t(
            `${traceText(failure.trace, t)}、仕様なら必ず受け付ける {${failure.refusal.join(", ")}}を、実装は機械が勝手にモノクロだけの状態に入ることで断れる。トレースでは見えなかった違いが、失敗では見える。`,
            `${traceText(failure.trace, t)}, the spec always accepts {${failure.refusal.join(", ")}}, but the implementation can refuse it because the machine may enter the mono-only state on its own. A difference that traces could not see shows up in failures.`,
          ),
        };
      },
    },
    {
      id: "q3-philosophers",
      title: t("問3 4人の哲学者", `Q3 ${PHILOSOPHER_COUNT} philosophers`),
      kind: "explore",
      subject: t("食事する哲学者", "Dining philosophers"),
      answerType: "number",
      summary: t(
        `哲学者${PHILOSOPHER_COUNT}人が全員左から取るとき、デッドロックまでの最短の手数を答える`,
        `If all ${PHILOSOPHER_COUNT} philosophers take the left fork first, how many steps to the nearest deadlock?`,
      ),
      explain: t(
        `食事する哲学者を${PHILOSOPHER_COUNT}人にする。全員が左のフォークを取ってから右のフォークを取る。デッドロック（誰も動けなくなること）に至る最短の手順は何手か。1手は「哲学者がフォークを1本取る」のようなイベント1つ。ヒント: 誰も2本目を取れなくなるのは、どんなときか。`,
        `Use ${PHILOSOPHER_COUNT} dining philosophers. Each takes the left fork, then the right fork. How many steps is the shortest path to a deadlock (where no one can move)? One step is one event, such as "a philosopher takes one fork". Hint: when can no one pick up a second fork?`,
      ),
      solve: () => {
        const shortest = Q3_SHORTEST();
        if (shortest === null) {
          return {
            answer: 0,
            reason: t("デッドロックは無かった。", "There was no deadlock."),
          };
        }
        return {
          answer: shortest.length,
          reason: t(
            `最短の手順は${shortest.join(" → ")}（pick.i.j は「哲学者iがフォークjを取る」）。全員が左を1本ずつ持つと、右のフォークは隣の人が持っているので、誰も先へ進めない。`,
            `The shortest path is ${shortest.join(" → ")} (pick.i.j means "philosopher i takes fork j"). Once everyone holds their left fork, each right fork is held by a neighbour, so no one can go on.`,
          ),
        };
      },
    },
    {
      id: "q4-cryptographers",
      title: t("問4 払った人は分かるか", "Q4 Can you tell who paid?"),
      kind: "explore",
      subject: t("食事する暗号学者", "Dining cryptographers"),
      answerType: "yesno",
      summary: t(
        "暗号学者0が払ったときと1が払ったときを、外から区別できるかを答える",
        "Can an observer tell cryptographer 0 paying from cryptographer 1 paying?",
      ),
      explain: t(
        "3人の暗号学者の食事で、外から見えるのは各人の発言（0か1）だけ。払ったのが暗号学者0のときと暗号学者1のときで、外から見える振る舞いを区別できるか。区別できないとは、トレースと失敗の詳細化が両向きとも成り立つこと。ヒント: 払った人は逆を言うが、聞き手には誰のコインが何だったかが見えない。",
        "At the dinner of three cryptographers, an observer sees only what each one announces (0 or 1). Can the visible behaviour when cryptographer 0 paid be told apart from when cryptographer 1 paid? Indistinguishable means both trace and failures refinement hold in both directions. Hint: the payer announces the opposite, but listeners cannot see whose coin showed what.",
      ),
      solve: () => {
        const { isIndistinguishable, parities } = Q4_CRYPTO();
        return {
          answer: !isIndistinguishable,
          reason: isIndistinguishable
            ? t(
                `トレースも失敗も両向きの詳細化が成り立ち、外から見える振る舞いは同じ。発言の排他的論理和はいつも${parities.join("・")}なので「誰かが払った」ことは分かるが、誰かは分からない。`,
                `Trace and failures refinement both hold in both directions, so the visible behaviour is the same. The XOR of the announcements is always ${parities.join(", ")}, so you can tell that someone paid, but not who.`,
              )
            : t(
                "どちらかの向きの詳細化が破れ、外から区別できる。",
                "Refinement fails in one direction, so an observer can tell them apart.",
              ),
        };
      },
      simplified: t(
        "コインを見る順を固定し、言い終えたら止まるモデルにして状態を減らしている（発言の並びには影響しない）。",
        "To reduce the number of states, the model fixes the order in which coins are looked at and stops once everyone has spoken (this does not affect the announcements).",
      ),
    },
    {
      id: "q5-sort-result-test",
      title: t("問5 結果だけ見るテスト", "Q5 A test that checks the output"),
      kind: "test",
      subject: t("並べ替えネットワーク", "Sorting network"),
      answerType: "number",
      summary: t(
        `比較器を1つ忘れた実装を${SORT_RUN_COUNT}回動かし、結果のテストが落ちる回数を答える`,
        `Run an implementation missing one comparator ${SORT_RUN_COUNT} times; how often does the result test fail?`,
      ),
      explain: t(
        `3つの値を並べ替えるネットワークで、最後の比較器を付け忘れた実装を動かす。0と1の入力${SORT_INPUTS.length}通りを、動く順を決める乱数のシード${SORT_SEED_COUNT}個でそれぞれ動かす（計${SORT_RUN_COUNT}回）。出力が並んでいるかだけを見るテストは、何回落ちるか。ヒント: 忘れた比較器が要るのは、どんな入力のときか。`,
        `Run a network that sorts three values, in an implementation that forgot the last comparator. Each of the ${SORT_INPUTS.length} inputs of 0s and 1s is run with ${SORT_SEED_COUNT} random seeds that decide the order things move (${SORT_RUN_COUNT} runs in all). How many times does a test that only checks whether the output is sorted fail? Hint: for which inputs is the missing comparator needed?`,
      ),
      solve: () => {
        const { unsortedCount, rejectedCount, failingInputs } = Q5_SORT();
        return {
          answer: unsortedCount,
          reason: t(
            `出力が並ばなかったのは入力${failingInputs.join("、") || "なし"}の回だけ。ほかの入力は、比較器が足りなくても偶然並ぶ。同じ${SORT_RUN_COUNT}回を仕様での判定にかけると${rejectedCount}回落ちる。`,
            `The output was unsorted only on runs with input ${failingInputs.join(", ") || "none"}. Other inputs come out sorted by chance even with a comparator missing. Judging the same ${SORT_RUN_COUNT} runs against the spec, ${rejectedCount} fail.`,
          ),
        };
      },
      simplified: t(
        "実装は Go のチャネル風の小さな実行環境で、どの組から動くかをシード付きの乱数で決めている。仕様での判定は、「全部読んでから出す」という仕様の決まりを破った回も数える。",
        'The implementation runs on a small Go-channel-like runtime, and a seeded random number decides which pair moves first. Judging against the spec also counts runs that break the spec\'s rule "read everything before output".',
      ),
    },
    {
      id: "q6-counter-determinism",
      title: t("問6 カウンタの決定性", "Q6 Is the counter deterministic?"),
      kind: "found",
      subject: t("ロック無しのカウンタ", "Counter without a lock"),
      answerType: "yesno",
      summary: t(
        "ロック無しのカウンタが決定的かを答える",
        "Is the counter without a lock deterministic?",
      ),
      explain: t(
        "ロック無しで2人が count に1を足すカウンタを、外からは「終わった（finish）」と「結果（result.n）」だけが見えるプロセスとして見る。このプロセスは決定的か。決定的とは、同じイベントの並びの後で、受け付けるイベントがいつも同じこと。ヒント: テストを何回も流したとき、結果は毎回同じか。",
        'Two processes add 1 to count without a lock; view it as a process where only "done" (finish) and "result" (result.n) are visible from outside. Is this process deterministic? Deterministic means that after the same sequence of events, it always accepts the same events. Hint: if you run the test many times, is the result the same every time?',
      ),
      solve: () => {
        const result = Q6_DETERMINISM();
        const witness = result.witness;
        const witnessText =
          witness?.kind === "refusal"
            ? t(
                `${traceText(witness.trace, t)}、${witness.event}を受け付けることも断ることもある。`,
                `${traceText(witness.trace, t)}, it may either accept or refuse ${witness.event}. `,
              )
            : witness?.kind === "divergence"
              ? t(
                  `${traceText(witness.trace, t)}、外から見えない動きだけで回り続けられる。`,
                  `${traceText(witness.trace, t)}, it can keep going round on invisible moves alone. `,
                )
              : "";
        return {
          answer: result.isDeterministic,
          reason: result.isDeterministic
            ? t(
                "どの並びの後でも、受け付けるイベントは同じだった。",
                "After every sequence, it accepted the same events.",
              )
            : t(
                `${witnessText}同じテストでも、内部の動く順しだいで結果が変わる（揺れるテストの原因）。`,
                `${witnessText}The same test can give different results depending on the internal order (a cause of flaky tests).`,
              ),
        };
      },
    },
    {
      id: "q7-fifo-starvation",
      title: t("問7 先着順の受け箱", "Q7 A first-come inbox"),
      kind: "fix",
      subject: t("共用の受け箱", "Shared inbox"),
      answerType: "yesno",
      summary: t(
        "先着順の受け箱で、客Bが飢餓になるかを答える",
        "With a first-come, first-served inbox, can client B starve?",
      ),
      explain: t(
        "客AとBが1つの受け箱に依頼を入れ、1つのサーバーが取り出して応答する。受け箱は先着順で、いちばん先に入った依頼だけを渡す。Bが依頼を入れた後、応答をもらえないまま回り続ける実行（飢餓）はあるか。ヒント: Bより後に入った依頼が、Bより先に取り出されることはあるか。",
        "Clients A and B put requests into one inbox, and one server takes them out and replies. The inbox is first-come, first-served: it hands over only the request that arrived first. After B puts in a request, is there a run that keeps going without B ever getting a reply (starvation)? Hint: can a request that arrived after B's be taken out before it?",
      ),
      solve: () => {
        const { fifo, anyOrder } = Q7_STARVATION();
        const anyOrderText = anyOrder
          ? t(
              `好きな順の受け箱なら、${traceText(anyOrder.trace, t)}、${anyOrder.cycle.join(" → ")}を繰り返して、Bは待たされ続ける。`,
              ` With an inbox that hands out requests in any order, B can be kept waiting. ${traceText(anyOrder.trace, t)}, it can repeat ${anyOrder.cycle.join(" → ")} forever.`,
            )
          : "";
        return {
          answer: fifo !== null,
          reason: fifo
            ? t(
                `${traceText(fifo.trace, t)}、${fifo.cycle.join(" → ")}を繰り返して、Bは応答をもらえない。`,
                `${traceText(fifo.trace, t)}, repeating ${fifo.cycle.join(" → ")}, B never gets a reply.`,
              )
            : t(
                `先着順なら、Bの依頼より後に入ったAの依頼が先に取り出されることはないので、Bはいつか応答をもらう。${anyOrderText}`,
                `First-come, first-served means a request from A that arrived after B's is never taken out first, so B eventually gets a reply.${anyOrderText}`,
              ),
        };
      },
      simplified: t(
        "飢餓の判定は公平性を仮定しない（Aばかりが選ばれ続ける実行も数える）。ProB では LTL の式で同じことを調べて照合している。",
        "The starvation check assumes no fairness (runs where A keeps being chosen also count). ProB checks the same thing with an LTL formula, and the results are cross-checked.",
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
      sublabel: t("CSP の演習", "CSP"),
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

function stepOf(question: CspQuestion, index: number, t: Translate): Step {
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

export function exerciseCspLesson(language: Language): Lesson {
  const t = translator(language);
  const questions = questionsOf(language);
  return {
    id: "exercise-csp",
    category: "exercise",
    title: t("演習: CSP", "Exercises: CSP"),
    subtitle: t(
      "詳細化・デッドロック・決定性・飢餓を自分で答える",
      "Answer questions on refinement, deadlock, determinism and starvation",
    ),
    summary: t(
      `プリンタ・哲学者・暗号学者・並べ替えネットワーク・カウンタ・受け箱から${questions.length}問。答えは下の欄に入れると、このページの CSP の検査器が計算して答え合わせをする。`,
      `${questions.length} questions on the printer, the philosophers, the cryptographers, the sorting network, the counter and the inbox. Enter your answer in the box below and the CSP checker in this page computes the answer and grades it.`,
    ),
    intro: [
      t(
        "CSP（プロセスどうしがイベントで同期するようすを書く記法）のレッスンで見た題材を、自分で答える演習である。詳細化（実装が仕様の範囲に収まるかの比べ方）、デッドロック、決定性、飢餓（いつまでも順番が回ってこないこと）を扱う。",
        "These exercises ask you to answer questions about the examples from the CSP lessons (CSP is a notation for processes that synchronise on events). They cover refinement (a way to compare whether an implementation stays within its spec), deadlock, determinism and starvation (never getting your turn).",
      ),
      t(
        "並行処理のテストで「たまに止まる」「結果が揺れる」「ある依頼だけ返ってこない」といった症状に出会ったとき、どの性質の話かを見分けられると、調べ方を選べる。外したときは、答え合わせに出る理由を読み、元のレッスンに戻って見直すとよい。",
        'When a concurrency test shows symptoms like "it hangs now and then", "the result keeps changing" or "one request never comes back", telling which property is at stake lets you choose how to investigate. If you get one wrong, read the explanation shown with the result and go back to the original lesson.',
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
          "詳細化、デッドロック、匿名性、事例（並べ替え）、決定性、飢餓",
          "Refinement, deadlock, anonymity, the case study (sorting), determinism, starvation",
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
        "問題の番号と答えを入れる。正解は、レッスンと同じ計算関数でその場で求める（問4と問5は少し時間がかかる）。",
        "Enter the question number and your answer. The correct answer is computed on the spot with the same functions the lessons use (Q4 and Q5 take a moment).",
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
