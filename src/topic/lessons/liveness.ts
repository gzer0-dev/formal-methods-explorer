import type { Field, Lesson } from "../../core/types";
import { check, checkEventually } from "../modelCheck";
import type { TraceStep } from "../modelCheck";
import { isJobFinished, jobModel } from "../models";
import type { JobState } from "../models";

const UNLIMITED = jobModel(null);
const UNLIMITED_RESULT = checkEventually(UNLIMITED, isJobFinished);
const UNLIMITED_CHECK = check(UNLIMITED);
const LIMIT = 2;
const LIMITED_RESULT = checkEventually(jobModel(LIMIT), isJobFinished);
const LIMITED_CHECK = check(jobModel(LIMIT));
// 輪の手順。cycle[0] は初期状態、最後の状態は輪の入口と同じ状態。
const CYCLE = UNLIMITED_RESULT.cycle!;

function describeCycle(cycle: TraceStep<JobState>[]): string {
  return cycle
    .map((step, i) =>
      i === 0 ? `[${step.state.status}]` : `${step.action} → [${step.state.status}]`,
    )
    .join(" → ");
}

/** 空欄や「なし」は無制限（null）。数字は0〜5の上限。読めない入力も無制限に戻す。 */
function parseLimit(text: string | undefined): number | null {
  const trimmed = (text ?? "").trim();
  if (trimmed === "" || trimmed.includes("なし")) return null;
  const value = Number.parseInt(trimmed, 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 5) : null;
}

export const livenessLesson: Lesson = {
  id: "liveness",
  category: "model",
  title: "いつか必ず終わるか",
  subtitle: "失敗したらやり直すジョブ",
  summary: `失敗したら待ちに戻してやり直すジョブが「いつか必ず終わる」かを調べる。リトライが無制限だと、失敗し続けて永遠に終わらない輪が反例として見つかる。上限を${LIMIT}回にすると必ず終わる。`,
  facts: [
    {
      label: "無制限のとき",
      value: UNLIMITED_RESULT.holds ? "必ず終わる" : "終わらない実行がある",
      tone: "bad",
    },
    {
      label: "上限2回のとき",
      value: LIMITED_RESULT.holds ? "必ず終わる" : "終わらない実行がある",
      tone: "ok",
    },
    { label: "反例の形", value: `${CYCLE.length - 1}手で一周する輪` },
    { label: "実物の道具", value: "TLA+ と TLC（時相論理）" },
  ],
  actors: [
    {
      id: "rule",
      label: "リトライの規則",
      sublabel: "失敗したら待ちに戻す",
      icon: "spec",
      x: 14,
      y: 50,
      initial: { rows: { 上限: "なし" } },
    },
    {
      id: "job",
      label: "ジョブ",
      sublabel: "待ち・実行中・成功・断念",
      icon: "job",
      x: 38,
      y: 50,
      initial: { rows: { 状態: UNLIMITED.init.status } },
    },
    {
      id: "goal",
      label: "活性の性質",
      sublabel: "いつか必ず終わる",
      icon: "contract",
      x: 62,
      y: 50,
      initial: { isHidden: true },
    },
    {
      id: "checker",
      label: "モデル検査器",
      sublabel: "終わらない道を探す",
      icon: "checker",
      x: 86,
      y: 50,
      initial: { isHidden: true },
    },
  ],
  stageHeight: 300,
  links: [
    { from: "rule", to: "job" },
    { from: "goal", to: "job" },
    { from: "checker", to: "job" },
  ],
  steps: [
    {
      id: "write-rule",
      kind: "spec",
      title: "リトライを書く",
      actor: "rule",
      to: ["job"],
      summary: "ジョブは実行して、成功するか、失敗して待ちに戻る。回数の上限はない",
      explain:
        "ジョブは待ちから実行中になり、成功すれば終わり、失敗すれば待ちに戻ってやり直す。よくある「失敗したら何度でもリトライ」の作りで、回数の上限を置いていない。",
      set: { job: { rows: { 状態: UNLIMITED.init.status } } },
    },
    {
      id: "write-goal",
      kind: "spec",
      title: "活性の性質を書く",
      actor: "goal",
      to: ["job"],
      summary: "「いつか必ず成功か断念で終わる」を性質にする",
      explain:
        "不変条件のような安全性（safety）は「悪いことが決して起きない」を言う。ここで書くのは活性（liveness）で、「良いことがいつか必ず起きる」を言う。どの状態を見ても違反とは言えず、実行全体を見ないと破れたか分からない。",
      set: {
        goal: { isHidden: false, rows: { 性質: "いつか成功か断念" } },
      },
      detail: [
        {
          title: "安全性と活性",
          fields: [
            {
              label: "安全性",
              value: "悪いことが決して起きない",
              note: "反例は有限の手順",
            },
            {
              label: "活性",
              value: "良いことがいつか必ず起きる",
              note: "反例は終わらない実行",
            },
          ],
        },
      ],
    },
    {
      id: "explore",
      kind: "explore",
      title: "終わらない道を探す",
      actor: "checker",
      to: ["job"],
      summary: `終わっていない状態だけをたどり、輪か行き止まりを探す（状態は全部で${UNLIMITED_CHECK.stateCount}個）`,
      explain: `検査器は、成功や断念に着いていない状態だけをたどる。そこで同じ状態に戻る輪が見つかれば、その輪を回り続ける実行は永遠に終わらない。状態は全部で${UNLIMITED_CHECK.stateCount}個しかないが、輪があれば実行の長さに限りはない。`,
      set: {
        checker: {
          isHidden: false,
          tone: "wait",
          rows: { 状態: `${UNLIMITED_CHECK.stateCount}個` },
        },
      },
    },
    {
      id: "run",
      kind: "found",
      title: `${CYCLE[1]!.action}`,
      actor: "job",
      summary: `[${CYCLE[0]!.state.status}] から「${CYCLE[1]!.action}」で [${CYCLE[1]!.state.status}] へ`,
      explain: `見つかった輪を1手ずつ再生する。まずジョブを実行し、${CYCLE[1]!.state.status}になる。ここで成功すれば終わるが、失敗することもできる。`,
      set: { job: { tone: "wait", rows: { 状態: CYCLE[1]!.state.status } } },
    },
    {
      id: "cycle",
      kind: "found",
      title: "失敗して待ちに戻る",
      actor: "job",
      summary: `「${CYCLE[2]!.action}」で [${CYCLE[2]!.state.status}] に戻り、輪になる`,
      explain: `失敗すると [${CYCLE[2]!.state.status}] に戻り、最初と同じ状態になった。この輪を回り続ければジョブは永遠に終わらない。活性の反例は、このように「ずっと回り続ける実行」の形になる。`,
      set: {
        job: { tone: "bad", rows: { 状態: CYCLE[2]!.state.status } },
        goal: { tone: "bad", rows: { 判定: "破れた" } },
        checker: { tone: "bad", rows: { 反例: `${CYCLE.length - 1}手の輪` } },
      },
      detail: [
        {
          title: "検査器が見つけた輪",
          fields: [{ label: "手順", value: describeCycle(CYCLE) }],
        },
      ],
      simplified:
        "実物の TLA+ では、公平性（fairness）の仮定を置くことが多い。たとえば「成功できる状態が続くなら、いつかは成功する」と仮定すると、この輪は反例にならない。ここでは公平性を仮定していないので、成功できるのに失敗し続ける実行も反例に数えている。上限を付けると『断念』で終わるので、成功を保証するものではない。",
    },
    {
      id: "fix",
      kind: "fix",
      title: `上限を${LIMIT}回にする`,
      actor: "rule",
      to: ["job"],
      summary: `リトライを${LIMIT}回までにすると、どの実行も成功か断念で終わる`,
      explain: `リトライの回数を数え、${LIMIT}回失敗したら諦めて断念にする。回数が状態に入るので状態は${LIMITED_CHECK.stateCount}個に増えるが、同じ状態に戻る輪はなくなり、どの実行もいつか終わる。`,
      set: {
        rule: { tone: "ok", rows: { 上限: `${LIMIT}回` } },
        job: { tone: "ok", rows: { 状態: "待ち" } },
        goal: {
          tone: LIMITED_RESULT.holds ? "ok" : "bad",
          rows: { 判定: LIMITED_RESULT.holds ? "成り立つ" : "破れた" },
        },
        checker: {
          tone: "ok",
          rows: {
            状態: `${LIMITED_CHECK.stateCount}個`,
            反例: LIMITED_RESULT.holds ? "なし" : "あり",
          },
        },
      },
      simplified:
        "TLA+ では「いつか必ず」を時相論理の <>（eventually）で書き、TLC が輪を探す。ここでは自作の検査器が深さ優先で輪と行き止まりを探している。",
    },
  ],
  lab: {
    title: "リトライの上限を変える",
    hint: "空欄か「なし」なら無制限、0〜5の数字ならその回数まで。上限があると、状態は増えるが輪は消える。",
    inputs: [{ id: "limit", label: "リトライの上限（なし / 0〜5）", initial: "なし" }],
    compute: (values): Field[] => {
      const limit = parseLimit(values.limit);
      const model = jobModel(limit);
      const result = checkEventually(model, isJobFinished);
      return [
        { label: "上限", value: limit === null ? "なし（無制限）" : `${limit}回` },
        {
          label: "いつか必ず終わるか",
          value: result.holds ? "成り立つ" : "成り立たない",
          tone: result.holds ? "ok" : "bad",
        },
        {
          label: "輪の手順",
          value: result.cycle ? describeCycle(result.cycle) : "なし",
          tone: result.cycle ? "bad" : "ok",
        },
        { label: "状態の数", value: `${check(model).stateCount}個` },
      ];
    },
  },
};
