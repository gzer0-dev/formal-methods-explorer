import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import { divergence, explore, type Failure, failuresRefines, type Proc } from "../csp";
import { FOCUS_ENV, FOCUS_EVENTS, FOCUS_SPEC, focusOnPhilosopher0 } from "../cspCases";
import { focusLazy } from "../cspMore";

type Translate = (ja: string, en: string) => string;

// どの比較も数ミリ秒で終わるので、最上位で1回ずつ呼ぶ（1人だけ逆順の版だけ）。
const EAGER = focusOnPhilosopher0(true);
const LAZY = focusLazy(true);
const EAGER_LTS = explore(EAGER, FOCUS_ENV);
const LAZY_LTS = explore(LAZY, FOCUS_ENV);
const EAGER_DIVERGENCE = divergence(EAGER, FOCUS_ENV);
const EAGER_FAILURES = failuresRefines(FOCUS_SPEC, EAGER, FOCUS_ENV);
const LAZY_FAILURES = failuresRefines(FOCUS_SPEC, LAZY, FOCUS_ENV);
if (!LAZY_FAILURES.counterexample) {
  throw new Error("Lazy 抽象化で、失敗詳細化の反例が見つからない");
}
const LAZY_STUCK = LAZY_FAILURES.counterexample;

function traceText(trace: string[], t: Translate): string {
  return trace.length > 0
    ? trace.join(" → ")
    : t("なし（最初から）", "none (from the start)");
}

function failureText(failure: Failure, t: Translate): string {
  const refusal = `{${failure.refusal.join(", ")}}`;
  return t(
    `${traceText(failure.trace, t)}の後に ${refusal}を拒否`,
    failure.trace.length > 0
      ? `can refuse ${refusal} after ${traceText(failure.trace, t)}`
      : `can refuse ${refusal} from the start`,
  );
}

function holdsText(holds: boolean, t: Translate): string {
  return holds ? t("成り立つ", "holds") : t("破れる", "fails");
}

function parseLazy(text: string | undefined): boolean {
  // 「Eager」と書いたときだけ Eager にする。それ以外（空や読めない入力）は既定の Lazy に戻す。
  return !(text ?? "").toLowerCase().includes("eager");
}

function parseReversed(text: string | undefined): boolean {
  // 「なし」（英語は no）と書いたときだけ全員が左から取る。それ以外（空や読めない入力）は既定の「あり」に戻す。
  const trimmed = (text ?? "").trim().toLowerCase();
  return !(trimmed.includes("なし") || trimmed === "no");
}

function abstractionOf(isLazy: boolean, isAsymmetric: boolean): Proc {
  return isLazy ? focusLazy(isAsymmetric) : focusOnPhilosopher0(isAsymmetric);
}

export function cspLazyLesson(language: Language): Lesson {
  const t = translator(language);
  const holds = (value: boolean) => holdsText(value, t);
  const stuck = failureText(LAZY_STUCK, t);
  return {
    id: "csp-lazy",
    category: "apply",
    title: t("Eager と Lazy", "Eager and lazy abstraction"),
    subtitle: t(
      "隠した動きが「続いてくれる」と当てにするか",
      "Do you count on hidden activity to keep going?",
    ),
    summary: t(
      `1人だけ逆順の哲学者で、ただ隠す Eager 抽象化では失敗詳細化が${holdsText(EAGER_FAILURES.holds, t)}が、ほかの人が止まりうるとみなす Lazy 抽象化では「${stuck}」が反例になる。`,
      `With one philosopher reversed, failures refinement ${holds(EAGER_FAILURES.holds)} under eager abstraction (just hide), but under lazy abstraction (the others may stop) "${stuck}" is a counterexample.`,
    ),
    intro: [
      t(
        "前のレッスン「隠して小さく見る」の続きで、抽象化の2つの考え方を比べる。Eager 抽象化は隠すイベントをそのまま見えなくし、Lazy 抽象化は隠すイベントを、いつでも止まりうる環境と組み合わせてから見えなくする。",
        'Continuing from the previous lesson "Hide to see less", we compare two ways to abstract. Eager abstraction simply makes the hidden events invisible. Lazy abstraction first combines the hidden events with an environment that may stop at any time, then makes them invisible.',
      ),
      t(
        "どちらを使うかで、隠した部分（ほかの人の動き）について何を前提にしているかが変わる。前提を取り違えると、検査は通っても、実際の環境では成り立たない結論を信じることになる。",
        "The choice changes what you assume about the hidden part (what the others do). Get the assumption wrong and the check passes, yet you end up trusting a conclusion that does not hold in the real environment.",
      ),
      t(
        "図では「哲学者の全体」から「Eager 抽象化」と「Lazy 抽象化」の2つの道に分かれ、それぞれ「検査器」で仕様 Focus と比べる。同じ全体を同じ仕様と比べているのに、2つの道で結果が分かれるか、分かれるならなぜかに注目する。",
        "In the diagram, All philosophers splits into two paths, Eager abstraction and Lazy abstraction, and the Checker compares each with the spec Focus. The same system is compared with the same spec, so watch whether the two paths disagree, and if so, why.",
      ),
    ],
    facts: [
      {
        label: t("Eager（ただ隠す）", "Eager (just hide)"),
        value: t(
          `失敗詳細化が${holdsText(EAGER_FAILURES.holds, t)}（${EAGER_LTS.stateCount}状態）`,
          `failures refinement ${holds(EAGER_FAILURES.holds)} (${EAGER_LTS.stateCount} states)`,
        ),
        tone: EAGER_FAILURES.holds ? "ok" : "bad",
      },
      {
        label: t("Lazy（止まりうる）", "Lazy (may stop)"),
        value: t(
          `失敗詳細化が${holdsText(LAZY_FAILURES.holds, t)}（${LAZY_LTS.stateCount}状態）`,
          `failures refinement ${holds(LAZY_FAILURES.holds)} (${LAZY_LTS.stateCount} states)`,
        ),
        tone: LAZY_FAILURES.holds ? "ok" : "bad",
      },
      { label: t("Lazy の反例", "Lazy counterexample"), value: stuck, tone: "bad" },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 7.3.2節（Eager抽象化とLazy抽象化）`,
          `${CSP_BOOK_EN}, section 7.3.2 (eager and lazy abstraction)`,
        ),
      },
    ],
    actors: [
      {
        id: "table",
        label: t("哲学者の全体", "All philosophers"),
        sublabel: t("最後の1人だけ逆順", "last one reversed"),
        icon: "people",
        x: 14,
        y: 50,
      },
      {
        id: "eager",
        label: t("Eager 抽象化", "Eager abstraction"),
        sublabel: t("ただ隠す", "just hides"),
        icon: "visited",
        x: 38,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "lazy",
        label: t("Lazy 抽象化", "Lazy abstraction"),
        sublabel: t("止まりうるとみなす", "others may stop"),
        icon: "gear",
        x: 62,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("仕様 Focus と比べる", "compares with spec Focus"),
        icon: "checker",
        x: 86,
        y: 50,
        initial: { isHidden: true },
      },
    ],
    stageHeight: 300,
    links: [
      { from: "table", to: "eager" },
      { from: "eager", to: "lazy" },
      { from: "lazy", to: "checker" },
    ],
    steps: [
      {
        id: "recap",
        kind: "spec",
        title: t("ただ隠して比べる", "Just hide and compare"),
        actor: "eager",
        to: ["table"],
        summary: t(
          `${FOCUS_EVENTS.join(" と ")}以外を隠すと、失敗詳細化は${holdsText(EAGER_FAILURES.holds, t)}`,
          `Hiding everything but ${FOCUS_EVENTS.join(" and ")}, failures refinement ${holds(EAGER_FAILURES.holds)}`,
        ),
        explain: t(
          `「隠して小さく見る」の続き。最後の1人だけ逆順に取る哲学者から、哲学者0が左のフォークを取る${FOCUS_EVENTS[0]}と置く${FOCUS_EVENTS[1]}だけを残して、ほかを隠す。これを Eager 抽象化と呼び、仕様 Focus（取る→置くの繰り返し）との失敗詳細化は${holdsText(EAGER_FAILURES.holds, t)}。`,
          `Continuing "Hide to see less": from the philosophers where only the last one picks up in reverse order, keep only ${FOCUS_EVENTS[0]} (philosopher 0 picks up the left fork) and ${FOCUS_EVENTS[1]} (puts it down), and hide the rest. This is eager abstraction, and failures refinement against the spec Focus (pick up → put down, repeated) ${holds(EAGER_FAILURES.holds)}.`,
        ),
        set: {
          eager: {
            isHidden: false,
            tone: EAGER_FAILURES.holds ? "ok" : "bad",
            rows: {
              [t("状態", "states")]: t(
                `${EAGER_LTS.stateCount}個`,
                `${EAGER_LTS.stateCount}`,
              ),
              [t("失敗", "failures")]: holds(EAGER_FAILURES.holds),
            },
          },
        },
        simplified: t(
          "式はこのサイトのモデル（cspCases.ts・cspMore.ts）の書き方で、実物の CSPM（FDR の記法）とは書き方が違う。",
          "The expressions use this site's model notation (cspCases.ts, cspMore.ts), which differs from real CSPM (the FDR notation).",
        ),
      },
      {
        id: "rely",
        kind: "explore",
        title: t("続いてくれる前提", "Assuming the rest keeps going"),
        actor: "eager",
        summary: t(
          `隠した動きは${EAGER_DIVERGENCE ? "発散に見え" : "発散に見えず"}、「必ず起き続けられる」扱いになる`,
          `Hidden activity ${EAGER_DIVERGENCE ? "looks like divergence" : "does not look like divergence"} and is treated as "always able to keep happening"`,
        ),
        explain: t(
          "ほかの人が取って食べて置く動きは、隠すと見えない動き τ になる。τ で動ける状態は安定していないので、失敗詳細化はそこで拒否を数えない。つまり Eager 抽象化は「ほかの人は止まらず動き続ける」と当てにしていて、その前提で「哲学者0は止まらない」と言っている。",
          'Once hidden, the others picking up, eating and putting down become invisible moves τ. A state that can move by τ is not stable, so failures refinement does not count refusals there. In other words, eager abstraction counts on "the others never stop", and only under that assumption says "philosopher 0 never gets stuck".',
        ),
        set: {
          eager: {
            tone: "wait",
            rows: {
              [t("発散", "divergence")]: EAGER_DIVERGENCE
                ? t("あり（見えない動きの輪）", "yes (loop of invisible moves)")
                : t("なし", "none"),
            },
          },
        },
        simplified: t(
          "失敗詳細化（FDR の [F= と同じ）は、τ で動ける状態の拒否を数えず、発散も見ない。発散は divergence で別に調べている。",
          "Failures refinement (same as [F= in FDR) does not count refusals in states that can move by τ, and ignores divergence. Divergence is checked separately by the divergence function (csp.ts).",
        ),
      },
      {
        id: "lazy",
        kind: "spec",
        title: t("止まりうる環境", "An environment that may stop"),
        actor: "lazy",
        to: ["table"],
        summary: t(
          `隠すイベントを、いつでも止まれる環境と同期させてから隠す（${LAZY_LTS.stateCount}状態）`,
          `Synchronise the hidden events with an environment that can stop at any time, then hide (${LAZY_LTS.stateCount} states)`,
        ),
        explain: t(
          `Lazy 抽象化では、隠すイベントを「いつでも起こせるが、いつでも止まって全部を断ることもできる」環境（CHAOS）と同期させてから隠す。ほかの人の動きは、環境しだいで止まりうるものとして扱われる。状態は${LAZY_LTS.stateCount}個（Eager は${EAGER_LTS.stateCount}個）に増える。`,
          `Lazy abstraction first synchronises the hidden events with an environment (CHAOS) that can do them at any time, but can also stop at any time and refuse them all, and then hides them. The others' activity is treated as something that may stop, depending on the environment. The states grow to ${LAZY_LTS.stateCount} (eager has ${EAGER_LTS.stateCount}).`,
        ),
        set: {
          lazy: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("状態", "states")]: t(
                `${LAZY_LTS.stateCount}個`,
                `${LAZY_LTS.stateCount}`,
              ),
            },
          },
        },
      },
      {
        id: "stuck",
        kind: "found",
        title: t("取ったまま置けない", "Picked up, can't put down"),
        actor: "checker",
        to: ["lazy"],
        summary: t(`Lazy: ${stuck}できる`, `Lazy: ${stuck}`),
        explain: t(
          `Lazy 抽象化を仕様 Focus と失敗詳細化で比べると、「${stuck}できる」という反例が出た。ほかの人が右のフォークを持ったまま止まると、哲学者0は2本そろわず食べられないので、左のフォークを置けなくなる。Eager では見えなかった止まり方が、拒否として見えた。`,
          `Comparing lazy abstraction with the spec Focus by failures refinement gives the counterexample "${stuck}". If another philosopher stops while holding the right fork, philosopher 0 never gets both forks, cannot eat, and so cannot put the left fork down. A way of getting stuck that eager abstraction hid now shows up as a refusal.`,
        ),
        set: {
          lazy: {
            tone: "bad",
            rows: { [t("失敗", "failures")]: holds(LAZY_FAILURES.holds) },
          },
          checker: {
            isHidden: false,
            tone: "bad",
            rows: { [t("反例", "counterexample")]: stuck },
          },
        },
        detail: [
          {
            title: t("検査器が返した反例", "Counterexample the checker returned"),
            fields: [
              {
                label: t("トレース", "Trace"),
                value: traceText(LAZY_STUCK.trace, t),
                isCode: true,
              },
              {
                label: t("拒否できる", "Can refuse"),
                value: `{${LAZY_STUCK.refusal.join(", ")}}`,
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "同じ組を ProB で確かめ、Lazy 抽象化で失敗詳細化が破れることが一致した（specs/csp、CSPM の CHAOS を使用）。",
          "We checked the same pair in ProB, and it agreed that failures refinement fails under lazy abstraction (specs/csp, using CHAOS in CSPM).",
        ),
      },
      {
        id: "choose",
        kind: "spec",
        title: t("どちらの前提か選ぶ", "Choose your assumption"),
        actor: "checker",
        to: ["eager", "lazy"],
        summary: t(
          "Eager は「ほかは止まらない」、Lazy は「ほかは止まるかもしれない」",
          'Eager: "the others never stop". Lazy: "the others might stop"',
        ),
        explain: t(
          "Eager は「ほかの人は止まらない」、Lazy は「ほかの人は止まるかもしれない」を前提にした見方で、どちらが正しいというものではない。何を前提に何を言いたいかを先に決め、それに合う抽象化を選ぶ。書籍の7.3.2節の Eager／Lazy 抽象化の考え方に沿っている。",
          'Eager assumes "the others never stop" and lazy assumes "the others might stop". Neither is the right one. Decide first what you assume and what you want to claim, then pick the abstraction that fits. This follows the idea of eager and lazy abstraction in section 7.3.2 of the book.',
        ),
        set: {
          checker: { tone: "idle" },
          eager: { tone: "ok" },
          lazy: { tone: "wait" },
        },
      },
      {
        id: "testing",
        kind: "test",
        title: t("テストでの前提", "The same assumption in tests"),
        actor: "checker",
        to: ["table"],
        summary: t(
          "依存先が必ず応答するモックか、止まりうるモックかの違いに近い",
          "Close to a mock that always answers versus one that may stop",
        ),
        explain: t(
          "テストで依存先のサービスを必ずすぐ応答するモックにすると、Eager と同じく「相手は止まらない」前提で確かめていることになる。相手が止まったときの振る舞いを確かめたいなら、Lazy のように止まりうる相手を置いて調べる。",
          'If a test replaces a dependency with a mock that always answers at once, it checks under the same assumption as eager abstraction: "the other side never stops". To check what happens when the other side stops, use a counterpart that may stop, as lazy abstraction does.',
        ),
        set: { table: { tone: "ok" } },
      },
    ],
    lab: {
      title: t("抽象化と取る順", "Abstraction and pick-up order"),
      hint: t(
        "抽象化に「Eager」か「Lazy」、1人だけ逆順に「あり」か「なし」を書くと、仕様 Focus との失敗詳細化の結果と反例を出す。",
        'Enter "Eager" or "Lazy" for the abstraction and "yes" or "no" for one reversed. It shows the result of failures refinement against the spec Focus, with the counterexample.',
      ),
      inputs: [
        {
          id: "abstraction",
          label: t("抽象化（Eager / Lazy）", "Abstraction (Eager / Lazy)"),
          initial: "Lazy",
        },
        {
          id: "reversed",
          label: t("1人だけ逆順（あり / なし）", "One reversed (yes / no)"),
          initial: t("あり", "yes"),
        },
      ],
      compute: (values): Field[] => {
        const isLazy = parseLazy(values.abstraction);
        const isAsymmetric = parseReversed(values.reversed);
        const proc = abstractionOf(isLazy, isAsymmetric);
        const lts = explore(proc, FOCUS_ENV);
        const failures = failuresRefines(FOCUS_SPEC, proc, FOCUS_ENV);
        return [
          { label: t("抽象化", "Abstraction"), value: isLazy ? "Lazy" : "Eager" },
          {
            label: t("1人だけ逆順", "One reversed"),
            value: isAsymmetric ? t("あり", "yes") : t("なし", "no"),
          },
          {
            label: t("状態", "States"),
            value: t(`${lts.stateCount}個`, `${lts.stateCount}`),
          },
          {
            label: t("失敗詳細化", "Failures refinement"),
            value: failures.counterexample
              ? t(
                  `破れる（${failureText(failures.counterexample, t)}）`,
                  `fails (${failureText(failures.counterexample, t)})`,
                )
              : t("成り立つ", "holds"),
            tone: failures.holds ? "ok" : "bad",
          },
        ];
      },
    },
  };
}
