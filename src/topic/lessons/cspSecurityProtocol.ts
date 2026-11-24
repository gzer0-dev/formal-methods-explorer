import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { acceptsTrace, explore } from "../csp";
import {
  checkAuthentication,
  HONEST_RUN,
  intruderKnowledgeAfter,
  LOWE_ATTEMPT,
  LOWE_MISMATCH,
  messageOf,
  NS_ENV,
  protocolMessages,
  protocolSystem,
  type ProtocolOptions,
} from "../cspSecurityProtocol";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

const ORIGINAL = checkAuthentication({ version: "original" });
const ATTACK = ORIGINAL.counterexample ?? [];
const LOWE = checkAuthentication({ version: "lowe" });
const LOWE_HONEST = acceptsTrace(
  protocolSystem({ version: "lowe" }),
  NS_ENV,
  HONEST_RUN.lowe,
).isAccepted;
const ORIGINAL_STATES = explore(
  protocolSystem({ version: "original" }),
  NS_ENV,
).stateCount;

// 攻撃の手順を図の4つの場面に分ける（A が I と始める／I が A を名乗る／A に解かせる／B が信じる）。
const SCENES = [
  ATTACK.slice(0, 1),
  ATTACK.slice(1, 3),
  ATTACK.slice(3, 6),
  ATTACK.slice(6),
];
const knowledgeAt = (count: number) =>
  intruderKnowledgeAfter(ATTACK.slice(0, count), true);
const SCENE_ENDS = SCENES.map((_, index) =>
  SCENES.slice(0, index + 1).reduce((sum, scene) => sum + scene.length, 0),
);

const MESSAGES_TEXT = protocolMessages("original")
  .map(({ from, to, message }) => `${from}→${to} ${message}`)
  .join(", ");
const LOWE_ATTEMPT_KNOWLEDGE = intruderKnowledgeAfter(LOWE_ATTEMPT, true);
const HONEST_KNOWLEDGE = intruderKnowledgeAfter(HONEST_RUN.lowe, true);

function listText(events: string[]): string {
  return `⟨${events.join(", ")}⟩`;
}

function messagesOf(events: string[]): string[] {
  return events.map((event) => messageOf(event)).filter((m): m is string => m !== null);
}

/** 0 か 1 の欄。1 以外の数は 0、数でなければ既定の値。 */
function parseFlag(text: string | undefined, fallback: boolean): boolean {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return fallback;
  return value === 1;
}

export function cspSecurityProtocolLesson(language: Language): Lesson {
  const t = translator(language);
  const holdsText = (holds: boolean) =>
    holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
  const knowsRow = t("知る nonce", "nonces known");
  const heldRow = t("覚えた暗号文", "ciphertexts held");
  const believesRow = t("相手と信じる", "believes peer is");
  const knowledgeRows = (count: number) => {
    const knowledge = knowledgeAt(count);
    return {
      [knowsRow]: knowledge.nonces.join(", "),
      [heldRow]:
        knowledge.ciphertexts.length > 0
          ? knowledge.ciphertexts.join(", ")
          : t("なし", "none"),
    };
  };
  return {
    id: "csp-security-protocol",
    category: "protocol",
    title: t("暗号プロトコルの攻撃", "Attacking a crypto protocol"),
    subtitle: t(
      "Needham–Schroeder と侵入者を並べて検査する",
      "Check Needham–Schroeder alongside an intruder",
    ),
    summary: t(
      `古典の Needham–Schroeder 公開鍵プロトコルに、ネットワークそのものである侵入者を並べ、「B が A と確かめたなら、A は B と話そうとしていた」を調べる。元の版は${ATTACK.length}手の中間者攻撃（Lowe の攻撃）で${holdsText(ORIGINAL.holds)}。2通目に B の名前を入れる Lowe の修正では${holdsText(LOWE.holds)}。`,
      `Put the classic Needham–Schroeder public-key protocol next to an intruder who is the network itself, and check "if B has confirmed A, then A was trying to talk to B". For the original it ${holdsText(ORIGINAL.holds)}: a man-in-the-middle attack of ${ATTACK.length} steps (Lowe's attack) breaks it. With Lowe's fix, which puts B's name in the second message, it ${holdsText(LOWE.holds)}.`,
    ),
    intro: [
      t(
        "暗号プロトコルは、暗号化した文を決まった順に送り合って、相手が本物かを確かめる手順である。暗号そのものは破れないと仮定しても、文の組み合わせ方に穴があると、盗み聞きと送り直しだけでなりすませることがある。ここでは古典の Needham–Schroeder 公開鍵プロトコルを、侵入者のプロセスと並べて調べる。",
        "A cryptographic protocol is a procedure in which parties exchange encrypted messages in a fixed order to check that the other side is genuine. Even if the encryption itself cannot be broken, a flaw in how the messages fit together can let an attacker impersonate someone using only eavesdropping and replay. Here the classic Needham–Schroeder public-key protocol is checked alongside an intruder process.",
      ),
      t(
        "このプロトコルは長く安全だと考えられていたが、Lowe が検査器 FDR で調べて中間者攻撃を見つけた。正しく動く例をテストで何度流しても、侵入者が別の実行の文を混ぜる並びは試されない。侵入者を「送られた文は全部聞き、作れる文は何でも送れる」プロセスとして書けば、検査器がそうした並びを全部たどる。",
        "The protocol was long thought to be safe, until Lowe checked it with the model checker FDR and found a man-in-the-middle attack. However many correct runs a test replays, it never tries the orderings where an intruder mixes in messages from another run. Writing the intruder as a process that hears every message sent and can send any message it can build lets the checker walk all such orderings.",
      ),
      t(
        "図では、上の段の侵入者 I のカードで、知っている nonce（使い捨ての乱数）と覚えた暗号文が増えていく様子を追う。A は I を正規の相手として話し始めるだけなのに、最後に B が「A と確かめた」と思い込む所が、検査器の見つけた反例である。",
        "In the diagram, follow on the card of the intruder I in the top row how the nonces (single-use random numbers) it knows and the ciphertexts it holds grow. A only starts a normal session with I as a legitimate partner, yet at the end B believes it has confirmed A: that is the counterexample the checker found.",
      ),
    ],
    facts: [
      {
        label: t("元の版", "Original"),
        value: t(
          `認証は${holdsText(ORIGINAL.holds)}（攻撃は${ATTACK.length}手）`,
          `authentication ${holdsText(ORIGINAL.holds)} (attack in ${ATTACK.length} steps)`,
        ),
        tone: ORIGINAL.holds ? "ok" : "bad",
      },
      {
        label: t("Lowe の修正", "Lowe's fix"),
        value: t(
          `認証は${holdsText(LOWE.holds)}・正直な実行は${LOWE_HONEST ? "通る" : "通らない"}`,
          `authentication ${holdsText(LOWE.holds)}; an honest run ${LOWE_HONEST ? "completes" : "does not complete"}`,
        ),
        tone: LOWE.holds && LOWE_HONEST ? "ok" : "bad",
      },
      {
        label: t("状態の数", "States"),
        value: t(
          `元の版で${ORIGINAL_STATES}状態`,
          `${ORIGINAL_STATES} states for the original`,
        ),
      },
      {
        label: t("参考", "Reference"),
        value: t(
          `${TPC_BOOK} 15.4節（暗号プロトコルの解析）`,
          `${TPC_BOOK_EN}, §15.4 (analysing crypto-protocols)`,
        ),
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
        sublabel: t("ネットワークそのもの", "the network itself"),
        icon: "network",
        x: 50,
        y: 27,
        initial: { isHidden: true },
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
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: t("B が確かめた相手", "whom B confirmed"),
        icon: "spec",
        x: 30,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("⊑T で調べる", "checks ⊑T"),
        icon: "checker",
        x: 70,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "a", to: "intruder" },
      { from: "intruder", to: "b" },
      { from: "spec", to: "checker" },
    ],
    steps: [
      {
        id: "protocol",
        kind: "spec",
        title: t("3通で相手を確かめる", "Three messages"),
        actor: "a",
        to: ["b"],
        summary: t(
          `${MESSAGES_TEXT.replaceAll(", ", "、")} の3通を送り合う`,
          `${MESSAGES_TEXT}: three messages`,
        ),
        explain: t(
          "{…}pkX は X の公開鍵で暗号化した文で、開けるのは X だけ。A は自分の nonce Na を B に送り、B は Na を返して自分の Nb を添える。A が Nb を返せば、B は「相手は Na を開けた A だ」と確かめたことにする。",
          "{…}pkX is a message encrypted with X's public key; only X can open it. A sends its nonce Na to B; B returns Na and adds its own Nb. When A returns Nb, B takes it as confirmed that the other side is A, who opened Na.",
        ),
        set: {
          a: { rows: { [t("nonce", "nonce")]: "Na" } },
          b: { rows: { [t("nonce", "nonce")]: "Nb" } },
        },
      },
      {
        id: "intruder",
        kind: "spec",
        title: t("侵入者はネットワーク", "The intruder is the net"),
        actor: "intruder",
        to: ["a", "b"],
        summary: t(
          "送られた文は全部 I が受け取り、届く文は全部 I が出す。I も正規の利用者",
          "I receives every message sent and delivers every message received; I is also a legitimate user",
        ),
        explain: t(
          "侵入者 I は、A と B の間のネットワークとして書く。pkI の文は開けて中の nonce を知り、開けない文はそのまま覚えて送り直せる。知っている nonce からは、誰の公開鍵でも暗号化して新しい文を作れる。I は自分の鍵を持つ普通の利用者でもあるので、A が I と話すこともある。",
          "The intruder I is written as the network between A and B. It opens messages under pkI and learns the nonces inside; messages it cannot open it keeps as they are and can resend. From the nonces it knows, it can build new messages encrypted with anyone's public key. I is also an ordinary user with its own key, so A may talk to I.",
        ),
        set: { intruder: { isHidden: false, tone: "wait", rows: knowledgeRows(0) } },
      },
      {
        id: "property",
        kind: "spec",
        title: t("守りたい性質", "The property"),
        actor: "spec",
        to: ["checker"],
        summary: t(
          "commit.B.A（B が A と確かめた）の前に、running.A.B（A が B と話している）がある",
          "commit.B.A (B has confirmed A) is preceded by running.A.B (A is talking to B)",
        ),
        explain: t(
          "A は2通目を受け取ったら running.A.相手 を、B は3通目を受け取ったら commit.B.相手 を出す。仕様は「running.A.B が起きるまで commit.B.A を起こせない、ほかは何でもよい」プロセス。他のイベントを隠さずに比べるので、反例がそのまま攻撃の手順になる。",
          "A signals running.A.peer when it receives the second message, and B signals commit.B.peer when it receives the third. The spec is a process that cannot do commit.B.A until running.A.B has happened, and allows everything else. Other events are not hidden, so a counterexample is the attack itself, step by step.",
        ),
        set: {
          spec: {
            isHidden: false,
            rows: {
              [t("性質", "property")]: t("running.A.B が先", "running.A.B first"),
            },
          },
          checker: {
            isHidden: false,
            tone: "wait",
            rows: { [t("比べ方", "check")]: "⊑T" },
          },
        },
      },
      {
        id: "start-with-i",
        kind: "explore",
        title: t("A が I と話し始める", "A starts with I"),
        actor: "a",
        to: ["intruder"],
        summary: t(
          `${listText(SCENES[0]!)}: A は I を相手に選び、I は Na を知る`,
          `${listText(SCENES[0]!)}: A picks I as its partner, and I learns Na`,
        ),
        explain: t(
          "A は I を正規の相手として選び、I の公開鍵で1通目を送る。I は開けて Na を知る。ここまでは正しい使い方で、I が悪いことをしたわけではない。",
          "A chooses I as a legitimate partner and sends the first message under I's public key. I opens it and learns Na. So far this is correct use; I has done nothing wrong.",
        ),
        set: {
          a: { tone: "wait", rows: { [believesRow]: "I" } },
          intruder: { tone: "wait", rows: knowledgeRows(SCENE_ENDS[0]!) },
        },
      },
      {
        id: "pose-as-a",
        kind: "explore",
        title: t("I が A を名乗る", "I poses as A"),
        actor: "intruder",
        to: ["b"],
        summary: t(
          `${listText(SCENES[1]!)}: I は Na を B 宛てに暗号化し直し、A を名乗って送る`,
          `${listText(SCENES[1]!)}: I re-encrypts Na for B and sends it in A's name`,
        ),
        explain: t(
          `I は知った Na を B の公開鍵で暗号化し直し、送り手を A と偽って B に届ける。B は A からの1通目だと信じ、Na と自分の Nb を A の公開鍵で返す。I はこの ${messagesOf(SCENES[1]!).at(-1)} を開けないが、そのまま覚える。`,
          `I re-encrypts the Na it learned with B's public key and delivers it to B, faking A as the sender. B believes it is the first message from A and returns Na with its own Nb under A's public key. I cannot open this ${messagesOf(SCENES[1]!).at(-1)}, but it keeps it as it is.`,
        ),
        set: {
          b: { tone: "wait", rows: { [believesRow]: "A" } },
          intruder: { tone: "wait", rows: knowledgeRows(SCENE_ENDS[1]!) },
        },
      },
      {
        id: "a-decrypts",
        kind: "explore",
        title: t("A に開けさせる", "A opens it for I"),
        actor: "intruder",
        to: ["a"],
        summary: t(
          `${listText(SCENES[2]!)}: I は B の返事を A に回し、A は Nb を I 宛てに返す`,
          `${listText(SCENES[2]!)}: I passes B's reply to A, and A returns Nb to I`,
        ),
        explain: t(
          "I は覚えた暗号文を、自分からの2通目として A に送り直す。中身は Na と Nb だけで、誰が書いたかが入っていないので、A は I からの返事だと思って受け取る。A は Nb を I の公開鍵で返し、I は Nb を知る。",
          "I resends the ciphertext it kept to A, as if it were I's own second message. It contains only Na and Nb, with nothing saying who wrote it, so A accepts it as I's reply. A returns Nb under I's public key, and I learns Nb.",
        ),
        set: {
          a: { tone: "ok", rows: { [t("出した", "signalled")]: SCENES[2]![1] ?? "" } },
          intruder: { tone: "bad", rows: knowledgeRows(SCENE_ENDS[2]!) },
        },
      },
      {
        id: "b-believes",
        kind: "found",
        title: t("B は A だと信じる", "B believes it is A"),
        actor: "intruder",
        to: ["b", "checker"],
        summary: t(
          `${listText(SCENES[3]!)}: B は commit.B.A を出すが、running.A.B は起きていない`,
          `${listText(SCENES[3]!)}: B signals commit.B.A, but running.A.B never happened`,
        ),
        explain: t(
          `I は Nb を B の公開鍵で暗号化し、A を名乗って3通目として送る。B は「A と確かめた」と commit.B.A を出す。A は B と話そうとしていないので、仕様を破る。検査器は幅優先でたどるので、この${ATTACK.length}手が最短の攻撃である。`,
          `I encrypts Nb with B's public key and sends it as the third message in A's name. B signals commit.B.A, believing it has confirmed A. A was never trying to talk to B, so this breaks the spec. The checker searches breadth-first, so these ${ATTACK.length} steps are the shortest attack.`,
        ),
        set: {
          b: {
            tone: "bad",
            rows: { [t("出した", "signalled")]: SCENES[3]!.at(-1) ?? "" },
          },
          checker: {
            tone: ORIGINAL.holds ? "ok" : "bad",
            rows: {
              [t("元の版", "original")]: holdsText(ORIGINAL.holds),
              [t("攻撃", "attack")]: t(`${ATTACK.length}手`, `${ATTACK.length} steps`),
            },
          },
        },
      },
      {
        id: "lowe-fix",
        kind: "fix",
        title: t("2通目に名前を入れる", "Name B in message 2"),
        actor: "b",
        to: ["a", "checker"],
        summary: t(
          `B が2通目を ${LOWE_MISMATCH.held} にすると、検査器は攻撃を見つけない（認証は${holdsText(LOWE.holds)}）`,
          `If B sends ${LOWE_MISMATCH.held} as message 2, the checker finds no attack (authentication ${holdsText(LOWE.holds)})`,
        ),
        explain: t(
          `Lowe の修正では、B は2通目に自分の名前を入れる。I と話している A は ${LOWE_MISMATCH.expected} を待つが、I が持っているのは B が書いた ${LOWE_MISMATCH.held} で、Nb を知らない I には名前を書き換えられない。A がこれを受け取らないので、攻撃の3段目で止まる。`,
          `In Lowe's fix, B puts its own name in the second message. A, talking to I, waits for ${LOWE_MISMATCH.expected}, but what I holds is ${LOWE_MISMATCH.held}, written by B, and I does not know Nb so it cannot change the name. A will not accept it, so the attack stops at its third stage.`,
        ),
        set: {
          b: {
            tone: "wait",
            rows: {
              [t("出した", "signalled")]: null,
              [t("2通目", "message 2")]: LOWE_MISMATCH.held,
            },
          },
          a: {
            tone: "wait",
            rows: {
              [t("出した", "signalled")]: null,
              [t("待つ2通目", "expects")]: LOWE_MISMATCH.expected,
            },
          },
          intruder: {
            tone: "wait",
            rows: {
              [knowsRow]: LOWE_ATTEMPT_KNOWLEDGE.nonces.join(", "),
              [heldRow]: LOWE_ATTEMPT_KNOWLEDGE.ciphertexts.join(", "),
            },
          },
          checker: {
            tone: LOWE.holds ? "ok" : "bad",
            rows: {
              [t("比べ方", "check")]: null,
              [t("Lowe の修正", "Lowe's fix")]: holdsText(LOWE.holds),
            },
          },
        },
      },
      {
        id: "honest-run",
        kind: "test",
        title: t("正直な実行は通る", "Honest runs still work"),
        actor: "checker",
        to: ["a", "b"],
        summary: t(
          `修正版でも、A と B が I を通して正直にやり取りする${HONEST_RUN.lowe.length}手は${LOWE_HONEST ? "最後まで通る" : "通らない"}`,
          `In the fixed version, the ${HONEST_RUN.lowe.length}-step honest exchange between A and B through I ${LOWE_HONEST ? "runs to the end" : "does not run to the end"}`,
        ),
        explain: t(
          "性質が成り立っても、何も起きないモデルなら空虚に成り立ってしまう。そこで、A が B と始めて B が commit.B.A を出すまでの正直な並びを、修正版が起こせることを別に確かめた。running.A.B の後の commit.B.A は仕様が許すので、この並びは反例にならない。",
          "A property can also hold vacuously if nothing ever happens in the model. So we separately checked that the fixed version can produce the honest sequence in which A starts with B and B signals commit.B.A. The spec allows commit.B.A after running.A.B, so this sequence is not a counterexample.",
        ),
        set: {
          a: {
            tone: "ok",
            rows: {
              [believesRow]: "B",
              [t("待つ2通目", "expects")]: null,
              [t("出した", "signalled")]: "running.A.B",
            },
          },
          b: {
            tone: "ok",
            rows: {
              [believesRow]: "A",
              [t("2通目", "message 2")]: null,
              [t("出した", "signalled")]: "commit.B.A",
            },
          },
          intruder: {
            tone: "idle",
            rows: {
              [knowsRow]: HONEST_KNOWLEDGE.nonces.join(", "),
              [heldRow]: t(
                `${HONEST_KNOWLEDGE.ciphertexts.length}通（開けない）`,
                `${HONEST_KNOWLEDGE.ciphertexts.length} (cannot open)`,
              ),
            },
          },
          checker: {
            rows: {
              [t("正直な実行", "honest run")]: LOWE_HONEST
                ? t("通る", "passes")
                : t("通らない", "fails"),
            },
          },
        },
        simplified: t(
          "A と B はそれぞれ1回だけ実行し、nonce は Na・Nb・Ni の3つ、名前は A・B・I に固定した。侵入者が扱う文も、A と B が送る文・受け付ける文に限った。実物の解析（Lowe の FDR の解析など）は、実行の回数や侵入者の作れる文を増やして調べる。暗号は破れないと仮定している。",
          "A and B each run only once, and the nonces are fixed to Na, Nb and Ni and the names to A, B and I. The messages the intruder deals with are limited to those A and B send and accept. Real analyses (such as Lowe's analysis with FDR) increase the number of runs and the messages the intruder can build. The encryption is assumed to be unbreakable.",
        ),
      },
    ],
    lab: {
      title: t("版と侵入者の力を変える", "Change the version and the intruder"),
      hint: t(
        "版（0=元の版、1=Lowe の修正）、A が I とも話すか（1=話す、0=B とだけ）、侵入者が暗号文を送り直せるか（1=できる、0=できない）を入れる。攻撃が見つかるのは、元の版で、A が I とも話し、送り直せるときだけ。",
        "Enter the version (0 = original, 1 = Lowe's fix), whether A also talks to I (1 = yes, 0 = only B) and whether the intruder can resend ciphertexts (1 = yes, 0 = no). An attack is found only for the original, when A also talks to I and resending is allowed.",
      ),
      inputs: [
        { id: "version", label: t("版", "Version"), initial: "0" },
        { id: "talksToI", label: t("A が I と話す", "A talks to I"), initial: "1" },
        { id: "replay", label: t("送り直せる", "Can resend"), initial: "1" },
      ],
      compute: (values): Field[] => {
        const options: ProtocolOptions = {
          version: parseFlag(values.version, false) ? "lowe" : "original",
          partners: parseFlag(values.talksToI, true) ? ["B", "I"] : ["B"],
          canReplay: parseFlag(values.replay, true),
        };
        const result = checkAuthentication(options);
        const states = explore(protocolSystem(options), NS_ENV).stateCount;
        const fields: Field[] = [
          {
            label: t("認証", "Authentication"),
            value: holdsText(result.holds),
            tone: result.holds ? "ok" : "bad",
          },
          { label: t("状態の数", "States"), value: String(states) },
        ];
        if (result.counterexample) {
          fields.push({
            label: t("攻撃", "Attack"),
            value: t(
              `${result.counterexample.length}手: ${listText(result.counterexample)}`,
              `${result.counterexample.length} steps: ${listText(result.counterexample)}`,
            ),
          });
        }
        return fields;
      },
    },
  };
}
