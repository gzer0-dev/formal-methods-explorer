import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK } from "../references";
import { divergence, explore, type Lts, TAU, TICK } from "../csp";
import { jobSystem, JOB_ENV } from "../cspModels";

const BOUNDED_RETRIES = 2;
const MAX_RETRIES = 5;
const HIDDEN_EVENTS = ["start", "fail"];

const VISIBLE = explore(jobSystem(null, false), JOB_ENV);
const VISIBLE_DIVERGENCE = divergence(jobSystem(null, false), JOB_ENV);
const HIDDEN = explore(jobSystem(null, true), JOB_ENV);
const FOUND = divergence(jobSystem(null, true), JOB_ENV);
if (!FOUND) throw new Error("隠したリトライ無制限のジョブで発散が見つからない");
const DIVERGENCE = FOUND;
const BOUNDED = explore(jobSystem(BOUNDED_RETRIES, true), JOB_ENV);
const BOUNDED_DIVERGENCE = divergence(jobSystem(BOUNDED_RETRIES, true), JOB_ENV);

const HIDDEN_TAU_COUNT = HIDDEN.edges.filter((edge) => edge.ev === TAU).length;
// cycle は先頭と末尾に同じ状態が入るので、別々の状態の数は Set で数える
const CYCLE_STATES = new Set(DIVERGENCE.cycle).size;
/** 外から見えるイベント（τ と終わりの合図 ✓ を除く）。 */
function visibleEvents(lts: Lts): string[] {
  return [...new Set(lts.edges.map((edge) => edge.ev))].filter(
    (ev) => ev !== TAU && ev !== TICK,
  );
}
const HIDDEN_VISIBLE_EVENTS = visibleEvents(HIDDEN);

function traceText(trace: string[]): string {
  return trace.length > 0 ? trace.join(" → ") : "なし（最初から）";
}

function parseRetries(text: string | undefined): number | null {
  const trimmed = (text ?? "").trim();
  if (trimmed === "" || trimmed === "なし") return null;
  const n = Number.parseInt(trimmed, 10);
  // 読めない入力は既定の「無制限」に戻す
  if (Number.isNaN(n)) return null;
  return Math.min(MAX_RETRIES, Math.max(0, n));
}

function parseHidden(text: string | undefined): boolean {
  // 「いいえ」と書いたときだけ見えるままにする。それ以外は既定の「はい」に戻す。
  return !(text ?? "").includes("いいえ");
}

export const cspLivelockLesson: Lesson = {
  id: "csp-livelock",
  category: "csp",
  title: "隠すと見える発散",
  subtitle: "外からは何も起きないまま、中で回り続ける",
  summary: `失敗したらやり直すジョブの start と fail を隠すと、見えない動き τ だけで回る輪（発散）ができる。リトライに上限を付けると${BOUNDED.stateCount}状態で発散は${BOUNDED_DIVERGENCE ? "残る" : "消える"}。`,
  intro: [
    "隠蔽は、指定したイベントを外から見えない動き τ（タウ）に変える操作だ。τ だけでいつまでも回り続けられることを発散（ライブロック）と呼ぶ。止まってはいないが、外からは何も進んでいないように見える。",
    "「いつか必ず終わるか」で見た、失敗し続けるリトライの輪を、呼び出し側から見た形で捉え直す。テストではタイムアウトとして現れるだけで、止まっているのか中で回っているのかは見分けにくい。",
    "図では、まず start と fail が見えるままのジョブを見て、次に隠蔽のカードを通した後のジョブと比べる。検査器が τ だけの輪を見つける場面が分かれ目で、最後にリトライに上限を付けると輪が消えるかを確かめる。",
  ],
  facts: [
    {
      label: "隠した後の状態",
      value: `${HIDDEN.stateCount}個・${HIDDEN.transitionCount}遷移`,
    },
    { label: "τ だけの輪", value: `${CYCLE_STATES}状態で1周`, tone: "bad" },
    {
      label: `上限${BOUNDED_RETRIES}回`,
      value: `${BOUNDED.stateCount}状態で${BOUNDED_DIVERGENCE ? "発散あり" : "発散なし"}`,
      tone: "ok",
    },
    { label: "実物の道具", value: "FDR の livelock free の表明" },
    {
      label: "参考文献",
      value: `${CSP_BOOK} 6.4節（失敗発散方式）・7.1.2節（ライブロックフリー性）`,
    },
  ],
  actors: [
    {
      id: "caller",
      label: "呼び出し側",
      sublabel: "結果を待つ",
      icon: "person",
      x: 14,
      y: 50,
      initial: { rows: { 見える: "まだ何も" } },
    },
    {
      id: "hide",
      label: "隠蔽",
      sublabel: `\\ {${HIDDEN_EVENTS.join(", ")}}`,
      icon: "visited",
      x: 38,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "job",
      label: "Job",
      sublabel: "リトライするジョブ",
      icon: "job",
      x: 62,
      y: 50,
      initial: { rows: { リトライ: "無制限" } },
    },
    {
      id: "checker",
      label: "検査器",
      sublabel: "τ だけの輪を探す",
      icon: "checker",
      x: 86,
      y: 50,
      initial: { isHidden: true },
    },
  ],
  stageHeight: 300,
  links: [
    { from: "job", to: "hide" },
    { from: "hide", to: "caller" },
    { from: "checker", to: "job" },
  ],
  steps: [
    {
      id: "job",
      kind: "spec",
      title: "ジョブをプロセスで書く",
      actor: "job",
      summary: "start の後、succeed で終わるか、fail でやり直す",
      explain:
        "ジョブは start で動き出し、succeed（成功）なら終わり、fail（失敗）なら最初からやり直す。どちらになるかは外から選ばれる（外部選択 □）。リトライの回数に上限は無い。",
      set: { job: { rows: { 動き: "start の後に成否" } } },
      detail: [
        {
          title: "このサイトのモデル",
          fields: [
            {
              label: "Job",
              value: "start → (succeed → SKIP □ fail → Job)",
              isCode: true,
            },
          ],
        },
      ],
      simplified:
        "式はこのサイトのモデル（cspModels.ts）に合わせた短い書き方で、実物の CSPM（FDR の記法）とは書き方が違う。SKIP は正しく終わる（✓ を出す）プロセス。",
    },
    {
      id: "visible",
      kind: "run",
      title: "見えるままなら",
      actor: "job",
      to: ["caller"],
      summary: `${VISIBLE.stateCount}状態・${VISIBLE.transitionCount}遷移、発散${VISIBLE_DIVERGENCE ? "あり" : "なし"}`,
      explain: `start と fail が見えるままなら、やり直すたびに呼び出し側にもイベントが届く。何かが起きていると外から分かり、応じるのをやめれば止められるので、これは発散ではない。検査器でも${VISIBLE.stateCount}状態の中に発散は${VISIBLE_DIVERGENCE ? "ある" : "無い"}。`,
      set: {
        caller: { tone: "ok", rows: { 見える: visibleEvents(VISIBLE).join("・") } },
        job: { tone: "ok" },
      },
    },
    {
      id: "hide",
      kind: "spec",
      title: "start と fail を隠す",
      actor: "hide",
      to: ["caller"],
      summary: `\\ {${HIDDEN_EVENTS.join(", ")}} で、呼び出し側には成功だけが見える`,
      explain: `呼び出し側に「成功したか」だけを見せたいので、start と fail を隠す（隠蔽 \\）。隠したイベントは外から見えない動き τ（タウ）に変わり、外の同意なしに勝手に起きる。外から見えるのは ${HIDDEN_VISIBLE_EVENTS.join(" と ")} だけになる。`,
      set: {
        hide: { isHidden: false, tone: "wait" },
        caller: { tone: "idle", rows: { 見える: HIDDEN_VISIBLE_EVENTS.join("・") } },
      },
      simplified: "✓ は正しく終わった合図。τ にはならず、隠しても見える。",
    },
    {
      id: "explore",
      kind: "explore",
      title: "τ だけの輪を探す",
      actor: "checker",
      to: ["job"],
      summary: `${HIDDEN.stateCount}状態・${HIDDEN.transitionCount}遷移のうち、τ は${HIDDEN_TAU_COUNT}本`,
      explain: `検査器は隠した後の全体をたどり、τ の遷移だけでぐるりと戻れる輪を探す。そうした輪があると、外から何も起きないまま中で動き続けられる。これを発散（ライブロック）と呼ぶ。`,
      set: {
        checker: {
          isHidden: false,
          tone: "wait",
          rows: {
            状態: `${HIDDEN.stateCount}個`,
            遷移: `${HIDDEN.transitionCount}本`,
            τ: `${HIDDEN_TAU_COUNT}本`,
          },
        },
      },
      simplified:
        "このサイトの小さな実装（csp.ts）で τ の輪を深さ優先で探している。同じモデルを ProB にかけると、隠した無制限のジョブだけが発散し、見えるままのジョブと上限付きのジョブは発散しないことが一致した（リポジトリの specs/csp）。",
    },
    {
      id: "diverge",
      kind: "found",
      title: "見えない輪が見つかる",
      actor: "checker",
      to: ["job", "caller"],
      summary: `${DIVERGENCE.trace.length > 0 ? `${traceText(DIVERGENCE.trace)} の後、` : "何も見えないうちから、"}${CYCLE_STATES}状態の τ の輪で回り続けられる`,
      explain: `start（τ）→ fail（τ）→ start（τ）… と、失敗し続ける限り τ だけで回る。呼び出し側からは何も起きていないように見え、待ち続けるしかない。サイトの「いつか必ず終わるか」で見た、リトライが終わらない輪を、外から見て何も起きない形で捉えたもの。`,
      set: {
        job: { tone: "bad", rows: { 中で: "τ をくり返す" } },
        hide: { tone: "bad" },
        caller: { tone: "bad", rows: { 見える: "何も起きない" } },
        checker: { tone: "bad", rows: { 発散: `${CYCLE_STATES}状態の輪` } },
      },
      detail: [
        {
          title: "検査器が返した輪（状態の鍵）",
          fields: [
            { label: "入るまで", value: traceText(DIVERGENCE.trace) },
            ...DIVERGENCE.cycle.map((key, index) => ({
              label: `${index + 1}`,
              value: key,
              isCode: true,
            })),
          ],
        },
      ],
      simplified:
        "毎回 succeed を選べばジョブは終わる。ここで反例になるのは「回り続ける実行がありうる」こと。サイトの活性のレッスンと同じく公平性（いつか成功を選ぶという仮定）は置いていない。FDR では livelock free の表明で調べ、失敗発散方式では発散した後のふるまいを「何でも起こりうる」とみなす。",
    },
    {
      id: "bound",
      kind: "fix",
      title: `上限${BOUNDED_RETRIES}回にする`,
      actor: "checker",
      to: ["job"],
      summary: `上限付きなら${BOUNDED.stateCount}状態で発散${BOUNDED_DIVERGENCE ? "あり" : "なし"}`,
      explain: `リトライを${BOUNDED_RETRIES}回までにし、使い切ったら giveup（断念）で終わるように直す。fail の先がいつか尽きるので τ の輪は作れず、隠しても${BOUNDED.stateCount}状態のどこにも発散は${BOUNDED_DIVERGENCE ? "残った" : "無い"}。`,
      set: {
        job: { tone: "ok", rows: { リトライ: `${BOUNDED_RETRIES}回まで`, 中で: null } },
        hide: { tone: "ok" },
        caller: { tone: "ok", rows: { 見える: visibleEvents(BOUNDED).join("・") } },
        checker: {
          tone: "ok",
          rows: {
            状態: `${BOUNDED.stateCount}個`,
            遷移: `${BOUNDED.transitionCount}本`,
            τ: null,
            発散: BOUNDED_DIVERGENCE ? "あり" : "なし",
          },
        },
      },
    },
  ],
  lab: {
    title: "上限と隠すかを変える",
    hint: `上限は0〜${MAX_RETRIES}。空欄か「なし」なら無制限。隠すは「はい / いいえ」。`,
    inputs: [
      {
        id: "retries",
        label: `リトライの上限（0〜${MAX_RETRIES}、空欄でなし）`,
        initial: "なし",
      },
      { id: "hidden", label: "start と fail を隠す（はい / いいえ）", initial: "はい" },
    ],
    compute: (values): Field[] => {
      const retries = parseRetries(values.retries);
      const isHidden = parseHidden(values.hidden);
      const system = jobSystem(retries, isHidden);
      const lts = explore(system, JOB_ENV);
      const found = divergence(system, JOB_ENV);
      const fields: Field[] = [
        { label: "上限", value: retries === null ? "なし（無制限）" : `${retries}回` },
        { label: "隠す", value: isHidden ? "はい" : "いいえ" },
        { label: "状態", value: `${lts.stateCount}個` },
        { label: "遷移", value: `${lts.transitionCount}本` },
        {
          label: "発散",
          value: found ? `あり（${new Set(found.cycle).size}状態の輪）` : "なし",
          tone: found ? "bad" : "ok",
        },
      ];
      if (found) {
        fields.push(
          ...found.cycle.map((key, index) => ({
            label: `輪${index + 1}`,
            value: key,
            isCode: true,
          })),
        );
      }
      return fields;
    },
  },
};
