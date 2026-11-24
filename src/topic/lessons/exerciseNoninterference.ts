import { translator, type Language } from "../../core/i18n";
import type { Lesson, Step } from "../../core/types";
import { acceptsTrace, determinism } from "../csp";
import {
  HELD_CAPACITY,
  lowView,
  NONINTERFERENCE_ENV,
  spoolerSystem,
} from "../cspNoninterference";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

// 演習: 留め置き印刷（送った仕事は、本人がプリンタの前で取り出すまで記憶領域に残る）のプリンタで、
// 2人で共有する記憶領域を通して、高い利用者の動きが低い利用者に漏れるか。
// 既定の図は問題の設定だけを見せ、判定（決定性）も漏れる実行も出さない。答えを入れると、
// 高い利用者が取り出さずに送る実行と、検査器の判定が図に足される。

const HIGH_JOBS = 2;
const HIGH_RUN = Array.from({ length: HIGH_JOBS }, () => "hi.send");
const LOW_RUN = ["lo.send", "lo.send"];

type Translate = (ja: string, en: string) => string;

// 正解の計算。決定性の判定と、高い利用者が動いたとき・動かないときの低い利用者の同じ操作を比べる。
const RESULT = lazy(() => {
  const system = spoolerSystem("held", HIGH_JOBS);
  return {
    determinism: determinism(lowView("held", HIGH_JOBS, "lazy"), NONINTERFERENCE_ENV),
    isLowRunAloneAccepted: acceptsTrace(system, NONINTERFERENCE_ENV, LOW_RUN)
      .isAccepted,
    isLowRunAfterHighAccepted: acceptsTrace(system, NONINTERFERENCE_ENV, [
      ...HIGH_RUN,
      ...LOW_RUN,
    ]).isAccepted,
  };
});

function acceptedText(isAccepted: boolean, t: Translate): string {
  return isAccepted ? t("起こせる", "can happen") : t("起こせない", "cannot happen");
}

const memoryRow = (t: Translate) => t("置いてある仕事", "held jobs");

function setupSteps(t: Translate): Step[] {
  return [
    {
      id: "design",
      kind: "spec",
      title: t("留め置き印刷", "Held printing"),
      actor: "memory",
      to: ["high", "low"],
      summary: t(
        `送った仕事は、本人がプリンタの前で取り出すまで記憶領域に残る。記憶領域は2人で${HELD_CAPACITY}件分`,
        `A job sent stays in the printer's memory until its owner releases it at the printer; the memory holds ${HELD_CAPACITY} jobs between the two`,
      ),
      explain: t(
        `「情報が漏れないか（非干渉）」のプリンタを、留め置き印刷に作り替えた。送った仕事（send）はすぐには刷られず、本人がプリンタの前で取り出したとき（take）に刷られる。受け皿の取り合いは無くなったが、取り出されるのを待つ仕事は、2人で共有する記憶領域に合わせて${HELD_CAPACITY}件までしか置けない。`,
        `The printer from "Does information leak?" is changed to held printing. A job sent (send) is not printed at once; it is printed when its owner releases it at the printer (take). There is no longer a contest for the tray, but jobs waiting to be released share one memory, which holds at most ${HELD_CAPACITY} jobs in all.`,
      ),
      set: {
        memory: {
          rows: {
            [memoryRow(t)]: "0",
            [t("置ける数", "capacity")]: String(HELD_CAPACITY),
          },
        },
      },
    },
    {
      id: "users",
      kind: "spec",
      title: t(`高い利用者は${HIGH_JOBS}回まで`, `High sends up to ${HIGH_JOBS}`),
      actor: "high",
      to: ["memory"],
      summary: t(
        `高い利用者は合わせて${HIGH_JOBS}回まで送り、取り出すかどうかは決まっていない`,
        `The high user sends up to ${HIGH_JOBS} jobs in all and may or may not release them`,
      ),
      explain: t(
        `高い利用者のイベント（hi.send・hi.take）は低い利用者から見えない。高い利用者は合わせて${HIGH_JOBS}回まで送り、いつやめてもよい（Lazy 抽象化で隠す）。低い利用者は lo.send と lo.take だけを見る。`,
        `The high user's events (hi.send, hi.take) are invisible to the low user. The high user sends up to ${HIGH_JOBS} jobs in all and may stop at any time (hidden by lazy abstraction). The low user sees only lo.send and lo.take.`,
      ),
      set: {
        high: { rows: { [t("送れる回数", "jobs")]: String(HIGH_JOBS) } },
        low: { rows: { [t("見えるもの", "sees")]: "lo.*" } },
      },
    },
    {
      id: "question",
      kind: "explore",
      title: t("漏れるか", "Does it leak?"),
      actor: "checker",
      to: ["low"],
      summary: t(
        "高い利用者の動きが、低い利用者の見え方に漏れるかを「はい」か「いいえ」で答える",
        'Answer "yes" or "no": does the high user\'s activity leak into what the low user sees?',
      ),
      explain: t(
        "検査器は、高い利用者のイベントを Lazy 抽象化で隠し、低い利用者から見たプロセスが決定的かを調べる。決定的でなければ漏れる。受け皿の取り合いは無くしたので、漏れないと言えるか。下の「答え合わせ」に入れると、検査器の判定と、その理由になる実行が図に足される。ヒント: 記憶領域が埋まるのはどんなときか。",
        "The checker hides the high user's events by lazy abstraction and checks whether the process the low user sees is deterministic. If it is not, there is a leak. The contest for the tray is gone, so can we say nothing leaks? Answer under \"Check your answer\" below and the checker's verdict and the run behind it are added to this diagram. Hint: when does the memory fill up?",
      ),
      set: {
        checker: {
          isHidden: false,
          tone: "wait",
          rows: { [t("問い", "question")]: t("漏れるか？", "Leak?") },
        },
      },
    },
  ];
}

function solutionSteps(t: Translate): Step[] {
  const result = RESULT();
  const witness = result.determinism.witness;
  const witnessText =
    witness && witness.kind === "refusal"
      ? t(
          `${witness.trace.length > 0 ? `${witness.trace.join(" → ")}の後` : "最初の時点"}に ${witness.event} を断ることがある`,
          `may refuse ${witness.event} ${witness.trace.length > 0 ? `after ${witness.trace.join(" → ")}` : "at the start"}`,
        )
      : t("断る反例なし", "no refusal found");
  return [
    {
      id: "high-fills",
      kind: "run",
      title: t(`高い利用者が${HIGH_JOBS}回送る`, `High sends ${HIGH_JOBS} jobs`),
      actor: "high",
      to: ["memory"],
      summary: t(
        `${HIGH_RUN.join(" → ")}。取り出さないので、記憶領域が高い利用者の仕事で埋まる`,
        `${HIGH_RUN.join(" → ")}. Nothing is released, so the memory fills with the high user's jobs`,
      ),
      explain: t(
        `高い利用者は${HIGH_JOBS}回送って、どちらも取り出さない。記憶領域の${HELD_CAPACITY}件分は高い利用者の仕事でふさがったままになる。`,
        `The high user sends ${HIGH_JOBS} jobs and releases neither. All ${HELD_CAPACITY} places in the memory stay taken by the high user's jobs.`,
      ),
      set: {
        high: { tone: "wait", rows: { [t("送れる回数", "jobs")]: "0" } },
        memory: { tone: "bad", rows: { [memoryRow(t)]: String(HIGH_JOBS) } },
      },
    },
    {
      id: "low-blocked",
      kind: "found",
      title: t("低い利用者が送れない", "The low user is blocked"),
      actor: "low",
      to: ["memory"],
      summary: t(
        `その後の ${LOW_RUN.join(" → ")} は${acceptedText(result.isLowRunAfterHighAccepted, t)}。高い利用者が送らなければ${acceptedText(result.isLowRunAloneAccepted, t)}`,
        `${LOW_RUN.join(" → ")} after that ${acceptedText(result.isLowRunAfterHighAccepted, t)}; if the high user sends nothing it ${acceptedText(result.isLowRunAloneAccepted, t)}`,
      ),
      explain: t(
        "記憶領域に空きが無いので、低い利用者の lo.send は断られる。高い利用者が何もしなければ同じ2回の送信を受け付けるので、低い利用者は断られたことから高い利用者の動きを知れる。",
        "There is no space in the memory, so the low user's lo.send is refused. If the high user does nothing, the same two sends are accepted, so from being refused the low user learns about the high user's activity.",
      ),
      set: {
        low: { tone: "bad", rows: { [t("断られた", "refused")]: "lo.send" } },
      },
    },
    {
      id: "checker-verdict",
      kind: "found",
      title: t("見え方が決定的でない", "The low view is nondeterministic"),
      actor: "checker",
      to: ["low"],
      summary: t(
        `検査器の判定: ${result.determinism.isDeterministic ? "決定的" : "決定的でない"}（${witnessText}）`,
        `The checker says: ${result.determinism.isDeterministic ? "deterministic" : "not deterministic"} (${witnessText})`,
      ),
      explain: t(
        "受け皿の取り合いを無くしても、取り出しを待つ仕事の置き場所を2人で共有しているので、高い利用者が取り出さないことが低い利用者まで伝わる。漏れを断つには、置き場所を利用者ごとに分ける（高い利用者に何件、低い利用者に何件と決めておく）。",
        "Removing the contest for the tray is not enough: the two still share the space where jobs wait to be released, so the high user not releasing reaches the low user. To cut the leak, split that space per user (fix in advance how many jobs each may hold).",
      ),
      set: {
        checker: {
          tone: result.determinism.isDeterministic ? "ok" : "bad",
          rows: {
            [t("問い", "question")]: null,
            [t("判定", "verdict")]: result.determinism.isDeterministic
              ? t("決定的", "deterministic")
              : t("決定的でない", "nondeterministic"),
          },
        },
      },
    },
  ];
}

export function exerciseNoninterferenceLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-noninterference",
      title: t("演習: 漏れるか", "Exercise: does it leak?"),
      subtitle: t(
        "留め置き印刷のプリンタで、高い利用者の動きは漏れるか",
        "With held printing, does the high user's activity leak?",
      ),
      summary: t(
        "送った仕事を本人が取り出すまで共有の記憶領域に置く留め置き印刷のプリンタで、高い利用者の動きが低い利用者に漏れるかを答える。答えを入れると、漏れる実行と検査器の判定を図で追える。",
        "For a held-printing printer, where a job waits in shared memory until its owner releases it, answer whether the high user's activity leaks to the low user. Once you answer, you can follow the run that leaks and the checker's verdict in the diagram.",
      ),
      intro: [
        t(
          "「情報が漏れないか（非干渉）」で見たプリンタの続きである。そこでは受け皿の取り合いが漏れの道だった。ここでは受け皿の取り合いを無くし、送った仕事を本人が取り出すまでプリンタの記憶領域に置く。図はまず問題の設定だけを見せ、判定は答えるまで出さない。",
          'This continues the printer from "Does information leak?", where the contest for the tray was the path of the leak. Here that contest is gone: a job sent waits in the printer\'s memory until its owner releases it. The diagram first shows only the setup and keeps the verdict hidden until you answer.',
        ),
        t(
          "下の「答え合わせ」に「はい」か「いいえ」を入れると、高い利用者が取り出さずに送る実行と、検査器の判定が図に足される。「図で見る」を押して、記憶領域のカードがどう埋まるかを追う。",
          'Enter "yes" or "no" under "Check your answer" and the run where the high user sends without releasing, plus the checker\'s verdict, are added to the diagram. Press "Show the diagram" and follow how the memory card fills up.',
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t("留め置き印刷のプリンタ", "A held-printing printer"),
        },
        { label: t("答え方", "How to answer"), value: t("はい／いいえ", "yes / no") },
        {
          label: t("出題範囲", "Covers"),
          value: t("情報が漏れないか（非干渉）", '"Does information leak?"'),
        },
        {
          label: t("参考", "Reference"),
          value: t(
            `${TPC_BOOK} 12.4節（資源の取り合いで漏れる類型）`,
            `${TPC_BOOK_EN}, §12.4 (the kind of leak through contention for a resource)`,
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
          id: "memory",
          label: t("記憶領域", "Memory"),
          sublabel: t("取り出しを待つ仕事", "jobs awaiting release"),
          icon: "database",
          x: 50,
          y: 50,
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
        { from: "high", to: "memory" },
        { from: "low", to: "memory" },
        { from: "checker", to: "memory" },
      ],
      answerType: "yesno",
      answerLabel: t("あなたの答え（漏れるか）", "Your answer (does it leak?)"),
      hint: t(
        "漏れるなら「はい」、漏れないなら「いいえ」を入れる。入れると、図に正解の手順が足される。",
        'Enter "yes" if it leaks and "no" if not. The steps of the answer are then added to the diagram.',
      ),
      verdictActor: "checker",
      setupSteps: setupSteps(t),
      solve: () => {
        const result = RESULT();
        const leaks = !result.determinism.isDeterministic;
        return {
          answer: leaks,
          reason: leaks
            ? t(
                "受け皿の取り合いを無くしても、取り出しを待つ仕事の記憶領域を2人で共有している。高い利用者が取り出さないと記憶領域が埋まり、低い利用者の送信が断られるので、低い利用者の見え方は決定的でなく、漏れる。",
                "Removing the contest for the tray still leaves the two sharing the memory where jobs wait. If the high user does not release, the memory fills and the low user's send is refused, so the low view is not deterministic: it leaks.",
              )
            : t(
                "低い利用者の見え方は決定的で、高い利用者が何をしても変わらないので、漏れない。",
                "The low view is deterministic and does not change whatever the high user does, so nothing leaks.",
              ),
        };
      },
      solutionSteps: () => solutionSteps(t),
    },
    language,
  );
}
