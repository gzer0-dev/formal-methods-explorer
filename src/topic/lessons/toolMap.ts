import type { Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
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

export const toolMapLesson: Lesson = {
  id: "tool-map",
  category: "basics",
  title: "道具の選び方",
  subtitle: "確かめたい題材から、向く道具を選ぶ",
  summary:
    "並行処理は TLA+、データと権限は Alloy、関数の正しさは検証付きの言語や定理証明、日々のテストは性質ベーステスト。題材ごとに向く道具と、このサイトのレッスンとの対応を並べる。",
  intro: [
    "形式手法（仕様を数学的に書き、機械で確かめる方法）の道具は、どれも同じことをするわけではない。動く順の組み合わせ、データどうしの関係、関数の入力と出力の約束など、道具ごとに得意な題材が違う。",
    "前のレッスンのようなバグを見て、いきなり全部を形式手法で書こうとすると続かない。テストの仕事では、壊れると困る所を見極め、その題材に向く道具を選ぶことから始める。",
    "図では、題材のカードから道具のカードへ向かう矢印を順に追う。最後に、日々のテストの道具から TLA+ へ向かう矢印が、学ぶ順の提案になっていることを見る。",
  ],
  facts: [
    { label: "題材", value: "4種類" },
    { label: "道具", value: "4種類" },
    { label: "始めるなら", value: "性質ベーステスト" },
    { label: "次に", value: "TLA+ で設計を確かめる" },
  ],
  actors: [
    {
      id: "concurrency",
      label: "並行処理・分散",
      sublabel: "状態遷移",
      icon: "process",
      x: 14,
      y: 27,
    },
    {
      id: "data",
      label: "データ構造・権限",
      sublabel: "ものどうしの関係",
      icon: "database",
      x: 38,
      y: 27,
    },
    {
      id: "function",
      label: "関数の正しさ",
      sublabel: "入力と出力の約束",
      icon: "contract",
      x: 62,
      y: 27,
    },
    {
      id: "daily",
      label: "日々のテスト",
      sublabel: "CI で毎回流す",
      icon: "test",
      x: 86,
      y: 27,
    },
    {
      id: "tla",
      label: "TLA+",
      sublabel: "モデル検査（TLC）",
      icon: "checker",
      x: 14,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "alloy",
      label: "Alloy",
      sublabel: "小さな範囲の全探索",
      icon: "visited",
      x: 38,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "proof",
      label: "検証付き言語・証明",
      sublabel: "Dafny・Lean・Rocq",
      icon: "spec",
      x: 62,
      y: 73,
      initial: { isHidden: true },
    },
    {
      id: "pbt",
      label: propertyTestLesson.title,
      sublabel: "fast-check・Hypothesis",
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
      title: "題材から考える",
      actor: "concurrency",
      to: ["data", "function", "daily"],
      summary: "道具より先に「何を確かめたいか」を決める",
      explain:
        "形式手法の道具は、それぞれ得意な題材が違う。順の組み合わせなのか、ものどうしの関係なのか、1つの関数の約束なのかで、向く道具が変わる。まず確かめたい題材を4つに分けて考える。",
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
      title: "並行処理は TLA+",
      actor: "concurrency",
      to: ["tla"],
      summary: "動く順の組み合わせを、モデル検査器 TLC が全部たどる",
      explain:
        "複数の処理が入り混じる並行処理や分散システム、状態遷移の設計は、TLA+ で状態と操作を書き、モデル検査器 TLC で到達できる状態を全部たどるのが向く。テストでは運に任される「動く順」を漏らさず調べられる。",
      set: {
        concurrency: { tone: "ok", rows: { 道具: "TLA+" } },
        tla: {
          isHidden: false,
          tone: "ok",
          rows: {
            例: "更新が消える・デッドロック",
            対応: `${lostUpdateLesson("ja").title} ほか`,
          },
        },
      },
      detail: [
        {
          title: "このサイトで対応するレッスン",
          fields: [
            {
              label: lostUpdateLesson("ja").title,
              value: "全部の順をたどって、更新が消える並びを見つける",
            },
            { label: bfsLesson.title, value: "幅優先で状態をたどる検査器のしくみ" },
            {
              label: counterexampleLesson.title,
              value: "違反した状態から来た道をたどる",
            },
            { label: stateMachineLesson.title, value: "注文を状態と操作で書く" },
            { label: invariantLesson.title, value: "いつでも成り立つべき性質" },
            { label: livenessLesson.title, value: "活性（いつか良いことが起きる）" },
          ],
        },
        {
          title: "もう1つの道具: CSP と FDR",
          fields: [
            {
              label: "考え方",
              value:
                "仕様も実装のモデルも同じ記法のプロセスで書き、実装の振る舞いが仕様で許した範囲に収まるか（詳細化）を調べる",
            },
            {
              label: "調べられること",
              value:
                "詳細化のほか、デッドロックが無いこと、ライブロック（外から見えない動きの無限ループ）が無いこと、決定的に動くこと",
            },
            { label: "参考文献", value: `${CSP_BOOK} 第3章・第6章・第7章` },
            {
              label: cspRefinementLesson.title,
              value: "仕様もプロセスで書き、詳細化を調べる",
            },
            {
              label: cspFailuresLesson.title,
              value: "トレースでは見分けられない違いを拒否で見分ける",
            },
            {
              label: cspDeadlockLesson.title,
              value: "デッドロックをプロセスの組み合わせで見つける",
            },
          ],
        },
      ],
      simplified:
        "このサイトの検査器は TypeScript で作った小さなもの。同じモデルを TLA+ で書いた仕様をリポジトリの specs/tla に置き、TLC にかけて状態の数と反例がこのサイトと一致することを確かめてある。",
    },
    {
      id: "alloy",
      kind: "explore",
      title: "データと権限は Alloy",
      actor: "data",
      to: ["alloy"],
      summary: "小さな範囲の組み合わせを全部作って、関係の矛盾を探す",
      explain:
        "データ構造の形、権限のルール、ものどうしの関係は、Alloy で関係を書き、要素の数を小さく区切って全部の組み合わせを調べるのが向く。小さな範囲で反例が無ければ、多くの設計の誤りはそこで捕まる、という考え方に立っている。",
      set: {
        data: { tone: "ok", rows: { 道具: "Alloy" } },
        alloy: {
          isHidden: false,
          tone: "ok",
          rows: { 例: "上司の関係", 対応: smallScopeLesson.title },
        },
      },
      detail: [
        {
          title: "このサイトで対応するレッスン",
          fields: [
            { label: smallScopeLesson.title, value: "3人の上司の関係を全部作る" },
          ],
        },
      ],
      simplified:
        "このサイトでは組み合わせを TypeScript で全部並べて数えている。Alloy は関係を論理式で書き、内部で充足可能性の解き手（SAT ソルバ）を使って反例を探す。",
    },
    {
      id: "proof",
      kind: "explore",
      title: "関数は検証付き言語",
      actor: "function",
      to: ["proof"],
      summary: "事前条件と事後条件を書き、すべての入力で成り立つと示す",
      explain:
        "1つの関数が約束を守るか（事前条件を満たせば事後条件が成り立つか）は、Dafny のような検証付きの言語や、Lean・Rocq のような定理証明の道具が向く。範囲を区切らず、すべての入力について成り立つことを示せるが、書く手間は大きい。",
      set: {
        function: { tone: "ok", rows: { 道具: "検証付き言語" } },
        proof: {
          isHidden: false,
          tone: "ok",
          rows: { 例: "引き出しの条件", 対応: preconditionsLesson.title },
        },
      },
      detail: [
        {
          title: "このサイトで対応するレッスン",
          fields: [
            { label: preconditionsLesson.title, value: "引き出しの関数に契約を書く" },
          ],
        },
      ],
      simplified:
        "このサイトでは小さな範囲の入力を全部試して条件を確かめている。検証付きの言語や定理証明は、試すのではなく論理で「すべての入力で成り立つ」ことを示す点が違う。",
    },
    {
      id: "pbt",
      kind: "test",
      title: "日々は性質ベース",
      actor: "daily",
      to: ["pbt"],
      summary: "性質を書いて入力を作らせ、ふだんのテストに混ぜる",
      explain:
        "毎回 CI で流すテストには、性質ベーステスト（fast-check・Hypothesis など）が向く。今あるテストの道具の上で書け、見つけた反例を縮めて読みやすくしてくれる。モデル検査で見つけた反例も、順を固定したテストにして残せる。",
      set: {
        daily: { tone: "ok", rows: { 道具: "性質ベーステスト" } },
        pbt: {
          isHidden: false,
          tone: "ok",
          rows: { 例: "重複を取り除く関数", 対応: `${propertyTestLesson.title} ほか` },
        },
      },
      detail: [
        {
          title: "このサイトで対応するレッスン",
          fields: [
            { label: propertyTestLesson.title, value: "性質を書き、反例を縮める" },
            { label: traceToTestLesson.title, value: "動く順を固定して再現する" },
            {
              label: transitionCoverLesson.title,
              value: "モデルからテストの手順を作る",
            },
          ],
        },
      ],
    },
    {
      id: "order",
      kind: "run",
      title: "学ぶ順の提案",
      actor: "pbt",
      to: ["tla"],
      summary: "軽い性質ベーステストから始め、状態が絡む所だけ TLA+ へ",
      explain:
        "まずは今のテストに性質ベーステストを足し、性質で考えることに慣れる。そのうえで、並行処理や状態遷移のように順の組み合わせが絡む所だけ、TLA+ で設計を確かめる。全部を形式手法で書こうとせず、壊れると困る所から使うのが続けやすい。",
      set: {
        pbt: { rows: { 順: "1. ここから" } },
        tla: { rows: { 順: "2. 状態が絡む所だけ" } },
      },
    },
  ],
};
