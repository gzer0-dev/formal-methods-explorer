import { translator, type Language } from "../../core/i18n";
import type { Field, Lesson } from "../../core/types";
import {
  findDeadlock,
  localAnalysis,
  type LocalAnalysis,
  type Network,
  NETWORKS,
  networkStateCount,
  ringNetwork,
  ungrantedRequestsAt,
  withoutComponent,
} from "../cspDeadlockRules";
import { TPC_BOOK, TPC_BOOK_EN } from "../references";

// 比べる5つのネットワークと、係を外した部分ネットワーク。全体の検査と局所の判定は、ここで1回だけ計算する。
const TREE = NETWORKS.tree;
const TREE_LOCAL = localAnalysis(TREE);
const TREE_DEADLOCK = findDeadlock(TREE);
const TREE_STATES = networkStateCount(TREE);

const NOTIFY = NETWORKS.treeNotify;
const NOTIFY_LOCAL = localAnalysis(NOTIFY);
const NOTIFY_DEADLOCK = findDeadlock(NOTIFY);
const NOTIFY_CONFLICT = NOTIFY_LOCAL.pairs.find((pair) => pair.hasStrongConflict);

const RING = NETWORKS.ring;
const RING_LOCAL = localAnalysis(RING);
const RING_DEADLOCK = findDeadlock(RING);
const RING_CYCLE = RING_DEADLOCK ? ungrantedRequestsAt(RING, RING_DEADLOCK.states) : [];

const ORDERED = NETWORKS.ringOrdered;
const ORDERED_LOCAL = localAnalysis(ORDERED);
const ORDERED_DEADLOCK = findDeadlock(ORDERED);
const ORDERED_STATES = networkStateCount(ORDERED);

const TICKETS = NETWORKS.ringTickets;
const TICKETS_LOCAL = localAnalysis(TICKETS);
const TICKETS_DEADLOCK = findDeadlock(TICKETS);
const TICKETS_STATES = networkStateCount(TICKETS);
const KEEPER_NAME = "K";
const WITHOUT_KEEPER = withoutComponent(TICKETS, KEEPER_NAME);
const WITHOUT_KEEPER_DEADLOCK = findDeadlock(WITHOUT_KEEPER);

const conflictCount = (local: LocalAnalysis) =>
  local.pairs.filter((pair) => pair.hasConflict).length;
const maxPairStates = (local: LocalAnalysis) =>
  Math.max(...local.pairs.map((pair) => pair.stateCount));

/** 受け付けられない依頼の向きを、A から順にたどって輪の形に並べる（A→Y→B→…→A）。 */
function cycleText(requests: [string, string][]): string {
  const next = new Map(requests);
  const start = requests.find(([from]) => from === "A")?.[0] ?? requests[0]?.[0];
  if (!start) return "";
  const path = [start];
  let cursor = next.get(start);
  while (cursor && cursor !== start && path.length <= requests.length) {
    path.push(cursor);
    cursor = next.get(cursor);
  }
  return [...path, start].join("→");
}

const RING_CYCLE_TEXT = cycleText(RING_CYCLE);
const RING_STATES = networkStateCount(RING);
const NOTIFY_STATES = networkStateCount(NOTIFY);
const WITHOUT_KEEPER_STATES = networkStateCount(WITHOUT_KEEPER);
const WITHOUT_KEEPER_CYCLE_TEXT = WITHOUT_KEEPER_DEADLOCK
  ? cycleText(ungrantedRequestsAt(WITHOUT_KEEPER, WITHOUT_KEEPER_DEADLOCK.states))
  : "";

function parseChoice(text: string | undefined, fallback: number, max: number): number {
  const value = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, 0), max);
}

export function cspDeadlockRulesLesson(language: Language): Lesson {
  const t = translator(language);
  const listText = (events: string[]) =>
    events.length === 0 ? t("⟨⟩（空）", "⟨⟩ (empty)") : `⟨${events.join(", ")}⟩`;
  const deadlockText = (trace: string[] | undefined) =>
    trace
      ? t(`${trace.length}手で止まる`, `stops after ${trace.length} steps`)
      : t("止まらない", "never stops");
  const provedText = (local: LocalAnalysis) => {
    if (local.provedBy === "tree")
      return t("木の規則で言える", "proved by the tree rule");
    if (local.provedBy === "order")
      return t("順序の規則で言える", "proved by the order rule");
    return t("どの規則も当てはまらない", "no rule applies");
  };
  const shapeText = (local: LocalAnalysis) =>
    local.isTree
      ? t("木（輪が無い）", "tree (no cycle)")
      : t("輪がある", "has a cycle");
  const pairsText = (local: LocalAnalysis) =>
    conflictCount(local) === 0
      ? t(
          `${local.pairs.length}組とも衝突なし`,
          `none of ${local.pairs.length} pairs conflict`,
        )
      : t(
          `${local.pairs.length}組中${conflictCount(local)}組が衝突`,
          `${conflictCount(local)} of ${local.pairs.length} pairs conflict`,
        );
  const rowLocal = t("衝突した組", "conflicting pairs");
  const rowShape = t("図の形", "graph shape");
  const rowVerdict = t("結論", "verdict");
  const rowGlobal = t("全体の結果", "whole network");
  const rowStates = t("状態数", "states");
  // 局所の判定のカードの行。ネットワークを変えるたびに、組の数と1組の状態数も今のネットワークの値に置き換える。
  const localRows = (local: LocalAnalysis) => ({
    [t("調べた組", "pairs checked")]: String(local.pairs.length),
    [rowLocal]: pairsText(local),
    [t("1組の状態", "states per pair")]: t(
      `多くて${maxPairStates(local)}`,
      `at most ${maxPairStates(local)}`,
    ),
  });

  return {
    id: "csp-deadlock-rules",
    category: "apply",
    title: t("デッドロックを規則で避ける", "Avoiding deadlock by rules"),
    subtitle: t(
      "2つずつ調べた結果から、全体が止まらないと言う",
      "From checks on pairs to a whole network that never stops",
    ),
    summary: t(
      `仕事がファイルを2つ借りて使うネットワークで、隣り合う2つだけを並べた局所の判定と、全体の検査を比べる。木で衝突の無い組だけなら止まらない（全体の${TREE_STATES}状態をたどっても止まる所が${TREE_DEADLOCK ? "ある" : "無い"}）。輪では組がどれも無事でも${deadlockText(RING_DEADLOCK?.trace)}が、ファイルの順序を守ると止まらない。入場券の係がいる輪は全体では止まらないのに、局所の規則では言えず、係を外すと${deadlockText(WITHOUT_KEEPER_DEADLOCK?.trace)}。`,
      `In a network where jobs borrow two files each, compare a local judgement that puts only neighbouring pairs side by side with a check of the whole network. A tree whose pairs never conflict never stops (${TREE_DEADLOCK ? "there is a stopped state" : "no stopped state"} among the whole network's ${TREE_STATES} states). A ring ${deadlockText(RING_DEADLOCK?.trace)} even though every pair is fine, but never stops once files are taken in a fixed order. A ring with a ticket keeper never stops as a whole, yet no local rule proves it, and without the keeper it ${deadlockText(WITHOUT_KEEPER_DEADLOCK?.trace)}.`,
    ),
    intro: [
      t(
        "デッドロック（全員が相手を待って誰も動けない状態）は、ネットワーク全体の状態で起きる。全体の状態は部品が増えるほど掛け算で増えるので、大きなネットワークを丸ごと検査するのは重い。そこで、隣り合う2つの部品だけを並べて調べ、その結果から「全体は止まらない」と言える規則が工夫されてきた。",
        "Deadlock, where everyone waits for someone else and nobody can move, happens in a state of the whole network. The whole state space multiplies as components are added, so checking a large network in one piece is expensive. Rules have therefore been devised that look only at pairs of neighbouring components and conclude from that that the whole network never stops.",
      ),
      t(
        "隣り合う2つが互いに相手への依頼を出したまま合意できない状態を衝突と呼ぶ。通信の図（イベントを共有する部品を線で結んだもの）が木で、強い衝突が無ければ、デッドロックしない。輪がある図では、資源を決まった順序で取るといった設計の決まりが要る。テストで実行を何回見ても、止まる並びに当たらなければ見つからない。規則は、どの並びでも止まらないことを言える。",
        "A conflict is a state in which two neighbours each have a request to the other and they cannot agree on anything. If the communication graph (components joined by a line when they share events) is a tree and there is no strong conflict, the network cannot deadlock. A graph with a cycle needs a design rule, such as taking resources in a fixed order. Running tests many times finds nothing unless one of them hits the interleaving that stops; a rule makes the claim for every interleaving.",
      ),
      t(
        "図では、下の段の「局所の判定」と「全体の検査」のカードを並べて見る。ネットワークを木・輪・順序を守った輪・入場券の係がいる輪と変えたとき、2つの答えがどこで一致し、どこで食い違うかを追う。",
        `In the diagram, read the "local judgement" and "whole-network check" cards in the bottom row side by side. As the network changes from a tree to a ring, to an ordered ring and to a ring with a ticket keeper, follow where the two answers agree and where they part.`,
      ),
    ],
    facts: [
      {
        label: t("木", "Tree"),
        value: t(
          `${pairsText(TREE_LOCAL)}・${provedText(TREE_LOCAL)}・全体は${deadlockText(TREE_DEADLOCK?.trace)}`,
          `${pairsText(TREE_LOCAL)}; ${provedText(TREE_LOCAL)}; the whole ${deadlockText(TREE_DEADLOCK?.trace)}`,
        ),
        tone: TREE_DEADLOCK ? "bad" : "ok",
      },
      {
        label: t("輪", "Ring"),
        value: t(
          `${pairsText(RING_LOCAL)}・全体は${listText(RING_DEADLOCK?.trace ?? [])}で止まる`,
          `${pairsText(RING_LOCAL)}; the whole stops after ${listText(RING_DEADLOCK?.trace ?? [])}`,
        ),
        tone: RING_DEADLOCK ? "bad" : "ok",
      },
      {
        label: t("入場券の係がいる輪", "Ring with a ticket keeper"),
        value: t(
          `全体は${deadlockText(TICKETS_DEADLOCK?.trace)}（${TICKETS_STATES}状態）・局所は${provedText(TICKETS_LOCAL)}`,
          `the whole ${deadlockText(TICKETS_DEADLOCK?.trace)} (${TICKETS_STATES} states); locally, ${provedText(TICKETS_LOCAL)}`,
        ),
      },
      {
        label: t("参考", "Reference"),
        value: t(
          `${TPC_BOOK} 13.1節（基本の原理と木のネットワーク）・13.2節（デッドロックを避ける決まり）・13.5節（局所の解析の限界）`,
          `${TPC_BOOK_EN}, §13.1 (basic principles and tree networks), §13.2 (specific ways to avoid deadlock), §13.5 (the limitations of local analysis)`,
        ),
      },
    ],
    actors: [
      {
        id: "network",
        label: t("ネットワーク", "Network"),
        sublabel: t("仕事とファイル", "jobs and files"),
        icon: "network",
        x: 20,
        y: 27,
      },
      {
        id: "keeper",
        label: t("入場券の係", "Ticket keeper"),
        sublabel: KEEPER_NAME,
        icon: "key",
        x: 50,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "rule",
        label: t("規則", "Rule"),
        sublabel: t("局所から全体を言う", "local to global"),
        icon: "contract",
        x: 80,
        y: 27,
        initial: { isHidden: true },
      },
      {
        id: "local",
        label: t("局所の判定", "Local judgement"),
        sublabel: t("2つずつ並べる", "pairs side by side"),
        icon: "people",
        x: 30,
        y: 73,
        initial: { isHidden: true },
      },
      {
        id: "global",
        label: t("全体の検査", "Whole-network check"),
        sublabel: t("全状態をたどる", "explores every state"),
        icon: "checker",
        x: 70,
        y: 73,
        initial: { isHidden: true },
      },
    ],
    links: [
      { from: "network", to: "local" },
      { from: "network", to: "global" },
      { from: "keeper", to: "network" },
      { from: "local", to: "rule" },
    ],
    steps: [
      {
        id: "parts",
        kind: "spec",
        title: t("部品と通信の図", "Components and their graph"),
        actor: "network",
        summary: t(
          "仕事 A・B がファイルを2つずつ借りる。共有するイベントのある部品を線で結ぶと、X–A–Y–B–Z の一本道になる",
          "Jobs A and B each borrow two files. Joining components that share events gives the path X–A–Y–B–Z",
        ),
        explain: t(
          "仕事は take.A.X で1つ目、take.A.Y で2つ目を借り、use.A で使ってから2つとも返す。ファイルは1人に貸したら返されるまで他に貸さない。A は X と Y、B は Z と Y を使うので、通信の図に輪は無い。",
          "A job borrows its first file with take.A.X and its second with take.A.Y, uses them with use.A, and returns both. A file lent to one job lends to no one else until it is returned. A uses X and Y and B uses Z and Y, so the communication graph has no cycle.",
        ),
        set: {
          network: {
            rows: {
              [t("仕事", "jobs")]: t("A：X→Y、B：Z→Y", "A: X→Y, B: Z→Y"),
              [t("つながり", "links")]: "X–A–Y–B–Z",
              [rowShape]: shapeText(TREE_LOCAL),
            },
          },
        },
      },
      {
        id: "pairs",
        kind: "explore",
        title: t("2つずつ並べて調べる", "Check pairs side by side"),
        actor: "local",
        to: ["network"],
        summary: t(
          `線で結ばれた組を、それぞれ2つだけ並べて全部の状態を調べると、${pairsText(TREE_LOCAL)}`,
          `Each linked pair is put side by side on its own and every state is checked: ${pairsText(TREE_LOCAL)}`,
        ),
        explain: t(
          `組の中で、どちらも他の部品と共有するイベントしか出せず（使うなど、1つで起こせる動きが無く）、片方が相手に依頼しているのに合意できないとき、受け付けられない依頼という。互いに依頼し合っていれば衝突である。他の部品とのイベントは自由に起こせるとして調べるので、全体より広く調べている。1組あたり多くて${maxPairStates(TREE_LOCAL)}状態で済む。`,
          `Within a pair, if both can only offer events shared with others, and one has a request to the other that they cannot agree on, that is an ungranted request. Requests both ways make a conflict. Events with other components are treated as always possible, so the check covers more than the whole network can do. It takes at most ${maxPairStates(TREE_LOCAL)} states per pair.`,
        ),
        set: {
          local: {
            isHidden: false,
            tone: conflictCount(TREE_LOCAL) === 0 ? "ok" : "bad",
            rows: {
              [t("調べた組", "pairs checked")]: String(TREE_LOCAL.pairs.length),
              [rowLocal]: pairsText(TREE_LOCAL),
              [t("1組の状態", "states per pair")]: t(
                `多くて${maxPairStates(TREE_LOCAL)}`,
                `at most ${maxPairStates(TREE_LOCAL)}`,
              ),
            },
          },
        },
      },
      {
        id: "tree-rule",
        kind: "fix",
        title: t("木なら規則で言える", "A tree: the rule applies"),
        actor: "rule",
        to: ["local", "global"],
        summary: t(
          `図が木で強い衝突が無いので、デッドロックしないと言える。全体の検査（${TREE_STATES}状態）も${deadlockText(TREE_DEADLOCK?.trace)}`,
          `The graph is a tree with no strong conflict, so it cannot deadlock. The whole-network check (${TREE_STATES} states) agrees: it ${deadlockText(TREE_DEADLOCK?.trace)}`,
        ),
        explain: t(
          "全員が待っている状態では、受け付けられない依頼をたどると必ず輪になり、強い衝突が無ければ3つ以上の部品を巡る輪になる。木にはそういう輪が作れないので、デッドロックは起きない。2つずつの結果と図の形だけで、全体を展開せずに言える。",
          "In a state where everyone waits, following ungranted requests always leads round a cycle, and without strong conflict that cycle passes through three or more components. A tree has no room for such a cycle, so deadlock cannot happen. The claim needs only the pair results and the graph's shape, not the whole state space.",
        ),
        set: {
          rule: {
            isHidden: false,
            tone: TREE_LOCAL.provedBy ? "ok" : "bad",
            rows: {
              [rowShape]: shapeText(TREE_LOCAL),
              [rowVerdict]: provedText(TREE_LOCAL),
            },
          },
          global: {
            isHidden: false,
            tone: TREE_DEADLOCK ? "bad" : "ok",
            rows: {
              [rowGlobal]: deadlockText(TREE_DEADLOCK?.trace),
              [rowStates]: String(TREE_STATES),
            },
          },
        },
      },
      {
        id: "strong-conflict",
        kind: "found",
        title: t("強い衝突は木でも止まる", "Strong conflict stops a tree"),
        actor: "local",
        to: ["network", "global"],
        summary: t(
          `Y を「貸す前に A へ通知する」ファイルにすると、${NOTIFY_CONFLICT?.ends.join("と")}の組が${listText(NOTIFY_CONFLICT?.conflictTrace ?? [])}の後に強い衝突になり、全体も${listText(NOTIFY_DEADLOCK?.trace ?? [])}で止まる`,
          `Make Y a file that notifies A before lending. The pair ${NOTIFY_CONFLICT?.ends.join(" and ")} is in strong conflict after ${listText(NOTIFY_CONFLICT?.conflictTrace ?? [])}, and the whole stops after ${listText(NOTIFY_DEADLOCK?.trace ?? [])}`,
        ),
        explain: t(
          "A は X を借りると Y を借りに行くが、Y は先に通知 note.Y.A を届けようとし、A は使い終えるまで通知を読まない。互いに相手への依頼を出したまま、しかも A は Y にしか依頼していない。これが強い衝突で、木の規則は「強い衝突が無い」ことを求めるので、図が木でも使えない。局所の判定は、この組を名指しして見つける。",
          "After borrowing X, A goes to borrow Y, but Y first tries to deliver the notice note.Y.A, and A reads notices only after finishing. Each has a request to the other, and A has requests only to Y. That is a strong conflict, and the tree rule requires that there be none, so it cannot be used even though the graph is a tree. The local judgement finds it and names the pair.",
        ),
        set: {
          network: {
            tone: "bad",
            rows: { [t("仕事", "jobs")]: t("Y が先に通知する", "Y notifies first") },
          },
          local: {
            tone: "bad",
            rows: {
              [rowLocal]: pairsText(NOTIFY_LOCAL),
              [t("強い衝突", "strong conflict")]: NOTIFY_CONFLICT?.ends.join("–") ?? "",
            },
          },
          rule: { tone: "bad", rows: { [rowVerdict]: provedText(NOTIFY_LOCAL) } },
          global: {
            tone: NOTIFY_DEADLOCK ? "bad" : "ok",
            rows: {
              [rowGlobal]: deadlockText(NOTIFY_DEADLOCK?.trace),
              [rowStates]: String(NOTIFY_STATES),
            },
          },
        },
      },
      {
        id: "ring",
        kind: "found",
        title: t("輪では組が無事でも止まる", "A ring stops, pairs fine"),
        actor: "global",
        to: ["network"],
        summary: t(
          `仕事を3つにして輪にすると、${pairsText(RING_LOCAL)}なのに、全体は${listText(RING_DEADLOCK?.trace ?? [])}で止まる。依頼は ${RING_CYCLE_TEXT} の輪になっている`,
          `With three jobs in a ring, ${pairsText(RING_LOCAL)}, yet the whole stops after ${listText(RING_DEADLOCK?.trace ?? [])}. The requests form the cycle ${RING_CYCLE_TEXT}`,
        ),
        explain: t(
          `A は X→Y、B は Y→Z、C は Z→X の順に借りる。3人が1つ目を借りると、どの仕事も隣の仕事が持つファイルを待つ。止まった時点の受け付けられない依頼は ${RING_CYCLE_TEXT} と一周している。どの組を2つだけ見ても衝突は無く、輪は3つ以上の部品にまたがって初めて現れる。`,
          `A borrows X then Y, B borrows Y then Z, and C borrows Z then X. Once all three hold their first file, each job waits for a file its neighbour holds. At the stopped state, the ungranted requests go all the way round: ${RING_CYCLE_TEXT}. No pair on its own shows a conflict; the cycle only appears across three or more components.`,
        ),
        set: {
          network: {
            tone: "idle",
            rows: {
              [t("仕事", "jobs")]: t(
                "A：X→Y、B：Y→Z、C：Z→X",
                "A: X→Y, B: Y→Z, C: Z→X",
              ),
              [t("つながり", "links")]: "A–X–C–Z–B–Y–A",
              [rowShape]: shapeText(RING_LOCAL),
            },
          },
          local: {
            tone: "ok",
            rows: {
              ...localRows(RING_LOCAL),
              [t("強い衝突", "strong conflict")]: t("なし", "none"),
            },
          },
          rule: {
            tone: "idle",
            rows: {
              [rowShape]: shapeText(RING_LOCAL),
              [rowVerdict]: provedText(RING_LOCAL),
            },
          },
          global: {
            tone: RING_DEADLOCK ? "bad" : "ok",
            rows: {
              [rowGlobal]: deadlockText(RING_DEADLOCK?.trace),
              [rowStates]: String(RING_STATES),
              [t("依頼の輪", "request cycle")]: RING_CYCLE_TEXT,
            },
          },
        },
      },
      {
        id: "order",
        kind: "fix",
        title: t("順序を決めて取る", "Take files in a fixed order"),
        actor: "rule",
        to: ["network", "global"],
        summary: t(
          `ファイルの順序を X→Y→Z と決め、C も X→Z の順に借りると、順序の規則でデッドロックしないと言え、全体（${ORDERED_STATES}状態）も${deadlockText(ORDERED_DEADLOCK?.trace)}`,
          `Fix the order of files as X→Y→Z and let C borrow X then Z. The order rule proves there is no deadlock, and the whole (${ORDERED_STATES} states) ${deadlockText(ORDERED_DEADLOCK?.trace)}`,
        ),
        explain: t(
          "どの仕事も、持っているファイルより順序で後のファイルしか借りに行かない。輪になって待つには、誰かが順序で前のファイルを待たなければならないので、輪が閉じない。調べるのは組の衝突と、仕事1つずつの借り方だけである。",
          "No job ever goes for a file earlier in the order than one it holds. Waiting in a cycle would need someone to wait for an earlier file, so the cycle cannot close. All that is checked is conflict in pairs and how each job, on its own, borrows.",
        ),
        set: {
          network: {
            tone: "ok",
            rows: {
              [t("仕事", "jobs")]: t(
                "A：X→Y、B：Y→Z、C：X→Z",
                "A: X→Y, B: Y→Z, C: X→Z",
              ),
            },
          },
          local: {
            rows: {
              ...localRows(ORDERED_LOCAL),
              [t("強い衝突", "strong conflict")]: null,
              [t("順序を破る仕事", "out-of-order jobs")]:
                ORDERED_LOCAL.outOfOrderJobs.join("、") || t("なし", "none"),
            },
          },
          rule: {
            tone: ORDERED_LOCAL.provedBy ? "ok" : "bad",
            rows: { [rowVerdict]: provedText(ORDERED_LOCAL) },
          },
          global: {
            tone: ORDERED_DEADLOCK ? "bad" : "ok",
            rows: {
              [rowGlobal]: deadlockText(ORDERED_DEADLOCK?.trace),
              [rowStates]: String(ORDERED_STATES),
              [t("依頼の輪", "request cycle")]: t("なし", "none"),
            },
          },
        },
      },
      {
        id: "keeper",
        kind: "explore",
        title: t("係が止めている", "The keeper prevents it"),
        actor: "keeper",
        to: ["network"],
        summary: t(
          `C は Z→X のまま、入場券を2枚だけ配る係を足すと、全体（${TICKETS_STATES}状態）は${deadlockText(TICKETS_DEADLOCK?.trace)}。でも局所の判定は「${provedText(TICKETS_LOCAL)}」`,
          `Keep C borrowing Z then X, and add a keeper that hands out only two tickets. The whole (${TICKETS_STATES} states) ${deadlockText(TICKETS_DEADLOCK?.trace)}, but the local judgement finds that ${provedText(TICKETS_LOCAL)}`,
        ),
        explain: t(
          `入場券を取った仕事だけがファイルを借りに行けるので、3人がそろって1つ目を持つことが無い。ただ、図には輪が残り（係を入れて${TICKETS_LOCAL.pairs.length}組）、C は順序を破るので、どちらの規則も当てはまらない。止まらない理由が、係と輪全体の数の釣り合いにあり、2つずつでは見えない。`,
          `Only a job holding a ticket may go for files, so all three never hold their first file at once. But the graph still has a cycle (${TICKETS_LOCAL.pairs.length} pairs with the keeper) and C breaks the order, so neither rule applies. The reason it never stops lies in a count across the keeper and the whole ring, which pairs cannot see.`,
        ),
        set: {
          keeper: {
            isHidden: false,
            tone: "ok",
            rows: { [t("入場券", "tickets")]: t("2枚", "2") },
          },
          network: {
            tone: "idle",
            rows: {
              [t("仕事", "jobs")]: t(
                "A：X→Y、B：Y→Z、C：Z→X",
                "A: X→Y, B: Y→Z, C: Z→X",
              ),
            },
          },
          local: {
            tone: "idle",
            rows: {
              ...localRows(TICKETS_LOCAL),
              [t("順序を破る仕事", "out-of-order jobs")]:
                TICKETS_LOCAL.outOfOrderJobs.join("、"),
            },
          },
          rule: {
            tone: "idle",
            rows: {
              [rowShape]: shapeText(TICKETS_LOCAL),
              [rowVerdict]: provedText(TICKETS_LOCAL),
            },
          },
          global: {
            tone: TICKETS_DEADLOCK ? "bad" : "ok",
            rows: {
              [rowGlobal]: deadlockText(TICKETS_DEADLOCK?.trace),
              [rowStates]: String(TICKETS_STATES),
              [t("依頼の輪", "request cycle")]: t("なし", "none"),
            },
          },
        },
      },
      {
        id: "remove-keeper",
        kind: "found",
        title: t("係を外すと止まる", "Remove the keeper: it stops"),
        actor: "global",
        to: ["keeper", "network"],
        summary: t(
          `係を外した部分のネットワークは、${listText(WITHOUT_KEEPER_DEADLOCK?.trace ?? [])}で止まる`,
          `The sub-network without the keeper stops after ${listText(WITHOUT_KEEPER_DEADLOCK?.trace ?? [])}`,
        ),
        explain: t(
          "局所の規則が言えるのは「どの部分を取り出しても止まらない」という強い性質である。このネットワークは、係という1つの部品が全体を見張って初めて止まらないので、係を外すと止まる。こういう設計は、全体の検査か、全体で保たれる数（入場券の数）を別に示すしかない。",
          "What local rules can establish is a strong property: no part of the network, taken out on its own, ever stops. This network avoids deadlock only because one component, the keeper, watches over the whole, so removing it lets the rest stop. A design like this needs a check of the whole network, or a separate argument about a quantity kept across the whole (the number of tickets).",
        ),
        set: {
          keeper: {
            tone: "idle",
            rows: { [t("入場券", "tickets")]: t("外した", "removed") },
          },
          global: {
            tone: WITHOUT_KEEPER_DEADLOCK ? "bad" : "ok",
            rows: {
              [rowGlobal]: deadlockText(WITHOUT_KEEPER_DEADLOCK?.trace),
              [rowStates]: String(WITHOUT_KEEPER_STATES),
              [t("依頼の輪", "request cycle")]:
                WITHOUT_KEEPER_CYCLE_TEXT || t("なし", "none"),
            },
          },
        },
        simplified: t(
          "局所の判定は、組を2つだけ並べ、他の部品とのイベントはいつでも起こせるとして全部の状態を調べる（全体より広く調べるので、衝突が無いという結論は全体でも正しい）。規則は木の規則と資源の順序の規則の2つだけを入れた。部品のイベントはどれも多くて2つの部品が共有する。ProB との照合ではデッドロックの有無だけを比べた（ProB の反例は最短とは限らず、輪では8手の手順を返す）。",
          "The local judgement puts a pair on its own and explores every state, treating events with other components as always possible (it covers more than the whole network can do, so a finding of no conflict also holds for the whole). Only two rules are included: the tree rule and the resource-ordering rule. Every event is shared by at most two components. The ProB cross-check compares only whether deadlock exists (ProB's counterexample is not always the shortest; for the ring it returns 8 steps).",
        ),
      },
    ],
    lab: {
      title: t("C の借り方と入場券を変える", "Change C's order and the tickets"),
      hint: t(
        "輪のネットワークで、C の借り方（0 は Z→X、1 は X→Z）と、入場券の枚数（0 は係なし、1〜3）を入れる。全体の検査と局所の判定の答えを並べて見る。",
        "In the ring network, enter how C borrows (0 for Z then X, 1 for X then Z) and the number of tickets (0 for no keeper, 1 to 3). The answers of the whole-network check and the local judgement are shown side by side.",
      ),
      inputs: [
        { id: "order", label: t("C の借り方", "C's order"), initial: "0" },
        { id: "tickets", label: t("入場券の枚数", "Tickets"), initial: "2" },
      ],
      compute: (values): Field[] => {
        const isOrdered = parseChoice(values.order, 0, 1) === 1;
        const tickets = parseChoice(values.tickets, 2, 3);
        const network: Network = ringNetwork(isOrdered, tickets);
        const deadlock = findDeadlock(network);
        const local = localAnalysis(network);
        const stateCount = networkStateCount(network);
        return [
          {
            label: t("ネットワーク", "Network"),
            value: t(
              `C は ${isOrdered ? "X→Z" : "Z→X"}・${tickets === 0 ? "係なし" : `入場券${tickets}枚`}`,
              `C takes ${isOrdered ? "X then Z" : "Z then X"}; ${tickets === 0 ? "no keeper" : `${tickets} tickets`}`,
            ),
          },
          {
            label: t("全体の検査", "Whole-network check"),
            value: deadlock
              ? t(
                  `${listText(deadlock.trace)}で止まる`,
                  `stops after ${listText(deadlock.trace)}`,
                )
              : t(
                  `止まらない（${stateCount}状態）`,
                  `never stops (${stateCount} states)`,
                ),
            tone: deadlock ? "bad" : "ok",
          },
          {
            label: t("局所の判定", "Local judgement"),
            value: t(
              `${pairsText(local)}・${shapeText(local)}・${provedText(local)}`,
              `${pairsText(local)}; ${shapeText(local)}; ${provedText(local)}`,
            ),
            tone: local.provedBy ? "ok" : undefined,
          },
        ];
      },
    },
  };
}
