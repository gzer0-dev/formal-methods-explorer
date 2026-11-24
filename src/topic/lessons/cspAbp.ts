import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import {
  divergence,
  explore,
  type FdCounterexample,
  failuresDivergencesRefines,
  failuresRefines,
  traceRefines,
} from "../csp";
import {
  ABP_ENV,
  abpSpec,
  abpSystem,
  type Faults,
  HIDDEN_CHANNELS,
  LOSS_RUN,
} from "../cspAbp";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

const LOSSY: Faults = { canLose: true, canDuplicate: true };
const PERFECT: Faults = { canLose: false, canDuplicate: false };
const SPEC = abpSpec();
const SYSTEM = abpSystem(LOSSY, true);
const TRACE_RESULT = traceRefines(SPEC, SYSTEM, ABP_ENV);
const FAILURES_FORWARD = failuresRefines(SPEC, SYSTEM, ABP_ENV).holds;
const FAILURES_BACKWARD = failuresRefines(SYSTEM, SPEC, ABP_ENV).holds;
const FAILURES_EQUAL = FAILURES_FORWARD && FAILURES_BACKWARD;
const FD_LOSSY = failuresDivergencesRefines(SPEC, SYSTEM, ABP_ENV);
const SYSTEM_STATES = explore(SYSTEM, ABP_ENV).stateCount;
const PERFECT_SYSTEM = abpSystem(PERFECT, true);
const PERFECT_DIVERGES = divergence(PERFECT_SYSTEM, ABP_ENV) !== null;
const FD_PERFECT = failuresDivergencesRefines(SPEC, PERFECT_SYSTEM, ABP_ENV).holds;
const NO_BIT = traceRefines(SPEC, abpSystem(PERFECT, false), ABP_ENV);
// ビットが無いときに繰り返し渡される出力（反例の最後のイベント）と、反例の中で渡した回数。
const REPEATED_OUTPUT = NO_BIT.counterexample?.at(-1) ?? "";
const REPEATED_COUNT = (NO_BIT.counterexample ?? []).filter(
  (event) => event === REPEATED_OUTPUT,
).length;
const [INPUT, LOST_SEND, RESEND, DELIVER, OUTPUT, ACK, GET_ACK] = LOSS_RUN as [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];
const DIVERGE_TRACE = FD_LOSSY.counterexample?.trace ?? [];

function listText(events: string[], language: Language): string {
  if (events.length === 0) return language === "ja" ? "⟨⟩（空）" : "⟨⟩ (empty)";
  return `⟨${events.join(", ")}⟩`;
}

/** lab の入力を「入れる／入れない」に読む。1 以上の数なら入れる。読めなければ既定。 */
function parseSwitch(text: string | undefined, fallback: boolean): boolean {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return fallback;
  return value >= 1;
}

function fdText(result: FdCounterexample, language: Language): string {
  const t = translator(language);
  const trace = listText(result.trace, language);
  if (result.kind === "divergence")
    return t(`${trace} の後に発散`, `diverges after ${trace}`);
  if (result.kind === "trace")
    return t(`${trace} は仕様に無い`, `${trace} is not in the spec`);
  return t(
    `${trace} の後に {${result.refusal.join(", ")}} を断る`,
    `refuses {${result.refusal.join(", ")}} after ${trace}`,
  );
}

export function cspAbpLesson(language: Language): Lesson {
  const t = translator(language);
  const holdsText = (holds: boolean) =>
    holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
  // 文の途中で続けるとき（「⊑T が成り立ち、」）の形。日本語だけで使う。
  const holdsCont = (holds: boolean) => (holds ? "成り立ち" : "成り立たず");
  const bitRow = t("今のビット", "current bit");
  const heldRow = t("持っている", "holding");
  const expectRow = t("待つビット", "expects bit");
  const faultRow = t("故障", "faults");
  const none = t("なし", "none");
  const bitOf = (event: string) => event.split(".")[1]!;
  return {
    id: "csp-abp",
    category: "protocol",
    title: t("交互ビットプロトコル", "The alternating bit protocol"),
    subtitle: t(
      "落とす・重複させる通信路の上で、順に1つずつ渡す",
      "Pass values on in order over a channel that loses and duplicates",
    ),
    summary: t(
      `送り手は値に0か1のビットを付けて送り直し続け、同じビットの知らせが戻るとビットを替える。値を落とす・重複させる通信路の上でも、中の動きを隠すと1要素のバッファの仕様と ⊑F で${FAILURES_EQUAL ? "等しい" : "等しくない"}。ただし通信路が落とし続けられるので、⊑FD は ${listText(DIVERGE_TRACE, language)} の後の発散で${holdsText(FD_LOSSY.holds)}。`,
      `The sender tags each value with a bit, 0 or 1, keeps resending it, and flips the bit when an acknowledgement with the same bit comes back. Even over channels that lose and duplicate values, once the inner moves are hidden it is ${FAILURES_EQUAL ? "equal" : "not equal"} to a one-place buffer spec under ⊑F. But the channel can keep losing, so ⊑FD ${holdsText(FD_LOSSY.holds)} by divergence after ${listText(DIVERGE_TRACE, language)}.`,
    ),
    intro: [
      t(
        "交互ビットプロトコル（alternating bit protocol）は、値を落としたり重複させたりする通信路の上で、値を1つずつ順に届けるための古典的な手順である。送り手は値に0か1のビットを付け、同じビットの「受け取った」という知らせが戻るまで送り直す。受け手は待っているビットの値だけを渡し、古い写しには知らせだけを返す。",
        'The alternating bit protocol is a classic way to deliver values one at a time, in order, over a channel that may lose or duplicate them. The sender tags each value with one bit and resends it until an acknowledgement ("received") with the same bit comes back. The receiver passes on only a value with the bit it is waiting for, and answers an old copy with just an acknowledgement.',
      ),
      t(
        "通信路が落とすか重複させるかは毎回変わるので、テストを何度回しても起きた順はほんの一部にすぎない。ここでは送り手・受け手・2本の通信路を CSP で書き、起こりうるすべての故障の組み合わせを検査器でたどって、全体が「受け取った順に1つずつ渡すバッファ」と同じに見えるかを確かめる。",
        "Whether the channel loses or duplicates changes every time, so however often you run a test, the orders you see are only a fraction of what can happen. Here the sender, the receiver and the two channels are written in CSP, and the checker walks every combination of faults to see whether the whole looks the same as a buffer that passes values on one at a time in the order received.",
      ),
      t(
        "図では、上の段で値が送り手から受け手へ、下の段で知らせが受け手から送り手へ戻る。各カードの「今のビット」「待つビット」が1回の受け渡しでどう替わるかを追い、後半でビットを使わない場合、発散、故障の無い通信路を比べる。",
        'In the diagram, values go from sender to receiver along the top row and acknowledgements come back along the bottom. Follow how "current bit" and "expects bit" change over one hand-over; the later steps compare a version without the bit, divergence, and a channel with no faults.',
      ),
    ],
    facts: [
      {
        label: t("1要素のバッファと", "Against a one-place buffer"),
        value: t(
          `⊑T が${holdsCont(TRACE_RESULT.holds)}、⊑F も両向きで${holdsText(FAILURES_EQUAL)}`,
          `⊑T ${holdsText(TRACE_RESULT.holds)}; ⊑F both ways ${holdsText(FAILURES_EQUAL)}`,
        ),
        tone: TRACE_RESULT.holds && FAILURES_EQUAL ? "ok" : "bad",
      },
      {
        label: t("発散まで見ると", "Including divergence"),
        value: t(
          `⊑FD ${holdsText(FD_LOSSY.holds)}（${FD_LOSSY.counterexample ? fdText(FD_LOSSY.counterexample, language) : none}）`,
          `⊑FD ${holdsText(FD_LOSSY.holds)} (${FD_LOSSY.counterexample ? fdText(FD_LOSSY.counterexample, language) : none})`,
        ),
        tone: FD_LOSSY.holds ? "ok" : "bad",
      },
      {
        label: t("隠した後の状態", "States after hiding"),
        value: t(`${SYSTEM_STATES}状態`, `${SYSTEM_STATES} states`),
      },
      {
        label: t("参考", "Reference"),
        value: t(
          `${TPC_BOOK} 5.3節（交互ビットプロトコル）`,
          `${TPC_BOOK_EN}, §5.3 (the alternating bit protocol)`,
        ),
      },
    ],
    actors: [
      {
        id: "sender",
        label: t("送り手", "Sender"),
        sublabel: t("ビットを付けて送り直す", "tags and resends"),
        icon: "process",
        x: 14,
        y: 27,
        initial: { rows: { [bitRow]: "0" } },
      },
      {
        id: "forward",
        label: t("通信路（行き）", "Channel (out)"),
        sublabel: "send → recv",
        icon: "network",
        x: 50,
        y: 27,
      },
      {
        id: "receiver",
        label: t("受け手", "Receiver"),
        sublabel: t("待つビットだけ渡す", "passes the expected bit"),
        icon: "process",
        x: 86,
        y: 27,
        initial: { rows: { [expectRow]: "0" } },
      },
      {
        id: "backward",
        label: t("通信路（帰り）", "Channel (back)"),
        sublabel: "ack → getack",
        icon: "network",
        x: 50,
        y: 73,
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("仕様: 1要素のバッファ", "spec: one-place buffer"),
        icon: "checker",
        x: 86,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "sender", to: "forward" },
      { from: "forward", to: "receiver" },
      { from: "receiver", to: "backward" },
      { from: "backward", to: "sender" },
    ],
    steps: [
      {
        id: "tag",
        kind: "spec",
        title: t("ビットを付けて送る", "Tag and send"),
        actor: "sender",
        to: ["forward"],
        summary: t(
          "送り手は in.x を受け取り、send.b.x（b はビット）を、同じビットの知らせが戻るまで何度でも送る",
          "The sender takes in.x and sends send.bit.x again and again until an acknowledgement with the same bit returns",
        ),
        explain: t(
          "時間切れで送り直す仕組みを、「いつでも送り直してよい」という選択として書いた。いつ時間切れになっても正しいなら、時間切れの長さに頼らずに正しいと言える。違うビットの知らせは古いものなので捨てる。",
          "Resending on a timeout is written as a choice that the sender may resend at any time. If it is correct whenever the timeout fires, it is correct without relying on the timeout's length. An acknowledgement with the other bit is old, so it is discarded.",
        ),
        set: {
          sender: {
            rows: {
              [bitRow]: "0",
              [t("送り直す", "resends")]: t("知らせが戻るまで", "until acknowledged"),
            },
          },
        },
      },
      {
        id: "faults",
        kind: "spec",
        title: t("通信路は故障する", "The channels are faulty"),
        actor: "forward",
        to: ["backward"],
        summary: t(
          "通信路は1つ持つと、渡す・渡して持ち続ける（重複）・捨てる（落とす）を内部で選ぶ",
          "Holding one item, a channel chooses internally to pass it, pass it and keep it (duplicate), or throw it away (lose)",
        ),
        explain: t(
          "どれを選ぶかは通信路の中で決まり、送り手にも受け手にも選べない（内部選択）。行きも帰りも同じ故障をする。検査器は、どの回にどの故障が起きる並びもすべてたどる。",
          "Which one happens is decided inside the channel; neither sender nor receiver can choose it (internal choice). The outward and return channels fail the same way. The checker walks every order of which fault happens on which turn.",
        ),
        set: {
          forward: {
            tone: "wait",
            rows: { [faultRow]: t("落とす・重複", "lose, duplicate"), [heldRow]: none },
          },
          backward: {
            tone: "wait",
            rows: { [faultRow]: t("落とす・重複", "lose, duplicate"), [heldRow]: none },
          },
        },
      },
      {
        id: "lost",
        kind: "run",
        title: t("1回目が落ちる", "The first copy is lost"),
        actor: "sender",
        to: ["forward"],
        summary: t(
          `${INPUT} を受け取り ${LOST_SEND} を送るが、通信路が捨てる`,
          `It takes ${INPUT} and sends ${LOST_SEND}, but the channel throws it away`,
        ),
        explain: t(
          `通信路は1つしか持てないので、2回目の ${RESEND} を受け取れるのは1回目を捨てたときだけである。捨てる動きは外から見えない（τ）。送り手には落ちたかどうかが分からないので、そのまま送り直す。`,
          `A channel holds only one item, so it can take a second ${RESEND} only if it threw the first away. Throwing away is invisible from outside (τ). The sender cannot tell whether it was lost, so it simply resends.`,
        ),
        set: {
          sender: { tone: "wait", rows: { [t("送っている", "sending")]: LOST_SEND } },
          forward: {
            tone: "bad",
            rows: { [heldRow]: t("なし（落とした）", "none (lost)") },
          },
        },
      },
      {
        id: "delivered",
        kind: "run",
        title: t("送り直しが届く", "The resend arrives"),
        actor: "forward",
        to: ["receiver"],
        summary: t(
          `送り直した ${RESEND} が ${DELIVER} で届き、受け手は ${OUTPUT} で渡す`,
          `The resent ${RESEND} arrives as ${DELIVER}, and the receiver passes it on with ${OUTPUT}`,
        ),
        explain: t(
          `受け手はビット${bitOf(DELIVER)}を待っていたので、新しい値として ${OUTPUT} で渡し、待つビットを替える。この後に同じビットの写しがまた届いても、古いものとして知らせだけを返す。`,
          `The receiver was waiting for bit ${bitOf(DELIVER)}, so it passes the value on as new with ${OUTPUT} and changes the bit it expects. If another copy with the same bit arrives later, it is treated as old and only acknowledged.`,
        ),
        set: {
          forward: { tone: "ok", rows: { [heldRow]: none } },
          receiver: {
            tone: "ok",
            rows: {
              [t("渡した", "passed on")]: OUTPUT,
              [expectRow]: String(1 - Number(bitOf(DELIVER))),
            },
          },
        },
      },
      {
        id: "acknowledged",
        kind: "run",
        title: t("知らせでビットを替える", "The ack flips the bit"),
        actor: "backward",
        to: ["sender"],
        summary: t(
          `受け手の ${ACK} が ${GET_ACK} で届き、送り手はビットを替えて次の値を待つ`,
          `The receiver's ${ACK} arrives as ${GET_ACK}; the sender flips its bit and waits for the next value`,
        ),
        explain: t(
          `送り手は自分のビットと同じ知らせを受け取ったので、値が届いたと分かる。ビットを${String(1 - Number(bitOf(GET_ACK)))}に替えて次の in を待つ。これで1つの値の受け渡しが終わり、外から見えたのは ${INPUT} と ${OUTPUT} だけである。`,
          `The sender received an acknowledgement with its own bit, so it knows the value arrived. It changes its bit to ${String(1 - Number(bitOf(GET_ACK)))} and waits for the next in. One hand-over is done, and all that was visible from outside was ${INPUT} and ${OUTPUT}.`,
        ),
        set: {
          backward: { tone: "ok", rows: { [heldRow]: none } },
          sender: {
            tone: "ok",
            rows: {
              [bitRow]: String(1 - Number(bitOf(GET_ACK))),
              [t("送っている", "sending")]: none,
            },
          },
          forward: { tone: "idle" },
          receiver: { tone: "idle" },
        },
      },
      {
        id: "no-bit",
        kind: "found",
        title: t("ビットが無いと2回渡す", "Without the bit, twice"),
        actor: "receiver",
        summary: t(
          `ビットをいつも0にすると、故障の無い通信路でも ${listText(NO_BIT.counterexample ?? [], language)} で仕様を破る`,
          `With the bit always 0, even a fault-free channel breaks the spec with ${listText(NO_BIT.counterexample ?? [], language)}`,
        ),
        explain: t(
          `送り手は知らせが届く前にも送り直せるので、受け手には同じ値の写しが届く。ビットが替わらないと、受け手は写しを新しい値と区別できずにもう一度渡す。仕様は1つ受け取ったら1回だけ渡すので、⊑T の段階で${holdsText(NO_BIT.holds)}。`,
          `The sender may resend before the acknowledgement arrives, so the receiver gets a copy of the same value. If the bit never changes, the receiver cannot tell the copy from a new value and passes it on again. The spec passes each value on once, so refinement ${holdsText(NO_BIT.holds)} already at ⊑T.`,
        ),
        set: {
          receiver: {
            tone: "bad",
            rows: {
              [expectRow]: t("いつも0", "always 0"),
              [t("渡した", "passed on")]: t(
                `${REPEATED_OUTPUT} を${REPEATED_COUNT}回`,
                `${REPEATED_OUTPUT} ${REPEATED_COUNT} times`,
              ),
            },
          },
        },
      },
      {
        id: "equal",
        kind: "fix",
        title: t("バッファと等しい", "Equal to the buffer"),
        actor: "checker",
        to: ["sender", "receiver"],
        summary: t(
          `中の ${HIDDEN_CHANNELS.join("・")} を隠して1要素のバッファと比べると、⊑T が${holdsCont(TRACE_RESULT.holds)}、⊑F も両向きに${holdsText(FAILURES_EQUAL)}`,
          `Hiding ${HIDDEN_CHANNELS.join(", ")} inside, ⊑T against a one-place buffer ${holdsText(TRACE_RESULT.holds)} and ⊑F ${holdsText(FAILURES_EQUAL)} both ways`,
        ),
        explain: t(
          `仕様は「in.x を受け取ったら、次を受け取る前に out.x で渡す」1要素のバッファ。ビットを使うプロトコルは、どんな故障の並びでも渡す順と回数を守り、安定した状態で入力も出力も断らない。隠した後の全体は${SYSTEM_STATES}状態ある。`,
          `The spec is a one-place buffer: after in.x, pass it on with out.x before taking the next. The tagged version keeps the order and the number of outputs under every order of faults, and never refuses input or output in a stable state. After hiding, the whole has ${SYSTEM_STATES} states.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: TRACE_RESULT.holds && FAILURES_EQUAL ? "ok" : "bad",
            rows: {
              "⊑T": holdsText(TRACE_RESULT.holds),
              [t("仕様 ⊑F 実装", "spec ⊑F impl")]: holdsText(FAILURES_FORWARD),
              [t("実装 ⊑F 仕様", "impl ⊑F spec")]: holdsText(FAILURES_BACKWARD),
            },
          },
          receiver: {
            tone: "ok",
            rows: {
              [expectRow]: t("0と1を交互", "0 and 1 in turn"),
              [t("渡した", "passed on")]: t("1回ずつ", "once each"),
            },
          },
        },
      },
      {
        id: "diverge",
        kind: "found",
        title: t("落とし続けると発散", "Endless loss diverges"),
        actor: "checker",
        to: ["forward"],
        summary: t(
          `⊑FD では ${listText(DIVERGE_TRACE, language)} の後に発散して${holdsText(FD_LOSSY.holds)}`,
          `Under ⊑FD it diverges after ${listText(DIVERGE_TRACE, language)} and ${holdsText(FD_LOSSY.holds)}`,
        ),
        explain: t(
          "通信路が送り直しを毎回落とすと、送り手は隠した動きだけを永遠に繰り返し、外からは何も起きない。安定失敗のモデル（⊑F）はこの止まらない輪を見ないので両向きに成り立っていたが、発散まで比べる ⊑FD では破れる。",
          "If the channel loses every resend, the sender repeats hidden moves for ever and nothing happens outside. The stable failures model (⊑F) does not see this endless loop, which is why it held both ways, but ⊑FD, which also compares divergence, fails.",
        ),
        set: {
          checker: {
            tone: FD_LOSSY.holds ? "ok" : "bad",
            rows: {
              "⊑T": null,
              [t("仕様 ⊑F 実装", "spec ⊑F impl")]: null,
              [t("実装 ⊑F 仕様", "impl ⊑F spec")]: null,
              "⊑FD": holdsText(FD_LOSSY.holds),
              [t("反例", "counterexample")]: t("発散", "divergence"),
            },
          },
          forward: {
            tone: "bad",
            rows: { [heldRow]: t("落とし続ける", "keeps losing") },
          },
        },
      },
      {
        id: "perfect",
        kind: "fix",
        title: t("故障が無ければ発散しない", "No faults, no divergence"),
        actor: "checker",
        to: ["forward", "backward"],
        summary: t(
          `落とさず重複もさせない通信路なら発散${PERFECT_DIVERGES ? "する" : "せず"}、⊑FD まで${holdsText(FD_PERFECT)}`,
          `With channels that neither lose nor duplicate, it ${PERFECT_DIVERGES ? "diverges" : "does not diverge"} and even ⊑FD ${holdsText(FD_PERFECT)}`,
        ),
        explain: t(
          "故障の無い通信路は1つしか持てないので、送り直しは受け手が取るまで待たされ、知らせが戻れば送信は終わる。重複だけを許しても、古い写しを際限なく受け直せるので発散する（下の「通信路の故障とビットを変える」で試せる）。実際の通信では「無限には落とさない」という公平性を仮定して、この発散を外して考える。",
          "A fault-free channel holds only one item, so resends wait until the receiver takes them, and sending ends when the acknowledgement returns. Allowing only duplication still diverges, because old copies can be received again without end (try it in 'Change the faults and the bit' below). In real networks one assumes the fairness that losses do not go on for ever, and sets this divergence aside.",
        ),
        set: {
          forward: { tone: "ok", rows: { [faultRow]: none, [heldRow]: none } },
          backward: { tone: "ok", rows: { [faultRow]: none, [heldRow]: none } },
          checker: {
            tone: FD_PERFECT ? "ok" : "bad",
            rows: {
              "⊑FD": holdsText(FD_PERFECT),
              [t("反例", "counterexample")]: none,
            },
          },
        },
        simplified: t(
          "通信路は1つしか持てないことにした（実物は何通も抱える）。時間切れは「いつでも送り直してよい」という選択で書き、時間の長さは扱わない。公平性を仮定しないので、無限に落とす・重複させる実行も発散として数える。流す値は 0 と 1 の2つだけにした。",
          "Each channel holds only one item (real ones hold many). The timeout is written as a choice to resend at any time, and its length is not modelled. No fairness is assumed, so runs that lose or duplicate for ever count as divergence. Only two values, 0 and 1, are passed.",
        ),
      },
    ],
    lab: {
      title: t("通信路の故障とビットを変える", "Change the faults and the bit"),
      hint: t(
        "それぞれ 1 で入れる・0 で外す。落とす・重複のどちらかを入れると発散し、ビットを外すと故障が無くても仕様を破る。",
        "Enter 1 to switch each on and 0 to switch it off. Losing or duplicating makes it diverge, and without the bit it breaks the spec even with no faults.",
      ),
      inputs: [
        { id: "lose", label: t("落とす（0/1）", "Lose (0/1)"), initial: "1" },
        { id: "duplicate", label: t("重複（0/1）", "Duplicate (0/1)"), initial: "1" },
        {
          id: "bit",
          label: t("ビットを使う（0/1）", "Use the bit (0/1)"),
          initial: "1",
        },
      ],
      compute: (values): Field[] => {
        const faults: Faults = {
          canLose: parseSwitch(values.lose, true),
          canDuplicate: parseSwitch(values.duplicate, true),
        };
        const system = abpSystem(faults, parseSwitch(values.bit, true));
        const traces = traceRefines(SPEC, system, ABP_ENV);
        const failures = failuresRefines(SPEC, system, ABP_ENV);
        const fd = failuresDivergencesRefines(SPEC, system, ABP_ENV);
        const fields: Field[] = [
          {
            label: "⊑T",
            value: holdsText(traces.holds),
            tone: traces.holds ? "ok" : "bad",
          },
          {
            label: "⊑F",
            value: holdsText(failures.holds),
            tone: failures.holds ? "ok" : "bad",
          },
          { label: "⊑FD", value: holdsText(fd.holds), tone: fd.holds ? "ok" : "bad" },
        ];
        if (fd.counterexample)
          fields.push({
            label: t("反例", "Counterexample"),
            value: fdText(fd.counterexample, language),
          });
        return fields;
      },
    },
  };
}
