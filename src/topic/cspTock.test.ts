import { describe, expect, it } from "vitest";
import { acceptsTrace, deadlocks, traceTo } from "./csp";
import {
  checkDeadline,
  checkTimeProgress,
  checkTimeProgressEager,
  server,
  TOCK_ENV,
} from "./cspTock";

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

  it("環境の入力 request は遅らせてよいものとして扱う検査（Lazy 抽象化して ⊑F）でも、時間を止めるサーバーは tock を断る失敗で捕まる", () => {
    const result = checkTimeProgress(server(4, 3));
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual({
      trace: ["tock", "tock", "tock"],
      refusal: ["tock"],
    });
  });

  it("request を遅らせてよい検査では、正しいサーバー・遅いだけのサーバー・0 tock のサーバーのどれも時間を止めない", () => {
    expect(checkTimeProgress(server(2)).holds).toBe(true);
    expect(checkTimeProgress(server(4)).holds).toBe(true);
    expect(checkTimeProgress(server(0)).holds).toBe(true);
  });

  it("request まで隠して急がせる検査（tock 以外を隠して TICKING と ⊑FD）は、時間を止めるサーバーを tock を断る失敗で捕まえる", () => {
    const result = checkTimeProgressEager(server(4, 3));
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual({
      kind: "failure",
      trace: ["tock", "tock", "tock"],
      refusal: ["tock"],
    });
  });

  it("正しいサーバーと、遅いだけのサーバーは、時間を止めない", () => {
    expect(checkTimeProgressEager(server(2)).holds).toBe(true);
    expect(checkTimeProgressEager(server(4)).holds).toBe(true);
  });

  it("request まで隠すと「環境が request を無限の速さで送れる」ことになり、0 tock のサーバーは発散として捕まる", () => {
    const result = checkTimeProgressEager(server(0));
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
