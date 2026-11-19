import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { displayName } from "../labels";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
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

type T = (ja: string, en: string) => string;

function holdsText(result: { holds: boolean }, t: T): string {
  return result.holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
}

function traceText(trace: string[], t: T): string {
  return trace.length > 0 ? `⟨${trace.join(", ")}⟩` : t("⟨⟩（空）", "⟨⟩ (empty)");
}

function failureText(failure: Failure, t: T): string {
  // 拒否が空の反例は、トレースの段階で外れたもの（失敗詳細化はトレース詳細化も含む）
  if (failure.refusal.length === 0)
    return t(
      `${traceText(failure.trace, t)}（仕様に無いトレース）`,
      `${traceText(failure.trace, t)} (a trace the spec does not have)`,
    );
  return t(
    `${traceText(failure.trace, t)}の後に {${failure.refusal.join(", ")}}を拒否`,
    failure.trace.length > 0
      ? `can refuse {${failure.refusal.join(", ")}} after ${traceText(failure.trace, t)}`
      : `can refuse {${failure.refusal.join(", ")}} from the start`,
  );
}

function parseWiring(text: string | undefined): WiringName {
  // 「比較器を忘れた」か英語の "missing" のときだけ忘れた配線にする。それ以外は既定の正しい配線に戻す。
  const trimmed = (text ?? "").toLowerCase();
  return trimmed.includes("忘") || trimmed.includes("missing")
    ? "missingLast"
    : "correct";
}

function traceField(label: string, result: RefinementResult<string[]>, t: T): Field {
  return {
    label,
    value: holdsText(result, t),
    tone: result.holds ? "ok" : "bad",
    note: result.counterexample
      ? t(
          `反例${traceText(result.counterexample, t)}`,
          `counterexample ${traceText(result.counterexample, t)}`,
        )
      : undefined,
  };
}

function failureField(label: string, result: RefinementResult<Failure>, t: T): Field {
  return {
    label,
    value: holdsText(result, t),
    tone: result.holds ? "ok" : "bad",
    note: result.counterexample
      ? t(
          `反例${failureText(result.counterexample, t)}`,
          `counterexample ${failureText(result.counterexample, t)}`,
        )
      : undefined,
  };
}

export function caseVerifyLesson(language: Language): Lesson {
  const t = translator(language);
  const holds = (result: { holds: boolean }) => holdsText(result, t);
  const trace = (events: string[]) => traceText(events, t);
  // 比較器の名前は labels.ts の表示名を通す（「比較器3」→ "comparator 3"）。
  const comparator = (n: number) => displayName(`比較器${n}`, language);
  // 検査器のカードの行の名前（⊑ の式）。「忘れた配線」だけ訳す。
  const missingWiring = t("忘れた配線", "missing");
  const concurrent = t("並行版", "concurrent");
  const spec = t("仕様", "spec");
  return {
    id: "case-verify",
    category: "case",
    title: t("逐次の仕様と等価を示す", "Proving it equivalent to a sequential spec"),
    subtitle: t(
      "並行版を、同じ振る舞いの逐次のプロセスで理解する",
      "Understand the concurrent version through a sequential process that behaves the same",
    ),
    summary: t(
      `内部の線を隠した並行版と逐次の仕様は、トレースと失敗の詳細化を両向きに満たし等価${CORRECT_EQUIVALENT ? "になる" : "にならない"}。比較器を忘れた配線は${trace(MISSING_CEX)}が反例になる。`,
      `With its internal wires hidden, the concurrent version and the sequential spec satisfy trace and failures refinement in both directions, so they are ${CORRECT_EQUIVALENT ? "equivalent" : "not equivalent"}. For the wiring missing a comparator, ${trace(MISSING_CEX)} is a counterexample.`,
    ),
    intro: [
      t(
        "前のレッスンで書いた並行版と逐次の仕様が、外から見て同じ振る舞いかを確かめる。等価とは、詳細化（一方の振る舞いが他方の範囲に収まること）が両向きに成り立つことをいう。",
        "Check whether the concurrent version and the sequential spec from the previous lesson behave the same from the outside. Equivalent means refinement (one's behaviour stays within the other's) holds in both directions.",
      ),
      t(
        "並行版は比較器の動く順が多く、テストではその一部しか試せない。等価が示せれば、並行版の細かい順番を考えずに仕様だけで理解でき、次のレッスンではその仕様をテストの判定に使える。",
        "The concurrent version has many orders in which the comparators can move, and tests can try only some of them. Once equivalence is shown, you can understand it through the spec alone, without the detailed orderings, and the next lesson uses that spec to judge tests.",
      ),
      t(
        "図では「並行版」の内部の線を隠してから、「検査器」が「仕様」と両向きに比べる流れを追う。後半は「比較器を忘れた」配線に替えるので、どちらの向きで、どのイベントで食い違いが出るかに注目する。",
        'In the diagram, the internal wires of "Concurrent" are hidden, then the "Checker" compares it with the "Spec" in both directions. In the second half the wiring is swapped for one "Missing a comparator"; watch which direction and which event the mismatch shows up in.',
      ),
    ],
    facts: [
      {
        label: t("正しい配線", "Correct wiring"),
        value: CORRECT_EQUIVALENT
          ? t("仕様と等価", "equivalent to the spec")
          : t("仕様と等価でない", "not equivalent to the spec"),
        tone: CORRECT_EQUIVALENT ? "ok" : "bad",
      },
      {
        label: t("デッドロック・発散", "Deadlock, divergence"),
        value: t(
          `${DEADLOCKS.length}件・${DIVERGENCE ? "あり" : "なし"}`,
          `${DEADLOCKS.length}, ${DIVERGENCE ? "yes" : "none"}`,
        ),
        tone: DEADLOCKS.length === 0 && !DIVERGENCE ? "ok" : "bad",
      },
      {
        label: t("比較器を忘れた配線", "Missing a comparator"),
        value: t(`反例${trace(MISSING_CEX)}`, `counterexample ${trace(MISSING_CEX)}`),
        tone: "bad",
      },
      {
        label: t("実物の道具", "Real tools"),
        value: t("FDR・ProB（[T= ・ [F= ・ [FD=）", "FDR, ProB ([T=, [F=, [FD=)"),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 7.2節（詳細化関係による検証例）`,
          `${CSP_BOOK_EN}, section 7.2 (verification examples using refinement)`,
        ),
      },
    ],
    actors: [
      {
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: t("逐次の並べ替え", "sequential sort"),
        icon: "spec",
        x: 14,
        y: 27,
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("両向きに比べる", "compares both ways"),
        icon: "checker",
        x: 50,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "net",
        label: t("並行版", "Concurrent"),
        sublabel: t("正しい配線", "correct wiring"),
        icon: "process",
        x: 86,
        y: 27,
      },
      {
        id: "missing",
        label: t("比較器を忘れた", "Missing a comparator"),
        sublabel: t("比較器2つの配線", "wiring of 2 comparators"),
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
        title: t("内部の線を隠す", "Hide the internal wires"),
        actor: "net",
        summary: t(
          `並行版から w.a・w.b・w.c を隠し、見えるのを入口と出口だけにする（見えない動き${HIDDEN_MOVES}本）`,
          `Hide w.a, w.b and w.c in the concurrent version so only inputs and outputs are visible (${HIDDEN_MOVES} invisible moves)`,
        ),
        explain: t(
          `仕様には内部の線が出てこないので、並行版の w.a・w.b・w.c を隠蔽（外から見えなくする）してから比べる。隠したイベントは${TAU}（見えない動き）に変わり、${OBSERVED_LTS.stateCount}状態・${OBSERVED_LTS.transitionCount}遷移のうち見えない動きは${HIDDEN_MOVES}本になる（隠す前から比較器が終わる合図の${TAU_BEFORE_HIDING}本があり、隠蔽で${HIDDEN_MOVES - TAU_BEFORE_HIDING}本増えた）。こうすると、作りの違う2つを同じイベント（in.* と out.*）で比べられる。`,
          `The spec has no internal wires, so hide (make invisible from outside) w.a, w.b and w.c in the concurrent version before comparing. Hidden events become ${TAU} (invisible moves); of ${OBSERVED_LTS.stateCount} states and ${OBSERVED_LTS.transitionCount} transitions, ${HIDDEN_MOVES} are invisible moves (${TAU_BEFORE_HIDING} already existed before hiding as the signals that comparators finished, and hiding added ${HIDDEN_MOVES - TAU_BEFORE_HIDING}). Now two differently built processes can be compared on the same events (in.* and out.*).`,
        ),
        set: {
          net: {
            tone: "wait",
            rows: {
              [t("見える", "visible")]: t("in.*・out.*", "in.*, out.*"),
              [t("状態", "states")]: t(
                `${OBSERVED_LTS.stateCount}個`,
                `${OBSERVED_LTS.stateCount}`,
              ),
              [t("見えない動き", "invisible moves")]: t(
                `${HIDDEN_MOVES}本`,
                `${HIDDEN_MOVES}`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("このサイトの書き方", "This site's notation"),
            fields: [
              {
                label: t("並行版", "Concurrent"),
                value: "Network \\ {w.a, w.b, w.c}",
                isCode: true,
              },
            ],
          },
        ],
      },
      {
        id: "spec-to-impl",
        kind: "explore",
        title: t("仕様 ⊑ 並行版を調べる", "Check spec ⊑ concurrent"),
        actor: "checker",
        to: ["spec", "net"],
        summary: t(
          `トレース詳細化は${holds(CORRECT.specToImplTrace)}、失敗詳細化も${holds(CORRECT.specToImplFailures)}`,
          `Trace refinement ${holds(CORRECT.specToImplTrace)}, and failures refinement ${holds(CORRECT.specToImplFailures)} too`,
        ),
        explain: t(
          "まず、並行版が仕様にない並びを起こさないか（トレース詳細化）と、仕様なら受け付けるイベントを並行版が断らないか（失敗詳細化）を調べる。どちらも反例は見つからない。並行版は「仕様の範囲内で動き、止まるべきでない所で止まらない」。",
          'First check that the concurrent version never produces a sequence the spec lacks (trace refinement), and that it never refuses an event the spec would accept (failures refinement). Neither finds a counterexample. The concurrent version "stays within the spec and does not stop where it should not".',
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "ok",
            rows: {
              [`${spec} ⊑T ${concurrent}`]: holds(CORRECT.specToImplTrace),
              [`${spec} ⊑F ${concurrent}`]: holds(CORRECT.specToImplFailures),
            },
          },
        },
      },
      {
        id: "equivalent",
        kind: "explore",
        title: t("逆向きも調べて等価", "Reverse too: equivalent"),
        actor: "checker",
        to: ["spec", "net"],
        summary: t(
          `逆向き（並行版 ⊑ 仕様）も${holds(CORRECT.implToSpecTrace)}。両向きなので等価`,
          `The reverse (concurrent ⊑ spec) ${holds(CORRECT.implToSpecTrace)} as well. Both directions, so equivalent`,
        ),
        explain: t(
          `逆向きに、仕様の起こせる並びと受け付け方を、並行版も全部持っているかを調べる。これも成り立つので、外から見ると2つは区別できない（等価）。比較器が3つ同時に動く並行版を、「全部受け取ってから並べて出す」という逐次のプロセスとして理解してよい、と検査で示せたことになる。`,
          `In reverse, check that the concurrent version has every sequence and every way of accepting that the spec has. This holds too, so from outside the two cannot be told apart (equivalent). The check has shown that the concurrent version, with three comparators running at once, can be understood as the sequential process "take everything, then output it sorted".`,
        ),
        set: {
          checker: {
            rows: {
              [`${concurrent} ⊑T ${spec}`]: holds(CORRECT.implToSpecTrace),
              [`${concurrent} ⊑F ${spec}`]: holds(CORRECT.implToSpecFailures),
            },
          },
          spec: {
            tone: "ok",
            rows: {
              [t("並行版と", "vs concurrent")]: CORRECT_EQUIVALENT
                ? t("等価", "equivalent")
                : t("違う", "different"),
            },
          },
          net: { tone: "ok" },
        },
        simplified: t(
          "同じモデルを CSPM で書いて ProB にかけ、等価（[F= と [FD= を両向き）と反例が一致した（リポジトリの specs/csp）。このサイトの検査器は安定失敗モデルで比べ、発散は別に調べている。",
          "The same model written in CSPM and run through ProB gave the same equivalence ([F= and [FD= in both directions) and the same counterexamples (specs/csp in the repository). This site's checker compares in the stable-failures model and checks divergence separately.",
        ),
      },
      {
        id: "no-deadlock",
        kind: "explore",
        title: t("止まらず空回りしない", "No stalls, no spinning"),
        actor: "checker",
        to: ["net"],
        summary: t(
          `デッドロック${DEADLOCKS.length}件、発散（見えない動きだけの輪）${DIVERGENCE ? "あり" : "なし"}`,
          `${DEADLOCKS.length} ${DEADLOCKS.length === 1 ? "deadlock" : "deadlocks"}, divergence (a loop of only invisible moves): ${DIVERGENCE ? "yes" : "none"}`,
        ),
        explain: t(
          `隠す前の並行版で、正しく終わっていないのに動けない状態（デッドロック）は${DEADLOCKS.length}件。隠した後に見えない動きだけで回り続ける輪（発散）も${DIVERGENCE ? "ある" : "無い"}。比較器どうしが線の受け渡しで待ち合っても、行き詰まらないことが分かる。`,
          `In the concurrent version before hiding, there ${DEADLOCKS.length === 1 ? "is 1 state" : `are ${DEADLOCKS.length} states`} that cannot move without having finished properly (deadlock). After hiding, there ${DIVERGENCE ? "is" : "is no"} loop that keeps going on invisible moves alone (divergence). Even though comparators wait for each other on the wires, they never get stuck.`,
        ),
        set: {
          net: {
            rows: {
              [t("状態", "states")]: null,
              [t("見えない動き", "invisible moves")]: null,
              [t("デッドロック", "deadlocks")]: t(
                `${DEADLOCKS.length}件`,
                `${DEADLOCKS.length}`,
              ),
              [t("発散", "divergence")]: DIVERGENCE
                ? t("あり", "yes")
                : t("なし", "none"),
            },
          },
        },
      },
      {
        id: "missing",
        kind: "found",
        title: t("比較器を忘れた配線", "Wiring missing a comparator"),
        actor: "missing",
        to: ["checker"],
        summary: t(
          `仕様 ⊑T 並行版が${holds(MISSING.specToImplTrace)}。反例${trace(MISSING_CEX)}`,
          `spec ⊑T concurrent ${holds(MISSING.specToImplTrace)}. Counterexample ${trace(MISSING_CEX)}`,
        ),
        explain: t(
          `${comparator(3)}を忘れ、${comparator(1)}の小さい方をそのまま out.0 へ出す配線では、${trace(MISSING_CEX)}が反例になる。in.0.0 は「入口0番で値0を受け渡す」、${MISSING_LAST}は「出口0番（いちばん小さい位置）へ値0を出す」という意味で、入口を${MISSING_READ}つ読んだだけで最小を決めている。3つ目を見ないうちに決めることが、並べ替えを誤る原因になる。`,
          `In wiring that leaves out ${comparator(3)} and sends the smaller value of ${comparator(1)} straight to out.0, ${trace(MISSING_CEX)} is a counterexample. in.0.0 means "value 0 is passed on input 0", and ${MISSING_LAST} means "value 0 is sent to output 0 (the smallest position)": it decides the minimum after reading only ${MISSING_READ} inputs. Deciding before seeing the third value is what makes the sort go wrong.`,
        ),
        set: {
          missing: {
            isHidden: false,
            tone: "bad",
            rows: {
              [t("読んだ入口", "inputs read")]: t(
                `${MISSING_READ}つ`,
                `${MISSING_READ}`,
              ),
              [t("出した", "sent")]: MISSING_LAST,
              [t("デッドロック", "deadlocks")]: t(
                `${MISSING_DEADLOCKS.length}件`,
                `${MISSING_DEADLOCKS.length}`,
              ),
            },
          },
          checker: {
            tone: "bad",
            rows: {
              [`${spec} ⊑T ${concurrent}`]: null,
              [`${spec} ⊑F ${concurrent}`]: null,
              [`${concurrent} ⊑T ${spec}`]: null,
              [`${concurrent} ⊑F ${spec}`]: null,
              [`${spec} ⊑T ${missingWiring}`]: holds(MISSING.specToImplTrace),
            },
          },
        },
        detail: [
          {
            title: t("反例のトレース", "Counterexample trace"),
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
        title: t("逆向きで誤りが見える", "The reverse shows the error"),
        actor: "checker",
        to: ["spec", "missing"],
        summary: t(
          `逆向きの反例${trace(MISSING_REVERSE_CEX)}: 仕様は出せるが、忘れた配線は出せない`,
          `Reverse counterexample ${trace(MISSING_REVERSE_CEX)}: the spec can output it, the missing wiring cannot`,
        ),
        explain: t(
          `逆向き（忘れた配線 ⊑T 仕様）も成り立たない。入力${MISSING_REVERSE_INPUTS.join("・")}の後、仕様は${MISSING_REVERSE_LAST}を出せるが、忘れた配線は出せない。最初の2つの小さい方を最小と決めてしまうので、3つ目にもっと小さい値が来ると出口0番に正しい最小を出せない。`,
          `The reverse (missing wiring ⊑T spec) fails too. After the inputs ${MISSING_REVERSE_INPUTS.join(", ")}, the spec can output ${MISSING_REVERSE_LAST} but the missing wiring cannot. It takes the smaller of the first two as the minimum, so when the third value is smaller still, it cannot send the true minimum to output 0.`,
        ),
        set: {
          spec: {
            tone: "ok",
            rows: {
              [t("並行版と", "vs concurrent")]: null,
              [t("出せる", "can send")]: MISSING_REVERSE_LAST,
            },
          },
          missing: {
            rows: {
              [t("デッドロック", "deadlocks")]: null,
              [t("出せない", "cannot send")]: MISSING_REVERSE_LAST,
            },
          },
          checker: {
            rows: { [`${missingWiring} ⊑T ${spec}`]: holds(MISSING.implToSpecTrace) },
          },
        },
        detail: [
          {
            title: t(
              "拒否で見た反例（失敗詳細化 忘れた配線 ⊑F 仕様）",
              "Counterexample by refusal (failures refinement: missing ⊑F spec)",
            ),
            fields: [
              {
                label: t("トレース", "Trace"),
                value: trace(MISSING_FAILURE.trace),
                isCode: true,
              },
              {
                label: t("仕様が拒否できる", "Spec can refuse"),
                value: `{${MISSING_FAILURE.refusal.join(", ")}}`,
                isCode: true,
                note: t(
                  "忘れた配線はこの時点で必ず受け付けるが、仕様はまだ出さない",
                  "the missing wiring always accepts it at this point, but the spec does not output yet",
                ),
              },
            ],
          },
        ],
      },
    ],
    lab: {
      title: t("配線を選んで比べる", "Pick a wiring and compare"),
      hint: t(
        "「正しい」か「比較器を忘れた」を入れる。両向きのトレース詳細化と失敗詳細化を調べ直す。",
        'Enter "correct" or "missing a comparator". Trace and failures refinement are checked again in both directions.',
      ),
      inputs: [
        {
          id: "wiring",
          label: t(
            "配線（正しい / 比較器を忘れた）",
            "Wiring (correct / missing a comparator)",
          ),
          initial: t("正しい", "correct"),
        },
      ],
      compute: (values): Field[] => {
        const wiring = parseWiring(values.wiring);
        const v = compareBothWays(wiring);
        const equivalent = isEquivalent(v);
        return [
          {
            label: t("配線", "Wiring"),
            value:
              wiring === "correct"
                ? t("正しい", "correct")
                : t("比較器を忘れた", "missing a comparator"),
          },
          traceField(`${spec} ⊑T ${concurrent}`, v.specToImplTrace, t),
          traceField(`${concurrent} ⊑T ${spec}`, v.implToSpecTrace, t),
          failureField(`${spec} ⊑F ${concurrent}`, v.specToImplFailures, t),
          failureField(`${concurrent} ⊑F ${spec}`, v.implToSpecFailures, t),
          {
            label: t("まとめ", "Summary"),
            value: equivalent
              ? t("仕様と等価", "equivalent to the spec")
              : t("仕様と等価でない", "not equivalent to the spec"),
            tone: equivalent ? "ok" : "bad",
          },
        ];
      },
    },
  };
}
