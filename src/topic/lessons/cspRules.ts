import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson, Step } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
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

const RULE_NAMES: [string, string, string][] = [
  [
    "Prefix",
    "前置: a → P が a を起こして P になる",
    "Prefix: a → P performs a and becomes P",
  ],
  [
    "ExtCh1 / ExtCh2",
    "外部選択 □ の左／右が見えるイベントで動き、選択が決まる",
    "The left/right of external choice □ moves on a visible event; the choice is made",
  ],
  [
    "ExtChTau1 / ExtChTau2",
    "外部選択の左／右の中の τ。選択はまだ決まらない",
    "A τ inside the left/right of external choice; the choice is not made yet",
  ],
  [
    "IntCh1 / IntCh2",
    "内部選択 ⊓ で左／右を勝手に選ぶ（τ）",
    "Internal choice ⊓ picks left/right on its own (τ)",
  ],
  [
    "PName",
    "名前（Var や Adder）を定義の中身に置きかえて動く",
    "Replace a name (Var, Adder) by its definition and move",
  ],
  [
    "Par1 / Par2",
    "並行合成の左／右だけが、同期しないイベントで動く",
    "Only the left/right of a parallel composition moves, on an unsynchronised event",
  ],
  [
    "ParSync",
    "同期するイベントで、左右がそろって動く",
    "Both sides move together on a synchronised event",
  ],
  [
    "ParTick1 / ParTick2",
    "左／右が終わった合図 ✓ を、全体では τ として受け取る",
    "The left/right's termination signal ✓ becomes τ for the whole",
  ],
  [
    "ParTerm",
    "左右とも終わったので、全体が ✓ を出す",
    "Both sides are done, so the whole performs ✓",
  ],
  [
    "Hide1 / Hide2",
    "隠したイベントを τ にする／隠していないイベントはそのまま",
    "A hidden event becomes τ / an unhidden event passes through",
  ],
  [
    "HideTick",
    "隠蔽の中が終わった合図 ✓ は、隠さずにそのまま出す",
    "The ✓ from inside hiding is passed out, not hidden",
  ],
  [
    "Seq",
    "逐次合成 P ; Q の前半 P が動く",
    "The first part P of sequential composition P ; Q moves",
  ],
  [
    "SeqTick",
    "前半が ✓ で終わり、後半 Q へ進む（τ）",
    "The first part ends with ✓ and it moves on to Q (τ)",
  ],
  ["Skip", "SKIP が終わりの合図 ✓ を出す", "SKIP performs the termination signal ✓"],
];

/** 一番外側の並行合成で、どちらの側が動いたか（左が変数 Var、右が足し手）。 */
function movers(d: Derivation): string[] {
  if (d.rule === "ParSync") return ["var", "adders"];
  return d.rule === "Par1" ? ["var"] : ["adders"];
}

function rulesRows(step: TakenMove, language: Language): Record<string, string | null> {
  const t = translator(language);
  return {
    [t("手", "move")]: step.move.ev,
    [t("外側", "outer")]: step.move.rule,
    [t("τ の出どころ", "τ from")]:
      step.move.ev === TAU ? tauOrigin(step.derivation) : null,
  };
}

function derivationField(step: TakenMove, label: string): Field {
  return { label, value: derivationText(step.derivation), isCode: true };
}

function simplifiedNames(language: Language): string {
  return translator(language)(
    "規則名は Roscoe の操作的意味論の呼び方に合わせたもので、書籍の規則名と細部が違う場合がある。導出は moves を部分プロセスにも当てて組み立てた（cspDerivation.ts）。",
    "Rule names follow Roscoe's operational semantics and may differ in detail from the book's rule names. Derivations are built by also applying moves to subprocesses (cspDerivation.ts).",
  );
}

function moveStep(
  language: Language,
  id: string,
  title: string,
  indices: number[],
  summary: string,
  explain: string,
  kind: Step["kind"] = "run",
): Step {
  const t = translator(language);
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
      whole: {
        rows: {
          [t("状態", "state")]: null,
          [t("直前の手", "last move")]: lastStep.move.ev,
        },
      },
      rules: {
        isHidden: false,
        tone: kind === "found" ? "bad" : "wait",
        rows: rulesRows(lastStep, language),
      },
    },
    detail: [
      {
        title: t(
          "この手の導出（外側の規則(内側の規則, …)）",
          "Derivation of this move (outer rule(inner rules, …))",
        ),
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

export function cspRulesLesson(language: Language): Lesson {
  const t = translator(language);
  const tauOrigins = TAU_INDICES.map((index) => tauOrigin(at(index).derivation));
  const seqPremise =
    at(6).derivation.premises[0]?.premises[0]?.rule ?? t("なし", "none");
  const printerOrigins = PRINTER_FIRST.map((step) => tauOrigin(step.derivation));
  return {
    id: "csp-rules",
    category: "csp",
    title: t("遷移規則で1手ずつ", "Transition rules, one step at a time"),
    subtitle: t(
      "状態遷移図は、演算子ごとの規則を当てて作る",
      "The state graph is built by applying per-operator rules",
    ),
    summary: t(
      `カウンタが${TARGET_EVENT}に着く最短の${PATH.length}手（見える${VISIBLE_PATH.length}手と、τ の${TAU_INDICES.length}手）を、どの遷移規則で動いたかとともに1手ずつたどる。`,
      `Follow, one step at a time, the shortest ${PATH.length} steps by which the counter reaches ${TARGET_EVENT} (${VISIBLE_PATH.length} visible and ${TAU_INDICES.length} τ), along with the transition rule behind each move.`,
    ),
    intro: [
      t(
        "遷移規則は、前置・外部選択・並行合成・隠蔽などの演算子ごとに、「この形の式なら、このイベントで、この式に進む」と決めた規則だ。検査器は、今の式に規則を当てて次の状態を作ることをくり返し、状態遷移図を組み立てている。",
        'Transition rules are defined for each operator, such as prefix, external choice, parallel composition and hiding: "an expression of this shape moves on this event to this expression". The checker builds the state graph by repeatedly applying the rules to the current expression to get the next states.',
      ),
      t(
        "これまでのレッスンでは、検査器が出す図や反例をそのまま受け取ってきた。規則を1手ずつ見ると、見えない手 τ がどこから生まれるのか、なぜその手順を起こせるのかを、検査器の内側から説明できるようになる。",
        "So far we have taken the checker's graphs and counterexamples as given. Looking at the rules move by move lets you explain from inside the checker where invisible τ moves come from and why a sequence of steps is possible.",
      ),
      t(
        "図では、「並行合成と同期」のカウンタで更新が消える手順を1手ずつ進め、使った規則のカードに出る規則名を追う。足し手が終わった合図 ✓ が τ に変わる手が分かれ目で、最後にプリンタの内部選択から生まれる τ も見る。",
        "In the diagram, step through the lost-update path of the counter from \"Parallel composition\" and follow the rule names on the rules card. The turning point is the move where an adder's termination signal ✓ becomes τ; at the end, also see the τ that comes from the printer's internal choice.",
      ),
    ],
    facts: [
      { label: t("見える手順", "Visible steps"), value: VISIBLE_PATH.join(" → ") },
      {
        label: t("τ も含めた手数", "Steps including τ"),
        value: t(
          `${PATH.length}手（うち τ は${TAU_INDICES.length}手）`,
          `${PATH.length} (${TAU_INDICES.length} of them τ)`,
        ),
      },
      {
        label: t("τ の出どころ", "Where τ comes from"),
        value: t(tauOrigins.join("・"), tauOrigins.join(", ")),
      },
      {
        label: t("規則の種類", "Rule groups"),
        value: t(`${RULE_NAMES.length}組`, `${RULE_NAMES.length}`),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 5.3節（遷移規則）`,
          `${CSP_BOOK_EN}, section 5.3 (transition rules)`,
        ),
      },
    ],
    actors: [
      {
        id: "var",
        label: "Var",
        sublabel: t("共有の変数", "shared variable"),
        icon: "variable",
        x: 14,
        y: 27,
      },
      {
        id: "adders",
        label: t("足し手 A・B", "Adders A, B"),
        sublabel: "(Adder ||| Adder) ; finish",
        icon: "process",
        x: 38,
        y: 27,
      },
      {
        id: "whole",
        label: t("全体", "System"),
        sublabel: t("Var [| 読み書き |] 足し手", "Var [| read, write |] adders"),
        icon: "state",
        x: 62,
        y: 27,
      },
      {
        id: "rules",
        label: t("使った規則", "Rules used"),
        sublabel: t("moves の rule", "rule from moves"),
        icon: "checker",
        x: 86,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "printer",
        label: t("プリンタ", "Printer"),
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
        title: t("規則を当てて図を作る", "Build the graph from rules"),
        actor: "whole",
        to: ["var", "adders"],
        summary: t(
          "演算子ごとに「この形なら、この手で、この状態へ」という規則がある",
          'Each operator has rules: "from this shape, by this move, to this state"',
        ),
        explain: t(
          "CSP の状態遷移図は手で描くのではなく、演算子ごとの遷移規則（前置・外部選択・並行合成・隠蔽など）を、今の式に当てて次の状態を作ることをくり返してできる。検査器の moves はこの規則をそのまま実装していて、各手にいちばん外側の演算子の規則名を付けて返す。",
          "A CSP state graph is not drawn by hand: it comes from repeatedly applying each operator's transition rules (prefix, external choice, parallel composition, hiding and so on) to the current expression to get the next states. The checker's moves implements these rules directly and labels each move with the rule name of the outermost operator.",
        ),
        set: {
          whole: { tone: "wait", rows: { [t("状態", "state")]: t("最初", "initial") } },
        },
        detail: [
          {
            title: t("規則名と意味", "Rule names and meanings"),
            fields: RULE_NAMES.map(([label, ja, en]) => ({ label, value: t(ja, en) })),
          },
          {
            title: t("イベント名の読み方", "Reading event names"),
            fields: [
              {
                label: "read.A.0",
                value: t(
                  "足し手Aが変数から値0を読む",
                  "adder A reads the value 0 from the variable",
                ),
              },
              {
                label: "write.A.1",
                value: t(
                  "足し手Aが変数に値1を書く",
                  "adder A writes the value 1 to the variable",
                ),
              },
              {
                label: "finish",
                value: t(
                  "足し手が全員終わった合図",
                  "the signal that all adders are done",
                ),
              },
              {
                label: "result.1",
                value: t(
                  "変数が最後の値1を報告する",
                  "the variable reports its final value 1",
                ),
              },
            ],
          },
        ],
        simplified: t(
          `${simplifiedNames(language)}式の書き方も実物の CSPM（FDR の記法）とは違う。`,
          `${simplifiedNames(language)} The notation also differs from real CSPM (the notation used by FDR).`,
        ),
      },
      moveStep(
        language,
        "read-a",
        t("同期で読む", "Read by synchronising"),
        [0],
        t(
          `${at(0).move.ev}: 外側は${at(0).move.rule}、左右の前提をそれぞれ持つ`,
          `${at(0).move.ev}: outer rule ${at(0).move.rule}, with a premise for each side`,
        ),
        t(
          `read.A.0 は変数と足し手の同期集合にあるので、両側がそろって動く${at(0).move.rule}の規則になる。左（Var）は PName で定義を開き、何段も重ねた □ の左端を選ぶ。右（足し手）は逐次合成 Seq の前半で、インタリーブの左側のAが動く。`,
          `read.A.0 is in the synchronisation set of the variable and adders, so the rule is ${at(0).move.rule}, where both sides move together. On the left (Var), PName opens the definition and picks the leftmost branch of the nested □. On the right (adders), within the first part of the sequential composition Seq, A on the left of the interleaving moves.`,
        ),
      ),
      moveStep(
        language,
        "read-write",
        t("Bも読み、Aが書く", "B reads too, A writes"),
        [1, 2],
        t(
          `${at(1).move.ev}・${at(2).move.ev}: どちらも${at(1).move.rule}`,
          `${at(1).move.ev}, ${at(2).move.ev}: both ${at(1).move.rule}`,
        ),
        t(
          `Bも同じ値0を読み、続いてAが1を書く。どちらも同期のイベントなので外側は${at(2).move.rule}のまま。変数の側は、選んだ選択肢の位置によって ExtCh1 と ExtCh2 の重なり方が変わる。`,
          `B also reads the same value 0, then A writes 1. Both are synchronised events, so the outer rule stays ${at(2).move.rule}. On the variable's side, how ExtCh1 and ExtCh2 nest depends on the position of the chosen branch.`,
        ),
      ),
      moveStep(
        language,
        "a-done",
        t("Aの終わりは τ", "A's ending is τ"),
        [3],
        t(
          `τ: 外側は${at(3).move.rule}、出どころは${tauOrigin(at(3).derivation)}`,
          `τ: outer rule ${at(3).move.rule}, from ${tauOrigin(at(3).derivation)}`,
        ),
        t(
          `Aは書き終えて SKIP になり、終わりの合図 ✓ を出す。けれど全体はまだ終わっていないので、インタリーブがこの ✓ を${tauOrigin(at(3).derivation)}で τ（見えない手）に変える。外から見えるイベントは何も起きていない。`,
          `A has finished writing, becomes SKIP and performs the termination signal ✓. But the whole is not done yet, so the interleaving turns this ✓ into τ (an invisible move) with ${tauOrigin(at(3).derivation)}. No visible event happens.`,
        ),
      ),
      moveStep(
        language,
        "b-write",
        t("Bが書いて終わる", "B writes and finishes"),
        [4, 5],
        t(
          `${at(4).move.ev}の後、τ（出どころは${tauOrigin(at(5).derivation)}）`,
          `${at(4).move.ev}, then τ (from ${tauOrigin(at(5).derivation)})`,
        ),
        t(
          `Bも読んだ0に1を足して${at(4).move.ev}を書く。Aの1を上書きしたので、ここで更新が1つ消えている。Bの ✓ も${tauOrigin(at(5).derivation)}で τ になる。`,
          `B adds 1 to the 0 it read and writes 1 with ${at(4).move.ev}. It overwrote A's 1, so one update is lost here. B's ✓ also becomes τ with ${tauOrigin(at(5).derivation)}.`,
        ),
      ),
      moveStep(
        language,
        "seq-tick",
        t("全員終わり finish へ", "All done, on to finish"),
        [6],
        t(
          `τ: 出どころは${tauOrigin(at(6).derivation)}（前提は${seqPremise}）`,
          `τ: from ${tauOrigin(at(6).derivation)} (premise ${seqPremise})`,
        ),
        t(
          `AとBの両方が終わったので、インタリーブ全体が${seqPremise}で ✓ を出す。その ✓ を逐次合成が${tauOrigin(at(6).derivation)}で τ に変え、後半の finish → SKIP へ進む。見えない手が${TAU_INDICES.length}回あったのは、終わりの合図を受け渡すためだった。`,
          `Both A and B are done, so the whole interleaving performs ✓ with ${seqPremise}. The sequential composition turns that ✓ into τ with ${tauOrigin(at(6).derivation)} and moves on to the second part, finish → SKIP. The ${TAU_INDICES.length} invisible moves were there to hand on the termination signals.`,
        ),
      ),
      moveStep(
        language,
        "result",
        t(`${TARGET_EVENT}に着く`, `Reach ${TARGET_EVENT}`),
        [7, 8],
        t(
          `${at(7).move.ev}（${at(7).move.rule}）の後、${at(8).move.ev}（${at(8).move.rule}）`,
          `${at(7).move.ev} (${at(7).move.rule}), then ${at(8).move.ev} (${at(8).move.rule})`,
        ),
        t(
          `finish は両側の同期で起き、変数は最後の値を${at(8).move.ev}で報告する。足し手の側はもう終わりを待つだけなので、変数だけが動く${at(8).move.rule}になる。2回足したのに結果が1になる、更新が消える手順が規則の並びとして見えた。`,
          `finish happens by synchronising both sides, and the variable reports its final value with ${at(8).move.ev}. The adders' side is only waiting to end, so only the variable moves, with ${at(8).move.rule}. The lost-update path, where adding twice gives 1, is now visible as a sequence of rules.`,
        ),
        "found",
      ),
      {
        id: "printer",
        kind: "explore",
        title: t("内部選択の τ", "τ from internal choice"),
        actor: "printer",
        to: ["rules"],
        summary: t(
          `プリンタの最初の2本の τ は、外側が${PRINTER_FIRST.map((step) => step.move.rule).join("・")}、内側が${printerOrigins.join("・")}`,
          `The printer's first two τ moves: outer ${PRINTER_FIRST.map((step) => step.move.rule).join(", ")}, inner ${printerOrigins.join(", ")}`,
        ),
        explain: t(
          `「拒否で見分ける」のプリンタの実装は、名前 Impl を開くと内部選択 ⊓ になっている。最初の2本の τ は、moves の rule では名前を開く${PRINTER_FIRST[0]?.move.rule}と出るが、内側まで見ると${printerOrigins.join(" と ")}で左右を勝手に選んだ手だと分かる。`,
          `The printer implementation from "Telling processes apart by refusals" is an internal choice ⊓ once the name Impl is opened. The rule from moves shows its first two τ moves as ${PRINTER_FIRST[0]?.move.rule} (opening the name), but looking inside shows they are ${printerOrigins.join(" and ")}, picking left or right on its own.`,
        ),
        set: {
          printer: {
            isHidden: false,
            tone: "wait",
            rows: { [t("最初の手", "first moves")]: t("τ が2本", "two τ") },
          },
          rules: {
            tone: "ok",
            rows: {
              [t("手", "move")]: TAU,
              [t("外側", "outer")]: PRINTER_FIRST[0]?.move.rule ?? t("なし", "none"),
              [t("τ の出どころ", "τ from")]: t(
                printerOrigins.join("・"),
                printerOrigins.join(", "),
              ),
            },
          },
        },
        detail: [
          {
            title: t("最初の2本の導出", "Derivations of the first two"),
            fields: PRINTER_FIRST.map((step, index) => ({
              label: t(`${index + 1}本目`, `Move ${index + 1}`),
              value: derivationText(step.derivation),
              isCode: true,
            })),
          },
        ],
        simplified: t(
          "このサイトの moves は、いちばん外側の規則だけを rule に入れる。名前の展開（PName）の内側の規則は、部分プロセスに moves を当て直して求めた。",
          "This site's moves puts only the outermost rule in rule. The rules inside a name expansion (PName) were found by applying moves again to the subprocesses.",
        ),
      },
    ],
    lab: {
      title: t("イベントの並びから規則を出す", "Get the rules for an event sequence"),
      hint: t(
        "カウンタのイベント名をカンマ区切りで入れる（例: read.A.0, write.A.1）。必要な τ は自動で挟む。動けないイベントが来たらそこで止まる。",
        "Enter counter event names separated by commas (e.g. read.A.0, write.A.1). Any τ moves needed are inserted automatically. It stops at an event that cannot happen.",
      ),
      inputs: [
        {
          id: "events",
          label: t("イベントの並び", "Event sequence"),
          initial: VISIBLE_PATH.join(", "),
        },
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
              value: t(
                "この時点では起こせないので止まった",
                "cannot happen at this point, so it stopped",
              ),
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
          label: t("結果", "Result"),
          value: t(
            `${events.length}個のイベントをすべて起こせた`,
            `all ${events.length} events happened`,
          ),
          tone: "ok",
        });
        return fields;
      },
    },
  };
}
