import { translator, type Language } from "../../core/i18n";
import type { Lesson, Step } from "../../core/types";
import { acceptsTrace, completeTraces, failuresRefines, traceRefines } from "../csp";
import { CRYPTO_ENV, cryptographers, parityOf } from "../cspCases";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";

// 演習: 食事する暗号学者で、払ったのが0か1かを外から区別できるか（exerciseCsp.ts の問4を1レッスンにしたもの）。
// 既定の図は問題の設定だけを見せ、比べた結果は出さない。答えを入れると、発言の並びの例と詳細化の比較が図に足される。

const PEOPLE = 3;
const INDEXES = Array.from({ length: PEOPLE }, (_, i) => i);

type Translate = (ja: string, en: string) => string;

// 正解の計算は exerciseCsp.ts の問4と同じ関数・同じ組（0が払った版と1が払った版）。
// 詳細化の比較は数百ミリ秒かかるので、答えが入るまで呼ばない。図で見せるためにトレースと失敗の結果を分けて持つ。
const COMPARISON = lazy(() => {
  const paid0 = cryptographers(0, false);
  const paid1 = cryptographers(1, false);
  const isSameTraces =
    traceRefines(paid0, paid1, CRYPTO_ENV).holds &&
    traceRefines(paid1, paid0, CRYPTO_ENV).holds;
  const isSameFailures =
    failuresRefines(paid0, paid1, CRYPTO_ENV).holds &&
    failuresRefines(paid1, paid0, CRYPTO_ENV).holds;
  const complete = completeTraces(paid0, CRYPTO_ENV);
  const parities = [...new Set(complete.map(parityOf))];
  const example = complete[0]!;
  const exampleOnPaid1 = acceptsTrace(paid1, CRYPTO_ENV, example);
  return {
    isSameTraces,
    isSameFailures,
    isIndistinguishable: isSameTraces && isSameFailures,
    parities,
    completeCount: complete.length,
    example,
    isExampleAcceptedByPaid1: exampleOnPaid1.isAccepted,
  };
});

function setupSteps(t: Translate): Step[] {
  return [
    {
      id: "coins",
      kind: "spec",
      title: t("隣とコインを共有", "Share coins with neighbours"),
      actor: "coins",
      to: INDEXES.map((i) => `c${i}`),
      summary: t(
        "3人が丸く座り、各自は自分のコインと右隣のコインの2枚を見る",
        "Three sit in a circle; each sees their own coin and the one to the right",
      ),
      explain: t(
        "3人の暗号学者が丸く座り、隣どうしの間にコインを1枚ずつ置いて投げる。各自が見るのは、自分のコインと右隣のコインの2枚だけ。コインを見る動き（look）は外からは見えない。",
        "Three cryptographers sit in a circle with a coin tossed between each pair of neighbours. Each sees only two coins: their own and the one to the right. Looking at a coin (look) is not visible from outside.",
      ),
      set: {
        coins: {
          tone: "wait",
          rows: { [t("裏表", "face")]: t("投げて決まる", "set by a toss") },
        },
        ...Object.fromEntries(
          INDEXES.map((i) => [
            `c${i}`,
            {
              rows: {
                [t("見る", "sees")]: t(
                  `コイン${i}・${(i + 1) % PEOPLE}`,
                  `coins ${i}, ${(i + 1) % PEOPLE}`,
                ),
              },
            },
          ]),
        ),
      },
    },
    {
      id: "say",
      kind: "spec",
      title: t("同じなら0を言う", "Same coins: say 0"),
      actor: "c0",
      to: ["observer"],
      summary: t(
        "2枚が同じなら0、違えば1を言う。払った人だけ逆を言う。say.i.x は「iがxと言った」",
        'Say 0 if the two coins match, 1 if not. Only the payer says the opposite. say.i.x means "i said x"',
      ),
      explain: t(
        "各自は見た2枚が同じなら0、違えば1を言う。食事代を払った人だけは逆を言う。外から見る人に届くのは、この発言（say.i.x）だけ。",
        "Each person says 0 if the two coins they saw match, and 1 if they differ. Only the person who paid for dinner says the opposite. All that reaches the outside observer is these statements (say.i.x).",
      ),
      set: {
        observer: {
          tone: "idle",
          rows: { [t("見える", "sees")]: t("say.i.x だけ", "only say.i.x") },
        },
        c0: {
          rows: {
            [t("言う", "says")]: t("同じなら0、違えば1", "0 if same, 1 if not"),
          },
        },
      },
    },
    {
      id: "question",
      kind: "explore",
      title: t("払った人は分かるか", "Can you tell who paid?"),
      actor: "checker",
      to: ["observer"],
      summary: t(
        "暗号学者0が払ったときと1が払ったときを、外から区別できるかを答える",
        "Can an observer tell cryptographer 0 paying from cryptographer 1 paying?",
      ),
      explain: t(
        "外から見えるのは各人の発言（0か1）だけ。払ったのが暗号学者0のときと暗号学者1のときで、外から見える振る舞いを区別できるか。区別できないとは、トレースと失敗の詳細化が両向きとも成り立つこと。下の「答え合わせ」に「はい」か「いいえ」を入れると、検査器が比べた結果がこの図に足される。ヒント: 払った人は逆を言うが、聞き手には誰のコインが何だったかが見えない。",
        'An observer sees only what each one announces (0 or 1). Can the visible behaviour when cryptographer 0 paid be told apart from when cryptographer 1 paid? Indistinguishable means both trace and failures refinement hold in both directions. Enter "yes" or "no" under "Check your answer" below and the checker\'s comparison is added to this diagram. Hint: the payer announces the opposite, but listeners cannot see whose coin showed what.',
      ),
      set: {
        c0: { tone: "wait", rows: { [t("払った", "paid")]: t("0の回", "case 0") } },
        c1: { tone: "wait", rows: { [t("払った", "paid")]: t("1の回", "case 1") } },
        checker: {
          tone: "wait",
          rows: { [t("問い", "question")]: t("0と1は区別できる？", "Tell 0 from 1?") },
        },
      },
      simplified: t(
        "コインを見る順を固定し、言い終えたら止まるモデルにして状態を減らしている（発言の並びには影響しない）。",
        "To reduce the number of states, the model fixes the order in which coins are looked at and stops once everyone has spoken (this does not affect the announcements).",
      ),
    },
  ];
}

function solutionSteps(t: Translate): Step[] {
  const result = COMPARISON();
  if (!result.isExampleAcceptedByPaid1) {
    throw new Error("0が払った回の発言の並びを、1が払ったモデルが起こせない");
  }
  const example = result.example.join(" → ");
  const parities = result.parities.join(t("・", ", "));
  const sameOrDiffer = (isSame: boolean) =>
    isSame ? t("等しい", "equal") : t("違う", "differ");
  return [
    {
      id: "heard-0",
      kind: "run",
      title: t("0が払った回の発言", "What is said when 0 paid"),
      actor: "c0",
      to: ["observer"],
      summary: t(
        `0が払った回の発言の例: ${example}`,
        `Example when 0 paid: ${example}`,
      ),
      explain: t(
        `暗号学者0が払ったモデルを最後まで動かすと、発言の並びは${result.completeCount}通りある。そのうちの1つが${example}。外から見る人が受け取るのは、この並びだけ。`,
        `Running the model where cryptographer 0 paid to the end gives ${result.completeCount} sequences of statements. One of them is ${example}. That sequence is all the outside observer receives.`,
      ),
      set: {
        observer: { tone: "wait", rows: { [t("聞いた", "heard")]: example } },
        c0: { tone: "idle" },
        c1: { tone: "idle" },
        checker: { rows: { [t("問い", "question")]: null } },
      },
    },
    {
      id: "heard-1",
      kind: "explore",
      title: t("1が払っても起こせる", "Possible if 1 paid, too"),
      actor: "checker",
      to: ["c1", "observer"],
      summary: t(
        `暗号学者1が払ったモデルも${example}を起こせる`,
        `The model where cryptographer 1 paid can also produce ${example}`,
      ),
      explain: t(
        `同じ並び${example}を、暗号学者1が払ったモデルに与えると、最後まで受け付けた。コインの出方が違えば、1が払っても同じ発言になる。聞き手にはコインが見えないので、この並びからは0と1のどちらが払ったかを決められない。`,
        `Given the same sequence ${example}, the model where cryptographer 1 paid accepts it to the end. With different coin tosses, 1 paying gives the same statements. The listener cannot see the coins, so this sequence cannot decide whether 0 or 1 paid.`,
      ),
      set: {
        c1: { tone: "ok" },
        checker: {
          tone: "wait",
          rows: { [t("1の回", "case 1")]: t("同じ並びを起こせる", "can produce it") },
        },
      },
    },
    {
      id: "parity",
      kind: "run",
      title: t("分かるのは払ったことだけ", "Only that someone paid"),
      actor: "observer",
      summary: t(
        `どの並びでも、発言の排他的論理和は${parities}`,
        `In every sequence, the XOR of the statements is ${parities}`,
      ),
      explain: t(
        `0が払ったモデルの${result.completeCount}通りの並びは、どれも発言の排他的論理和（1の数が奇数なら1）が${parities}になる。各コインは2人に1回ずつ数えられて打ち消し合い、払った人の「逆」だけが残るため。外から分かるのは「誰かが払った」ことまで。`,
        `In all ${result.completeCount} sequences of the model where 0 paid, the XOR of the statements (1 if the number of 1s is odd) is ${parities}. Each coin is counted once by each of two people and cancels out, leaving only the payer's "opposite". From outside you learn only that someone paid.`,
      ),
      set: {
        observer: {
          rows: { [t("排他的論理和", "XOR")]: parities },
        },
      },
    },
    {
      id: "traces",
      kind: "explore",
      title: t("トレースを両向きに比べる", "Compare traces both ways"),
      actor: "checker",
      to: ["c0", "c1"],
      summary: t(
        `0が払った版と1が払った版のトレース: ${sameOrDiffer(result.isSameTraces)}`,
        `Traces of "0 paid" and "1 paid": ${sameOrDiffer(result.isSameTraces)}`,
      ),
      explain: t(
        `1つの並びが同じでも、ほかの並びで違いが出るかもしれない。検査器は、0が払った版と1が払った版のトレース詳細化を両向きに調べ、起こせる発言の並びの集まりが${sameOrDiffer(result.isSameTraces)}ことを確かめた。`,
        `One sequence being the same does not rule out a difference in another. The checker tested trace refinement in both directions between "0 paid" and "1 paid" and found that the sets of possible sequences ${result.isSameTraces ? "are equal" : "differ"}.`,
      ),
      set: {
        checker: {
          tone: result.isSameTraces ? "wait" : "bad",
          rows: {
            [t("1の回", "case 1")]: null,
            [t("トレース", "traces")]: sameOrDiffer(result.isSameTraces),
          },
        },
      },
    },
    {
      id: "failures",
      kind: result.isIndistinguishable ? "fix" : "found",
      title: t("失敗も両向きに比べる", "Compare failures both ways"),
      actor: "checker",
      to: ["c0", "c1"],
      summary: t(
        `失敗も${sameOrDiffer(result.isSameFailures)}。外からは${result.isIndistinguishable ? "区別できない" : "区別できる"}`,
        `Failures ${sameOrDiffer(result.isSameFailures)} too. From outside they ${result.isIndistinguishable ? "cannot" : "can"} be told apart`,
      ),
      explain: t(
        `並びに加えて、途中で断れる発言まで比べる（失敗詳細化）。両向きとも${result.isSameFailures ? "成り立つ" : "どちらかが破れる"}ので、0が払った版と1が払った版は、外から見て${result.isIndistinguishable ? "同じ振る舞いになる" : "違う振る舞いになる"}。`,
        `Besides the sequences, compare the statements that can be refused along the way (failures refinement). It ${result.isSameFailures ? "holds in both directions" : "fails in one direction"}, so "0 paid" and "1 paid" ${result.isIndistinguishable ? "behave the same" : "behave differently"} from outside.`,
      ),
      set: {
        c0: { tone: result.isIndistinguishable ? "ok" : "bad" },
        c1: { tone: result.isIndistinguishable ? "ok" : "bad" },
        observer: {
          tone: result.isIndistinguishable ? "ok" : "bad",
          rows: { [t("聞いた", "heard")]: null },
        },
        checker: {
          tone: result.isIndistinguishable ? "ok" : "bad",
          rows: { [t("失敗", "failures")]: sameOrDiffer(result.isSameFailures) },
        },
      },
      simplified: t(
        "同じ組を ProB で確かめ、結果が一致した（specs/csp）。",
        "The same pair was checked with ProB and the results agreed (specs/csp).",
      ),
    },
  ];
}

export function exerciseCryptoLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-crypto",
      title: t("演習: 払った人は分かるか", "Exercise: can you tell who paid?"),
      subtitle: t(
        "発言を全部聞けば、誰が払ったか分かるか",
        "Can you tell who paid by hearing every statement?",
      ),
      summary: t(
        "食事する暗号学者で、暗号学者0が払ったときと1が払ったときを外から区別できるかを答える。答えを入れると、発言の並びの例とトレース・失敗の比較を図で追える。",
        "For the dining cryptographers, answer whether an observer can tell cryptographer 0 paying from cryptographer 1 paying. Once you answer, you can follow an example of what is said and the trace and failures comparisons in the diagram.",
      ),
      intro: [
        t(
          "「誰が払ったかを隠す」で見た食事する暗号学者を使う。外から見えるのは各人の発言だけで、払った人を入れ替えた2つのモデルを外から区別できるかを問う。",
          'This uses the dining cryptographers from "Who paid?". Only what each person says is visible from outside, and the question is whether two models that differ only in who paid can be told apart from outside.',
        ),
        t(
          "図はまず、コインと発言の決まりだけを見せる。答えを入れると、「外から見る人」が聞いた発言の並びと、検査器の比べた結果が足されるので、検査器のカードに何が残るかを追う。",
          "The diagram first shows only the rules for coins and statements. Once you answer, the statements the \"Outside observer\" heard and the checker's comparisons are added, so follow what remains on the checker's card.",
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t("食事する暗号学者", "Dining cryptographers"),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("「はい」か「いいえ」", '"yes" or "no"'),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t("誰が払ったかを隠す", '"Who paid?"'),
        },
      ],
      actors: [
        ...INDEXES.map((i) => ({
          id: `c${i}`,
          label: t(`暗号学者${i}`, `Cryptographer ${i}`),
          sublabel: t(
            `コイン${i}とコイン${(i + 1) % PEOPLE}を見る`,
            `sees coins ${i} and ${(i + 1) % PEOPLE}`,
          ),
          icon: "person",
          x: [14, 38, 62][i]!,
          y: 27,
        })),
        {
          id: "coins",
          label: t("コイン", "Coins"),
          sublabel: t(`${PEOPLE}枚、隣どうしで共有`, `${PEOPLE}, shared by neighbours`),
          icon: "dice",
          x: 14,
          y: 73,
          initial: { rows: { [t("裏表", "face")]: t("見えない", "hidden") } },
        },
        {
          id: "observer",
          label: t("外から見る人", "Outside observer"),
          sublabel: t("発言 say だけ見える", "sees only say"),
          icon: "person",
          x: 50,
          y: 73,
        },
        {
          id: "checker",
          label: t("検査器", "Checker"),
          sublabel: t("振る舞いを比べる", "compares behaviour"),
          icon: "checker",
          x: 86,
          y: 50,
        },
      ],
      links: [
        ...INDEXES.map((i) => ({ from: "coins", to: `c${i}` })),
        ...INDEXES.map((i) => ({ from: `c${i}`, to: "observer" })),
        { from: "checker", to: "observer" },
      ],
      answerType: "yesno",
      answerLabel: t("あなたの答え（はい／いいえ）", "Your answer (yes / no)"),
      hint: t(
        "外から区別できるなら「はい」、できないなら「いいえ」を入れる。入れると、図に検査器が比べた結果が足される（比べるのに少し時間がかかる）。",
        'Enter "yes" if an observer can tell them apart, "no" if not. The checker\'s comparison is then added to the diagram (it takes a moment).',
      ),
      verdictActor: "checker",
      // 既定の見本には日本語の「はい」「いいえ」が入っていて、英語のレッスンの訳し忘れの検査に掛かるので、言語ごとに渡す。
      samples: language === "ja" ? ["はい", "いいえ", "yes", "x"] : ["yes", "no", "x"],
      setupSteps: setupSteps(t),
      solve: () => {
        const { isIndistinguishable, parities } = COMPARISON();
        return {
          answer: !isIndistinguishable,
          reason: isIndistinguishable
            ? t(
                `トレースも失敗も両向きの詳細化が成り立ち、外から見える振る舞いは同じ。発言の排他的論理和はいつも${parities.join("・")}なので「誰かが払った」ことは分かるが、誰かは分からない。`,
                `Trace and failures refinement both hold in both directions, so the visible behaviour is the same. The XOR of the announcements is always ${parities.join(", ")}, so you can tell that someone paid, but not who.`,
              )
            : t(
                "どちらかの向きの詳細化が破れ、外から区別できる。",
                "Refinement fails in one direction, so an observer can tell them apart.",
              ),
        };
      },
      solutionSteps: () => solutionSteps(t),
    },
    language,
  );
}
