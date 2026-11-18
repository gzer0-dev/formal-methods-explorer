// チャネル渡し: 振り分け役が、空いているセッションのチャネル（s1・s2）を客に渡し、客はそのチャネルで話してから返す。
// 渡したチャネルの名前（データ）によって、その後どのチャネルで通信するかが決まる。例はこのサイトで作ったもの。

import { type Env, ext, hide, interleave, par, pre, type Proc, ref } from "./csp";

export const SESSION_CLIENTS = ["A", "B"];
export const SESSIONS = ["s1", "s2"];

const assignEvents = SESSION_CLIENTS.flatMap((c) =>
  SESSIONS.map((s) => `assign.${c}.${s}`),
);
const releaseEvents = SESSION_CLIENTS.flatMap((c) =>
  SESSIONS.map((s) => `release.${c}.${s}`),
);
const talkEvents = SESSION_CLIENTS.flatMap((c) =>
  SESSIONS.map((s) => `talk.${c}.${s}`),
);

export const SESSION_ENV: Env = {
  // 客: セッションを1つ受け取り、そのチャネルで話し、返す
  Client: (c: string) =>
    ext(
      ...SESSIONS.map((s) =>
        pre(
          `assign.${c}.${s}`,
          pre(`talk.${c}.${s}`, pre(`release.${c}.${s}`, ref("Client", c))),
        ),
      ),
    ),
  // 正しい振り分け役: 空いているセッションだけを渡す。free は空いているセッションを "," でつないだ文字列
  Balancer: (free: string) => {
    const freeList = free === "" ? [] : free.split(",");
    const taken = SESSIONS.filter((s) => !freeList.includes(s));
    return ext(
      ...SESSION_CLIENTS.flatMap((c) =>
        freeList.map((s) =>
          pre(
            `assign.${c}.${s}`,
            ref("Balancer", freeList.filter((x) => x !== s).join(",")),
          ),
        ),
      ),
      ...SESSION_CLIENTS.flatMap((c) =>
        taken.map((s) =>
          pre(`release.${c}.${s}`, ref("Balancer", [...freeList, s].sort().join(","))),
        ),
      ),
    );
  },
  // 誤った振り分け役: どのセッションが使用中かを覚えず、いつでもどれでも渡す
  ForgetfulBalancer: () =>
    ext(
      ...[...assignEvents, ...releaseEvents].map((ev) =>
        pre(ev, ref("ForgetfulBalancer")),
      ),
    ),
  // 仕様: あるセッションは、渡されたら返されるまで、ほかの人には渡されない
  Exclusive: (s: string) =>
    ext(
      ...SESSION_CLIENTS.map((c) =>
        pre(`assign.${c}.${s}`, pre(`release.${c}.${s}`, ref("Exclusive", s))),
      ),
    ),
};

export function sessionSystem(isForgetful: boolean): Proc {
  const clients = interleave(...SESSION_CLIENTS.map((c) => ref("Client", c)));
  const balancer = isForgetful
    ? ref("ForgetfulBalancer")
    : ref("Balancer", SESSIONS.join(","));
  return par(clients, [...assignEvents, ...releaseEvents], balancer);
}

/** あるセッションの受け渡し（assign と release）だけを見えるようにする。 */
export function sessionView(system: Proc, session: string): Proc {
  const keep = (ev: string) => ev.endsWith(`.${session}`) && !ev.startsWith("talk.");
  return hide(
    system,
    [...assignEvents, ...releaseEvents, ...talkEvents].filter((ev) => !keep(ev)),
  );
}

export function sessionExclusiveSpec(session: string): Proc {
  return ref("Exclusive", session);
}
