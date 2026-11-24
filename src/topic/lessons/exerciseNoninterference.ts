import { translator, type Language } from "../../core/i18n";
import type { Lesson, Step } from "../../core/types";
import { acceptsTrace, determinism } from "../csp";
import { lowView, NONINTERFERENCE_ENV, spoolerSystem } from "../cspNoninterference";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

// 演習: 受け皿を分けても、前に共有の1枠の待ち行列があるプリンタで、高い利用者の動きは低い利用者に漏れるか。
// 既定の図は問題の設定だけを見せ、判定（決定性）も漏れる実行も出さない。答えを入れると、
// 高い利用者が紙を取らずに2回送る実行と、検査器の判定が図に足される。

const HIGH_JOBS = 2;
const HIGH_RUN = Array.from({ length: HIGH_JOBS }, () => "hi.send");
const LOW_RUN = ["lo.send", "lo.send"];

type Translate = (ja: string, en: string) => string;

// 正解の計算。決定性の判定と、高い利用者が動いたとき・動かないときの低い利用者の同じ操作を比べる。
const RESULT = lazy(() => {
  const system = spoolerSystem("queue", HIGH_JOBS);
  return {
    determinism: determinism(lowView("queue", HIGH_JOBS, "lazy"), NONINTERFERENCE_ENV),
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

function setupSteps(t: Translate): Step[] {
  return [
    {
      id: "design",
      kind: "spec",
      title: t("受け皿を分けたプリンタ", "Separate trays, one queue"),
      actor: "slot",
      to: ["engine"],
      summary: t(
        "送った仕事は1枠の待ち行列に入り、機械が取り出して刷り、各自の受け皿に置く",
        "A job sent goes into a one-place queue; the engine takes it out, prints it and puts it on its owner's tray",
      ),
      explain: t(
        "「情報が漏れないか（非干渉）」のプリンタを、受け皿を利用者ごとに分けて作り直した。ただし送った仕事は、まず2人で共有する1枠の待ち行列に入る。機械は待ち行列から仕事を1つ取り出し、刷って持ち主の受け皿に置くまで、次を取り出さない。受け皿に前の紙が残っていると、機械はそこで待つ。",
        'The printer from "Does information leak?" is rebuilt with a tray for each user. But a job sent first goes into a one-place queue that both share. The engine takes one job out of the queue and does not take the next until it has printed it onto its owner\'s tray. If the previous paper is still on that tray, the engine waits there.',
      ),
      set: {
        slot: { rows: { [t("入っている仕事", "holding")]: t("なし", "none") } },
        engine: {
          rows: {
            [t("高い受け皿", "high tray")]: t("空き", "empty"),
            [t("低い受け皿", "low tray")]: t("空き", "empty"),
          },
        },
      },
    },
    {
      id: "users",
      kind: "spec",
      title: t(`高い利用者は${HIGH_JOBS}回まで`, `High sends up to ${HIGH_JOBS}`),
      actor: "high",
      to: ["slot"],
      summary: t(
        `高い利用者は合わせて${HIGH_JOBS}回まで送り、紙を取るかどうかは決まっていない`,
        `The high user sends up to ${HIGH_JOBS} jobs in all and may or may not take the paper`,
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
        "検査器は、高い利用者のイベントを Lazy 抽象化で隠し、低い利用者から見たプロセスが決定的かを調べる。決定的でなければ漏れる。受け皿は分けたので、漏れないと言えるか。下の「答え合わせ」に入れると、検査器の判定と、その理由になる実行が図に足される。ヒント: 機械が仕事を持ったまま待つのはどんなときか。",
        "The checker hides the high user's events by lazy abstraction and checks whether the process the low user sees is deterministic. If it is not, there is a leak. The trays are separate now, so can we say nothing leaks? Answer under \"Check your answer\" below and the checker's verdict and the run behind it are added to this diagram. Hint: when does the engine wait while holding a job?",
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
      to: ["slot", "engine"],
      summary: t(
        `${HIGH_RUN.join(" → ")}。1枚目は高い受け皿に載り、2枚目は機械が持ったまま待つ`,
        `${HIGH_RUN.join(" → ")}. The first lands on the high tray; the engine holds the second and waits`,
      ),
      explain: t(
        "高い利用者は1枚目の紙を取らないまま2回目を送る。機械は2回目の仕事を待ち行列から取り出したが、高い受け皿が埋まっているので置けず、仕事を持ったまま止まる。",
        "The high user sends a second job without taking the first paper. The engine has taken the second job out of the queue, but the high tray is full, so it cannot put it down and stops, holding the job.",
      ),
      set: {
        high: { tone: "wait", rows: { [t("送れる回数", "jobs")]: "0" } },
        engine: {
          tone: "bad",
          rows: {
            [t("高い受け皿", "high tray")]: t("紙が残る", "paper left"),
            [t("持っている仕事", "holding")]: t("高い仕事", "high job"),
          },
        },
      },
    },
    {
      id: "low-blocked",
      kind: "found",
      title: t("低い利用者が詰まる", "The low user gets stuck"),
      actor: "low",
      to: ["slot"],
      summary: t(
        `その後の ${LOW_RUN.join(" → ")} は${acceptedText(result.isLowRunAfterHighAccepted, t)}。高い利用者が送らなければ${acceptedText(result.isLowRunAloneAccepted, t)}`,
        `${LOW_RUN.join(" → ")} after that ${acceptedText(result.isLowRunAfterHighAccepted, t)}; if the high user sends nothing it ${acceptedText(result.isLowRunAloneAccepted, t)}`,
      ),
      explain: t(
        "低い利用者の1回目の仕事は待ち行列に入るが、機械が高い仕事を持ったまま止まっているので取り出されない。待ち行列は1枠なので、2回目の lo.send は断られる。高い利用者が何もしなければ同じ2回の送信を受け付けるので、低い利用者は断られたことから高い利用者の動きを知れる。",
        "The low user's first job goes into the queue, but the engine is stuck holding the high job and never takes it out. The queue has one place, so the second lo.send is refused. If the high user does nothing, the same actions go through, so from being refused the low user learns about the high user's activity.",
      ),
      set: {
        slot: {
          tone: "bad",
          rows: { [t("入っている仕事", "holding")]: t("低い仕事", "low job") },
        },
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
        "受け皿を分けても、その手前で2人が待ち行列と機械を共有し、機械が高い利用者の受け皿の空きを待つので、高い利用者が紙を取らないことが低い利用者まで伝わる。漏れを断つには、待ち行列も利用者ごとに分けるか、機械が仕事を持ったまま待たない作りにする。",
        "Even with separate trays, the two share the queue and the engine in front of them, and the engine waits for space on the high user's tray, so the high user not taking paper reaches the low user. To cut the leak, give each user their own queue too, or build the engine so it never waits while holding a job.",
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
        "受け皿を分けたプリンタで、高い利用者の動きは漏れるか",
        "With separate trays, does the high user's activity leak?",
      ),
      summary: t(
        "受け皿は分けたが、前に共有の1枠の待ち行列があるプリンタで、高い利用者の動きが低い利用者に漏れるかを答える。答えを入れると、漏れる実行と検査器の判定を図で追える。",
        "For a printer with separate trays but a shared one-place queue in front, answer whether the high user's activity leaks to the low user. Once you answer, you can follow the run that leaks and the checker's verdict in the diagram.",
      ),
      intro: [
        t(
          "「情報が漏れないか（非干渉）」で見たプリンタの続きである。受け皿を分ければ漏れは消えた。ここでは受け皿を分けたまま、送った仕事が入る待ち行列を2人で共有する。図はまず問題の設定だけを見せ、判定は答えるまで出さない。",
          'This continues the printer from "Does information leak?". Separating the trays removed the leak there. Here the trays stay separate, but the two share the queue that jobs go into. The diagram first shows only the setup and keeps the verdict hidden until you answer.',
        ),
        t(
          "下の「答え合わせ」に「はい」か「いいえ」を入れると、高い利用者が紙を取らずに送る実行と、検査器の判定が図に足される。「図で見る」を押して、機械と待ち行列のカードがどこで詰まるかを追う。",
          'Enter "yes" or "no" under "Check your answer" and the run where the high user sends without taking paper, plus the checker\'s verdict, are added to the diagram. Press "Show the diagram" and follow where the engine and queue cards get stuck.',
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t("待ち行列を共有するプリンタ", "A printer with a shared queue"),
        },
        { label: t("答え方", "How to answer"), value: t("はい／いいえ", "yes / no") },
        {
          label: t("出題範囲", "Covers"),
          value: t("情報が漏れないか（非干渉）", '"Does information leak?"'),
        },
        {
          label: t("参考", "Reference"),
          value: t(`${TPC_BOOK} 12.4節`, `${TPC_BOOK_EN}, §12.4`),
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
          id: "slot",
          label: t("待ち行列", "Queue"),
          sublabel: t("1枠を共有", "one shared place"),
          icon: "queue",
          x: 38,
          y: 50,
        },
        {
          id: "engine",
          label: t("刷る機械", "Engine"),
          sublabel: t("刷って受け皿に置く", "prints onto a tray"),
          icon: "gear",
          x: 62,
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
        { from: "high", to: "slot" },
        { from: "low", to: "slot" },
        { from: "slot", to: "engine" },
        { from: "checker", to: "engine" },
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
                "受け皿を分けても、共有の待ち行列と、受け皿の空きを待つ機械が残っている。高い利用者が紙を取らないと機械が止まり、低い利用者の仕事が待ち行列に残って次の送信が断られるので、低い利用者の見え方は決定的でなく、漏れる。",
                "Separate trays still leave the shared queue and an engine that waits for tray space. If the high user does not take their paper, the engine stops, the low user's job stays in the queue and the next send is refused, so the low view is not deterministic: it leaks.",
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
