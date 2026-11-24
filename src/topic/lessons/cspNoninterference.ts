import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { acceptsTrace, type Determinism, determinism } from "../csp";
import {
  type Abstraction,
  type Design,
  HIGH_EVENTS,
  LEAK_RUN,
  lowView,
  NONINTERFERENCE_ENV,
  spoolerSystem,
} from "../cspNoninterference";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

type Translate = (ja: string, en: string) => string;

// 図で使う高い利用者の送る回数。1回で漏れが見える。
const HIGH_JOBS = 1;
const LEAK_EVENT = "lo.send";
// どの判定も数ミリ秒で終わるので、最上位で1回ずつ計算する。
const SHARED_LAZY = determinism(
  lowView("shared", HIGH_JOBS, "lazy"),
  NONINTERFERENCE_ENV,
);
const SHARED_EAGER = determinism(
  lowView("shared", HIGH_JOBS, "eager"),
  NONINTERFERENCE_ENV,
);
const SEPARATE_LAZY = determinism(
  lowView("separate", HIGH_JOBS, "lazy"),
  NONINTERFERENCE_ENV,
);
const SHARED_IDLE = determinism(lowView("shared", 0, "lazy"), NONINTERFERENCE_ENV);
const SHARED_SYSTEM = spoolerSystem("shared", HIGH_JOBS);
const AFTER_LEAK_BLOCKED = !acceptsTrace(SHARED_SYSTEM, NONINTERFERENCE_ENV, [
  ...LEAK_RUN,
  LEAK_EVENT,
]).isAccepted;
const AFTER_TAKE_ACCEPTED = acceptsTrace(SHARED_SYSTEM, NONINTERFERENCE_ENV, [
  ...LEAK_RUN,
  "hi.take",
  LEAK_EVENT,
]).isAccepted;
if (!SHARED_LAZY.witness || SHARED_LAZY.witness.kind !== "refusal") {
  throw new Error("受け皿が1つの設計で、断る反例が見つからない");
}
const WITNESS = SHARED_LAZY.witness;

function traceText(trace: string[], t: Translate): string {
  return trace.length > 0
    ? t(`${trace.join(" → ")}の後`, `after ${trace.join(" → ")}`)
    : t("最初の時点", "at the start");
}

function verdictText(result: Determinism, t: Translate): string {
  return result.isDeterministic
    ? t("決定的（漏れない）", "deterministic (no leak)")
    : t("決定的でない（漏れる）", "not deterministic (leaks)");
}

/** 漏れの判定に使えない比べ方（Eager・高い利用者が動かない）の結果。「漏れない」とは言えないので、決定性だけを書く。 */
function plainText(result: Determinism, t: Translate): string {
  return result.isDeterministic
    ? t("決定的", "deterministic")
    : t("決定的でない", "not deterministic");
}

function witnessText(result: Determinism, t: Translate): string | null {
  const witness = result.witness;
  if (!witness) return null;
  if (witness.kind === "divergence") {
    return t(
      `${traceText(witness.trace, t)}に発散する`,
      `diverges ${traceText(witness.trace, t)}`,
    );
  }
  return t(
    `${traceText(witness.trace, t)}に ${witness.event} を断ることがある`,
    `may refuse ${witness.event} ${traceText(witness.trace, t)}`,
  );
}

function parseDesign(text: string | undefined): Design {
  // 「分ける」（英語は separate）と書いたときだけ受け皿を分ける。それ以外は既定の1つに戻す。
  const word = (text ?? "").trim().toLowerCase();
  return word.includes("分") || word.startsWith("sep") ? "separate" : "shared";
}

function parseAbstraction(text: string | undefined): Abstraction {
  // 「Eager」と書いたときだけ、ただの隠蔽にする。それ以外は既定の Lazy に戻す。
  return (text ?? "").toLowerCase().includes("eager") ? "eager" : "lazy";
}

function parseJobs(text: string | undefined): number {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return HIGH_JOBS;
  return Math.min(Math.max(value, 0), 3);
}

export function cspNoninterferenceLesson(language: Language): Lesson {
  const t = translator(language);
  const tray = t("受け皿", "tray");
  const shared = verdictText(SHARED_LAZY, t);
  return {
    id: "csp-noninterference",
    category: "apply",
    title: t("情報が漏れないか（非干渉）", "Does information leak?"),
    subtitle: t(
      "高い利用者の動きが、低い利用者の見え方を変えないか",
      "Can the high user's activity change what the low user sees?",
    ),
    summary: t(
      `2人で使うプリンタで、高い利用者のイベントを Lazy 抽象化で隠し、低い利用者から見たプロセスが決定的かを調べる。受け皿が1つだと${witnessText(SHARED_LAZY, t)}ので、${shared}。受け皿を分けると${verdictText(SEPARATE_LAZY, t)}。`,
      `For a printer used by two people, hide the high user's events by lazy abstraction and check whether the process the low user sees is deterministic. With one tray it is ${shared}: it ${witnessText(SHARED_LAZY, t)}. With separate trays it is ${verdictText(SEPARATE_LAZY, t)}.`,
    ),
    intro: [
      t(
        "非干渉（独立性）は、機密を扱う高い利用者の動きが、低い利用者に伝わらないことを言う。CSP では、高い利用者のイベントを Lazy 抽象化（いつ止まってもよい環境と組ませてから隠す）で見えなくし、低い利用者から見たプロセスが決定的かで判定する。決定的なら、高い利用者が何をしても低い利用者の見え方は1通りで、そこから何も読み取れない。",
        "Non-interference (independence) means the activity of a high user, who handles secrets, does not reach a low user. In CSP you hide the high user's events by lazy abstraction (pair them with an environment that may stop at any time, then hide them) and check whether the process the low user sees is deterministic. If it is, the low user sees one behaviour whatever the high user does, so there is nothing to read from it.",
      ),
      t(
        "テストでは漏れは見つけにくい。低い利用者の操作がたまたま断られても、高い利用者が同時に何をしていたかまで記録して比べることは少なく、高い利用者が動いていない環境では漏れの道そのものが現れない。ここでは、高い利用者が紙を取らないだけで低い利用者が送れなくなる、という資源の取り合いを取り上げる。",
        "Tests rarely find leaks. When a low user's request happens to be refused, few tests also record what the high user was doing at that moment, and in an environment where the high user is idle the leak does not appear at all. Here we take a contest for a resource: the low user cannot send just because the high user has not taken their paper.",
      ),
      t(
        "図では「受け皿」のカードが誰の紙を載せているかと、「検査器」の判定を追う。後半で受け皿を分けた設計と比べ、どこが漏れの道だったかを確かめる。",
        "In the diagram, follow whose paper the Tray card is holding and the Checker's verdict. In the second half, compare with the design that separates the trays and see which part was the path of the leak.",
      ),
    ],
    facts: [
      {
        label: t("受け皿が1つ", "One tray"),
        value: shared,
        tone: SHARED_LAZY.isDeterministic ? "ok" : "bad",
      },
      {
        label: t("受け皿を分ける", "Separate trays"),
        value: verdictText(SEPARATE_LAZY, t),
        tone: SEPARATE_LAZY.isDeterministic ? "ok" : "bad",
      },
      {
        label: t("ただ隠すと（Eager）", "Just hiding (eager)"),
        value: t(
          `${plainText(SHARED_EAGER, t)}（受け皿が1つでも）`,
          `${plainText(SHARED_EAGER, t)} (even with one tray)`,
        ),
      },
      {
        label: t("参考", "Reference"),
        value: t(
          `${TPC_BOOK} 12.4節（資源の取り合いで漏れる類型）・12.1節（Lazy 抽象化）`,
          `${TPC_BOOK_EN}, §12.4 (the kind of leak through contention for a resource), §12.1 (lazy abstraction)`,
        ),
      },
    ],
    actors: [
      {
        id: "high",
        label: t("高い利用者", "High user"),
        sublabel: "hi.send / hi.take",
        icon: "person",
        x: 14,
        y: 27,
      },
      {
        id: "low",
        label: t("低い利用者", "Low user"),
        sublabel: "lo.send / lo.take",
        icon: "person",
        x: 14,
        y: 73,
      },
      {
        id: "tray",
        label: t("受け皿", "Tray"),
        sublabel: t("刷った紙を置く", "holds printouts"),
        icon: "queue",
        x: 50,
        y: 50,
        initial: { rows: { [t("載せている紙", "holding")]: t("なし", "none") } },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("低い側の見え方を調べる", "checks the low view"),
        icon: "checker",
        x: 86,
        y: 50,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "high", to: "tray" },
      { from: "low", to: "tray" },
      { from: "checker", to: "tray" },
    ],
    steps: [
      {
        id: "setup",
        kind: "spec",
        title: t("2人で使うプリンタ", "A shared printer"),
        actor: "tray",
        to: ["high", "low"],
        summary: t(
          `送る（send）と刷られて${tray}に載り、取る（take）と${tray}が空く`,
          "Sending (send) prints onto the tray; taking (take) empties it",
        ),
        explain: t(
          `高い利用者と低い利用者が1台のプリンタを使う。送った仕事は刷られて${tray}に載り、本人が取るまで${tray}に残る。${tray}は1つで、紙が載っている間はどちらも次を送れない。低い利用者は高い利用者のイベント（${HIGH_EVENTS.join("・")}）を見られない。`,
          `A high user and a low user share one printer. A job is printed onto the tray and stays there until its owner takes it. There is one tray, and while paper is on it neither can send the next job. The low user cannot see the high user's events (${HIGH_EVENTS.join(", ")}).`,
        ),
        set: {
          high: { rows: { [t("送れる回数", "jobs")]: String(HIGH_JOBS) } },
          low: { rows: { [t("見えるもの", "sees")]: "lo.*" } },
        },
        simplified: t(
          `高い利用者が送るのは合わせて${HIGH_JOBS}回までにし、高い側を${HIGH_JOBS}回までに限った系について調べた（本の定義そのものではない）。回数を限らないと、隠した高いイベントだけで回る輪（発散）ができ、このサイトの決定性の判定（発散も非決定的に数える）が漏れと関係なく「決定的でない」になるため。本や FDR は、発散を見ない安定失敗モデルで決定性を調べる。`,
          `The high user sends at most ${HIGH_JOBS} job${HIGH_JOBS === 1 ? "" : "s"} in all, so what is checked is the system with the high side limited to ${HIGH_JOBS} (not the book's definition itself). Without a limit, the hidden high events alone would form a loop (divergence), and this site's determinism check, which also counts divergence as nondeterminism, would say "not deterministic" for reasons unrelated to the leak. The book and FDR check determinism in the stable failures model, which ignores divergence.`,
        ),
      },
      {
        id: "high-sends",
        kind: "run",
        title: t("高い利用者が送る", "The high user sends"),
        actor: "high",
        to: ["tray"],
        summary: t(
          `${LEAK_RUN.join(" → ")} で高い利用者の紙が${tray}に載り、取られないまま残る`,
          `On ${LEAK_RUN.join(" → ")} the high user's paper lands on the tray and is not taken`,
        ),
        explain: t(
          `高い利用者は送ったが、紙を取りに来ない。${tray}は高い利用者の紙を載せたまま、次の仕事を受け付けない。`,
          "The high user has sent a job but does not come to take it. The tray keeps holding the high user's paper and accepts no further job.",
        ),
        set: {
          high: { tone: "wait", rows: { [t("送れる回数", "jobs")]: "0" } },
          tray: {
            tone: "wait",
            rows: {
              [t("載せている紙", "holding")]: t("高い利用者の紙", "high's paper"),
            },
          },
        },
      },
      {
        id: "low-blocked",
        kind: "found",
        title: t("低い利用者が送れない", "The low user is blocked"),
        actor: "low",
        to: ["tray"],
        summary: t(
          `${LEAK_EVENT} を${AFTER_LEAK_BLOCKED ? "起こせない" : "起こせる"}。高い利用者が取った後なら${AFTER_TAKE_ACCEPTED ? "起こせる" : "起こせない"}`,
          `${LEAK_EVENT} ${AFTER_LEAK_BLOCKED ? "cannot happen" : "can happen"}; after the high user takes the paper it ${AFTER_TAKE_ACCEPTED ? "can" : "cannot"}`,
        ),
        explain: t(
          `低い利用者には高い利用者の動きは見えないが、自分の ${LEAK_EVENT} が断られることは分かる。断られたかどうかで「高い利用者が紙を取らずにいる」ことを知れるので、取る・取らないを使えば、高い利用者が低い利用者へ1ビットずつ合図を送れる（隠れた通信路）。`,
          `The low user cannot see the high user's activity, but can tell that their own ${LEAK_EVENT} is refused. Being refused tells them the high user is leaving their paper on the tray, so by taking or not taking, the high user can signal one bit at a time to the low user (a covert channel).`,
        ),
        set: {
          low: { tone: "bad", rows: { [t("断られた", "refused")]: LEAK_EVENT } },
        },
      },
      {
        id: "lazy",
        kind: "explore",
        title: t("高いイベントを Lazy で隠す", "Hide high events lazily"),
        actor: "checker",
        to: ["high"],
        summary: t(
          "高い利用者のイベントを、いつ止まってもよい環境と組ませてから隠す",
          "Pair the high user's events with an environment that may stop at any time, then hide them",
        ),
        explain: t(
          "Lazy 抽象化は、隠すイベントをいつでも起こせるが、いつでも止まって全部を断れる環境と同期させてから隠す。これで「高い利用者が何をするか、いつやめるか」を全部の可能性として含めた、低い利用者だけの見え方ができる。",
          "Lazy abstraction synchronises the hidden events with an environment that can perform them at any time but can also stop and refuse them all at any time, then hides them. This gives the low user's view alone, covering every possibility of what the high user does and when they stop.",
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("隠す", "hides")]: HIGH_EVENTS.join(", "),
              [t("方法", "method")]: "Lazy",
            },
          },
          high: { tone: "idle" },
        },
      },
      {
        id: "not-deterministic",
        kind: "found",
        title: t("見え方が決定的でない", "The low view is nondeterministic"),
        actor: "checker",
        to: ["low"],
        summary: t(
          `${traceText(WITNESS.trace, t)}に、${WITNESS.event} を受け付けることも断ることもある`,
          `${traceText(WITNESS.trace, t).replace(/^./, (c) => c.toUpperCase())}, ${WITNESS.event} may be accepted or refused`,
        ),
        explain: t(
          `同じ見え方（${traceText(WITNESS.trace, t)}）なのに、${WITNESS.event} を受け付ける場合と断る場合がある。どちらになるかを決めているのは、低い利用者からは見えない高い利用者の動きなので、低い利用者の見え方に高い利用者の動きが漏れている。`,
          `With the same view (${traceText(WITNESS.trace, t)}), ${WITNESS.event} is sometimes accepted and sometimes refused. What decides it is the high user's activity, which the low user cannot see, so the high user's activity leaks into the low user's view.`,
        ),
        set: {
          checker: {
            tone: SHARED_LAZY.isDeterministic ? "ok" : "bad",
            rows: { [t("判定", "verdict")]: shared },
          },
        },
      },
      {
        id: "eager",
        kind: "explore",
        title: t("ただ隠すと見えない", "Just hiding misses it"),
        actor: "checker",
        to: ["high"],
        summary: t(
          `Lazy でなくただ隠すと、受け皿が1つでも${plainText(SHARED_EAGER, t)}になり、漏れを見落とす`,
          `Just hiding, not lazily, makes even one tray ${plainText(SHARED_EAGER, t)}, missing the leak`,
        ),
        explain: t(
          "ただ隠す（Eager 抽象化）と、隠した動きは見えない動き（τ）になり、必ず先へ進むとみなされる。つまり「高い利用者は必ず紙を取る」と当てにしてしまい、取らずに居座る場合が判定から消える。漏れを調べるときは、高い利用者がいつやめてもよい Lazy を使う。",
          "Just hiding (eager abstraction) turns the hidden activity into invisible moves (τ), which are assumed always to go ahead. That counts on the high user always taking the paper, so the case where they leave it there drops out of the check. To look for leaks, use lazy abstraction, where the high user may stop at any time.",
        ),
        set: {
          checker: {
            tone: SHARED_EAGER.isDeterministic ? "wait" : "bad",
            rows: {
              [t("方法", "method")]: "Eager",
              [t("判定", "verdict")]: plainText(SHARED_EAGER, t),
            },
          },
        },
      },
      {
        id: "separate",
        kind: "fix",
        title: t("受け皿を分ける", "Separate the trays"),
        actor: "tray",
        to: ["high", "low"],
        summary: t(
          `受け皿を利用者ごとに分けると、Lazy で${verdictText(SEPARATE_LAZY, t)}`,
          `With a tray for each user, lazy abstraction gives ${verdictText(SEPARATE_LAZY, t)}`,
        ),
        explain: t(
          `刷る機械は共有のまま、紙を置く受け皿だけを分けた。高い利用者が紙を取らなくても埋まるのは自分の受け皿だけで、低い利用者の送る・取るはいつでも同じに進む。刷る動きは一瞬で終わり、機械を持ち続けないので、共有していても漏れの道にならない。`,
          "The printing engine is still shared; only the trays are separated. If the high user leaves their paper, only their own tray fills, and the low user's send and take always proceed the same way. Printing finishes at once and never holds the engine, so sharing it is not a path for leaks.",
        ),
        set: {
          tray: {
            tone: "ok",
            rows: {
              [t("載せている紙", "holding")]: t("利用者ごとに分けた", "one per user"),
            },
          },
          low: { tone: "ok", rows: { [t("断られた", "refused")]: null } },
          checker: {
            tone: SEPARATE_LAZY.isDeterministic ? "ok" : "bad",
            rows: {
              [t("方法", "method")]: "Lazy",
              [t("判定", "verdict")]: verdictText(SEPARATE_LAZY, t),
            },
          },
        },
      },
      {
        id: "idle-high",
        kind: "test",
        title: t("高い側が動かないと", "If the high user is idle"),
        actor: "high",
        to: ["checker"],
        summary: t(
          `高い利用者が1回も送らなければ、受け皿が1つでも${plainText(SHARED_IDLE, t)}になる`,
          `If the high user never sends, even one tray comes out ${plainText(SHARED_IDLE, t)}`,
        ),
        explain: t(
          "高い利用者を動かさない環境で調べると、受け皿が1つの設計でも漏れは現れない。テスト環境で低い利用者の操作だけを試しても、この漏れの道は見つからない。高い利用者が「どう動いても」を含めて調べるのが、Lazy 抽象化と決定性の判定の役目である。",
          "Checked in an environment where the high user does nothing, even the one-tray design shows no leak. Trying only the low user's actions in a test environment will not find this path. Covering whatever the high user might do is exactly what lazy abstraction and the determinism check are for.",
        ),
        set: {
          high: { tone: "idle", rows: { [t("送れる回数", "jobs")]: "0" } },
          checker: {
            tone: SHARED_IDLE.isDeterministic ? "wait" : "bad",
            rows: {
              [t("受け皿", "tray")]: t("1つ", "one"),
              [t("判定", "verdict")]: plainText(SHARED_IDLE, t),
            },
          },
        },
        simplified: t(
          "この判定は、低い利用者の見え方が決定的であることを「漏れない」の条件にしている（本の lazy independence）。高い利用者がいなくても低い利用者の側がもともと非決定的なシステムでは、この条件は厳しすぎて使えない。時間（何秒待たされたか）による漏れは、時間を入れないこのモデルでは見えない。",
          'This check takes "the low user\'s view is deterministic" as the condition for no leak (lazy independence in the book). For a system that is nondeterministic on the low side even without a high user, the condition is too strict to use. Leaks through timing (how long someone waits) cannot be seen in this model, which has no time.',
        ),
      },
    ],
    lab: {
      title: t("設計と隠し方を変える", "Change the design and the abstraction"),
      hint: t(
        "受け皿（「1つ」か「分ける」）、高い利用者が送る回数（0〜3）、隠し方（Lazy か Eager）を入れる。受け皿が1つで高い利用者が1回以上送り、Lazy で隠したときだけ漏れが見える。",
        'Enter the trays ("shared" or "separate"), how many jobs the high user sends (0-3) and the abstraction (lazy or eager). A leak shows only with one tray, at least one high job and lazy abstraction.',
      ),
      inputs: [
        { id: "design", label: t("受け皿", "Trays"), initial: t("1つ", "shared") },
        { id: "jobs", label: t("送る回数", "High jobs"), initial: String(HIGH_JOBS) },
        { id: "abstraction", label: t("隠し方", "Abstraction"), initial: "Lazy" },
      ],
      compute: (values): Field[] => {
        const design = parseDesign(values.design);
        const jobs = parseJobs(values.jobs);
        const abstraction = parseAbstraction(values.abstraction);
        const result = determinism(
          lowView(design, jobs, abstraction),
          NONINTERFERENCE_ENV,
        );
        const fields: Field[] = [
          {
            label: t("調べた設定", "Setting"),
            value: t(
              `受け皿${design === "shared" ? "1つ" : "を分ける"}・${jobs}回・${abstraction === "lazy" ? "Lazy" : "Eager"}`,
              `${design === "shared" ? "one tray" : "separate trays"}, ${jobs} job${jobs === 1 ? "" : "s"}, ${abstraction}`,
            ),
          },
          {
            label: t("低い利用者の見え方", "Low view"),
            value:
              abstraction === "lazy" ? verdictText(result, t) : plainText(result, t),
            tone: result.isDeterministic ? "ok" : "bad",
          },
        ];
        if (abstraction === "eager") {
          fields.push({
            label: t("注意", "Note"),
            value: t(
              "Eager は高い利用者が必ず先へ進むと当てにするので、決定的でも漏れないとは言えない",
              "Eager abstraction counts on the high user always going ahead, so deterministic here does not mean no leak",
            ),
          });
        }
        const witness = witnessText(result, t);
        if (witness)
          fields.push({ label: t("反例", "Counterexample"), value: witness });
        return fields;
      },
    },
  };
}
