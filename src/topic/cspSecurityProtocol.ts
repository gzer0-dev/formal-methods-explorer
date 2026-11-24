// 暗号プロトコルの攻撃を検査器で見つける（Roscoe TPC 15.4 の範囲。題材は古典の Needham–Schroeder 公開鍵プロトコルと
// Lowe の中間者攻撃。侵入者の書き方はこのサイトの自作で、知識は小さく固定した集まりにしてある）。
//
// プロトコル（A が始め、B が応じる。{…}pkX は X の公開鍵で暗号化した文で、X だけが開ける）:
//   1. A → B: {Na,A}pkB   2. B → A: {Na,Nb}pkA（Lowe の直しでは {Na,Nb,B}pkA）   3. A → B: {Nb}pkB
// 侵入者 I はネットワークそのもの: 送られた文はすべて I が受け取り、届く文はすべて I が出す。I は正規の利用者でもあり
// （A は I と話すこともある）、pkI の文は開けて nonce を知る。開けない文はそのまま覚え、送り手の名前や宛先を変えて届け直せる
// （canRedirect を外すと、元の送り手・宛先のままの中継だけになる）。
// 守りたい性質: B が「A と確かめた」（commit.B.A）なら、その前に A が B と話そうとしていた（running.A.B）。
// produces: NS_ENV・protocolSystem・checkAuthentication・checkAuthenticationHidden・intruderKnowledgeAfter・intruderCanDeliver・
//           ATTACK_EXPECTED・HONEST_RUN・messageOf ／ consumes: csp.ts の演算子と詳細化。

import {
  type Env,
  ext,
  hide,
  par,
  pre,
  type Proc,
  ref,
  STOP,
  traceRefines,
} from "./csp";

export type Version = "original" | "lowe";
type Agent = "A" | "B" | "I";

const NONCES = ["Na", "Nb", "Ni"] as const;
/** 侵入者が初めから知っている nonce（自分のもの）。 */
const INTRUDER_NONCE = "Ni";
/** B が応じる相手として受け付ける名前（I は正規の利用者でもある）。 */
const B_PEERS: Agent[] = ["A", "I"];

export interface ProtocolOptions {
  version: Version;
  /** A が話しかける相手の候補。既定は B と I（I と正規に話すことが攻撃の入口になる）。 */
  partners?: Agent[];
  /**
   * 侵入者が聞いた暗号文を、送り手の名前や宛先を変えて届けられるか。既定は変えられる。
   * false でも、元の送り手・宛先のままの中継はできる（できないと正直な実行まで止まり、性質が空虚に成り立つため）。
   */
  canRedirect?: boolean;
}

const encrypt = (contents: string[], key: Agent) => `{${contents.join(",")}}pk${key}`;
const message1 = (nonce: string, name: Agent, key: Agent) =>
  encrypt([nonce, name], key);
const message2 = (
  version: Version,
  first: string,
  second: string,
  responder: Agent,
  key: Agent,
) =>
  version === "lowe"
    ? encrypt([first, second, responder], key)
    : encrypt([first, second], key);
const message3 = (nonce: string, key: Agent) => encrypt([nonce], key);

const send = (from: Agent, to: Agent, message: string) =>
  `send.${from}.${to}.${message}`;
/** recv.受け手.名乗った送り手.文。送り手の名前は侵入者がいくらでも偽れる。 */
const recv = (to: Agent, claimed: Agent, message: string) =>
  `recv.${to}.${claimed}.${message}`;

/** イベント send.X.Y.文 / recv.X.Y.文 から、文の部分を取り出す。 */
export function messageOf(event: string): string | null {
  const match = event.match(/^(?:send|recv)\.[ABI]\.[ABI]\.(\{.*\}pk[ABI])$/);
  return match ? match[1]! : null;
}

function parseMessage(message: string): { contents: string[]; key: string } {
  const match = message.match(/^\{(.*)\}pk([ABI])$/)!;
  return { contents: match[1]!.split(","), key: match[2]! };
}

interface Alphabet {
  sends: string[];
  recvs: string[];
  signals: string[];
}

function partnersOf(options: ProtocolOptions): Agent[] {
  return options.partners ?? ["B", "I"];
}

/** 正直な A と B が送る文・受け付ける文の全部（侵入者はこの範囲だけを相手にすれば足りる）。 */
function alphabetOf(version: Version, partners: Agent[]): Alphabet {
  const sends: string[] = [];
  const recvs: string[] = [];
  for (const partner of partners) {
    sends.push(send("A", partner, message1("Na", "A", partner)));
    for (const nonce of NONCES) {
      recvs.push(recv("A", partner, message2(version, "Na", nonce, partner, "A")));
      sends.push(send("A", partner, message3(nonce, partner)));
    }
  }
  for (const peer of B_PEERS) {
    for (const nonce of NONCES) {
      recvs.push(recv("B", peer, message1(nonce, peer, "B")));
      sends.push(send("B", peer, message2(version, nonce, "Nb", "B", peer)));
    }
    recvs.push(recv("B", peer, message3("Nb", "B")));
  }
  const signals = [
    ...partners.map((partner) => `running.A.${partner}`),
    ...B_PEERS.map((peer) => `commit.B.${peer}`),
  ];
  return { sends, recvs, signals };
}

// 侵入者の知識は「知っている nonce」と「開けずに覚えた暗号文」を並べ替えて | でつないだ文字列1つで持つ（状態を数えやすくするため）。
function parseKnowledge(knowledge: string): Set<string> {
  return new Set(knowledge === "" ? [] : knowledge.split("|"));
}
function encodeKnowledge(facts: Set<string>): string {
  return [...facts].sort().join("|");
}

// 宛先を変えられないときは、暗号文を「受け手<送り手:文」の形で覚える（届けてよいのは、その受け手へ、その送り手の名前でだけ）。
const routeFact = (to: string, from: string, message: string) =>
  `${to}<${from}:${message}`;

/** 送信イベントから侵入者が覚えること。pkI の文は開けて nonce を知り、それ以外は暗号文のまま覚える。 */
function learn(
  facts: Set<string>,
  sendEvent: string,
  canRedirect: boolean,
): Set<string> {
  const [, from, to] = sendEvent.split(".");
  const message = messageOf(sendEvent)!;
  const { contents, key } = parseMessage(message);
  const next = new Set(facts);
  if (key === "I") {
    for (const item of contents)
      if (item.startsWith("N") && item !== INTRUDER_NONCE) next.add(item);
  } else {
    next.add(canRedirect ? message : routeFact(to!, from!, message));
  }
  return next;
}

/**
 * 侵入者がこの受信イベント（recv.受け手.名乗る送り手.文）を起こせるか: 覚えた暗号文を届けるか
 * （宛先を変えられないなら元の送り手・宛先のままだけ）、中身の nonce を全部知っていて自分で暗号化できるか。
 */
function canProduce(facts: Set<string>, recvEvent: string): boolean {
  const [, to, claimed] = recvEvent.split(".");
  const message = messageOf(recvEvent)!;
  if (facts.has(message) || facts.has(routeFact(to!, claimed!, message))) return true;
  const { contents } = parseMessage(message);
  return contents.every(
    (item) => !item.startsWith("N") || item === INTRUDER_NONCE || facts.has(item),
  );
}

function optionsKey(options: ProtocolOptions): [Version, string, number] {
  return [
    options.version,
    partnersOf(options).join(""),
    options.canRedirect === false ? 0 : 1,
  ];
}

const alphabetCache = new Map<string, Alphabet>();
function cachedAlphabet(version: Version, partners: string): Alphabet {
  const key = `${version}|${partners}`;
  let alphabet = alphabetCache.get(key);
  if (!alphabet) {
    alphabet = alphabetOf(version, partners.split("") as Agent[]);
    alphabetCache.set(key, alphabet);
  }
  return alphabet;
}

export const NS_ENV: Env = {
  // A は相手を選んで1回だけ始める。2通目で自分の Na が返ってくれば、running を出してから3通目を送る。
  INITIATOR: (version: Version, partners: string) =>
    ext(
      ...(partners.split("") as Agent[]).map((partner) =>
        pre(
          send("A", partner, message1("Na", "A", partner)),
          ref("INITIATOR2", version, partner),
        ),
      ),
    ),
  INITIATOR2: (version: Version, partner: Agent) =>
    ext(
      ...NONCES.map((nonce) =>
        pre(
          recv("A", partner, message2(version, "Na", nonce, partner, "A")),
          pre(
            `running.A.${partner}`,
            pre(send("A", partner, message3(nonce, partner)), STOP),
          ),
        ),
      ),
    ),
  // B は1回だけ応じる。1通目に書かれた名前を相手と信じ、3通目で自分の Nb が返ってくれば commit する。
  RESPONDER: (version: Version) =>
    ext(
      ...B_PEERS.flatMap((peer) =>
        NONCES.map((nonce) =>
          pre(
            recv("B", peer, message1(nonce, peer, "B")),
            pre(
              send("B", peer, message2(version, nonce, "Nb", "B", peer)),
              pre(recv("B", peer, message3("Nb", "B")), pre(`commit.B.${peer}`, STOP)),
            ),
          ),
        ),
      ),
    ),
  // 侵入者＝ネットワーク。送られた文はいつでも受け取って覚え、出せる文はいつでも届けられる。
  INTRUDER: (version: Version, partners: string, replay: number, knowledge: string) => {
    const facts = parseKnowledge(knowledge);
    const alphabet = cachedAlphabet(version, partners);
    const canRedirect = replay === 1;
    const hears = alphabet.sends.map((event) =>
      pre(
        event,
        ref(
          "INTRUDER",
          version,
          partners,
          replay,
          encodeKnowledge(learn(facts, event, canRedirect)),
        ),
      ),
    );
    const delivers = alphabet.recvs
      .filter((event) => canProduce(facts, event))
      .map((event) =>
        pre(event, ref("INTRUDER", version, partners, replay, knowledge)),
      );
    return ext(...hears, ...delivers);
  },
  // 性質の監視役: running.A.B が起きるまでは commit.B.A を起こせない。ほかのイベントは何でも許す。
  AUTH: (version: Version, partners: string, isRunning: number) => {
    const alphabet = cachedAlphabet(version, partners);
    const events = [...alphabet.sends, ...alphabet.recvs, ...alphabet.signals].filter(
      (event) => isRunning === 1 || event !== "commit.B.A",
    );
    return ext(
      ...events.map((event) =>
        pre(
          event,
          ref("AUTH", version, partners, event === "running.A.B" ? 1 : isRunning),
        ),
      ),
    );
  },
  // 隠して比べるときの仕様（ProB の照合と同じ形）。
  AUTH_HIDDEN: () => ext(pre("running.A.B", pre("commit.B.A", STOP)), STOP),
};

/** 正直な A・B と侵入者を並べた全体。A・B は侵入者と送受信のイベントで同期し、A と B どうしは直接つながらない。 */
export function protocolSystem(options: ProtocolOptions): Proc {
  const [version, partners, replay] = optionsKey(options);
  const alphabet = cachedAlphabet(version, partners);
  const honest = par(
    ref("INITIATOR", version, partners),
    [],
    ref("RESPONDER", version),
  );
  return par(
    honest,
    [...alphabet.sends, ...alphabet.recvs],
    ref("INTRUDER", version, partners, replay, ""),
  );
}

/** 認証の性質をトレース詳細化で調べる。他のイベントを隠さないので、反例がそのまま最短の攻撃の手順になる。 */
export function checkAuthentication(options: ProtocolOptions) {
  const [version, partners] = optionsKey(options);
  return traceRefines(
    ref("AUTH", version, partners, 0),
    protocolSystem(options),
    NS_ENV,
  );
}

/** running.A.B と commit.B.A 以外を隠して比べる（ProB での照合と同じ比べ方。反例は [commit.B.A] だけになる）。 */
export function checkAuthenticationHidden(options: ProtocolOptions) {
  const [version, partners] = optionsKey(options);
  const alphabet = cachedAlphabet(version, partners);
  const hidden = [...alphabet.sends, ...alphabet.recvs, ...alphabet.signals].filter(
    (event) => event !== "running.A.B" && event !== "commit.B.A",
  );
  return traceRefines(
    ref("AUTH_HIDDEN"),
    hide(protocolSystem(options), hidden),
    NS_ENV,
  );
}

export interface IntruderKnowledge {
  /** 知っている nonce（自分の Ni を含む）。 */
  nonces: string[];
  /** 開けずに覚えた暗号文。 */
  ciphertexts: string[];
}

function factsAfter(trace: string[], canRedirect: boolean): Set<string> {
  let facts = new Set<string>();
  for (const event of trace)
    if (event.startsWith("send.")) facts = learn(facts, event, canRedirect);
  return facts;
}

/** 並びの中の送信をたどって、侵入者が何を知ったかを返す（図のカードに出す）。 */
export function intruderKnowledgeAfter(
  trace: string[],
  canRedirect: boolean,
): IntruderKnowledge {
  const all = [...factsAfter(trace, canRedirect)];
  return {
    nonces: [...all.filter((fact) => fact.startsWith("N")), INTRUDER_NONCE].sort(),
    ciphertexts: all
      .filter((fact) => fact.includes("{"))
      .map((fact) => fact.slice(fact.indexOf("{")))
      .sort(),
  };
}

/** 並びの後に、侵入者がこの受信イベントを起こせるか（図で「ここで行き詰まる」を見せるのに使う）。 */
export function intruderCanDeliver(
  trace: string[],
  canRedirect: boolean,
  recvEvent: string,
): boolean {
  return canProduce(factsAfter(trace, canRedirect), recvEvent);
}

/** Lowe の攻撃の手順（テストで検査器の反例と一致することを見張る）。 */
export const ATTACK_EXPECTED = [
  send("A", "I", message1("Na", "A", "I")),
  recv("B", "A", message1("Na", "A", "B")),
  send("B", "A", message2("original", "Na", "Nb", "B", "A")),
  recv("A", "I", message2("original", "Na", "Nb", "B", "A")),
  "running.A.I",
  send("A", "I", message3("Nb", "I")),
  recv("B", "A", message3("Nb", "B")),
  "commit.B.A",
];

/** A と B が侵入者を通して正直にやり取りしたときの並び（侵入者は文をそのまま届ける）。 */
function honestRun(version: Version): string[] {
  const second = message2(version, "Na", "Nb", "B", "A");
  return [
    send("A", "B", message1("Na", "A", "B")),
    recv("B", "A", message1("Na", "A", "B")),
    send("B", "A", second),
    recv("A", "B", second),
    "running.A.B",
    send("A", "B", message3("Nb", "B")),
    recv("B", "A", message3("Nb", "B")),
    "commit.B.A",
  ];
}

export const HONEST_RUN: Record<Version, string[]> = {
  original: honestRun("original"),
  lowe: honestRun("lowe"),
};

/** Lowe の直しで、A が I との実行で待つ2通目と、侵入者が持っている（B が書いた）2通目。 */
export const LOWE_MISMATCH = {
  expected: message2("lowe", "Na", "Nb", "I", "A"),
  held: message2("lowe", "Na", "Nb", "B", "A"),
};

/** プロトコルの3通（送り手・受け手・文）。正直な実行の送信から取り出す（図の説明に使う）。 */
export function protocolMessages(
  version: Version,
): { from: string; to: string; message: string }[] {
  return HONEST_RUN[version]
    .filter((event) => event.startsWith("send."))
    .map((event) => {
      const [, from, to] = event.split(".");
      return { from: from!, to: to!, message: messageOf(event)! };
    });
}

/** Lowe の修正版で、攻撃と同じ始め方（A が I と始め、I が A を名乗って B に送る）をした3手。 */
export const LOWE_ATTEMPT = [
  send("A", "I", message1("Na", "A", "I")),
  recv("B", "A", message1("Na", "A", "B")),
  send("B", "A", message2("lowe", "Na", "Nb", "B", "A")),
];
