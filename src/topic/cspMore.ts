// 追加の CSP の例（Lazy 抽象化・共用チャネル）。例はこのサイトで作ったもの。

import {
  type Env,
  ext,
  interleave,
  lazyAbstraction,
  par,
  pre,
  type Proc,
  ref,
} from "./csp";
import { FOCUS_EVENTS } from "./cspCases";
import { philosophers } from "./cspModels";

// ---- Lazy 抽象化: 哲学者0の左のフォーク以外を「環境が勝手に止められるもの」として隠す ----

function forkEvents(isAsymmetric: boolean): string[] {
  const events: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const forks = [i, (i + 1) % 3];
    if (isAsymmetric && i === 2) forks.reverse();
    for (const j of forks) events.push(`pick.${i}.${j}`, `put.${i}.${j}`);
  }
  return events;
}

export function focusLazy(isAsymmetric: boolean): Proc {
  const hidden = forkEvents(isAsymmetric).filter((ev) => !FOCUS_EVENTS.includes(ev));
  return lazyAbstraction(philosophers(3, isAsymmetric), hidden);
}

// ---- 共用チャネル: 2人の客（A・B）が1つの受け箱へ依頼を入れ、1つのサーバーが取り出して応答する ----

export const POOL_CLIENTS = ["A", "B"];
export type PoolMode = "anyOrder" | "fifo";

export const POOL_ENV: Env = {
  // 客: 依頼を受け箱へ入れ、応答をもらったら、また依頼する
  Client: (who: string) => pre(`req.${who}`, pre(`resp.${who}`, ref("Client", who))),
  // 受け箱（好きな順）: 入っている依頼のどれでもサーバーに渡せる。inbox は入っている客の名前を並べた文字列
  AnyBox: (inbox: string) =>
    ext(
      ...POOL_CLIENTS.filter((who) => !inbox.includes(who)).map((who) =>
        pre(`req.${who}`, ref("AnyBox", [...inbox, who].sort().join(""))),
      ),
      ...[...inbox].map((who) =>
        pre(`take.${who}`, ref("AnyBox", inbox.replace(who, ""))),
      ),
    ),
  // 受け箱（先着順）: いちばん先に入った依頼だけをサーバーに渡せる
  FifoBox: (queue: string) =>
    ext(
      ...POOL_CLIENTS.filter((who) => !queue.includes(who)).map((who) =>
        pre(`req.${who}`, ref("FifoBox", queue + who)),
      ),
      ...(queue.length > 0
        ? [pre(`take.${queue[0]}`, ref("FifoBox", queue.slice(1)))]
        : []),
    ),
  // サーバー: 受け箱から1つ取り出し、その客に応答する
  Server: () =>
    ext(
      ...POOL_CLIENTS.map((who) =>
        pre(`take.${who}`, pre(`resp.${who}`, ref("Server"))),
      ),
    ),
};

export function poolSystem(mode: PoolMode): Proc {
  const box = mode === "anyOrder" ? ref("AnyBox", "") : ref("FifoBox", "");
  const clients = interleave(...POOL_CLIENTS.map((who) => ref("Client", who)));
  const reqs = POOL_CLIENTS.map((who) => `req.${who}`);
  const takes = POOL_CLIENTS.map((who) => `take.${who}`);
  const resps = POOL_CLIENTS.map((who) => `resp.${who}`);
  const boxAndServer = par(box, takes, ref("Server"));
  return par(clients, [...reqs, ...resps], boxAndServer);
}
