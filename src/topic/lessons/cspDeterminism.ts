import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import {
  acceptsTrace,
  type Determinism,
  determinism,
  type Env,
  explore,
  type Proc,
} from "../csp";
import {
  COUNTER_ENV,
  COUNTER_VALUES,
  counterObserved,
  PRINTER_ENV,
  printerImpl,
  printerSpec,
} from "../cspModels";

// どの判定も数ミリ秒で終わるので、最上位で1回ずつ呼ぶ。
const NO_LOCK = counterObserved(false);
const NO_LOCK_LTS = explore(NO_LOCK, COUNTER_ENV);
const NO_LOCK_RESULT = determinism(NO_LOCK, COUNTER_ENV);
if (NO_LOCK_RESULT.witness?.kind !== "refusal") {
  throw new Error("ロック無しのカウンタで、断ることの証拠が見つからない");
}
const NO_LOCK_WITNESS = NO_LOCK_RESULT.witness;
// finishの後に出ることがある結果（テストを何回も回したときに見える値）
const NO_LOCK_RESULTS = COUNTER_VALUES.filter(
  (value) =>
    acceptsTrace(NO_LOCK, COUNTER_ENV, ["finish", `result.${value}`]).isAccepted,
).map((value) => `result.${value}`);
const LOCK_RESULT = determinism(counterObserved(true), COUNTER_ENV);
const PRINTER_IMPL_RESULT = determinism(printerImpl(), PRINTER_ENV);
if (PRINTER_IMPL_RESULT.witness?.kind !== "refusal") {
  throw new Error("勝手に断るプリンタで、断ることの証拠が見つからない");
}
const PRINTER_WITNESS = PRINTER_IMPL_RESULT.witness;
const PRINTER_SPEC_RESULT = determinism(printerSpec(), PRINTER_ENV);

function traceText(trace: string[]): string {
  return trace.length > 0 ? `${trace.join(" → ")}の後` : "最初の時点";
}

function deterministicText(isDeterministic: boolean): string {
  return isDeterministic ? "決定的" : "非決定的";
}

function witnessText(result: Determinism): string {
  const witness = result.witness;
  if (!witness) return "なし";
  if (witness.kind === "refusal") {
    return `${traceText(witness.trace)}、${witness.event}を起こせるのに断ることもある`;
  }
  return `${traceText(witness.trace)}、見えない動きだけで回り続けられる（発散）`;
}

interface Target {
  name: string;
  proc: Proc;
  env: Env;
}

function parseTarget(text: string | undefined): Target {
  // 「ロックあり」「仕様」「プリンタ（断る）」の順に見て、どれでもなければ既定のロック無しに戻す。
  const value = text ?? "";
  if (value.includes("ロックあり")) {
    return {
      name: "ロックありのカウンタ",
      proc: counterObserved(true),
      env: COUNTER_ENV,
    };
  }
  if (value.includes("仕様")) {
    return { name: "仕様のプリンタ", proc: printerSpec(), env: PRINTER_ENV };
  }
  if (value.includes("プリンタ") || value.includes("断る")) {
    return { name: "勝手に断るプリンタ", proc: printerImpl(), env: PRINTER_ENV };
  }
  return { name: "ロック無しのカウンタ", proc: NO_LOCK, env: COUNTER_ENV };
}

export const cspDeterminismLesson: Lesson = {
  id: "csp-determinism",
  category: "csp",
  title: "決定性と揺れるテスト",
  subtitle: "同じ操作で結果が揺れるのは、システムが非決定的だから",
  summary: `ロック無しのカウンタは${traceText(NO_LOCK_WITNESS.trace)}に${NO_LOCK_WITNESS.event}を断ることがあり非決定的、ロックありは決定的。揺れるテストの出どころを、決定性の検査でモデルから探す。`,
  intro: [
    "決定性は、同じ操作をすれば外から見える結果が毎回同じになる、というシステムの性質だ。そうならないシステムを非決定的と呼ぶ。",
    "揺れるテスト（flaky test）は、テストの書き方ではなく、システムの非決定性から来ていることがある。これまでに見たロック無しのカウンタと、勝手に断るプリンタを例に、テストを何度も流す代わりに、揺れの出どころをモデルから探す。",
    "図では、テストのカードが同じ操作をくり返し、結果が分かれる所から始まる。検査器が「このトレースの後、このイベントを起こせる回も断る回もある」という証拠を返す場面が分かれ目で、ロックありのカウンタや仕様のプリンタと見比べて原因を絞る。",
  ],
  facts: [
    {
      label: "ロック無し",
      value: `${deterministicText(NO_LOCK_RESULT.isDeterministic)}（${NO_LOCK_RESULTS.join("・")}が出ることがある）`,
      tone: NO_LOCK_RESULT.isDeterministic ? "ok" : "bad",
    },
    {
      label: "ロックあり",
      value: deterministicText(LOCK_RESULT.isDeterministic),
      tone: LOCK_RESULT.isDeterministic ? "ok" : "bad",
    },
    {
      label: "プリンタ",
      value: `実装は${deterministicText(PRINTER_IMPL_RESULT.isDeterministic)}、仕様は${deterministicText(PRINTER_SPEC_RESULT.isDeterministic)}`,
      tone: "wait",
    },
    { label: "参考文献", value: `${CSP_BOOK} 3.2.4節（表明。決定性）` },
  ],
  actors: [
    {
      id: "test",
      label: "テスト",
      sublabel: "同じ操作を何回も",
      icon: "test",
      x: 14,
      y: 27,
    },
    {
      id: "counter",
      label: "カウンタ",
      sublabel: "ロック無し",
      icon: "process",
      x: 40,
      y: 27,
      initial: { rows: { 状態: `${NO_LOCK_LTS.stateCount}個` } },
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "決定性を調べる",
      icon: "checker",
      x: 66,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "locked",
      label: "カウンタ",
      sublabel: "ロックあり",
      icon: "lock",
      x: 66,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "printer",
      label: "プリンタ",
      sublabel: "実装と仕様",
      icon: "device",
      x: 40,
      y: 73,
      initial: { isHidden: true },
    },
  ],
  links: [
    { from: "test", to: "counter" },
    { from: "checker", to: "counter" },
    { from: "checker", to: "locked" },
    { from: "checker", to: "printer" },
  ],
  steps: [
    {
      id: "flaky",
      kind: "run",
      title: "同じテストが揺れる",
      actor: "test",
      to: ["counter"],
      summary: `2人が1ずつ足すカウンタを何回も試すと、finishの後に${NO_LOCK_RESULTS.join("・")}の両方が出ることがある`,
      explain: `2人が値を読んで1を足して書くカウンタを、ロック無しで動かす。finish（全員が終わった合図）の後に result.値（最後の値の報告）が出るが、読み書きの順しだいで${NO_LOCK_RESULTS.join("・")}のどちらも出ることがある。テストから見ると「同じ操作なのに、たまに落ちる」揺れるテスト（flaky test）になる。`,
      set: {
        test: { tone: "wait", rows: { 結果: NO_LOCK_RESULTS.join(" / ") } },
        counter: { tone: "wait" },
      },
      simplified:
        "読み書きは隠し、外から見えるのは finish と result だけにしてある。式はこのサイトのモデル（cspModels.ts）の書き方で、実物の CSPM（FDR の記法）とは書き方が違う。",
    },
    {
      id: "definition",
      kind: "spec",
      title: "決定的とは",
      actor: "checker",
      summary: "どのトレースの後でも、起こせるイベントを断らず、発散もしない",
      explain:
        "決定的なシステムは、どのトレース（ここまでに起きたイベントの並び）の後でも、起こせるイベントを断ることがなく、見えない動きだけで回り続ける（発散する）こともない。だから同じ操作をすれば、外から見える結果は毎回同じになる。FDR の deterministic の表明と同じ定義を使う。",
      set: {
        checker: { isHidden: false, tone: "idle", rows: { 調べる: "断る・発散" } },
      },
    },
    {
      id: "refuse",
      kind: "found",
      title: "起こせるのに断る",
      actor: "checker",
      to: ["counter"],
      summary: `ロック無し: ${witnessText(NO_LOCK_RESULT)}`,
      explain: `検査器は「${traceText(NO_LOCK_WITNESS.trace)}、${NO_LOCK_WITNESS.event}を起こせる回もあれば、断る回もある」という証拠を返した。断る回は別の結果（${NO_LOCK_RESULTS.filter((ev) => ev !== NO_LOCK_WITNESS.event).join("・")}）になる回で、これがテストが揺れる原因になる。どの読み書きの順になるかは、外からは選べない。`,
      set: {
        counter: { tone: "bad" },
        checker: {
          tone: "bad",
          rows: { 決定性: deterministicText(NO_LOCK_RESULT.isDeterministic) },
        },
      },
      detail: [
        {
          title: "検査器が返した証拠",
          fields: [
            {
              label: "トレース",
              value: NO_LOCK_WITNESS.trace.join(" → ") || "なし（最初から）",
              isCode: true,
            },
            {
              label: "断ることがあるイベント",
              value: NO_LOCK_WITNESS.event,
              isCode: true,
            },
          ],
        },
      ],
      simplified:
        "同じ組を ProB の deterministic の検査で確かめ、結果が一致した（specs/csp）。",
    },
    {
      id: "lock",
      kind: "fix",
      title: "ロックで結果を固定",
      actor: "checker",
      to: ["locked"],
      summary: `ロックありのカウンタは${deterministicText(LOCK_RESULT.isDeterministic)}`,
      explain: `読んでから書くまでをロックで囲むと、もう1人が途中に割り込めなくなる。どの順で動いても最後の値は同じになるので、検査器はロックありのカウンタを${deterministicText(LOCK_RESULT.isDeterministic)}と判定した。`,
      set: {
        locked: {
          isHidden: false,
          tone: LOCK_RESULT.isDeterministic ? "ok" : "bad",
          rows: { 決定性: deterministicText(LOCK_RESULT.isDeterministic) },
        },
      },
    },
    {
      id: "printer",
      kind: "found",
      title: "プリンタも揺れる",
      actor: "checker",
      to: ["printer"],
      summary: `勝手に断るプリンタ: ${witnessText(PRINTER_IMPL_RESULT)}`,
      explain: `インクが少ないと勝手にモノクロしか受け付けなくなるプリンタも、検査器は${deterministicText(PRINTER_IMPL_RESULT.isDeterministic)}と判定した。証拠は「${traceText(PRINTER_WITNESS.trace)}、${PRINTER_WITNESS.event}を断ることがある」で、カラー印刷のテストが通ったり落ちたりする。`,
      set: {
        printer: {
          isHidden: false,
          tone: "bad",
          rows: { 実装: deterministicText(PRINTER_IMPL_RESULT.isDeterministic) },
        },
      },
    },
    {
      id: "printerSpec",
      kind: "explore",
      title: "仕様は決定的",
      actor: "checker",
      to: ["printer"],
      summary: `利用者が選べばいつでも刷る仕様のプリンタは${deterministicText(PRINTER_SPEC_RESULT.isDeterministic)}`,
      explain: `仕様のプリンタは、モノクロもカラーも利用者が選んだとおりに受け付ける。断るかどうかを機械が勝手に決める所が無いので、検査器は${deterministicText(PRINTER_SPEC_RESULT.isDeterministic)}と判定した。仕様が決定的なら、実装の揺れは仕様から来たものではないと分かる。`,
      set: {
        printer: {
          rows: { 仕様: deterministicText(PRINTER_SPEC_RESULT.isDeterministic) },
        },
      },
    },
    {
      id: "beforeRetry",
      kind: "test",
      title: "リトライの前に",
      actor: "test",
      to: ["checker"],
      summary: "揺れるテストを、テストの書き方ではなくシステムの非決定性として調べる",
      explain:
        "揺れるテストはリトライで通してしまいがちだが、原因がシステムの非決定性なら、本番でも同じ揺れが起きる。モデルに決定性の検査をかければ、どのトレースの後に何を断りうるかが証拠として出るので、揺れの出どころ（ここではロックの無い読み書き）を先に探せる。",
      set: { test: { tone: "ok" }, counter: { tone: "idle" } },
    },
  ],
  lab: {
    title: "決定的かを調べる",
    hint: "対象に「ロック無し」「ロックあり」「勝手に断るプリンタ」「仕様のプリンタ」のどれかを書くと、決定的かと、非決定的ならその証拠を出す。",
    inputs: [
      {
        id: "target",
        label: "対象",
        initial: "ロック無し",
      },
    ],
    compute: (values): Field[] => {
      const target = parseTarget(values.target);
      const lts = explore(target.proc, target.env);
      const result = determinism(target.proc, target.env);
      return [
        { label: "対象", value: target.name },
        { label: "状態", value: `${lts.stateCount}個` },
        {
          label: "決定性",
          value: deterministicText(result.isDeterministic),
          tone: result.isDeterministic ? "ok" : "bad",
        },
        {
          label: "証拠",
          value: witnessText(result),
          tone: result.isDeterministic ? "ok" : "bad",
        },
      ];
    },
  },
};
