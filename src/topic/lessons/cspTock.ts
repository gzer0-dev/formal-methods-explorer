import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import { traceTo } from "../csp";
import {
  checkDeadline,
  checkTimeProgress,
  checkTimeProgressEager,
  NO_TOCK_LIMIT,
  server,
  TOCK_ENV,
} from "../cspTock";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

// 期限は「依頼から3 tock 以内に応答」。間に合うサーバー・遅いサーバー・時間を止めるサーバー・tock を挟まないサーバーを比べる。
const DEADLINE = 3;
const ON_TIME_DELAY = 2;
const SLOW_DELAY = 4;
const STUCK_LIMIT = 3;

const ON_TIME = server(ON_TIME_DELAY);
const ON_TIME_RUN = traceTo(ON_TIME, TOCK_ENV, "reply")!;
const ON_TIME_CHECK = checkDeadline(DEADLINE, ON_TIME);
const SLOW_CHECK = checkDeadline(DEADLINE, server(SLOW_DELAY));
const SLOW_TRACE = SLOW_CHECK.counterexample ?? [];
const STUCK = server(SLOW_DELAY, STUCK_LIMIT);
const STUCK_CHECK = checkDeadline(DEADLINE, STUCK);
const STUCK_REPLY = traceTo(STUCK, TOCK_ENV, "reply");
const STUCK_PROGRESS = checkTimeProgress(STUCK);
const ON_TIME_PROGRESS = checkTimeProgress(ON_TIME);
// 0 tock のサーバーは、request を遅らせてよい検査（主の検査）では時間を止めない。request まで急がせると発散する。
const ZENO_PROGRESS = checkTimeProgress(server(0));
const ZENO_EAGER = checkTimeProgressEager(server(0));

const STUCK_FAILURE = STUCK_PROGRESS.counterexample;
const tockCount = (trace: string[]) => trace.filter((event) => event === "tock").length;

function listText(events: string[], language: Language): string {
  if (events.length === 0) return language === "ja" ? "⟨⟩（空）" : "⟨⟩ (empty)";
  return `⟨${events.join(", ")}⟩`;
}

function parseCount(text: string | undefined, fallback: number): number {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, 0), 6);
}

/** 時間を止める上限の欄。数でなければ「上限なし」（正しく tock を続ける）。 */
function parseLimit(text: string | undefined): number {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return NO_TOCK_LIMIT;
  return Math.min(Math.max(value, 0), 6);
}

export function cspTockLesson(language: Language): Lesson {
  const t = translator(language);
  const holdsText = (holds: boolean) =>
    holds ? t("成り立つ", "holds") : t("成り立たない", "fails");
  const progressText = (result: ReturnType<typeof checkTimeProgress>) => {
    const counterexample = result.counterexample;
    if (!counterexample) return t("時間は進み続ける", "time keeps passing");
    return t(
      `${listText(counterexample.trace, language)} の後に tock を断る（時間が止まる）`,
      `refuses tock after ${listText(counterexample.trace, language)} (time stops)`,
    );
  };
  const eagerText = (result: ReturnType<typeof checkTimeProgressEager>) => {
    const counterexample = result.counterexample;
    if (!counterexample) return t("時間は進み続ける", "time keeps passing");
    if (counterexample.kind === "divergence" && counterexample.trace.length === 0)
      return t(
        "初めから tock の無い輪を回れる（発散）",
        "it can loop with no tock from the start (divergence)",
      );
    if (counterexample.kind === "divergence")
      return t(
        `${listText(counterexample.trace, language)} の後に、tock の無い輪（発散）`,
        `a loop with no tock (divergence) after ${listText(counterexample.trace, language)}`,
      );
    if (counterexample.kind === "failure")
      return t(
        `${listText(counterexample.trace, language)} の後に tock を断る（時間が止まる）`,
        `refuses tock after ${listText(counterexample.trace, language)} (time stops)`,
      );
    return t(
      `${listText(counterexample.trace, language)} は TICKING に無い`,
      `${listText(counterexample.trace, language)} is not in TICKING`,
    );
  };
  const delayRow = t("応答まで", "reply after");
  const tockText = (count: number) => t(`${count} tock`, `${count} tock`);
  return {
    id: "csp-tock",
    category: "protocol",
    title: t("時間を tock で数える", "Counting time with tock"),
    subtitle: t(
      "「3 tock 以内に応答」を詳細化で確かめる",
      'Check "reply within 3 tocks" by refinement',
    ),
    summary: t(
      `時間の1刻みを、全員が同期するイベント tock で表す。仕様「依頼から${DEADLINE} tock 以内に応答」は、${ON_TIME_DELAY} tock で応答するサーバーでは${holdsText(ON_TIME_CHECK.holds)}。${SLOW_DELAY} tock かかるサーバーは ${listText(SLOW_TRACE, language)} で破る。時間を止めてしまうモデルは期限の仕様を空虚に満たすので、tock 以外を隠して TICKING と比べる検査を別に回す。`,
      `One unit of time is the event tock, which everyone synchronises on. The spec "reply within ${DEADLINE} tocks of a request" ${holdsText(ON_TIME_CHECK.holds)} for a server that replies after ${ON_TIME_DELAY} tocks, and a server that takes ${SLOW_DELAY} breaks it with ${listText(SLOW_TRACE, language)}. A model that stops time satisfies the deadline spec vacuously, so a separate check hides everything but tock and compares with TICKING.`,
    ),
    intro: [
      t(
        "CSP には時計が無い。そこで、時間が1刻み進むことを tock という普通のイベントで表し、時間に関わる全員が tock で同期する。こうすると「依頼から3刻み以内に応答する」のような時間の制約も、tock の数を数えるトレースの仕様として書け、これまでと同じ詳細化で調べられる。",
        'CSP has no clock. Instead, one unit of time passing is written as an ordinary event, tock, and everything involved in timing synchronises on it. Then a timing requirement such as "reply within three units of a request" can be written as a trace spec that counts tocks, and checked with the same refinement as before.',
      ),
      t(
        "テストで期限を確かめるときは、実際の時計で待つので、遅い組み合わせが起きるまで待てない。tock で数えたモデルなら、検査器が「どの時点で何が起きるか」の並びを全部たどり、期限を破る最短の並びを示せる。ただし、時間そのものが止まるモデル（tock を断ったまま動かない）は、期限を破る前に時間が進まなくなるので、期限の仕様を空虚に満たしてしまう。",
        "When a test checks a deadline it waits on a real clock, so it cannot wait for every slow interleaving to happen. With a model that counts tocks, the checker walks every ordering of what happens at which tick and shows the shortest one that misses the deadline. But a model in which time itself stops (it refuses tock and cannot move on) never reaches the point where the deadline is missed, so it satisfies the deadline spec vacuously.",
      ),
      t(
        "図では、上の段のサーバーと時計のカードで、依頼の後に tock を何回数えたかを追う。後半は、下の段の検査器が期限の仕様と「時間が進み続けるか」の2つを別々に調べ、どちらで誤りが見つかるかを比べる。",
        "In the diagram, follow on the server and clock cards in the top row how many tocks have been counted since the request. In the second half, the checker in the bottom row runs two separate checks, the deadline spec and whether time keeps passing, and you compare which one finds each mistake.",
      ),
    ],
    facts: [
      {
        label: t(`${ON_TIME_DELAY} tock のサーバー`, `${ON_TIME_DELAY}-tock server`),
        value: t(
          `期限 ${holdsText(ON_TIME_CHECK.holds)}・時間 ${holdsText(ON_TIME_PROGRESS.holds)}`,
          `deadline ${holdsText(ON_TIME_CHECK.holds)}, time ${holdsText(ON_TIME_PROGRESS.holds)}`,
        ),
        tone: ON_TIME_CHECK.holds && ON_TIME_PROGRESS.holds ? "ok" : "bad",
      },
      {
        label: t(`${SLOW_DELAY} tock のサーバー`, `${SLOW_DELAY}-tock server`),
        value: t(
          `期限を ${listText(SLOW_TRACE, language)} で破る`,
          `misses the deadline with ${listText(SLOW_TRACE, language)}`,
        ),
        tone: SLOW_CHECK.holds ? "ok" : "bad",
      },
      {
        label: t("時間を止めるサーバー", "Time-stopping server"),
        value: t(
          `期限は${holdsText(STUCK_CHECK.holds)}が、${progressText(STUCK_PROGRESS)}`,
          `deadline ${holdsText(STUCK_CHECK.holds)}, but ${progressText(STUCK_PROGRESS)}`,
        ),
        tone: STUCK_PROGRESS.holds ? "ok" : "bad",
      },
      {
        label: t("参考", "Reference"),
        value: t(
          `${TPC_BOOK} 第14章（主に14.2節）`,
          `${TPC_BOOK_EN}, chapter 14 (mainly §14.2)`,
        ),
      },
    ],
    actors: [
      {
        id: "client",
        label: t("依頼する側", "Client"),
        sublabel: t("request を送る", "sends request"),
        icon: "person",
        x: 20,
        y: 27,
      },
      {
        id: "server",
        label: t("サーバー", "Server"),
        sublabel: t("request に reply", "replies to request"),
        icon: "server",
        x: 50,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "clock",
        label: t("時計", "Clock"),
        sublabel: t("tock で1刻み", "one tick per tock"),
        icon: "gear",
        x: 80,
        y: 27,
      },
      {
        id: "spec",
        label: t("仕様", "Spec"),
        sublabel: t(`${DEADLINE} tock 以内に応答`, `reply within ${DEADLINE} tocks`),
        icon: "spec",
        x: 30,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "checker",
        label: t("検査器", "Checker"),
        sublabel: t("詳細化を調べる", "checks refinement"),
        icon: "checker",
        x: 70,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "client", to: "server" },
      { from: "server", to: "clock" },
      { from: "spec", to: "checker" },
    ],
    steps: [
      {
        id: "tock",
        kind: "spec",
        title: t("1刻み＝tock", "One tick = tock"),
        actor: "clock",
        to: ["client"],
        summary: t(
          "時間が1刻み進むことを、全員が同期するイベント tock で表す",
          "One tick of time passing is the event tock, which everyone synchronises on",
        ),
        explain: t(
          "いくつものプロセスを並べるときは、時間に関わるプロセスがどれも tock を自分のイベントに含め、並行合成で tock に同期させる。そうすると tock は全員がそろって1回ずつ起き、時計の針がそろって進む。待っているだけの間は、tock を受け付け続ける。",
          "When several processes are composed, every process involved in timing includes tock among its events and synchronises on it in parallel composition. Then each tock happens once for everyone together, and all the clocks move in step. While a process only waits, it keeps accepting tock.",
        ),
        set: {
          clock: { tone: "wait", rows: { [t("数えた tock", "tocks counted")]: "0" } },
        },
        simplified: t(
          "このレッスンのモデルはサーバーのプロセス1つだけで、request・tock・reply をすべてサーバーが持つ。依頼する側と時計は、図で見せるための役で、別のプロセスとして並行合成してはいない。",
          "The model in this lesson is a single server process that owns request, tock and reply. The client and the clock are roles drawn in the diagram; they are not separate processes in a parallel composition.",
        ),
      },
      {
        id: "deadline",
        kind: "spec",
        title: t("期限を仕様にする", "Write the deadline"),
        actor: "spec",
        summary: t(
          `依頼の後、応答の前に来てよい tock は${DEADLINE}回まで`,
          `Between request and reply, at most ${DEADLINE} tocks may happen`,
        ),
        explain: t(
          `仕様は、依頼を受けてから tock を数え、${DEADLINE}回目までは応答と tock のどちらも起こせる。${DEADLINE}回数えた後は応答しか起こせないので、${DEADLINE + 1}回目の tock は仕様に無いトレースになる。これでトレース詳細化 ⊑T を使って期限を調べられる。`,
          `The spec counts tocks after a request; until it has counted ${DEADLINE} it can do either reply or tock. After counting ${DEADLINE} it can only reply, so tock number ${DEADLINE + 1} gives a trace the spec does not have. This lets trace refinement ⊑T check the deadline.`,
        ),
        set: {
          spec: {
            isHidden: false,
            rows: {
              [t("期限", "deadline")]: tockText(DEADLINE),
              [t("比べ方", "check")]: "⊑T",
            },
          },
        },
      },
      {
        id: "on-time",
        kind: "run",
        title: t(`${ON_TIME_DELAY} tock で応答`, `Reply after ${ON_TIME_DELAY}`),
        actor: "server",
        to: ["client"],
        summary: t(
          `${listText(ON_TIME_RUN, language)}: 依頼の後に${tockCount(ON_TIME_RUN)}回数えて応答する`,
          `${listText(ON_TIME_RUN, language)}: after the request it counts ${tockCount(ON_TIME_RUN)} and replies`,
        ),
        explain: t(
          `サーバーは依頼を受けると作業に入り、${ON_TIME_DELAY} tock 後に応答する。応答はサーバー自身の出力なので、作業が終わったら次の tock より先に出す（ここでは応答の前に tock を書かないことで表した）。`,
          `On a request the server starts work and replies ${ON_TIME_DELAY} tocks later. The reply is the server's own output, so once the work is done it goes out before the next tock (here this is expressed by not offering tock before the reply).`,
        ),
        set: {
          server: {
            isHidden: false,
            tone: "ok",
            rows: { [delayRow]: tockText(ON_TIME_DELAY) },
          },
          client: { tone: "ok", rows: { [t("受け取った", "received")]: "reply" } },
          clock: {
            tone: "idle",
            rows: {
              [t("数えた tock", "tocks counted")]: String(tockCount(ON_TIME_RUN)),
            },
          },
        },
      },
      {
        id: "meets",
        kind: "fix",
        title: t("期限を守る", "Meets the deadline"),
        actor: "checker",
        to: ["spec"],
        summary: t(
          `${ON_TIME_DELAY} tock のサーバーでは、期限の仕様との ⊑T が${holdsText(ON_TIME_CHECK.holds)}`,
          `For the ${ON_TIME_DELAY}-tock server, ⊑T against the deadline spec ${holdsText(ON_TIME_CHECK.holds)}`,
        ),
        explain: t(
          `検査器は、依頼と tock と応答の起こりうる並びを全部たどり、仕様に無い並びが無いかを調べる。どの並びでも依頼から${ON_TIME_DELAY}回目の tock の後に応答が来るので、${DEADLINE + 1}回目の tock は起きない。`,
          `The checker walks every possible ordering of requests, tocks and replies, looking for one the spec does not have. In every ordering the reply comes once ${ON_TIME_DELAY} tocks have followed the request, so tock number ${DEADLINE + 1} never happens.`,
        ),
        set: {
          checker: {
            isHidden: false,
            tone: ON_TIME_CHECK.holds ? "ok" : "bad",
            rows: {
              [delayRow]: tockText(ON_TIME_DELAY),
              [t("期限 ⊑T", "deadline ⊑T")]: holdsText(ON_TIME_CHECK.holds),
            },
          },
        },
      },
      {
        id: "slow",
        kind: "found",
        title: t("遅いと期限を破る", "Slow misses it"),
        actor: "checker",
        to: ["spec"],
        summary: t(
          `${SLOW_DELAY} tock かかるサーバーは ${listText(SLOW_TRACE, language)} で仕様を破る`,
          `A server taking ${SLOW_DELAY} tocks breaks the spec with ${listText(SLOW_TRACE, language)}`,
        ),
        explain: t(
          `作業に${SLOW_DELAY} tock かかると、依頼の後に${tockCount(SLOW_TRACE)}回目の tock が来ても、まだ応答していない。仕様は${DEADLINE}回数えた後は tock を起こせないので、これが最短の反例になる。テストで同じことを見るには、本当に${SLOW_DELAY}刻み待たなければならない。`,
          `If the work takes ${SLOW_DELAY} tocks, there is still no reply when tock number ${tockCount(SLOW_TRACE)} after the request arrives. The spec cannot do tock after counting ${DEADLINE}, so this is the shortest counterexample. To see the same in a test, you would really have to wait ${SLOW_DELAY} ticks.`,
        ),
        set: {
          server: { tone: "bad", rows: { [delayRow]: tockText(SLOW_DELAY) } },
          client: {
            tone: "wait",
            rows: { [t("受け取った", "received")]: t("まだ", "not yet") },
          },
          clock: {
            tone: "bad",
            rows: {
              [t("数えた tock", "tocks counted")]: String(tockCount(SLOW_TRACE)),
            },
          },
          checker: {
            tone: SLOW_CHECK.holds ? "ok" : "bad",
            rows: {
              [delayRow]: tockText(SLOW_DELAY),
              [t("期限 ⊑T", "deadline ⊑T")]: holdsText(SLOW_CHECK.holds),
            },
          },
        },
      },
      {
        id: "stuck",
        kind: "explore",
        title: t("時間を止める誤り", "A model that stops time"),
        actor: "server",
        to: ["clock"],
        summary: t(
          `${STUCK_LIMIT}回数えた所で tock を書き忘れたサーバーは、応答しないのに期限の仕様との ⊑T が${holdsText(STUCK_CHECK.holds)}`,
          `A server that forgets tock after counting ${STUCK_LIMIT} never replies, yet ⊑T against the deadline spec ${holdsText(STUCK_CHECK.holds)}`,
        ),
        explain: t(
          `作業に${SLOW_DELAY} tock かかるのに、作業中の tock を「${STUCK_LIMIT}回まで」と書いてしまった版。${STUCK_LIMIT}回数えると、応答もできず tock も受け付けない。時間が止まるので${DEADLINE + 1}回目の tock は永久に来ず、期限の仕様は空虚に満たされる。応答に${STUCK_REPLY === null ? "着く並びは無い" : "着く並びはある"}。`,
          `This version needs ${SLOW_DELAY} tocks of work, but tock during work was written as "at most ${STUCK_LIMIT}". After counting ${STUCK_LIMIT} it can neither reply nor accept tock. Time stops, so tock number ${DEADLINE + 1} never comes and the deadline spec is satisfied vacuously. ${STUCK_REPLY === null ? "No ordering ever reaches a reply." : "Some ordering does reach a reply."}`,
        ),
        set: {
          server: {
            tone: "bad",
            rows: {
              [delayRow]: tockText(SLOW_DELAY),
              [t("tock を書いた", "tock written")]: t(
                `${STUCK_LIMIT}回まで`,
                `up to ${STUCK_LIMIT}`,
              ),
            },
          },
          clock: {
            tone: "bad",
            rows: {
              [t("数えた tock", "tocks counted")]: String(STUCK_LIMIT),
              [t("次の tock", "next tock")]: t("来ない", "never"),
            },
          },
          checker: {
            tone: STUCK_CHECK.holds ? "wait" : "bad",
            rows: {
              [delayRow]: tockText(SLOW_DELAY),
              [t("期限 ⊑T", "deadline ⊑T")]: holdsText(STUCK_CHECK.holds),
            },
          },
        },
      },
      {
        id: "progress",
        kind: "found",
        title: t("時間が進むか調べる", "Does time keep passing?"),
        actor: "checker",
        to: ["clock"],
        summary: t(
          `tock 以外を隠して TICKING と ⊑F で比べると、${progressText(STUCK_PROGRESS)}`,
          `Hide everything but tock and compare with TICKING by ⊑F: ${progressText(STUCK_PROGRESS)}`,
        ),
        explain: t(
          `TICKING は tock をずっと続けるだけのプロセス。request は依頼する側（環境）からの入力なので、環境はいつ送ってもよく、送らずに待たせてもよい。そこで request は Lazy 抽象化（起きてもよく、起きなくてもよい）で隠す。reply はサーバー自身の出力なので普通に隠す（いつまでも待たず、いつか起きる）。外から見えるのは tock だけになり、安定した状態で tock を断れば時間が止まったことになる。止まるサーバーは ${listText(STUCK_FAILURE?.trace ?? [], language)} の後に {${(STUCK_FAILURE?.refusal ?? []).join(", ")}} を断るので、この検査で捕まる。期限の検査とは別に回す必要がある。`,
          `TICKING is a process that only keeps doing tock. request is an input from the client (the environment), which may send it at any time or keep it waiting. So request is hidden by lazy abstraction (it may happen or not). reply is the server's own output, so it is hidden in the ordinary way (it does not wait for ever, it happens at some point). Only tock is left visible, and refusing tock in a stable state means time has stopped. The stopping server refuses {${(STUCK_FAILURE?.refusal ?? []).join(", ")}} after ${listText(STUCK_FAILURE?.trace ?? [], language)}, so this check catches it. It has to be run separately from the deadline check.`,
        ),
        set: {
          spec: {
            rows: {
              [t("期限", "deadline")]: null,
              [t("仕様", "spec")]: "TICKING",
              [t("比べ方", "check")]: t("⊑F（tock だけ）", "⊑F (tock only)"),
            },
          },
          checker: {
            tone: STUCK_PROGRESS.holds ? "ok" : "bad",
            rows: {
              [t("時間 ⊑F", "time ⊑F")]: holdsText(STUCK_PROGRESS.holds),
              [t(`${ON_TIME_DELAY} tock の版`, `${ON_TIME_DELAY}-tock version`)]:
                holdsText(ON_TIME_PROGRESS.holds),
            },
          },
        },
      },
      {
        id: "zeno",
        kind: "found",
        title: t("環境の前提で変わる", "It depends on the client"),
        actor: "checker",
        to: ["server"],
        summary: t(
          `0 tock で応答するサーバーは、request を遅らせてよい検査では${progressText(ZENO_PROGRESS)}が、request まで急がせて ⊑FD で比べると、${eagerText(ZENO_EAGER)}`,
          `For a server that replies after 0 tocks, the check that lets request wait gives: ${progressText(ZENO_PROGRESS)}; hiding request too and comparing by ⊑FD gives: ${eagerText(ZENO_EAGER)}`,
        ),
        explain: t(
          "request も reply と同じに普通に隠すと、「環境は request を待たずにいくらでも速く送れる」と仮定したことになる。0 tock のサーバーはその前提だと、tock を1回も挟まずに依頼と応答を繰り返せ、時間が進まないまま無限に動ける（発散）。これはサーバーの誤りではなく、環境の前提から来る。だから環境が遅らせてよい入力は、隠し方を分けて調べる。",
          'If request is hidden in the ordinary way like reply, we have assumed that "the environment sends request as fast as it likes, without waiting". Under that assumption a server that replies after 0 tocks can repeat request and reply without a single tock, moving forever while time does not pass (divergence). That is not a fault of the server; it comes from the assumption about the environment. So inputs the environment may delay are hidden differently when checked.',
        ),
        set: {
          server: {
            tone: "wait",
            rows: {
              [delayRow]: tockText(0),
              [t("tock を書いた", "tock written")]: null,
            },
          },
          client: {
            tone: "wait",
            rows: {
              [t("受け取った", "received")]: t(
                "reply を繰り返す",
                "reply, again and again",
              ),
            },
          },
          clock: {
            tone: "wait",
            rows: {
              [t("数えた tock", "tocks counted")]: "0",
              [t("次の tock", "next tock")]: null,
            },
          },
          checker: {
            tone: ZENO_PROGRESS.holds ? "wait" : "bad",
            rows: {
              [t("期限 ⊑T", "deadline ⊑T")]: null,
              [t(`${ON_TIME_DELAY} tock の版`, `${ON_TIME_DELAY}-tock version`)]: null,
              [delayRow]: tockText(0),
              [t("時間 ⊑F", "time ⊑F")]: holdsText(ZENO_PROGRESS.holds),
              [t("急がせて ⊑FD", "eager ⊑FD")]: holdsText(ZENO_EAGER.holds),
            },
          },
        },
        simplified: t(
          "τ を tock より先に起こす決まり（優先度）は csp.ts に無い。そのため、隠した後に τ と tock の両方ができる状態では、τ の前に tock が何度でも起きうる（そうした状態は安定していないので失敗も調べない）。応答を tock より先に出すことは、応答の前に tock を書かないことで手で表した。",
          "csp.ts has no rule that makes τ happen before tock (priority). So in a state that can do both τ and tock after hiding, tock may happen any number of times before the τ (such states are unstable, so their failures are not checked either). Sending the reply before any tock is expressed by hand, by not offering tock before it.",
        ),
      },
    ],
    lab: {
      title: t("作業の長さと期限を変える", "Change the work time and the deadline"),
      hint: t(
        "作業にかかる tock（0〜6）、期限（0〜6）、時間を止める tock の数（0〜6、数でなければ止めない）を入れる。期限は作業が期限以下なら成り立ち、止める数が作業より小さいと時間の検査が破れる。作業が0 tock だと、request まで急がせた検査だけが発散で破れる。",
        "Enter the work time in tocks (0-6), the deadline (0-6) and the tock count at which time stops (0-6; anything else means it never stops). The deadline holds when the work time is at most the deadline, and the time check fails when the stop count is below the work time. With 0 tocks of work, only the check that hurries request fails, by divergence.",
      ),
      inputs: [
        {
          id: "delay",
          label: t("作業の tock", "Work tocks"),
          initial: String(ON_TIME_DELAY),
        },
        {
          id: "deadline",
          label: t("期限の tock", "Deadline tocks"),
          initial: String(DEADLINE),
        },
        {
          id: "limit",
          label: t("時間を止める tock", "Stop time at"),
          initial: "-",
          samples: ["-", "0", "3", "6"],
        },
      ],
      compute: (values): Field[] => {
        const delay = parseCount(values.delay, ON_TIME_DELAY);
        const deadline = parseCount(values.deadline, DEADLINE);
        const limit = parseLimit(values.limit);
        const impl = server(delay, limit);
        const deadlineResult = checkDeadline(deadline, impl);
        const progress = checkTimeProgress(impl);
        const eager = checkTimeProgressEager(impl);
        const reply = traceTo(impl, TOCK_ENV, "reply");
        const fields: Field[] = [
          {
            label: t("期限 ⊑T", "Deadline ⊑T"),
            value: deadlineResult.counterexample
              ? t(
                  `成り立たない: ${listText(deadlineResult.counterexample, language)}`,
                  `fails: ${listText(deadlineResult.counterexample, language)}`,
                )
              : holdsText(true),
            tone: deadlineResult.holds ? "ok" : "bad",
          },
          {
            label: t("時間 ⊑F", "Time ⊑F"),
            value: progressText(progress),
            tone: progress.holds ? "ok" : "bad",
          },
          {
            label: t("急がせて ⊑FD", "Eager ⊑FD"),
            value: eagerText(eager),
            tone: eager.holds ? "ok" : "bad",
          },
          {
            label: t("応答まで", "To a reply"),
            value: reply
              ? listText(reply, language)
              : t("応答に着く並びは無い", "no ordering reaches a reply"),
            tone: reply ? "ok" : "bad",
          },
        ];
        return fields;
      },
    },
  };
}
