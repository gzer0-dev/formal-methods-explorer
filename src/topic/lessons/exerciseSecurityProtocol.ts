import { translator, type Language } from "../../core/i18n";
import type { Lesson, Step } from "../../core/types";
import { acceptsTrace, explore } from "../csp";
import {
  ATTACK_EXPECTED,
  checkAuthentication,
  HONEST_RUN,
  intruderCanDeliver,
  intruderKnowledgeAfter,
  messageOf,
  NS_ENV,
  protocolMessages,
  protocolSystem,
  type ProtocolOptions,
} from "../cspSecurityProtocol";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

// 演習: 元の Needham–Schroeder で、侵入者が聞いた暗号文を元の送り手・宛先のまま中継することしかできない
// （名乗る送り手や宛先を変えて届けられない）とき、攻撃は見つかるか。
// 中継は許すので、正直な A–B の実行は通る（中継まで禁じると正直な実行も止まり、答えの「いいえ」が空虚に成り立ってしまう）。
// 既定の図は問題の設定だけを見せ、正解（検査の結果）は出さない。答えを入れると、侵入者がどこで行き詰まるかと検査の結果が足される。
const OPTIONS: ProtocolOptions = { version: "original", canRedirect: false };
// Lowe の攻撃のうち、I が A を名乗って B から2通目を受け取るまで（3手）。宛先を変えなくてもここまでは起こせる。
const PREFIX_LENGTH = 3;

const SOLUTION = lazy(() => {
  const system = protocolSystem(OPTIONS);
  const result = checkAuthentication(OPTIONS);
  const prefix = ATTACK_EXPECTED.slice(0, PREFIX_LENGTH);
  const replyFromB = messageOf(prefix.at(-1)!)!;
  // A は I と話しているので、2通目は I からの文として待つ。侵入者が中継できるのは B からの文としてだけ。
  const asFromI = `recv.A.I.${replyFromB}`;
  const asFromB = `recv.A.B.${replyFromB}`;
  return {
    hasAttack: !result.holds,
    states: explore(system, NS_ENV).stateCount,
    prefix,
    isPrefixPossible: acceptsTrace(system, NS_ENV, prefix).isAccepted,
    knowledge: intruderKnowledgeAfter(prefix, false),
    replyFromB,
    asFromI,
    asFromB,
    canDeliverAsFromI: intruderCanDeliver(prefix, false, asFromI),
    canDeliverAsFromB: intruderCanDeliver(prefix, false, asFromB),
    isHonestRunPossible: acceptsTrace(system, NS_ENV, HONEST_RUN.original).isAccepted,
  };
});

const MESSAGES_TEXT = protocolMessages("original")
  .map(({ from, to, message }) => `${from}→${to} ${message}`)
  .join(", ");

type Translate = (ja: string, en: string) => string;

function listText(events: string[]): string {
  return `⟨${events.join(", ")}⟩`;
}

function setupSteps(t: Translate): Step[] {
  return [
    {
      id: "setup",
      kind: "spec",
      title: t("3通で相手を確かめる", "Three messages"),
      actor: "a",
      to: ["b"],
      summary: t(
        `${MESSAGES_TEXT.replaceAll(", ", "、")}。性質は「commit.B.A の前に running.A.B」`,
        `${MESSAGES_TEXT}. The property is "running.A.B before commit.B.A"`,
      ),
      explain: t(
        "「暗号プロトコルの攻撃」と同じ元の Needham–Schroeder 公開鍵プロトコルを使う。{…}pkX は X だけが開けられる文。B が「A と確かめた」（commit.B.A）なら、その前に A が B と話そうとしていた（running.A.B）ことを調べる。",
        'This uses the original Needham–Schroeder public-key protocol from "Attacking a crypto protocol". {…}pkX is a message only X can open. We check that if B has confirmed A (commit.B.A), then A was trying to talk to B beforehand (running.A.B).',
      ),
      set: {
        a: { rows: { [t("nonce", "nonce")]: "Na" } },
        b: { rows: { [t("nonce", "nonce")]: "Nb" } },
      },
    },
    {
      id: "weaker",
      kind: "spec",
      title: t("宛先を変えない侵入者", "No redirecting"),
      actor: "intruder",
      to: ["a", "b"],
      summary: t(
        "侵入者 I は全部の文を聞いて pkI の文は開けるが、開けない暗号文は元の送り手・宛先のまま中継するしかない",
        "The intruder I hears every message and opens those under pkI, but can only relay the ciphertexts it cannot open, with sender and recipient unchanged",
      ),
      explain: t(
        "侵入者はネットワークそのもので、A は I と正規に話すこともある。ここでは侵入者を弱める。知っている nonce から自分で組み立てた文は誰にでも送れるが、開けない暗号文は、本来の宛先へ本来の送り手の名前で届ける（ネットワークとして中継する）ことしかできない。中継は許すので、A と B の正直なやり取りは通る。",
        "The intruder is the network itself, and A may talk to I as a legitimate partner. Here the intruder is weakened. Messages it builds itself from nonces it knows can go to anyone, but a ciphertext it cannot open can only be delivered to its intended recipient under its real sender's name (relayed, as a network would). Relaying is allowed, so an honest exchange between A and B still goes through.",
      ),
      set: {
        intruder: {
          tone: "wait",
          rows: {
            [t("開ける", "opens")]: "pkI",
            [t("宛先の変更", "redirect")]: t("できない", "not allowed"),
          },
        },
      },
    },
    {
      id: "question",
      kind: "explore",
      title: t("攻撃は見つかるか", "Is there an attack?"),
      actor: "checker",
      to: ["intruder"],
      summary: t(
        "宛先を変えられない侵入者に対して、検査器は性質を破る並びを見つけるかを答える",
        "Answer whether the checker finds an ordering that breaks the property against this intruder",
      ),
      explain: t(
        "A と B はそれぞれ1回だけ実行し、A は B か I を相手に選ぶ。検査器が並びを全部たどって、B が A と確かめたのに A が B と話していない並びは見つかるか。下の「答え合わせ」に「はい」か「いいえ」を入れると、侵入者がどこまで進めるかと検査の結果がこの図に足される。ヒント: 元の攻撃で、侵入者は B の返事を誰からの文として A に渡したか。",
        'A and B each run once, and A picks B or I as its partner. Walking every ordering, does the checker find one where B has confirmed A but A was not talking to B? Enter "yes" or "no" under "Check your answer" below and how far the intruder gets, plus the result of the check, are added to this diagram. Hint: in the original attack, as whose message did the intruder hand B\'s reply to A?',
      ),
      set: {
        checker: {
          tone: "wait",
          rows: { [t("問い", "question")]: t("攻撃はある？", "attack?") },
        },
      },
    },
  ];
}

function solutionSteps(t: Translate): Step[] {
  const solution = SOLUTION();
  return [
    {
      id: "as-before",
      kind: "explore",
      title: t("途中までは同じ", "Same start"),
      actor: "intruder",
      to: ["b"],
      summary: t(
        `${listText(solution.prefix)} は${solution.isPrefixPossible ? "起こせる" : "起こせない"}`,
        `${listText(solution.prefix)} ${solution.isPrefixPossible ? "can happen" : "cannot happen"}`,
      ),
      explain: t(
        "A が I と話し始めれば、I は Na を知り、A を名乗って B に1通目を組み立てて送れる。B は A への返事を書く。ここまでは覚えた暗号文の宛先を変えていないので、弱めた侵入者でも同じように進む。",
        "If A starts talking to I, I learns Na and can build a first message to B in A's name. B writes a reply to A. None of this redirects a ciphertext it holds, so the weakened intruder gets this far just the same.",
      ),
      set: {
        a: { tone: "wait", rows: { [t("相手と信じる", "believes peer is")]: "I" } },
        b: { tone: "wait", rows: { [t("相手と信じる", "believes peer is")]: "A" } },
        intruder: {
          rows: {
            [t("知る nonce", "nonces known")]: solution.knowledge.nonces.join(", "),
          },
        },
      },
    },
    {
      id: "stuck",
      kind: "explore",
      title: t("I からとは渡せない", "Not as I's reply"),
      actor: "intruder",
      to: ["a"],
      summary: t(
        `${solution.asFromB} は${solution.canDeliverAsFromB ? "起こせる" : "起こせない"}が、A が待つ ${solution.asFromI} は${solution.canDeliverAsFromI ? "起こせる" : "起こせない"}`,
        `${solution.asFromB} ${solution.canDeliverAsFromB ? "is possible" : "is not possible"}, but ${solution.asFromI}, which A is waiting for, ${solution.canDeliverAsFromI ? "is possible" : "is not possible"}`,
      ),
      explain: t(
        `B の返事 ${solution.replyFromB} は A の公開鍵で暗号化されていて、I には開けない。中継として B からの文のまま A に届けることはできるが、A は I と話しているので I からの返事しか受け取らない。中の Nb を知らないので I からの文として組み立て直すこともできず、A に Nb を開けさせる手が無い。`,
        `B's reply ${solution.replyFromB} is encrypted with A's public key, so I cannot open it. As a relay it can deliver it to A as a message from B, but A is talking to I and accepts only a reply from I. Not knowing the Nb inside, I cannot rebuild it as a message from I either, so it has no way to get A to open Nb.`,
      ),
      set: {
        intruder: {
          tone: "bad",
          rows: { [t("渡せない", "cannot send")]: solution.asFromI },
        },
      },
    },
    {
      id: "checked",
      kind: "fix",
      title: t("検査器の結果", "The checker's result"),
      actor: "checker",
      to: ["intruder"],
      summary: t(
        `${solution.states}状態を全部たどり、攻撃は${solution.hasAttack ? "見つかった" : "見つからない"}。正直な実行は${solution.isHonestRunPossible ? "通る" : "通らない"}`,
        `It walks all ${solution.states} states and ${solution.hasAttack ? "finds an attack" : "finds no attack"}; an honest run ${solution.isHonestRunPossible ? "goes through" : "does not go through"}`,
      ),
      explain: t(
        `Lowe の攻撃は、B が書いた暗号文を I からの返事として A に渡し、開けさせることが要だった。それができない侵入者は、B が相手を A と信じている実行では Nb を知れないので（B が I に応じた実行なら Nb は I に渡るが、そのとき B は I と確かめたと思う）、B に A だと信じ込ませられない。中継は許したので正直な実行は${solution.isHonestRunPossible ? "通り" : "通らず"}、答えは何も起きないことによる空虚な成立ではない。逆に言えば、侵入者を弱く書きすぎると、本当はある攻撃を見逃す。`,
        `The key to Lowe's attack was handing a ciphertext written by B to A as I's reply, so that A would open it. An intruder that cannot do this never learns Nb in a run where B believes its peer is A (if B responds to I, Nb does go to I, but then B believes it has confirmed I), so it cannot make B believe it is A. Relaying is allowed, so an honest run ${solution.isHonestRunPossible ? "goes through" : "does not go through"}; the answer does not hold vacuously because nothing happens. Put the other way, writing the intruder too weak makes you miss an attack that really exists.`,
      ),
      set: {
        checker: {
          rows: {
            [t("問い", "question")]: null,
            [t("正直な実行", "honest run")]: solution.isHonestRunPossible
              ? t("通る", "passes")
              : t("通らない", "fails"),
            [t("攻撃", "attack")]: solution.hasAttack
              ? t("ある", "found")
              : t("無い", "none"),
          },
        },
      },
    },
  ];
}

export function exerciseSecurityProtocolLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-security-protocol",
      title: t("演習: 宛先を変えない侵入者", "Exercise: a relay-only intruder"),
      subtitle: t(
        "侵入者が暗号文を中継しかできないとき、攻撃はあるか",
        "If the intruder can only relay ciphertexts, is there still an attack?",
      ),
      summary: t(
        "元の Needham–Schroeder 公開鍵プロトコルで、侵入者が聞いた暗号文を元の送り手・宛先のまま中継するしかないとき、検査器が攻撃を見つけるかを答える。答えを入れると、侵入者がどこで行き詰まるかを図で追える。",
        "For the original Needham–Schroeder public-key protocol, answer whether the checker finds an attack when the intruder can only relay the ciphertexts it hears, with sender and recipient unchanged. Once you answer, you can follow in the diagram where the intruder gets stuck.",
      ),
      intro: [
        t(
          "「暗号プロトコルの攻撃」で見た Needham–Schroeder 公開鍵プロトコルと侵入者を使う。侵入者の力（何を知り、何を送れるか）をどう書くかで、検査器が見つける攻撃は変わる。ここでは侵入者から「聞いた暗号文を、名乗る送り手や宛先を変えて届ける」力だけを外す。本来の宛先への中継は残すので、正直なやり取りは止まらない。",
          'This uses the Needham–Schroeder public-key protocol and the intruder from "Attacking a crypto protocol". What attacks the checker finds depends on how the intruder\'s power (what it knows and what it can send) is written. Here only the power to deliver a ciphertext it has heard under a different sender name or to a different recipient is taken away. Relaying to the intended recipient remains, so honest exchanges are not blocked.',
        ),
        t(
          "下の「答え合わせ」に「はい」か「いいえ」を入れると、図に侵入者の進み方と検査の結果が足される。「図で見る」を押して、侵入者がどの文で行き詰まるかを追う。",
          'When you enter "yes" or "no" under "Check your answer", the intruder\'s progress and the result of the check are added to the diagram. Press "Show the diagram" and follow which message the intruder gets stuck on.',
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t(
            "Needham–Schroeder 公開鍵プロトコル（元の版）",
            "Needham–Schroeder public-key protocol (original)",
          ),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("「はい」か「いいえ」", '"yes" or "no"'),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t("暗号プロトコルの攻撃", '"Attacking a crypto protocol"'),
        },
        {
          label: t("参考", "Reference"),
          value: t(`${TPC_BOOK} 15.4節`, `${TPC_BOOK_EN}, §15.4`),
        },
      ],
      actors: [
        {
          id: "a",
          label: "A",
          sublabel: t("始める側", "initiator"),
          icon: "person",
          x: 20,
          y: 27,
        },
        {
          id: "intruder",
          label: t("侵入者 I", "Intruder I"),
          sublabel: t("宛先を変えられない", "cannot redirect"),
          icon: "network",
          x: 50,
          y: 27,
        },
        {
          id: "b",
          label: "B",
          sublabel: t("応じる側", "responder"),
          icon: "person",
          x: 80,
          y: 27,
        },
        {
          id: "checker",
          label: t("検査器", "Checker"),
          sublabel: t("⊑T で調べる", "checks ⊑T"),
          icon: "checker",
          x: 50,
          y: 73,
        },
      ],
      links: [
        { from: "a", to: "intruder" },
        { from: "intruder", to: "b" },
        { from: "checker", to: "intruder" },
      ],
      answerType: "yesno",
      answerLabel: t("攻撃は見つかるか", "Is an attack found?"),
      hint: t(
        "攻撃が見つかるなら「はい」、見つからないなら「いいえ」を入れる。入れると、図に正解の手順が足される。",
        'Enter "yes" if an attack is found, "no" if not. The steps of the answer are then added to the diagram.',
      ),
      verdictActor: "checker",
      setupSteps: setupSteps(t),
      solve: () => {
        const solution = SOLUTION();
        return {
          answer: solution.hasAttack,
          reason: t(
            `${solution.states}状態を全部たどっても、B が A と確かめたのに A が B と話していない並びは${solution.hasAttack ? "ある" : "無い"}。B の返事 ${solution.replyFromB} を I からの返事として A に渡せないので、B が相手を A と信じている実行では、侵入者は Nb を知る手が無い。正直な実行は${solution.isHonestRunPossible ? "通る" : "通らない"}。`,
            `Walking all ${solution.states} states, there ${solution.hasAttack ? "is" : "is no"} ordering where B has confirmed A while A was not talking to B. The intruder cannot hand B's reply ${solution.replyFromB} to A as I's reply, so in a run where B believes its peer is A, it has no way to learn Nb. An honest run ${solution.isHonestRunPossible ? "goes through" : "does not go through"}.`,
          ),
        };
      },
      solutionSteps: () => solutionSteps(t),
    },
    language,
  );
}
