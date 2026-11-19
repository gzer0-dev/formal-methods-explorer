import { translator, type Language } from "../../core/i18n";
import type { Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
import { cspDeadlockLesson } from "./cspDeadlock";
import { cspFailuresLesson } from "./cspFailures";
import { cspRefinementLesson } from "./cspRefinement";
import { bfsLesson } from "./bfs";
import { counterexampleLesson } from "./counterexample";
import { invariantLesson } from "./invariant";
import { livenessLesson } from "./liveness";
import { lostUpdateLesson } from "./lostUpdate";
import { preconditionsLesson } from "./preconditions";
import { propertyTestLesson } from "./propertyTest";
import { smallScopeLesson } from "./smallScope";
import { stateMachineLesson } from "./stateMachine";
import { traceToTestLesson } from "./traceToTest";
import { transitionCoverLesson } from "./transitionCover";

// 計算を使わない地図のレッスン。道具の細かい記法は版によって変わるので書かず、
// 「どの題材にどの種類の道具が向くか」と「このサイトのどのレッスンに対応するか」だけを示す。

export function toolMapLesson(language: Language): Lesson {
  const t = translator(language);
  const titles = {
    lostUpdate: lostUpdateLesson(language).title,
    bfs: bfsLesson(language).title,
    counterexample: counterexampleLesson(language).title,
    stateMachine: stateMachineLesson(language).title,
    invariant: invariantLesson(language).title,
    liveness: livenessLesson(language).title,
    smallScope: smallScopeLesson(language).title,
    preconditions: preconditionsLesson(language).title,
    propertyTest: propertyTestLesson(language).title,
    traceToTest: traceToTestLesson(language).title,
    transitionCover: transitionCoverLesson(language).title,
    cspRefinement: cspRefinementLesson(language).title,
    cspFailures: cspFailuresLesson(language).title,
    cspDeadlock: cspDeadlockLesson(language).title,
  };
  const example = t("例", "example");
  const lesson = t("対応", "lesson");
  const tool = t("道具", "tool");
  const lessonsHere = t("このサイトで対応するレッスン", "Lessons on this site");
  return {
    id: "tool-map",
    category: "basics",
    title: t("道具の選び方", "Choosing a tool"),
    subtitle: t(
      "確かめたい題材から、向く道具を選ぶ",
      "Pick the tool that fits what you want to check",
    ),
    summary: t(
      "並行処理は TLA+、データと権限は Alloy、関数の正しさは検証付きの言語や定理証明、日々のテストは性質ベーステスト。題材ごとに向く道具と、このサイトのレッスンとの対応を並べる。",
      "Concurrency goes to TLA+, data and permissions to Alloy, function correctness to verified languages or theorem provers, and everyday testing to property-based testing. This lists the tool that fits each kind of problem and the lessons on this site that cover it.",
    ),
    intro: [
      t(
        "形式手法（仕様を数学的に書き、機械で確かめる方法）の道具は、どれも同じことをするわけではない。動く順の組み合わせ、データどうしの関係、関数の入力と出力の約束など、道具ごとに得意な題材が違う。",
        "Formal methods tools (ways to write a spec precisely and check it by machine) do not all do the same thing. Orderings of steps, relations between pieces of data, the promise between a function's input and output: each tool is good at different problems.",
      ),
      t(
        "前のレッスンのようなバグを見て、いきなり全部を形式手法で書こうとすると続かない。テストの仕事では、壊れると困る所を見極め、その題材に向く道具を選ぶことから始める。",
        "After seeing a bug like the one in the previous lesson, trying to write everything with formal methods at once does not last. In testing work, start by finding the parts that must not break and picking the tool that fits them.",
      ),
      t(
        "図では、題材のカードから道具のカードへ向かう矢印を順に追う。最後に、日々のテストの道具から TLA+ へ向かう矢印が、学ぶ順の提案になっていることを見る。",
        "In the diagram, follow the arrows from each problem card to its tool card. At the end, see how the arrow from the everyday testing tool to TLA+ suggests an order to learn them in.",
      ),
    ],
    facts: [
      { label: t("題材", "Problems"), value: t("4種類", "4 kinds") },
      { label: t("道具", "Tools"), value: t("4種類", "4 kinds") },
      {
        label: t("始めるなら", "Start with"),
        value: t("性質ベーステスト", "Property-based testing"),
      },
      {
        label: t("次に", "Then"),
        value: t("TLA+ で設計を確かめる", "Check designs with TLA+"),
      },
    ],
    actors: [
      {
        id: "concurrency",
        label: t("並行処理・分散", "Concurrency"),
        sublabel: t("状態遷移", "state transitions"),
        icon: "process",
        x: 14,
        y: 27,
      },
      {
        id: "data",
        label: t("データ構造・権限", "Data and permissions"),
        sublabel: t("ものどうしの関係", "relations between things"),
        icon: "database",
        x: 38,
        y: 27,
      },
      {
        id: "function",
        label: t("関数の正しさ", "Function correctness"),
        sublabel: t("入力と出力の約束", "input/output contract"),
        icon: "contract",
        x: 62,
        y: 27,
      },
      {
        id: "daily",
        label: t("日々のテスト", "Everyday tests"),
        sublabel: t("CI で毎回流す", "run on every CI build"),
        icon: "test",
        x: 86,
        y: 27,
      },
      {
        id: "tla",
        label: "TLA+",
        sublabel: t("モデル検査（TLC）", "model checking (TLC)"),
        icon: "checker",
        x: 14,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "alloy",
        label: "Alloy",
        sublabel: t("小さな範囲の全探索", "exhaustive in a small scope"),
        icon: "visited",
        x: 38,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "proof",
        label: t("検証付き言語・証明", "Verified languages"),
        sublabel: t("Dafny・Lean・Rocq", "Dafny, Lean, Rocq"),
        icon: "spec",
        x: 62,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "pbt",
        label: titles.propertyTest,
        sublabel: t("fast-check・Hypothesis", "fast-check, Hypothesis"),
        icon: "dice",
        x: 86,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "concurrency", to: "tla" },
      { from: "data", to: "alloy" },
      { from: "function", to: "proof" },
      { from: "daily", to: "pbt" },
      { from: "pbt", to: "tla" },
    ],
    steps: [
      {
        id: "start-from-topic",
        kind: "spec",
        title: t("題材から考える", "Start from the problem"),
        actor: "concurrency",
        to: ["data", "function", "daily"],
        summary: t(
          "道具より先に「何を確かめたいか」を決める",
          "Decide what you want to check before picking a tool",
        ),
        explain: t(
          "形式手法の道具は、それぞれ得意な題材が違う。順の組み合わせなのか、ものどうしの関係なのか、1つの関数の約束なのかで、向く道具が変わる。まず確かめたい題材を4つに分けて考える。",
          "Each formal methods tool is good at different problems. Whether it is about orderings, relations between things, or the contract of a single function changes which tool fits. First sort what you want to check into four kinds.",
        ),
        set: {
          concurrency: { tone: "wait" },
          data: { tone: "wait" },
          function: { tone: "wait" },
          daily: { tone: "wait" },
        },
      },
      {
        id: "tla",
        kind: "explore",
        title: t("並行処理は TLA+", "Concurrency: TLA+"),
        actor: "concurrency",
        to: ["tla"],
        summary: t(
          "動く順の組み合わせを、モデル検査器 TLC が全部たどる",
          "The TLC model checker walks every ordering of steps",
        ),
        explain: t(
          "複数の処理が入り混じる並行処理や分散システム、状態遷移の設計は、TLA+ で状態と操作を書き、モデル検査器 TLC で到達できる状態を全部たどるのが向く。テストでは運に任される「動く順」を漏らさず調べられる。",
          "For concurrency and distributed systems where steps interleave, and for state-transition designs, write the states and actions in TLA+ and let the TLC model checker walk every reachable state. It covers the orderings that tests leave to luck.",
        ),
        set: {
          concurrency: { tone: "ok", rows: { [tool]: "TLA+" } },
          tla: {
            isHidden: false,
            tone: "ok",
            rows: {
              [example]: t("更新が消える・デッドロック", "lost update, deadlock"),
              [lesson]: t(`${titles.lostUpdate} ほか`, `${titles.lostUpdate}, etc.`),
            },
          },
        },
        detail: [
          {
            title: lessonsHere,
            fields: [
              {
                label: titles.lostUpdate,
                value: t(
                  "全部の順をたどって、更新が消える並びを見つける",
                  "Walk every order and find the ones that lose an update",
                ),
              },
              {
                label: titles.bfs,
                value: t(
                  "幅優先で状態をたどる検査器のしくみ",
                  "How a breadth-first checker walks the states",
                ),
              },
              {
                label: titles.counterexample,
                value: t(
                  "違反した状態から来た道をたどる",
                  "Trace the path back from the violating state",
                ),
              },
              {
                label: titles.stateMachine,
                value: t(
                  "注文を状態と操作で書く",
                  "Describe an order as states and actions",
                ),
              },
              {
                label: titles.invariant,
                value: t(
                  "いつでも成り立つべき性質",
                  "Properties that must always hold",
                ),
              },
              {
                label: titles.liveness,
                value: t(
                  "活性（いつか良いことが起きる）",
                  "Liveness (something good eventually happens)",
                ),
              },
            ],
          },
          {
            title: t("もう1つの道具: CSP と FDR", "Another tool: CSP and FDR"),
            fields: [
              {
                label: t("考え方", "Idea"),
                value: t(
                  "仕様も実装のモデルも同じ記法のプロセスで書き、実装の振る舞いが仕様で許した範囲に収まるか（詳細化）を調べる",
                  "Write both the spec and the implementation model as processes in the same notation, and check that the implementation stays within what the spec allows (refinement)",
                ),
              },
              {
                label: t("調べられること", "What it checks"),
                value: t(
                  "詳細化のほか、デッドロックが無いこと、ライブロック（外から見えない動きの無限ループ）が無いこと、決定的に動くこと",
                  "Besides refinement: no deadlock, no livelock (an endless loop of moves invisible from outside), and deterministic behaviour",
                ),
              },
              {
                label: t("参考文献", "Reference"),
                value: t(
                  `${CSP_BOOK} 第3章・第6章・第7章`,
                  `${CSP_BOOK_EN}, chapters 3, 6 and 7`,
                ),
              },
              {
                label: titles.cspRefinement,
                value: t(
                  "仕様もプロセスで書き、詳細化を調べる",
                  "Write the spec as a process too and check refinement",
                ),
              },
              {
                label: titles.cspFailures,
                value: t(
                  "トレースでは見分けられない違いを拒否で見分ける",
                  "Use refusals to tell apart what traces cannot",
                ),
              },
              {
                label: titles.cspDeadlock,
                value: t(
                  "デッドロックをプロセスの組み合わせで見つける",
                  "Find deadlocks by composing processes",
                ),
              },
            ],
          },
        ],
        simplified: t(
          "このサイトの検査器は TypeScript で作った小さなもの。同じモデルを TLA+ で書いた仕様をリポジトリの specs/tla に置き、TLC にかけて状態の数と反例がこのサイトと一致することを確かめてある。",
          "The checker on this site is a small TypeScript program. The same models written in TLA+ are in specs/tla in the repository, and running TLC on them confirms that the state counts and counterexamples match this site.",
        ),
      },
      {
        id: "alloy",
        kind: "explore",
        title: t("データと権限は Alloy", "Data and permissions: Alloy"),
        actor: "data",
        to: ["alloy"],
        summary: t(
          "小さな範囲の組み合わせを全部作って、関係の矛盾を探す",
          "Build every combination in a small scope and look for contradictions",
        ),
        explain: t(
          "データ構造の形、権限のルール、ものどうしの関係は、Alloy で関係を書き、要素の数を小さく区切って全部の組み合わせを調べるのが向く。小さな範囲で反例が無ければ、多くの設計の誤りはそこで捕まる、という考え方に立っている。",
          "For the shape of data structures, permission rules and relations between things, write the relations in Alloy, cap the number of elements at a small size, and check every combination. It rests on the idea that most design mistakes already show up in a small scope.",
        ),
        set: {
          data: { tone: "ok", rows: { [tool]: "Alloy" } },
          alloy: {
            isHidden: false,
            tone: "ok",
            rows: {
              [example]: t("上司の関係", "boss relation"),
              [lesson]: titles.smallScope,
            },
          },
        },
        detail: [
          {
            title: lessonsHere,
            fields: [
              {
                label: titles.smallScope,
                value: t(
                  "3人の上司の関係を全部作る",
                  "Build every boss relation among three people",
                ),
              },
            ],
          },
        ],
        simplified: t(
          "このサイトでは組み合わせを TypeScript で全部並べて数えている。Alloy は関係を論理式で書き、内部で充足可能性の解き手（SAT ソルバ）を使って反例を探す。",
          "This site lists and counts every combination in TypeScript. Alloy writes the relations as logical formulas and searches for counterexamples with a satisfiability solver (SAT solver) inside.",
        ),
      },
      {
        id: "proof",
        kind: "explore",
        title: t("関数は検証付き言語", "Functions: verified languages"),
        actor: "function",
        to: ["proof"],
        summary: t(
          "事前条件と事後条件を書き、すべての入力で成り立つと示す",
          "Write pre- and postconditions and prove them for every input",
        ),
        explain: t(
          "1つの関数が約束を守るか（事前条件を満たせば事後条件が成り立つか）は、Dafny のような検証付きの言語や、Lean・Rocq のような定理証明の道具が向く。範囲を区切らず、すべての入力について成り立つことを示せるが、書く手間は大きい。",
          "Whether a function keeps its promise (if the precondition holds, the postcondition holds) fits verified languages like Dafny or theorem provers like Lean and Rocq. They can show it holds for every input with no bound, but take much more effort to write.",
        ),
        set: {
          function: {
            tone: "ok",
            rows: { [tool]: t("検証付き言語", "verified language") },
          },
          proof: {
            isHidden: false,
            tone: "ok",
            rows: {
              [example]: t("引き出しの条件", "withdraw rules"),
              [lesson]: titles.preconditions,
            },
          },
        },
        detail: [
          {
            title: lessonsHere,
            fields: [
              {
                label: titles.preconditions,
                value: t(
                  "引き出しの関数に契約を書く",
                  "Write a contract for a withdraw function",
                ),
              },
            ],
          },
        ],
        simplified: t(
          "このサイトでは小さな範囲の入力を全部試して条件を確かめている。検証付きの言語や定理証明は、試すのではなく論理で「すべての入力で成り立つ」ことを示す点が違う。",
          "This site checks the conditions by trying every input in a small range. Verified languages and theorem provers differ in that they show by logic, not by trying, that it holds for every input.",
        ),
      },
      {
        id: "pbt",
        kind: "test",
        title: t("日々は性質ベース", "Everyday: property-based"),
        actor: "daily",
        to: ["pbt"],
        summary: t(
          "性質を書いて入力を作らせ、ふだんのテストに混ぜる",
          "Write properties, let inputs be generated, and mix them into your tests",
        ),
        explain: t(
          "毎回 CI で流すテストには、性質ベーステスト（fast-check・Hypothesis など）が向く。今あるテストの道具の上で書け、見つけた反例を縮めて読みやすくしてくれる。モデル検査で見つけた反例も、順を固定したテストにして残せる。",
          "For tests that run on every CI build, property-based testing (fast-check, Hypothesis and others) fits. You write it on top of your existing test tools, and it shrinks the counterexamples it finds so they are easy to read. Counterexamples from model checking can also be kept as tests with a fixed order.",
        ),
        set: {
          daily: {
            tone: "ok",
            rows: { [tool]: t("性質ベーステスト", "property-based testing") },
          },
          pbt: {
            isHidden: false,
            tone: "ok",
            rows: {
              [example]: t("重複を取り除く関数", "dedupe function"),
              [lesson]: t(
                `${titles.propertyTest} ほか`,
                `${titles.propertyTest}, etc.`,
              ),
            },
          },
        },
        detail: [
          {
            title: lessonsHere,
            fields: [
              {
                label: titles.propertyTest,
                value: t(
                  "性質を書き、反例を縮める",
                  "Write a property and shrink the counterexample",
                ),
              },
              {
                label: titles.traceToTest,
                value: t("動く順を固定して再現する", "Reproduce it with a fixed order"),
              },
              {
                label: titles.transitionCover,
                value: t(
                  "モデルからテストの手順を作る",
                  "Generate test sequences from the model",
                ),
              },
            ],
          },
        ],
      },
      {
        id: "order",
        kind: "run",
        title: t("学ぶ順の提案", "A suggested learning order"),
        actor: "pbt",
        to: ["tla"],
        summary: t(
          "軽い性質ベーステストから始め、状態が絡む所だけ TLA+ へ",
          "Start with light property-based tests, and use TLA+ only where state matters",
        ),
        explain: t(
          "まずは今のテストに性質ベーステストを足し、性質で考えることに慣れる。そのうえで、並行処理や状態遷移のように順の組み合わせが絡む所だけ、TLA+ で設計を確かめる。全部を形式手法で書こうとせず、壊れると困る所から使うのが続けやすい。",
          "First add property-based tests to your current tests and get used to thinking in properties. Then check designs with TLA+ only where orderings matter, such as concurrency and state transitions. Rather than writing everything formally, starting from the parts that must not break is easier to keep up.",
        ),
        set: {
          pbt: { rows: { [t("順", "order")]: t("1. ここから", "1. start here") } },
          tla: {
            rows: {
              [t("順", "order")]: t(
                "2. 状態が絡む所だけ",
                "2. only where state matters",
              ),
            },
          },
        },
      },
    ],
  };
}
