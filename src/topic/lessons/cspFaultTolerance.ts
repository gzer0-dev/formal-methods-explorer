import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import {
  acceptsTrace,
  type Failure,
  failuresRefines,
  type RefinementResult,
} from "../csp";
import {
  CRASH_ONE_RUN,
  FAULT_ENV,
  faultView,
  mirroredStore,
  registerSpec,
  toleratedFaults,
} from "../cspFaultTolerance";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

type Translate = (ja: string, en: string) => string;

const DISKS = 2;
const SPEC = registerSpec();
// どの比較も数ミリ秒で終わるので、最上位で1回ずつ計算する。
const NO_FAULTS = failuresRefines(SPEC, faultView(DISKS, 0), FAULT_ENV);
const UNLIMITED = failuresRefines(SPEC, faultView(DISKS, null), FAULT_ENV);
const ONE_FAULT = failuresRefines(SPEC, faultView(DISKS, 1), FAULT_ENV);
const TWO_FAULTS = failuresRefines(SPEC, faultView(DISKS, 2), FAULT_ENV);
const SINGLE_DISK_ONE_FAULT = failuresRefines(SPEC, faultView(1, 1), FAULT_ENV);
const TOLERATED = [1, 2, 3].map((disks) => ({ disks, faults: toleratedFaults(disks) }));
const CRASH_RUN_OK = acceptsTrace(
  mirroredStore(DISKS),
  FAULT_ENV,
  CRASH_ONE_RUN,
).isAccepted;
const [WRITE_EVENT, CRASH_EVENT, READ_EVENT] = CRASH_ONE_RUN as [
  string,
  string,
  string,
];
const WRITTEN = WRITE_EVENT.split(".")[1]!;

function holdsText(holds: boolean, t: Translate): string {
  return holds ? t("満たす", "holds") : t("満たさない", "fails");
}

function failureText(result: RefinementResult<Failure>, t: Translate): string {
  const failure = result.counterexample;
  if (!failure) return t("反例なし", "no counterexample");
  const refusal = `{${failure.refusal.join(", ")}}`;
  if (failure.trace.length === 0) {
    return t(`最初の時点で ${refusal}を断る`, `refuses ${refusal} at the start`);
  }
  return t(
    `${failure.trace.join(" → ")}の後に ${refusal}を断る`,
    `refuses ${refusal} after ${failure.trace.join(" → ")}`,
  );
}

function parseDisks(text: string | undefined): number {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return DISKS;
  return Math.min(Math.max(value, 1), 3);
}

/** 数ならその回数まで（0〜4）。数でない入力（「無制限」など）は回数を限らない。 */
function parseLimit(text: string | undefined): number | null {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return null;
  return Math.min(Math.max(value, 0), 4);
}

export function cspFaultToleranceLesson(language: Language): Lesson {
  const t = translator(language);
  const holds = (value: boolean) => holdsText(value, t);
  const store = t("記憶", "store");
  return {
    id: "csp-fault-tolerance",
    category: "apply",
    title: t("故障を隠して耐故障を示す", "Hiding faults for fault tolerance"),
    subtitle: t(
      "ディスクが壊れても、外から見た記憶は仕様どおりか",
      "When a disk fails, does the store still meet its spec from outside?",
    ),
    summary: t(
      `同じ値を${DISKS}台のディスクに書く記憶で、故障のイベントを Lazy 抽象化で隠して仕様と比べる。故障を1回までに限ると仕様を${ONE_FAULT.holds ? "満たし" : "満たさず"}、2回では${failureText(TWO_FAULTS, t)}。許せる故障は台数より1つ少ない。`,
      `For a store that writes the same value to ${DISKS} disks, hide the fault events by lazy abstraction and compare with the spec. With at most one fault the spec ${holds(ONE_FAULT.holds)}; with two, it ${failureText(TWO_FAULTS, t)}. It tolerates one fault fewer than it has disks.`,
    ),
    intro: [
      t(
        "耐故障（フォールトトレランス）は、部品が壊れても全体が約束どおりに動き続けることを言う。CSP では、故障を crash のような専用のイベントにしてモデルに入れ、外から見るときにそのイベントを隠して、故障の無い仕様と比べる。故障の回数を限るときは、故障を数えるプロセスと並べてから隠す。",
        "Fault tolerance means the whole keeps its promises even when parts break. In CSP you put each fault into the model as an event of its own, such as crash, then hide those events when you look from outside and compare with a spec that has no faults. To limit the number of faults, put a process that counts them alongside before hiding.",
      ),
      t(
        "テストで故障を試すのは、決まった時点に1つ壊す程度になりやすい。ここでは、どのディスクが、書き込みや読み出しのどの途中で壊れても、の全部を調べる。隠し方は Lazy 抽象化で、「故障は起きてもよいが、起きると当てにしない」を表す。",
        'Fault-injection tests tend to break one part at one chosen point. Here we check every case: any disk breaking at any moment during a write or a read. The hiding uses lazy abstraction, which says "faults may happen, but we never count on them happening".',
      ),
      t(
        "図では、ディスクのカードが動いているか壊れたかと、「故障の上限」を変えたときの「検査器」の結果を追う。故障を起こさせない、限らない、1回まで、2回まで、の順に比べる。",
        "In the diagram, follow whether each disk card is working or broken, and the Checker's result as the Fault limit changes. We compare no faults, unlimited faults, at most one and at most two, in that order.",
      ),
    ],
    facts: [
      {
        label: t("故障なし", "No faults"),
        value: t(`仕様を${holds(NO_FAULTS.holds)}`, `spec ${holds(NO_FAULTS.holds)}`),
        tone: NO_FAULTS.holds ? "ok" : "bad",
      },
      {
        label: t("故障1回まで", "At most one fault"),
        value: t(`仕様を${holds(ONE_FAULT.holds)}`, `spec ${holds(ONE_FAULT.holds)}`),
        tone: ONE_FAULT.holds ? "ok" : "bad",
      },
      {
        label: t("故障2回まで", "At most two faults"),
        value: failureText(TWO_FAULTS, t),
        tone: TWO_FAULTS.holds ? "ok" : "bad",
      },
      {
        label: t("許せる故障の回数", "Faults tolerated"),
        value: TOLERATED.map(({ disks, faults }) =>
          t(
            `${disks}台で${faults}回`,
            `${faults} with ${disks} disk${disks === 1 ? "" : "s"}`,
          ),
        ).join(t("・", ", ")),
      },
      {
        label: t("参考", "Reference"),
        value: t(
          `${TPC_BOOK} 12.3節（故障の抽象化と耐故障）`,
          `${TPC_BOOK_EN}, §12.3 (abstracting errors: specifying fault tolerance)`,
        ),
      },
    ],
    actors: [
      {
        id: "controller",
        label: t("制御役", "Controller"),
        sublabel: t("全部のディスクに書く", "writes to every disk"),
        icon: "server",
        x: 20,
        y: 27,
      },
      {
        id: "disk1",
        label: t("ディスク1", "Disk 1"),
        sublabel: "put.1 / get.1",
        icon: "database",
        x: 50,
        y: 27,
        initial: { rows: { [t("状態", "state")]: t("動いている", "working") } },
      },
      {
        id: "disk2",
        label: t("ディスク2", "Disk 2"),
        sublabel: "put.2 / get.2",
        icon: "database",
        x: 80,
        y: 27,
        initial: { rows: { [t("状態", "state")]: t("動いている", "working") } },
      },
      {
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: t("値を1つ覚える", "remembers one value"),
        icon: "spec",
        x: 20,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "limit",
        label: t("故障の上限", "Fault limit"),
        sublabel: t("crash を数える", "counts crashes"),
        icon: "visited",
        x: 50,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("失敗詳細化を調べる", "checks failures refinement"),
        icon: "checker",
        x: 80,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "controller", to: "disk1" },
      { from: "disk1", to: "disk2" },
      { from: "spec", to: "limit" },
      { from: "limit", to: "checker" },
    ],
    steps: [
      {
        id: "spec",
        kind: "spec",
        title: t("値を1つ覚える記憶", "A store for one value"),
        actor: "spec",
        summary: t(
          "仕様: いつでも書け、いつでも最後に書いた値を読める",
          "Spec: you can always write, and always read the last value written",
        ),
        explain: t(
          `仕様は、write.x で値を書き、read.x で最後に書いた値を読める${store}である（はじめは0）。どの時点でも、書き込みも読み出しも断らない。故障のことは何も書いていない。`,
          "The spec is a store where write.x writes a value and read.x reads the last value written (0 at first). At no point does it refuse a write or a read. It says nothing about faults.",
        ),
        set: {
          spec: {
            isHidden: false,
            rows: { [t("イベント", "events")]: "write.x / read.x" },
          },
        },
      },
      {
        id: "mirror",
        kind: "spec",
        title: t(`${DISKS}台に同じ値を書く`, `Write the same value to ${DISKS}`),
        actor: "controller",
        to: ["disk1", "disk2"],
        summary: t(
          "制御役は全部のディスクに書き、読むときは壊れていない最初のディスクから取る",
          "The controller writes to every disk, and reads from the first disk that has not failed",
        ),
        explain: t(
          "ディスクは crash.i でいつ壊れてもよい。壊れたディスクは書き込みを受け取って捨て、読み出しには err.i を返す。制御役は err が返ったら次のディスクを試し、全部が壊れていたら止まる。制御役とディスクのやりとり（put・get・err）は外から見えないように隠してある。",
          "A disk may break at any time with crash.i. A broken disk silently drops writes and answers reads with err.i. On err, the controller tries the next disk; if all have failed, it stops. The traffic between controller and disks (put, get, err) is hidden from outside.",
        ),
        set: {
          controller: {
            tone: "wait",
            rows: { [t("書く先", "writes to")]: t("全部", "all") },
          },
        },
        simplified: t(
          "故障は「止まって err を返す」だけにした。でたらめな値を返す故障（ビザンチン故障）や、制御役そのものの故障は入れていない。",
          'The only fault is "stop and answer err". Faults that return arbitrary values (Byzantine faults) and faults of the controller itself are not modelled.',
        ),
      },
      {
        id: "crash-one",
        kind: "run",
        title: t("1台壊れても読める", "One disk fails, reads work"),
        actor: "disk1",
        to: ["controller"],
        summary: t(
          `${CRASH_ONE_RUN.join(" → ")} を${CRASH_RUN_OK ? "起こせる" : "起こせない"}`,
          `${CRASH_ONE_RUN.join(" → ")} ${CRASH_RUN_OK ? "can happen" : "cannot happen"}`,
        ),
        explain: t(
          `${WRITE_EVENT} で両方のディスクに${WRITTEN}を書いた後、${CRASH_EVENT} でディスク1が壊れる。制御役はディスク1から err を受け取ってディスク2を試し、${READ_EVENT} で書いた値を返す。`,
          `After ${WRITE_EVENT} puts ${WRITTEN} on both disks, disk 1 breaks on ${CRASH_EVENT}. The controller gets err from disk 1, tries disk 2 and returns the written value on ${READ_EVENT}.`,
        ),
        set: {
          disk1: { tone: "bad", rows: { [t("状態", "state")]: t("壊れた", "failed") } },
          disk2: {
            tone: "ok",
            rows: { [t("覚えている値", "value")]: WRITTEN },
          },
          controller: { tone: "ok", rows: { [t("読んだ値", "read")]: WRITTEN } },
        },
      },
      {
        id: "hide",
        kind: "spec",
        title: t("故障を Lazy で隠す", "Hide faults lazily"),
        actor: "checker",
        to: ["controller"],
        summary: t(
          "crash を、いつ止まってもよい環境と組ませてから隠し、仕様と比べる",
          "Pair crash with an environment that may stop at any time, hide it and compare with the spec",
        ),
        explain: t(
          "故障は外から見えないので隠す。ただの隠蔽にすると、隠した crash は必ず起きる動きとみなされ、「ディスクは必ず壊れる」と仮定したことになる。Lazy 抽象化なら、故障は起きても起きなくてもよく、どちらの場合も仕様を満たすかを調べられる。",
          "Faults are invisible from outside, so they are hidden. With plain hiding, a hidden crash is treated as a move that always happens, which assumes the disks always break. With lazy abstraction, a fault may or may not happen, and we check the spec holds either way.",
        ),
        set: {
          disk1: {
            tone: "idle",
            rows: { [t("状態", "state")]: t("動いている", "working") },
          },
          disk2: { tone: "idle", rows: { [t("覚えている値", "value")]: null } },
          controller: { tone: "idle", rows: { [t("読んだ値", "read")]: null } },
          checker: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("隠す", "hides")]: "crash.1, crash.2",
              [t("方法", "method")]: "Lazy",
            },
          },
        },
      },
      {
        id: "no-faults",
        kind: "fix",
        title: t("故障を起こさせない", "No faults allowed"),
        actor: "limit",
        to: ["checker"],
        summary: t(
          `上限0（故障を止める）では、仕様を${holds(NO_FAULTS.holds)}`,
          `With limit 0 (faults blocked), the spec ${holds(NO_FAULTS.holds)}`,
        ),
        explain: t(
          "故障を数えるプロセスの上限を0にすると、crash は1回も起きない。故障の無い部品だけの動きで、まず仕様を満たすことを確かめておく。これが崩れていたら、故障以前に設計が間違っている。",
          "With the counting process's limit at 0, no crash ever happens. First confirm that the parts alone, with no faults, meet the spec. If this fails, the design is wrong before any fault.",
        ),
        set: {
          limit: { isHidden: false, rows: { [t("上限", "limit")]: "0" } },
          checker: {
            tone: NO_FAULTS.holds ? "ok" : "bad",
            rows: { [t("結果", "result")]: holds(NO_FAULTS.holds) },
          },
        },
      },
      {
        id: "unlimited",
        kind: "found",
        title: t("回数を限らないと破れる", "Unlimited faults break it"),
        actor: "limit",
        to: ["checker"],
        summary: t(
          `故障の回数を限らないと仕様を${holds(UNLIMITED.holds)}（${failureText(UNLIMITED, t)}）`,
          `Without a limit the spec ${holds(UNLIMITED.holds)} (it ${failureText(UNLIMITED, t)})`,
        ),
        explain: t(
          "どの部品もいくらでも壊れてよいなら、ディスクが全部壊れる場合も含まれる。どんな耐故障の設計も、全部の部品が壊れれば動けないので、耐故障を示すには「何回までなら」を決めて調べる。",
          'If every part may break any number of times, the case where all disks break is included. No fault-tolerant design works once all its parts are broken, so to show fault tolerance you decide "up to how many" and check that.',
        ),
        set: {
          limit: { tone: "bad", rows: { [t("上限", "limit")]: t("なし", "none") } },
          checker: {
            tone: UNLIMITED.holds ? "ok" : "bad",
            rows: { [t("結果", "result")]: holds(UNLIMITED.holds) },
          },
        },
      },
      {
        id: "one-fault",
        kind: "fix",
        title: t("1回までなら満たす", "One fault is tolerated"),
        actor: "limit",
        to: ["checker"],
        summary: t(
          `上限1では、どのディスクがいつ壊れても仕様を${holds(ONE_FAULT.holds)}`,
          `With limit 1, the spec ${holds(ONE_FAULT.holds)} whichever disk fails, whenever`,
        ),
        explain: t(
          `故障を1回までに限ると、書き込みの途中でも読み出しの途中でも、どちらのディスクが壊れても、もう1台が最後に書いた値を持っている。ディスクが1台だけだと、上限1で仕様を${holds(SINGLE_DISK_ONE_FAULT.holds)}（${failureText(SINGLE_DISK_ONE_FAULT, t)}）。`,
          `With at most one fault, whichever disk breaks, even in the middle of a write or a read, the other still holds the last value written. With only one disk, limit 1 makes the spec ${holds(SINGLE_DISK_ONE_FAULT.holds)} (it ${failureText(SINGLE_DISK_ONE_FAULT, t)}).`,
        ),
        set: {
          limit: { tone: "ok", rows: { [t("上限", "limit")]: "1" } },
          disk1: {
            tone: "bad",
            rows: { [t("状態", "state")]: t("壊れうる", "may fail") },
          },
          checker: {
            tone: ONE_FAULT.holds ? "ok" : "bad",
            rows: { [t("結果", "result")]: holds(ONE_FAULT.holds) },
          },
        },
      },
      {
        id: "two-faults",
        kind: "found",
        title: t("2回で両方止まる", "Two faults stop both"),
        actor: "checker",
        to: ["spec"],
        summary: t(
          `上限2では、${failureText(TWO_FAULTS, t)}`,
          `With limit 2, it ${failureText(TWO_FAULTS, t)}`,
        ),
        explain: t(
          `2台とも壊れると、制御役は読む値を取れずに止まり、書き込みも読み出しも受け付けない。故障は隠してあるので、反例のトレースに crash は出ず、外から見ると何もしていないのに${store}が応えなくなる。`,
          "Once both disks have broken, the controller cannot fetch a value and stops, accepting neither writes nor reads. Faults are hidden, so no crash appears in the counterexample's trace: from outside, the store stops answering without anything having happened.",
        ),
        set: {
          limit: { tone: "bad", rows: { [t("上限", "limit")]: "2" } },
          disk1: { tone: "bad", rows: { [t("状態", "state")]: t("壊れた", "failed") } },
          disk2: { tone: "bad", rows: { [t("状態", "state")]: t("壊れた", "failed") } },
          checker: {
            tone: TWO_FAULTS.holds ? "ok" : "bad",
            rows: { [t("結果", "result")]: holds(TWO_FAULTS.holds) },
          },
        },
      },
      {
        id: "tolerated",
        kind: "test",
        title: t("何回まで許せるか", "How many faults are tolerated"),
        actor: "checker",
        to: ["limit"],
        summary: t(
          `上限を0から増やして初めて破れる1つ手前は、${TOLERATED.map(({ disks, faults }) => `${disks}台で${faults}回`).join("、")}`,
          `Raising the limit from 0 until it first fails gives ${TOLERATED.map(({ disks, faults }) => `${faults} for ${disks} disk${disks === 1 ? "" : "s"}`).join(", ")}`,
        ),
        explain: t(
          "上限を1つずつ上げて比べると、許せる故障の回数が数で分かる。故障を注入するテストを書くなら、この回数ちょうどの故障（ここでは1台）と、1つ多い故障（全部の台）の両方を入れると、境目を確かめられる。",
          "Raising the limit one at a time gives the number of faults tolerated. If you write fault-injection tests, inject exactly that many faults (here one disk) and one more (every disk) to check both sides of the boundary.",
        ),
        set: {
          checker: {
            tone: "ok",
            rows: {
              // 前のステップの行を消してから、台数ごとの回数を並べる（カードの行は4行まで）。
              [t("隠す", "hides")]: null,
              [t("方法", "method")]: null,
              [t("結果", "result")]: null,
              ...Object.fromEntries(
                TOLERATED.map(({ disks, faults }) => [
                  t(`${disks}台`, `${disks} disk${disks === 1 ? "" : "s"}`),
                  t(`${faults}回まで`, `up to ${faults}`),
                ]),
              ),
            },
          },
        },
        simplified: t(
          "故障は合わせて何回まで、という上限だけを入れた。本では、ほかの動きに対して何回まで（例: 書き込み1回につき1回まで）という限り方も扱う。故障の後に直る（ディスクを取り替える）動きも入れていない。",
          "Only a limit on the total number of faults is used. The book also covers limits relative to other activity (for example, at most one per write). Repairs after a fault (replacing a disk) are not modelled.",
        ),
      },
    ],
    lab: {
      title: t("台数と故障の上限を変える", "Change the disks and the fault limit"),
      hint: t(
        "ディスクの台数（1〜3）と故障の上限（0〜4、数でなければ限らない）を入れる。上限が台数より小さいときだけ仕様を満たす。",
        "Enter the number of disks (1-3) and the fault limit (0-4; anything that is not a number means no limit). The spec holds only when the limit is below the number of disks.",
      ),
      inputs: [
        { id: "disks", label: t("ディスクの台数", "Disks"), initial: String(DISKS) },
        { id: "limit", label: t("故障の上限", "Fault limit"), initial: "1" },
      ],
      compute: (values): Field[] => {
        const disks = parseDisks(values.disks);
        const limit = parseLimit(values.limit);
        const result = failuresRefines(SPEC, faultView(disks, limit), FAULT_ENV);
        const fields: Field[] = [
          {
            label: t("調べた設定", "Setting"),
            value: t(
              `${disks}台・上限${limit === null ? "なし" : `${limit}回`}`,
              `${disks} disk${disks === 1 ? "" : "s"}, limit ${limit === null ? "none" : String(limit)}`,
            ),
          },
          {
            label: t("仕様 ⊑F 外から見た記憶", "spec ⊑F store"),
            value: holds(result.holds),
            tone: result.holds ? "ok" : "bad",
          },
        ];
        if (result.counterexample) {
          fields.push({
            label: t("反例", "Counterexample"),
            value: failureText(result, t),
          });
        }
        return fields;
      },
    },
  };
}
