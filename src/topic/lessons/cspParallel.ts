import { translator, type Language } from "../../core/i18n";
import type { ActorPatch, Field, Lesson, Step } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import { explore, traceTo } from "../csp";
import { ADDERS, counterSystem, COUNTER_ENV } from "../cspModels";

const NAIVE_LTS = explore(counterSystem(false), COUNTER_ENV);
const LOCKED_LTS = explore(counterSystem(true), COUNTER_ENV);
const NAIVE_TRACE = traceTo(counterSystem(false), COUNTER_ENV, "result.1")!;
const LOCKED_LOST = traceTo(counterSystem(true), COUNTER_ENV, "result.1");
const LOCKED_GOOD = traceTo(counterSystem(true), COUNTER_ENV, "result.2")!;
// 全員が1ずつ足したときの正しい結果。
const EXPECTED = ADDERS.length;

const ACTOR_OF: Record<string, string> = { A: "a", B: "b" };

type Event =
  | { op: "read" | "write"; who: string; value: string }
  | { op: "finish" }
  | { op: "result"; value: string };

/** イベント名「read.A.0」などを読む。書式が変わったら、画面に変な値を出す前にここで止める。 */
function parseEvent(event: string): Event {
  const parts = event.split(".");
  const [op, first, second] = parts;
  if ((op === "read" || op === "write") && parts.length === 3 && ACTOR_OF[first!])
    return { op, who: first!, value: second! };
  if (op === "finish" && parts.length === 1) return { op };
  if (op === "result" && parts.length === 2) return { op, value: first! };
  throw new Error(`イベント名を読めない: ${event}`);
}

function stepWord(count: number): string {
  return count === 1 ? "step" : "steps";
}

/** 反例の手順の各イベントを、図のステップにする。手元の値はそれまでの読みから組み立てる。 */
function replaySteps(trace: string[], language: Language): Step[] {
  const t = translator(language);
  const inHand: Record<string, string | null> = { A: null, B: null };
  return trace.map((event, index): Step => {
    const parsed = parseEvent(event);
    const id = `ev-${index + 1}`;
    if (parsed.op === "read") {
      const other = ADDERS.find((who) => who !== parsed.who)!;
      const isSameAsOther = inHand[other] === parsed.value;
      inHand[parsed.who] = parsed.value;
      return {
        id,
        kind: "found",
        title: t(
          `${parsed.who}が${parsed.value}を読む`,
          `${parsed.who} reads ${parsed.value}`,
        ),
        actor: ACTOR_OF[parsed.who]!,
        to: ["var"],
        summary: t(
          `${event}: ${parsed.who}が変数の値${parsed.value}を読む`,
          `${event}: ${parsed.who} reads the variable's value ${parsed.value}`,
        ),
        explain: isSameAsOther
          ? t(
              `${other}がまだ書いていないので、${parsed.who}も同じ${parsed.value}を読める。${event} は Var(${parsed.value}) と足し手${parsed.who}の両方が起こせるイベントなので、2つがそろって1手進む。`,
              `${other} has not written yet, so ${parsed.who} can read the same ${parsed.value}. ${event} is an event both Var(${parsed.value}) and adder ${parsed.who} can perform, so the two take one step together.`,
            )
          : t(
              `${event} は「${parsed.who}が値${parsed.value}を読んだ」という意味。Var(${parsed.value}) と足し手${parsed.who}の両方がこのイベントを起こせるので、2つが手をつないで1手進む。`,
              `${event} means "${parsed.who} read the value ${parsed.value}". Both Var(${parsed.value}) and adder ${parsed.who} can perform this event, so the two join hands and take one step.`,
            ),
        set: {
          [ACTOR_OF[parsed.who]!]: {
            tone: "wait",
            rows: { [t("手元", "local")]: parsed.value },
          },
        },
      };
    }
    if (parsed.op === "write") {
      const read = inHand[parsed.who];
      inHand[parsed.who] = null;
      return {
        id,
        kind: "found",
        title: t(
          `${parsed.who}が${parsed.value}を書く`,
          `${parsed.who} writes ${parsed.value}`,
        ),
        actor: ACTOR_OF[parsed.who]!,
        to: ["var"],
        summary: t(
          `${event}: ${parsed.who}が手元の${read}に1を足した${parsed.value}を書く`,
          `${event}: ${parsed.who} writes ${parsed.value}, its local ${read} plus 1`,
        ),
        explain: t(
          `${parsed.who}は読んだ${read}に1を足し、${event} で${parsed.value}を書く。Var はどの値の書き込みも受け付け、Var(${parsed.value}) になる。${parsed.who}の手順はここで終わる。`,
          `${parsed.who} adds 1 to the ${read} it read and writes ${parsed.value} with ${event}. Var accepts a write of any value and becomes Var(${parsed.value}). ${parsed.who}'s steps end here.`,
        ),
        set: {
          [ACTOR_OF[parsed.who]!]: {
            tone: "ok",
            rows: {
              [t("手元", "local")]: null,
              [t("状態", "state")]: t("書いた", "written"),
            },
          },
          var: { rows: { [t("値", "value")]: parsed.value } },
        },
      };
    }
    if (parsed.op === "finish") {
      return {
        id,
        kind: "found",
        title: t("全員が終わる", "Everyone finishes"),
        actor: "var",
        to: ["a", "b"],
        summary: t(
          "finish: 足し手が全員終わったことを、変数と合わせる",
          "finish: the variable syncs on all adders being done",
        ),
        explain: t(
          "finish は「足し手が全員終わった」という合図。AとBの両方が終わってから起こせる決まりで、Var も同期するので、ここから先は値が変わらない。",
          "finish is the signal that all adders are done. It can only happen after both A and B have finished, and Var synchronises on it too, so the value no longer changes after this.",
        ),
        set: { var: { tone: "wait", rows: { [t("合図", "signal")]: "finish" } } },
      };
    }
    return {
      id,
      kind: "found",
      title: t(`結果は${parsed.value}`, `The result is ${parsed.value}`),
      actor: "var",
      to: ["checker"],
      summary: t(
        `${event}: 2回足したのに結果は${parsed.value}。更新が1回消えた`,
        `${event}: added twice, yet the result is ${parsed.value}. One update was lost`,
      ),
      explain: t(
        `Var は最後に result.${parsed.value}（結果の値）を出す。正しくは${EXPECTED}のはずが${parsed.value}になった。サイト1本目と同じ「更新が消える」並びを、CSP の検査器も見つけた。`,
        `At the end Var outputs result.${parsed.value} (the resulting value). It should be ${EXPECTED} but is ${parsed.value}. The CSP checker found the same lost-update ordering as the site's first lesson.`,
      ),
      set: {
        var: {
          tone: "bad",
          rows: {
            [t("合図", "signal")]: null,
            [t("結果", "result")]: parsed.value,
            [t("期待", "expected")]: String(EXPECTED),
          },
        },
        a: { tone: "bad" },
        b: { tone: "bad" },
        checker: {
          tone: "bad",
          rows: {
            [t("反例", "counterexample")]: t(
              `${trace.length}手`,
              `${trace.length} ${stepWord(trace.length)}`,
            ),
          },
        },
      },
      detail: [
        {
          title: t(
            `result.${parsed.value} までの最短の手順`,
            `Shortest steps to result.${parsed.value}`,
          ),
          fields: trace.map((ev, i) => ({
            label: t(`${i + 1}手目`, `Step ${i + 1}`),
            value: ev,
            isCode: true,
          })),
        },
      ],
    };
  });
}

// 英語の画面では on / off で入れる。
function parseLock(text: string | undefined): boolean {
  const value = text ?? "";
  return value.includes("あり") || /\b(yes|on)\b/i.test(value);
}

function lockedPatch(language: Language): Record<string, ActorPatch> {
  const t = translator(language);
  return {
    lock: {
      isHidden: false,
      tone: "ok",
      rows: { [t("持ち主", "holder")]: t("空き", "free") },
    },
    var: {
      tone: "ok",
      rows: {
        [t("値", "value")]: String(EXPECTED),
        [t("結果", "result")]: null,
        [t("期待", "expected")]: null,
      },
    },
    a: { tone: "ok", rows: { [t("状態", "state")]: null } },
    b: { tone: "ok", rows: { [t("状態", "state")]: null } },
    checker: {
      tone: "ok",
      rows: {
        [t("状態", "states")]: t(
          `${LOCKED_LTS.stateCount}個`,
          `${LOCKED_LTS.stateCount}`,
        ),
        [t("遷移", "transitions")]: t(
          `${LOCKED_LTS.transitionCount}本`,
          `${LOCKED_LTS.transitionCount}`,
        ),
        [t("反例", "counterexample")]: LOCKED_LOST
          ? t(
              `${LOCKED_LOST.length}手`,
              `${LOCKED_LOST.length} ${stepWord(LOCKED_LOST.length)}`,
            )
          : t("着かない", "unreachable"),
      },
    },
  };
}

export function cspParallelLesson(language: Language): Lesson {
  const t = translator(language);
  return {
    id: "csp-parallel",
    category: "csp",
    title: t("並行合成と同期", "Parallel composition"),
    subtitle: t(
      "共有変数もプロセスとして書く",
      "Write the shared variable as a process too",
    ),
    summary: t(
      `変数と2つの足し手を、読み書きのイベントで手をつなぐように並行合成する。全部たどると${NAIVE_LTS.stateCount}状態・${NAIVE_LTS.transitionCount}遷移で、${NAIVE_TRACE.length}手で result.1 に着く。ロックもプロセスとして足すと、result.1 には着かない。`,
      `Compose a variable and two adders in parallel so they join hands on read and write events. Walking everything gives ${NAIVE_LTS.stateCount} states and ${NAIVE_LTS.transitionCount} transitions, and result.1 is reached in ${NAIVE_TRACE.length} steps. Add a lock as another process and result.1 is never reached.`,
    ),
    intro: [
      t(
        "並行合成は、複数のプロセスを同時に動かし、決めておいたイベント（同期集合）だけは両方がそろったときに一緒に起こす組み合わせ方だ。CSP では共有の変数も、読み書きのイベントを受け付けるプロセスとして書く。",
        "Parallel composition runs several processes at once; the events in an agreed set (the synchronisation set) happen only when both sides are ready, and then together. In CSP even a shared variable is written as a process that accepts read and write events.",
      ),
      t(
        "「テストが見逃すバグ」で見た、更新が消えるカウンタを CSP で書き直す。テストでは読み書きの順が実行のたびに変わるので再現しにくいが、検査器はありうる順をすべてたどる。",
        'This lesson rewrites the lost-update counter from "The bug your tests miss" in CSP. In a test, the order of reads and writes changes from run to run, so the bug is hard to reproduce, but the checker walks every possible order.',
      ),
      t(
        "図では、足し手と変数のカードの間で、読み書きの矢印が1本ずつ進むのを追う。Aがまだ書いていないうちにBが同じ値を読む所が分かれ目になる。最後にロックのカードが加わり、その順で進めなくなる様子を見る。",
        "In the diagram, follow the read and write arrows between the adder cards and the variable card, one at a time. The turning point is where B reads the same value before A has written. Finally a lock card joins, and that ordering can no longer happen.",
      ),
    ],
    facts: [
      {
        label: t("状態（ロックなし）", "States (no lock)"),
        value: t(`${NAIVE_LTS.stateCount}個`, `${NAIVE_LTS.stateCount}`),
      },
      {
        label: t("遷移（ロックなし）", "Transitions (no lock)"),
        value: t(`${NAIVE_LTS.transitionCount}本`, `${NAIVE_LTS.transitionCount}`),
      },
      {
        label: t("result.1 まで", "Steps to result.1"),
        value: t(`${NAIVE_TRACE.length}手`, `${NAIVE_TRACE.length}`),
        tone: "bad",
      },
      {
        label: t("状態（ロックあり）", "States (with lock)"),
        value: t(`${LOCKED_LTS.stateCount}個`, `${LOCKED_LTS.stateCount}`),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 2.4節（並行合成とチャネル）`,
          `${CSP_BOOK_EN}, section 2.4 (parallel composition and channels)`,
        ),
      },
    ],
    actors: [
      {
        id: "a",
        label: t("足し手A", "Adder A"),
        sublabel: "Adder(A)",
        icon: "process",
        x: 14,
        y: 27,
      },
      {
        id: "b",
        label: t("足し手B", "Adder B"),
        sublabel: "Adder(B)",
        icon: "process",
        x: 14,
        y: 73,
      },
      {
        id: "var",
        label: t("変数", "Variable"),
        sublabel: "Var(x)",
        icon: "variable",
        x: 50,
        y: 50,
        initial: { rows: { [t("値", "value")]: "0" } },
      },
      {
        id: "lock",
        label: t("ロック", "Lock"),
        sublabel: "Lock",
        icon: "lock",
        x: 86,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("全部の並びをたどる", "walks every order"),
        icon: "checker",
        x: 86,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "a", to: "var" },
      { from: "b", to: "var" },
      { from: "lock", to: "a" },
      { from: "checker", to: "var" },
    ],
    steps: [
      {
        id: "compose",
        kind: "spec",
        title: t("変数と足し手をつなぐ", "Connect variable and adders"),
        actor: "var",
        to: ["a", "b"],
        summary: t(
          `変数 Var(x) と足し手A・Bを、read と write で同期させて並行合成する（${NAIVE_LTS.stateCount}状態）`,
          `Compose the variable Var(x) with adders A and B, synchronised on read and write (${NAIVE_LTS.stateCount} states)`,
        ),
        explain: t(
          `変数も「read.人.値（その人が値を読む）と write.人.値（その人が値を書く）を受け付けるプロセス」Var(x) として書く。足し手は「読んで1足して書く」プロセスで、Var と並行合成する。並行合成では、同期集合に入れたイベントは両方がそろったときだけ起きるので、Var(0) のときは値0の読み出し（read.A.0 か read.B.0）しか起きない。`,
          `The variable is also written as a process, Var(x), that accepts read.who.value (that person reads a value) and write.who.value (that person writes a value). An adder is a process that reads, adds 1 and writes, and it is composed in parallel with Var. In parallel composition, events in the synchronisation set happen only when both sides are ready, so while it is Var(0) only reads of the value 0 (read.A.0 or read.B.0) can happen.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("状態", "states")]: t(
                `${NAIVE_LTS.stateCount}個`,
                `${NAIVE_LTS.stateCount}`,
              ),
              [t("遷移", "transitions")]: t(
                `${NAIVE_LTS.transitionCount}本`,
                `${NAIVE_LTS.transitionCount}`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("このサイトの書き方", "Notation on this site"),
            fields: [
              {
                label: "Var(x)",
                value: t(
                  "(read.人.x → Var(x)) □ (write.人.y → Var(y)) □ (finish → result.x → SKIP)",
                  "(read.who.x → Var(x)) □ (write.who.y → Var(y)) □ (finish → result.x → SKIP)",
                ),
                isCode: true,
              },
              {
                label: t("Adder(人)", "Adder(who)"),
                value: t(
                  "read.人.x → write.人.(x+1) → SKIP",
                  "read.who.x → write.who.(x+1) → SKIP",
                ),
                isCode: true,
              },
              {
                label: t("全体", "System"),
                value:
                  "Var(0) [| read, write, finish |] ((Adder(A) ||| Adder(B)) ; finish → SKIP)",
                isCode: true,
              },
              {
                label: "[| X |]",
                value: t(
                  "X のイベントは両方がそろって起きる（並行合成）",
                  "events in X happen only with both sides (parallel composition)",
                ),
              },
              {
                label: "|||",
                value: t(
                  "同期せずに好きな順で入り混じる（インターリーブ）",
                  "no synchronisation, mixed in any order (interleaving)",
                ),
              },
            ],
          },
        ],
        simplified: t(
          "実物の CSPM（FDR の記法）では、イベントを channel で宣言し、並行合成を [| … |] と書くなど、書き方が違う。このサイトは記号で短く見せている。値は0〜2に丸め、finish と result.値 は結果を外から見るためにこのサイトで足したイベント。",
          "Real CSPM (the notation used by FDR) is written differently: events are declared with channel, parallel composition is written [| … |], and so on. This site shows the symbols for brevity. Values are limited to 0-2, and finish and result.value are events this site adds so the result can be seen from outside.",
        ),
      },
      ...replaySteps(NAIVE_TRACE, language),
      {
        id: "add-lock",
        kind: "fix",
        title: t("ロックもプロセスで足す", "Add a lock as a process"),
        actor: "lock",
        to: ["a"],
        summary: t(
          `Lock を並行合成に足すと${LOCKED_LTS.stateCount}状態・${LOCKED_LTS.transitionCount}遷移、result.1 には${LOCKED_LOST ? "着く" : "着かない"}`,
          `Adding Lock to the composition gives ${LOCKED_LTS.stateCount} states and ${LOCKED_LTS.transitionCount} transitions; result.1 is ${LOCKED_LOST ? "still reached" : "never reached"}`,
        ),
        explain: t(
          `ロックも「lock.人（取る）の後は unlock.人（手放す）まで、ほかの人の lock を受け付けない」プロセスとして書き、足し手と lock・unlock で同期させる。足し手の手順は「取る→読む→書く→手放す」に変わるだけで、変数の定義は直さない。全部たどると result.1 には${LOCKED_LOST ? "着く" : "着かず"}、result.${EXPECTED} だけに着く。`,
          `The lock is also written as a process: after lock.who (take it) it refuses anyone else's lock until unlock.who (release it). It synchronises with the adders on lock and unlock. The adder's steps simply become take, read, write, release; the variable's definition is unchanged. Walking everything, result.1 is ${LOCKED_LOST ? "still reached" : "never reached"}, and only result.${EXPECTED} is.`,
        ),
        set: lockedPatch(language),
        detail: [
          {
            title: t(
              `ロックありで result.${EXPECTED} に着く最短の手順`,
              `Shortest steps to result.${EXPECTED} with the lock`,
            ),
            fields: LOCKED_GOOD.map((ev, i) => ({
              label: t(`${i + 1}手目`, `Step ${i + 1}`),
              value: ev,
              isCode: true,
            })),
          },
        ],
        simplified: t(
          "このモデルは2つの足し手が1回ずつ足すだけの小さな例で、FDR のような実物の検査器は、ずっと大きな状態空間を同じ考え方でたどる。状態数と遷移数には、足し手が終わったときの見えない動き（τ）も入っている。手順の「6手」は見えるイベントだけを数えたもの。図ではロックとAの間だけに線を引いているが、Bとも同じように同期している。",
          'This model is a tiny example where two adders each add once; real checkers such as FDR walk far larger state spaces the same way. The state and transition counts include the invisible moves (τ) when an adder finishes. The "6 steps" count only visible events. The diagram draws a line only between the lock and A, but it synchronises with B in the same way.',
        ),
      },
    ],
    lab: {
      title: t("ロックのあり・なしを比べる", "Compare with and without the lock"),
      hint: t(
        "「あり」にするとロックのプロセスが加わる。状態は増えるが、result.1 に着く手順は消える。",
        'Set it to "yes" to add the lock process. There are more states, but no path reaches result.1.',
      ),
      inputs: [
        {
          id: "lock",
          label: t("ロック（あり / なし）", "Lock (yes / no)"),
          initial: t("なし", "no"),
        },
      ],
      compute: (values): Field[] => {
        const withLock = parseLock(values.lock);
        const system = counterSystem(withLock);
        const lts = explore(system, COUNTER_ENV);
        const lost = traceTo(system, COUNTER_ENV, "result.1");
        return [
          {
            label: t("ロック", "Lock"),
            value: withLock ? t("あり", "yes") : t("なし", "no"),
          },
          {
            label: t("状態", "States"),
            value: t(`${lts.stateCount}個`, `${lts.stateCount}`),
          },
          {
            label: t("遷移", "Transitions"),
            value: t(`${lts.transitionCount}本`, `${lts.transitionCount}`),
          },
          {
            label: t("result.1 までの手順", "Path to result.1"),
            value: lost ? lost.join(" → ") : t("着かない", "unreachable"),
            tone: lost ? "bad" : "ok",
            isCode: lost !== null,
          },
        ];
      },
    },
  };
}
