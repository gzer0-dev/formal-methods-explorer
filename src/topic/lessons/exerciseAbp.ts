import { translator, type Language } from "../../core/i18n";
import type { Lesson, Step } from "../../core/types";
import { traceRefines } from "../csp";
import { ABP_ENV, abpSpec, abpSystem, NO_BIT_RUN } from "../cspAbp";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";

// 演習: 交互ビットプロトコルでビットを使わない（いつも0）と、故障の無い通信路でも仕様を破る。最短の反例は見えるイベント何個か。
// 問題の条件（故障なし・ビットなし・仕様は1要素のバッファ）は csp-abp のレッスンの「ビットが無いと2回渡す」と同じ。
// 既定の図は設定と問いだけを見せ、正解（反例と、その中の動き）は答えるまで出さない。
const NO_BIT = lazy(
  () =>
    traceRefines(
      abpSpec(),
      abpSystem({ canLose: false, canDuplicate: false }, false),
      ABP_ENV,
    ).counterexample!,
);

type Translate = (ja: string, en: string) => string;

const isVisible = (event: string) => /^(in|out)\./.test(event);

function setupSteps(t: Translate): Step[] {
  return [
    {
      id: "no-bit",
      kind: "spec",
      title: t("ビットをいつも0にする", "The bit is always 0"),
      actor: "sender",
      to: ["forward"],
      summary: t(
        "送り手は値にいつもビット0を付け、受け手はいつもビット0を待つ",
        "The sender always tags values with bit 0, and the receiver always expects bit 0",
      ),
      explain: t(
        "交互ビットプロトコルから、ビットを替える仕組みだけを外した。送り手は in.x を受け取ると send.0.x を知らせが戻るまで何度でも送り、受け手は recv.0.x が届くたびに out.x で渡して ack.0 を返す。",
        "This is the alternating bit protocol with only the bit-flipping removed. After in.x the sender sends send.0.x again and again until an acknowledgement returns, and each time recv.0.x arrives the receiver passes it on with out.x and returns ack.0.",
      ),
      set: {
        sender: {
          rows: { [t("今のビット", "current bit")]: t("いつも0", "always 0") },
        },
        receiver: {
          rows: { [t("待つビット", "expects bit")]: t("いつも0", "always 0") },
        },
      },
    },
    {
      id: "perfect",
      kind: "spec",
      title: t("通信路は故障しない", "The channels never fail"),
      actor: "forward",
      to: ["backward"],
      summary: t(
        "通信路は落とさず重複もさせず、1つ持つと渡すまで次を受け取らない",
        "The channels neither lose nor duplicate, and holding one item they take nothing more until they pass it on",
      ),
      explain: t(
        "故障は無いが、送り手は知らせが戻る前でも送り直してよい（時間切れはいつ起きてもよい）。外から見えるのは in と out だけで、send・recv・ack・getack は隠してある。",
        "There are no faults, but the sender may resend before the acknowledgement returns (the timeout may fire at any time). Only in and out are visible from outside; send, recv, ack and getack are hidden.",
      ),
      set: {
        forward: { rows: { [t("故障", "faults")]: t("なし", "none") } },
        backward: { rows: { [t("故障", "faults")]: t("なし", "none") } },
      },
    },
    {
      id: "question",
      kind: "explore",
      title: t("最短の反例は何個か", "How short is it?"),
      actor: "checker",
      to: ["sender", "receiver"],
      summary: t(
        "仕様（1要素のバッファ）に無いトレースのうち、いちばん短いものは見えるイベント何個かを答える",
        "Answer how many visible events the shortest trace not in the spec (a one-place buffer) has",
      ),
      explain: t(
        "仕様は「in.x を受け取ったら、次を受け取る前に out.x で1回だけ渡す」。検査器は ⊑T を幅優先で調べる。見えるイベント（in と out）だけを数えて、仕様に無い最短のトレースの長さを下の「答え合わせ」に入れる。ヒント: 受け手が同じ写しを2回受け取るとどうなるか。",
        'The spec: after in.x, pass it on once with out.x before taking the next. The checker examines ⊑T breadth-first. Count only visible events (in and out) and enter the length of the shortest trace not in the spec under "Check your answer" below. Hint: what happens if the receiver gets the same copy twice?',
      ),
      set: {
        checker: {
          tone: "wait",
          rows: { [t("問い", "question")]: t("最短は何個？", "Shortest?") },
        },
      },
    },
  ];
}

function solutionSteps(t: Translate): Step[] {
  const heldRow = t("持っている", "holding");
  const none = t("なし", "none");
  const lastIndex = NO_BIT_RUN.length - 1;
  let outputs = 0;
  return NO_BIT_RUN.map((event, index): Step => {
    const [channel, ...rest] = event.split(".");
    const payload = rest.join(".");
    const isLast = index === lastIndex;
    const base = {
      id: `run-${index + 1}`,
      kind: isLast
        ? ("found" as const)
        : isVisible(event)
          ? ("run" as const)
          : ("explore" as const),
      title: t(`${index + 1}つ目: ${event}`, `Event ${index + 1}: ${event}`),
    };
    switch (channel) {
      case "in":
        return {
          ...base,
          actor: "sender",
          summary: t(
            `外から ${event} を受け取る（見える）`,
            `Takes ${event} from outside (visible)`,
          ),
          explain: t(
            "送り手は値を受け取り、知らせが戻るまで送り直す状態に入る。",
            "The sender takes the value and starts resending until acknowledged.",
          ),
          set: {
            sender: { tone: "wait", rows: { [t("送っている", "sending")]: payload } },
          },
        };
      case "send":
        return {
          ...base,
          actor: "sender",
          to: ["forward"],
          summary: t(
            `${event} を通信路へ送る（隠れている）`,
            `Sends ${event} into the channel (hidden)`,
          ),
          explain:
            index > 1
              ? t(
                  "知らせはまだ送り手に届いていないので、送り手は同じ値を送り直す。通信路は故障していない。",
                  "The acknowledgement has not reached the sender yet, so it resends the same value. The channel has not failed.",
                )
              : t("通信路が値を1つ持つ。", "The channel holds the value."),
          set: { forward: { tone: "wait", rows: { [heldRow]: payload } } },
        };
      case "recv":
        return {
          ...base,
          actor: "forward",
          to: ["receiver"],
          summary: t(
            `${event} が受け手に届く（隠れている）`,
            `${event} reaches the receiver (hidden)`,
          ),
          explain: t(
            "受け手はビット0を待っているので、届いたものを新しい値として受け取る。",
            "The receiver is waiting for bit 0, so it takes what arrived as a new value.",
          ),
          set: { forward: { tone: "idle", rows: { [heldRow]: none } } },
        };
      case "out":
        outputs += 1;
        return {
          ...base,
          actor: "receiver",
          summary: isLast
            ? t(
                `${event} がもう一度出て、仕様に無いトレースになる（見える）`,
                `${event} comes out again, giving a trace the spec does not have (visible)`,
              )
            : t(
                `${event} で値を渡す（見える）`,
                `Passes the value on with ${event} (visible)`,
              ),
          explain: isLast
            ? t(
                `受け手は送り直しの写しを新しい値と区別できず、もう一度渡した。仕様は ${NO_BIT_RUN[0]} の後に ${event} を1回しか許さない。`,
                `The receiver could not tell the resent copy from a new value and passed it on again. The spec allows only one ${event} after ${NO_BIT_RUN[0]}.`,
              )
            : t("ここまでは仕様どおり。", "So far this matches the spec."),
          set: {
            receiver: {
              tone: isLast ? "bad" : "ok",
              rows: { [t("渡した回数", "times passed on")]: String(outputs) },
            },
          },
        };
      case "ack":
        return {
          ...base,
          actor: "receiver",
          to: ["backward"],
          summary: t(`${event} を返す（隠れている）`, `Returns ${event} (hidden)`),
          explain: t(
            "知らせは帰りの通信路に入ったが、送り手はまだ受け取っていない。",
            "The acknowledgement is in the return channel, but the sender has not taken it yet.",
          ),
          set: { backward: { tone: "wait", rows: { [heldRow]: payload } } },
        };
      default:
        return {
          ...base,
          actor: "backward",
          to: ["sender"],
          summary: t(
            `${event} が送り手に届く（隠れている）`,
            `${event} reaches the sender (hidden)`,
          ),
          explain: t("送り手は次の値を待つ。", "The sender waits for the next value."),
          set: { backward: { tone: "idle", rows: { [heldRow]: none } } },
        };
    }
  });
}

export function exerciseAbpLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-abp",
      title: t("演習: ビットを替えない", "Exercise: no alternating bit"),
      subtitle: t(
        "ビットを替えないと、いくつのイベントで仕様を破るか",
        "Without flipping the bit, how soon does it break the spec?",
      ),
      summary: t(
        "交互ビットプロトコルからビットを替える仕組みを外すと、故障の無い通信路でも1要素のバッファの仕様を破る。仕様に無い最短のトレースが見えるイベント何個かを答える。答えを入れると、中の動きを含めた実行を1つずつ図で追える。",
        "Take the bit-flipping out of the alternating bit protocol and it breaks the one-place buffer spec even over fault-free channels. Answer how many visible events the shortest trace not in the spec has. Once you answer, you can follow the run, inner moves included, one event at a time.",
      ),
      intro: [
        t(
          "「交互ビットプロトコル」で見た送り手・受け手・2本の通信路を使う。ここではビットを替える仕組みだけを外し、通信路は故障しないものにした。図はまず問題の設定だけを見せ、正解の手順は答えるまで出さない。",
          'This uses the sender, receiver and two channels from "The alternating bit protocol". Only the bit-flipping is removed here, and the channels never fail. The diagram first shows only the setup and keeps the steps of the answer hidden until you answer.',
        ),
        t(
          "下の「答え合わせ」に数を入れると、検査器が見つけた反例を、隠れている受け渡しも含めて1つずつ追うステップと、答え合わせのステップが足される。「図で見る」を押して、受け手がどこで同じ値を2回渡すかを追う。",
          'When you enter a number under "Check your answer", steps that follow the counterexample the checker found, hidden hand-overs included, and a result step are added. Press "Show the diagram" and follow where the receiver passes the same value on twice.',
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t(
            "ビットを替えない交互ビットプロトコル",
            "Alternating bit protocol without the flip",
          ),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("数（半角数字）", "A number (digits)"),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t("交互ビットプロトコル", '"The alternating bit protocol"'),
        },
      ],
      actors: [
        {
          id: "sender",
          label: t("送り手", "Sender"),
          sublabel: t("送り直す", "resends"),
          icon: "process",
          x: 14,
          y: 27,
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
          sublabel: t("届けば渡す", "passes on what arrives"),
          icon: "process",
          x: 86,
          y: 27,
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
        },
      ],
      links: [
        { from: "sender", to: "forward" },
        { from: "forward", to: "receiver" },
        { from: "receiver", to: "backward" },
        { from: "backward", to: "sender" },
      ],
      answerType: "number",
      answerLabel: t("あなたの答え（イベントの数）", "Your answer (events)"),
      hint: t(
        "仕様に無い最短のトレースの、見えるイベント（in と out）の数を入れる。入れると、図に正解の手順が足される。",
        "Enter the number of visible events (in and out) in the shortest trace not in the spec. The steps of the answer are then added to the diagram.",
      ),
      verdictActor: "checker",
      setupSteps: setupSteps(t),
      solve: () => {
        const trace = NO_BIT();
        return {
          answer: trace.length,
          reason: t(
            `検査器は幅優先で、最短の反例 ⟨${trace.join(", ")}⟩ を見つけた。${trace[0]} と ${trace[1]} の後、知らせが届く前に送り直した写しを、ビットの替わらない受け手は新しい値として渡す。最初の1組は仕様どおりなので、これより短い反例は無い。`,
            `Searching breadth-first, the checker found the shortest counterexample ⟨${trace.join(", ")}⟩. After ${trace[0]} and ${trace[1]}, the receiver, whose bit never changes, passes on as new a copy resent before the acknowledgement arrived. The first pair matches the spec, so no counterexample is shorter.`,
          ),
        };
      },
      solutionSteps: () => solutionSteps(t),
    },
    language,
  );
}
