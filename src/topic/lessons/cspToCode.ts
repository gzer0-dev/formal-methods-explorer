import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import { acceptsTrace, traceTo, type TraceCheck } from "../csp";
import { COUNTER_ENV, counterSystem } from "../cspModels";

type Translate = (ja: string, en: string) => string;

const ORACLE = counterSystem(true);

function requiredTrace(withLock: boolean, ev: string): string[] {
  const trace = traceTo(counterSystem(withLock), COUNTER_ENV, ev);
  if (!trace) throw new Error(`カウンタのモデルで ${ev} に着く手順が無い`);
  return trace;
}

// 正しい実装のログ: ロックありのモデルで result.2 に着く最短の手順
const GOOD_LOG = requiredTrace(true, "result.2");
// ロックを取らずに読む実装のログ: ロック無しのモデルで result.1 に着く最短の手順
const BAD_LOG = requiredTrace(false, "result.1");
const GOOD = acceptsTrace(ORACLE, COUNTER_ENV, GOOD_LOG);
const BAD = acceptsTrace(ORACLE, COUNTER_ENV, BAD_LOG);
// 止まったイベント。受け付けたとき（undefined）は画面で「なし」と出す。
const BAD_EVENT_NAME = BAD_LOG[BAD.acceptedCount];

function verdictText(check: TraceCheck, t: Translate): string {
  return check.isAccepted ? t("受け付けた", "accepted") : t("受け付けない", "rejected");
}

/** 止まったイベント（先頭から acceptedCount 個の次）。受け付けたときは「なし」。 */
function stoppedAt(log: string[], check: TraceCheck, t: Translate): string {
  if (check.isAccepted) return t("なし", "none");
  return t(
    `${log[check.acceptedCount]}（${check.acceptedCount + 1}個目）`,
    `${log[check.acceptedCount]} (event ${check.acceptedCount + 1})`,
  );
}

function logRows(log: string[], t: Translate) {
  return {
    [t("件数", "events")]: t(`${log.length}個`, `${log.length}`),
    [t("先頭", "first")]: log[0] ?? t("なし", "none"),
    [t("最後", "last")]: log.at(-1) ?? t("なし", "none"),
  };
}

function parseLog(text: string | undefined): string[] {
  const events = (text ?? "")
    .split(/[,、]/)
    .map((ev) => ev.trim())
    .filter((ev) => ev !== "");
  // 空の入力は既定の正しいログに戻す
  return events.length > 0 ? events : GOOD_LOG;
}

export function cspToCodeLesson(language: Language): Lesson {
  const t = translator(language);
  const verdict = (check: TraceCheck) => verdictText(check, t);
  const stopped = (log: string[], check: TraceCheck) => stoppedAt(log, check, t);
  const badEvent = BAD_EVENT_NAME ?? t("なし", "none");
  return {
    id: "csp-to-code",
    category: "csp",
    title: t("モデルを実装とテストへ", "From model to code and tests"),
    subtitle: t(
      "プロセスはスレッドに、モデルはテストの判定役に",
      "Processes become threads; the model becomes the test oracle",
    ),
    summary: t(
      `CSP のプロセスとチャネルは、スレッドや goroutine とチャネルにほぼそのまま移せる。確かめたモデルは、実装のログ（イベントの並び）を判定するテストの判定役（オラクル）にもなる。`,
      "CSP processes and channels map almost directly onto threads or goroutines and channels. The verified model also becomes the test oracle that judges the implementation's log (its sequence of events).",
    ),
    intro: [
      t(
        "ここまで CSP でモデルを書き、検査器で確かめてきた。このレッスンでは、そのモデルを実際のコードとテストにつなげる。CSP のプロセスは実装のスレッドや goroutine に、同期するイベントはチャネルでの受け渡しに対応する。",
        "So far we have written models in CSP and checked them with the checker. This lesson connects such a model to real code and tests. A CSP process corresponds to a thread or goroutine, and a synchronised event to a hand-off over a channel.",
      ),
      t(
        "並行のコードは実行ごとに順番が変わるので、結果の値だけを見るテストでは、たまたま正しく出た実行を見逃す。確かめたモデルを判定役（オラクル、テストの合否を決める基準）にすれば、ログに残ったイベントの並びがモデルで起こりうるかを機械的に判定できる。",
        "Concurrent code runs in a different order each time, so a test that looks only at the result misses runs that happened to come out right. If the verified model is the oracle (the standard that decides pass or fail), a machine can judge whether the sequence of events in the log could happen in the model.",
      ),
      t(
        "図では「実装」から「実行ログ」、そして「判定役」へ進む流れを追う。正しいログとロックを取らないログを順に判定にかけ、ロックを取らないログがどのイベントで受け付けられなくなるかに注目する。",
        "In the diagram, follow the flow from Implementation to Execution log and on to Oracle. A correct log and a log that skips the lock are judged in turn; watch at which event the lock-skipping log stops being accepted.",
      ),
    ],
    facts: [
      {
        label: t("正しいログ", "Correct log"),
        value: t(
          `${GOOD_LOG.length}個を${verdict(GOOD)}`,
          `${GOOD_LOG.length} events ${verdict(GOOD)}`,
        ),
        tone: "ok",
      },
      {
        label: t("ロックを取らないログ", "Log without the lock"),
        value: t(
          `受け付けたのは${BAD.acceptedCount}個、${stopped(BAD_LOG, BAD)}で止まる`,
          `${BAD.acceptedCount} accepted, stops at ${stopped(BAD_LOG, BAD)}`,
        ),
        tone: "bad",
      },
      {
        label: t("判定に使う計算", "Judged with"),
        value: t(
          "acceptsTrace（モデルがその並びを起こせるか）",
          "acceptsTrace (can the model produce that sequence?)",
        ),
      },
      {
        label: t("実物の対応先", "Real counterparts"),
        value: t(
          "Go のチャネル、Java の JCSP ライブラリなど",
          "Go channels, the JCSP library for Java, and so on",
        ),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 第4章（JCSP入門）・第8章（JCSP実装）`,
          `${CSP_BOOK_EN}, chapter 4 (introduction to JCSP) and chapter 8 (implementing with JCSP)`,
        ),
      },
    ],
    actors: [
      {
        id: "impl",
        label: t("実装", "Implementation"),
        sublabel: t("スレッドとチャネル", "threads and channels"),
        icon: "process",
        x: 14,
        y: 50,
        initial: {
          rows: { [t("状態", "status")]: t("まだ動かしていない", "not run yet") },
        },
      },
      {
        id: "log",
        label: t("実行ログ", "Execution log"),
        sublabel: t("イベントの並び", "sequence of events"),
        icon: "document",
        x: 38,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "model",
        label: t("モデル", "Model"),
        sublabel: t("ロックありのカウンタ", "counter with a lock"),
        icon: "spec",
        x: 62,
        y: 50,
        initial: { rows: { [t("状態", "status")]: t("確かめ済み", "verified") } },
      },
      {
        id: "oracle",
        label: t("判定役", "Oracle"),
        sublabel: t("テストのオラクル", "the test oracle"),
        icon: "test",
        x: 86,
        y: 50,
        initial: { isHidden: true },
      },
    ],
    stageHeight: 300,
    links: [
      { from: "model", to: "impl" },
      { from: "impl", to: "log" },
      { from: "log", to: "oracle" },
      { from: "model", to: "oracle" },
    ],
    steps: [
      {
        id: "map",
        kind: "spec",
        title: t("プロセスをスレッドへ", "Processes become threads"),
        actor: "model",
        to: ["impl"],
        summary: t(
          "プロセスはスレッドや goroutine、同期するイベントはチャネルでの受け渡しに移す",
          "Processes become threads or goroutines; synchronised events become channel hand-offs",
        ),
        explain: t(
          "CSP のプロセスは、実装では1本のスレッドや goroutine にほぼそのまま対応する。2つのプロセスが同期して起こすイベントは、チャネルで値を受け渡す1回の操作になる。設計で確かめた形を崩さずにコードへ移せるのが、CSP で書く利点。",
          "A CSP process corresponds almost directly to one thread or goroutine in the implementation. An event that two processes perform together becomes one operation that passes a value over a channel. The benefit of writing in CSP is that the shape you verified in the design carries over to code intact.",
        ),
        set: {
          impl: {
            tone: "wait",
            rows: {
              [t("状態", "status")]: t("モデルから作成", "built from the model"),
            },
          },
        },
        detail: [
          {
            title: t(
              "CSP と実装の対応（一般的な概念）",
              "CSP and implementation (general concepts)",
            ),
            fields: [
              {
                label: t("プロセス", "Process"),
                value: t(
                  "スレッド、goroutine、JCSP のプロセス",
                  "thread, goroutine, JCSP process",
                ),
              },
              {
                label: t("同期するイベント", "Synchronised event"),
                value: t("チャネルでの1回の送受信", "one send/receive on a channel"),
              },
              {
                label: t("並行合成", "Parallel composition"),
                value: t(
                  "複数のスレッドを起動し、同じチャネルを渡す",
                  "start several threads and give them the same channel",
                ),
              },
              {
                label: t("外部選択 □", "External choice □"),
                value: t(
                  "複数のチャネルのうち、来たものを受ける（Go の select など）",
                  "receive from whichever channel is ready (Go's select, etc.)",
                ),
              },
              {
                label: t("隠蔽 \\", "Hiding \\"),
                value: t(
                  "外に公開しない内部のチャネル",
                  "internal channels not exposed",
                ),
              },
              {
                label: t("SKIP（正しく終わる）", "SKIP (ends correctly)"),
                value: t("スレッドが返って終わる", "the thread returns and ends"),
              },
            ],
          },
        ],
        simplified: t(
          "対応は概念だけを並べた。実物のライブラリの API 名は書いていない。Go のチャネルにバッファを付けると送り手が待たなくなり、CSP の「両方がそろって起きる」同期とは違うふるまいになる。",
          'Only the concepts are listed; no real library API names. A buffered Go channel lets the sender go on without waiting, which behaves differently from CSP\'s "both sides together" synchronisation.',
        ),
      },
      {
        id: "channel",
        kind: "spec",
        title: t("ロックもプロセスで", "The lock is a process too"),
        actor: "model",
        to: ["impl"],
        summary: t(
          "lock.A・read.A.0 などのイベントが、実装の操作の名前になる",
          "Events such as lock.A and read.A.0 name the operations in the code",
        ),
        explain: t(
          "このサイトのカウンタでは、変数もロックもプロセスとして書いた。lock.A は「Aがロックを取る」、read.A.0 は「Aが値0を読む」、write.A.1 は「Aが1を書く」、unlock.A は「Aがロックを手放す」、finish と result.2 は「全員が終わり、最後の値は2」という意味。実装でもこれらの操作の所でログを出せば、モデルと同じ言葉で実行を記録できる。",
          'In this site\'s counter, both the variable and the lock are written as processes. lock.A means "A takes the lock", read.A.0 "A reads the value 0", write.A.1 "A writes 1", unlock.A "A releases the lock", and finish with result.2 "everyone is done and the final value is 2". If the implementation logs at these operations, its runs are recorded in the same words as the model.',
        ),
        set: {
          model: {
            tone: "ok",
            rows: {
              [t("イベント", "events")]: t("lock・read など", "lock, read, ..."),
            },
          },
        },
        simplified: t(
          "実装の操作とモデルのイベント名を1対1に対応づける作業は人が書く。ここではログが最初からモデルのイベント名で出ている前提にしている。",
          "Mapping implementation operations one-to-one to model event names is done by hand. Here we assume the log already uses the model's event names.",
        ),
      },
      {
        id: "good-log",
        kind: "run",
        title: t("実装を動かして記録", "Run the code and log it"),
        actor: "impl",
        to: ["log"],
        summary: t(
          `正しい実装のログは${GOOD_LOG.length}個のイベント（${GOOD_LOG[0]} から ${GOOD_LOG.at(-1)} まで）`,
          `The correct implementation logs ${GOOD_LOG.length} events (from ${GOOD_LOG[0]} to ${GOOD_LOG.at(-1)})`,
        ),
        explain: t(
          `ロックを取ってから読み書きする実装を動かし、起きたイベントを順に記録する。例は、モデルで result.2 に着く最短の手順と同じ並び（${GOOD_LOG.length}個）。`,
          `Run the implementation that takes the lock before reading and writing, and record the events in order. The example is the same sequence as the shortest path to result.2 in the model (${GOOD_LOG.length} events).`,
        ),
        set: {
          impl: {
            tone: "ok",
            rows: { [t("状態", "status")]: t("ロックを取る実装", "takes the lock") },
          },
          log: { isHidden: false, tone: "wait", rows: logRows(GOOD_LOG, t) },
        },
        detail: [
          {
            title: t("正しいログ", "Correct log"),
            fields: GOOD_LOG.map((ev, index) => ({ label: `${index + 1}`, value: ev })),
          },
        ],
      },
      {
        id: "judge-good",
        kind: "test",
        title: t("モデルが判定する", "The model judges"),
        actor: "oracle",
        to: ["log", "model"],
        summary: t(
          `acceptsTrace の結果: ${verdict(GOOD)}（${GOOD.acceptedCount}個すべて）`,
          `acceptsTrace result: ${verdict(GOOD)} (all ${GOOD.acceptedCount})`,
        ),
        explain: t(
          `判定役はログを先頭から1つずつ読み、モデルがその順でイベントを起こせるかを確かめる。${GOOD_LOG.length}個すべてをモデルが起こせたので${verdict(GOOD)}。テストごとに期待値を手で書かなくても、モデルが「起こりうる並びか」を答えてくれる。`,
          `The oracle reads the log one event at a time from the start and checks whether the model can produce the events in that order. The model could produce all ${GOOD_LOG.length}, so the log is ${verdict(GOOD)}. Without writing expected values by hand for each test, the model answers "could this sequence happen?".`,
        ),
        set: {
          oracle: {
            isHidden: false,
            tone: "ok",
            rows: {
              [t("判定", "verdict")]: verdict(GOOD),
              [t("受け付けた数", "accepted")]: t(
                `${GOOD.acceptedCount}個`,
                `${GOOD.acceptedCount}`,
              ),
            },
          },
          log: { tone: "ok" },
        },
        simplified: t(
          "acceptsTrace はモデルのトレースの先頭部分かどうかを見る。途中で切れたログも受け付け、最後まで正しく終わったか（✓）は見ない。見えない動き τ は何回挟まってもよいとして判定している。",
          "acceptsTrace checks whether the log is a prefix of a trace of the model. It accepts a log cut off midway and does not check that the run ended correctly (✓). Any number of invisible moves τ may come in between.",
        ),
      },
      {
        id: "bad-log",
        kind: "run",
        title: t("ロックを取らない実装", "Code that skips the lock"),
        actor: "impl",
        to: ["log"],
        summary: t(
          `ロックを忘れた実装のログは${BAD_LOG.length}個のイベント（${BAD_LOG[0]} から ${BAD_LOG.at(-1)} まで）`,
          `The implementation that forgets the lock logs ${BAD_LOG.length} events (from ${BAD_LOG[0]} to ${BAD_LOG.at(-1)})`,
        ),
        explain: t(
          `ロックを取らずに読み書きする実装を動かすと、${BAD_LOG[0]} から始まるログが出る。例は、ロック無しのモデルで result.1（更新が消えた）に着く最短の手順と同じ並び。`,
          `Running the implementation that reads and writes without the lock gives a log starting with ${BAD_LOG[0]}. The example is the same sequence as the shortest path to result.1 (an update was lost) in the model without the lock.`,
        ),
        set: {
          impl: {
            tone: "bad",
            rows: {
              [t("状態", "status")]: t("ロックを取らない実装", "skips the lock"),
            },
          },
          log: { tone: "wait", rows: logRows(BAD_LOG, t) },
          oracle: {
            tone: "idle",
            rows: {
              [t("判定", "verdict")]: t("まだ", "not yet"),
              [t("受け付けた数", "accepted")]: null,
            },
          },
        },
        detail: [
          {
            title: t("ロックを取らないログ", "Log without the lock"),
            fields: BAD_LOG.map((ev, index) => ({ label: `${index + 1}`, value: ev })),
          },
        ],
      },
      {
        id: "judge-bad",
        kind: "found",
        title: t(`${badEvent}で止まる`, `Stops at ${badEvent}`),
        actor: "oracle",
        to: ["log", "model"],
        summary: t(
          `${verdict(BAD)}。受け付けたのは${BAD.acceptedCount}個で、${stopped(BAD_LOG, BAD)}で止まる`,
          `${verdict(BAD)}: ${BAD.acceptedCount} accepted, stops at ${stopped(BAD_LOG, BAD)}`,
        ),
        explain: t(
          `モデルでは、Aは読む前に必ず lock.A でロックを取る。最初の ${badEvent} はモデルが起こせないので、受け付けたのは先頭の${BAD.acceptedCount}個で、テストは失敗になる。結果が偶然2になった実行でも、ロックを取らない並びなら同じ所で見つかる。`,
          `In the model, A always takes the lock with lock.A before reading. The model cannot produce the first ${badEvent}, so only the first ${BAD.acceptedCount} are accepted and the test fails. Even a run whose result happened to be 2 is caught at the same place if it skips the lock.`,
        ),
        set: {
          oracle: {
            tone: "bad",
            rows: {
              [t("判定", "verdict")]: verdict(BAD),
              [t("受け付けた数", "accepted")]: t(
                `${BAD.acceptedCount}個`,
                `${BAD.acceptedCount}`,
              ),
              [t("止まった", "stopped at")]: badEvent,
            },
          },
          log: { tone: "bad" },
        },
        detail: [
          {
            title: t("判定の結果", "Verdict"),
            fields: [
              {
                label: t("受け付けたか", "Accepted?"),
                value: verdict(BAD),
                tone: "bad",
              },
              {
                label: t("受け付けた数", "Accepted"),
                value: t(`${BAD.acceptedCount}個`, `${BAD.acceptedCount}`),
              },
              {
                label: t("止まったイベント", "Stopped at"),
                value: stopped(BAD_LOG, BAD),
              },
            ],
          },
        ],
        simplified: t(
          "並行に動くスレッドのログは、記録した順が本当に起きた順と一致している必要がある。共有のロガーで順序を保つなど、記録の仕方に気をつける。",
          "For logs from concurrent threads, the recorded order must match the order things really happened. Take care how you log, for example by keeping order with a shared logger.",
        ),
      },
    ],
    lab: {
      title: t("ログを判定させる", "Have a log judged"),
      hint: t(
        "イベントをカンマ（, か 、）で区切って入れる。空欄なら正しいログに戻す。",
        "Enter events separated by commas. Leave it empty to go back to the correct log.",
      ),
      inputs: [
        {
          id: "log",
          label: t("実行ログ（カンマ区切り）", "Execution log (comma-separated)"),
          initial: GOOD_LOG.join(", "),
        },
      ],
      compute: (values): Field[] => {
        const log = parseLog(values.log);
        const check = acceptsTrace(ORACLE, COUNTER_ENV, log);
        return [
          {
            label: t("イベントの数", "Events"),
            value: t(`${log.length}個`, `${log.length}`),
          },
          {
            label: t("判定", "Verdict"),
            value: verdict(check),
            tone: check.isAccepted ? "ok" : "bad",
          },
          {
            label: t("受け付けた数", "Accepted"),
            value: t(`${check.acceptedCount}個`, `${check.acceptedCount}`),
          },
          { label: t("止まったイベント", "Stopped at"), value: stopped(log, check) },
        ];
      },
    },
  };
}
