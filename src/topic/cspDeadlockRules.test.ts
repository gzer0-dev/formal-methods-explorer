import { describe, expect, it } from "vitest";
import { deadlocks, explore, ref } from "./csp";
import {
  composeNetwork,
  DEADLOCK_ENV,
  findDeadlock,
  localAnalysis,
  type Network,
  networkStateCount,
  ringNetwork,
  NETWORKS,
  ticketNetwork,
  ungrantedRequestsAt,
  withoutComponent,
} from "./cspDeadlockRules";

describe("デッドロックを規則で避ける: 全体の検査", () => {
  it("輪に並べた3つの仕事は、全員が1つ目のファイルを取った3手でデッドロックする", () => {
    const deadlock = findDeadlock(NETWORKS.ring);
    expect(deadlock?.trace).toEqual(["take.A.X", "take.B.Y", "take.C.Z"]);
  });

  it("全体の検査は、csp.ts の並行合成と deadlocks の結果（有無と最短の長さ）に一致する", () => {
    for (const network of Object.values(NETWORKS)) {
      const own = findDeadlock(network);
      const viaCsp = deadlocks(composeNetwork(network), DEADLOCK_ENV);
      expect(own === null).toBe(viaCsp.length === 0);
      if (own)
        expect(Math.min(...viaCsp.map((trace) => trace.length))).toBe(own.trace.length);
    }
  });

  it("全体の状態数は、csp.ts で合成して展開した状態数に一致する", () => {
    for (const network of Object.values(NETWORKS))
      expect(networkStateCount(network)).toBe(
        explore(composeNetwork(network), DEADLOCK_ENV).stateCount,
      );
  });

  it("木・順序を守った輪・入場券のある輪はデッドロックせず、通知のある木は2手でデッドロックする", () => {
    expect(findDeadlock(NETWORKS.tree)).toBeNull();
    expect(findDeadlock(NETWORKS.ringOrdered)).toBeNull();
    expect(findDeadlock(NETWORKS.ringTickets)).toBeNull();
    expect(findDeadlock(NETWORKS.treeNotify)?.trace).toEqual(["take.A.X", "take.B.Z"]);
  });
});

describe("デッドロックを規則で避ける: 隣り合う2つだけの判定", () => {
  it("輪は6組とも衝突が無いのに、通信の図が輪なので木の規則が使えず、C が順序を破るので順序の規則も使えない", () => {
    const local = localAnalysis(NETWORKS.ring);
    expect(local.pairs).toHaveLength(6);
    expect(local.pairs.every((pair) => !pair.hasConflict)).toBe(true);
    expect(local.isTree).toBe(false);
    expect(local.outOfOrderJobs).toEqual(["C"]);
    expect(local.provedBy).toBeNull();
  });

  it("木は4組とも衝突が無く、木の規則だけでデッドロックしないと言える（全体の検査も同じ）", () => {
    const local = localAnalysis(NETWORKS.tree);
    expect(local.pairs).toHaveLength(4);
    expect(local.isTree).toBe(true);
    expect(local.provedBy).toBe("tree");
    expect(findDeadlock(NETWORKS.tree)).toBeNull();
  });

  it("通知のある木では A と Y の組だけが強い衝突になり、規則は使えない。2つだけを並べた1手目で見つかる", () => {
    const local = localAnalysis(NETWORKS.treeNotify);
    const conflicting = local.pairs.filter((pair) => pair.hasConflict);
    expect(conflicting.map((pair) => pair.ends)).toEqual([["A", "Y"]]);
    expect(conflicting[0]!.hasStrongConflict).toBe(true);
    expect(conflicting[0]!.conflictTrace).toEqual(["take.A.X"]);
    expect(local.provedBy).toBeNull();
  });

  it("C も順序どおりに取る輪は、資源の順序の規則でデッドロックしないと言える", () => {
    const local = localAnalysis(NETWORKS.ringOrdered);
    expect(local.outOfOrderJobs).toEqual([]);
    expect(local.provedBy).toBe("order");
  });

  it("入場券のある輪は全体ではデッドロックしないのに、局所の規則では言えない。係を外した部分ネットワークはデッドロックする", () => {
    const local = localAnalysis(NETWORKS.ringTickets);
    expect(local.pairs).toHaveLength(9);
    expect(local.pairs.every((pair) => !pair.hasConflict)).toBe(true);
    expect(local.provedBy).toBeNull();
    expect(findDeadlock(NETWORKS.ringTickets)).toBeNull();
    // 係が居なければ入場券の受け渡しは誰にも止められず、3人とも入って1つ目のファイルを取った6手で止まる。
    const subnetwork = findDeadlock(withoutComponent(NETWORKS.ringTickets, "K"));
    expect(subnetwork?.trace).toHaveLength(6);
    expect(subnetwork?.trace.filter((ev) => ev.startsWith("take."))).toEqual([
      "take.A.X",
      "take.B.Y",
      "take.C.Z",
    ]);
  });

  it("入場券を3枚にすると、入場券のある輪もデッドロックする（係が全員を入れてしまう）", () => {
    expect(findDeadlock(ticketNetwork(3))).not.toBeNull();
    expect(findDeadlock(ticketNetwork(1))).toBeNull();
  });

  it("輪のデッドロックの時点では、受け付けられない依頼が A→Y→B→Z→C→X→A の輪になっている", () => {
    const deadlock = findDeadlock(NETWORKS.ring)!;
    const requests = ungrantedRequestsAt(NETWORKS.ring, deadlock.states);
    expect(new Set(requests.map(([from, to]) => `${from}>${to}`))).toEqual(
      new Set(["A>Y", "Y>B", "B>Z", "Z>C", "C>X", "X>A"]),
    );
  });

  it("どの部品も単独では止まらない（規則の前提）", () => {
    for (const network of Object.values(NETWORKS))
      expect(localAnalysis(network).isEveryComponentBusy).toBe(true);
  });

  it("輪の組み立て: C の取り方と入場券の枚数で、C の定義と係の有無が変わる", () => {
    const cOf = (network: Network) =>
      network.components.find((component) => component.name === "C")!.proc;
    expect(cOf(ringNetwork(false, 0))).toEqual(ref("JOB", "C", "Z", "X", "plain"));
    expect(cOf(ringNetwork(true, 0))).toEqual(ref("JOB", "C", "X", "Z", "plain"));
    expect(cOf(ringNetwork(false, 2))).toEqual(ref("JOB", "C", "Z", "X", "ticket"));
    expect(
      ringNetwork(false, 0).components.some((component) => component.role === "keeper"),
    ).toBe(false);
    expect(ringNetwork(false, 2).components.at(-1)).toEqual({
      name: "K",
      role: "keeper",
      proc: ref("KEEPER", "", 2, "A,B,C"),
    });
  });
});
