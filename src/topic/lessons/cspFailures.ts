import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
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
const REFUSED = FAILURE.refusal.join("・");
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

function traceText(trace: string[]): string {
  return trace.length > 0 ? `⟨${trace.join(", ")}⟩` : "⟨⟩（最初の時点）";
}

function failureText(failure: Failure): string {
  const refusal = failure.refusal.length > 0 ? failure.refusal.join(", ") : "なし";
  return `(${traceText(failure.trace)}, {${refusal}})`;
}

function holdsText(holds: boolean): string {
  return holds ? "成り立つ" : "成り立たない";
}

function parseChoice(text: string | undefined): boolean {
  return !(text ?? "").includes("なし");
}

export const cspFailuresLesson: Lesson = {
  id: "csp-failures",
  category: "csp",
  title: "拒否で見分ける",
  subtitle: "トレースが同じでも、断られるかが違う",
  summary: `インクが少ないと勝手にモノクロしか受け付けなくなるプリンタは、トレース詳細化では仕様を満たすが、失敗詳細化では「最初に${REFUSED}を拒否できる」ことが反例になる。`,
  facts: [
    {
      label: "トレース詳細化",
      value: holdsText(TRACE_RESULT.holds),
      tone: TRACE_RESULT.holds ? "ok" : "bad",
    },
    {
      label: "失敗詳細化",
      value: holdsText(FAILURE_RESULT.holds),
      tone: FAILURE_RESULT.holds ? "ok" : "bad",
    },
    { label: "反例の失敗", value: failureText(FAILURE), tone: "bad" },
    {
      label: "実装の状態",
      value: `${IMPL_LTS.stateCount}個・${IMPL_LTS.transitionCount}遷移`,
    },
    { label: "参考文献", value: `${CSP_BOOK} 6.3節（安定失敗方式）` },
  ],
  actors: [
    {
      id: "user",
      label: "利用者",
      sublabel: "刷り方を選ぶ",
      icon: "person",
      x: 50,
      y: 27,
    },
    {
      id: "spec",
      label: "仕様",
      sublabel: "Spec",
      icon: "spec",
      x: 14,
      y: 27,
    },
    {
      id: "impl",
      label: "実装",
      sublabel: "Impl",
      icon: "process",
      x: 86,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "test",
      label: "テスト",
      sublabel: "color を頼む",
      icon: "test",
      x: 86,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "仕様と実装を比べる",
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
      title: "仕様は利用者が選ぶ",
      actor: "spec",
      to: ["user"],
      summary: `仕様は最初に ${SPEC_FIRST.join("・")} のどちらも受け付ける（外部選択 □）`,
      explain: `「プロセスとイベント」のプリンタの仕様は、□（外部選択）で mono（モノクロを選ぶ）と color（カラーを選ぶ）の両方を差し出して待ち、選ぶと print（刷る）を起こす。どちらにするかは利用者が決めるので、利用者が color を頼めば必ず刷る。`,
      set: { spec: { tone: "ok", rows: { 受け付ける: SPEC_FIRST.join("・") } } },
    },
    {
      id: "impl-internal",
      kind: "spec",
      title: "実装は勝手に決める",
      actor: "impl",
      summary: `実装は ⊓（内部選択）で、両方を受け付けるか mono だけにするかを自分で決める`,
      explain: `⊓ は内部選択と呼び、どちらに進むかをプロセスが勝手に決める。この実装は、カラーのインクが少ないと、利用者が何もしないうちに mono しか受け付けない状態に移ることがある。全部たどると${IMPL_LTS.stateCount}状態・${IMPL_LTS.transitionCount}遷移で、そのうち${IMPL_HIDDEN}本がこの見えない選択（${TAU}）。`,
      set: {
        impl: {
          isHidden: false,
          tone: "wait",
          rows: {
            選択の先: IMPL_BRANCHES.map((branch) => branch.join("・")).join(" か "),
            状態: `${IMPL_LTS.stateCount}個`,
          },
        },
      },
      detail: [
        {
          title: "このサイトの書き方",
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
      simplified:
        "実物の CSPM（FDR の記法）では、外部選択を []、内部選択を |~| と書くなど、書き方が違う。このサイトは記号で短く見せている。インクの量は変数として持たず、「勝手に決める」ことだけを内部選択で表した。",
    },
    {
      id: "test-passes",
      kind: "test",
      title: "テストは通ることがある",
      actor: "test",
      to: ["impl"],
      summary: `color → print を頼むテストは、実装が${COLOR_TEST_RESULT.isAccepted ? "起こせる" : "起こせない"}並びなので通りうる`,
      explain: `実装は ${COLOR_TEST.join(" → ")} を起こせる（機械が両方を受け付ける側を選んだとき）。インクが十分ある環境でテストを流すと、たいてい通る。通ったという事実からは、断られる場合が無いことまでは分からない。`,
      set: {
        test: {
          isHidden: false,
          tone: COLOR_TEST_RESULT.isAccepted ? "ok" : "bad",
          rows: {
            並び: COLOR_TEST.join(" → "),
            結果: COLOR_TEST_RESULT.isAccepted ? "通った" : "落ちた",
          },
        },
      },
    },
    {
      id: "same-traces",
      kind: "explore",
      title: "トレースでは同じ",
      actor: "checker",
      to: ["spec", "impl"],
      summary: `トレース詳細化 Spec ⊑T Impl は${holdsText(TRACE_RESULT.holds)}`,
      explain:
        "実装が起こせるイベントの並びは、どれも仕様も起こせる。mono だけの側に進んでも、起きるのは仕様にもある並びだけだから。トレースは「何が起きたか」しか見ないので、外部選択と内部選択の違いが見えない。",
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
      title: "失敗も比べる",
      actor: "checker",
      to: ["spec", "impl"],
      summary: "失敗＝トレースと、その後に拒否できるイベントの組",
      explain:
        "CSP の失敗（failure）は「あるトレースの後で、これらのイベントを差し出されても全部断れる」という組を指す。失敗詳細化 Spec ⊑F Impl は、実装のどの失敗も仕様の失敗かを調べる。仕様が断らない所で実装が断れたら、それが反例になる。",
      set: { checker: { tone: "wait", rows: { "⊑F": "調べている" } } },
      simplified:
        "このサイトは安定失敗モデル（見えない動きが起きない状態でだけ拒否を数える）で比べ、発散（見えない動きの無限の輪）は見ていない。FDR の [F= と同じ扱い。",
    },
    {
      id: "refuses-color",
      kind: "found",
      title: `${REFUSED}を断れる`,
      actor: "impl",
      to: ["user"],
      summary: `反例 ${failureText(FAILURE)}: 最初の時点で ${REFUSED} を拒否できる`,
      explain: `実装は、何も起きていない最初の時点で mono だけの側へ勝手に進み、利用者の ${REFUSED} を断れる。仕様は外部選択なので、最初に ${REFUSED} を断ることはない。トレースでは見えなかった違いが、拒否で見分けられた。`,
      set: {
        impl: { tone: "bad", rows: { 拒否できる: REFUSED } },
        user: { tone: "bad", rows: { 頼んだ: REFUSED, 結果: "断られた" } },
        checker: { tone: "bad", rows: { "⊑F": holdsText(FAILURE_RESULT.holds) } },
      },
      detail: [
        {
          title: "失敗詳細化の反例",
          fields: [
            { label: "トレース", value: traceText(FAILURE.trace) },
            { label: "実装だけが拒否できる", value: `{${FAILURE.refusal.join(", ")}}` },
          ],
        },
      ],
      simplified:
        "反例の拒否には、仕様ならその時点で必ず受け付けるのに実装が拒否できるイベントだけを並べている。拒否できるイベントを全部並べると、仕様も拒否できるもの（print など）が混ざって読みにくいため。",
    },
    {
      id: "test-refusal",
      kind: "test",
      title: "断られる場合も試す",
      actor: "test",
      to: ["impl"],
      summary: `通るテストしか書かないと、断られるケースを見逃す。内部選択をやめると ⊑F も${holdsText(FIXED_FAILURE.holds)}`,
      explain: `テストに置きかえると、「インクが少ない状態を作ってから color を頼み、断られないか」を確かめるテストを足すことになる。実装を直して内部選択をやめ、仕様と同じ外部選択にすれば、トレース詳細化も失敗詳細化も成り立つ。`,
      set: {
        test: { tone: "wait", rows: { 並び: "インク少→color", 結果: "断られないか" } },
        checker: {
          tone: FIXED_FAILURE.holds ? "ok" : "bad",
          rows: {
            "⊑T": `直すと${holdsText(FIXED_TRACE.holds)}`,
            "⊑F": `直すと${holdsText(FIXED_FAILURE.holds)}`,
          },
        },
      },
    },
  ],
  lab: {
    title: "内部選択のあり・なしを比べる",
    hint: "「なし」にすると、仕様と同じ外部選択だけの実装（printerSpec）と比べる。トレース詳細化はどちらも成り立つが、失敗詳細化は内部選択があると破れる。",
    inputs: [{ id: "choice", label: "内部選択（あり / なし）", initial: "あり" }],
    compute: (values): Field[] => {
      const hasInternal = parseChoice(values.choice);
      const impl: Proc = hasInternal ? printerImpl() : printerSpec();
      const traces = traceRefines(SPEC, impl, PRINTER_ENV);
      const failures = failuresRefines(SPEC, impl, PRINTER_ENV);
      return [
        { label: "内部選択", value: hasInternal ? "あり" : "なし" },
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
          label: "失敗の反例",
          value: failures.counterexample
            ? failureText(failures.counterexample)
            : "なし",
          tone: failures.counterexample ? "bad" : "ok",
        },
      ];
    },
  },
};
