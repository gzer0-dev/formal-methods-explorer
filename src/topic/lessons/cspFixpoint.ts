import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { divergence, STOP, traceRefines } from "../csp";
import {
  approximation,
  FIXPOINT,
  isGuarded,
  type Recursion,
  solvesEquation,
  traceCountsByLength,
} from "../cspFixpoint";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

// 長さ6まで数える（券売機は1周で2イベントなので、近似3回で長さ6まで一致する）。
const MAX_LENGTH = 6;
const SHOWN_ROUNDS = [0, 1, 2, 3] as const;
const { ticket, coin, self } = FIXPOINT;

const WHOLE_COUNTS = traceCountsByLength(ticket.recursive, ticket.env, MAX_LENGTH);
const ROUND_COUNTS = SHOWN_ROUNDS.map((n) =>
  traceCountsByLength(approximation(ticket, n), ticket.env, MAX_LENGTH),
);

/** 近似のトレースの本数が、長さいくつまで P と同じか。 */
function agreedLength(counts: number[], whole: number[]): number {
  let length = -1;
  while (length + 1 < counts.length && counts[length + 1] === whole[length + 1])
    length += 1;
  return length;
}

const AGREED = ROUND_COUNTS.map((counts) => agreedLength(counts, WHOLE_COUNTS));
// 1回当てるごとに一致する長さがいくつ延びるか（券売機の1周のイベント数）。
const ROUND_GAIN = AGREED[1]! - AGREED[0]!;
// どの近似も P そのものではない（P ⊑T Fⁿ は成り立つが、逆は長いトレースで破れる）。
const LAST_ROUND = SHOWN_ROUNDS[SHOWN_ROUNDS.length - 1]!;
const LAST_APPROX = approximation(ticket, LAST_ROUND);
const LIMIT_REFINES = traceRefines(ticket.recursive, LAST_APPROX, ticket.env).holds;
const NOT_YET = traceRefines(LAST_APPROX, ticket.recursive, ticket.env);
const P_SOLVES = solvesEquation(ticket.body, ticket.recursive, ticket.env);
const STOP_SOLVES = solvesEquation(ticket.body, STOP, ticket.env);
// ガードの無い P = P。
const SELF_COUNTS = traceCountsByLength(approximation(self, LAST_ROUND), self.env, 4);
const SELF_SOLVES_STOP = solvesEquation(
  self.body,
  STOP,
  ticket.env,
).failuresDivergences;
const SELF_SOLVES_TICKET = solvesEquation(
  self.body,
  ticket.recursive,
  ticket.env,
).failuresDivergences;
const SELF_DIVERGES = divergence(self.unwound, self.env);
const TICKET_DIVERGES = divergence(ticket.unwound, ticket.env);
const TICKET_GUARDED = isGuarded(ticket.body);
const SELF_GUARDED = isGuarded(self.body);

const countsText = (counts: number[]) => counts.join(", ");

const EXAMPLES: Recursion[] = [ticket, coin, self];

function parseIndex(
  text: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

export function cspFixpointLesson(language: Language): Lesson {
  const t = translator(language);
  const yesNo = (value: boolean) => (value ? t("はい", "yes") : t("いいえ", "no"));
  const holdsText = (holds: boolean) =>
    holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
  const countsRow = t("長さごとの本数", "traces by length");
  const roundRow = t("当てた回数", "applications");
  const agreeRow = t("P と一致", "agrees with P");
  const agreeText = (length: number) =>
    t(`長さ${length}まで`, `up to length ${length}`);
  const roundStep = (index: number) => ({
    approx: {
      isHidden: false,
      tone: "wait" as const,
      rows: {
        [roundRow]: String(SHOWN_ROUNDS[index]),
        [countsRow]: countsText(ROUND_COUNTS[index]!),
        [agreeRow]: agreeText(AGREED[index]!),
      },
    },
  });
  return {
    id: "csp-fixpoint",
    category: "csp",
    title: t("再帰の意味は不動点", "Recursion means a fixed point"),
    subtitle: t(
      "STOP から関数を繰り返し当てて、再帰の意味に近づく",
      "Approach a recursion by applying its function to STOP again and again",
    ),
    summary: t(
      `再帰 P = F(P) を方程式と読み、STOP から F を当てるたびにトレースが長さ${ROUND_GAIN}ずつ P と一致していく。極限が P で、P は方程式を満たす。ガードの無い P = P は何回当てても STOP のままで、STOP も券売機も方程式を満たし、展開を τ と見ると${SELF_DIVERGES ? "発散する" : "発散しない"}。`,
      `Read the recursion P = F(P) as an equation: each time F is applied to STOP, the traces agree with P ${ROUND_GAIN} events further. The limit is P, and P solves the equation. The unguarded P = P stays at STOP however often it is applied, both STOP and the ticket machine solve it, and with unwinding counted as τ it ${SELF_DIVERGES ? "diverges" : "does not diverge"}.`,
    ),
    intro: [
      t(
        "CSP では P = coin → … → P のように、プロセスを自分自身を使って定義する。これは「P とは、この式を満たすもの」という方程式で、式を P に当てても P が変わらない点（不動点）が、再帰で書いたプロセスの意味になる。",
        "In CSP a process is often defined in terms of itself, such as P = coin → … → P. This is an equation saying that P is whatever satisfies it, and the point where applying the right-hand side to P leaves P unchanged (a fixed point) is what the recursive definition means.",
      ),
      t(
        "テストで再帰を動かすと、何周かしたところで止めるしかない。意味を決めるのはその先も含めた全部のトレースで、何も起こせない STOP から右辺を1回ずつ当てた近似を並べると、全体に近づいていく様子が見える。一方、P = P のように右辺の先頭にイベントが無い再帰は、何回当てても近づかず、意味が1つに決まらない。",
        "When you run a recursion in a test, you can only stop after a few rounds. Its meaning is the whole set of traces, including what comes later, and lining up approximations that apply the right-hand side once more each time, starting from STOP (which does nothing), shows them closing in on the whole. A recursion with no event in front of the call, such as P = P, never gets closer however often it is applied, so its meaning is not settled.",
      ),
      t(
        "図では、上の段の近似のカードに出る「長さごとの本数」が、1回当てるごとにどこまで P と同じになるかを追う。後半は下の段に P = P を出し、近似が動かないこと・複数のプロセスが方程式を満たすこと・展開が止まらないことを見る。",
        `In the diagram, follow "traces by length" on the approximation card in the top row, and how far it matches P after each application. In the second half, P = P appears in the bottom row: watch the approximation stay put, several processes satisfy the equation, and unwinding never stop.`,
      ),
    ],
    facts: [
      {
        label: t("P のトレースの本数", "Traces of P"),
        value: t(
          `長さ0〜${MAX_LENGTH}で ${countsText(WHOLE_COUNTS)}`,
          `${countsText(WHOLE_COUNTS)} for lengths 0-${MAX_LENGTH}`,
        ),
      },
      {
        label: t("近似と P が一致する長さ", "Length where approximation agrees"),
        value: t(
          `${SHOWN_ROUNDS.map((n, i) => `${n}回で${AGREED[i]}`).join("、")}`,
          `${SHOWN_ROUNDS.map((n, i) => `${n}: ${AGREED[i]}`).join(", ")}`,
        ),
      },
      {
        label: t("P = P の近似", "Approximating P = P"),
        value: t(
          `${LAST_ROUND}回当てても長さごとに ${countsText(SELF_COUNTS)}（STOP のまま）`,
          `${countsText(SELF_COUNTS)} by length after ${LAST_ROUND} applications (still STOP)`,
        ),
        tone: "bad",
      },
      {
        label: t("参考", "Reference"),
        value: t(
          `${TPC_BOOK} 3.1節（隠蔽とガード）・7章（操作的意味論）・8.2節（トレースのモデル）・8.3節（失敗発散のモデル）・9.2節（不動点の解析）`,
          `${TPC_BOOK_EN}, §3.1 (hiding and guardedness), ch. 7 (operational semantics), §8.2 (the traces model), §8.3 (the failures/divergences model), §9.2 (analysing fixed points)`,
        ),
      },
    ],
    actors: [
      {
        id: "equation",
        label: t("方程式", "Equation"),
        sublabel: "P = F(P)",
        icon: "spec",
        x: 20,
        y: 27,
      },
      {
        id: "approx",
        label: t("近似", "Approximation"),
        sublabel: "Fⁿ(STOP)",
        icon: "process",
        x: 50,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "machine",
        label: t("券売機 P", "Ticket machine P"),
        sublabel: t("再帰で書いた本物", "the recursion itself"),
        icon: "process",
        x: 80,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("トレースを比べる", "compares traces"),
        icon: "checker",
        x: 35,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "self",
        label: "P = P",
        sublabel: t("ガードの無い再帰", "unguarded recursion"),
        icon: "process",
        x: 65,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "equation", to: "approx" },
      { from: "approx", to: "machine" },
      { from: "checker", to: "self" },
    ],
    steps: [
      {
        id: "equation",
        kind: "spec",
        title: t("再帰を方程式で読む", "Read recursion as an equation"),
        actor: "equation",
        summary: t(
          "P = coin → (ticket → P □ refund → P) を、X = F(X) という方程式と読む",
          "Read P = coin → (ticket → P □ refund → P) as the equation X = F(X)",
        ),
        explain: t(
          "券売機はお金を受け取ると、券を出すか返金するかを客が選べ、また最初に戻る。右辺の P の所を X に置き換えた F(X) = coin → (ticket → X □ refund → X) は、プロセスを受け取ってプロセスを返す関数である。P は F(P) = P を満たすもの、つまり F の不動点として決まる。",
          "The ticket machine takes a coin, lets the customer choose a ticket or a refund, and starts again. Replacing P on the right with X gives F(X) = coin → (ticket → X □ refund → X), a function that takes a process and returns a process. P is what satisfies F(P) = P, that is, a fixed point of F.",
        ),
        set: {
          equation: {
            rows: {
              [t("1周のイベント", "events per round")]: String(ROUND_GAIN),
              [t("ガード", "guarded")]: yesNo(TICKET_GUARDED),
            },
          },
        },
      },
      {
        id: "start",
        kind: "explore",
        title: t("STOP から始める", "Start from STOP"),
        actor: "approx",
        summary: t(
          `F⁰(STOP) = STOP のトレースは空の並びだけ（長さごとに ${countsText(ROUND_COUNTS[0]!)}）`,
          `F⁰(STOP) = STOP has only the empty trace (${countsText(ROUND_COUNTS[0]!)} by length)`,
        ),
        explain: t(
          "何も起こせない STOP は、トレースが一番少ないプロセスである。トレースのモデルでは、ここから F を当てて大きくしていき、たどり着く一番小さい不動点を再帰の意味にする。",
          "STOP, which can do nothing, is the process with the fewest traces. In the traces model you start here, apply F to grow it, and take the least fixed point you reach as the meaning of the recursion.",
        ),
        set: roundStep(0),
      },
      {
        id: "once",
        kind: "explore",
        title: t("1回当てる", "Apply F once"),
        actor: "approx",
        to: ["machine"],
        summary: t(
          `F¹(STOP) は長さごとに ${countsText(ROUND_COUNTS[1]!)} 本で、長さ${AGREED[1]}まで P と同じ`,
          `F¹(STOP) has ${countsText(ROUND_COUNTS[1]!)} traces by length and agrees with P up to length ${AGREED[1]}`,
        ),
        explain: t(
          `F(STOP) = coin → (ticket → STOP □ refund → STOP) は、1周だけして止まる。1周は2イベントなので、長さ${AGREED[1]}までのトレースは本物の P と同じで、その先が無い。`,
          `F(STOP) = coin → (ticket → STOP □ refund → STOP) does one round and stops. A round is two events, so its traces match the real P up to length ${AGREED[1]} and there is nothing beyond.`,
        ),
        set: {
          ...roundStep(1),
          machine: {
            isHidden: false,
            rows: { [countsRow]: countsText(WHOLE_COUNTS) },
          },
        },
      },
      {
        id: "again",
        kind: "explore",
        title: t("2回・3回と当てる", "Apply it again and again"),
        actor: "approx",
        to: ["machine"],
        summary: t(
          `2回で長さ${AGREED[2]}、${LAST_ROUND}回で長さ${AGREED[3]}まで P と一致する`,
          `Two applications agree up to length ${AGREED[2]}, ${LAST_ROUND} up to length ${AGREED[3]}`,
        ),
        explain: t(
          `1回当てるごとに1周ぶん先まで決まり、一致する長さが${ROUND_GAIN}ずつ延びる。近似はどれも前の近似のトレースを全部含む（単調に増える）。${LAST_ROUND}回で長さごとに ${countsText(ROUND_COUNTS[3]!)} 本になった。`,
          `Each application settles one more round, so the matching length grows by ${ROUND_GAIN}. Every approximation contains all the traces of the one before (they grow monotonically). After ${LAST_ROUND} applications the counts are ${countsText(ROUND_COUNTS[3]!)}.`,
        ),
        set: roundStep(3),
      },
      {
        id: "limit",
        kind: "fix",
        title: t("極限が P になる", "The limit is P"),
        actor: "checker",
        to: ["approx", "machine"],
        summary: t(
          `P ⊑T F${LAST_ROUND}(STOP) は${holdsText(LIMIT_REFINES)}が、逆は長さ${NOT_YET.counterexample?.length ?? 0}のトレースで破れる。P は方程式を満たし、STOP は満たさない`,
          `P ⊑T F${LAST_ROUND}(STOP) ${holdsText(LIMIT_REFINES)}, but the reverse fails at a trace of length ${NOT_YET.counterexample?.length ?? 0}. P solves the equation; STOP does not`,
        ),
        explain: t(
          `どの近似も P のトレースの一部で（P ⊑T Fⁿ(STOP)）、P そのものではない。近似を全部合わせた極限が P のトレースになる。確かめると F(P) と P はトレース・失敗・失敗発散のどれでも${P_SOLVES.failuresDivergences ? "等しく" : "等しくなく"}、F(STOP) と STOP はトレースで${STOP_SOLVES.traces ? "等しい" : "違う"}。`,
          `Every approximation is part of P's traces (P ⊑T Fⁿ(STOP)) and none is P itself. The limit, the union of all approximations, gives the traces of P. Checking, F(P) and P are ${P_SOLVES.failuresDivergences ? "equal" : "not equal"} in traces, failures and failures/divergences alike, while F(STOP) and STOP ${STOP_SOLVES.traces ? "are equal" : "differ"} in traces.`,
        ),
        set: {
          approx: { tone: "idle" },
          machine: {
            tone: "ok",
            rows: { [t("F(P) = P", "F(P) = P")]: yesNo(P_SOLVES.traces) },
          },
          checker: {
            isHidden: false,
            tone: LIMIT_REFINES ? "ok" : "bad",
            rows: {
              [`P ⊑T F${LAST_ROUND}`]: holdsText(LIMIT_REFINES),
              [`F${LAST_ROUND} ⊑T P`]: holdsText(NOT_YET.holds),
              [t("F(STOP) = STOP", "F(STOP) = STOP")]: yesNo(STOP_SOLVES.traces),
            },
          },
        },
      },
      {
        id: "self",
        kind: "found",
        title: t("ガードの無い P = P", "Unguarded: P = P"),
        actor: "self",
        summary: t(
          `F(X) = X は何回当てても STOP のまま（長さごとに ${countsText(SELF_COUNTS)}）`,
          `F(X) = X stays at STOP however often it is applied (${countsText(SELF_COUNTS)} by length)`,
        ),
        explain: t(
          "P = P は右辺の先頭にイベントが無く、自分をそのまま呼ぶ。F(X) = X なので、STOP に当てても STOP が返り、近似は1歩も進まない。何周しても次に何をするかが決まらない再帰である。",
          "P = P has no event in front of the call; it calls itself directly. Since F(X) = X, applying it to STOP gives STOP back, and the approximation never moves. However often it is unwound, what it does next is never settled.",
        ),
        set: {
          checker: { tone: "idle" },
          self: {
            isHidden: false,
            tone: "bad",
            rows: {
              "F(X)": "X",
              [t("ガード", "guarded")]: yesNo(SELF_GUARDED),
              [countsRow]: countsText(SELF_COUNTS),
            },
          },
        },
      },
      {
        id: "many",
        kind: "found",
        title: t("解が1つに決まらない", "No unique solution"),
        actor: "checker",
        to: ["self"],
        summary: t(
          `X = X は STOP も券売機も満たす（STOP: ${yesNo(SELF_SOLVES_STOP)}、券売機: ${yesNo(SELF_SOLVES_TICKET)}）`,
          `X = X is satisfied by STOP and by the ticket machine alike (STOP: ${yesNo(SELF_SOLVES_STOP)}, ticket machine: ${yesNo(SELF_SOLVES_TICKET)})`,
        ),
        explain: t(
          "どんなプロセスを入れても F(Q) = Q なので、方程式はプロセスを1つに決めない。そこで、どの不動点を意味にするかをモデルが決める。トレースのモデルは一番小さい STOP を選び、失敗発散のモデルは一番情報の少ない「発散」を選ぶ。",
          "Whatever process you put in, F(Q) = Q, so the equation does not pick out one process. The model then decides which fixed point is the meaning: the traces model takes the smallest, STOP; the failures/divergences model takes the least informative one, divergence.",
        ),
        set: {
          checker: {
            tone: "bad",
            rows: {
              [`P ⊑T F${LAST_ROUND}`]: null,
              [`F${LAST_ROUND} ⊑T P`]: null,
              [t("F(STOP) = STOP", "F(STOP) = STOP")]: null,
              [t("STOP は解", "STOP solves")]: yesNo(SELF_SOLVES_STOP),
              [t("券売機は解", "machine solves")]: yesNo(SELF_SOLVES_TICKET),
            },
          },
        },
      },
      {
        id: "diverge",
        kind: "found",
        title: t("展開を τ と見ると発散", "Unwinding as τ diverges"),
        actor: "self",
        summary: t(
          `名前を開くたびに τ を1つ起こすと、P = P は${SELF_DIVERGES ? "最初から τ だけで回り続ける" : "発散しない"}。券売機は${TICKET_DIVERGES ? "発散する" : "発散しない"}`,
          `If each unwinding of a name is one τ, P = P ${SELF_DIVERGES ? "spins on τ alone from the start" : "does not diverge"}. The ticket machine ${TICKET_DIVERGES ? "diverges" : "does not"}`,
        ),
        explain: t(
          "Roscoe の操作的意味論では、名前を開いて定義に置き換える一歩を τ（見えない動き）と数える。P = P は開いても P に戻るだけなので τ の輪になり、失敗発散のモデルで発散と見るのと合う。券売機は開いた後に必ず coin が来るので、τ が続かない。",
          "In Roscoe's operational semantics, the step that opens a name and replaces it with its definition counts as a τ (an invisible move). Opening P = P just gives P again, so it is a loop of τ, which matches the failures/divergences model treating it as divergence. The ticket machine always does coin after unwinding, so the τ does not repeat.",
        ),
        set: {
          checker: { tone: "idle" },
          self: {
            rows: {
              "F(X)": null,
              [countsRow]: null,
              [t("発散", "diverges")]: yesNo(SELF_DIVERGES !== null),
              [t("輪の長さ", "loop length")]: String(
                Math.max((SELF_DIVERGES?.cycle.length ?? 1) - 1, 0),
              ),
            },
          },
        },
        simplified: t(
          "FDR もこのサイトの CSP の実装も、状態を増やさないよう名前を開く一歩を τ にしていないので、P = P をそのまま渡すと展開が終わらない。ここでは開くたびに unwind を起こしてそれを隠し、τ を作って調べた。ProB も P = P には「検査が終わらない」と答えるので、照合も unwind を隠したモデルで行った。",
          "Neither FDR nor this site's CSP implementation makes opening a name a τ (it would only add states), so passing P = P as it is would unwind forever. Here each unwinding does an unwind event, which is then hidden to make the τ. ProB also reports that its check of P = P cannot finish, so the cross-check uses this hidden version.",
        ),
      },
      {
        id: "guard",
        kind: "test",
        title: t("ガードを確かめる", "Check for a guard"),
        actor: "equation",
        to: ["self"],
        summary: t(
          `自分を呼ぶ前に見えるイベントが、券売機には${TICKET_GUARDED ? "ある" : "無い"}。P = P には${SELF_GUARDED ? "ある" : "無い"}`,
          `Is there a visible event before each self-call? Ticket machine: ${yesNo(TICKET_GUARDED)}; P = P: ${yesNo(SELF_GUARDED)}`,
        ),
        explain: t(
          "自分を呼ぶ所がどれも見えるイベントの後ろにある再帰（ガードのある再帰）は、不動点がただ1つに決まり、どのモデルで読んでも同じ意味になる。ガードの無い再帰はモデルによって意味が変わるので、書かないのが安全である。自分を呼ぶ所に隠蔽がかかる再帰も、前置で足したイベントを隠蔽が消すので、ガードに数えない。",
          "A recursion where every self-call comes after a visible event (a guarded recursion) has exactly one fixed point, so it means the same in every model. An unguarded recursion means different things in different models, so it is safer not to write one. A recursion whose self-call sits inside a hiding does not count as guarded either, because the hiding removes the events the prefix added.",
        ),
        set: {
          equation: { tone: TICKET_GUARDED ? "ok" : "bad" },
          self: { tone: SELF_GUARDED ? "ok" : "bad" },
        },
        simplified: t(
          "不動点の背景の数学（半順序の上での反復の極限や、距離空間での縮小写像）は扱わず、近似を長さごとに数えて極限に近づく様子だけを見せた。",
          "The mathematics behind fixed points (limits of iteration over a partial order, contraction maps on metric spaces) is left out; only the approximations, counted by length, are shown closing in on the limit.",
        ),
      },
    ],
    lab: {
      title: t("例と当てる回数を変える", "Change the example and the applications"),
      hint: t(
        "例（1: 券売機、2: coin → X、3: X）と、STOP に F を当てる回数（0〜6）を入れる。ガードのある例だけ、回数を増やすと P と一致する長さが延びる。",
        "Enter an example (1: ticket machine, 2: coin → X, 3: X) and how many times to apply F to STOP (0-6). Only for the guarded examples does the matching length grow with the count.",
      ),
      inputs: [
        { id: "example", label: t("例", "Example"), initial: "1" },
        { id: "rounds", label: t("当てる回数", "Applications"), initial: "2" },
      ],
      compute: (values): Field[] => {
        const rec = EXAMPLES[parseIndex(values.example, 1, 1, EXAMPLES.length) - 1]!;
        const rounds = parseIndex(values.rounds, 2, 0, 6);
        const counts = traceCountsByLength(
          approximation(rec, rounds),
          rec.env,
          MAX_LENGTH,
        );
        const isRecGuarded = isGuarded(rec.body);
        const fields: Field[] = [
          {
            label: t("ガード", "Guarded"),
            value: yesNo(isRecGuarded),
            tone: isRecGuarded ? "ok" : "bad",
          },
          {
            label: t(`F${rounds}(STOP) の本数`, `Traces of F${rounds}(STOP)`),
            value: countsText(counts),
          },
        ];
        if (isRecGuarded) {
          const whole = traceCountsByLength(rec.recursive, rec.env, MAX_LENGTH);
          fields.push(
            { label: t("P の本数", "Traces of P"), value: countsText(whole) },
            {
              label: t("P と一致", "Agrees with P"),
              value: agreeText(agreedLength(counts, whole)),
            },
          );
        } else {
          fields.push({
            label: t("P の本数", "Traces of P"),
            value: t(
              "決まらない（展開が終わらない）",
              "not settled (unwinding never ends)",
            ),
            tone: "bad",
          });
        }
        return fields;
      },
    },
  };
}
