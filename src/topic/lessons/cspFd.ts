import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import {
  type Env,
  failuresDivergencesRefines,
  failuresRefines,
  explore,
  type FdCounterexample,
  hide,
  int,
  pre,
  type Proc,
  ref,
  SKIP,
  STOP,
  TAU,
  TICK,
  traceRefines,
} from "../csp";
import { jobSystem, JOB_ENV } from "../cspModels";

const BOUNDED_RETRIES = 2;
const MAX_RETRIES = 3;

/** 仕様: いつか成功して終わる。 */
const SUCCEED_SPEC: Proc = pre("succeed", SKIP);
/** 上限付きと比べる仕様: 成功か断念のどちらかで終わる（どちらになるかは呼び出し側が選べないので内部選択）。 */
const END_SPEC: Proc = int(pre("succeed", SKIP), pre("giveup", SKIP));

interface Comparison {
  traces: { holds: boolean; counterexample: string[] | null };
  failures: ReturnType<typeof failuresRefines>;
  fd: ReturnType<typeof failuresDivergencesRefines>;
}

function compare(spec: Proc, impl: Proc, env: Env): Comparison {
  return {
    traces: traceRefines(spec, impl, env),
    failures: failuresRefines(spec, impl, env),
    fd: failuresDivergencesRefines(spec, impl, env),
  };
}

const UNLIMITED = jobSystem(null, true);
const UNLIMITED_RESULT = compare(SUCCEED_SPEC, UNLIMITED, JOB_ENV);
const FD_FOUND = UNLIMITED_RESULT.fd.counterexample;
if (!FD_FOUND)
  throw new Error("隠したリトライ無制限のジョブで ⊑FD の反例が見つからない");
const FD_COUNTER = FD_FOUND;

// 隠した後に外から見えるイベント（τ と終わりの合図 ✓ を除く）
const UNLIMITED_VISIBLE = [
  ...new Set(explore(UNLIMITED, JOB_ENV).edges.map((edge) => edge.ev)),
].filter((ev) => ev !== TAU && ev !== TICK);

const BOUNDED = jobSystem(BOUNDED_RETRIES, true);
const BOUNDED_VS_SUCCEED = compare(SUCCEED_SPEC, BOUNDED, JOB_ENV);
const BOUNDED_VS_END = compare(END_SPEC, BOUNDED, JOB_ENV);

// 発散で厳密: 仕様が発散するなら、その後は何でもよい（csp.test.ts と同じ例）。
const LOOP_ENV: Env = { Loop: () => pre("t", ref("Loop")) };
const CHAOTIC_SPEC = hide(ref("Loop"), ["t"]);
const ANYTHING_IMPL = pre("x", STOP);
const CHAOS_HOLDS = failuresDivergencesRefines(
  CHAOTIC_SPEC,
  ANYTHING_IMPL,
  LOOP_ENV,
).holds;
const CHAOS_REVERSE = failuresDivergencesRefines(ANYTHING_IMPL, CHAOTIC_SPEC, LOOP_ENV);

const KIND_NAMES: Record<Language, Record<FdCounterexample["kind"], string>> = {
  ja: {
    trace: "仕様に無いトレース",
    divergence: "発散",
    failure: "仕様に無い拒否",
  },
  en: {
    trace: "a trace the spec lacks",
    divergence: "divergence",
    failure: "a refusal the spec lacks",
  },
};

function traceText(trace: string[], language: Language): string {
  if (trace.length > 0) return `⟨${trace.join(", ")}⟩`;
  return language === "ja" ? "⟨⟩（最初の時点）" : "⟨⟩ (at the start)";
}

/** 「そのトレースの後で」を、最初の時点なら「最初の時点で」と書く。 */
function afterText(trace: string[], language: Language): string {
  if (language === "ja")
    return trace.length > 0 ? `⟨${trace.join(", ")}⟩ の後で` : "最初の時点で";
  return trace.length > 0 ? `after ⟨${trace.join(", ")}⟩` : "at the start";
}

function fdCounterText(counter: FdCounterexample | null, language: Language): string {
  const t = translator(language);
  if (!counter) return t("なし", "none");
  switch (counter.kind) {
    case "trace":
      return t(
        `仕様に無いトレース${traceText(counter.trace, language)}`,
        `trace ${traceText(counter.trace, language)} not in the spec`,
      );
    case "divergence":
      return t(
        `${afterText(counter.trace, language)}発散できる`,
        `can diverge ${afterText(counter.trace, language)}`,
      );
    case "failure":
      return t(
        `${afterText(counter.trace, language)} {${counter.refusal.join(", ")}}を拒否できる`,
        `can refuse {${counter.refusal.join(", ")}} ${afterText(counter.trace, language)}`,
      );
  }
}

function parseRetries(text: string | undefined): number | null {
  const trimmed = (text ?? "").trim();
  if (trimmed === "" || trimmed === "なし") return null;
  const n = Number.parseInt(trimmed, 10);
  // 読めない入力（英語の画面の none も）は既定の「上限なし」に戻す
  if (Number.isNaN(n)) return null;
  return Math.min(MAX_RETRIES, Math.max(0, n));
}

function comparisonFields(
  name: string,
  result: Comparison,
  language: Language,
): Field[] {
  const t = translator(language);
  const holdsText = (holds: boolean) =>
    holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
  return [
    {
      label: `${name} ⊑T`,
      value: holdsText(result.traces.holds),
      tone: result.traces.holds ? "ok" : "bad",
    },
    {
      label: `${name} ⊑F`,
      value: holdsText(result.failures.holds),
      tone: result.failures.holds ? "ok" : "bad",
    },
    {
      label: `${name} ⊑FD`,
      value: holdsText(result.fd.holds),
      tone: result.fd.holds ? "ok" : "bad",
    },
    {
      label: t(`${name}の ⊑FD の反例`, `${name} ⊑FD counterexample`),
      value: fdCounterText(result.fd.counterexample, language),
      tone: result.fd.counterexample ? "bad" : "ok",
    },
  ];
}

export function cspFdLesson(language: Language): Lesson {
  const t = translator(language);
  const holdsText = (holds: boolean) =>
    holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
  const fixedText = (holds: boolean) =>
    t(`直すと${holdsText(holds)}`, `fixed: ${holdsText(holds)}`);
  const fdCounter = fdCounterText(FD_COUNTER, language);
  return {
    id: "csp-fd",
    category: "csp",
    title: t("発散まで含めて比べる", "Including divergence"),
    subtitle: t(
      "トレースと拒否で合格でも、回り続ける実装は落とす",
      "Passing traces and refusals, yet rejected for looping",
    ),
    summary: t(
      `隠したリトライは「いつか成功して終わる」仕様を ⊑T でも ⊑F でも満たすが、失敗発散詳細化 ⊑FD では「${fdCounter}」が反例になる。`,
      `The hidden retry satisfies the spec "eventually succeed and terminate" under both ⊑T and ⊑F, but under failures-divergences refinement ⊑FD, "${fdCounter}" is a counterexample.`,
    ),
    intro: [
      t(
        "失敗発散詳細化（⊑FD）は、失敗詳細化に「実装が発散してよいのは、仕様も発散するトレースだけ」という条件を足した比べ方だ。トレース・失敗・失敗発散の順に厳しくなる。",
        'Failures-divergences refinement (⊑FD) is failures refinement plus one more condition: "the implementation may diverge only after traces where the spec also diverges". Traces, failures and failures-divergences get stricter in that order.',
      ),
      t(
        "「隠すと見える発散」のジョブは、トレース詳細化でも失敗詳細化でも見逃される。失敗詳細化は τ が起きない安定した状態でしか拒否を数えないので、回り続けている間のことが比べる対象に入らないからだ。テストで言えば、応答が返らないまま待たされる場合を合否に含めるかどうかにあたる。",
        'The job from "Hiding reveals divergence" slips past both trace refinement and failures refinement. Failures refinement counts refusals only in stable states where no τ can happen, so the time spent looping is not compared at all. In test terms, it is the question of whether waiting forever for a response counts towards pass or fail.',
      ),
      t(
        "図では、検査器のカードが比べ方を順に当てていき、失敗発散で初めて反例が出る所を追う。後半は、発散する仕様に当てると何でも合格になる場面と、リトライに上限を付けた実装に合わせて仕様を直す場面を見る。",
        "In the diagram, follow the checker card as it applies each comparison in turn, until failures-divergences produces the first counterexample. Later, see how anything passes against a diverging spec, and how the spec is fixed to match an implementation with a retry limit.",
      ),
    ],
    facts: [
      {
        label: "Spec ⊑T Impl",
        value: holdsText(UNLIMITED_RESULT.traces.holds),
        tone: UNLIMITED_RESULT.traces.holds ? "ok" : "bad",
      },
      {
        label: "Spec ⊑F Impl",
        value: holdsText(UNLIMITED_RESULT.failures.holds),
        tone: UNLIMITED_RESULT.failures.holds ? "ok" : "bad",
      },
      {
        label: "Spec ⊑FD Impl",
        value: holdsText(UNLIMITED_RESULT.fd.holds),
        tone: UNLIMITED_RESULT.fd.holds ? "ok" : "bad",
      },
      { label: t("⊑FD の反例", "⊑FD counterexample"), value: fdCounter, tone: "bad" },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 6.4節（失敗発散方式）`,
          `${CSP_BOOK_EN}, section 6.4 (failures-divergences model)`,
        ),
      },
    ],
    actors: [
      {
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: t("いつか成功して終わる", "eventually succeeds"),
        icon: "spec",
        x: 14,
        y: 27,
      },
      {
        id: "impl",
        label: t("実装", "Implementation"),
        sublabel: t("隠したリトライ", "hidden retries"),
        icon: "job",
        x: 50,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "bounded",
        label: t(`上限${BOUNDED_RETRIES}回の実装`, `Limit-${BOUNDED_RETRIES} impl`),
        sublabel: t("使い切ると giveup", "giveup when used up"),
        icon: "job",
        x: 86,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("3種類の比べ方", "three comparisons"),
        icon: "checker",
        x: 50,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "chaos",
        label: t("発散する仕様", "Diverging spec"),
        sublabel: t("t を隠した輪", "loop with t hidden"),
        icon: "visited",
        x: 14,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "checker", to: "spec" },
      { from: "checker", to: "impl" },
      { from: "checker", to: "bounded" },
      { from: "checker", to: "chaos" },
    ],
    steps: [
      {
        id: "spec",
        kind: "spec",
        title: t("成功して終わる仕様", "A spec that succeeds and ends"),
        actor: "spec",
        summary: t(
          "仕様 succeed → SKIP: succeed（成功）を起こして正しく終わる",
          "Spec succeed → SKIP: performs succeed and terminates properly",
        ),
        explain: t(
          "呼び出し側が期待するのは「いつか成功して終わる」こと。仕様は succeed を1回起こし、SKIP（正しく終わる合図 ✓ を出すプロセス）で終わる。途中で何も起きないまま待たされることは無い。",
          "What the caller expects is that it eventually succeeds and ends. The spec performs succeed once and ends with SKIP (the process that signals proper termination with ✓). It never keeps you waiting with nothing happening.",
        ),
        set: {
          spec: {
            tone: "ok",
            rows: {
              [t("起こす", "does")]: "succeed",
              [t("その後", "then")]: t("終わる", "terminates"),
            },
          },
        },
        detail: [
          {
            title: t("このサイトの書き方", "Notation on this site"),
            fields: [{ label: "Spec", value: "succeed → SKIP", isCode: true }],
          },
        ],
        simplified: t(
          "式はこのサイトのモデル（csp.ts）に合わせた短い書き方で、実物の CSPM（FDR の記法）とは書き方が違う。",
          "The expression is a short form matching this site's model (csp.ts) and differs from real CSPM (the notation used by FDR).",
        ),
      },
      {
        id: "impl",
        kind: "spec",
        title: t("実装は隠したリトライ", "The impl: hidden retries"),
        actor: "impl",
        summary: t(
          "start と fail を隠し、何度でもやり直すジョブ",
          "A job that retries any number of times, with start and fail hidden",
        ),
        explain: t(
          `「隠すと見える発散」のジョブを実装として持ってくる。start（開始）と fail（失敗）を隠したので、外から見えるのは${UNLIMITED_VISIBLE.join(" と ")}だけ。失敗し続けると、外からは何も起きないまま中で回り続ける。`,
          `Bring in the job from "Hiding reveals divergence" as the implementation. start and fail are hidden, so only ${UNLIMITED_VISIBLE.join(" and ")} is visible from outside. If it keeps failing, it loops inside while nothing happens outside.`,
        ),
        set: {
          impl: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("見える", "visible")]: t(
                UNLIMITED_VISIBLE.join("・"),
                UNLIMITED_VISIBLE.join(", "),
              ),
              [t("隠した", "hidden")]: t("start・fail", "start, fail"),
              [t("リトライ", "retries")]: t("上限なし", "no limit"),
            },
          },
        },
        detail: [
          {
            title: t("このサイトのモデル", "This site's model"),
            fields: [
              {
                label: "Job",
                value: "start → (succeed → SKIP □ fail → Job)",
                isCode: true,
              },
              { label: "Impl", value: "Job \\ {start, fail}", isCode: true },
            ],
          },
        ],
      },
      {
        id: "traces",
        kind: "explore",
        title: t("トレースでは合格", "Passes on traces"),
        actor: "checker",
        to: ["spec", "impl"],
        summary: t(
          `Spec ⊑T Impl は${holdsText(UNLIMITED_RESULT.traces.holds)}`,
          `Spec ⊑T Impl ${holdsText(UNLIMITED_RESULT.traces.holds)}`,
        ),
        explain: t(
          "実装が外に見せる並びは「何も無い」か「succeed」だけで、どちらも仕様が起こせる。トレース詳細化は起きたことしか見ないので、回り続けて何も起きない実行は、起きた並びが短いだけとみなされる。",
          'The implementation only shows "nothing" or "succeed" to the outside, and the spec can do both. Trace refinement only looks at what happened, so a run that loops with nothing happening is treated as just a short trace.',
        ),
        set: {
          checker: {
            isHidden: false,
            tone: UNLIMITED_RESULT.traces.holds ? "ok" : "bad",
            rows: { "⊑T": holdsText(UNLIMITED_RESULT.traces.holds) },
          },
        },
      },
      {
        id: "failures",
        kind: "explore",
        title: t("失敗でも合格", "Passes on failures too"),
        actor: "checker",
        to: ["spec", "impl"],
        summary: t(
          `Spec ⊑F Impl も${holdsText(UNLIMITED_RESULT.failures.holds)}`,
          `Spec ⊑F Impl also ${holdsText(UNLIMITED_RESULT.failures.holds)}`,
        ),
        explain: t(
          "失敗詳細化は、実装が安定した状態（見えない動き τ がもう起きない状態）で拒否できるイベントを比べる。回り続けている間は τ が起きうるので安定した状態が無く、「succeed を断る」という拒否は1つも数えられない。だから断る様子が見えないまま合格する。",
          'Failures refinement compares the events the implementation can refuse in stable states (where no invisible τ move can happen any more). While it loops, τ can always happen, so there is no stable state and not a single "refuses succeed" is counted. So it passes without ever being seen to refuse.',
        ),
        set: {
          checker: {
            tone: UNLIMITED_RESULT.failures.holds ? "ok" : "bad",
            rows: { "⊑F": holdsText(UNLIMITED_RESULT.failures.holds) },
          },
        },
        simplified: t(
          "このサイトの失敗詳細化は安定失敗モデルで、FDR の [F= と同じく発散を見ない。安定した状態だけで拒否を数えるのはこのモデルの決まりで、検査器の手抜きではない。",
          "This site's failures refinement uses the stable-failures model and, like FDR's [F=, does not look at divergence. Counting refusals only in stable states is a rule of the model, not a shortcut in the checker.",
        ),
      },
      {
        id: "fd-breaks",
        kind: "found",
        title: t("発散で反例になる", "Divergence breaks it"),
        actor: "checker",
        to: ["impl"],
        summary: t(
          `Spec ⊑FD Impl は${holdsText(UNLIMITED_RESULT.fd.holds)}。反例: ${fdCounter}`,
          `Spec ⊑FD Impl ${holdsText(UNLIMITED_RESULT.fd.holds)}. Counterexample: ${fdCounter}`,
        ),
        explain: t(
          `失敗発散詳細化 ⊑FD は、失敗詳細化に「実装が発散できるトレースでは、仕様も発散できること」を足した、いちばん強い比べ方。実装は${afterText(FD_COUNTER.trace, language)} τ だけの輪に入れるが、仕様は発散しないので、ここで破れる。`,
          `Failures-divergences refinement ⊑FD is the strongest comparison: failures refinement plus "wherever the implementation can diverge, the spec can too". The implementation can enter a τ-only loop ${afterText(FD_COUNTER.trace, language)}, but the spec never diverges, so it breaks here.`,
        ),
        set: {
          impl: {
            tone: "bad",
            rows: { [t("中で", "inside")]: t("τ で回り続ける", "loops on τ") },
          },
          checker: {
            tone: UNLIMITED_RESULT.fd.holds ? "ok" : "bad",
            rows: { "⊑FD": holdsText(UNLIMITED_RESULT.fd.holds) },
          },
        },
        detail: [
          {
            title: t("検査器が返した反例", "Counterexample the checker returned"),
            fields: [
              {
                label: t("種類", "Kind"),
                value: t(
                  `${FD_COUNTER.kind}（${KIND_NAMES.ja[FD_COUNTER.kind]}）`,
                  `${FD_COUNTER.kind} (${KIND_NAMES.en[FD_COUNTER.kind]})`,
                ),
              },
              {
                label: t("発散するまでのトレース", "Trace before diverging"),
                value: traceText(FD_COUNTER.trace, language),
              },
            ],
          },
        ],
        simplified: t(
          "同じ組を ProB で確かめ、[T= と [F= は成り立ち [FD= だけ破れることが一致した（specs/csp）。反例の種類（trace・divergence・failure）の分け方は、このサイトの検査器の返し方。",
          "The same pair was checked with ProB, and it agreed that [T= and [F= hold and only [FD= fails (specs/csp). The split into kinds (trace, divergence, failure) is how this site's checker reports counterexamples.",
        ),
      },
      {
        id: "chaos",
        kind: "explore",
        title: t("発散の後は何でもあり", "After divergence, anything goes"),
        actor: "chaos",
        to: ["checker"],
        summary: t(
          `発散する仕様には、x → STOP でも ⊑FD が${holdsText(CHAOS_HOLDS)}。逆向きは${holdsText(CHAOS_REVERSE.holds)}`,
          `Against a diverging spec, ⊑FD ${holdsText(CHAOS_HOLDS)} even for x → STOP. The reverse ${holdsText(CHAOS_REVERSE.holds)}`,
        ),
        explain: t(
          `失敗発散モデルでは、発散した後のふるまいを「何が起きても、何を拒否してもよい」とみなす（発散で厳密）。t を隠した輪の仕様は最初から発散するので、x を起こして止まる実装でも満たす。逆に、発散しない仕様に発散する実装を当てると「${fdCounterText(CHAOS_REVERSE.counterexample, language)}」で破れる。`,
          `The failures-divergences model treats behaviour after divergence as "anything may happen and anything may be refused" (it is divergence-strict). The spec that loops with t hidden diverges from the start, so even an implementation that performs x and stops satisfies it. Conversely, checking a diverging implementation against a non-diverging spec breaks with "${fdCounterText(CHAOS_REVERSE.counterexample, language)}".`,
        ),
        set: {
          chaos: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("仕様にする", "as spec")]: holdsText(CHAOS_HOLDS),
              [t("実装にする", "as impl")]: holdsText(CHAOS_REVERSE.holds),
            },
          },
        },
        detail: [
          {
            title: t("このサイトの書き方", "Notation on this site"),
            fields: [
              { label: "Loop", value: "t → Loop", isCode: true },
              {
                label: t("発散する仕様", "Diverging spec"),
                value: "Loop \\ {t}",
                isCode: true,
              },
              { label: t("実装", "Implementation"), value: "x → STOP", isCode: true },
            ],
          },
        ],
        simplified: t(
          "同じ組を ProB でも確かめ、発散する仕様に対しては何をしても失敗発散詳細化が成り立つことが一致した（specs/csp）。発散した後を「何でもあり」とみなすのは、仕様を書く側が「ここは何も約束しない」と言ったのと同じ扱いになる。",
          'The same pairs were checked with ProB too, and it agreed that against a diverging spec failures-divergences refinement holds whatever the implementation does (specs/csp). Treating behaviour after divergence as "anything goes" is the same as the spec\'s author saying "no promises here".',
        ),
      },
      {
        id: "bound",
        kind: "fix",
        title: t(
          `上限${BOUNDED_RETRIES}回なら通る`,
          `A limit of ${BOUNDED_RETRIES} passes`,
        ),
        actor: "bounded",
        to: ["checker"],
        summary: t(
          `上限付きは元の仕様に「${fdCounterText(BOUNDED_VS_SUCCEED.fd.counterexample, language)}」で破れ、「succeed か giveup」の仕様には ⊑FD が${holdsText(BOUNDED_VS_END.fd.holds)}`,
          `The limited job breaks the original spec with "${fdCounterText(BOUNDED_VS_SUCCEED.fd.counterexample, language)}"; against the "succeed or giveup" spec, ⊑FD ${holdsText(BOUNDED_VS_END.fd.holds)}`,
        ),
        explain: t(
          `リトライを${BOUNDED_RETRIES}回までにすると発散は消えるが、使い切ると giveup（断念）で終わるので、succeed だけの仕様とはトレースで食い違う。仕様を「succeed か giveup で終わる」（どちらかは実装が決める内部選択 ⊓）に直すと、3種類の比べ方がそろって成り立つ。`,
          `Limiting retries to ${BOUNDED_RETRIES} removes the divergence, but when they run out it ends with giveup (give up), so its traces disagree with the succeed-only spec. Change the spec to "end with succeed or giveup" (an internal choice ⊓, decided by the implementation), and all three comparisons hold.`,
        ),
        set: {
          bounded: {
            isHidden: false,
            tone: BOUNDED_VS_END.fd.holds ? "ok" : "bad",
            rows: {
              [t("元の仕様", "original spec")]: holdsText(BOUNDED_VS_SUCCEED.fd.holds),
              [t("直した仕様", "fixed spec")]: holdsText(BOUNDED_VS_END.fd.holds),
            },
          },
          impl: { tone: "idle", rows: { [t("中で", "inside")]: null } },
          checker: {
            tone: BOUNDED_VS_END.fd.holds ? "ok" : "bad",
            rows: {
              "⊑T": fixedText(BOUNDED_VS_END.traces.holds),
              "⊑F": fixedText(BOUNDED_VS_END.failures.holds),
              "⊑FD": fixedText(BOUNDED_VS_END.fd.holds),
            },
          },
        },
        detail: [
          {
            title: t("直した仕様", "Fixed spec"),
            fields: [
              {
                label: "Spec2",
                value: "(succeed → SKIP) ⊓ (giveup → SKIP)",
                isCode: true,
              },
            ],
          },
          {
            title: t(
              `上限${BOUNDED_RETRIES}回の実装と比べた結果`,
              `Results against the limit-${BOUNDED_RETRIES} implementation`,
            ),
            fields: [
              ...comparisonFields("Spec", BOUNDED_VS_SUCCEED, language),
              ...comparisonFields("Spec2", BOUNDED_VS_END, language),
            ],
          },
        ],
        simplified: t(
          "上限付きの実装と「succeed か giveup」の仕様の組も ProB で確かめ、3種類の詳細化がすべて成り立つことと、元の仕様（succeed だけ）にはトレースで破れることが一致した（specs/csp）。テストに置きかえると、「成功するか」だけでなく「決めた回数で必ず結果を返すか」を確かめるタイムアウト付きのテストにあたる。",
          'The pair of the limited implementation and the "succeed or giveup" spec was also checked with ProB, and it agreed that all three refinements hold, and that the original spec (succeed only) breaks on traces (specs/csp). As a test, this corresponds to a test with a timeout that checks not just "does it succeed" but "does it always return a result within the set number of attempts".',
        ),
      },
    ],
    lab: {
      title: t("リトライの上限を変えて比べる", "Compare with different retry limits"),
      hint: t(
        `上限は0〜${MAX_RETRIES}。空欄か「なし」なら上限なし。仕様は「succeed で終わる」（Spec）と「succeed か giveup で終わる」（Spec2）の2つと比べる。`,
        `Limit: 0-${MAX_RETRIES}. Blank or "none" means no limit. It is compared with two specs: "end with succeed" (Spec) and "end with succeed or giveup" (Spec2).`,
      ),
      inputs: [
        {
          id: "retries",
          label: t(
            `リトライの上限（0〜${MAX_RETRIES}、空欄でなし）`,
            `Retry limit (0-${MAX_RETRIES}, blank for none)`,
          ),
          initial: t("なし", "none"),
        },
      ],
      compute: (values): Field[] => {
        const retries = parseRetries(values.retries);
        const impl = jobSystem(retries, true);
        return [
          {
            label: t("上限", "Limit"),
            value:
              retries === null ? t("なし", "none") : t(`${retries}回`, `${retries}`),
          },
          ...comparisonFields("Spec", compare(SUCCEED_SPEC, impl, JOB_ENV), language),
          ...comparisonFields("Spec2", compare(END_SPEC, impl, JOB_ENV), language),
        ];
      },
    },
  };
}
