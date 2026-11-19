import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import {
  checkLaw,
  explore,
  type FdCounterexample,
  failuresDivergencesRefines,
  failuresRefines,
  traceRefines,
} from "../csp";
import { philosophers, PHILOSOPHER_ENV } from "../cspModels";
import { FOCUS_ENV, FOCUS_EVENTS, FOCUS_SPEC, focusOnPhilosopher0 } from "../cspCases";

const PEOPLE = 3;

// ここで呼ぶ比較はどれも数ミリ秒で終わる（隠した後の全体が数十状態しかないため）。
const WHOLE = explore(philosophers(PEOPLE, false), PHILOSOPHER_ENV);
const FOCUSED = explore(focusOnPhilosopher0(false), FOCUS_ENV);
const SPEC_LTS = explore(FOCUS_SPEC, FOCUS_ENV);
const LAW_LEFT_FIRST = checkLaw(FOCUS_SPEC, focusOnPhilosopher0(false), FOCUS_ENV);
const LAW_ONE_REVERSED = checkLaw(FOCUS_SPEC, focusOnPhilosopher0(true), FOCUS_ENV);
const FAILURES_LEFT_FIRST = failuresRefines(
  FOCUS_SPEC,
  focusOnPhilosopher0(false),
  FOCUS_ENV,
);
if (!FAILURES_LEFT_FIRST.counterexample) {
  throw new Error("全員が左から取る版で、失敗詳細化の反例が見つからない");
}
const STUCK = FAILURES_LEFT_FIRST.counterexample;
const FAILURES_ONE_REVERSED = failuresRefines(
  FOCUS_SPEC,
  focusOnPhilosopher0(true),
  FOCUS_ENV,
);
const FD_ONE_REVERSED = failuresDivergencesRefines(
  FOCUS_SPEC,
  focusOnPhilosopher0(true),
  FOCUS_ENV,
);
if (FD_ONE_REVERSED.counterexample?.kind !== "divergence") {
  throw new Error("1人だけ逆順の版で、失敗発散詳細化の反例が発散になっていない");
}
const DIVERGE = FD_ONE_REVERSED.counterexample;

// 全体のイベントのうち、残したもの以外の数（pick と put の種類の数）
const ALL_EVENT_COUNT = new Set(
  WHOLE.edges.map((edge) => edge.ev).filter((ev) => /^(pick|put)\./.test(ev)),
).size;
const HIDDEN_COUNT = ALL_EVENT_COUNT - FOCUS_EVENTS.length;

type Translate = ReturnType<typeof translator>;

function traceText(trace: string[], t: Translate): string {
  return trace.length > 0
    ? trace.join(" → ")
    : t("なし（最初から）", "none (from the start)");
}

/** 発散が始まる時点を「最初から」「a → b の後から」と読む。 */
function startText(trace: string[], t: Translate): string {
  return trace.length > 0
    ? t(`${trace.join(" → ")}の後から`, `after ${trace.join(" → ")}`)
    : t("最初から", "from the start");
}

function holdsText(holds: boolean, t: Translate): string {
  return holds ? t("成り立つ", "holds") : t("破れる", "fails");
}

function refusalText(trace: string[], refusal: string[], t: Translate): string {
  return t(
    `${traceText(trace, t)}の後に {${refusal.join(", ")}}を拒否`,
    trace.length > 0
      ? `can refuse {${refusal.join(", ")}} after ${traceText(trace, t)}`
      : `can refuse {${refusal.join(", ")}} from the start`,
  );
}

function fdText(counterexample: FdCounterexample | null, t: Translate): string {
  if (!counterexample) return t("反例なし", "no counterexample");
  if (counterexample.kind === "failure") {
    return `${t("失敗", "failure")}: ${refusalText(counterexample.trace, counterexample.refusal, t)}`;
  }
  if (counterexample.kind === "divergence")
    return `${t("発散", "divergence")}: ${startText(counterexample.trace, t)}`;
  return `${t("トレース", "trace")}: ${traceText(counterexample.trace, t)}`;
}

function parseReversed(text: string | undefined): boolean {
  // 「あり」（英語の画面では yes）と書いたときだけ逆順にする。それ以外（空や読めない入力）は既定の「なし」に戻す。
  const trimmed = (text ?? "").trim().toLowerCase();
  return trimmed.includes("あり") || trimmed.startsWith("yes");
}

export function cspAbstractionLesson(language: Language): Lesson {
  const t = translator(language);
  const tracesEqual = LAW_LEFT_FIRST.traces && LAW_ONE_REVERSED.traces;
  const stuckText = refusalText(STUCK.trace, STUCK.refusal, t);
  return {
    id: "csp-abstraction",
    category: "apply",
    title: t("隠して小さく見る", "Hide to see less"),
    subtitle: t(
      "見たい動きだけ残し、残りを隠して比べる",
      "Keep only the moves you care about, hide the rest, and compare",
    ),
    summary: t(
      `${PEOPLE}人の哲学者から、哲学者0が左のフォークを取る・置くだけを残して隠すと、取る→置くを繰り返す小さな仕様とトレースが等しくなる。失敗で比べるとデッドロックが見え、失敗発散で比べると隠した動きが発散に見える。`,
      `From ${PEOPLE} philosophers, keep only philosopher 0 picking up and putting down the left fork and hide the rest: the traces equal a small spec that repeats pick → put. Comparing failures shows the deadlock, and comparing failures-divergences shows the invisible moves as divergence.`,
    ),
    intro: [
      t(
        "抽象化（関心のある動きだけを残し、ほかを隠して見ること）を扱う。CSP では隠蔽という操作で、指定したイベントを外から見えない動き τ に変える。",
        "This lesson is about abstraction (keeping only the moves you care about and hiding the rest). In CSP, the hiding operator turns chosen events into invisible moves τ that the outside cannot see.",
      ),
      t(
        "全体が大きいと、テストでも目で追っても正しさを考えにくい。哲学者の全体から1人の左手だけを残せば、小さな仕様と比べるだけで済む。ただし、隠したことで何が言えて何が言えなくなるかは、これまでに見た比べ方（トレース・失敗・失敗発散）ごとに違う。",
        "When the whole system is large, it is hard to reason about correctness, whether by testing or by tracing it by eye. Keep only one philosopher's left hand and you just compare against a small spec. But what you can and cannot conclude after hiding differs for each comparison seen so far (traces, failures, failures-divergences).",
      ),
      t(
        "図では「哲学者の全体」から「隠蔽」を通り、「検査器」で「仕様 Focus」と比べる流れを追う。同じ組を比べ方だけ変えて調べ直すので、どの比べ方に替えたときに結論が変わるかが分かれ目になる。",
        'In the diagram, follow the flow from "All philosophers" through "Hiding" to the "Checker", which compares with "Spec Focus". The same pair is checked again with only the comparison changed, so the key point is which comparison changes the conclusion.',
      ),
    ],
    facts: [
      {
        label: t("全体の状態", "States (whole)"),
        value: t(
          `${WHOLE.stateCount}個（仕様 Focus は${SPEC_LTS.stateCount}個）`,
          `${WHOLE.stateCount} (spec Focus: ${SPEC_LTS.stateCount})`,
        ),
      },
      {
        label: t("トレース", "Traces"),
        value: tracesEqual
          ? t("仕様と等しい（どちらの取り方でも）", "equal to the spec (either order)")
          : t("仕様と等しくない", "not equal to the spec"),
        tone: "ok",
      },
      {
        label: t("全員が左から", "All take left first"),
        value: t(
          `失敗詳細化が${holdsText(FAILURES_LEFT_FIRST.holds, t)}`,
          `failures refinement ${holdsText(FAILURES_LEFT_FIRST.holds, t)}`,
        ),
        tone: "bad",
      },
      {
        label: t("1人だけ逆順", "One reversed"),
        value: t(
          `失敗詳細化は${holdsText(FAILURES_ONE_REVERSED.holds, t)}、失敗発散は${holdsText(FD_ONE_REVERSED.holds, t)}`,
          `failures ${holdsText(FAILURES_ONE_REVERSED.holds, t)}, failures-divergences ${holdsText(FD_ONE_REVERSED.holds, t)}`,
        ),
        tone: "wait",
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 7.3節（抽象化による検証例）`,
          `${CSP_BOOK_EN}, section 7.3 (verification by abstraction)`,
        ),
      },
    ],
    actors: [
      {
        id: "table",
        label: t("哲学者の全体", "All philosophers"),
        sublabel: t(
          `${PEOPLE}人と${PEOPLE}本のフォーク`,
          `${PEOPLE} people, ${PEOPLE} forks`,
        ),
        icon: "people",
        x: 14,
        y: 50,
        initial: {
          rows: {
            [t("状態", "states")]: t(`${WHOLE.stateCount}個`, `${WHOLE.stateCount}`),
            [t("イベント", "events")]: t(
              `${ALL_EVENT_COUNT}種類`,
              `${ALL_EVENT_COUNT} kinds`,
            ),
          },
        },
      },
      {
        id: "hide",
        label: t("隠蔽", "Hiding"),
        sublabel: t("哲学者0の左手だけ残す", "keeps only P0's left hand"),
        icon: "visited",
        x: 38,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "spec",
        label: t("仕様 Focus", "Spec Focus"),
        sublabel: t("取る→置くの繰り返し", "pick → put, repeated"),
        icon: "spec",
        x: 62,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("3つの比べ方", "three comparisons"),
        icon: "checker",
        x: 86,
        y: 50,
        initial: { isHidden: true },
      },
    ],
    stageHeight: 300,
    links: [
      { from: "table", to: "hide" },
      { from: "hide", to: "spec" },
      { from: "checker", to: "spec" },
    ],
    steps: [
      {
        id: "whole",
        kind: "spec",
        title: t("全体は大きい", "The whole is large"),
        actor: "table",
        summary: t(
          `全員が左から取る${PEOPLE}人の哲学者は${WHOLE.stateCount}状態・${WHOLE.transitionCount}遷移`,
          `${PEOPLE} philosophers who all take left first: ${WHOLE.stateCount} states, ${WHOLE.transitionCount} transitions`,
        ),
        explain: t(
          `「食事する哲学者」のモデルをそのまま使う。${PEOPLE}人と${PEOPLE}本のフォークで、イベントは${ALL_EVENT_COUNT}種類、状態は${WHOLE.stateCount}個ある。人数が増えると、全部を見て「正しいか」を考えるのは難しくなる。`,
          `Reuse the model from "Dining philosophers" as is. With ${PEOPLE} people and ${PEOPLE} forks there are ${ALL_EVENT_COUNT} kinds of events and ${WHOLE.stateCount} states. As the number of people grows, judging correctness by looking at everything gets hard.`,
        ),
        set: { table: { tone: "wait" } },
        simplified: t(
          "式はこのサイトのモデル（cspModels.ts・cspCases.ts）に合わせた短い書き方で、実物の CSPM（FDR の記法）とは書き方が違う。",
          "The expressions use a short notation matching this site's models (cspModels.ts, cspCases.ts), which differs from real CSPM (the FDR notation).",
        ),
      },
      {
        id: "hide",
        kind: "spec",
        title: t("1人の左手だけ見る", "Watch one left hand only"),
        actor: "hide",
        to: ["table"],
        summary: t(
          `${FOCUS_EVENTS.join(" と ")}以外の${HIDDEN_COUNT}種類を隠す`,
          `Hide the ${HIDDEN_COUNT} kinds other than ${FOCUS_EVENTS.join(" and ")}`,
        ),
        explain: t(
          `注目するのは哲学者0が左のフォークを取る${FOCUS_EVENTS[0]}と、置く${FOCUS_EVENTS[1]}だけ。残りの${HIDDEN_COUNT}種類のイベントを隠す（隠蔽 \\）と、外の同意なしに起きる見えない動き τ に変わる。${FOCUSED.stateCount === WHOLE.stateCount ? `状態の数（${FOCUSED.stateCount}個）は変わらないが` : `状態は${FOCUSED.stateCount}個（隠す前は${WHOLE.stateCount}個）で`}、外から見えるイベントは${FOCUS_EVENTS.length}種類だけになる。`,
          `We watch only ${FOCUS_EVENTS[0]}, philosopher 0 picking up the left fork, and ${FOCUS_EVENTS[1]}, putting it down. Hiding (\\) the other ${HIDDEN_COUNT} kinds of events turns them into invisible moves τ that happen without the outside agreeing. ${FOCUSED.stateCount === WHOLE.stateCount ? `The number of states (${FOCUSED.stateCount}) stays the same, but` : `There are ${FOCUSED.stateCount} states (${WHOLE.stateCount} before hiding), and`} only ${FOCUS_EVENTS.length} kinds of events are visible from outside.`,
        ),
        set: {
          hide: { isHidden: false, tone: "wait" },
          table: {
            rows: { [t("見える", "visible")]: FOCUS_EVENTS.join(t("・", ", ")) },
          },
        },
      },
      {
        id: "spec",
        kind: "spec",
        title: t("小さな仕様を書く", "Write a small spec"),
        actor: "spec",
        summary: t(
          `Focus = ${FOCUS_EVENTS[0]} → ${FOCUS_EVENTS[1]} → Focus（${SPEC_LTS.stateCount}状態）`,
          `Focus = ${FOCUS_EVENTS[0]} → ${FOCUS_EVENTS[1]} → Focus (${SPEC_LTS.stateCount} states)`,
        ),
        explain: t(
          `哲学者0の左手から見て正しい動きは「取って、置いて、また取る」の繰り返しだけ。これを${SPEC_LTS.stateCount}状態の小さな仕様 Focus として書く。大きな全体をこの小さな仕様と比べれば、1人から見た振る舞いを確かめられる。`,
          `From philosopher 0's left hand, the only correct behaviour is "pick up, put down, pick up again", repeated. Write this as a small spec Focus with ${SPEC_LTS.stateCount} states. Comparing the large whole with this small spec checks the behaviour as one person sees it.`,
        ),
        set: {
          spec: {
            isHidden: false,
            tone: "idle",
            rows: {
              [t("状態", "states")]: t(
                `${SPEC_LTS.stateCount}個`,
                `${SPEC_LTS.stateCount}`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("このサイトのモデル", "This site's model"),
            fields: [
              {
                label: "Focus",
                value: `${FOCUS_EVENTS[0]} → ${FOCUS_EVENTS[1]} → Focus`,
                isCode: true,
              },
              {
                label: t("比べる相手", "Compared with"),
                value: t(
                  `Phils \\ (pick と put のうち${FOCUS_EVENTS.join(", ")}以外)`,
                  `Phils \\ (pick and put except ${FOCUS_EVENTS.join(", ")})`,
                ),
                isCode: true,
              },
            ],
          },
        ],
      },
      {
        id: "traces",
        kind: "explore",
        title: t("トレースは等しい", "Traces are equal"),
        actor: "checker",
        to: ["spec", "hide"],
        summary: t(
          `トレースで比べると、全員が左からでも1人だけ逆順でも仕様と${tracesEqual ? "等しい" : "等しくない"}`,
          `By traces, both "all left first" and "one reversed" are ${tracesEqual ? "equal" : "not equal"} to the spec`,
        ),
        explain: t(
          `トレース（起こせるイベントの並び）を両向きに比べると、どちらの取り方でも仕様と${tracesEqual ? "等しい" : "等しくない"}。隠した後に見える並びは、取る・置くが交互に出るものだけだから。ただしトレースは「起こせること」しか見ないので、途中で止まるかどうかは分からない。`,
          `Comparing traces (sequences of events that can happen) in both directions, either pick order is ${tracesEqual ? "equal" : "not equal"} to the spec, because after hiding the only visible sequences alternate pick and put. But traces only show what can happen, so they cannot tell whether it gets stuck partway.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "ok",
            rows: {
              [t("トレース", "traces")]: LAW_LEFT_FIRST.traces
                ? t("等しい", "equal")
                : t("等しくない", "not equal"),
            },
          },
          spec: { tone: "ok" },
        },
        simplified: t(
          "同じ組を ProB で確かめ、結果が一致した（specs/csp）。ここでの「等しい」は詳細化を両向きに調べた結果。",
          'The same pairs were checked with ProB and the results agreed (specs/csp). "Equal" here means refinement holds in both directions.',
        ),
      },
      {
        id: "stuck",
        kind: "found",
        title: t("取ったまま置けない", "Holding it, can't put it down"),
        actor: "checker",
        to: ["table"],
        summary: t(
          `全員が左から: ${traceText(STUCK.trace, t)}の後に {${STUCK.refusal.join(", ")}}を拒否できる`,
          `All left first: can refuse {${STUCK.refusal.join(", ")}} after ${traceText(STUCK.trace, t)}`,
        ),
        explain: t(
          `失敗（その時点で拒否できるイベント）まで比べると、全員が左から取る版は反例が出る。${traceText(STUCK.trace, t)}の後、仕様なら必ず${STUCK.refusal.join(", ")}を受け付けるのに、全体はそれを拒否できる。全体のデッドロック（全員が1本ずつ持って止まる）が、注目している1人から見ると「左を取ったまま置けない」形で見えた。`,
          `Comparing failures too (events that can be refused at that point), the "all left first" version gives a counterexample. After ${traceText(STUCK.trace, t)}, the spec always accepts ${STUCK.refusal.join(", ")}, but the whole can refuse it. The deadlock of the whole (everyone holding one fork and stuck) shows up, from the one person we watch, as "holding the left fork and unable to put it down".`,
        ),
        set: {
          table: { tone: "bad" },
          checker: {
            tone: "bad",
            rows: {
              [t("失敗", "failures")]: t(
                `${traceText(STUCK.trace, t)}の後に${STUCK.refusal.join(", ")}を拒否`,
                stuckText,
              ),
            },
          },
        },
        detail: [
          {
            title: t("検査器が返した反例", "Counterexample from the checker"),
            fields: [
              {
                label: t("トレース", "Trace"),
                value: traceText(STUCK.trace, t),
                isCode: true,
              },
              {
                label: t("拒否できる", "Can refuse"),
                value: `{${STUCK.refusal.join(", ")}}`,
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "失敗詳細化は、実装が安定した（τ で勝手に動けない）状態で拒否できるイベントを比べる。発散はこの比べ方の外なので、ここでは見ていない（FDR の [F= と同じ）。",
          "Failures refinement compares the events the implementation can refuse in stable states (where it cannot move on its own by τ). Divergence is outside this comparison, so it is not checked here (same as FDR's [F=).",
        ),
      },
      {
        id: "reverse",
        kind: "fix",
        title: t("1人だけ逆順にする", "Reverse just one"),
        actor: "checker",
        to: ["table"],
        summary: t(
          `最後の哲学者だけ右から取ると、失敗詳細化は${holdsText(FAILURES_ONE_REVERSED.holds, t)}`,
          `If only the last philosopher takes right first, failures refinement ${holdsText(FAILURES_ONE_REVERSED.holds, t)}`,
        ),
        explain: t(
          `デッドロックのレッスンと同じく、最後の哲学者だけフォークを取る順を逆にする。全員が1本ずつ持って止まる形が無くなり、哲学者0が左を取ったまま全体が止まる時点も無くなるので、失敗詳細化は${holdsText(FAILURES_ONE_REVERSED.holds, t)}。`,
          `As in the deadlock lesson, reverse the fork order for the last philosopher only. The pattern where everyone holds one fork and stops disappears, and so does any point where everything stops while philosopher 0 holds the left fork, so failures refinement ${holdsText(FAILURES_ONE_REVERSED.holds, t)}.`,
        ),
        set: {
          table: { tone: "ok" },
          checker: {
            tone: "ok",
            rows: {
              [t("失敗", "failures")]: holdsText(FAILURES_ONE_REVERSED.holds, t),
            },
          },
        },
      },
      {
        id: "diverge",
        kind: "found",
        title: t("隠した動きが発散に", "Hidden moves become divergence"),
        actor: "checker",
        to: ["hide"],
        summary: t(
          `失敗発散で比べると、${startText(DIVERGE.trace, t)}発散できるという反例が出る`,
          `By failures-divergences, the counterexample is that it can diverge ${startText(DIVERGE.trace, t)}`,
        ),
        explain: t(
          `失敗発散詳細化は、見えない動き τ だけで回り続けられるか（発散）も比べる。ほかの人の動きを全部隠したので、ほかの人が取って食べて置くのを繰り返す間、外からは何も起きない。仕様 Focus は発散しないので、${startText(DIVERGE.trace, t)}発散できることが反例になる。`,
          `Failures-divergences refinement also compares whether the process can keep looping on invisible moves τ alone (divergence). Everyone else's moves are hidden, so while the others keep picking up, eating and putting down, nothing happens outside. The spec Focus never diverges, so being able to diverge ${startText(DIVERGE.trace, t)} is a counterexample.`,
        ),
        set: {
          hide: { tone: "bad" },
          checker: {
            tone: "bad",
            rows: {
              [t("失敗発散", "FD")]: t(
                `発散（${startText(DIVERGE.trace, t)}）`,
                `diverges (${startText(DIVERGE.trace, t)})`,
              ),
            },
          },
        },
        simplified: t(
          "ここでの発散は「ほかの人が食べ続け、哲学者0がずっと待たされる」実行も含む。公平性（いつか全員に順番が来るという仮定）は置いていない。",
          'Divergence here includes runs where "the others keep eating and philosopher 0 waits forever". No fairness (the assumption that everyone eventually gets a turn) is assumed.',
        ),
      },
      {
        id: "choose",
        kind: "spec",
        title: t("比べ方を選ぶ", "Choose the comparison"),
        actor: "checker",
        to: ["spec"],
        summary: t(
          "隠すと小さく見られるが、何を言えるかは比べ方で変わる",
          "Hiding makes it small, but what you can claim depends on the comparison",
        ),
        explain: t(
          "トレースは「起こせる並び」、失敗は「止まらないこと」、失敗発散は「見えない動きで回り続けないこと」まで言える。隠して小さく見るときは、どの比べ方で何を言えるかを、確かめたいことに合わせて選ぶ必要がある。書籍の7.3節では、Eager 抽象化と Lazy 抽象化という扱い分けとして説明されている。",
          'Traces tell you "which sequences can happen", failures add "it does not get stuck", and failures-divergences add "it does not loop forever on invisible moves". When you hide to see less, pick the comparison that matches what you want to check. Section 7.3 of the book explains this as the distinction between eager and lazy abstraction.',
        ),
        set: { spec: { tone: "ok" }, checker: { tone: "idle" } },
        simplified: t(
          "Eager／Lazy 抽象化の定義はここでは扱わない。このサイトの検査器は、隠したイベントを τ にする隠蔽だけを実装している。",
          "Eager and lazy abstraction are not defined here. This site's checker implements only hiding, which turns hidden events into τ.",
        ),
      },
    ],
    lab: {
      title: t("取る順と比べ方", "Pick order and comparison"),
      hint: t(
        "「1人だけ逆順」を「あり」にすると、最後の哲学者だけ右から取る。3つの比べ方で、仕様 Focus を満たすかを出す。",
        'Set "One reversed" to "yes" and the last philosopher takes the right fork first. Shows whether spec Focus is met under the three comparisons.',
      ),
      inputs: [
        {
          id: "reversed",
          label: t("1人だけ逆順（あり / なし）", "One reversed (yes / no)"),
          initial: t("なし", "no"),
        },
      ],
      compute: (values): Field[] => {
        const isAsymmetric = parseReversed(values.reversed);
        const focus = focusOnPhilosopher0(isAsymmetric);
        const lts = explore(focus, FOCUS_ENV);
        const traces = traceRefines(FOCUS_SPEC, focus, FOCUS_ENV);
        const failures = failuresRefines(FOCUS_SPEC, focus, FOCUS_ENV);
        const fd = failuresDivergencesRefines(FOCUS_SPEC, focus, FOCUS_ENV);
        return [
          {
            label: t("1人だけ逆順", "One reversed"),
            value: isAsymmetric ? t("あり", "yes") : t("なし", "no"),
          },
          {
            label: t("隠した後の状態", "States after hiding"),
            value: t(`${lts.stateCount}個`, `${lts.stateCount}`),
          },
          {
            label: t("トレース詳細化", "Trace refinement"),
            value: traces.holds
              ? holdsText(true, t)
              : t(
                  `破れる（${traceText(traces.counterexample ?? [], t)}）`,
                  `fails (${traceText(traces.counterexample ?? [], t)})`,
                ),
            tone: traces.holds ? "ok" : "bad",
          },
          {
            label: t("失敗詳細化", "Failures refinement"),
            value: failures.counterexample
              ? t(
                  `破れる（${refusalText(failures.counterexample.trace, failures.counterexample.refusal, t)}）`,
                  `fails (${refusalText(failures.counterexample.trace, failures.counterexample.refusal, t)})`,
                )
              : holdsText(true, t),
            tone: failures.holds ? "ok" : "bad",
          },
          {
            label: t("失敗発散詳細化", "Failures-divergences refinement"),
            value: fd.holds
              ? holdsText(true, t)
              : t(
                  `破れる（${fdText(fd.counterexample, t)}）`,
                  `fails (${fdText(fd.counterexample, t)})`,
                ),
            tone: fd.holds ? "ok" : "bad",
          },
        ];
      },
    },
  };
}
