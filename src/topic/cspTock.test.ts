import { describe, expect, it } from "vitest";
import { acceptsTrace, deadlocks, traceTo } from "./csp";
import { checkDeadline, checkTimeProgress, server, TOCK_ENV } from "./cspTock";

describe("tock で数える離散時間", () => {
  it("2 tock で応答するサーバーは、仕様「依頼から3 tock 以内に応答」を ⊑T で満たし、実際に応答まで着く", () => {
    expect(checkDeadline(3, server(2)).holds).toBe(true);
    expect(traceTo(server(2), TOCK_ENV, "reply")).toEqual([
      "request",
      "tock",
      "tock",
      "reply",
    ]);
  });

  it("4 tock かかるサーバーは、依頼の後に4回目の tock が来た所で仕様を破る", () => {
    const result = checkDeadline(3, server(4));
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual(["request", "tock", "tock", "tock", "tock"]);
  });

  it("3 tock で時間を止めてしまうサーバーは、応答しないのに期限の仕様を空虚に満たす", () => {
    const stuck = server(4, 3);
    expect(checkDeadline(3, stuck).holds).toBe(true);
    expect(traceTo(stuck, TOCK_ENV, "reply")).toBeNull();
  });

  it("時間が進み続けるかの検査（tock 以外を隠して TICKING と ⊑FD）は、時間を止めるサーバーを tock を断る失敗で捕まえる", () => {
    const result = checkTimeProgress(server(4, 3));
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual({
      kind: "failure",
      trace: ["tock", "tock", "tock"],
      refusal: ["tock"],
    });
  });

  it("正しいサーバーと、遅いだけのサーバーは、時間を止めない", () => {
    expect(checkTimeProgress(server(2)).holds).toBe(true);
    expect(checkTimeProgress(server(4)).holds).toBe(true);
  });

  it("tock を挟まずに応答できるサーバー（0 tock）は、時間の進まない輪を回れるので発散として捕まる", () => {
    const result = checkTimeProgress(server(0));
    expect(result.holds).toBe(false);
    expect(result.counterexample?.kind).toBe("divergence");
  });

  it("時間を止めたサーバーは、tock を断ったまま動けない（この例ではデッドロックでもある）", () => {
    expect(deadlocks(server(4, 3), TOCK_ENV)[0]).toEqual([
      "request",
      "tock",
      "tock",
      "tock",
    ]);
    expect(
      acceptsTrace(server(4, 3), TOCK_ENV, ["request", "tock", "tock", "tock", "tock"])
        .isAccepted,
    ).toBe(false);
  });
});
