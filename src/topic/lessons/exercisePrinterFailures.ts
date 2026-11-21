import { translator, type Language } from "../../core/i18n";
import type { Actor, Lesson, Link, Step } from "../../core/types";
import { acceptsTrace, explore, failuresRefines, TAU, traceRefines } from "../csp";
import { PRINTER_ENV, printerImpl, printerSpec } from "../cspModels";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";

// 演習: 同じプリンタは、失敗詳細化で仕様を満たすか（元は exerciseCsp.ts の問2）。
// 答える前は仕様と実装の書き方だけを見せ、⊑F・⊑T の結果も、断れるイベントも出さない。
// 答えると、反例の失敗（トレースと拒否）を、機械が勝手に進む → 頼んで断られる → 仕様なら断らない、の順に見せる。

type Translate = (ja: string, en: string) => string;

const SPEC = printerSpec();
const IMPL = printerImpl();
// プリンタのモデルは数状態なので、モデルの形（内部選択の行き先）は最上位で読む。詳細化の比較は lazy に回す。
const IMPL_LTS = explore(IMPL, PRINTER_ENV);
const ALPHABET = [
  ...new Set(IMPL_LTS.edges.map((edge) => edge.ev).filter((ev) => ev !== TAU)),
];
/** 実装の内部選択の先で、それぞれ最初に受け付けるイベント。 */
const IMPL_BRANCHES = IMPL_LTS.edges
  .filter((edge) => edge.from === IMPL_LTS.root && edge.ev === TAU)
  .map((edge) =>
    IMPL_LTS.edges.filter((next) => next.from === edge.to).map((next) => next.ev),
  );
const SPEC_FIRST = ALPHABET.filter(
  (ev) => acceptsTrace(SPEC, PRINTER_ENV, [ev]).isAccepted,
);
// 受け付けるイベントがいちばん少ない行き先（機械が勝手に選ぶ、mono だけの側）。
const NARROW_BRANCH = IMPL_BRANCHES.reduce((narrow, branch) =>
  branch.length < narrow.length ? branch : narrow,
);

const SOLUTION = lazy(() => ({
  failures: failuresRefines(SPEC, IMPL, PRINTER_ENV),
  traces: traceRefines(SPEC, IMPL, PRINTER_ENV),
}));

function list(events: string[], t: Translate): string {
  return t(events.join("・"), events.join(", "));
}

function holdsText(holds: boolean, t: Translate): string {
  return holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
}

/** 反例の時点を文の頭に置く形にする（「a → bの後」／"After a → b"）。exerciseCsp.ts と同じ書き方。 */
function traceText(trace: string[], t: Translate): string {
  return trace.length > 0
    ? t(`${trace.join(" → ")}の後`, `After ${trace.join(" → ")}`)
    : t("最初の時点で", "At the start");
}

function failureText(trace: string[], refusal: string[]): string {
  return `(⟨${trace.join(", ")}⟩, {${refusal.join(", ")}})`;
}

function actorsOf(t: Translate): Actor[] {
  return [
    {
      id: "spec",
      label: t("仕様", "Spec"),
      sublabel: "Spec",
      icon: "spec",
      x: 14,
      y: 27,
    },
    {
      id: "user",
      label: t("利用者", "User"),
      sublabel: t("刷り方を選ぶ", "chooses a mode"),
      icon: "person",
      x: 50,
      y: 27,
    },
    {
      id: "impl",
      label: t("実装", "Implementation"),
      sublabel: "Impl",
      icon: "process",
      x: 86,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "checker",
      label: t("検査器", "Checker"),
      sublabel: t("仕様と実装を比べる", "compares spec and impl"),
      icon: "checker",
      x: 50,
      y: 73,
      initial: { isHidden: true },
    },
  ];
}

const LINKS: Link[] = [
  { from: "user", to: "spec" },
  { from: "user", to: "impl" },
  { from: "checker", to: "spec" },
  { from: "checker", to: "impl" },
];

function setupSteps(t: Translate): Step[] {
  return [
    {
      id: "spec-external",
      kind: "spec",
      title: t("仕様は利用者が選ぶ", "In the spec, the user chooses"),
      actor: "spec",
      to: ["user"],
      summary: t(
        `仕様は最初に${list(SPEC_FIRST, t)}のどちらも受け付ける（外部選択 □）`,
        `At the start the spec accepts either ${SPEC_FIRST.join(" or ")} (external choice □)`,
      ),
      explain: t(
        "プリンタの仕様は、□（外部選択）で mono（モノクロを選ぶ）と color（カラーを選ぶ）の両方を差し出して待ち、選ばれると print（刷る）を起こして最初に戻る。どちらにするかは利用者が決める。",
        "The printer spec uses □ (external choice) to offer both mono (choose black and white) and color (choose colour), and once one is chosen it performs print (print a page) and starts again. The user decides which.",
      ),
      set: {
        spec: { rows: { [t("受け付ける", "accepts")]: list(SPEC_FIRST, t) } },
      },
      detail: [
        {
          title: t("このサイトの書き方", "Notation on this site"),
          fields: [
            {
              label: "Spec",
              value: "(mono → print → Spec) □ (color → print → Spec)",
              isCode: true,
            },
          ],
        },
      ],
    },
    {
      id: "impl-internal",
      kind: "spec",
      title: t("実装は勝手に決める", "The implementation decides"),
      actor: "impl",
      to: ["user"],
      summary: t(
        "実装は ⊓（内部選択）で、両方を受け付けるか mono だけにするかを自分で決める",
        "With ⊓ (internal choice), the implementation itself decides whether to accept both or only mono",
      ),
      explain: t(
        "⊓ は内部選択と呼び、どちらに進むかをプロセスが勝手に決める。この実装は、カラーのインクが少ないと、利用者が何もしないうちに mono しか受け付けない側へ進むことがある。",
        "⊓ is called internal choice: the process decides on its own which way to go. When colour ink is low, this implementation may move, before the user does anything, to the side that accepts only mono.",
      ),
      set: {
        impl: {
          isHidden: false,
          tone: "wait",
          rows: {
            [t("選択の先", "branches")]: IMPL_BRANCHES.map((branch) =>
              list(branch, t),
            ).join(t(" か ", " or ")),
          },
        },
      },
      detail: [
        {
          title: t("このサイトの書き方", "Notation on this site"),
          fields: [
            {
              label: "Impl",
              value:
                "((mono → print → Impl) □ (color → print → Impl)) ⊓ (mono → print → Impl)",
              isCode: true,
            },
          ],
        },
      ],
    },
    {
      id: "question",
      kind: "explore",
      title: t("失敗で満たすか", "Does it pass on failures?"),
      actor: "checker",
      to: ["spec", "impl"],
      summary: t(
        "実装が、失敗詳細化 Spec ⊑F Impl で仕様を満たすかを「はい」か「いいえ」で答える",
        'Answer "yes" or "no": does the implementation meet the spec under failures refinement Spec ⊑F Impl?',
      ),
      explain: t(
        "同じプリンタを、失敗詳細化（起こせる並びに加えて、安定した状態で断れるイベントも、仕様の範囲に収まること）で比べる。実装は仕様を満たすか。下の「答え合わせ」に答えを入れると、検査器が調べた手順がこの図に足される。ヒント: 利用者がカラーを頼もうとした時点で、実装の機械がどんな状態にいうるかを考える。",
        'Compare the same printer under failures refinement (besides the sequences it can do, the events it can refuse in a stable state must also stay within the spec). Does the implementation meet the spec? Enter your answer under "Check your answer" below and the checker\'s steps are added to this diagram. Hint: think about what state the machine can be in when the user tries to ask for colour.',
      ),
      set: {
        checker: {
          isHidden: false,
          tone: "wait",
          rows: { [t("問い", "question")]: "Spec ⊑F Impl?" },
        },
      },
      simplified: t(
        "このサイトは安定失敗モデル（見えない動きが起きない状態でだけ拒否を数える）で比べ、発散（見えない動きの無限の輪）は見ていない。FDR の [F= と同じ扱い。",
        "This site compares in the stable-failures model (refusals are counted only in states with no invisible move) and does not look at divergence (an endless loop of invisible moves). This matches FDR's [F=.",
      ),
    },
  ];
}

/** 反例のトレースを1イベントずつ起こすステップ（いまのモデルでは反例は最初の時点なので0個）。 */
function traceSteps(trace: string[], t: Translate): Step[] {
  return trace.map((ev, index) => ({
    id: `trace-${index + 1}`,
    kind: "run",
    title: t(`${index + 1}つ目: ${ev}`, `Event ${index + 1}: ${ev}`),
    actor: "user",
    to: ["impl"],
    summary: t(
      `反例のトレースの${index + 1}つ目、${ev}が起きる`,
      `Event ${index + 1} of the counterexample trace, ${ev}, happens`,
    ),
    explain: t(
      `反例の時点までのトレース ⟨${trace.join(", ")}⟩ を1つずつ起こす。${ev}は仕様も実装も起こせる。`,
      `Perform the counterexample trace ⟨${trace.join(", ")}⟩ one event at a time. Both the spec and the implementation can perform ${ev}.`,
    ),
    set: {
      user: {
        rows: { [t("起きた", "happened")]: trace.slice(0, index + 1).join(" → ") },
      },
    },
  }));
}

function holdingSteps(t: Translate): Step[] {
  return [
    {
      id: "failures-compared",
      kind: "explore",
      title: t("断れるイベントを比べる", "Compare what each refuses"),
      actor: "checker",
      to: ["spec", "impl"],
      summary: t(
        "どの時点でも、実装が断れるイベントは仕様も断れる",
        "At every point, any event the implementation can refuse, the spec can refuse too",
      ),
      explain: t(
        "検査器は仕様と実装の状態を組にしてたどり、実装の安定した状態ごとに、断れるイベントが仕様の範囲に収まるかを確かめた。",
        "The checker walks pairs of spec and implementation states and confirms, for each stable state of the implementation, that what it can refuse stays within the spec.",
      ),
      set: { checker: { tone: "wait" } },
    },
    {
      id: "failures-result",
      kind: "explore",
      title: t("⊑F は成り立つ", "⊑F holds"),
      actor: "checker",
      to: ["spec", "impl"],
      summary: t("Spec ⊑F Impl は成り立つ", "Spec ⊑F Impl holds"),
      explain: t(
        "仕様が断らない所で実装が断る場面は無かった。",
        "There was no point where the implementation refuses something the spec would not.",
      ),
      set: {
        checker: {
          tone: "ok",
          rows: { [t("問い", "question")]: null, "⊑F": holdsText(true, t) },
        },
      },
    },
  ];
}

function solutionSteps(t: Translate): Step[] {
  const { failures, traces } = SOLUTION();
  const failure = failures.counterexample;
  if (failures.holds || failure === null) return holdingSteps(t);
  const at = traceText(failure.trace, t);
  const refused = list(failure.refusal, t);
  const narrow = list(NARROW_BRANCH, t);
  const specAccepts = ALPHABET.filter(
    (ev) => acceptsTrace(SPEC, PRINTER_ENV, [...failure.trace, ev]).isAccepted,
  );
  const isSpecAccepting = failure.refusal.every((ev) => specAccepts.includes(ev));
  return [
    ...traceSteps(failure.trace, t),
    {
      id: "machine-decides",
      kind: "run",
      title: t("機械が勝手に進む", "The machine moves on its own"),
      actor: "impl",
      summary: t(
        `${at}、実装は見えない動き（${TAU}）で${narrow}だけの側へ進める`,
        `${at}, the implementation can move by an invisible move (${TAU}) to the ${narrow}-only side`,
      ),
      explain: t(
        `${at}、利用者がまだ何もしていないうちに、実装は内部選択で${narrow}だけを受け付ける側へ進める。見えない動きはもう起きないので、この状態は安定していて、ここで断れるイベントが失敗として数えられる。`,
        `${at}, before the user has done anything, the implementation can use its internal choice to move to the side that accepts only ${narrow}. No invisible move is left, so this state is stable, and what it refuses here counts as a failure.`,
      ),
      set: {
        impl: {
          tone: "bad",
          rows: { [t("受け付ける", "accepts")]: narrow },
        },
      },
    },
    {
      id: "user-refused",
      kind: "found",
      title: t(`${refused}を断られる`, `${refused} is refused`),
      actor: "user",
      to: ["impl"],
      summary: t(
        `利用者が${refused}を頼んでも、実装は断る。失敗 ${failureText(failure.trace, failure.refusal)}`,
        `The user asks for ${refused}, and the implementation refuses. Failure ${failureText(failure.trace, failure.refusal)}`,
      ),
      explain: t(
        `利用者が${refused}を頼むが、実装は応じない。トレースと、その後に断れるイベントの組 ${failureText(failure.trace, failure.refusal)} が、実装の失敗の1つになる。`,
        `The user asks for ${refused}, but the implementation does not respond. The pair of the trace and the events it can then refuse, ${failureText(failure.trace, failure.refusal)}, is one of the implementation's failures.`,
      ),
      set: {
        user: {
          tone: "bad",
          rows: {
            [t("頼んだ", "asked for")]: refused,
            [t("結果", "result")]: t("断られた", "refused"),
          },
        },
        impl: { rows: { [t("拒否できる", "can refuse")]: refused } },
      },
    },
    {
      id: "spec-accepts",
      kind: "explore",
      title: t("仕様なら断らない", "The spec would not refuse"),
      actor: "checker",
      to: ["spec"],
      summary: t(
        `同じ時点の仕様は${list(specAccepts, t)}を受け付ける`,
        `At the same point the spec accepts ${specAccepts.join(" and ")}`,
      ),
      explain: isSpecAccepting
        ? t(
            `仕様は外部選択なので、${at}も${list(specAccepts, t)}のどちらも差し出して待つ。この時点の仕様には${refused}を断る安定した状態が無いので、実装の失敗は仕様の失敗に含まれない。`,
            `The spec uses external choice, so at this point it still offers both ${specAccepts.join(" and ")}. At this point the spec has no stable state that refuses ${refused}, so the implementation's failure is not among the spec's failures.`,
          )
        : t(
            `仕様は同じ時点で${list(specAccepts, t)}を受け付ける。`,
            `At the same point the spec accepts ${specAccepts.join(", ")}.`,
          ),
      set: {
        spec: {
          tone: "ok",
          rows: { [t("受け付ける", "accepts")]: list(specAccepts, t) },
        },
      },
    },
    {
      id: "failures-result",
      kind: "found",
      title: t("⊑F は成り立たない", "⊑F fails"),
      actor: "checker",
      to: ["spec", "impl"],
      summary: t(
        `Spec ⊑F Impl は成り立たない。トレース詳細化 ⊑T は${holdsText(traces.holds, t)}`,
        `Spec ⊑F Impl fails. Trace refinement ⊑T ${holdsText(traces.holds, t)}`,
      ),
      explain: t(
        `反例は失敗 ${failureText(failure.trace, failure.refusal)}。${traces.holds ? "起きた並びだけを比べるトレース詳細化は成り立つ。" : ""}断れるかどうかまで比べて初めて、内部選択と外部選択の違いが見える。テストに置きかえると、インクが少ない状態を作ってから${refused}を頼み、断られないかを確かめるテストになる。`,
        `The counterexample is the failure ${failureText(failure.trace, failure.refusal)}. ${traces.holds ? "Trace refinement, which compares only the sequences that happened, holds. " : ""}Only by also comparing what can be refused does the difference between internal and external choice show up. As a test, this means setting up low ink, asking for ${refused}, and checking it is not refused.`,
      ),
      set: {
        checker: {
          tone: "bad",
          rows: {
            [t("問い", "question")]: null,
            "⊑F": holdsText(false, t),
            "⊑T": holdsText(traces.holds, t),
          },
        },
      },
      simplified: t(
        "反例の拒否には、仕様ならその時点で必ず受け付けるのに実装が拒否できるイベントだけを並べている。拒否できるイベントを全部並べると、仕様も拒否できるもの（print など）が混ざって読みにくいため。",
        "The counterexample's refusal lists only events the spec would always accept at that point but the implementation can refuse. Listing every refusable event would mix in ones the spec can refuse too (such as print) and be hard to read.",
      ),
    },
  ];
}

export function exercisePrinterFailuresLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-printer-failures",
      title: t("演習: プリンタと失敗", "Exercise: printer and failures"),
      subtitle: t(
        "同じプリンタは、失敗で比べても仕様を満たすか",
        "Does the same printer pass when failures are compared?",
      ),
      summary: t(
        "機械が勝手にモノクロだけにすることがあるプリンタが、失敗詳細化で仕様を満たすかを答える。答えると、検査器が比べた拒否を図で追える。",
        "Answer whether a printer whose machine may decide on its own to offer only black and white meets its spec under failures refinement. Once you answer, you can follow the refusals the checker compared.",
      ),
      intro: [
        t(
          "「拒否で見分ける」で見たプリンタを使う。失敗詳細化は、起きたイベントの並びに加えて、その後に断れるイベント（拒否）まで仕様と比べる。利用者が選ぶ仕様と、機械が勝手に選ぶことがある実装の違いが、この比べ方で見えるかを問う。",
          'This uses the printer from "Telling processes apart by refusals". Failures refinement compares with the spec not only the sequences of events that happened but also the events that can be refused afterwards (refusals). The question is whether this comparison can see the difference between a spec where the user chooses and an implementation where the machine may choose on its own.',
        ),
        t(
          "図はまず仕様と実装の書き方だけを見せる。下の「答え合わせ」に答えを入れると、検査器が比べた手順が足される。利用者・仕様・実装のカードの「受け付ける」などの行を見比べながら追う。",
          'The diagram first shows only how the spec and the implementation are written. When you enter an answer under "Check your answer", the steps the checker compared are added. Follow along by comparing the rows, such as "accepts", on the user, spec and implementation cards.',
        ),
      ],
      facts: [
        { label: t("題材", "Subject"), value: t("プリンタ", "Printer") },
        {
          label: t("答え方", "How to answer"),
          value: t("「はい」か「いいえ」", '"yes" or "no"'),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t("拒否で見分ける", '"Telling processes apart by refusals"'),
        },
      ],
      actors: actorsOf(t),
      links: LINKS,
      answerType: "yesno",
      answerLabel: t("あなたの答え（はい／いいえ）", "Your answer (yes / no)"),
      hint: t(
        "実装が仕様を失敗詳細化で満たすなら「はい」、満たさないなら「いいえ」を入れる。入れると、図に正解の手順が足される。",
        'Enter "yes" if the implementation meets the spec under failures refinement, or "no" if not. The steps of the answer are then added to the diagram.',
      ),
      verdictActor: "checker",
      setupSteps: setupSteps(t),
      solve: () => {
        const result = SOLUTION().failures;
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
      solutionSteps: () => solutionSteps(t),
      samples:
        language === "ja" ? ["はい", "いいえ", "yes", "x"] : ["yes", "no", "maybe"],
    },
    language,
  );
}
