import { translator, type Language } from "../../core/i18n";
import type { Actor, Lesson, Link, Step } from "../../core/types";
import { acceptsTrace, explore, type Proc, TAU, traceRefines } from "../csp";
import { PRINTER_ENV, printerImpl, printerSpec } from "../cspModels";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";

// 演習: プリンタの実装は、トレース詳細化で仕様を満たすか（元は exerciseCsp.ts の問1）。
// 答える前は仕様と実装の書き方だけを見せ、⊑T の結果も、実装が起こせる並びも出さない。
// 答えると、実装の並びを書き出して仕様でも起こせるかを確かめ、断ったことが並びに残らない場面を見せる。

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
/** 狭い側では受け付けないのに、仕様なら最初に受け付けるイベント（color）。 */
const MISSING_IN_NARROW = SPEC_FIRST.filter((ev) => !NARROW_BRANCH.includes(ev));

// 書き出す並びの長さの上限。1回刷るまで（選ぶ → 刷る）が見えれば足りる。
const MAX_LISTED_LENGTH = 2;

/** proc が起こせる、長さ1以上 maxLength 以下のイベントの並びを全部（短い順）。 */
function tracesUpTo(proc: Proc, alphabet: string[], maxLength: number): string[][] {
  const found: string[][] = [];
  let frontier: string[][] = [[]];
  for (let length = 1; length <= maxLength; length += 1) {
    frontier = frontier.flatMap((prefix) =>
      alphabet
        .map((ev) => [...prefix, ev])
        .filter((trace) => acceptsTrace(proc, PRINTER_ENV, trace).isAccepted),
    );
    found.push(...frontier);
  }
  return found;
}

const SOLUTION = lazy(() => {
  const result = traceRefines(SPEC, IMPL, PRINTER_ENV);
  const implTraces = tracesUpTo(IMPL, ALPHABET, MAX_LISTED_LENGTH);
  const specAccepted = implTraces.filter(
    (trace) => acceptsTrace(SPEC, PRINTER_ENV, trace).isAccepted,
  );
  return { result, implTraces, specAccepted };
});

function traceText(trace: string[]): string {
  return `⟨${trace.join(", ")}⟩`;
}

function list(events: string[], t: Translate): string {
  return t(events.join("・"), events.join(", "));
}

function holdsText(holds: boolean, t: Translate): string {
  return holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
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
      title: t("トレースで満たすか", "Does it pass on traces?"),
      actor: "checker",
      to: ["spec", "impl"],
      summary: t(
        "実装が、トレース詳細化 Spec ⊑T Impl で仕様を満たすかを「はい」か「いいえ」で答える",
        'Answer "yes" or "no": does the implementation meet the spec under trace refinement Spec ⊑T Impl?',
      ),
      explain: t(
        "プリンタの仕様は「利用者がモノクロ（mono）かカラー（color）を選べば、いつでも刷る（print）」。実装は、カラーのインクが少ないと、機械が勝手にモノクロしか受け付けない状態に入ることがある。実装は仕様をトレース詳細化（実装が起こすイベントの並びが、どれも仕様でも起こせること）で満たすか。下の「答え合わせ」に答えを入れると、検査器が調べた手順がこの図に足される。ヒント: トレースは「起こしたこと」だけを記録する。",
        'The printer spec says "whenever the user picks black and white (mono) or colour (color), it prints (print)". In the implementation, when colour ink runs low, the machine may on its own enter a state that accepts only mono. Does the implementation meet the spec under trace refinement (every sequence of events the implementation can do, the spec can do too)? Enter your answer under "Check your answer" below and the checker\'s steps are added to this diagram. Hint: a trace records only what happened.',
      ),
      set: {
        checker: {
          isHidden: false,
          tone: "wait",
          rows: { [t("問い", "question")]: "Spec ⊑T Impl?" },
        },
      },
      simplified: t(
        "FDR では Spec [T= Impl と書いて調べる。ここでは CSP の小さな実装をこのページで動かしている（ProB で同じ結果を照合済み）。",
        "In FDR you check this by writing Spec [T= Impl. Here a small CSP implementation runs in this page (the same result is cross-checked with ProB).",
      ),
    },
  ];
}

function solutionSteps(t: Translate): Step[] {
  const { result, implTraces, specAccepted } = SOLUTION();
  const listed = implTraces.map(traceText).join(t("、", ", "));
  const missing = list(MISSING_IN_NARROW, t);
  const narrow = list(NARROW_BRANCH, t);
  const isAllAccepted = specAccepted.length === implTraces.length;
  return [
    {
      id: "impl-traces",
      kind: "explore",
      title: t("実装の並びを書き出す", "List the impl's traces"),
      actor: "checker",
      to: ["impl"],
      summary: t(
        `${MAX_LISTED_LENGTH}イベントまでの実装の並びは${implTraces.length}通り`,
        `The implementation has ${implTraces.length} traces of up to ${MAX_LISTED_LENGTH} events`,
      ),
      explain: t(
        `実装が起こせるイベントの並び（トレース）を、${MAX_LISTED_LENGTH}イベントまで短い順に書き出すと${listed}。機械がどちらの側を選んでも、起きるのは「選ぶ → 刷る」の並びだけだ。`,
        `Listing the event sequences (traces) the implementation can perform, up to ${MAX_LISTED_LENGTH} events, shortest first, gives ${listed}. Whichever side the machine picks, what happens is always "choose, then print".`,
      ),
      set: {
        impl: {
          rows: {
            [t("並び", "traces")]: t(
              `${implTraces.length}通り（${MAX_LISTED_LENGTH}まで）`,
              `${implTraces.length} (up to ${MAX_LISTED_LENGTH})`,
            ),
          },
        },
      },
    },
    {
      id: "narrow-branch",
      kind: "run",
      title: t(`${missing}を頼んでも`, `Asking for ${missing}`),
      actor: "user",
      to: ["impl"],
      summary: t(
        `機械が${narrow}だけの側に進むと、${missing}を頼んでも何も起きず、並びは ⟨⟩ のまま`,
        `If the machine has moved to the ${narrow}-only side, asking for ${missing} makes nothing happen, and the trace stays ⟨⟩`,
      ),
      explain: t(
        `機械が見えない動き（${TAU}）で${narrow}だけの側へ進んだところで、利用者が${missing}を頼む。実装は応じないので、何も起きない。トレースに残るのは起きたイベントだけなので、並びは ⟨⟩ のままで、これは仕様にもある並びだ。`,
        `The machine has moved, by an invisible move (${TAU}), to the ${narrow}-only side, and then the user asks for ${missing}. The implementation does not respond, so nothing happens. A trace keeps only the events that happened, so it stays ⟨⟩, which the spec has too.`,
      ),
      set: {
        user: {
          tone: "wait",
          rows: {
            [t("頼んだ", "asked for")]: missing,
            [t("起きた", "happened")]: t("なし", "nothing"),
          },
        },
        impl: { rows: { [t("受け付ける", "accepts")]: narrow } },
      },
    },
    {
      id: "spec-accepts",
      kind: "explore",
      title: t("仕様でも起こせるか", "Can the spec do them?"),
      actor: "checker",
      to: ["spec"],
      summary: t(
        `書き出した${implTraces.length}通りのうち、仕様も起こせるのは${specAccepted.length}通り`,
        `Of the ${implTraces.length} listed traces, the spec can perform ${specAccepted.length}`,
      ),
      explain: isAllAccepted
        ? t(
            `書き出した並びを仕様に1つずつ流すと、${specAccepted.length}通りすべてを仕様も起こせる。仕様は${list(SPEC_FIRST, t)}のどちらも受け付けるので、実装がどちらを選んでも仕様の並びに収まる。`,
            `Feeding each listed trace to the spec, it can perform all ${specAccepted.length}. The spec accepts both ${SPEC_FIRST.join(" and ")}, so whichever the implementation chooses stays within the spec's traces.`,
          )
        : t(
            "書き出した並びを仕様に1つずつ流すと、仕様では起こせない並びがある。",
            "Feeding each listed trace to the spec, some cannot be performed by the spec.",
          ),
      set: {
        spec: {
          tone: isAllAccepted ? "ok" : "bad",
          rows: {
            [t("起こせる", "can do")]: `${specAccepted.length}/${implTraces.length}`,
          },
        },
      },
    },
    {
      id: "trace-result",
      kind: result.holds ? "explore" : "found",
      title: t(
        `⊑T は${holdsText(result.holds, t)}`,
        `⊑T ${holdsText(result.holds, t)}`,
      ),
      actor: "checker",
      to: ["spec", "impl"],
      summary: t(
        `検査器が全部の並びを比べると、Spec ⊑T Impl は${holdsText(result.holds, t)}`,
        `Comparing every trace, the checker finds that Spec ⊑T Impl ${holdsText(result.holds, t)}`,
      ),
      explain: result.holds
        ? t(
            `検査器は長さを区切らずに、仕様と実装の状態を組にしてたどり、実装のどの並びも仕様が起こせることを確かめた。${missing}を断れることは並びに残らないので、トレース詳細化では見えない。断れるかどうかまで比べるのは、失敗詳細化の演習で扱う。`,
            `The checker walks pairs of spec and implementation states without a length limit and confirms that the spec can perform every trace of the implementation. Being able to refuse ${missing} leaves no mark on a trace, so trace refinement cannot see it. Comparing whether it can refuse is covered in the failures refinement exercise.`,
          )
        : t(
            `${traceText(result.counterexample ?? [])}は実装が起こせるのに、仕様では起こせない。`,
            `The implementation can perform ${traceText(result.counterexample ?? [])}, but the spec cannot.`,
          ),
      set: {
        checker: {
          tone: result.holds ? "ok" : "bad",
          rows: {
            [t("問い", "question")]: null,
            "⊑T": holdsText(result.holds, t),
          },
        },
        user: { tone: "idle" },
      },
    },
  ];
}

export function exercisePrinterTraceLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-printer-trace",
      title: t("演習: プリンタとトレース", "Exercise: printer and traces"),
      subtitle: t(
        "勝手に色を決めるプリンタは、トレースで仕様を満たすか",
        "Does the printer that picks its own colour pass on traces?",
      ),
      summary: t(
        "機械が勝手にモノクロだけにすることがあるプリンタが、トレース詳細化で仕様を満たすかを答える。答えると、実装の並びを仕様と1つずつ比べる様子を図で追える。",
        "Answer whether a printer whose machine may decide on its own to offer only black and white meets its spec under trace refinement. Once you answer, you can follow the implementation's traces being compared with the spec one by one.",
      ),
      intro: [
        t(
          "「プロセスとイベント」と「仕様もプロセスで書く」で見たプリンタを使う。仕様は利用者が刷り方を選び、実装は機械が勝手に選ぶことがある。この違いが、起きたイベントの並び（トレース）だけを比べるトレース詳細化で見えるかを問う。",
          'This uses the printer from "Processes and events" and "Specifications are processes too". In the spec the user chooses how to print; in the implementation the machine may choose on its own. The question is whether trace refinement, which compares only the sequences of events that happened (traces), can see this difference.',
        ),
        t(
          "図はまず仕様と実装の書き方だけを見せる。下の「答え合わせ」に答えを入れると、実装の並びを書き出して仕様と比べる手順が足される。利用者・仕様・実装のカードの行が、1ステップごとにどう変わるかを追う。",
          'The diagram first shows only how the spec and the implementation are written. When you enter an answer under "Check your answer", steps are added that list the implementation\'s traces and compare them with the spec. Follow how the rows on the user, spec and implementation cards change with each step.',
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
          value: t(
            "プロセスとイベント、仕様もプロセスで書く",
            '"Processes and events", "Specifications are processes too"',
          ),
        },
      ],
      actors: actorsOf(t),
      links: LINKS,
      answerType: "yesno",
      answerLabel: t("あなたの答え（はい／いいえ）", "Your answer (yes / no)"),
      hint: t(
        "実装が仕様をトレース詳細化で満たすなら「はい」、満たさないなら「いいえ」を入れる。入れると、図に正解の手順が足される。",
        'Enter "yes" if the implementation meets the spec under trace refinement, or "no" if not. The steps of the answer are then added to the diagram.',
      ),
      verdictActor: "checker",
      setupSteps: setupSteps(t),
      solve: () => {
        const { result } = SOLUTION();
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
      solutionSteps: () => solutionSteps(t),
      samples:
        language === "ja" ? ["はい", "いいえ", "yes", "x"] : ["yes", "no", "maybe"],
    },
    language,
  );
}
