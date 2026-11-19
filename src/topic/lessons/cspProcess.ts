import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import {
  acceptsTrace,
  deadlocks,
  explore,
  moves,
  pre,
  SKIP,
  STOP,
  TAU,
  TICK,
} from "../csp";
import { printerSpec, PRINTER_ENV } from "../cspModels";

const SPEC = printerSpec();
const SPEC_LTS = explore(SPEC, PRINTER_ENV);
const SPEC_STATES = [...SPEC_LTS.states.keys()];
// 状態は幅優先の順に並ぶ。[0] が最初の Spec、[1] が「print を待つ」状態。
const START_KEY = SPEC_STATES[0]!;
const AFTER_CHOICE_KEY = SPEC_STATES[1]!;
const CHOICES = SPEC_LTS.edges
  .filter((edge) => edge.from === START_KEY)
  .map((edge) => edge.ev);
const BACK_EDGE = SPEC_LTS.edges.find((edge) => edge.from === AFTER_CHOICE_KEY)!;

// STOP と SKIP の違い。プリンタの仕様には出てこないので、「print の後に止まる／終わる」小さな式で確かめる。
const STOP_MOVES = moves(STOP, PRINTER_ENV);
const SKIP_MOVES = moves(SKIP, PRINTER_ENV);
const PRINT_THEN_STOP = deadlocks(pre("print", STOP), PRINTER_ENV);
const PRINT_THEN_SKIP = deadlocks(pre("print", SKIP), PRINTER_ENV);

const DEFAULT_TRACE = "mono,print,color,print";
const SAMPLE_CHECK = acceptsTrace(SPEC, PRINTER_ENV, DEFAULT_TRACE.split(","));

function parseTrace(text: string | undefined): string[] {
  const events = (text ?? "")
    .split(/[,、，\s]+/)
    .map((event) => event.trim())
    .filter((event) => event.length > 0);
  return events.length > 0 ? events : DEFAULT_TRACE.split(",");
}

function edgeLines(language: Language): Field[] {
  const t = translator(language);
  return SPEC_LTS.edges.map((edge, i) => ({
    label: t(`遷移${i + 1}`, `Transition ${i + 1}`),
    value: `${edge.from} --${edge.ev}--> ${edge.to}`,
    isCode: true,
  }));
}

export function cspProcessLesson(language: Language): Lesson {
  const t = translator(language);
  const choiceList = t(CHOICES.join("・"), CHOICES.join(", "));
  const skipEvents = t(
    SKIP_MOVES.map((m) => m.ev).join("・"),
    SKIP_MOVES.map((m) => m.ev).join(", "),
  );
  return {
    id: "csp-process",
    category: "csp",
    title: t("プロセスとイベント", "Processes and events"),
    subtitle: t(
      "プリンタの仕様をイベントの並びで書く",
      "Write a printer spec as sequences of events",
    ),
    summary: t(
      `CSP では、システムを「イベントを起こすプロセス」として書く。プリンタの仕様を前置・外部選択・再帰で書くと、状態は${SPEC_LTS.stateCount}個、遷移は${SPEC_LTS.transitionCount}本になる。`,
      `In CSP you describe a system as processes that perform events. Writing a printer spec with prefix, external choice and recursion gives ${SPEC_LTS.stateCount} states and ${SPEC_LTS.transitionCount} transitions.`,
    ),
    intro: [
      t(
        "CSP（Communicating Sequential Processes）は、システムを「プロセス」が起こす「イベント」の並びとして書く記法だ。イベントは外から見える出来事（刷り方を選ぶ、刷るなど）で、中の変数や処理の手順は書かない。",
        "CSP (Communicating Sequential Processes) is a notation that describes a system as the sequences of events its processes perform. An event is something visible from outside (choosing how to print, printing a page); internal variables and procedures are not written down.",
      ),
      t(
        "これまでのレッスンでは、状態と遷移をじかに書いてモデル検査した。CSP では、前置（→）・外部選択（□）・再帰という少ない部品で式を書き、状態遷移図は検査器が式から組み立てる。テストで外から観測できるのもイベントの並びなので、仕様をこの形で書いておくとテストと対応させやすい。",
        "Earlier lessons wrote states and transitions directly and model-checked them. In CSP you write expressions from a few parts, prefix (→), external choice (□) and recursion, and the checker builds the state graph from the expression. Tests also observe sequences of events from outside, so a spec in this form maps easily onto tests.",
      ),
      t(
        "図では、利用者が刷り方を選んでから刷るまでの矢印を追い、刷った後に最初の状態へ戻る所を見る。後半は STOP と SKIP のカードを見比べ、どちらも「その後は何もしない」のに、片方だけがデッドロックと判定される違いに注目する。",
        "In the diagram, follow the arrows from the user choosing a print mode to the page being printed, and see the process return to its first state afterwards. Later, compare the STOP and SKIP cards: both do nothing afterwards, yet only one is reported as a deadlock.",
      ),
    ],
    facts: [
      {
        label: t("状態", "States"),
        value: t(`${SPEC_LTS.stateCount}個`, `${SPEC_LTS.stateCount}`),
      },
      {
        label: t("遷移", "Transitions"),
        value: t(`${SPEC_LTS.transitionCount}本`, `${SPEC_LTS.transitionCount}`),
      },
      { label: t("最初に選べるイベント", "First choices"), value: choiceList },
      {
        label: t("実物の道具", "Real tools"),
        value: t("FDR（CSPM で書く）", "FDR (written in CSPM)"),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 2.1節（基本演算子）`,
          `${CSP_BOOK_EN}, section 2.1 (basic operators)`,
        ),
      },
    ],
    actors: [
      {
        id: "user",
        label: t("利用者", "User"),
        sublabel: t("刷り方を選ぶ", "chooses a mode"),
        icon: "person",
        x: 14,
        y: 27,
      },
      {
        id: "spec",
        label: START_KEY,
        sublabel: t("選ぶのを待つ状態", "waits for a choice"),
        icon: "process",
        x: 50,
        y: 27,
      },
      {
        id: "printing",
        label: AFTER_CHOICE_KEY,
        sublabel: t("刷るのを待つ状態", "waits to print"),
        icon: "state",
        x: 86,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "stop",
        label: "STOP",
        sublabel: t("何もしない", "does nothing"),
        icon: "state",
        x: 20,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "skip",
        label: "SKIP",
        sublabel: t("正しく終わる", "terminates"),
        icon: "state",
        x: 50,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("状態をたどる", "walks the states"),
        icon: "checker",
        x: 80,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "user", to: "spec" },
      { from: "spec", to: "printing" },
      { from: "checker", to: "spec" },
    ],
    steps: [
      {
        id: "write-spec",
        kind: "spec",
        title: t("名前でプロセスを書く", "Name and write a process"),
        actor: "spec",
        summary: t(
          `${START_KEY} は、mono（モノクロを選ぶ）か color（カラーを選ぶ）の後に print（刷る）を起こす`,
          `${START_KEY} performs print (print a page) after mono (choose black and white) or color (choose colour)`,
        ),
        explain: t(
          `CSP では、システムを「起こせるイベントの並び」で書く。プリンタの仕様に ${START_KEY} という名前を付け、選んで刷る動きだけを書く。中のデータや処理の順番は書かず、外から見える出来事だけで振る舞いを決める。`,
          `In CSP you describe a system by the sequences of events it can perform. The printer spec is named ${START_KEY} and only describes choosing and printing. Internal data and the order of internal work are left out; behaviour is defined only by what is visible from outside.`,
        ),
        set: {
          spec: { tone: "wait", rows: { [t("選べる", "offers")]: choiceList } },
        },
        detail: [
          {
            title: t("このサイトの書き方", "Notation on this site"),
            fields: [
              {
                label: START_KEY,
                value: `(mono → print → ${START_KEY}) □ (color → print → ${START_KEY})`,
                isCode: true,
              },
              {
                label: "mono",
                value: t("利用者がモノクロを選ぶ", "the user chooses black and white"),
              },
              {
                label: "color",
                value: t("利用者がカラーを選ぶ", "the user chooses colour"),
              },
              {
                label: "print",
                value: t("プリンタが1枚刷る", "the printer prints one page"),
              },
            ],
          },
        ],
        simplified: t(
          "実物の CSPM（FDR の記法）では、前置の → を ->、外部選択の □ を [] と書くなど、書き方が違う。このサイトでは記号で短く見せ、TypeScript で書いたモデルを自作の検査器で動かしている。",
          "Real CSPM (the notation used by FDR) is written differently: prefix → is ->, external choice □ is [], and so on. This site shows the symbols for brevity and runs models written in TypeScript on its own small checker.",
        ),
      },
      {
        id: "external-choice",
        kind: "run",
        title: t("外部選択は相手が選ぶ", "The other side picks"),
        actor: "user",
        to: ["spec"],
        summary: t(
          `□（外部選択）なので、${CHOICES.join("と")}のどちらにするかは利用者が決める`,
          `With □ (external choice), the user decides between ${CHOICES.join(" and ")}`,
        ),
        explain: t(
          `□ は外部選択と呼ぶ。プロセスは${CHOICES.join("と")}の両方を受け付けて待ち、どちらが起きるかは相手（ここでは利用者）が決める。テストでいえば、どちらの入力を送っても受け付けることを約束している。`,
          `□ is called external choice. The process waits, ready for both ${CHOICES.join(" and ")}, and the other side (here, the user) decides which happens. In test terms, it promises to accept either input.`,
        ),
        set: {
          user: { tone: "ok", rows: { [t("選んだ", "chose")]: CHOICES[0]! } },
          spec: { tone: "ok" },
        },
      },
      {
        id: "prefix",
        kind: "run",
        title: t("前置で順を決める", "Prefix fixes the order"),
        actor: "spec",
        to: ["printing"],
        summary: t(
          `${CHOICES[0]} の後は、${AFTER_CHOICE_KEY} の状態になる`,
          `After ${CHOICES[0]}, it moves to the state ${AFTER_CHOICE_KEY}`,
        ),
        explain: t(
          `a → P は前置と呼び、「イベント a を起こしてから P のように振る舞う」という意味。${CHOICES[0]} を起こした後は、print しか起こせない状態 ${AFTER_CHOICE_KEY} に移る。`,
          `a → P is called prefix: perform event a, then behave like P. After ${CHOICES[0]}, it moves to the state ${AFTER_CHOICE_KEY}, where only print is possible.`,
        ),
        set: {
          spec: { tone: "idle" },
          printing: {
            isHidden: false,
            tone: "wait",
            rows: { [t("次のイベント", "next event")]: BACK_EDGE.ev },
          },
        },
      },
      {
        id: "recursion",
        kind: "run",
        title: t("名前を呼んで戻る", "Call the name to loop"),
        actor: "printing",
        to: ["spec"],
        summary: t(
          `${BACK_EDGE.ev} の後は ${BACK_EDGE.to} に戻り、また選べる`,
          `After ${BACK_EDGE.ev} it returns to ${BACK_EDGE.to} and can choose again`,
        ),
        explain: t(
          `式の最後で自分の名前 ${BACK_EDGE.to} を呼ぶと、また最初から繰り返す（再帰）。プリンタは何枚でも刷れるが、状態は名前で数えるので有限のまま。`,
          `Calling its own name ${BACK_EDGE.to} at the end of the expression makes it start over (recursion). The printer can print any number of pages, but states are counted by name, so there are only finitely many.`,
        ),
        set: {
          user: { tone: "idle", rows: { [t("選んだ", "chose")]: null } },
          printing: {
            tone: "ok",
            rows: {
              [t("次のイベント", "next event")]: null,
              [t("刷った", "printed")]: t("1枚", "1 page"),
            },
          },
          spec: { tone: "wait" },
        },
      },
      {
        id: "count-states",
        kind: "explore",
        title: t("状態と遷移を数える", "Count states and transitions"),
        actor: "checker",
        to: ["spec"],
        summary: t(
          `全部たどると、状態${SPEC_LTS.stateCount}個・遷移${SPEC_LTS.transitionCount}本`,
          `Walking everything gives ${SPEC_LTS.stateCount} states and ${SPEC_LTS.transitionCount} transitions`,
        ),
        explain: t(
          `検査器は、起こせるイベントを幅優先で全部たどる。${START_KEY} から ${CHOICES.join(" と ")} の${CHOICES.length}本、${AFTER_CHOICE_KEY} から ${BACK_EDGE.ev} の${SPEC_LTS.transitionCount - CHOICES.length}本で、状態は${SPEC_LTS.stateCount}個しかない。再帰で何度繰り返しても、同じ状態に戻るだけなので数え切れる。`,
          `The checker walks every possible event breadth-first. There are ${CHOICES.length} transitions from ${START_KEY} (${CHOICES.join(" and ")}) and ${SPEC_LTS.transitionCount - CHOICES.length} from ${AFTER_CHOICE_KEY} (${BACK_EDGE.ev}), and only ${SPEC_LTS.stateCount} states. However many times the recursion repeats, it only returns to the same states, so they can all be counted.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "ok",
            rows: {
              [t("状態", "states")]: t(
                `${SPEC_LTS.stateCount}個`,
                `${SPEC_LTS.stateCount}`,
              ),
              [t("遷移", "transitions")]: t(
                `${SPEC_LTS.transitionCount}本`,
                `${SPEC_LTS.transitionCount}`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("たどった遷移", "Transitions walked"),
            fields: edgeLines(language),
          },
        ],
      },
      {
        id: "stop",
        kind: "found",
        title: t("STOP は何もしない", "STOP does nothing"),
        actor: "stop",
        summary: t(
          `STOP が起こせるイベントは${STOP_MOVES.length}個。print → STOP はデッドロックとして見つかる`,
          `STOP can perform ${STOP_MOVES.length} events. print → STOP is found as a deadlock`,
        ),
        explain: t(
          `STOP は、どのイベントも起こさないプロセス。「print → STOP」は1枚刷った後に止まったきりになり、検査器はこれを、正しく終わっていないのに動けない状態（デッドロック）として${PRINT_THEN_STOP.length}件見つける。`,
          `STOP is the process that performs no events. "print → STOP" prints one page and then is stuck for good, and the checker reports ${PRINT_THEN_STOP.length} ${PRINT_THEN_STOP.length === 1 ? "state" : "states"} that cannot move without having terminated properly (a deadlock).`,
        ),
        set: {
          stop: {
            isHidden: false,
            tone: "bad",
            rows: {
              [t("起こせる", "can do")]: t(
                `${STOP_MOVES.length}個`,
                `${STOP_MOVES.length}`,
              ),
              [t("デッドロック", "deadlocks")]: t(
                `${PRINT_THEN_STOP.length}件`,
                `${PRINT_THEN_STOP.length}`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("print → STOP を調べた結果", "Checking print → STOP"),
            fields: PRINT_THEN_STOP.map((trace, i) => ({
              label: t(`デッドロック${i + 1}`, `Deadlock ${i + 1}`),
              value: t(
                `${trace.join(" → ")} の後で止まる`,
                `stuck after ${trace.join(" → ")}`,
              ),
            })),
          },
        ],
      },
      {
        id: "skip",
        kind: "fix",
        title: t("SKIP は正しく終わる", "SKIP terminates properly"),
        actor: "skip",
        summary: t(
          `SKIP は ${skipEvents}（正しく終わった合図）だけを起こす。print → SKIP はデッドロックが${PRINT_THEN_SKIP.length}件`,
          `SKIP only performs ${skipEvents} (the signal of proper termination). print → SKIP has ${PRINT_THEN_SKIP.length} deadlocks`,
        ),
        explain: t(
          `SKIP は、${TICK}（チェック記号。正しく終わった合図）を起こして終わるプロセス。同じ「print の後に何もしない」でも、SKIP なら意図した終わり方なので、このサイトの検査器ではデッドロックは${PRINT_THEN_SKIP.length}件になる。止まったのか終わったのかを、STOP と SKIP で書き分ける。`,
          `SKIP is the process that performs ${TICK} (a tick mark, the signal of proper termination) and ends. It also does nothing after print, but this is the intended ending, so this site's checker finds ${PRINT_THEN_SKIP.length} deadlocks. STOP and SKIP let you say whether a process got stuck or finished.`,
        ),
        set: {
          skip: {
            isHidden: false,
            tone: "ok",
            rows: {
              [t("起こせる", "can do")]: skipEvents,
              [t("デッドロック", "deadlocks")]: t(
                `${PRINT_THEN_SKIP.length}件`,
                `${PRINT_THEN_SKIP.length}`,
              ),
            },
          },
        },
        simplified: t(
          `${TICK} は見える出来事の1つとして扱っている。外から見えない動きは ${TAU}（タウ）で、このレッスンの仕様には出てこない。CSP の理論では STOP（止まる）と SKIP（正しく終わる）は別のプロセスで、このサイトの検査器は ✓ で終わった状態をデッドロックに数えない。ただし、実物の検査器 ProB で同じモデルを確かめると、a → SKIP のように正しく終わった状態もデッドロックとして報告された（TLA+ の TLC と同じ）。FDR の扱いはマニュアルの定義からは読み取れず、確かめていない。`,
          `${TICK} is treated as one of the visible events. Invisible moves are ${TAU} (tau), which do not appear in this lesson's spec. In CSP theory, STOP (stuck) and SKIP (terminated properly) are different processes, and this site's checker does not count a state that ended with ✓ as a deadlock. However, checking the same model with the real checker ProB reported properly terminated states such as a → SKIP as deadlocks too (as TLA+'s TLC does). How FDR treats this could not be read from its manual's definitions and has not been checked.`,
        ),
      },
    ],
    lab: {
      title: t("イベントの並びを仕様に通す", "Run an event sequence through the spec"),
      hint: t(
        `カンマ区切りでイベントを並べる（例: ${DEFAULT_TRACE}）。仕様が起こせない並びは、どこで断られたかが分かる。「mono,color」のように print を飛ばすと、2個目で止まる。`,
        `List events separated by commas (e.g. ${DEFAULT_TRACE}). For a sequence the spec cannot perform, you see where it was refused. Skipping print, as in "mono,color", stops at the second event.`,
      ),
      inputs: [
        {
          id: "trace",
          label: t("イベントの並び", "Event sequence"),
          initial: DEFAULT_TRACE,
        },
      ],
      compute: (values): Field[] => {
        const trace = parseTrace(values.trace);
        const result = acceptsTrace(SPEC, PRINTER_ENV, trace);
        const fields: Field[] = [
          { label: t("並び", "Sequence"), value: trace.join(" → "), isCode: true },
          {
            label: t("受け付けたか", "Accepted?"),
            value: result.isAccepted
              ? t("受け付けた", "accepted")
              : t("受け付けない", "refused"),
            tone: result.isAccepted ? "ok" : "bad",
          },
          {
            label: t("進めたイベント", "Events performed"),
            value: t(
              `${result.acceptedCount}個 / ${trace.length}個`,
              `${result.acceptedCount} / ${trace.length}`,
            ),
          },
        ];
        if (!result.isAccepted) {
          fields.push({
            label: t("断られたイベント", "Refused event"),
            value: t(
              `${result.acceptedCount + 1}個目の ${trace[result.acceptedCount]}`,
              `${trace[result.acceptedCount]} (event ${result.acceptedCount + 1})`,
            ),
            tone: "bad",
          });
        }
        return fields;
      },
    },
  };
}

// 既定の並びは受け付けられる前提でヒントを書いている。モデルが変わって前提が崩れたら、ここで気づけるようにする。
if (!SAMPLE_CHECK.isAccepted)
  throw new Error("既定のイベントの並びを仕様が受け付けない");
