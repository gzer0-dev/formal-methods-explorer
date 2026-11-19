import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import {
  acceptsTrace,
  explore,
  failuresRefines,
  type Failure,
  moves,
  type Proc,
  TAU,
  traceRefines,
} from "../csp";
import { printerImpl, PRINTER_ENV, printerSpec } from "../cspModels";

const SPEC = printerSpec();
const IMPL = printerImpl();
const SPEC_FIRST = moves(SPEC, PRINTER_ENV).map((m) => m.ev);
const IMPL_LTS = explore(IMPL, PRINTER_ENV);
const IMPL_HIDDEN = IMPL_LTS.edges.filter((edge) => edge.ev === TAU).length;
const TRACE_RESULT = traceRefines(SPEC, IMPL, PRINTER_ENV);
const FAILURE_RESULT = failuresRefines(SPEC, IMPL, PRINTER_ENV);
const FAILURE = FAILURE_RESULT.counterexample!;
// 実装の内部選択の先で、それぞれ最初に受け付けるイベント（Impl の最初の τ の行き先ごと）。
const IMPL_BRANCHES = IMPL_LTS.edges
  .filter((edge) => edge.from === IMPL_LTS.root && edge.ev === TAU)
  .map((edge) =>
    IMPL_LTS.edges.filter((next) => next.from === edge.to).map((next) => next.ev),
  );
// テストで color を頼む。機械が左を選んでいれば通る。
const COLOR_TEST = ["color", "print"];
const COLOR_TEST_RESULT = acceptsTrace(IMPL, PRINTER_ENV, COLOR_TEST);
// 直した実装（内部選択をやめて、仕様と同じ外部選択にしたもの）。
const FIXED_TRACE = traceRefines(SPEC, SPEC, PRINTER_ENV);
const FIXED_FAILURE = failuresRefines(SPEC, SPEC, PRINTER_ENV);

function traceText(trace: string[], language: Language): string {
  if (trace.length > 0) return `⟨${trace.join(", ")}⟩`;
  return language === "ja" ? "⟨⟩（最初の時点）" : "⟨⟩ (at the start)";
}

function failureText(failure: Failure, language: Language): string {
  const none = language === "ja" ? "なし" : "none";
  const refusal = failure.refusal.length > 0 ? failure.refusal.join(", ") : none;
  return `(${traceText(failure.trace, language)}, {${refusal}})`;
}

// 英語の画面では on / off で入れる。
function parseChoice(text: string | undefined): boolean {
  const value = text ?? "";
  return !value.includes("なし") && !/\b(no|off)\b/i.test(value);
}

export function cspFailuresLesson(language: Language): Lesson {
  const t = translator(language);
  const holdsText = (holds: boolean) =>
    holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
  const list = (events: string[]) => t(events.join("・"), events.join(", "));
  const refused = list(FAILURE.refusal);
  return {
    id: "csp-failures",
    category: "csp",
    title: t("拒否で見分ける", "Telling processes apart by refusals"),
    subtitle: t(
      "トレースが同じでも、断られるかが違う",
      "Same traces, but one may refuse",
    ),
    summary: t(
      `インクが少ないと勝手にモノクロしか受け付けなくなるプリンタは、トレース詳細化では仕様を満たすが、失敗詳細化では「最初に${refused}を拒否できる」ことが反例になる。`,
      `A printer that, when ink is low, decides on its own to accept only black and white satisfies the spec under trace refinement, but under failures refinement "it can refuse ${refused} at the start" is a counterexample.`,
    ),
    intro: [
      t(
        "失敗（failure）は、あるトレースの後で、差し出されたイベントを断れることを表す組だ。断れるイベントの集まりを拒否集合と呼ぶ。失敗詳細化は、仕様が断らない所で実装が断らないかまで比べる。",
        "A failure is a pair saying that, after some trace, the process can refuse the events offered to it. The set of events it can refuse is called a refusal set. Failures refinement also checks that the implementation does not refuse where the spec would not.",
      ),
      t(
        "「仕様もプロセスで書く」のトレース詳細化は、起きたことしか見ないので、頼まれた操作を断る実装でも合格になる。テストでも、受け付けた回だけを見ていると、断られる場合があることには気づけない。",
        'Trace refinement in "Specifications are processes too" only looks at what happened, so an implementation that refuses a request still passes. Likewise, a test that only looks at runs where the request was accepted never notices that it can be refused.',
      ),
      t(
        "図では、まず仕様の外部選択（□、相手が選ぶ）と、実装の内部選択（⊓、プロセスが勝手に選ぶ）の違いを押さえる。テストのカードが通った後、検査器が最初の時点で何を断れるかを比べる所が分かれ目になる。",
        "In the diagram, first note the difference between the spec's external choice (□, the other side chooses) and the implementation's internal choice (⊓, the process chooses on its own). After the test card passes, the turning point is where the checker compares what each can refuse at the start.",
      ),
    ],
    facts: [
      {
        label: t("トレース詳細化", "Trace refinement"),
        value: holdsText(TRACE_RESULT.holds),
        tone: TRACE_RESULT.holds ? "ok" : "bad",
      },
      {
        label: t("失敗詳細化", "Failures refinement"),
        value: holdsText(FAILURE_RESULT.holds),
        tone: FAILURE_RESULT.holds ? "ok" : "bad",
      },
      {
        label: t("反例の失敗", "Counterexample failure"),
        value: failureText(FAILURE, language),
        tone: "bad",
      },
      {
        label: t("実装の状態", "Implementation size"),
        value: t(
          `${IMPL_LTS.stateCount}個・${IMPL_LTS.transitionCount}遷移`,
          `${IMPL_LTS.stateCount} states, ${IMPL_LTS.transitionCount} transitions`,
        ),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 6.3節（安定失敗方式）`,
          `${CSP_BOOK_EN}, section 6.3 (stable-failures model)`,
        ),
      },
    ],
    actors: [
      {
        id: "user",
        label: t("利用者", "User"),
        sublabel: t("刷り方を選ぶ", "chooses a mode"),
        icon: "person",
        x: 50,
        y: 27,
      },
      {
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: "Spec",
        icon: "spec",
        x: 14,
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
        id: "test",
        label: t("テスト", "Test"),
        sublabel: t("color を頼む", "asks for color"),
        icon: "test",
        x: 86,
        y: 73,
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
    ],
    links: [
      { from: "user", to: "spec" },
      { from: "test", to: "impl" },
      { from: "user", to: "impl" },
      { from: "checker", to: "spec" },
      { from: "checker", to: "impl" },
    ],
    steps: [
      {
        id: "spec-external",
        kind: "spec",
        title: t("仕様は利用者が選ぶ", "In the spec, the user chooses"),
        actor: "spec",
        to: ["user"],
        summary: t(
          `仕様は最初に ${SPEC_FIRST.join("・")} のどちらも受け付ける（外部選択 □）`,
          `At the start the spec accepts either ${SPEC_FIRST.join(" or ")} (external choice □)`,
        ),
        explain: t(
          `「プロセスとイベント」のプリンタの仕様は、□（外部選択）で mono（モノクロを選ぶ）と color（カラーを選ぶ）の両方を差し出して待ち、選ぶと print（刷る）を起こす。どちらにするかは利用者が決めるので、利用者が color を頼めば必ず刷る。`,
          `The printer spec from "Processes and events" uses □ (external choice) to offer both mono (choose black and white) and color (choose colour), and after the choice performs print (print a page). The user decides which, so if the user asks for color it always prints.`,
        ),
        set: {
          spec: {
            tone: "ok",
            rows: { [t("受け付ける", "accepts")]: list(SPEC_FIRST) },
          },
        },
      },
      {
        id: "impl-internal",
        kind: "spec",
        title: t("実装は勝手に決める", "The implementation decides"),
        actor: "impl",
        summary: t(
          `実装は ⊓（内部選択）で、両方を受け付けるか mono だけにするかを自分で決める`,
          `With ⊓ (internal choice), the implementation itself decides whether to accept both or only mono`,
        ),
        explain: t(
          `⊓ は内部選択と呼び、どちらに進むかをプロセスが勝手に決める。この実装は、カラーのインクが少ないと、利用者が何もしないうちに mono しか受け付けない状態に移ることがある。全部たどると${IMPL_LTS.stateCount}状態・${IMPL_LTS.transitionCount}遷移で、そのうち${IMPL_HIDDEN}本がこの見えない選択（${TAU}）。`,
          `⊓ is called internal choice: the process decides on its own which way to go. When colour ink is low, this implementation may move, before the user does anything, to a state that accepts only mono. Walking everything gives ${IMPL_LTS.stateCount} states and ${IMPL_LTS.transitionCount} transitions, ${IMPL_HIDDEN} of which are this invisible choice (${TAU}).`,
        ),
        set: {
          impl: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("選択の先", "branches")]: IMPL_BRANCHES.map((branch) =>
                list(branch),
              ).join(t(" か ", " or ")),
              [t("状態", "states")]: t(
                `${IMPL_LTS.stateCount}個`,
                `${IMPL_LTS.stateCount}`,
              ),
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
        simplified: t(
          "実物の CSPM（FDR の記法）では、外部選択を []、内部選択を |~| と書くなど、書き方が違う。このサイトは記号で短く見せている。インクの量は変数として持たず、「勝手に決める」ことだけを内部選択で表した。",
          "Real CSPM (the notation used by FDR) is written differently: external choice is [], internal choice is |~|, and so on. This site shows the symbols for brevity. The ink level is not kept as a variable; internal choice only models that the process decides on its own.",
        ),
      },
      {
        id: "test-passes",
        kind: "test",
        title: t("テストは通ることがある", "The test can pass"),
        actor: "test",
        to: ["impl"],
        summary: t(
          `color → print を頼むテストは、実装が${COLOR_TEST_RESULT.isAccepted ? "起こせる" : "起こせない"}並びなので通りうる`,
          `A test asking for color → print can pass, since the implementation ${COLOR_TEST_RESULT.isAccepted ? "can" : "cannot"} perform that sequence`,
        ),
        explain: t(
          `実装は ${COLOR_TEST.join(" → ")} を起こせる（機械が両方を受け付ける側を選んだとき）。インクが十分ある環境でテストを流すと、たいてい通る。通ったという事実からは、断られる場合が無いことまでは分からない。`,
          `The implementation can perform ${COLOR_TEST.join(" → ")} (when the machine picks the branch that accepts both). Run the test with plenty of ink and it usually passes. A pass does not tell you that it can never refuse.`,
        ),
        set: {
          test: {
            isHidden: false,
            tone: COLOR_TEST_RESULT.isAccepted ? "ok" : "bad",
            rows: {
              [t("並び", "sequence")]: COLOR_TEST.join(" → "),
              [t("結果", "result")]: COLOR_TEST_RESULT.isAccepted
                ? t("通った", "passed")
                : t("落ちた", "failed"),
            },
          },
        },
      },
      {
        id: "same-traces",
        kind: "explore",
        title: t("トレースでは同じ", "Same by traces"),
        actor: "checker",
        to: ["spec", "impl"],
        summary: t(
          `トレース詳細化 Spec ⊑T Impl は${holdsText(TRACE_RESULT.holds)}`,
          `Trace refinement Spec ⊑T Impl ${holdsText(TRACE_RESULT.holds)}`,
        ),
        explain: t(
          "実装が起こせるイベントの並びは、どれも仕様も起こせる。mono だけの側に進んでも、起きるのは仕様にもある並びだけだから。トレースは「何が起きたか」しか見ないので、外部選択と内部選択の違いが見えない。",
          "Every event sequence the implementation can perform, the spec can too: even on the mono-only branch, only sequences the spec also has can happen. Traces only show what happened, so they cannot see the difference between external and internal choice.",
        ),
        set: {
          checker: {
            isHidden: false,
            tone: TRACE_RESULT.holds ? "ok" : "bad",
            rows: { "⊑T": holdsText(TRACE_RESULT.holds) },
          },
        },
      },
      {
        id: "failures",
        kind: "explore",
        title: t("失敗も比べる", "Compare failures too"),
        actor: "checker",
        to: ["spec", "impl"],
        summary: t(
          "失敗＝トレースと、その後に拒否できるイベントの組",
          "A failure = a trace plus the events it can refuse afterwards",
        ),
        explain: t(
          "CSP の失敗（failure）は「あるトレースの後で、これらのイベントを差し出されても全部断れる」という組を指す。失敗詳細化 Spec ⊑F Impl は、実装のどの失敗も仕様の失敗かを調べる。仕様が断らない所で実装が断れたら、それが反例になる。",
          'A failure in CSP is a pair meaning "after this trace, it can refuse all of these events even when they are offered". Failures refinement Spec ⊑F Impl checks that every failure of the implementation is a failure of the spec. If the implementation can refuse where the spec would not, that is a counterexample.',
        ),
        set: {
          checker: { tone: "wait", rows: { "⊑F": t("調べている", "checking") } },
        },
        simplified: t(
          "このサイトは安定失敗モデル（見えない動きが起きない状態でだけ拒否を数える）で比べ、発散（見えない動きの無限の輪）は見ていない。FDR の [F= と同じ扱い。",
          "This site compares in the stable-failures model (refusals are counted only in states with no invisible move) and does not look at divergence (an endless loop of invisible moves). This matches FDR's [F=.",
        ),
      },
      {
        id: "refuses-color",
        kind: "found",
        title: t(`${refused}を断れる`, `It can refuse ${refused}`),
        actor: "impl",
        to: ["user"],
        summary: t(
          `反例 ${failureText(FAILURE, language)}: 最初の時点で ${refused} を拒否できる`,
          `Counterexample ${failureText(FAILURE, language)}: it can refuse ${refused} at the start`,
        ),
        explain: t(
          `実装は、何も起きていない最初の時点で mono だけの側へ勝手に進み、利用者の ${refused} を断れる。仕様は外部選択なので、最初に ${refused} を断ることはない。トレースでは見えなかった違いが、拒否で見分けられた。`,
          `At the start, before anything has happened, the implementation can move on its own to the mono-only branch and refuse the user's ${refused}. The spec uses external choice, so it never refuses ${refused} at the start. A difference that traces could not see is told apart by refusals.`,
        ),
        set: {
          impl: { tone: "bad", rows: { [t("拒否できる", "can refuse")]: refused } },
          user: {
            tone: "bad",
            rows: {
              [t("頼んだ", "asked for")]: refused,
              [t("結果", "result")]: t("断られた", "refused"),
            },
          },
          checker: { tone: "bad", rows: { "⊑F": holdsText(FAILURE_RESULT.holds) } },
        },
        detail: [
          {
            title: t("失敗詳細化の反例", "Failures refinement counterexample"),
            fields: [
              {
                label: t("トレース", "Trace"),
                value: traceText(FAILURE.trace, language),
              },
              {
                label: t("実装だけが拒否できる", "Only the implementation refuses"),
                value: `{${FAILURE.refusal.join(", ")}}`,
              },
            ],
          },
        ],
        simplified: t(
          "反例の拒否には、仕様ならその時点で必ず受け付けるのに実装が拒否できるイベントだけを並べている。拒否できるイベントを全部並べると、仕様も拒否できるもの（print など）が混ざって読みにくいため。",
          "The counterexample's refusal lists only events the spec would always accept at that point but the implementation can refuse. Listing every refusable event would mix in ones the spec can refuse too (such as print) and be hard to read.",
        ),
      },
      {
        id: "test-refusal",
        kind: "test",
        title: t("断られる場合も試す", "Also test the refusal case"),
        actor: "test",
        to: ["impl"],
        summary: t(
          `通るテストしか書かないと、断られるケースを見逃す。内部選択をやめると ⊑F も${holdsText(FIXED_FAILURE.holds)}`,
          `Writing only passing tests misses the refusal case. Without the internal choice, ⊑F also ${holdsText(FIXED_FAILURE.holds)}`,
        ),
        explain: t(
          `テストに置きかえると、「インクが少ない状態を作ってから color を頼み、断られないか」を確かめるテストを足すことになる。実装を直して内部選択をやめ、仕様と同じ外部選択にすれば、トレース詳細化も失敗詳細化も成り立つ。`,
          `As a test, this means adding one that sets up low ink, asks for color, and checks it is not refused. Fix the implementation to drop the internal choice and use the same external choice as the spec, and both trace and failures refinement hold.`,
        ),
        set: {
          test: {
            tone: "wait",
            rows: {
              [t("並び", "sequence")]: t("インク少→color", "low ink → color"),
              [t("結果", "result")]: t("断られないか", "not refused?"),
            },
          },
          checker: {
            tone: FIXED_FAILURE.holds ? "ok" : "bad",
            rows: {
              "⊑T": t(
                `直すと${holdsText(FIXED_TRACE.holds)}`,
                `fixed: ${holdsText(FIXED_TRACE.holds)}`,
              ),
              "⊑F": t(
                `直すと${holdsText(FIXED_FAILURE.holds)}`,
                `fixed: ${holdsText(FIXED_FAILURE.holds)}`,
              ),
            },
          },
        },
      },
    ],
    lab: {
      title: t(
        "内部選択のあり・なしを比べる",
        "Compare with and without internal choice",
      ),
      hint: t(
        "「なし」にすると、仕様と同じ外部選択だけの実装（printerSpec）と比べる。トレース詳細化はどちらも成り立つが、失敗詳細化は内部選択があると破れる。",
        'Set it to "no" to compare an implementation with only the same external choice as the spec (printerSpec). Trace refinement holds either way, but failures refinement breaks when there is an internal choice.',
      ),
      inputs: [
        {
          id: "choice",
          label: t("内部選択（あり / なし）", "Internal choice (yes / no)"),
          initial: t("あり", "yes"),
        },
      ],
      compute: (values): Field[] => {
        const hasInternal = parseChoice(values.choice);
        const impl: Proc = hasInternal ? printerImpl() : printerSpec();
        const traces = traceRefines(SPEC, impl, PRINTER_ENV);
        const failures = failuresRefines(SPEC, impl, PRINTER_ENV);
        return [
          {
            label: t("内部選択", "Internal choice"),
            value: hasInternal ? t("あり", "yes") : t("なし", "no"),
          },
          {
            label: "Spec ⊑T Impl",
            value: holdsText(traces.holds),
            tone: traces.holds ? "ok" : "bad",
          },
          {
            label: "Spec ⊑F Impl",
            value: holdsText(failures.holds),
            tone: failures.holds ? "ok" : "bad",
          },
          {
            label: t("失敗の反例", "Failure counterexample"),
            value: failures.counterexample
              ? failureText(failures.counterexample, language)
              : t("なし", "none"),
            tone: failures.counterexample ? "bad" : "ok",
          },
        ];
      },
    },
  };
}
