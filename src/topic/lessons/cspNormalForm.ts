import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { explore, failuresRefines, normalizedStateCount, TAU } from "../csp";
import {
  checkWithNormalForm,
  type NormalCheck,
  NORMAL_ENV,
  NORMAL_IMPLS,
  NORMAL_SPEC,
  normalForm,
  preNormalForm,
} from "../cspNormalForm";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

const RAW = explore(NORMAL_SPEC, NORMAL_ENV);
const RAW_TAU = RAW.edges.filter((edge) => edge.ev === TAU).length;
const PRE = preNormalForm(NORMAL_SPEC, NORMAL_ENV);
const NORMAL = normalForm(NORMAL_SPEC, NORMAL_ENV);
const IMPL_COUNT = NORMAL_IMPLS.length;
const CSP_COUNT = normalizedStateCount(NORMAL_SPEC, NORMAL_ENV);
const AFTER_REQ = PRE.edges.find((edge) => edge.from === 0 && edge.ev === "req")!.to;
const MIDDLE = PRE.nodes[AFTER_REQ]!;

const implProc = (id: (typeof NORMAL_IMPLS)[number]["id"]) =>
  NORMAL_IMPLS.find((impl) => impl.id === id)!.proc;
const GOOD = checkWithNormalForm(NORMAL, implProc("good"), NORMAL_ENV, "failures");
const EAGER = checkWithNormalForm(NORMAL, implProc("eager"), NORMAL_ENV, "traces");
const EAGER_FAILURES = checkWithNormalForm(
  NORMAL,
  implProc("eager"),
  NORMAL_ENV,
  "failures",
);
const NOCANCEL_TRACES = checkWithNormalForm(
  NORMAL,
  implProc("nocancel"),
  NORMAL_ENV,
  "traces",
);
const NOCANCEL = checkWithNormalForm(
  NORMAL,
  implProc("nocancel"),
  NORMAL_ENV,
  "failures",
);
// csp.ts の詳細化（中で仕様の状態の集まりを持ち回る）と、同じ合否になるか。
const CSP_AGREES = NORMAL_IMPLS.every(
  ({ proc }) =>
    failuresRefines(NORMAL_SPEC, proc, NORMAL_ENV).holds ===
    checkWithNormalForm(NORMAL, proc, NORMAL_ENV, "failures").holds,
);

/** 状態の鍵から、続きの名前（→SERVER など）を省いて短くする。 */
function shortState(key: string): string {
  return key.replace(/→[A-Z_]+/g, "");
}

const setText = (events: string[]) => `{${events.join(", ")}}`;
const acceptText = (sets: string[][]) => sets.map(setText).join(" / ");

function listText(events: string[], language: Language): string {
  if (events.length === 0) return language === "ja" ? "⟨⟩（空）" : "⟨⟩ (empty)";
  return `⟨${events.join(", ")}⟩`;
}

function parseIndex(text: string | undefined, fallback: number, max: number): number {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, 1), max);
}

export function cspNormalFormLesson(language: Language): Lesson {
  const t = translator(language);
  const holdsText = (holds: boolean) =>
    holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
  const counterText = (check: NormalCheck): string => {
    const found = check.counterexample;
    if (!found) return t("なし", "none");
    if (found.kind === "trace")
      return t(
        `${listText(found.trace, language)} は仕様に無い`,
        `${listText(found.trace, language)} is not in the spec`,
      );
    return t(
      `${listText(found.trace, language)} の後に ${setText(found.refusal)} を断る`,
      `refuses ${setText(found.refusal)} after ${listText(found.trace, language)}`,
    );
  };
  const nodesRow = t("節点", "nodes");
  const edgesRow = t("辺", "edges");
  return {
    id: "csp-normal-form",
    category: "csp",
    title: t("仕様を正規化して比べる", "Normalising the spec to compare"),
    subtitle: t(
      "同じトレースの後の状態を1つにまとめ、実装と組でたどる",
      "Merge the states after each trace, then walk the implementation alongside",
    ),
    summary: t(
      `内部選択のある仕様（${RAW.stateCount}状態、τ が${RAW_TAU}本）を、同じトレースの後にいうる状態ごとにまとめると、τ の無い${PRE.nodes.length}節点の決定的なグラフになり、同じ振る舞いの節点をまとめて${NORMAL.nodes.length}節点になる。節点には受け付け集合を残し、実装の状態との組をたどって詳細化を調べる。`,
      `A spec with internal choice (${RAW.stateCount} states, ${RAW_TAU} τ moves) becomes a deterministic graph of ${PRE.nodes.length} nodes with no τ once the states it can be in after each trace are merged, and ${NORMAL.nodes.length} nodes once nodes with the same behaviour are merged too. Each node keeps its acceptance sets, and refinement is checked by walking pairs of implementation state and node.`,
    ),
    intro: [
      t(
        "FDR などの検査器は、仕様と実装を比べる前に、仕様だけを正規形に作り直す。正規形は、同じトレースの後に仕様がいうる状態を1つの節点にまとめ、見えない動き τ を消したグラフで、どのトレースの後でも行き先がただ1つに決まる。",
        "Checkers such as FDR rebuild only the spec into a normal form before comparing it with the implementation. In the normal form, the states the spec can be in after the same trace are merged into one node and invisible τ moves are gone, so every trace leads to exactly one place.",
      ),
      t(
        "非決定的な仕様では、同じ入力の後に仕様がどちらの状態にいるかが外から分からない。テストで1回ずつ比べると、仕様のどちらかの枝とだけ照らし合わせてしまい、合否が揺れる。正規形にしておけば、実装の1つの状態と比べる相手が1つの節点に決まり、全部の組を1回ずつたどれば済む。",
        "With a nondeterministic spec, you cannot tell from outside which state it is in after a given input. Comparing one run at a time, as a test does, matches the implementation against only one branch of the spec, and the verdict wobbles. Once the spec is normalised, each implementation state has exactly one node to be compared with, and walking every pair once is enough.",
      ),
      t(
        "図では、上の段で仕様の生の状態遷移が正規形の節点にまとまっていく様子を追う。節点のカードの「受け付け」は、まとめた後も残す拒否の情報である。後半は下の段で、実装の状態と節点の組をたどり、どこで外れるかを見る。",
        `In the diagram, follow the spec's raw transitions being merged into normal-form nodes in the top row. "Accepts" on the node card is the refusal information kept after merging. In the second half, the bottom row walks pairs of implementation state and node and shows where they part.`,
      ),
    ],
    facts: [
      {
        label: t("仕様の生の状態遷移", "Raw spec"),
        value: t(
          `${RAW.stateCount}状態・${RAW.transitionCount}本（τ が${RAW_TAU}本）`,
          `${RAW.stateCount} states, ${RAW.transitionCount} transitions (${RAW_TAU} τ)`,
        ),
      },
      {
        label: t("正規形", "Normal form"),
        value: t(
          `前正規形は${PRE.nodes.length}節点・${PRE.edges.length}本、まとめると${NORMAL.nodes.length}節点・${NORMAL.edges.length}本`,
          `pre-normal form ${PRE.nodes.length} nodes, ${PRE.edges.length} edges → merged ${NORMAL.nodes.length} nodes, ${NORMAL.edges.length} edges`,
        ),
      },
      {
        label: t(`実装${IMPL_COUNT}つの結果`, `The ${IMPL_COUNT} implementations`),
        value: t(
          `good ${holdsText(GOOD.holds)}、eager ${holdsText(EAGER_FAILURES.holds)}、nocancel ${holdsText(NOCANCEL.holds)}（⊑F）`,
          `good ${holdsText(GOOD.holds)}, eager ${holdsText(EAGER_FAILURES.holds)}, nocancel ${holdsText(NOCANCEL.holds)} (⊑F)`,
        ),
      },
      {
        label: t("参考", "Reference"),
        value: t(
          `${TPC_BOOK} 11.4節（正規化）・付録C.1（FDR の動作: 正規化と詳細化の検査）`,
          `${TPC_BOOK_EN}, §11.4 (normalising), Appendix C.1 (how FDR works: normalisation and refinement checking)`,
        ),
      },
    ],
    actors: [
      {
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: "SERVER",
        icon: "spec",
        x: 20,
        y: 27,
      },
      {
        id: "raw",
        label: t("生の状態遷移", "Raw transitions"),
        sublabel: t("τ を含む", "with τ"),
        icon: "state",
        x: 50,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "normal",
        label: t("正規形", "Normal form"),
        sublabel: t("トレースごとに1節点", "one node per trace"),
        icon: "visited",
        x: 80,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "impl",
        label: t("実装", "Implementation"),
        sublabel: t("仕様と比べる相手", "compared with the spec"),
        icon: "process",
        x: 30,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("組でたどる", "walks pairs"),
        icon: "checker",
        x: 70,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "spec", to: "raw" },
      { from: "raw", to: "normal" },
      { from: "impl", to: "checker" },
      { from: "normal", to: "checker" },
    ],
    steps: [
      {
        id: "spec",
        kind: "spec",
        title: t("非決定的な仕様", "A nondeterministic spec"),
        actor: "spec",
        summary: t(
          "req を受けると、窓口が勝手に ok か busy を決める。客はいつでも cancel で取り下げられる",
          "On req, the desk itself decides between ok and busy. The customer can always withdraw with cancel",
        ),
        explain: t(
          "SERVER = req → ((ok → SERVER ⊓ busy → RETRY) □ cancel → SERVER)。ok と busy は内部選択 ⊓ で、どちらになるかを外から選べない。RETRY は SERVER と同じ中身を別の名前で書いたもので、busy の後に戻る所である。",
          "SERVER = req → ((ok → SERVER ⊓ busy → RETRY) □ cancel → SERVER). ok and busy are an internal choice ⊓, so nobody outside can pick which happens. RETRY has the same body as SERVER under a different name, and is where busy leads back to.",
        ),
        set: {
          spec: {
            rows: {
              [t("内部選択", "internal choice")]: "ok ⊓ busy",
              [t("外部選択", "external choice")]: "□ cancel",
            },
          },
        },
      },
      {
        id: "raw",
        kind: "explore",
        title: t("生の状態遷移", "The raw transitions"),
        actor: "raw",
        to: ["spec"],
        summary: t(
          `仕様をそのまま展開すると${RAW.stateCount}状態・${RAW.transitionCount}本で、そのうち τ が${RAW_TAU}本ある`,
          `Unfolding the spec as written gives ${RAW.stateCount} states and ${RAW.transitionCount} transitions, ${RAW_TAU} of them τ`,
        ),
        explain: t(
          `req の後、内部選択を τ で決める前の状態と、決めた後の2つの状態がある。外から見たトレースが ⟨req⟩ でも、仕様は${MIDDLE.members.length}つの状態のどれにもいうる。実装と1対1で比べようとすると、どの状態と比べるかが決まらない。`,
          `After req there is the state before the internal choice is settled by τ, and two states after it. Even though the visible trace is just ⟨req⟩, the spec could be in any of ${MIDDLE.members.length} states. Comparing one-to-one with the implementation, you cannot tell which state to compare with.`,
        ),
        set: {
          raw: {
            isHidden: false,
            rows: {
              [t("状態", "states")]: String(RAW.stateCount),
              [edgesRow]: String(RAW.transitionCount),
              τ: String(RAW_TAU),
            },
          },
        },
      },
      {
        id: "merge-trace",
        kind: "explore",
        title: t("トレースでまとめる", "Merge by trace"),
        actor: "raw",
        to: ["normal"],
        summary: t(
          `同じトレースの後にいうる状態を1つの節点にまとめると、τ の無い${PRE.nodes.length}節点・${PRE.edges.length}本のグラフ（前正規形）になる`,
          `Merging the states possible after the same trace into one node gives a graph of ${PRE.nodes.length} nodes and ${PRE.edges.length} edges with no τ (the pre-normal form)`,
        ),
        explain: t(
          `初めの状態から τ で行ける所を全部集めて1つ目の節点にし、見えるイベントごとに「その後 τ で行ける所全部」を次の節点にする。⟨req⟩ の後の節点は ${MIDDLE.members.map(shortState).join("・")} の${MIDDLE.members.length}状態をまとめたもの。τ は節点の中に吸い込まれ、どの節点からもイベントごとに行き先は1つになる。`,
          `Collect everything reachable from the start by τ into the first node, then for each visible event make the next node from everything reachable after it by τ. The node after ⟨req⟩ merges ${MIDDLE.members.length} states: ${MIDDLE.members.map(shortState).join(", ")}. τ is absorbed inside the nodes, and from every node each event has exactly one destination.`,
        ),
        set: {
          raw: { tone: "idle" },
          normal: {
            isHidden: false,
            tone: "wait",
            rows: {
              [nodesRow]: String(PRE.nodes.length),
              [edgesRow]: String(PRE.edges.length),
              [t("⟨req⟩ の後", "after ⟨req⟩")]: t(
                `${MIDDLE.members.length}状態`,
                `${MIDDLE.members.length} states`,
              ),
            },
          },
        },
        simplified: t(
          "節点は元の状態の集合なので、最悪では元の状態数の指数だけ増える。ここでは小さな例なので気にならない。",
          "Nodes are sets of original states, so in the worst case their number grows exponentially in the original state count. In this small example it does not matter.",
        ),
      },
      {
        id: "acceptances",
        kind: "spec",
        title: t("拒否の情報を残す", "Keep the refusals"),
        actor: "normal",
        summary: t(
          `⟨req⟩ の後の節点は ${acceptText(MIDDLE.acceptances)} のどちらかを必ず受け付ける`,
          `The node after ⟨req⟩ always accepts one of ${acceptText(MIDDLE.acceptances)}`,
        ),
        explain: t(
          "まとめると「ok と busy のどちらになるか分からない」ことがグラフから消える。そこで、節点の中で安定な（τ で動けない）状態が受け付けるイベントの集まりのうち、ほかを含まない最小のもの（最小の受け付け集合）を節点に残す。この節点は cancel は必ず受け付けるが、ok と busy は片方しか受け付けないかもしれない。",
          "Merging erases from the graph the fact that you cannot know whether ok or busy will come. So each node keeps, from the sets of events its stable states (ones with no τ to take) accept, the minimal ones that contain no other (the minimal acceptance sets). This node always accepts cancel, but may accept only one of ok and busy.",
        ),
        set: {
          normal: {
            rows: {
              [t("⟨req⟩ の後", "after ⟨req⟩")]: null,
              ...Object.fromEntries(
                MIDDLE.acceptances.map((set, i) => [
                  `${t("受け付け", "accepts")}${i + 1}`,
                  setText(set),
                ]),
              ),
            },
          },
        },
      },
      {
        id: "merge-same",
        kind: "explore",
        title: t("同じ節点をまとめる", "Merge identical nodes"),
        actor: "normal",
        summary: t(
          `受け付けと行き先が同じ節点（SERVER と RETRY）を1つにして、${NORMAL.nodes.length}節点・${NORMAL.edges.length}本の正規形になる`,
          `Nodes with the same acceptances and destinations (SERVER and RETRY) become one, giving a normal form of ${NORMAL.nodes.length} nodes and ${NORMAL.edges.length} edges`,
        ),
        explain: t(
          "SERVER と RETRY の節点は名前が違うだけで、受け付け集合も、イベントごとの行き先も同じである。FDR はここで、受け付けと発散の情報まで含めて同じ振る舞いの節点をまとめ（強双模倣で割る）、どの2つの節点も外から区別できる形にする。",
          "The SERVER and RETRY nodes differ only in name: same acceptance sets and the same destination for each event. Here FDR merges nodes that behave the same, taking acceptance and divergence information into account (factoring by strong bisimulation), so that any two nodes can be told apart from outside.",
        ),
        set: {
          normal: {
            tone: "ok",
            rows: {
              [nodesRow]: String(NORMAL.nodes.length),
              [edgesRow]: String(NORMAL.edges.length),
              [t("⟨req⟩ の後", "after ⟨req⟩")]: null,
            },
          },
        },
      },
      {
        id: "walk",
        kind: "run",
        title: t("実装と組でたどる", "Walk the pairs"),
        actor: "checker",
        to: ["impl", "normal"],
        summary: t(
          `必ず ok を返す実装 good は、組を${GOOD.pairs.length}つたどって ⊑F が${holdsText(GOOD.holds)}`,
          `The implementation good, which always answers ok, gives ${GOOD.pairs.length} pairs, and ⊑F ${holdsText(GOOD.holds)}`,
        ),
        explain: t(
          `実装の状態と正規形の節点の組を、初めの組から幅優先でたどる。実装が見えるイベントを起こしたら節点も同じイベントの辺を進み、τ なら節点はそのままで、安定な実装の状態では、受け付けるイベントが節点の最小の受け付け集合のどれかを含むかを見る。good は ⟨req⟩ の後に {ok, cancel} を受け付けるので、{cancel, ok} を含み${GOOD.holds ? "通る" : "通らない"}。`,
          `Walk pairs of implementation state and normal-form node breadth-first from the initial pair. When the implementation does a visible event, the node follows the edge for the same event; on τ the node stays; in a stable implementation state, check that the events it accepts include one of the node's minimal acceptance sets. After ⟨req⟩, good accepts {ok, cancel}, which includes {cancel, ok}, so it ${GOOD.holds ? "passes" : "does not pass"}.`,
        ),
        set: {
          impl: {
            isHidden: false,
            rows: {
              [t("名前", "name")]: "good",
              [t("req の後", "after req")]: "ok □ cancel",
            },
          },
          checker: {
            isHidden: false,
            tone: GOOD.holds ? "ok" : "bad",
            rows: {
              [t("組", "pairs")]: String(GOOD.pairs.length),
              [t("結果", "result")]: `⊑F ${holdsText(GOOD.holds)}`,
            },
          },
        },
      },
      {
        id: "eager",
        kind: "found",
        title: t("辺が無い所へ進む", "A step with no edge"),
        actor: "checker",
        to: ["impl", "normal"],
        summary: t(
          `依頼の前に ok を返す実装 eager は、${listText(EAGER.counterexample?.trace ?? [], language)} で仕様のトレースから外れる`,
          `The implementation eager answers ok before any request, and ${listText(EAGER.counterexample?.trace ?? [], language)} leaves the spec's traces`,
        ),
        explain: t(
          "初めの節点からは req の辺しか出ていない。eager が最初に ok を起こすと、節点がたどる辺が無いので、その場でトレースの反例になる。正規形は決定的なので、辺が無いことを確かめるだけで済む。",
          "Only a req edge leaves the first node. When eager does ok first, the node has no edge to follow, so it is a trace counterexample on the spot. The normal form is deterministic, so checking that the edge is missing is enough.",
        ),
        set: {
          impl: {
            rows: {
              [t("名前", "name")]: "eager",
              [t("req の後", "after req")]: null,
              [t("最初", "first")]: "ok",
            },
          },
          checker: {
            tone: EAGER.holds ? "ok" : "bad",
            rows: {
              [t("組", "pairs")]: String(EAGER.pairs.length),
              [t("結果", "result")]: `⊑T ${holdsText(EAGER.holds)}`,
            },
          },
        },
      },
      {
        id: "nocancel",
        kind: "found",
        title: t("受け付けが足りない", "Accepting too little"),
        actor: "checker",
        to: ["impl", "normal"],
        summary: t(
          `取り下げに応じない nocancel は、トレースでは${holdsText(NOCANCEL_TRACES.holds)}が、${counterText(NOCANCEL)}`,
          `nocancel, which ignores withdrawals, ${holdsText(NOCANCEL_TRACES.holds)} on traces, but ${counterText(NOCANCEL)}`,
        ),
        explain: t(
          `nocancel は ⟨req⟩ の後に {ok} しか受け付けない。節点の最小の受け付け集合 ${acceptText(MIDDLE.acceptances)} はどれも cancel を含むので、どれも {ok} に収まらず失敗の反例になる。「cancel を必ず受け付ける」ことは辺には表れず、受け付け集合を残したので見つけられた。`,
          `After ⟨req⟩, nocancel accepts only {ok}. Every minimal acceptance set of the node, ${acceptText(MIDDLE.acceptances)}, contains cancel, so none fits inside {ok}, and it is a failures counterexample. The edges do not say that cancel must always be accepted; keeping the acceptance sets is what catches it.`,
        ),
        set: {
          impl: {
            rows: {
              [t("名前", "name")]: "nocancel",
              [t("最初", "first")]: null,
              [t("req の後", "after req")]: "ok",
            },
          },
          checker: {
            tone: NOCANCEL.holds ? "ok" : "bad",
            rows: {
              [t("組", "pairs")]: String(NOCANCEL.pairs.length),
              [t("結果", "result")]: `⊑F ${holdsText(NOCANCEL.holds)}`,
            },
          },
        },
      },
      {
        id: "same-inside",
        kind: "test",
        title: t("csp.ts も同じことをする", "csp.ts does the same"),
        actor: "checker",
        to: ["normal"],
        summary: t(
          `このサイトの詳細化の検査と、正規形でたどった結果は${CSP_AGREES ? `${IMPL_COUNT}つとも同じ` : "食い違う"}。前正規形の節点数${PRE.nodes.length}は csp.ts の数え方（${CSP_COUNT}）と同じ`,
          `This site's refinement check and the normal-form walk ${CSP_AGREES ? `agree on all ${IMPL_COUNT}` : "disagree"}. The pre-normal form's ${PRE.nodes.length} nodes match csp.ts's count (${CSP_COUNT})`,
        ),
        explain: t(
          "このサイトの CSP の実装の詳細化（csp.ts）は、実装の状態と「仕様がいまいうる状態の集まり」の組をたどっている。この集まりが前正規形の節点そのもので、正規形を先に全部作る代わりに、たどりながらその場で作っている。正規化は重く、実装に使える大きさより1〜2桁小さいものにしか使えないので、FDR は仕様の側だけを正規化し、実装は状態を1つずつ組にしてたどる。",
          "The refinement check in this site's CSP implementation (csp.ts) walks pairs of implementation state and the set of states the spec could currently be in. That set is exactly a pre-normal-form node; instead of building the whole normal form first, it builds nodes on the fly while walking. Normalisation is heavy and only works on systems one or two orders of magnitude smaller than an implementation can be, so FDR normalises only the spec and walks the implementation one state at a time in pairs.",
        ),
        set: {
          checker: {
            tone: CSP_AGREES ? "ok" : "bad",
            rows: {
              [t("組", "pairs")]: null,
              [t("結果", "result")]: null,
              [t("csp.ts と一致", "matches csp.ts")]: CSP_AGREES
                ? t("はい", "yes")
                : t("いいえ", "no"),
            },
          },
        },
        simplified: t(
          `csp.ts は2段目（同じ振る舞いの節点をまとめる）をせず、仕様の状態の集まりのままたどる。まとめても合否は変わらず、組の数が減るだけである。ProB は正規形そのものを出さないので、照合は手で書き下した正規形と元の仕様が両向きに等しいことと、実装${IMPL_COUNT}つの合否で行った。`,
          `csp.ts skips the second stage (merging nodes that behave the same) and walks with the sets of spec states as they are. Merging does not change the verdict, only reduces the number of pairs. ProB does not output the normal form itself, so the cross-check uses a hand-written normal form being equal to the spec both ways, and the verdicts for the ${IMPL_COUNT} implementations.`,
        ),
      },
    ],
    lab: {
      title: t("実装と比べ方を変える", "Change the implementation and the model"),
      hint: t(
        "実装（1: good、2: eager、3: nocancel）と比べ方（1: トレース ⊑T、2: 失敗 ⊑F）を入れる。nocancel はトレースでは通り、失敗で落ちる。",
        "Enter an implementation (1: good, 2: eager, 3: nocancel) and a model (1: traces ⊑T, 2: failures ⊑F). nocancel passes on traces and fails on failures.",
      ),
      inputs: [
        { id: "impl", label: t("実装", "Implementation"), initial: "3" },
        { id: "model", label: t("比べ方", "Model"), initial: "2" },
      ],
      compute: (values): Field[] => {
        const impl = NORMAL_IMPLS[parseIndex(values.impl, 3, NORMAL_IMPLS.length) - 1]!;
        const model = parseIndex(values.model, 2, 2) === 1 ? "traces" : "failures";
        const check = checkWithNormalForm(NORMAL, impl.proc, NORMAL_ENV, model);
        return [
          { label: t("実装", "Implementation"), value: impl.id },
          {
            label: model === "traces" ? "⊑T" : "⊑F",
            value: holdsText(check.holds),
            tone: check.holds ? "ok" : "bad",
          },
          { label: t("たどった組", "Pairs walked"), value: String(check.pairs.length) },
          { label: t("反例", "Counterexample"), value: counterText(check) },
        ];
      },
    },
  };
}
