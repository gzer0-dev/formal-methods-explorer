// デッドロックを規則で避ける（src/topic/cspDeadlockRules.ts・cspDeadlockRules.test.ts と同じ結論）を ProB で照合する。
// ProB のデッドロックの反例は最短とは限らない（輪では8手を返す）ので、手順は比べず、有無だけを比べる。
const FILE = "cases/cspDeadlockRules.csp";

export default ({ runProb, succeeded, failed }) => {
  const deadlockFree = (name, label) => ({
    name: `デッドロックの規則: ${label}`,
    run: () => runProb(["-cspdeadlock", name, "F"], FILE),
    expect: succeeded,
  });
  const deadlocks = (name, label) => ({
    name: `デッドロックの規則: ${label}`,
    run: () => runProb(["-cspdeadlock", name, "F"], FILE),
    expect: failed,
    contains: "reaches a deadlock",
  });
  return [
    deadlockFree("Tree", "木はデッドロックしない"),
    deadlocks("TreeNotify", "通知のある木（A と Y が強い衝突）はデッドロックする"),
    deadlocks("Ring", "輪（C が Z→X）はデッドロックする"),
    deadlockFree("RingOrdered", "C も順序どおりに取る輪はデッドロックしない"),
    deadlockFree("RingTickets2", "入場券2枚の係がいる輪はデッドロックしない"),
    deadlockFree("RingTickets1", "入場券1枚でもデッドロックしない"),
    deadlocks("RingTickets3", "入場券3枚では係が全員を入れてデッドロックする"),
    deadlocks("RingNoKeeper", "係を外した部分ネットワークはデッドロックする"),
  ];
};
