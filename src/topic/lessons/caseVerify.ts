import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import {
  deadlocks,
  divergence,
  explore,
  type Failure,
  failuresRefines,
  type RefinementResult,
  TAU,
  traceRefines,
} from "../csp";
import {
  networkModel,
  observedNetwork,
  SORT_ENV,
  sortSpec,
  type WiringName,
} from "../sortModels";

interface Verdicts {
  specToImplTrace: RefinementResult<string[]>;
  implToSpecTrace: RefinementResult<string[]>;
  specToImplFailures: RefinementResult<Failure>;
  implToSpecFailures: RefinementResult<Failure>;
}

/** 仕様と並行版を、トレースと失敗の両方で、両向きに比べる。 */
function compareBothWays(wiring: WiringName): Verdicts {
  const spec = sortSpec();
  const net = observedNetwork(wiring);
  return {
    specToImplTrace: traceRefines(spec, net, SORT_ENV),
    implToSpecTrace: traceRefines(net, spec, SORT_ENV),
    specToImplFailures: failuresRefines(spec, net, SORT_ENV),
    implToSpecFailures: failuresRefines(net, spec, SORT_ENV),
  };
}

function isEquivalent(v: Verdicts): boolean {
  return (
    v.specToImplTrace.holds &&
    v.implToSpecTrace.holds &&
    v.specToImplFailures.holds &&
    v.implToSpecFailures.holds
  );
}

const CORRECT = compareBothWays("correct");
const MISSING = compareBothWays("missingLast");
const CORRECT_EQUIVALENT = isEquivalent(CORRECT);
const OBSERVED_LTS = explore(observedNetwork("correct"), SORT_ENV);
const HIDDEN_MOVES = OBSERVED_LTS.edges.filter((edge) => edge.ev === TAU).length;
// 隠す前から、比較器が終わったときの見えない動き（✓ が τ になる分）がある。
const TAU_BEFORE_HIDING = explore(networkModel("correct"), SORT_ENV).edges.filter(
  (edge) => edge.ev === TAU,
).length;
const DEADLOCKS = deadlocks(networkModel("correct"), SORT_ENV);
const DIVERGENCE = divergence(observedNetwork("correct"), SORT_ENV);
const MISSING_DEADLOCKS = deadlocks(networkModel("missingLast"), SORT_ENV);

// 比較器を忘れた配線の反例（仕様に無いトレース）
const MISSING_CEX = MISSING.specToImplTrace.counterexample!;
const MISSING_LAST = MISSING_CEX.at(-1)!;
const MISSING_READ = MISSING_CEX.filter((ev) => ev.startsWith("in.")).length;
// 逆向き（仕様にできて並行版にできないトレース）
const MISSING_REVERSE_CEX = MISSING.implToSpecTrace.counterexample!;
const MISSING_REVERSE_LAST = MISSING_REVERSE_CEX.at(-1)!;
const MISSING_REVERSE_INPUTS = MISSING_REVERSE_CEX.filter((ev) => ev.startsWith("in."));
// 拒否での反例（忘れた配線を仕様の側に置いて比べる）: 忘れた配線ならその時点で必ず受け付けるのに、
// 逐次の仕様は拒否できるイベント。
const MISSING_FAILURE = MISSING.implToSpecFailures.counterexample!;

function holdsText(result: { holds: boolean }): string {
  return result.holds ? "成り立つ" : "成り立たない";
}

function traceText(trace: string[]): string {
  return trace.length > 0 ? `⟨${trace.join(", ")}⟩` : "⟨⟩（空）";
}

function failureText(failure: Failure): string {
  // 拒否が空の反例は、トレースの段階で外れたもの（失敗詳細化はトレース詳細化も含む）
  if (failure.refusal.length === 0)
    return `${traceText(failure.trace)}（仕様に無いトレース）`;
  return `${traceText(failure.trace)}の後に {${failure.refusal.join(", ")}}を拒否`;
}

function parseWiring(text: string | undefined): WiringName {
  return (text ?? "").includes("忘") ? "missingLast" : "correct";
}

function traceField(label: string, result: RefinementResult<string[]>): Field {
  return {
    label,
    value: holdsText(result),
    tone: result.holds ? "ok" : "bad",
    note: result.counterexample ? `反例${traceText(result.counterexample)}` : undefined,
  };
}

function failureField(label: string, result: RefinementResult<Failure>): Field {
  return {
    label,
    value: holdsText(result),
    tone: result.holds ? "ok" : "bad",
    note: result.counterexample
      ? `反例${failureText(result.counterexample)}`
      : undefined,
  };
}

export const caseVerifyLesson: Lesson = {
  id: "case-verify",
  category: "case",
  title: "逐次の仕様と等価を示す",
  subtitle: "並行版を、同じ振る舞いの逐次のプロセスで理解する",
  summary: `内部の線を隠した並行版と逐次の仕様は、トレースと失敗の詳細化を両向きに満たし等価${CORRECT_EQUIVALENT ? "になる" : "にならない"}。比較器を忘れた配線は${traceText(MISSING_CEX)}が反例になる。`,
  facts: [
    {
      label: "正しい配線",
      value: CORRECT_EQUIVALENT ? "仕様と等価" : "仕様と等価でない",
      tone: CORRECT_EQUIVALENT ? "ok" : "bad",
    },
    {
      label: "デッドロック・発散",
      value: `${DEADLOCKS.length}件・${DIVERGENCE ? "あり" : "なし"}`,
      tone: DEADLOCKS.length === 0 && !DIVERGENCE ? "ok" : "bad",
    },
    {
      label: "比較器を忘れた配線",
      value: `反例${traceText(MISSING_CEX)}`,
      tone: "bad",
    },
    { label: "実物の道具", value: "FDR・ProB（[T= ・ [F= ・ [FD=）" },
    { label: "参考文献", value: `${CSP_BOOK} 7.2節（詳細化関係による検証例）` },
  ],
  actors: [
    {
      id: "spec",
      label: "仕様",
      sublabel: "逐次の並べ替え",
      icon: "spec",
      x: 14,
      y: 27,
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "両向きに比べる",
      icon: "checker",
      x: 50,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "net",
      label: "並行版",
      sublabel: "正しい配線",
      icon: "process",
      x: 86,
      y: 27,
    },
    {
      id: "missing",
      label: "比較器を忘れた",
      sublabel: "比較器2つの配線",
      icon: "process",
      x: 86,
      y: 73,
      initial: { isHidden: true },
    },
  ],
  links: [
    { from: "spec", to: "checker" },
    { from: "net", to: "checker" },
    { from: "missing", to: "checker" },
  ],
  steps: [
    {
      id: "hide",
      kind: "spec",
      title: "内部の線を隠す",
      actor: "net",
      summary: `並行版から w.a・w.b・w.c を隠し、見えるのを入口と出口だけにする（見えない動き${HIDDEN_MOVES}本）`,
      explain: `仕様には内部の線が出てこないので、並行版の w.a・w.b・w.c を隠蔽（外から見えなくする）してから比べる。隠したイベントは${TAU}（見えない動き）に変わり、${OBSERVED_LTS.stateCount}状態・${OBSERVED_LTS.transitionCount}遷移のうち見えない動きは${HIDDEN_MOVES}本になる（隠す前から比較器が終わる合図の${TAU_BEFORE_HIDING}本があり、隠蔽で${HIDDEN_MOVES - TAU_BEFORE_HIDING}本増えた）。こうすると、作りの違う2つを同じイベント（in.* と out.*）で比べられる。`,
      set: {
        net: {
          tone: "wait",
          rows: {
            見える: "in.*・out.*",
            状態: `${OBSERVED_LTS.stateCount}個`,
            見えない動き: `${HIDDEN_MOVES}本`,
          },
        },
      },
      detail: [
        {
          title: "このサイトの書き方",
          fields: [
            { label: "並行版", value: "Network \\ {w.a, w.b, w.c}", isCode: true },
          ],
        },
      ],
    },
    {
      id: "spec-to-impl",
      kind: "explore",
      title: "仕様 ⊑ 並行版を調べる",
      actor: "checker",
      to: ["spec", "net"],
      summary: `トレース詳細化は${holdsText(CORRECT.specToImplTrace)}、失敗詳細化も${holdsText(CORRECT.specToImplFailures)}`,
      explain:
        "まず、並行版が仕様にない並びを起こさないか（トレース詳細化）と、仕様なら受け付けるイベントを並行版が断らないか（失敗詳細化）を調べる。どちらも反例は見つからない。並行版は「仕様の範囲内で動き、止まるべきでない所で止まらない」。",
      set: {
        checker: {
          isHidden: false,
          tone: "ok",
          rows: {
            "仕様 ⊑T 並行版": holdsText(CORRECT.specToImplTrace),
            "仕様 ⊑F 並行版": holdsText(CORRECT.specToImplFailures),
          },
        },
      },
    },
    {
      id: "equivalent",
      kind: "explore",
      title: "逆向きも調べて等価",
      actor: "checker",
      to: ["spec", "net"],
      summary: `逆向き（並行版 ⊑ 仕様）も${holdsText(CORRECT.implToSpecTrace)}。両向きなので等価`,
      explain: `逆向きに、仕様の起こせる並びと受け付け方を、並行版も全部持っているかを調べる。これも成り立つので、外から見ると2つは区別できない（等価）。比較器が3つ同時に動く並行版を、「全部受け取ってから並べて出す」という逐次のプロセスとして理解してよい、と検査で示せたことになる。`,
      set: {
        checker: {
          rows: {
            "並行版 ⊑T 仕様": holdsText(CORRECT.implToSpecTrace),
            "並行版 ⊑F 仕様": holdsText(CORRECT.implToSpecFailures),
          },
        },
        spec: { tone: "ok", rows: { 並行版と: CORRECT_EQUIVALENT ? "等価" : "違う" } },
        net: { tone: "ok" },
      },
      simplified:
        "同じモデルを CSPM で書いて ProB にかけ、等価（[F= と [FD= を両向き）と反例が一致した（リポジトリの specs/csp）。このサイトの検査器は安定失敗モデルで比べ、発散は別に調べている。",
    },
    {
      id: "no-deadlock",
      kind: "explore",
      title: "止まらず空回りしない",
      actor: "checker",
      to: ["net"],
      summary: `デッドロック${DEADLOCKS.length}件、発散（見えない動きだけの輪）${DIVERGENCE ? "あり" : "なし"}`,
      explain: `隠す前の並行版で、正しく終わっていないのに動けない状態（デッドロック）は${DEADLOCKS.length}件。隠した後に見えない動きだけで回り続ける輪（発散）も${DIVERGENCE ? "ある" : "無い"}。比較器どうしが線の受け渡しで待ち合っても、行き詰まらないことが分かる。`,
      set: {
        net: {
          rows: {
            状態: null,
            見えない動き: null,
            デッドロック: `${DEADLOCKS.length}件`,
            発散: DIVERGENCE ? "あり" : "なし",
          },
        },
      },
    },
    {
      id: "missing",
      kind: "found",
      title: "比較器を忘れた配線",
      actor: "missing",
      to: ["checker"],
      summary: `仕様 ⊑T 並行版が${holdsText(MISSING.specToImplTrace)}。反例${traceText(MISSING_CEX)}`,
      explain: `比較器3を忘れ、比較器1の小さい方をそのまま out.0 へ出す配線では、${traceText(MISSING_CEX)}が反例になる。in.0.0 は「入口0番で値0を受け渡す」、${MISSING_LAST}は「出口0番（いちばん小さい位置）へ値0を出す」という意味で、入口を${MISSING_READ}つ読んだだけで最小を決めている。3つ目を見ないうちに決めることが、並べ替えを誤る原因になる。`,
      set: {
        missing: {
          isHidden: false,
          tone: "bad",
          rows: {
            読んだ入口: `${MISSING_READ}つ`,
            出した: MISSING_LAST,
            デッドロック: `${MISSING_DEADLOCKS.length}件`,
          },
        },
        checker: {
          tone: "bad",
          rows: {
            "仕様 ⊑T 並行版": null,
            "仕様 ⊑F 並行版": null,
            "並行版 ⊑T 仕様": null,
            "並行版 ⊑F 仕様": null,
            "仕様 ⊑T 忘れた配線": holdsText(MISSING.specToImplTrace),
          },
        },
      },
      detail: [
        {
          title: "反例のトレース",
          fields: MISSING_CEX.map((ev, index) => ({
            label: `${index + 1}`,
            value: ev,
            isCode: true,
          })),
        },
      ],
    },
    {
      id: "wrong-value",
      kind: "found",
      title: "逆向きで誤りが見える",
      actor: "checker",
      to: ["spec", "missing"],
      summary: `逆向きの反例${traceText(MISSING_REVERSE_CEX)}: 仕様は出せるが、忘れた配線は出せない`,
      explain: `逆向き（忘れた配線 ⊑T 仕様）も成り立たない。入力${MISSING_REVERSE_INPUTS.join("・")}の後、仕様は${MISSING_REVERSE_LAST}を出せるが、忘れた配線は出せない。最初の2つの小さい方を最小と決めてしまうので、3つ目にもっと小さい値が来ると出口0番に正しい最小を出せない。`,
      set: {
        spec: { tone: "ok", rows: { 並行版と: null, 出せる: MISSING_REVERSE_LAST } },
        missing: { rows: { デッドロック: null, 出せない: MISSING_REVERSE_LAST } },
        checker: {
          rows: { "忘れた配線 ⊑T 仕様": holdsText(MISSING.implToSpecTrace) },
        },
      },
      detail: [
        {
          title: "拒否で見た反例（失敗詳細化 忘れた配線 ⊑F 仕様）",
          fields: [
            {
              label: "トレース",
              value: traceText(MISSING_FAILURE.trace),
              isCode: true,
            },
            {
              label: "仕様が拒否できる",
              value: `{${MISSING_FAILURE.refusal.join(", ")}}`,
              isCode: true,
              note: "忘れた配線はこの時点で必ず受け付けるが、仕様はまだ出さない",
            },
          ],
        },
      ],
    },
  ],
  lab: {
    title: "配線を選んで比べる",
    hint: "「正しい」か「比較器を忘れた」を入れる。両向きのトレース詳細化と失敗詳細化を調べ直す。",
    inputs: [
      { id: "wiring", label: "配線（正しい / 比較器を忘れた）", initial: "正しい" },
    ],
    compute: (values): Field[] => {
      const wiring = parseWiring(values.wiring);
      const v = compareBothWays(wiring);
      const equivalent = isEquivalent(v);
      return [
        { label: "配線", value: wiring === "correct" ? "正しい" : "比較器を忘れた" },
        traceField("仕様 ⊑T 並行版", v.specToImplTrace),
        traceField("並行版 ⊑T 仕様", v.implToSpecTrace),
        failureField("仕様 ⊑F 並行版", v.specToImplFailures),
        failureField("並行版 ⊑F 仕様", v.implToSpecFailures),
        {
          label: "まとめ",
          value: equivalent ? "仕様と等価" : "仕様と等価でない",
          tone: equivalent ? "ok" : "bad",
        },
      ];
    },
  },
};
