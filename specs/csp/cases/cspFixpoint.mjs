// csp-fixpoint の照合。期待値は src/topic/cspFixpoint.test.ts と同じ。
const FILE = "cases/cspFixpoint.csp";

export default ({ runProb, succeeded, failed }) => [
  {
    name: "不動点: 近似 F3(STOP) は券売機のトレースの一部（TICKET [T= Approx3）",
    run: () => runProb(["-cspref", "TICKET", "[T=", "Approx3"], FILE),
    expect: succeeded,
  },
  {
    name: "不動点: 近似は単調に増える（Approx4 [T= Approx3）",
    run: () => runProb(["-cspref", "Approx4", "[T=", "Approx3"], FILE),
    expect: succeeded,
  },
  {
    name: "不動点: 近似 F3(STOP) は券売機そのものではない（Approx3 [T= TICKET が破れる）",
    run: () => runProb(["-cspref", "Approx3", "[T=", "TICKET"], FILE),
    expect: failed,
    trace: ["coin", "ticket", "coin", "ticket", "coin", "ticket", "coin"],
  },
  {
    name: "不動点: 券売機は方程式を満たす（TICKET [FD= F(TICKET)）",
    run: () => runProb(["-cspref", "TICKET", "[FD=", "FTicket"], FILE),
    expect: succeeded,
  },
  {
    name: "不動点: 券売機は方程式を満たす（F(TICKET) [FD= TICKET）",
    run: () => runProb(["-cspref", "FTicket", "[FD=", "TICKET"], FILE),
    expect: succeeded,
  },
  {
    name: "不動点: STOP は方程式を満たさない（STOP [T= F(STOP) が破れる）",
    run: () => runProb(["-cspref", "STOP", "[T=", "FStop"], FILE),
    expect: failed,
    trace: ["coin"],
  },
  {
    name: "不動点: 展開を τ と見ると P = P は発散する",
    run: () => runProb(["-csplivelock", "SelfHidden"], FILE),
    expect: failed,
  },
  {
    name: "不動点: ガードのある券売機は、展開を τ と見ても発散しない",
    run: () => runProb(["-csplivelock", "TicketHidden"], FILE),
    expect: succeeded,
  },
];
