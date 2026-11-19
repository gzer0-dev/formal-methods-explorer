import type { Field, Lesson, Step } from "../../core/types";
import { CSP_BOOK } from "../references";
import { moves, type Proc, TAU, traceTo } from "../csp";
import {
  type Derivation,
  derivationOf,
  derivationText,
  nextStepsFor,
  pathWithTau,
  type TakenMove,
  tauOrigin,
} from "../cspDerivation";
import { counterSystem, COUNTER_ENV, PRINTER_ENV, printerImpl } from "../cspModels";

const TARGET_EVENT = "result.1";

const SYSTEM = counterSystem(false);
const FOUND_PATH = pathWithTau(SYSTEM, COUNTER_ENV, TARGET_EVENT);
if (!FOUND_PATH) throw new Error(`カウンタが${TARGET_EVENT}に着かない`);
const PATH = FOUND_PATH;
const VISIBLE_PATH = traceTo(SYSTEM, COUNTER_ENV, TARGET_EVENT) ?? [];
const TAU_INDICES = PATH.flatMap((step, index) =>
  step.move.ev === TAU ? [index] : [],
);
// 下のステップは「見える3手 → τ → 見える1手 → τ → τ → 見える2手」の並びを前提に書いている。
// モデルを変えて並びが変わったら、説明が嘘にならないよう読み込み時に止める。
if (PATH.length !== 9 || TAU_INDICES.join(",") !== "3,5,6") {
  throw new Error(`カウンタの手順の形が想定と違う: τ の位置${TAU_INDICES.join(",")}`);
}
const at = (index: number): TakenMove => PATH[index]!;

const PRINTER = printerImpl();
const PRINTER_FIRST: TakenMove[] = moves(PRINTER, PRINTER_ENV).map((move) => ({
  move,
  derivation: derivationOf(PRINTER, PRINTER_ENV, move),
}));

const RULE_NAMES: [string, string][] = [
  ["Prefix", "前置: a → P が a を起こして P になる"],
  ["ExtCh1 / ExtCh2", "外部選択 □ の左／右が見えるイベントで動き、選択が決まる"],
  ["ExtChTau1 / ExtChTau2", "外部選択の左／右の中の τ。選択はまだ決まらない"],
  ["IntCh1 / IntCh2", "内部選択 ⊓ で左／右を勝手に選ぶ（τ）"],
  ["PName", "名前（Var や Adder）を定義の中身に置きかえて動く"],
  ["Par1 / Par2", "並行合成の左／右だけが、同期しないイベントで動く"],
  ["ParSync", "同期するイベントで、左右がそろって動く"],
  ["ParTick1 / ParTick2", "左／右が終わった合図 ✓ を、全体では τ として受け取る"],
  ["ParTerm", "左右とも終わったので、全体が ✓ を出す"],
  ["Hide1 / Hide2", "隠したイベントを τ にする／隠していないイベントはそのまま"],
  ["HideTick", "隠蔽の中が終わった合図 ✓ は、隠さずにそのまま出す"],
  ["Seq", "逐次合成 P ; Q の前半 P が動く"],
  ["SeqTick", "前半が ✓ で終わり、後半 Q へ進む（τ）"],
  ["Skip", "SKIP が終わりの合図 ✓ を出す"],
];

/** 一番外側の並行合成で、どちらの側が動いたか（左が変数 Var、右が足し手）。 */
function movers(d: Derivation): string[] {
  if (d.rule === "ParSync") return ["var", "adders"];
  return d.rule === "Par1" ? ["var"] : ["adders"];
}

function rulesRows(step: TakenMove): Record<string, string | null> {
  return {
    手: step.move.ev,
    外側: step.move.rule,
    "τ の出どころ": step.move.ev === TAU ? tauOrigin(step.derivation) : null,
  };
}

function derivationField(step: TakenMove, label: string): Field {
  return { label, value: derivationText(step.derivation), isCode: true };
}

const SIMPLIFIED_NAMES =
  "規則名は Roscoe の操作的意味論の呼び方に合わせたもので、書籍の規則名と細部が違う場合がある。導出は moves を部分プロセスにも当てて組み立てた（cspDerivation.ts）。";

function moveStep(
  id: string,
  title: string,
  indices: number[],
  summary: string,
  explain: string,
  kind: Step["kind"] = "run",
): Step {
  const steps = indices.map(at);
  const lastStep = steps.at(-1)!;
  return {
    id,
    kind,
    title,
    actor: "whole",
    to: [...new Set(steps.flatMap((step) => movers(step.derivation)))],
    summary,
    explain,
    set: {
      whole: { rows: { 状態: null, 直前の手: lastStep.move.ev } },
      rules: {
        isHidden: false,
        tone: kind === "found" ? "bad" : "wait",
        rows: rulesRows(lastStep),
      },
    },
    detail: [
      {
        title: "この手の導出（外側の規則(内側の規則, …)）",
        fields: steps.map((step) => derivationField(step, step.move.ev)),
      },
    ],
  };
}

function parseEvents(text: string | undefined): string[] {
  const events = (text ?? "")
    .split(/[,、]/)
    .map((ev) => ev.trim())
    .filter((ev) => ev !== "");
  // 空の入力は既定の手順（result.1 までの最短）に戻す
  return events.length > 0 ? events : VISIBLE_PATH;
}

export const cspRulesLesson: Lesson = {
  id: "csp-rules",
  category: "csp",
  title: "遷移規則で1手ずつ",
  subtitle: "状態遷移図は、演算子ごとの規則を当てて作る",
  summary: `カウンタが${TARGET_EVENT}に着く最短の${PATH.length}手（見える${VISIBLE_PATH.length}手と、τ の${TAU_INDICES.length}手）を、どの遷移規則で動いたかとともに1手ずつたどる。`,
  intro: [
    "遷移規則は、前置・外部選択・並行合成・隠蔽などの演算子ごとに、「この形の式なら、このイベントで、この式に進む」と決めた規則だ。検査器は、今の式に規則を当てて次の状態を作ることをくり返し、状態遷移図を組み立てている。",
    "これまでのレッスンでは、検査器が出す図や反例をそのまま受け取ってきた。規則を1手ずつ見ると、見えない手 τ がどこから生まれるのか、なぜその手順を起こせるのかを、検査器の内側から説明できるようになる。",
    "図では、「並行合成と同期」のカウンタで更新が消える手順を1手ずつ進め、使った規則のカードに出る規則名を追う。足し手が終わった合図 ✓ が τ に変わる手が分かれ目で、最後にプリンタの内部選択から生まれる τ も見る。",
  ],
  facts: [
    { label: "見える手順", value: VISIBLE_PATH.join(" → ") },
    {
      label: "τ も含めた手数",
      value: `${PATH.length}手（うち τ は${TAU_INDICES.length}手）`,
    },
    {
      label: "τ の出どころ",
      value: TAU_INDICES.map((index) => tauOrigin(at(index).derivation)).join("・"),
    },
    { label: "規則の種類", value: `${RULE_NAMES.length}組` },
    { label: "参考文献", value: `${CSP_BOOK} 5.3節（遷移規則）` },
  ],
  actors: [
    {
      id: "var",
      label: "Var",
      sublabel: "共有の変数",
      icon: "variable",
      x: 14,
      y: 27,
    },
    {
      id: "adders",
      label: "足し手 A・B",
      sublabel: "(Adder ||| Adder) ; finish",
      icon: "process",
      x: 38,
      y: 27,
    },
    {
      id: "whole",
      label: "全体",
      sublabel: "Var [| 読み書き |] 足し手",
      icon: "state",
      x: 62,
      y: 27,
    },
    {
      id: "rules",
      label: "使った規則",
      sublabel: "moves の rule",
      icon: "checker",
      x: 86,
      y: 27,
      initial: { isHidden: true },
    },
    {
      id: "printer",
      label: "プリンタ",
      sublabel: "Impl",
      icon: "process",
      x: 50,
      y: 73,
      initial: { isHidden: true },
    },
  ],
  links: [
    { from: "var", to: "whole" },
    { from: "adders", to: "whole" },
    { from: "whole", to: "rules" },
    { from: "printer", to: "rules" },
  ],
  steps: [
    {
      id: "intro",
      kind: "spec",
      title: "規則を当てて図を作る",
      actor: "whole",
      to: ["var", "adders"],
      summary: "演算子ごとに「この形なら、この手で、この状態へ」という規則がある",
      explain:
        "CSP の状態遷移図は手で描くのではなく、演算子ごとの遷移規則（前置・外部選択・並行合成・隠蔽など）を、今の式に当てて次の状態を作ることをくり返してできる。検査器の moves はこの規則をそのまま実装していて、各手にいちばん外側の演算子の規則名を付けて返す。",
      set: { whole: { tone: "wait", rows: { 状態: "最初" } } },
      detail: [
        {
          title: "規則名と意味",
          fields: RULE_NAMES.map(([label, value]) => ({ label, value })),
        },
        {
          title: "イベント名の読み方",
          fields: [
            { label: "read.A.0", value: "足し手Aが変数から値0を読む" },
            { label: "write.A.1", value: "足し手Aが変数に値1を書く" },
            { label: "finish", value: "足し手が全員終わった合図" },
            { label: "result.1", value: "変数が最後の値1を報告する" },
          ],
        },
      ],
      simplified: `${SIMPLIFIED_NAMES}式の書き方も実物の CSPM（FDR の記法）とは違う。`,
    },
    moveStep(
      "read-a",
      "同期で読む",
      [0],
      `${at(0).move.ev}: 外側は${at(0).move.rule}、左右の前提をそれぞれ持つ`,
      `read.A.0 は変数と足し手の同期集合にあるので、両側がそろって動く${at(0).move.rule}の規則になる。左（Var）は PName で定義を開き、何段も重ねた □ の左端を選ぶ。右（足し手）は逐次合成 Seq の前半で、インタリーブの左側のAが動く。`,
    ),
    moveStep(
      "read-write",
      "Bも読み、Aが書く",
      [1, 2],
      `${at(1).move.ev}・${at(2).move.ev}: どちらも${at(1).move.rule}`,
      `Bも同じ値0を読み、続いてAが1を書く。どちらも同期のイベントなので外側は${at(2).move.rule}のまま。変数の側は、選んだ選択肢の位置によって ExtCh1 と ExtCh2 の重なり方が変わる。`,
    ),
    moveStep(
      "a-done",
      "Aの終わりは τ",
      [3],
      `τ: 外側は${at(3).move.rule}、出どころは${tauOrigin(at(3).derivation)}`,
      `Aは書き終えて SKIP になり、終わりの合図 ✓ を出す。けれど全体はまだ終わっていないので、インタリーブがこの ✓ を${tauOrigin(at(3).derivation)}で τ（見えない手）に変える。外から見えるイベントは何も起きていない。`,
    ),
    moveStep(
      "b-write",
      "Bが書いて終わる",
      [4, 5],
      `${at(4).move.ev}の後、τ（出どころは${tauOrigin(at(5).derivation)}）`,
      `Bも読んだ0に1を足して${at(4).move.ev}を書く。Aの1を上書きしたので、ここで更新が1つ消えている。Bの ✓ も${tauOrigin(at(5).derivation)}で τ になる。`,
    ),
    moveStep(
      "seq-tick",
      "全員終わり finish へ",
      [6],
      `τ: 出どころは${tauOrigin(at(6).derivation)}（前提は${at(6).derivation.premises[0]?.premises[0]?.rule ?? "なし"}）`,
      `AとBの両方が終わったので、インタリーブ全体が${at(6).derivation.premises[0]?.premises[0]?.rule ?? "なし"}で ✓ を出す。その ✓ を逐次合成が${tauOrigin(at(6).derivation)}で τ に変え、後半の finish → SKIP へ進む。見えない手が${TAU_INDICES.length}回あったのは、終わりの合図を受け渡すためだった。`,
    ),
    moveStep(
      "result",
      `${TARGET_EVENT}に着く`,
      [7, 8],
      `${at(7).move.ev}（${at(7).move.rule}）の後、${at(8).move.ev}（${at(8).move.rule}）`,
      `finish は両側の同期で起き、変数は最後の値を${at(8).move.ev}で報告する。足し手の側はもう終わりを待つだけなので、変数だけが動く${at(8).move.rule}になる。2回足したのに結果が1になる、更新が消える手順が規則の並びとして見えた。`,
      "found",
    ),
    {
      id: "printer",
      kind: "explore",
      title: "内部選択の τ",
      actor: "printer",
      to: ["rules"],
      summary: `プリンタの最初の2本の τ は、外側が${PRINTER_FIRST.map((step) => step.move.rule).join("・")}、内側が${PRINTER_FIRST.map((step) => tauOrigin(step.derivation)).join("・")}`,
      explain: `「拒否で見分ける」のプリンタの実装は、名前 Impl を開くと内部選択 ⊓ になっている。最初の2本の τ は、moves の rule では名前を開く${PRINTER_FIRST[0]?.move.rule}と出るが、内側まで見ると${PRINTER_FIRST.map((step) => tauOrigin(step.derivation)).join(" と ")}で左右を勝手に選んだ手だと分かる。`,
      set: {
        printer: { isHidden: false, tone: "wait", rows: { 最初の手: "τ が2本" } },
        rules: {
          tone: "ok",
          rows: {
            手: TAU,
            外側: PRINTER_FIRST[0]?.move.rule ?? "なし",
            "τ の出どころ": PRINTER_FIRST.map((step) =>
              tauOrigin(step.derivation),
            ).join("・"),
          },
        },
      },
      detail: [
        {
          title: "最初の2本の導出",
          fields: PRINTER_FIRST.map((step, index) => ({
            label: `${index + 1}本目`,
            value: derivationText(step.derivation),
            isCode: true,
          })),
        },
      ],
      simplified:
        "このサイトの moves は、いちばん外側の規則だけを rule に入れる。名前の展開（PName）の内側の規則は、部分プロセスに moves を当て直して求めた。",
    },
  ],
  lab: {
    title: "イベントの並びから規則を出す",
    hint: "カウンタのイベント名をカンマ区切りで入れる（例: read.A.0, write.A.1）。必要な τ は自動で挟む。動けないイベントが来たらそこで止まる。",
    inputs: [
      { id: "events", label: "イベントの並び", initial: VISIBLE_PATH.join(", ") },
    ],
    compute: (values): Field[] => {
      const events = parseEvents(values.events);
      const fields: Field[] = [];
      let state: Proc = SYSTEM;
      for (const ev of events) {
        const found = nextStepsFor(state, COUNTER_ENV, ev);
        if (!found) {
          fields.push({
            label: ev,
            value: "この時点では起こせないので止まった",
            tone: "bad",
          });
          return fields;
        }
        for (const step of found) {
          fields.push({
            label: step.move.ev,
            value: `${step.move.rule}: ${derivationText(step.derivation)}`,
            isCode: true,
          });
          state = step.move.to;
        }
      }
      fields.push({
        label: "結果",
        value: `${events.length}個のイベントをすべて起こせた`,
        tone: "ok",
      });
      return fields;
    },
  },
};
