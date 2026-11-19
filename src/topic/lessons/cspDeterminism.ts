import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
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

function traceText(trace: string[], language: Language): string {
  if (language === "ja")
    return trace.length > 0 ? `${trace.join(" → ")}の後` : "最初の時点";
  return trace.length > 0 ? `after ${trace.join(" → ")}` : "at the start";
}

function deterministicText(isDeterministic: boolean, language: Language): string {
  const t = translator(language);
  return isDeterministic
    ? t("決定的", "deterministic")
    : t("非決定的", "nondeterministic");
}

function witnessText(result: Determinism, language: Language): string {
  const t = translator(language);
  const witness = result.witness;
  if (!witness) return t("なし", "none");
  const when = traceText(witness.trace, language);
  if (witness.kind === "refusal") {
    return t(
      `${when}、${witness.event}を起こせるのに断ることもある`,
      `${when}, it can perform ${witness.event} but may also refuse it`,
    );
  }
  return t(
    `${when}、見えない動きだけで回り続けられる（発散）`,
    `${when}, it can loop forever on invisible moves alone (divergence)`,
  );
}

interface Target {
  name: string;
  proc: Proc;
  env: Env;
}

function parseTarget(text: string | undefined, language: Language): Target {
  const t = translator(language);
  // 「ロックあり」「仕様」「プリンタ（断る）」の順に見て、どれでもなければ既定のロック無しに戻す。
  // 英語の画面では with lock / spec / printer・refus で同じ順に見る。
  const value = text ?? "";
  if (value.includes("ロックあり") || /with lock/i.test(value)) {
    return {
      name: t("ロックありのカウンタ", "counter with lock"),
      proc: counterObserved(true),
      env: COUNTER_ENV,
    };
  }
  if (value.includes("仕様") || /spec/i.test(value)) {
    return {
      name: t("仕様のプリンタ", "spec printer"),
      proc: printerSpec(),
      env: PRINTER_ENV,
    };
  }
  if (
    value.includes("プリンタ") ||
    value.includes("断る") ||
    /printer|refus/i.test(value)
  ) {
    return {
      name: t("勝手に断るプリンタ", "printer that refuses"),
      proc: printerImpl(),
      env: PRINTER_ENV,
    };
  }
  return {
    name: t("ロック無しのカウンタ", "counter without lock"),
    proc: NO_LOCK,
    env: COUNTER_ENV,
  };
}

export function cspDeterminismLesson(language: Language): Lesson {
  const t = translator(language);
  const det = (isDeterministic: boolean) =>
    deterministicText(isDeterministic, language);
  const results = t(NO_LOCK_RESULTS.join("・"), NO_LOCK_RESULTS.join(" and "));
  const noLockWhen = traceText(NO_LOCK_WITNESS.trace, language);
  const otherResults = NO_LOCK_RESULTS.filter((ev) => ev !== NO_LOCK_WITNESS.event);
  return {
    id: "csp-determinism",
    category: "csp",
    title: t("決定性と揺れるテスト", "Determinism and flaky tests"),
    subtitle: t(
      "同じ操作で結果が揺れるのは、システムが非決定的だから",
      "Results vary for the same input when the system is nondeterministic",
    ),
    summary: t(
      `ロック無しのカウンタは${noLockWhen}に${NO_LOCK_WITNESS.event}を断ることがあり非決定的、ロックありは決定的。揺れるテストの出どころを、決定性の検査でモデルから探す。`,
      `The counter without a lock may refuse ${NO_LOCK_WITNESS.event} ${noLockWhen}, so it is nondeterministic; with the lock it is deterministic. Use a determinism check to find where a flaky test comes from, in the model.`,
    ),
    intro: [
      t(
        "決定性は、同じ操作をすれば外から見える結果が毎回同じになる、というシステムの性質だ。そうならないシステムを非決定的と呼ぶ。",
        "Determinism is the property that the same operations always give the same visible results. A system without it is called nondeterministic.",
      ),
      t(
        "揺れるテスト（flaky test）は、テストの書き方ではなく、システムの非決定性から来ていることがある。これまでに見たロック無しのカウンタと、勝手に断るプリンタを例に、テストを何度も流す代わりに、揺れの出どころをモデルから探す。",
        "A flaky test sometimes comes not from how the test is written but from nondeterminism in the system. Using the counter without a lock and the printer that refuses on its own from earlier lessons, we look for the source of the flakiness in the model instead of rerunning the test again and again.",
      ),
      t(
        "図では、テストのカードが同じ操作をくり返し、結果が分かれる所から始まる。検査器が「このトレースの後、このイベントを起こせる回も断る回もある」という証拠を返す場面が分かれ目で、ロックありのカウンタや仕様のプリンタと見比べて原因を絞る。",
        'In the diagram, it starts with the test card repeating the same operations and getting different results. The turning point is where the checker returns evidence: "after this trace, this event sometimes happens and is sometimes refused". Comparing with the locked counter and the spec printer narrows down the cause.',
      ),
    ],
    facts: [
      {
        label: t("ロック無し", "No lock"),
        value: t(
          `${det(NO_LOCK_RESULT.isDeterministic)}（${NO_LOCK_RESULTS.join("・")}が出ることがある）`,
          `${det(NO_LOCK_RESULT.isDeterministic)} (may give ${results})`,
        ),
        tone: NO_LOCK_RESULT.isDeterministic ? "ok" : "bad",
      },
      {
        label: t("ロックあり", "With lock"),
        value: det(LOCK_RESULT.isDeterministic),
        tone: LOCK_RESULT.isDeterministic ? "ok" : "bad",
      },
      {
        label: t("プリンタ", "Printer"),
        value: t(
          `実装は${det(PRINTER_IMPL_RESULT.isDeterministic)}、仕様は${det(PRINTER_SPEC_RESULT.isDeterministic)}`,
          `implementation ${det(PRINTER_IMPL_RESULT.isDeterministic)}, spec ${det(PRINTER_SPEC_RESULT.isDeterministic)}`,
        ),
        tone: "wait",
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 3.2.4節（表明。決定性）`,
          `${CSP_BOOK_EN}, section 3.2.4 (assertions: determinism)`,
        ),
      },
    ],
    actors: [
      {
        id: "test",
        label: t("テスト", "Test"),
        sublabel: t("同じ操作を何回も", "same steps, many times"),
        icon: "test",
        x: 14,
        y: 27,
      },
      {
        id: "counter",
        label: t("カウンタ", "Counter"),
        sublabel: t("ロック無し", "no lock"),
        icon: "process",
        x: 40,
        y: 27,
        initial: {
          rows: {
            [t("状態", "states")]: t(
              `${NO_LOCK_LTS.stateCount}個`,
              `${NO_LOCK_LTS.stateCount}`,
            ),
          },
        },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("決定性を調べる", "checks determinism"),
        icon: "checker",
        x: 66,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "locked",
        label: t("カウンタ", "Counter"),
        sublabel: t("ロックあり", "with lock"),
        icon: "lock",
        x: 66,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "printer",
        label: t("プリンタ", "Printer"),
        sublabel: t("実装と仕様", "impl and spec"),
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
        title: t("同じテストが揺れる", "The same test flakes"),
        actor: "test",
        to: ["counter"],
        summary: t(
          `2人が1ずつ足すカウンタを何回も試すと、finishの後に${NO_LOCK_RESULTS.join("・")}の両方が出ることがある`,
          `Run the counter where two people each add 1 many times, and after finish both ${results} can appear`,
        ),
        explain: t(
          `2人が値を読んで1を足して書くカウンタを、ロック無しで動かす。finish（全員が終わった合図）の後に result.値（最後の値の報告）が出るが、読み書きの順しだいで${NO_LOCK_RESULTS.join("・")}のどちらも出ることがある。テストから見ると「同じ操作なのに、たまに落ちる」揺れるテスト（flaky test）になる。`,
          `Run the counter, where two people each read the value, add 1 and write it back, without a lock. After finish (the signal that everyone is done) comes result.value (the final value), but depending on the order of reads and writes, either ${t(NO_LOCK_RESULTS.join("・"), NO_LOCK_RESULTS.join(" or "))} can appear. From the test's point of view, it is a flaky test: the same steps, but it sometimes fails.`,
        ),
        set: {
          test: {
            tone: "wait",
            rows: { [t("結果", "results")]: NO_LOCK_RESULTS.join(" / ") },
          },
          counter: { tone: "wait" },
        },
        simplified: t(
          "読み書きは隠し、外から見えるのは finish と result だけにしてある。式はこのサイトのモデル（cspModels.ts）の書き方で、実物の CSPM（FDR の記法）とは書き方が違う。",
          "Reads and writes are hidden, so only finish and result are visible from outside. The expressions use this site's model notation (cspModels.ts), which differs from real CSPM (the notation used by FDR).",
        ),
      },
      {
        id: "definition",
        kind: "spec",
        title: t("決定的とは", "What deterministic means"),
        actor: "checker",
        summary: t(
          "どのトレースの後でも、起こせるイベントを断らず、発散もしない",
          "After any trace, it never refuses an event it can perform, and never diverges",
        ),
        explain: t(
          "決定的なシステムは、どのトレース（ここまでに起きたイベントの並び）の後でも、起こせるイベントを断ることがなく、見えない動きだけで回り続ける（発散する）こともない。だから同じ操作をすれば、外から見える結果は毎回同じになる。FDR の deterministic の表明と同じ定義を使う。",
          "A deterministic system, after any trace (the sequence of events so far), never refuses an event it can perform and never loops forever on invisible moves alone (diverges). So the same operations always give the same visible results. This uses the same definition as FDR's deterministic assertion.",
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "idle",
            rows: { [t("調べる", "checks")]: t("断る・発散", "refusal, divergence") },
          },
        },
      },
      {
        id: "refuse",
        kind: "found",
        title: t("起こせるのに断る", "Can do it, yet may refuse"),
        actor: "checker",
        to: ["counter"],
        summary: t(
          `ロック無し: ${witnessText(NO_LOCK_RESULT, language)}`,
          `No lock: ${witnessText(NO_LOCK_RESULT, language)}`,
        ),
        explain: t(
          `検査器は「${noLockWhen}、${NO_LOCK_WITNESS.event}を起こせる回もあれば、断る回もある」という証拠を返した。断る回は別の結果（${otherResults.join("・")}）になる回で、これがテストが揺れる原因になる。どの読み書きの順になるかは、外からは選べない。`,
          `The checker returned evidence: "${noLockWhen}, ${NO_LOCK_WITNESS.event} sometimes happens and is sometimes refused". The runs that refuse it are the ones with a different result (${otherResults.join(", ")}), and that is why the test flakes. Which order of reads and writes happens cannot be chosen from outside.`,
        ),
        set: {
          counter: { tone: "bad" },
          checker: {
            tone: "bad",
            rows: { [t("決定性", "determinism")]: det(NO_LOCK_RESULT.isDeterministic) },
          },
        },
        detail: [
          {
            title: t("検査器が返した証拠", "Evidence the checker returned"),
            fields: [
              {
                label: t("トレース", "Trace"),
                value:
                  NO_LOCK_WITNESS.trace.join(" → ") ||
                  t("なし（最初から）", "none (from the start)"),
                isCode: true,
              },
              {
                label: t("断ることがあるイベント", "Event it may refuse"),
                value: NO_LOCK_WITNESS.event,
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "同じ組を ProB の deterministic の検査で確かめ、結果が一致した（specs/csp）。",
          "The same cases were checked with ProB's deterministic check, and the results agreed (specs/csp).",
        ),
      },
      {
        id: "lock",
        kind: "fix",
        title: t("ロックで結果を固定", "A lock fixes the result"),
        actor: "checker",
        to: ["locked"],
        summary: t(
          `ロックありのカウンタは${det(LOCK_RESULT.isDeterministic)}`,
          `The counter with a lock is ${det(LOCK_RESULT.isDeterministic)}`,
        ),
        explain: t(
          `読んでから書くまでをロックで囲むと、もう1人が途中に割り込めなくなる。どの順で動いても最後の値は同じになるので、検査器はロックありのカウンタを${det(LOCK_RESULT.isDeterministic)}と判定した。`,
          `Wrapping read-then-write in a lock means the other person cannot cut in between. Whatever the order, the final value is the same, so the checker judged the locked counter ${det(LOCK_RESULT.isDeterministic)}.`,
        ),
        set: {
          locked: {
            isHidden: false,
            tone: LOCK_RESULT.isDeterministic ? "ok" : "bad",
            rows: { [t("決定性", "determinism")]: det(LOCK_RESULT.isDeterministic) },
          },
        },
      },
      {
        id: "printer",
        kind: "found",
        title: t("プリンタも揺れる", "The printer flakes too"),
        actor: "checker",
        to: ["printer"],
        summary: t(
          `勝手に断るプリンタ: ${witnessText(PRINTER_IMPL_RESULT, language)}`,
          `Printer that refuses on its own: ${witnessText(PRINTER_IMPL_RESULT, language)}`,
        ),
        explain: t(
          `インクが少ないと勝手にモノクロしか受け付けなくなるプリンタも、検査器は${det(PRINTER_IMPL_RESULT.isDeterministic)}と判定した。証拠は「${traceText(PRINTER_WITNESS.trace, language)}、${PRINTER_WITNESS.event}を断ることがある」で、カラー印刷のテストが通ったり落ちたりする。`,
          `The printer that, when ink is low, decides on its own to accept only black and white is also judged ${det(PRINTER_IMPL_RESULT.isDeterministic)}. The evidence is "${traceText(PRINTER_WITNESS.trace, language)}, it may refuse ${PRINTER_WITNESS.event}", so a colour printing test sometimes passes and sometimes fails.`,
        ),
        set: {
          printer: {
            isHidden: false,
            tone: "bad",
            rows: {
              [t("実装", "impl")]: det(PRINTER_IMPL_RESULT.isDeterministic),
            },
          },
        },
      },
      {
        id: "printerSpec",
        kind: "explore",
        title: t("仕様は決定的", "The spec is deterministic"),
        actor: "checker",
        to: ["printer"],
        summary: t(
          `利用者が選べばいつでも刷る仕様のプリンタは${det(PRINTER_SPEC_RESULT.isDeterministic)}`,
          `The spec printer, which always prints whatever the user chooses, is ${det(PRINTER_SPEC_RESULT.isDeterministic)}`,
        ),
        explain: t(
          `仕様のプリンタは、モノクロもカラーも利用者が選んだとおりに受け付ける。断るかどうかを機械が勝手に決める所が無いので、検査器は${det(PRINTER_SPEC_RESULT.isDeterministic)}と判定した。仕様が決定的なら、実装の揺れは仕様から来たものではないと分かる。`,
          `The spec printer accepts black and white or colour exactly as the user chooses. There is no point where the machine decides on its own whether to refuse, so the checker judged it ${det(PRINTER_SPEC_RESULT.isDeterministic)}. If the spec is deterministic, the implementation's flakiness did not come from the spec.`,
        ),
        set: {
          printer: {
            rows: { [t("仕様", "spec")]: det(PRINTER_SPEC_RESULT.isDeterministic) },
          },
        },
      },
      {
        id: "beforeRetry",
        kind: "test",
        title: t("リトライの前に", "Before adding a retry"),
        actor: "test",
        to: ["checker"],
        summary: t(
          "揺れるテストを、テストの書き方ではなくシステムの非決定性として調べる",
          "Investigate a flaky test as nondeterminism in the system, not in the test",
        ),
        explain: t(
          "揺れるテストはリトライで通してしまいがちだが、原因がシステムの非決定性なら、本番でも同じ揺れが起きる。モデルに決定性の検査をかければ、どのトレースの後に何を断りうるかが証拠として出るので、揺れの出どころ（ここではロックの無い読み書き）を先に探せる。",
          "It is tempting to get a flaky test to pass with retries, but if the cause is nondeterminism in the system, production will flake the same way. A determinism check on the model gives evidence of what can be refused after which trace, so you can first find the source of the flakiness (here, reads and writes without a lock).",
        ),
        set: { test: { tone: "ok" }, counter: { tone: "idle" } },
      },
    ],
    lab: {
      title: t("決定的かを調べる", "Check for determinism"),
      hint: t(
        "対象に「ロック無し」「ロックあり」「勝手に断るプリンタ」「仕様のプリンタ」のどれかを書くと、決定的かと、非決定的ならその証拠を出す。",
        'Enter one of "no lock", "with lock", "refusing printer" or "spec printer" as the target to see whether it is deterministic and, if not, the evidence.',
      ),
      inputs: [
        {
          id: "target",
          label: t("対象", "Target"),
          initial: t("ロック無し", "no lock"),
        },
      ],
      compute: (values): Field[] => {
        const target = parseTarget(values.target, language);
        const lts = explore(target.proc, target.env);
        const result = determinism(target.proc, target.env);
        return [
          { label: t("対象", "Target"), value: target.name },
          {
            label: t("状態", "States"),
            value: t(`${lts.stateCount}個`, `${lts.stateCount}`),
          },
          {
            label: t("決定性", "Determinism"),
            value: det(result.isDeterministic),
            tone: result.isDeterministic ? "ok" : "bad",
          },
          {
            label: t("証拠", "Evidence"),
            value: witnessText(result, language),
            tone: result.isDeterministic ? "ok" : "bad",
          },
        ];
      },
    },
  };
}
