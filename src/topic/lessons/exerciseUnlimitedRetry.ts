import { translator, type Language } from "../../core/i18n";
import type { Lesson, Step } from "../../core/types";
import { lazy } from "../exercise";
import { buildExerciseLesson } from "../exerciseLesson";
import { displayName, displayNames } from "../labels";
import { checkEventually, type Model, type TraceStep } from "../modelCheck";
import { isJobFinished, jobModel, type JobState } from "../models";

// 演習: リトライに上限が無いとき、「いつか必ず終わる」は成り立つか。
// 条件と正解の計算は exerciseModel.ts の問4と同じ（RETRY_LIMIT・checkEventually）。
// 答える前の図は規則と成功する道だけを見せ、「失敗して待ちに戻る」2手（反例の輪そのもの）は答えた後に回す。
const RETRY_LIMIT = 2;
// モデルを組むだけ（検査はしない）。
const UNLIMITED_MODEL = jobModel(null);
const LIMITED_MODEL = jobModel(RETRY_LIMIT);
// 成功で終わる道。問題の設定（成功すれば終わる）を見せるための筋書きで、答えの手掛かりではない。
const SUCCESS_PATH = ["実行する", "成功する"];

const RESULTS = lazy(() => ({
  unlimited: checkEventually(UNLIMITED_MODEL, isJobFinished),
  limited: checkEventually(LIMITED_MODEL, isJobFinished),
}));

type Translate = (ja: string, en: string) => string;

/** 決めた順に操作を当てる。動けない操作が来たら筋書きの誤りなので止める。 */
function runActions(model: Model<JobState>, names: string[]): JobState {
  return names.reduce((state, name) => {
    const action = model.actions.find((candidate) => candidate.name === name);
    if (!action || !action.enabled(state))
      throw new Error(`この順では動けない: ${name}`);
    return action.next(state);
  }, model.init);
}

/** 失敗できる限り失敗し続ける実行。上限があれば、いつか「諦める」しか残らなくなる。 */
function keepFailing(model: Model<JobState>, maxMoves: number): TraceStep<JobState>[] {
  const run: TraceStep<JobState>[] = [{ action: null, state: model.init }];
  const preference = ["失敗する", "諦める", "実行する"];
  while (run.length <= maxMoves && !isJobFinished(run.at(-1)!.state)) {
    const state = run.at(-1)!.state;
    const action = preference
      .map((name) => model.actions.find((candidate) => candidate.name === name)!)
      .find((candidate) => candidate.enabled(state));
    if (!action) break;
    run.push({ action: action.name, state: action.next(state) });
  }
  return run;
}

function retriesText(count: number, t: Translate): string {
  return t(`${count}回`, `${count} ${count === 1 ? "retry" : "retries"}`);
}

function setupSteps(t: Translate, language: Language): Step[] {
  const name = (text: string) => displayName(text, language);
  const status = t("状態", "status");
  const succeeded = runActions(UNLIMITED_MODEL, SUCCESS_PATH);
  return [
    {
      id: "rule",
      kind: "spec",
      title: t("上限なしでやり直す", "Retry with no limit"),
      actor: "rule",
      to: ["job"],
      summary: t(
        "ジョブは実行して、成功するか、失敗して待ちに戻る。やり直しの回数に上限は無い",
        "The job runs and either succeeds or fails back to waiting, with no limit on retries",
      ),
      explain: t(
        "ジョブは［待ち］から「実行する」で［実行中］になり、「成功する」で［成功］になる。失敗したときは［待ち］に戻してやり直す。上限があれば、使い切ったときに「諦める」で［断念］になるが、ここでは上限を付けない。",
        'The job goes from [waiting] to [running] by "run", and to [succeeded] by "succeed". When it fails it goes back to [waiting] and tries again. With a limit, using it up would lead to [gave up] by "give up", but here there is no limit.',
      ),
      set: {
        rule: { tone: "wait", rows: { [t("上限", "limit")]: t("なし", "none") } },
        job: { rows: { [status]: name(UNLIMITED_MODEL.init.status) } },
      },
    },
    {
      id: "success",
      kind: "run",
      title: t("成功すれば終わる", "Success ends it"),
      actor: "job",
      to: ["goal"],
      summary: t(
        `「${displayNames(SUCCESS_PATH, language)}」で、ジョブは［${succeeded.status}］で終わる`,
        `After "${displayNames(SUCCESS_PATH, language)}", the job ends [${name(succeeded.status)}]`,
      ),
      explain: t(
        "1回で成功すれば、ジョブはすぐに終わる。テストで流すと、たいていこの道を通る。",
        "If it succeeds the first time, the job ends straight away. Run in a test, it usually takes this path.",
      ),
      set: {
        job: { tone: "ok", rows: { [status]: name(succeeded.status) } },
      },
    },
    {
      id: "question",
      kind: "explore",
      title: t("いつか必ず終わるか", "Does it always end?"),
      actor: "goal",
      to: ["job"],
      summary: t(
        "上限が無いとき、「いつか必ず終わる」が成り立つかを「はい」か「いいえ」で答える",
        'Answer "yes" or "no": with unlimited retries, does "it always finishes eventually" hold?',
      ),
      explain: t(
        "やり直しの回数に上限を付けないとき、「ジョブはいつか必ず成功か断念で終わる」は成り立つか。下の「答え合わせ」に答えを入れると、検査器がたどった実行がこの図に足される。ヒント: 成功できる場面でも、毎回失敗する実行があり得る。",
        'With no limit on retries, does "the job always ends eventually, by succeeding or giving up" hold? Enter your answer under "Check your answer" below and the run the checker followed is added to this diagram. Hint: even when it could succeed, there can be a run that fails every time.',
      ),
      set: {
        job: { tone: "idle", rows: { [status]: name(UNLIMITED_MODEL.init.status) } },
        goal: { tone: "wait" },
        checker: {
          tone: "wait",
          rows: { [t("問い", "question")]: t("成り立つ？", "Holds?") },
        },
      },
    },
  ];
}

function solutionSteps(t: Translate, language: Language): Step[] {
  const name = (text: string) => displayName(text, language);
  const status = t("状態", "status");
  const verdict = t("判定", "verdict");
  const finishes = (holds: boolean) =>
    holds
      ? t("必ず終わる", "always finishes")
      : t("終わらない実行がある", "can run forever");
  const { unlimited, limited } = RESULTS();
  const steps: Step[] = [];
  const cycle = unlimited.cycle;

  if (cycle) {
    const key = (state: JobState) => UNLIMITED_MODEL.key(state);
    const entryIndex = cycle.findIndex(
      (entry) => key(entry.state) === key(cycle.at(-1)!.state),
    );
    const entryStatus = name(cycle[entryIndex]!.state.status);
    const moveCount = cycle.length - 1;
    cycle.slice(1).forEach((entry, index) => {
      const action = entry.action!;
      const isLast = index === moveCount - 1;
      steps.push({
        id: `move-${index + 1}`,
        kind: isLast ? "found" : "explore",
        title: t(`${index + 1}手目: ${action}`, `Step ${index + 1}: ${name(action)}`),
        actor: isLast ? "job" : "checker",
        to: [isLast ? "rule" : "job"],
        summary: t(
          `「${action}」で、ジョブは［${entry.state.status}］になる`,
          `The job does "${name(action)}" and is now [${name(entry.state.status)}]`,
        ),
        explain: isLast
          ? t(
              `ジョブは［${entry.state.status}］に戻った。これは${entryIndex === 0 ? "最初" : `${entryIndex}手目`}と同じ状態で、上限が無いので回数も数えていない。ここから先は、同じ手順をいくらでも繰り返せる。`,
              `The job is back at [${name(entry.state.status)}]. This is the same state as ${entryIndex === 0 ? "the start" : `after step ${entryIndex}`}, and with no limit, retries are not even counted. From here the same steps can repeat forever.`,
            )
          : t(
              `［${entry.state.status}］になった。ここで「成功する」こともできるが、検査器は失敗する方の道もたどる。`,
              `It is now [${name(entry.state.status)}]. It could "succeed" here, but the checker also follows the path where it fails.`,
            ),
        set: {
          job: {
            tone: isLast ? "bad" : "wait",
            rows: { [status]: name(entry.state.status) },
          },
          ...(index === 0
            ? {
                checker: {
                  tone: "wait" as const,
                  rows: {
                    [t("問い", "question")]: null,
                    [t("見る", "showing")]: t("失敗し続ける道", "failing every time"),
                  },
                },
              }
            : {}),
        },
      });
    });
    steps.push({
      id: "loop",
      kind: "found",
      title: t("輪を回り続ける", "Round the loop forever"),
      actor: "checker",
      to: ["goal"],
      summary: t(
        `［${entryStatus}］から「${displayNames(
          cycle.slice(entryIndex + 1).map((entry) => entry.action!),
          language,
        )}」の輪を回り続ける実行があり、「いつか必ず終わる」は破れる`,
        `There is a run that keeps going round "${displayNames(
          cycle.slice(entryIndex + 1).map((entry) => entry.action!),
          language,
        )}" from [${entryStatus}], so "always finishes eventually" breaks`,
      ),
      explain: t(
        "毎回失敗すれば、ジョブは［成功］にも［断念］にも着かずに回り続ける。活性の反例は、こうした終わらない輪の形をとる。テストは決まった時間で打ち切るので、この輪があるかどうかは分からない。",
        "If it fails every time, the job keeps going round without ever reaching [succeeded] or [gave up]. A liveness counterexample takes the shape of a loop like this. A test is cut off after a fixed time, so it cannot tell whether such a loop exists.",
      ),
      set: {
        goal: { tone: "bad" },
        checker: {
          tone: "bad",
          rows: { [t("見る", "showing")]: null, [verdict]: finishes(unlimited.holds) },
        },
      },
      simplified: t(
        "この検査器は公平性（成功できる状態が続くなら、いつかは成功する、などの仮定）を置かず、失敗し続ける実行も反例に数える。TLA+ で強い公平性 SF(Succeed) を置くと、上限が無くても成り立つ。",
        'This checker assumes no fairness (assumptions such as "if success stays possible, it eventually succeeds"), so a run that keeps failing counts as a counterexample. With strong fairness SF(Succeed) in TLA+, it holds even without a limit.',
      ),
    });
  }

  const limitedRun = keepFailing(LIMITED_MODEL, 20);
  const limitedEnd = limitedRun.at(-1)!.state;
  steps.push(
    {
      id: "set-limit",
      kind: "fix",
      title: t(
        `上限を${retriesText(RETRY_LIMIT, t)}にする`,
        `Limit it to ${retriesText(RETRY_LIMIT, t)}`,
      ),
      actor: "rule",
      to: ["job"],
      summary: t(
        `比べると、やり直しを${retriesText(RETRY_LIMIT, t)}までにすると、失敗し続けても終わる`,
        `By contrast, with at most ${retriesText(RETRY_LIMIT, t)}, the job ends even if it keeps failing`,
      ),
      explain: t(
        `上限を付けると、ジョブはやり直した回数を数える。失敗し続けると「${displayNames(
          limitedRun.slice(1).map((entry) => entry.action!),
          language,
        )}」と進み、上限を使い切ると「諦める」しかできなくなる。`,
        `With a limit, the job counts its retries. A run that keeps failing goes "${displayNames(
          limitedRun.slice(1).map((entry) => entry.action!),
          language,
        )}", and once the limit is used up, "give up" is all it can do.`,
      ),
      set: {
        rule: {
          tone: "ok",
          rows: { [t("上限", "limit")]: retriesText(RETRY_LIMIT, t) },
        },
        job: { tone: "ok", rows: { [status]: name(limitedEnd.status) } },
      },
    },
    {
      id: "limited-holds",
      kind: limited.holds ? "fix" : "found",
      title: t("上限付きは必ず終わる", "With a limit it ends"),
      actor: "checker",
      to: ["goal"],
      summary: t(
        `上限${retriesText(RETRY_LIMIT, t)}のモデルでは、「いつか必ず終わる」は${limited.holds ? "成り立つ" : "成り立たない"}`,
        `With a limit of ${retriesText(RETRY_LIMIT, t)}, "always finishes eventually" ${limited.holds ? "holds" : "still does not hold"}`,
      ),
      explain: limited.holds
        ? t(
            "回数を数えるので［待ち］に戻っても前と同じ状態にはならず、輪ができない。検査器がたどっても、終わらない実行は見つからなかった。",
            "Because retries are counted, going back to [waiting] never repeats an earlier state, so there is no loop. The checker found no run that never ends.",
          )
        : t(
            "上限を付けても、終わらない実行が残った。",
            "Even with a limit, a run that never ends remains.",
          ),
      set: {
        goal: { tone: limited.holds ? "ok" : "bad" },
        checker: {
          tone: limited.holds ? "ok" : "bad",
          rows: { [verdict]: finishes(limited.holds) },
        },
      },
    },
  );
  // 答え合わせは「上限が無いとき」の判定なので、検査器のカードを上限なしの結果に戻してから渡す。
  steps.push({
    id: "back-to-question",
    kind: "found",
    title: t("問いは上限なしのとき", "The question: no limit"),
    actor: "rule",
    to: ["job"],
    summary: t(
      `問いの「上限なし」に戻すと、${finishes(unlimited.holds)}`,
      `Back to the question's "no limit": it ${unlimited.holds ? "always finishes" : "can run forever"}`,
    ),
    explain: t(
      "問われたのは上限を付けないときなので、答えは輪のある方の結果で決まる。",
      "The question was about having no limit, so the answer comes from the model with the loop.",
    ),
    set: {
      rule: { tone: "wait", rows: { [t("上限", "limit")]: t("なし", "none") } },
      job: { tone: "bad", rows: { [status]: name(UNLIMITED_MODEL.init.status) } },
      goal: { tone: unlimited.holds ? "ok" : "bad" },
      checker: {
        tone: unlimited.holds ? "ok" : "bad",
        rows: { [verdict]: finishes(unlimited.holds) },
      },
    },
  });
  return steps;
}

export function exerciseUnlimitedRetryLesson(language: Language): Lesson {
  const t = translator(language);
  return buildExerciseLesson(
    {
      id: "exercise-unlimited-retry",
      title: t("演習: 上限の無いリトライ", "Exercise: retries without a limit"),
      subtitle: t(
        "上限なしでやり直すジョブは、いつか必ず終わるか",
        "Does a job that retries without limit always finish?",
      ),
      summary: t(
        "失敗したら待ちに戻してやり直すジョブで、やり直しに上限が無いとき「いつか必ず終わる」が成り立つかを答える。答えを入れると、検査器がたどった実行を1手ずつ追い、上限を付けたときと比べられる。",
        'For a job that goes back to waiting and retries on failure, answer whether "it always finishes eventually" holds when retries have no limit. Once you answer, you can follow the run the checker found step by step and compare it with a limit.',
      ),
      intro: [
        t(
          "「いつか必ず終わるか」で見たリトライ付きのジョブを使う。失敗したら待ちに戻してやり直し、その回数に上限を付けない。このとき、ジョブがいつか必ず成功か断念で終わると言えるかを考える問題である。",
          'This uses the job with retries from "Does it ever finish?". When it fails it goes back to waiting and tries again, with no limit on how many times. The question is whether the job can be said to always end eventually, by succeeding or giving up.',
        ),
        t(
          "図はまず、リトライの規則と、成功して終わる道だけを見せる。下の「答え合わせ」に答えを入れると、検査器がたどった実行が足される。「図で見る」を押して、ジョブのカードの状態がどこへ戻るかを追う。",
          'The diagram first shows only the retry rule and the path that ends in success. When you enter your answer under "Check your answer", the run the checker followed is added. Press "Show the diagram" and follow where the status on the job card goes back to.',
        ),
      ],
      facts: [
        {
          label: t("題材", "Subject"),
          value: t("リトライ付きのジョブ", "Job with retries"),
        },
        {
          label: t("答え方", "How to answer"),
          value: t("「はい」か「いいえ」", '"yes" or "no"'),
        },
        {
          label: t("出題範囲", "Covers"),
          value: t("いつか必ず終わるか", '"Does it ever finish?"'),
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
          initial: { rows: { [t("上限", "limit")]: t("なし", "none") } },
        },
        {
          id: "job",
          label: t("ジョブ", "Job"),
          sublabel: t(
            "待ち・実行中・成功・断念",
            "waiting, running, succeeded, gave up",
          ),
          icon: "job",
          x: 38,
          y: 50,
          initial: {
            rows: {
              [t("状態", "status")]: displayName(UNLIMITED_MODEL.init.status, language),
            },
          },
        },
        {
          id: "goal",
          label: t("活性の性質", "Liveness property"),
          sublabel: t("いつか必ず終わる", "always finishes eventually"),
          icon: "contract",
          x: 62,
          y: 50,
        },
        {
          id: "checker",
          label: t("モデル検査器", "Model checker"),
          sublabel: t("終わるかを調べる", "checks whether it ends"),
          icon: "checker",
          x: 86,
          y: 50,
        },
      ],
      stageHeight: 300,
      links: [
        { from: "rule", to: "job" },
        { from: "goal", to: "job" },
        { from: "checker", to: "job" },
      ],
      answerType: "yesno",
      // 既定の samples は日本語の「はい／いいえ」を含み、英語のレッスンが訳し忘れの検査で落ちるので、言語ごとに渡す。
      samples: language === "ja" ? ["はい", "いいえ", "yes"] : ["yes", "no", "y"],
      answerLabel: t("あなたの答え（はい／いいえ）", "Your answer (yes / no)"),
      hint: t(
        "成り立つなら「はい」、成り立たないなら「いいえ」を入れる。入れると、図に検査器がたどった実行が足される。",
        'Enter "yes" if it holds, "no" if not. The run the checker followed is then added to the diagram.',
      ),
      verdictActor: "checker",
      setupSteps: setupSteps(t, language),
      solve: () => {
        const { unlimited, limited } = RESULTS();
        const cycleText = unlimited.cycle
          ? t(
              `（${displayNames(
                unlimited.cycle.slice(1).map((step) => step.action ?? ""),
                language,
              )}）`,
              ` (${displayNames(
                unlimited.cycle.slice(1).map((step) => step.action ?? ""),
                language,
              )})`,
            )
          : "";
        return {
          answer: unlimited.holds,
          reason: t(
            `失敗して待ちに戻る輪${cycleText}を回り続ける実行があり、終わらない。上限を${RETRY_LIMIT}回にすると${limited.holds ? "成り立つ" : "成り立たない"}。`,
            `There is a run that keeps going round the loop of failing and returning to waiting${cycleText}, and never ends. With a limit of ${RETRY_LIMIT} retries it ${limited.holds ? "holds" : "still does not hold"}.`,
          ),
        };
      },
      solutionSteps: () => solutionSteps(t, language),
    },
    language,
  );
}
