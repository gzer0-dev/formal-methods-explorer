import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { displayName } from "../labels";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
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
const CYCLE_MOVES = CYCLE.length - 1;

function describeCycle(cycle: TraceStep<JobState>[], language: Language): string {
  const name = (text: string) => displayName(text, language);
  return cycle
    .map((step, i) =>
      i === 0
        ? `[${name(step.state.status)}]`
        : `${name(step.action ?? "")} → [${name(step.state.status)}]`,
    )
    .join(" → ");
}

/** 空欄や「なし」（英語では none）は無制限（null）。数字は0〜5の上限。読めない入力も無制限に戻す。 */
function parseLimit(text: string | undefined): number | null {
  const trimmed = (text ?? "").trim();
  if (trimmed === "" || trimmed.includes("なし") || /none/i.test(trimmed)) return null;
  const value = Number.parseInt(trimmed, 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 5) : null;
}

function retriesText(count: number): string {
  return `${count} ${count === 1 ? "retry" : "retries"}`;
}

function stepsText(count: number): string {
  return `${count} ${count === 1 ? "step" : "steps"}`;
}

export function livenessLesson(language: Language): Lesson {
  const t = translator(language);
  const name = (text: string) => displayName(text, language);
  const status = t("状態", "status");
  const verdict = t("判定", "verdict");
  const limitKey = t("上限", "limit");
  const finishes = (holds: boolean) =>
    holds
      ? t("必ず終わる", "always finishes")
      : t("終わらない実行がある", "can run forever");
  return {
    id: "liveness",
    category: "model",
    title: t("いつか必ず終わるか", "Does it ever finish?"),
    subtitle: t("失敗したらやり直すジョブ", "A job that retries on failure"),
    summary: t(
      `失敗したら待ちに戻してやり直すジョブが「いつか必ず終わる」かを調べる。リトライが無制限だと、失敗し続けて永遠に終わらない輪が反例として見つかる。上限を${LIMIT}回にすると必ず終わる。`,
      `Check whether a job that goes back to waiting and retries on failure "always finishes eventually". With unlimited retries, a loop that keeps failing and never ends is found as the counterexample. With a limit of ${retriesText(LIMIT)} it always finishes.`,
    ),
    intro: [
      t(
        "活性（liveness）は、待っていればいつか必ず望んだ結果になる、という性質である。これまでの不変条件（いつ見ても成り立っていてほしい条件）やデッドロックの検査は「悪いことが起きない」を見る安全性（safety）で、活性はそれとは別に調べる。",
        'Liveness is the property that, if you wait, the result you want always happens eventually. The invariants (conditions that should hold whenever you look) and deadlock checks so far were safety ("nothing bad happens"); liveness is checked separately.',
      ),
      t(
        "題材は、失敗したら待ちに戻してやり直すジョブである。テストは決まった時間しか見られないので、「いつか終わる」は時間切れで打ち切るしかなく、終わらない動きがあるかどうかは分からない。",
        'The example is a job that goes back to waiting and retries when it fails. A test can only watch for a fixed time, so "it eventually finishes" can only be cut off by a timeout, and you cannot tell whether a never-ending run exists.',
      ),
      t(
        "図では、ジョブのカードの状態が実行と失敗で移り変わる様子を追う。失敗して最初と同じ状態に戻る場面が分かれ目で、そのあとリトライの規則のカードが変わると何が違うかを見る。",
        "In the diagram, follow the job card's status as it moves through running and failing. The turning point is failing and returning to the very first state; after that, see what changes when the retry rule card changes.",
      ),
    ],
    facts: [
      {
        label: t("無制限のとき", "Unlimited retries"),
        value: finishes(UNLIMITED_RESULT.holds),
        tone: "bad",
      },
      {
        label: t("上限2回のとき", "Limit of 2"),
        value: finishes(LIMITED_RESULT.holds),
        tone: "ok",
      },
      {
        label: t("反例の形", "Counterexample"),
        value: t(`${CYCLE_MOVES}手で一周する輪`, `a loop of ${stepsText(CYCLE_MOVES)}`),
      },
      {
        label: t("実物の道具", "Real tools"),
        value: t("TLA+ と TLC（時相論理）", "TLA+ and TLC (temporal logic)"),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 7.1.2節（ライブロックフリー性）`,
          `${CSP_BOOK_EN}, section 7.1.2 (livelock freedom)`,
        ),
      },
    ],
    actors: [
      {
        id: "rule",
        label: t("リトライの規則", "Retry rule"),
        sublabel: t("失敗したら待ちに戻す", "back to waiting on failure"),
        icon: "spec",
        x: 14,
        y: 50,
        initial: { rows: { [limitKey]: t("なし", "none") } },
      },
      {
        id: "job",
        label: t("ジョブ", "Job"),
        sublabel: t("待ち・実行中・成功・断念", "waiting, running, succeeded, gave up"),
        icon: "job",
        x: 38,
        y: 50,
        initial: { rows: { [status]: name(UNLIMITED.init.status) } },
      },
      {
        id: "goal",
        label: t("活性の性質", "Liveness property"),
        sublabel: t("いつか必ず終わる", "always finishes eventually"),
        icon: "contract",
        x: 62,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("モデル検査器", "Model checker"),
        sublabel: t("終わらない道を探す", "looks for endless runs"),
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
        title: t("リトライを書く", "Write the retry"),
        actor: "rule",
        to: ["job"],
        summary: t(
          "ジョブは実行して、成功するか、失敗して待ちに戻る。回数の上限はない",
          "The job runs and either succeeds or fails back to waiting, with no limit on retries",
        ),
        explain: t(
          "ジョブは待ちから実行中になり、成功すれば終わり、失敗すれば待ちに戻ってやり直す。よくある「失敗したら何度でもリトライ」の作りで、回数の上限を置いていない。",
          'The job goes from waiting to running; if it succeeds it is done, and if it fails it goes back to waiting and tries again. This is the common "retry as many times as it takes" design, with no limit on the count.',
        ),
        set: { job: { rows: { [status]: name(UNLIMITED.init.status) } } },
      },
      {
        id: "write-goal",
        kind: "spec",
        title: t("活性の性質を書く", "Write the liveness property"),
        actor: "goal",
        to: ["job"],
        summary: t(
          "「いつか必ず成功か断念で終わる」を性質にする",
          'Make "it always ends eventually, by success or giving up" the property',
        ),
        explain: t(
          "不変条件のような安全性（safety）は「悪いことが決して起きない」を言う。ここで書くのは活性（liveness）で、「良いことがいつか必ず起きる」を言う。どの状態を見ても違反とは言えず、実行全体を見ないと破れたか分からない。",
          'Safety properties like invariants say "something bad never happens". What we write here is liveness, which says "something good always happens eventually". No single state is a violation; you can only tell it is broken by looking at a whole execution.',
        ),
        set: {
          goal: {
            isHidden: false,
            rows: {
              [t("性質", "property")]: t(
                "いつか成功か断念",
                "eventually done or gave up",
              ),
            },
          },
        },
        detail: [
          {
            title: t("安全性と活性", "Safety and liveness"),
            fields: [
              {
                label: t("安全性", "Safety"),
                value: t("悪いことが決して起きない", "Something bad never happens"),
                note: t("反例は有限の手順", "counterexample: a finite sequence"),
              },
              {
                label: t("活性", "Liveness"),
                value: t(
                  "良いことがいつか必ず起きる",
                  "Something good eventually happens",
                ),
                note: t("反例は終わらない実行", "counterexample: an endless run"),
              },
            ],
          },
        ],
      },
      {
        id: "explore",
        kind: "explore",
        title: t("終わらない道を探す", "Look for endless runs"),
        actor: "checker",
        to: ["job"],
        summary: t(
          `終わっていない状態だけをたどり、輪か行き止まりを探す（状態は全部で${UNLIMITED_CHECK.stateCount}個）`,
          `Walk only unfinished states, looking for a loop or a dead end (${UNLIMITED_CHECK.stateCount} states in all)`,
        ),
        explain: t(
          `検査器は、成功や断念に着いていない状態だけをたどる。そこで同じ状態に戻る輪が見つかれば、その輪を回り続ける実行は永遠に終わらない。状態は全部で${UNLIMITED_CHECK.stateCount}個しかないが、輪があれば実行の長さに限りはない。`,
          `The checker walks only states that have not reached success or giving up. If it finds a loop back to the same state there, a run that keeps going around it never ends. There are only ${UNLIMITED_CHECK.stateCount} states in all, but with a loop a run can be any length.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("状態", "states")]: t(
                `${UNLIMITED_CHECK.stateCount}個`,
                `${UNLIMITED_CHECK.stateCount}`,
              ),
            },
          },
        },
      },
      {
        id: "run",
        kind: "found",
        title: t(CYCLE[1]!.action!, "Run"),
        actor: "job",
        summary: t(
          `[${CYCLE[0]!.state.status}] から「${CYCLE[1]!.action}」で [${CYCLE[1]!.state.status}] へ`,
          `From [${name(CYCLE[0]!.state.status)}], "${name(CYCLE[1]!.action!)}" leads to [${name(CYCLE[1]!.state.status)}]`,
        ),
        explain: t(
          `見つかった輪を1手ずつ再生する。まずジョブを実行し、${CYCLE[1]!.state.status}になる。ここで成功すれば終わるが、失敗することもできる。`,
          `Replay the loop one step at a time. First the job runs and becomes ${name(CYCLE[1]!.state.status)}. If it succeeds here it is done, but it can also fail.`,
        ),
        set: {
          job: { tone: "wait", rows: { [status]: name(CYCLE[1]!.state.status) } },
        },
      },
      {
        id: "cycle",
        kind: "found",
        title: t("失敗して待ちに戻る", "Fail and go back to waiting"),
        actor: "job",
        summary: t(
          `「${CYCLE[2]!.action}」で [${CYCLE[2]!.state.status}] に戻り、輪になる`,
          `"${name(CYCLE[2]!.action!)}" returns to [${name(CYCLE[2]!.state.status)}], closing the loop`,
        ),
        explain: t(
          `失敗すると [${CYCLE[2]!.state.status}] に戻り、最初と同じ状態になった。この輪を回り続ければジョブは永遠に終わらない。活性の反例は、このように「ずっと回り続ける実行」の形になる。`,
          `Failing returns it to [${name(CYCLE[2]!.state.status)}], the same state it started in. If it keeps going around this loop, the job never ends. A liveness counterexample takes this shape: a run that goes around forever.`,
        ),
        set: {
          job: { tone: "bad", rows: { [status]: name(CYCLE[2]!.state.status) } },
          goal: { tone: "bad", rows: { [verdict]: t("破れた", "broken") } },
          checker: {
            tone: "bad",
            rows: {
              [t("反例", "counterexample")]: t(
                `${CYCLE_MOVES}手の輪`,
                `${stepsText(CYCLE_MOVES)} loop`,
              ),
            },
          },
        },
        detail: [
          {
            title: t("検査器が見つけた輪", "Loop the checker found"),
            fields: [
              { label: t("手順", "Steps"), value: describeCycle(CYCLE, language) },
            ],
          },
        ],
        simplified: t(
          "実物の TLA+ では、公平性（fairness）の仮定を置くことが多い。この輪では「成功する」は［実行中］でだけでき、［待ち］ではできないので、成功できる状態は続かず、繰り返し訪れるだけになる。そのため「成功できる状態が続くなら、いつかは成功する」（弱い公平性）を仮定しても輪は残り、「成功できる状態を繰り返し訪れるなら、いつかは成功する」（強い公平性）を仮定すると反例にならない。ここの検査器が置いている仮定は「動ける限り止まらない」だけで、TLA+ の WF_vars(Next) に当たる。TLA+ で公平性を何も書かないと、何もせずに止まり続ける実行（足踏み）がまず反例になる。どの操作を選ぶかの公平性は仮定していないので、成功できるのに失敗し続ける実行も反例に数えている。この4通りの違いは TLC で確かめた（リポジトリの specs/tla/Job.tla）。上限を付けると『断念』で終わるので、成功を保証するものではない。",
          'Real TLA+ specs often assume fairness. In this loop, "succeed" is possible only in [running], not in [waiting], so a state where success is possible does not persist; it is only visited again and again. So assuming "if success stays possible, it eventually succeeds" (weak fairness) leaves the loop in place, while assuming "if success is possible again and again, it eventually succeeds" (strong fairness) removes the counterexample. The only assumption this checker makes is "it does not stop while it can move", which corresponds to WF_vars(Next) in TLA+. With no fairness at all in TLA+, a run that just stops and does nothing (stuttering) is the first counterexample. No fairness is assumed about which action is chosen, so a run that keeps failing even though it could succeed also counts as a counterexample. These four cases were confirmed with TLC (specs/tla/Job.tla in the repository). A limit makes it end by "gave up", so it does not guarantee success.',
        ),
      },
      {
        id: "fix",
        kind: "fix",
        title: t(`上限を${LIMIT}回にする`, `Limit retries to ${LIMIT}`),
        actor: "rule",
        to: ["job"],
        summary: t(
          `リトライを${LIMIT}回までにすると、どの実行も成功か断念で終わる`,
          `With at most ${retriesText(LIMIT)}, every run ends by success or giving up`,
        ),
        explain: t(
          `リトライの回数を数え、${LIMIT}回失敗したら諦めて断念にする。回数が状態に入るので状態は${LIMITED_CHECK.stateCount}個に増えるが、同じ状態に戻る輪はなくなり、どの実行もいつか終わる。`,
          `Count the retries, and after ${LIMIT} failures give up. The count becomes part of the state, so the states grow to ${LIMITED_CHECK.stateCount}, but there is no loop back to the same state anymore, and every run eventually ends.`,
        ),
        set: {
          rule: {
            tone: "ok",
            rows: { [limitKey]: t(`${LIMIT}回`, retriesText(LIMIT)) },
          },
          job: { tone: "ok", rows: { [status]: name("待ち") } },
          goal: {
            tone: LIMITED_RESULT.holds ? "ok" : "bad",
            rows: {
              [verdict]: LIMITED_RESULT.holds
                ? t("成り立つ", "holds")
                : t("破れた", "broken"),
            },
          },
          checker: {
            tone: "ok",
            rows: {
              [t("状態", "states")]: t(
                `${LIMITED_CHECK.stateCount}個`,
                `${LIMITED_CHECK.stateCount}`,
              ),
              [t("反例", "counterexample")]: LIMITED_RESULT.holds
                ? t("なし", "none")
                : t("あり", "yes"),
            },
          },
        },
        simplified: t(
          "TLA+ では「いつか必ず」を時相論理の <>（eventually）で書き、TLC が輪を探す。ここでは自作の検査器が深さ優先で輪と行き止まりを探している。CSP の検査器 FDR では、外から見えない内部の動きだけを限りなく繰り返す状態をライブロックと呼び、livelock free の表明で調べる。このジョブも、「実行する」「失敗する」を外から見えない動きとして扱えば、この輪がライブロックに当たる。",
          'In TLA+ you write "eventually" with the temporal operator <>, and TLC looks for loops. Here a homemade checker looks for loops and dead ends depth-first. In FDR, the CSP checker, repeating only internal moves invisible from outside without end is called a livelock, and the "livelock free" assertion checks for it. If "run" and "fail" in this job were treated as invisible moves, this loop would be a livelock.',
        ),
      },
    ],
    lab: {
      title: t("リトライの上限を変える", "Change the retry limit"),
      hint: t(
        "空欄か「なし」なら無制限、0〜5の数字ならその回数まで。上限があると、状態は増えるが輪は消える。",
        'Leave it empty or type "none" for unlimited, or a number 0-5 for that many retries. With a limit, states grow but the loop disappears.',
      ),
      inputs: [
        {
          id: "limit",
          label: t("リトライの上限（なし / 0〜5）", "Retry limit (none / 0-5)"),
          initial: t("なし", "none"),
        },
      ],
      compute: (values): Field[] => {
        const limit = parseLimit(values.limit);
        const model = jobModel(limit);
        const result = checkEventually(model, isJobFinished);
        return [
          {
            label: t("上限", "Limit"),
            value:
              limit === null
                ? t("なし（無制限）", "none (unlimited)")
                : t(`${limit}回`, retriesText(limit)),
          },
          {
            label: t("いつか必ず終わるか", "Always finishes?"),
            value: result.holds
              ? t("成り立つ", "holds")
              : t("成り立たない", "does not hold"),
            tone: result.holds ? "ok" : "bad",
          },
          {
            label: t("輪の手順", "Loop"),
            value: result.cycle
              ? describeCycle(result.cycle, language)
              : t("なし", "none"),
            tone: result.cycle ? "bad" : "ok",
          },
          {
            label: t("状態の数", "States"),
            value: t(`${check(model).stateCount}個`, `${check(model).stateCount}`),
          },
        ];
      },
    },
  };
}
