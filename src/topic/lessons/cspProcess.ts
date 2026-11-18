import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
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

function edgeLines(): Field[] {
  return SPEC_LTS.edges.map((edge, i) => ({
    label: `遷移${i + 1}`,
    value: `${edge.from} --${edge.ev}--> ${edge.to}`,
    isCode: true,
  }));
}

export const cspProcessLesson: Lesson = {
  id: "csp-process",
  category: "csp",
  title: "プロセスとイベント",
  subtitle: "プリンタの仕様をイベントの並びで書く",
  summary: `CSP では、システムを「イベントを起こすプロセス」として書く。プリンタの仕様を前置・外部選択・再帰で書くと、状態は${SPEC_LTS.stateCount}個、遷移は${SPEC_LTS.transitionCount}本になる。`,
  facts: [
    { label: "状態", value: `${SPEC_LTS.stateCount}個` },
    { label: "遷移", value: `${SPEC_LTS.transitionCount}本` },
    { label: "最初に選べるイベント", value: CHOICES.join("・") },
    { label: "実物の道具", value: "FDR（CSPM で書く）" },
    { label: "参考文献", value: `${CSP_BOOK} 2.1節（基本演算子）` },
  ],
  actors: [
    {
      id: "user",
      label: "利用者",
      sublabel: "刷り方を選ぶ",
      icon: "person",
      x: 14,
      y: 27,
    },
    {
      id: "spec",
      label: START_KEY,
      sublabel: "選ぶのを待つ状態",
      icon: "process",
      x: 50,
      y: 27,
    },
    {
      id: "printing",
      label: AFTER_CHOICE_KEY,
      sublabel: "刷るのを待つ状態",
      icon: "state",
      x: 86,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "stop",
      label: "STOP",
      sublabel: "何もしない",
      icon: "state",
      x: 20,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "skip",
      label: "SKIP",
      sublabel: "正しく終わる",
      icon: "state",
      x: 50,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "状態をたどる",
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
      title: "名前でプロセスを書く",
      actor: "spec",
      summary: `${START_KEY} は、mono（モノクロを選ぶ）か color（カラーを選ぶ）の後に print（刷る）を起こす`,
      explain: `CSP では、システムを「起こせるイベントの並び」で書く。プリンタの仕様に ${START_KEY} という名前を付け、選んで刷る動きだけを書く。中のデータや処理の順番は書かず、外から見える出来事だけで振る舞いを決める。`,
      set: {
        spec: { tone: "wait", rows: { 選べる: CHOICES.join("・") } },
      },
      detail: [
        {
          title: "このサイトの書き方",
          fields: [
            {
              label: START_KEY,
              value: `(mono → print → ${START_KEY}) □ (color → print → ${START_KEY})`,
              isCode: true,
            },
            { label: "mono", value: "利用者がモノクロを選ぶ" },
            { label: "color", value: "利用者がカラーを選ぶ" },
            { label: "print", value: "プリンタが1枚刷る" },
          ],
        },
      ],
      simplified:
        "実物の CSPM（FDR の記法）では、前置の → を ->、外部選択の □ を [] と書くなど、書き方が違う。このサイトでは記号で短く見せ、TypeScript で書いたモデルを自作の検査器で動かしている。",
    },
    {
      id: "external-choice",
      kind: "run",
      title: "外部選択は相手が選ぶ",
      actor: "user",
      to: ["spec"],
      summary: `□（外部選択）なので、${CHOICES.join("と")}のどちらにするかは利用者が決める`,
      explain: `□ は外部選択と呼ぶ。プロセスは${CHOICES.join("と")}の両方を受け付けて待ち、どちらが起きるかは相手（ここでは利用者）が決める。テストでいえば、どちらの入力を送っても受け付けることを約束している。`,
      set: {
        user: { tone: "ok", rows: { 選んだ: CHOICES[0]! } },
        spec: { tone: "ok" },
      },
    },
    {
      id: "prefix",
      kind: "run",
      title: "前置で順を決める",
      actor: "spec",
      to: ["printing"],
      summary: `${CHOICES[0]} の後は、${AFTER_CHOICE_KEY} の状態になる`,
      explain: `a → P は前置と呼び、「イベント a を起こしてから P のように振る舞う」という意味。${CHOICES[0]} を起こした後は、print しか起こせない状態 ${AFTER_CHOICE_KEY} に移る。`,
      set: {
        spec: { tone: "idle" },
        printing: {
          isHidden: false,
          tone: "wait",
          rows: { 次のイベント: BACK_EDGE.ev },
        },
      },
    },
    {
      id: "recursion",
      kind: "run",
      title: "名前を呼んで戻る",
      actor: "printing",
      to: ["spec"],
      summary: `${BACK_EDGE.ev} の後は ${BACK_EDGE.to} に戻り、また選べる`,
      explain: `式の最後で自分の名前 ${BACK_EDGE.to} を呼ぶと、また最初から繰り返す（再帰）。プリンタは何枚でも刷れるが、状態は名前で数えるので有限のまま。`,
      set: {
        user: { tone: "idle", rows: { 選んだ: null } },
        printing: { tone: "ok", rows: { 次のイベント: null, 刷った: "1枚" } },
        spec: { tone: "wait" },
      },
    },
    {
      id: "count-states",
      kind: "explore",
      title: "状態と遷移を数える",
      actor: "checker",
      to: ["spec"],
      summary: `全部たどると、状態${SPEC_LTS.stateCount}個・遷移${SPEC_LTS.transitionCount}本`,
      explain: `検査器は、起こせるイベントを幅優先で全部たどる。${START_KEY} から ${CHOICES.join(" と ")} の${CHOICES.length}本、${AFTER_CHOICE_KEY} から ${BACK_EDGE.ev} の${SPEC_LTS.transitionCount - CHOICES.length}本で、状態は${SPEC_LTS.stateCount}個しかない。再帰で何度繰り返しても、同じ状態に戻るだけなので数え切れる。`,
      set: {
        checker: {
          isHidden: false,
          tone: "ok",
          rows: {
            状態: `${SPEC_LTS.stateCount}個`,
            遷移: `${SPEC_LTS.transitionCount}本`,
          },
        },
      },
      detail: [{ title: "たどった遷移", fields: edgeLines() }],
    },
    {
      id: "stop",
      kind: "found",
      title: "STOP は何もしない",
      actor: "stop",
      summary: `STOP が起こせるイベントは${STOP_MOVES.length}個。print → STOP はデッドロックとして見つかる`,
      explain: `STOP は、どのイベントも起こさないプロセス。「print → STOP」は1枚刷った後に止まったきりになり、検査器はこれを、正しく終わっていないのに動けない状態（デッドロック）として${PRINT_THEN_STOP.length}件見つける。`,
      set: {
        stop: {
          isHidden: false,
          tone: "bad",
          rows: {
            起こせる: `${STOP_MOVES.length}個`,
            デッドロック: `${PRINT_THEN_STOP.length}件`,
          },
        },
      },
      detail: [
        {
          title: "print → STOP を調べた結果",
          fields: PRINT_THEN_STOP.map((trace, i) => ({
            label: `デッドロック${i + 1}`,
            value: `${trace.join(" → ")} の後で止まる`,
          })),
        },
      ],
    },
    {
      id: "skip",
      kind: "fix",
      title: "SKIP は正しく終わる",
      actor: "skip",
      summary: `SKIP は ${SKIP_MOVES.map((m) => m.ev).join("・")}（正しく終わった合図）だけを起こす。print → SKIP はデッドロックが${PRINT_THEN_SKIP.length}件`,
      explain: `SKIP は、${TICK}（チェック記号。正しく終わった合図）を起こして終わるプロセス。同じ「print の後に何もしない」でも、SKIP なら意図した終わり方なので、デッドロックは${PRINT_THEN_SKIP.length}件になる。止まったのか終わったのかを、STOP と SKIP で書き分ける。`,
      set: {
        skip: {
          isHidden: false,
          tone: "ok",
          rows: {
            起こせる: SKIP_MOVES.map((m) => m.ev).join("・"),
            デッドロック: `${PRINT_THEN_SKIP.length}件`,
          },
        },
      },
      simplified: `${TICK} は見える出来事の1つとして扱っている。外から見えない動きは ${TAU}（タウ）で、このレッスンの仕様には出てこない。CSP の理論では STOP（止まる）と SKIP（正しく終わる）は別のプロセス。ただし、FDR の deadlock free の表明が SKIP で終わった状態をどう扱うかは、マニュアルの定義からは読み取れなかったので確かめていない（TLA+ の TLC は、正しく終わった状態も止まったと報告する）。`,
    },
  ],
  lab: {
    title: "イベントの並びを仕様に通す",
    hint: `カンマ区切りでイベントを並べる（例: ${DEFAULT_TRACE}）。仕様が起こせない並びは、どこで断られたかが分かる。「mono,color」のように print を飛ばすと、2個目で止まる。`,
    inputs: [{ id: "trace", label: "イベントの並び", initial: DEFAULT_TRACE }],
    compute: (values): Field[] => {
      const trace = parseTrace(values.trace);
      const result = acceptsTrace(SPEC, PRINTER_ENV, trace);
      const fields: Field[] = [
        { label: "並び", value: trace.join(" → "), isCode: true },
        {
          label: "受け付けたか",
          value: result.isAccepted ? "受け付けた" : "受け付けない",
          tone: result.isAccepted ? "ok" : "bad",
        },
        {
          label: "進めたイベント",
          value: `${result.acceptedCount}個 / ${trace.length}個`,
        },
      ];
      if (!result.isAccepted) {
        fields.push({
          label: "断られたイベント",
          value: `${result.acceptedCount + 1}個目の ${trace[result.acceptedCount]}`,
          tone: "bad",
        });
      }
      return fields;
    },
  },
};

// 既定の並びは受け付けられる前提でヒントを書いている。モデルが変わって前提が崩れたら、ここで気づけるようにする。
if (!SAMPLE_CHECK.isAccepted)
  throw new Error("既定のイベントの並びを仕様が受け付けない");
