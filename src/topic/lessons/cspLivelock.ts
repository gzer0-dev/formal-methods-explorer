import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { CSP_BOOK, CSP_BOOK_EN } from "../references";
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

function traceText(trace: string[], language: Language): string {
  if (trace.length > 0) return trace.join(" → ");
  return language === "ja" ? "なし（最初から）" : "none (from the start)";
}

function parseRetries(text: string | undefined): number | null {
  const trimmed = (text ?? "").trim();
  if (trimmed === "" || trimmed === "なし") return null;
  const n = Number.parseInt(trimmed, 10);
  // 読めない入力（英語の画面の none も）は既定の「無制限」に戻す
  if (Number.isNaN(n)) return null;
  return Math.min(MAX_RETRIES, Math.max(0, n));
}

function parseHidden(text: string | undefined): boolean {
  // 「いいえ」（英語では no）と書いたときだけ見えるままにする。それ以外は既定の「はい」に戻す。
  const value = text ?? "";
  return !value.includes("いいえ") && !/\bno\b/i.test(value);
}

export function cspLivelockLesson(language: Language): Lesson {
  const t = translator(language);
  const list = (events: string[]) => t(events.join("・"), events.join(", "));
  return {
    id: "csp-livelock",
    category: "csp",
    title: t("隠すと見える発散", "Hiding reveals divergence"),
    subtitle: t(
      "外からは何も起きないまま、中で回り続ける",
      "Nothing happens outside while the inside loops",
    ),
    summary: t(
      `失敗したらやり直すジョブの start と fail を隠すと、見えない動き τ だけで回る輪（発散）ができる。リトライに上限を付けると${BOUNDED.stateCount}状態で発散は${BOUNDED_DIVERGENCE ? "残る" : "消える"}。`,
      `Hide start and fail in a job that retries on failure, and a loop of invisible τ moves alone (divergence) appears. With a retry limit, the ${BOUNDED.stateCount} states ${BOUNDED_DIVERGENCE ? "still diverge" : "no longer diverge"}.`,
    ),
    intro: [
      t(
        "隠蔽は、指定したイベントを外から見えない動き τ（タウ）に変える操作だ。τ だけでいつまでも回り続けられることを発散（ライブロック）と呼ぶ。止まってはいないが、外からは何も進んでいないように見える。",
        "Hiding turns the chosen events into τ (tau), moves invisible from outside. Being able to loop forever on τ alone is called divergence (livelock). The process has not stopped, but from outside nothing seems to progress.",
      ),
      t(
        "「いつか必ず終わるか」で見た、失敗し続けるリトライの輪を、呼び出し側から見た形で捉え直す。テストではタイムアウトとして現れるだけで、止まっているのか中で回っているのかは見分けにくい。",
        'This lesson looks again at the retry loop that keeps failing, from "Does it ever finish?", as the caller sees it. In a test it just shows up as a timeout, and it is hard to tell whether the system is stuck or looping inside.',
      ),
      t(
        "図では、まず start と fail が見えるままのジョブを見て、次に隠蔽のカードを通した後のジョブと比べる。検査器が τ だけの輪を見つける場面が分かれ目で、最後にリトライに上限を付けると輪が消えるかを確かめる。",
        "In the diagram, first look at the job with start and fail visible, then compare it with the job seen through the hiding card. The turning point is where the checker finds a loop of τ alone; finally, check whether a retry limit makes the loop go away.",
      ),
    ],
    facts: [
      {
        label: t("隠した後の状態", "States after hiding"),
        value: t(
          `${HIDDEN.stateCount}個・${HIDDEN.transitionCount}遷移`,
          `${HIDDEN.stateCount} states, ${HIDDEN.transitionCount} transitions`,
        ),
      },
      {
        label: t("τ だけの輪", "τ-only loop"),
        value: t(`${CYCLE_STATES}状態で1周`, `${CYCLE_STATES} states per lap`),
        tone: "bad",
      },
      {
        label: t(`上限${BOUNDED_RETRIES}回`, `Limit ${BOUNDED_RETRIES}`),
        value: t(
          `${BOUNDED.stateCount}状態で${BOUNDED_DIVERGENCE ? "発散あり" : "発散なし"}`,
          `${BOUNDED.stateCount} states, ${BOUNDED_DIVERGENCE ? "diverges" : "no divergence"}`,
        ),
        tone: "ok",
      },
      {
        label: t("実物の道具", "Real tools"),
        value: t("FDR の livelock free の表明", "FDR's livelock free assertion"),
      },
      {
        label: t("参考文献", "Reference"),
        value: t(
          `${CSP_BOOK} 6.4節（失敗発散方式）・7.1.2節（ライブロックフリー性）`,
          `${CSP_BOOK_EN}, sections 6.4 (failures-divergences model) and 7.1.2 (livelock freedom)`,
        ),
      },
    ],
    actors: [
      {
        id: "caller",
        label: t("呼び出し側", "Caller"),
        sublabel: t("結果を待つ", "waits for a result"),
        icon: "person",
        x: 14,
        y: 50,
        initial: { rows: { [t("見える", "sees")]: t("まだ何も", "nothing yet") } },
      },
      {
        id: "hide",
        label: t("隠蔽", "Hiding"),
        sublabel: `\\ {${HIDDEN_EVENTS.join(", ")}}`,
        icon: "visited",
        x: 38,
        y: 50,
        initial: { isHidden: true },
      },
      {
        id: "job",
        label: "Job",
        sublabel: t("リトライするジョブ", "a retrying job"),
        icon: "job",
        x: 62,
        y: 50,
        initial: { rows: { [t("リトライ", "retries")]: t("無制限", "unlimited") } },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("τ だけの輪を探す", "looks for τ-only loops"),
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
        title: t("ジョブをプロセスで書く", "Write the job as a process"),
        actor: "job",
        summary: t(
          "start の後、succeed で終わるか、fail でやり直す",
          "After start, it ends with succeed or starts over with fail",
        ),
        explain: t(
          "ジョブは start で動き出し、succeed（成功）なら終わり、fail（失敗）なら最初からやり直す。どちらになるかは外から選ばれる（外部選択 □）。リトライの回数に上限は無い。",
          "The job starts with start; on succeed it ends, on fail it starts over. Which one happens is chosen from outside (external choice □). There is no limit on retries.",
        ),
        set: {
          job: {
            rows: {
              [t("動き", "behaviour")]: t("start の後に成否", "start, then outcome"),
            },
          },
        },
        detail: [
          {
            title: t("このサイトのモデル", "This site's model"),
            fields: [
              {
                label: "Job",
                value: "start → (succeed → SKIP □ fail → Job)",
                isCode: true,
              },
            ],
          },
        ],
        simplified: t(
          "式はこのサイトのモデル（cspModels.ts）に合わせた短い書き方で、実物の CSPM（FDR の記法）とは書き方が違う。SKIP は正しく終わる（✓ を出す）プロセス。",
          "The expression is a short form matching this site's model (cspModels.ts) and differs from real CSPM (the notation used by FDR). SKIP is the process that terminates properly (performs ✓).",
        ),
      },
      {
        id: "visible",
        kind: "run",
        title: t("見えるままなら", "If everything stays visible"),
        actor: "job",
        to: ["caller"],
        summary: t(
          `${VISIBLE.stateCount}状態・${VISIBLE.transitionCount}遷移、発散${VISIBLE_DIVERGENCE ? "あり" : "なし"}`,
          `${VISIBLE.stateCount} states, ${VISIBLE.transitionCount} transitions, ${VISIBLE_DIVERGENCE ? "diverges" : "no divergence"}`,
        ),
        explain: t(
          `start と fail が見えるままなら、やり直すたびに呼び出し側にもイベントが届く。何かが起きていると外から分かり、応じるのをやめれば止められるので、これは発散ではない。検査器でも${VISIBLE.stateCount}状態の中に発散は${VISIBLE_DIVERGENCE ? "ある" : "無い"}。`,
          `While start and fail are visible, each retry also reaches the caller as an event. The outside can see that something is happening and can stop it by not taking part, so this is not divergence. The checker agrees: the ${VISIBLE.stateCount} states ${VISIBLE_DIVERGENCE ? "do" : "do not"} diverge.`,
        ),
        set: {
          caller: {
            tone: "ok",
            rows: { [t("見える", "sees")]: list(visibleEvents(VISIBLE)) },
          },
          job: { tone: "ok" },
        },
      },
      {
        id: "hide",
        kind: "spec",
        title: t("start と fail を隠す", "Hide start and fail"),
        actor: "hide",
        to: ["caller"],
        summary: t(
          `\\ {${HIDDEN_EVENTS.join(", ")}} で、呼び出し側には成功だけが見える`,
          `With \\ {${HIDDEN_EVENTS.join(", ")}}, the caller sees only success`,
        ),
        explain: t(
          `呼び出し側に「成功したか」だけを見せたいので、start と fail を隠す（隠蔽 \\）。隠したイベントは外から見えない動き τ（タウ）に変わり、外の同意なしに勝手に起きる。外から見えるのは ${HIDDEN_VISIBLE_EVENTS.join(" と ")} だけになる。`,
          `We want the caller to see only whether it succeeded, so start and fail are hidden (hiding \\). Hidden events become τ (tau), invisible moves that happen on their own without the outside agreeing. Only ${HIDDEN_VISIBLE_EVENTS.join(" and ")} remains visible.`,
        ),
        set: {
          hide: { isHidden: false, tone: "wait" },
          caller: {
            tone: "idle",
            rows: { [t("見える", "sees")]: list(HIDDEN_VISIBLE_EVENTS) },
          },
        },
        simplified: t(
          "✓ は正しく終わった合図。τ にはならず、隠しても見える。",
          "✓ is the signal of proper termination. It does not become τ and stays visible even when hiding.",
        ),
      },
      {
        id: "explore",
        kind: "explore",
        title: t("τ だけの輪を探す", "Look for a τ-only loop"),
        actor: "checker",
        to: ["job"],
        summary: t(
          `${HIDDEN.stateCount}状態・${HIDDEN.transitionCount}遷移のうち、τ は${HIDDEN_TAU_COUNT}本`,
          `Of ${HIDDEN.stateCount} states and ${HIDDEN.transitionCount} transitions, ${HIDDEN_TAU_COUNT} are τ`,
        ),
        explain: t(
          `検査器は隠した後の全体をたどり、τ の遷移だけでぐるりと戻れる輪を探す。そうした輪があると、外から何も起きないまま中で動き続けられる。これを発散（ライブロック）と呼ぶ。`,
          `The checker walks the whole system after hiding and looks for a loop that comes back using τ transitions only. With such a loop, the inside can keep moving while nothing happens outside. This is called divergence (livelock).`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: "wait",
            rows: {
              [t("状態", "states")]: t(
                `${HIDDEN.stateCount}個`,
                `${HIDDEN.stateCount}`,
              ),
              [t("遷移", "transitions")]: t(
                `${HIDDEN.transitionCount}本`,
                `${HIDDEN.transitionCount}`,
              ),
              τ: t(`${HIDDEN_TAU_COUNT}本`, `${HIDDEN_TAU_COUNT}`),
            },
          },
        },
        simplified: t(
          "このサイトの小さな実装（csp.ts）で τ の輪を深さ優先で探している。同じモデルを ProB にかけると、隠した無制限のジョブだけが発散し、見えるままのジョブと上限付きのジョブは発散しないことが一致した（リポジトリの specs/csp）。",
          "This site's small implementation (csp.ts) searches for τ loops depth-first. Running the same model through ProB agreed: only the hidden unlimited job diverges, while the visible job and the limited job do not (specs/csp in the repository).",
        ),
      },
      {
        id: "diverge",
        kind: "found",
        title: t("見えない輪が見つかる", "An invisible loop is found"),
        actor: "checker",
        to: ["job", "caller"],
        summary: t(
          `${DIVERGENCE.trace.length > 0 ? `${traceText(DIVERGENCE.trace, language)} の後、` : "何も見えないうちから、"}${CYCLE_STATES}状態の τ の輪で回り続けられる`,
          `${DIVERGENCE.trace.length > 0 ? `After ${traceText(DIVERGENCE.trace, language)}, it` : "Before anything is visible, it"} can loop forever in a τ loop of ${CYCLE_STATES} states`,
        ),
        explain: t(
          `start（τ）→ fail（τ）→ start（τ）… と、失敗し続ける限り τ だけで回る。呼び出し側からは何も起きていないように見え、待ち続けるしかない。サイトの「いつか必ず終わるか」で見た、リトライが終わらない輪を、外から見て何も起きない形で捉えたもの。`,
          `start (τ) → fail (τ) → start (τ) …: as long as it keeps failing, it loops on τ alone. To the caller nothing seems to happen, and all it can do is wait. This is the never-ending retry loop from "Does it ever finish?", captured as nothing happening from outside.`,
        ),
        set: {
          job: {
            tone: "bad",
            rows: { [t("中で", "inside")]: t("τ をくり返す", "repeats τ") },
          },
          hide: { tone: "bad" },
          caller: {
            tone: "bad",
            rows: { [t("見える", "sees")]: t("何も起きない", "nothing happens") },
          },
          checker: {
            tone: "bad",
            rows: {
              [t("発散", "divergence")]: t(
                `${CYCLE_STATES}状態の輪`,
                `loop of ${CYCLE_STATES} states`,
              ),
            },
          },
        },
        detail: [
          {
            title: t(
              "検査器が返した輪（状態の鍵）",
              "Loop the checker returned (state keys)",
            ),
            fields: [
              {
                label: t("入るまで", "Before the loop"),
                value: traceText(DIVERGENCE.trace, language),
              },
              ...DIVERGENCE.cycle.map((key, index) => ({
                label: `${index + 1}`,
                value: key,
                isCode: true,
              })),
            ],
          },
        ],
        simplified: t(
          "毎回 succeed を選べばジョブは終わる。ここで反例になるのは「回り続ける実行がありうる」こと。サイトの活性のレッスンと同じく公平性（いつか成功を選ぶという仮定）は置いていない。FDR では livelock free の表明で調べ、失敗発散方式では発散した後のふるまいを「何でも起こりうる」とみなす。",
          'If succeed is chosen, the job ends. The counterexample here is that a run that loops forever is possible. As in the site\'s liveness lesson, no fairness (an assumption that success is eventually chosen) is assumed. FDR checks this with a livelock free assertion, and the failures-divergences model treats behaviour after divergence as "anything can happen".',
        ),
      },
      {
        id: "bound",
        kind: "fix",
        title: t(
          `上限${BOUNDED_RETRIES}回にする`,
          `Limit retries to ${BOUNDED_RETRIES}`,
        ),
        actor: "checker",
        to: ["job"],
        summary: t(
          `上限付きなら${BOUNDED.stateCount}状態で発散${BOUNDED_DIVERGENCE ? "あり" : "なし"}`,
          `With a limit, ${BOUNDED.stateCount} states and ${BOUNDED_DIVERGENCE ? "divergence" : "no divergence"}`,
        ),
        explain: t(
          `リトライを${BOUNDED_RETRIES}回までにし、使い切ったら giveup（断念）で終わるように直す。fail の先がいつか尽きるので τ の輪は作れず、隠しても${BOUNDED.stateCount}状態のどこにも発散は${BOUNDED_DIVERGENCE ? "残った" : "無い"}。`,
          `Allow at most ${BOUNDED_RETRIES} retries and end with giveup (give up) when they run out. The fail branches eventually run out, so no τ loop can form, and even with hiding ${BOUNDED_DIVERGENCE ? "divergence remains" : "there is no divergence"} in any of the ${BOUNDED.stateCount} states.`,
        ),
        set: {
          job: {
            tone: "ok",
            rows: {
              [t("リトライ", "retries")]: t(
                `${BOUNDED_RETRIES}回まで`,
                `up to ${BOUNDED_RETRIES}`,
              ),
              [t("中で", "inside")]: null,
            },
          },
          hide: { tone: "ok" },
          caller: {
            tone: "ok",
            rows: { [t("見える", "sees")]: list(visibleEvents(BOUNDED)) },
          },
          checker: {
            tone: "ok",
            rows: {
              [t("状態", "states")]: t(
                `${BOUNDED.stateCount}個`,
                `${BOUNDED.stateCount}`,
              ),
              [t("遷移", "transitions")]: t(
                `${BOUNDED.transitionCount}本`,
                `${BOUNDED.transitionCount}`,
              ),
              τ: null,
              [t("発散", "divergence")]: BOUNDED_DIVERGENCE
                ? t("あり", "yes")
                : t("なし", "none"),
            },
          },
        },
      },
    ],
    lab: {
      title: t("上限と隠すかを変える", "Change the limit and hiding"),
      hint: t(
        `上限は0〜${MAX_RETRIES}。空欄か「なし」なら無制限。隠すは「はい / いいえ」。`,
        `Limit: 0-${MAX_RETRIES}. Blank or "none" means unlimited. Hide: "yes / no".`,
      ),
      inputs: [
        {
          id: "retries",
          label: t(
            `リトライの上限（0〜${MAX_RETRIES}、空欄でなし）`,
            `Retry limit (0-${MAX_RETRIES}, blank for none)`,
          ),
          initial: t("なし", "none"),
        },
        {
          id: "hidden",
          label: t(
            "start と fail を隠す（はい / いいえ）",
            "Hide start and fail (yes / no)",
          ),
          initial: t("はい", "yes"),
        },
      ],
      compute: (values): Field[] => {
        const retries = parseRetries(values.retries);
        const isHidden = parseHidden(values.hidden);
        const system = jobSystem(retries, isHidden);
        const lts = explore(system, JOB_ENV);
        const found = divergence(system, JOB_ENV);
        const fields: Field[] = [
          {
            label: t("上限", "Limit"),
            value:
              retries === null
                ? t("なし（無制限）", "none (unlimited)")
                : t(`${retries}回`, `${retries}`),
          },
          {
            label: t("隠す", "Hide"),
            value: isHidden ? t("はい", "yes") : t("いいえ", "no"),
          },
          {
            label: t("状態", "States"),
            value: t(`${lts.stateCount}個`, `${lts.stateCount}`),
          },
          {
            label: t("遷移", "Transitions"),
            value: t(`${lts.transitionCount}本`, `${lts.transitionCount}`),
          },
          {
            label: t("発散", "Divergence"),
            value: found
              ? t(
                  `あり（${new Set(found.cycle).size}状態の輪）`,
                  `yes (loop of ${new Set(found.cycle).size} states)`,
                )
              : t("なし", "none"),
            tone: found ? "bad" : "ok",
          },
        ];
        if (found) {
          fields.push(
            ...found.cycle.map((key, index) => ({
              label: t(`輪${index + 1}`, `Loop ${index + 1}`),
              value: key,
              isCode: true,
            })),
          );
        }
        return fields;
      },
    },
  };
}
