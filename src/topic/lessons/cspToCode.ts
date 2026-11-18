import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import { acceptsTrace, traceTo, type TraceCheck } from "../csp";
import { COUNTER_ENV, counterSystem } from "../cspModels";

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
const BAD_EVENT = BAD_LOG[BAD.acceptedCount] ?? "なし";

function verdictText(check: TraceCheck): string {
  return check.isAccepted ? "受け付けた" : "受け付けない";
}

/** 止まったイベント（先頭から acceptedCount 個の次）。受け付けたときは「なし」。 */
function stoppedAt(log: string[], check: TraceCheck): string {
  if (check.isAccepted) return "なし";
  return `${log[check.acceptedCount]}（${check.acceptedCount + 1}個目）`;
}

function logRows(log: string[]) {
  return {
    件数: `${log.length}個`,
    先頭: log[0] ?? "なし",
    最後: log.at(-1) ?? "なし",
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

export const cspToCodeLesson: Lesson = {
  id: "csp-to-code",
  category: "csp",
  title: "モデルを実装とテストへ",
  subtitle: "プロセスはスレッドに、モデルはテストの判定役に",
  summary: `CSP のプロセスとチャネルは、スレッドや goroutine とチャネルにほぼそのまま移せる。確かめたモデルは、実装のログ（イベントの並び）を判定するテストの判定役（オラクル）にもなる。`,
  facts: [
    {
      label: "正しいログ",
      value: `${GOOD_LOG.length}個を${verdictText(GOOD)}`,
      tone: "ok",
    },
    {
      label: "ロックを取らないログ",
      value: `受け付けたのは${BAD.acceptedCount}個、${stoppedAt(BAD_LOG, BAD)}で止まる`,
      tone: "bad",
    },
    { label: "判定に使う計算", value: "acceptsTrace（モデルがその並びを起こせるか）" },
    { label: "実物の対応先", value: "Go のチャネル、Java の JCSP ライブラリなど" },
    { label: "参考文献", value: `${CSP_BOOK} 第4章（JCSP入門）・第8章（JCSP実装）` },
  ],
  actors: [
    {
      id: "impl",
      label: "実装",
      sublabel: "スレッドとチャネル",
      icon: "process",
      x: 14,
      y: 50,
      initial: { rows: { 状態: "まだ動かしていない" } },
    },
    {
      id: "log",
      label: "実行ログ",
      sublabel: "イベントの並び",
      icon: "document",
      x: 38,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "model",
      label: "モデル",
      sublabel: "ロックありのカウンタ",
      icon: "spec",
      x: 62,
      y: 50,
      initial: { rows: { 状態: "確かめ済み" } },
    },
    {
      id: "oracle",
      label: "判定役",
      sublabel: "テストのオラクル",
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
      title: "プロセスをスレッドへ",
      actor: "model",
      to: ["impl"],
      summary:
        "プロセスはスレッドや goroutine、同期するイベントはチャネルでの受け渡しに移す",
      explain:
        "CSP のプロセスは、実装では1本のスレッドや goroutine にほぼそのまま対応する。2つのプロセスが同期して起こすイベントは、チャネルで値を受け渡す1回の操作になる。設計で確かめた形を崩さずにコードへ移せるのが、CSP で書く利点。",
      set: { impl: { tone: "wait", rows: { 状態: "モデルから作成" } } },
      detail: [
        {
          title: "CSP と実装の対応（一般的な概念）",
          fields: [
            { label: "プロセス", value: "スレッド、goroutine、JCSP のプロセス" },
            { label: "同期するイベント", value: "チャネルでの1回の送受信" },
            { label: "並行合成", value: "複数のスレッドを起動し、同じチャネルを渡す" },
            {
              label: "外部選択 □",
              value: "複数のチャネルのうち、来たものを受ける（Go の select など）",
            },
            { label: "隠蔽 \\", value: "外に公開しない内部のチャネル" },
            { label: "SKIP（正しく終わる）", value: "スレッドが返って終わる" },
          ],
        },
      ],
      simplified:
        "対応は概念だけを並べた。実物のライブラリの API 名は書いていない。Go のチャネルにバッファを付けると送り手が待たなくなり、CSP の「両方がそろって起きる」同期とは違うふるまいになる。",
    },
    {
      id: "channel",
      kind: "spec",
      title: "ロックもプロセスで",
      actor: "model",
      to: ["impl"],
      summary: "lock.A・read.A.0 などのイベントが、実装の操作の名前になる",
      explain:
        "このサイトのカウンタでは、変数もロックもプロセスとして書いた。lock.A は「Aがロックを取る」、read.A.0 は「Aが値0を読む」、write.A.1 は「Aが1を書く」、unlock.A は「Aがロックを手放す」、finish と result.2 は「全員が終わり、最後の値は2」という意味。実装でもこれらの操作の所でログを出せば、モデルと同じ言葉で実行を記録できる。",
      set: { model: { tone: "ok", rows: { イベント: "lock・read など" } } },
      simplified:
        "実装の操作とモデルのイベント名を1対1に対応づける作業は人が書く。ここではログが最初からモデルのイベント名で出ている前提にしている。",
    },
    {
      id: "good-log",
      kind: "run",
      title: "実装を動かして記録",
      actor: "impl",
      to: ["log"],
      summary: `正しい実装のログは${GOOD_LOG.length}個のイベント（${GOOD_LOG[0]} から ${GOOD_LOG.at(-1)} まで）`,
      explain: `ロックを取ってから読み書きする実装を動かし、起きたイベントを順に記録する。例は、モデルで result.2 に着く最短の手順と同じ並び（${GOOD_LOG.length}個）。`,
      set: {
        impl: { tone: "ok", rows: { 状態: "ロックを取る実装" } },
        log: { isHidden: false, tone: "wait", rows: logRows(GOOD_LOG) },
      },
      detail: [
        {
          title: "正しいログ",
          fields: GOOD_LOG.map((ev, index) => ({ label: `${index + 1}`, value: ev })),
        },
      ],
    },
    {
      id: "judge-good",
      kind: "test",
      title: "モデルが判定する",
      actor: "oracle",
      to: ["log", "model"],
      summary: `acceptsTrace の結果: ${verdictText(GOOD)}（${GOOD.acceptedCount}個すべて）`,
      explain: `判定役はログを先頭から1つずつ読み、モデルがその順でイベントを起こせるかを確かめる。${GOOD_LOG.length}個すべてをモデルが起こせたので${verdictText(GOOD)}。テストごとに期待値を手で書かなくても、モデルが「起こりうる並びか」を答えてくれる。`,
      set: {
        oracle: {
          isHidden: false,
          tone: "ok",
          rows: { 判定: verdictText(GOOD), 受け付けた数: `${GOOD.acceptedCount}個` },
        },
        log: { tone: "ok" },
      },
      simplified:
        "acceptsTrace はモデルのトレースの先頭部分かどうかを見る。途中で切れたログも受け付け、最後まで正しく終わったか（✓）は見ない。見えない動き τ は何回挟まってもよいとして判定している。",
    },
    {
      id: "bad-log",
      kind: "run",
      title: "ロックを取らない実装",
      actor: "impl",
      to: ["log"],
      summary: `ロックを忘れた実装のログは${BAD_LOG.length}個のイベント（${BAD_LOG[0]} から ${BAD_LOG.at(-1)} まで）`,
      explain: `ロックを取らずに読み書きする実装を動かすと、${BAD_LOG[0]} から始まるログが出る。例は、ロック無しのモデルで result.1（更新が消えた）に着く最短の手順と同じ並び。`,
      set: {
        impl: { tone: "bad", rows: { 状態: "ロックを取らない実装" } },
        log: { tone: "wait", rows: logRows(BAD_LOG) },
        oracle: { tone: "idle", rows: { 判定: "まだ", 受け付けた数: null } },
      },
      detail: [
        {
          title: "ロックを取らないログ",
          fields: BAD_LOG.map((ev, index) => ({ label: `${index + 1}`, value: ev })),
        },
      ],
    },
    {
      id: "judge-bad",
      kind: "found",
      title: `${BAD_EVENT}で止まる`,
      actor: "oracle",
      to: ["log", "model"],
      summary: `${verdictText(BAD)}。受け付けたのは${BAD.acceptedCount}個で、${stoppedAt(BAD_LOG, BAD)}で止まる`,
      explain: `モデルでは、Aは読む前に必ず lock.A でロックを取る。最初の ${BAD_EVENT} はモデルが起こせないので、受け付けたのは先頭の${BAD.acceptedCount}個で、テストは失敗になる。結果が偶然2になった実行でも、ロックを取らない並びなら同じ所で見つかる。`,
      set: {
        oracle: {
          tone: "bad",
          rows: {
            判定: verdictText(BAD),
            受け付けた数: `${BAD.acceptedCount}個`,
            止まった: BAD_EVENT,
          },
        },
        log: { tone: "bad" },
      },
      detail: [
        {
          title: "判定の結果",
          fields: [
            { label: "受け付けたか", value: verdictText(BAD), tone: "bad" },
            { label: "受け付けた数", value: `${BAD.acceptedCount}個` },
            { label: "止まったイベント", value: stoppedAt(BAD_LOG, BAD) },
          ],
        },
      ],
      simplified:
        "並行に動くスレッドのログは、記録した順が本当に起きた順と一致している必要がある。共有のロガーで順序を保つなど、記録の仕方に気をつける。",
    },
  ],
  lab: {
    title: "ログを判定させる",
    hint: "イベントをカンマ（, か 、）で区切って入れる。空欄なら正しいログに戻す。",
    inputs: [
      { id: "log", label: "実行ログ（カンマ区切り）", initial: GOOD_LOG.join(", ") },
    ],
    compute: (values): Field[] => {
      const log = parseLog(values.log);
      const check = acceptsTrace(ORACLE, COUNTER_ENV, log);
      return [
        { label: "イベントの数", value: `${log.length}個` },
        {
          label: "判定",
          value: verdictText(check),
          tone: check.isAccepted ? "ok" : "bad",
        },
        { label: "受け付けた数", value: `${check.acceptedCount}個` },
        { label: "止まったイベント", value: stoppedAt(log, check) },
      ];
    },
  },
};
