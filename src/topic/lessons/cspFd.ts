import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
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

const KIND_NAMES: Record<FdCounterexample["kind"], string> = {
  trace: "仕様に無いトレース",
  divergence: "発散",
  failure: "仕様に無い拒否",
};

function holdsText(holds: boolean): string {
  return holds ? "成り立つ" : "成り立たない";
}

function traceText(trace: string[]): string {
  return trace.length > 0 ? `⟨${trace.join(", ")}⟩` : "⟨⟩（最初の時点）";
}

/** 「そのトレースの後で」を、最初の時点なら「最初の時点で」と書く。 */
function afterText(trace: string[]): string {
  return trace.length > 0 ? `⟨${trace.join(", ")}⟩ の後で` : "最初の時点で";
}

function fdCounterText(counter: FdCounterexample | null): string {
  if (!counter) return "なし";
  switch (counter.kind) {
    case "trace":
      return `仕様に無いトレース${traceText(counter.trace)}`;
    case "divergence":
      return `${afterText(counter.trace)}発散できる`;
    case "failure":
      return `${afterText(counter.trace)} {${counter.refusal.join(", ")}}を拒否できる`;
  }
}

function parseRetries(text: string | undefined): number | null {
  const trimmed = (text ?? "").trim();
  if (trimmed === "" || trimmed === "なし") return null;
  const n = Number.parseInt(trimmed, 10);
  // 読めない入力は既定の「上限なし」に戻す
  if (Number.isNaN(n)) return null;
  return Math.min(MAX_RETRIES, Math.max(0, n));
}

function comparisonFields(name: string, result: Comparison): Field[] {
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
      label: `${name}の ⊑FD の反例`,
      value: fdCounterText(result.fd.counterexample),
      tone: result.fd.counterexample ? "bad" : "ok",
    },
  ];
}

export const cspFdLesson: Lesson = {
  id: "csp-fd",
  category: "csp",
  title: "発散まで含めて比べる",
  subtitle: "トレースと拒否で合格でも、回り続ける実装は落とす",
  summary: `隠したリトライは「いつか成功して終わる」仕様を ⊑T でも ⊑F でも満たすが、失敗発散詳細化 ⊑FD では「${fdCounterText(FD_COUNTER)}」が反例になる。`,
  intro: [
    "失敗発散詳細化（⊑FD）は、失敗詳細化に「実装が発散してよいのは、仕様も発散するトレースだけ」という条件を足した比べ方だ。トレース・失敗・失敗発散の順に厳しくなる。",
    "「隠すと見える発散」のジョブは、トレース詳細化でも失敗詳細化でも見逃される。失敗詳細化は τ が起きない安定した状態でしか拒否を数えないので、回り続けている間のことが比べる対象に入らないからだ。テストで言えば、応答が返らないまま待たされる場合を合否に含めるかどうかにあたる。",
    "図では、検査器のカードが比べ方を順に当てていき、失敗発散で初めて反例が出る所を追う。後半は、発散する仕様に当てると何でも合格になる場面と、リトライに上限を付けた実装に合わせて仕様を直す場面を見る。",
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
    { label: "⊑FD の反例", value: fdCounterText(FD_COUNTER), tone: "bad" },
    { label: "参考文献", value: `${CSP_BOOK} 6.4節（失敗発散方式）` },
  ],
  actors: [
    {
      id: "spec",
      label: "仕様",
      sublabel: "いつか成功して終わる",
      icon: "spec",
      x: 14,
      y: 27,
    },
    {
      id: "impl",
      label: "実装",
      sublabel: "隠したリトライ",
      icon: "job",
      x: 50,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "bounded",
      label: `上限${BOUNDED_RETRIES}回の実装`,
      sublabel: "使い切ると giveup",
      icon: "job",
      x: 86,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "3種類の比べ方",
      icon: "checker",
      x: 50,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "chaos",
      label: "発散する仕様",
      sublabel: "t を隠した輪",
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
      title: "成功して終わる仕様",
      actor: "spec",
      summary: "仕様 succeed → SKIP: succeed（成功）を起こして正しく終わる",
      explain:
        "呼び出し側が期待するのは「いつか成功して終わる」こと。仕様は succeed を1回起こし、SKIP（正しく終わる合図 ✓ を出すプロセス）で終わる。途中で何も起きないまま待たされることは無い。",
      set: { spec: { tone: "ok", rows: { 起こす: "succeed", その後: "終わる" } } },
      detail: [
        {
          title: "このサイトの書き方",
          fields: [{ label: "Spec", value: "succeed → SKIP", isCode: true }],
        },
      ],
      simplified:
        "式はこのサイトのモデル（csp.ts）に合わせた短い書き方で、実物の CSPM（FDR の記法）とは書き方が違う。",
    },
    {
      id: "impl",
      kind: "spec",
      title: "実装は隠したリトライ",
      actor: "impl",
      summary: "start と fail を隠し、何度でもやり直すジョブ",
      explain: `「隠すと見える発散」のジョブを実装として持ってくる。start（開始）と fail（失敗）を隠したので、外から見えるのは${UNLIMITED_VISIBLE.join(" と ")}だけ。失敗し続けると、外からは何も起きないまま中で回り続ける。`,
      set: {
        impl: {
          isHidden: false,
          tone: "wait",
          rows: {
            見える: UNLIMITED_VISIBLE.join("・"),
            隠した: "start・fail",
            リトライ: "上限なし",
          },
        },
      },
      detail: [
        {
          title: "このサイトのモデル",
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
      title: "トレースでは合格",
      actor: "checker",
      to: ["spec", "impl"],
      summary: `Spec ⊑T Impl は${holdsText(UNLIMITED_RESULT.traces.holds)}`,
      explain:
        "実装が外に見せる並びは「何も無い」か「succeed」だけで、どちらも仕様が起こせる。トレース詳細化は起きたことしか見ないので、回り続けて何も起きない実行は、起きた並びが短いだけとみなされる。",
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
      title: "失敗でも合格",
      actor: "checker",
      to: ["spec", "impl"],
      summary: `Spec ⊑F Impl も${holdsText(UNLIMITED_RESULT.failures.holds)}`,
      explain:
        "失敗詳細化は、実装が安定した状態（見えない動き τ がもう起きない状態）で拒否できるイベントを比べる。回り続けている間は τ が起きうるので安定した状態が無く、「succeed を断る」という拒否は1つも数えられない。だから断る様子が見えないまま合格する。",
      set: {
        checker: {
          tone: UNLIMITED_RESULT.failures.holds ? "ok" : "bad",
          rows: { "⊑F": holdsText(UNLIMITED_RESULT.failures.holds) },
        },
      },
      simplified:
        "このサイトの失敗詳細化は安定失敗モデルで、FDR の [F= と同じく発散を見ない。安定した状態だけで拒否を数えるのはこのモデルの決まりで、検査器の手抜きではない。",
    },
    {
      id: "fd-breaks",
      kind: "found",
      title: "発散で反例になる",
      actor: "checker",
      to: ["impl"],
      summary: `Spec ⊑FD Impl は${holdsText(UNLIMITED_RESULT.fd.holds)}。反例: ${fdCounterText(FD_COUNTER)}`,
      explain: `失敗発散詳細化 ⊑FD は、失敗詳細化に「実装が発散できるトレースでは、仕様も発散できること」を足した、いちばん強い比べ方。実装は${afterText(FD_COUNTER.trace)} τ だけの輪に入れるが、仕様は発散しないので、ここで破れる。`,
      set: {
        impl: { tone: "bad", rows: { 中で: "τ で回り続ける" } },
        checker: {
          tone: UNLIMITED_RESULT.fd.holds ? "ok" : "bad",
          rows: { "⊑FD": holdsText(UNLIMITED_RESULT.fd.holds) },
        },
      },
      detail: [
        {
          title: "検査器が返した反例",
          fields: [
            {
              label: "種類",
              value: `${FD_COUNTER.kind}（${KIND_NAMES[FD_COUNTER.kind]}）`,
            },
            { label: "発散するまでのトレース", value: traceText(FD_COUNTER.trace) },
          ],
        },
      ],
      simplified:
        "同じ組を ProB で確かめ、[T= と [F= は成り立ち [FD= だけ破れることが一致した（specs/csp）。反例の種類（trace・divergence・failure）の分け方は、このサイトの検査器の返し方。",
    },
    {
      id: "chaos",
      kind: "explore",
      title: "発散の後は何でもあり",
      actor: "chaos",
      to: ["checker"],
      summary: `発散する仕様には、x → STOP でも ⊑FD が${holdsText(CHAOS_HOLDS)}。逆向きは${holdsText(CHAOS_REVERSE.holds)}`,
      explain: `失敗発散モデルでは、発散した後のふるまいを「何が起きても、何を拒否してもよい」とみなす（発散で厳密）。t を隠した輪の仕様は最初から発散するので、x を起こして止まる実装でも満たす。逆に、発散しない仕様に発散する実装を当てると「${fdCounterText(CHAOS_REVERSE.counterexample)}」で破れる。`,
      set: {
        chaos: {
          isHidden: false,
          tone: "wait",
          rows: {
            仕様にする: holdsText(CHAOS_HOLDS),
            実装にする: holdsText(CHAOS_REVERSE.holds),
          },
        },
      },
      detail: [
        {
          title: "このサイトの書き方",
          fields: [
            { label: "Loop", value: "t → Loop", isCode: true },
            { label: "発散する仕様", value: "Loop \\ {t}", isCode: true },
            { label: "実装", value: "x → STOP", isCode: true },
          ],
        },
      ],
      simplified:
        "同じ組を ProB でも確かめ、発散する仕様に対しては何をしても失敗発散詳細化が成り立つことが一致した（specs/csp）。発散した後を「何でもあり」とみなすのは、仕様を書く側が「ここは何も約束しない」と言ったのと同じ扱いになる。",
    },
    {
      id: "bound",
      kind: "fix",
      title: `上限${BOUNDED_RETRIES}回なら通る`,
      actor: "bounded",
      to: ["checker"],
      summary: `上限付きは元の仕様に「${fdCounterText(BOUNDED_VS_SUCCEED.fd.counterexample)}」で破れ、「succeed か giveup」の仕様には ⊑FD が${holdsText(BOUNDED_VS_END.fd.holds)}`,
      explain: `リトライを${BOUNDED_RETRIES}回までにすると発散は消えるが、使い切ると giveup（断念）で終わるので、succeed だけの仕様とはトレースで食い違う。仕様を「succeed か giveup で終わる」（どちらかは実装が決める内部選択 ⊓）に直すと、3種類の比べ方がそろって成り立つ。`,
      set: {
        bounded: {
          isHidden: false,
          tone: BOUNDED_VS_END.fd.holds ? "ok" : "bad",
          rows: {
            元の仕様: holdsText(BOUNDED_VS_SUCCEED.fd.holds),
            直した仕様: holdsText(BOUNDED_VS_END.fd.holds),
          },
        },
        impl: { tone: "idle", rows: { 中で: null } },
        checker: {
          tone: BOUNDED_VS_END.fd.holds ? "ok" : "bad",
          rows: {
            "⊑T": `直すと${holdsText(BOUNDED_VS_END.traces.holds)}`,
            "⊑F": `直すと${holdsText(BOUNDED_VS_END.failures.holds)}`,
            "⊑FD": `直すと${holdsText(BOUNDED_VS_END.fd.holds)}`,
          },
        },
      },
      detail: [
        {
          title: "直した仕様",
          fields: [
            {
              label: "Spec2",
              value: "(succeed → SKIP) ⊓ (giveup → SKIP)",
              isCode: true,
            },
          ],
        },
        {
          title: `上限${BOUNDED_RETRIES}回の実装と比べた結果`,
          fields: [
            ...comparisonFields("Spec", BOUNDED_VS_SUCCEED),
            ...comparisonFields("Spec2", BOUNDED_VS_END),
          ],
        },
      ],
      simplified:
        "上限付きの実装と「succeed か giveup」の仕様の組も ProB で確かめ、3種類の詳細化がすべて成り立つことと、元の仕様（succeed だけ）にはトレースで破れることが一致した（specs/csp）。テストに置きかえると、「成功するか」だけでなく「決めた回数で必ず結果を返すか」を確かめるタイムアウト付きのテストにあたる。",
    },
  ],
  lab: {
    title: "リトライの上限を変えて比べる",
    hint: `上限は0〜${MAX_RETRIES}。空欄か「なし」なら上限なし。仕様は「succeed で終わる」（Spec）と「succeed か giveup で終わる」（Spec2）の2つと比べる。`,
    inputs: [
      {
        id: "retries",
        label: `リトライの上限（0〜${MAX_RETRIES}、空欄でなし）`,
        initial: "なし",
      },
    ],
    compute: (values): Field[] => {
      const retries = parseRetries(values.retries);
      const impl = jobSystem(retries, true);
      return [
        { label: "上限", value: retries === null ? "なし" : `${retries}回` },
        ...comparisonFields("Spec", compare(SUCCEED_SPEC, impl, JOB_ENV)),
        ...comparisonFields("Spec2", compare(END_SPEC, impl, JOB_ENV)),
      ];
    },
  },
};
