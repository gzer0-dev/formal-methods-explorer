import { describe, expect, it } from "vitest";
import { divergence, hide, pre, STOP, traceRefines } from "./csp";
import {
  approximation,
  FIXPOINT,
  isGuarded,
  solvesEquation,
  traceCountsByLength,
} from "./cspFixpoint";

const { ticket, coin, self } = FIXPOINT;
const MAX_LENGTH = 8;

describe("再帰の意味は不動点", () => {
  it("券売機 P のトレースは、長さ0から6まで 1,1,2,2,4,4,8 本ある", () => {
    expect(traceCountsByLength(ticket.recursive, ticket.env, 6)).toEqual([
      1, 1, 2, 2, 4, 4, 8,
    ]);
  });

  it("近似 Fⁿ(STOP) は、長さ 2n までは P と同じ本数で、それより長いトレースを持たない", () => {
    const whole = traceCountsByLength(ticket.recursive, ticket.env, MAX_LENGTH);
    for (let n = 0; n <= 3; n += 1) {
      const counts = traceCountsByLength(
        approximation(ticket, n),
        ticket.env,
        MAX_LENGTH,
      );
      counts.forEach((count, length) =>
        expect(count).toBe(length <= 2 * n ? whole[length] : 0),
      );
    }
  });

  it("近似は単調に増える: Fⁿ⁺¹(STOP) ⊑T Fⁿ(STOP)、P ⊑T Fⁿ(STOP)", () => {
    for (let n = 0; n <= 3; n += 1) {
      const current = approximation(ticket, n);
      expect(
        traceRefines(approximation(ticket, n + 1), current, ticket.env).holds,
      ).toBe(true);
      expect(traceRefines(ticket.recursive, current, ticket.env).holds).toBe(true);
    }
  });

  it("どの近似も P そのものではない: Fⁿ(STOP) ⊑T P は長さ 2n+1 のトレースで破れる", () => {
    for (let n = 0; n <= 3; n += 1) {
      const result = traceRefines(
        approximation(ticket, n),
        ticket.recursive,
        ticket.env,
      );
      expect(result.holds).toBe(false);
      expect(result.counterexample).toHaveLength(2 * n + 1);
    }
  });

  it("P は方程式 X = F(X) を満たし、STOP は満たさない", () => {
    expect(solvesEquation(ticket.body, ticket.recursive, ticket.env)).toEqual({
      traces: true,
      failures: true,
      failuresDivergences: true,
    });
    expect(solvesEquation(ticket.body, STOP, ticket.env).traces).toBe(false);
  });

  it("券売機と coin の再帰はガードがあり、P = P には無い", () => {
    expect(isGuarded(ticket.body)).toBe(true);
    expect(isGuarded(coin.body)).toBe(true);
    expect(isGuarded(self.body)).toBe(false);
  });

  it("自分を呼ぶ所に隠蔽がかかる再帰 coin → (X \\ {coin}) は、前置があってもガードに数えない", () => {
    expect(isGuarded((x) => pre("coin", hide(x, ["coin"])))).toBe(false);
    expect(isGuarded((x) => hide(pre("coin", pre("tick", x)), ["tick"]))).toBe(false);
  });

  it("P = P の近似は何回当てても STOP のまま", () => {
    for (let n = 0; n <= 4; n += 1) {
      expect(traceCountsByLength(approximation(self, n), self.env, 4)).toEqual([
        1, 0, 0, 0, 0,
      ]);
    }
  });

  it("P = P は STOP も券売機も満たす（方程式が1つのプロセスに決まらない）", () => {
    expect(solvesEquation(self.body, STOP, ticket.env).failuresDivergences).toBe(true);
    expect(
      solvesEquation(self.body, ticket.recursive, ticket.env).failuresDivergences,
    ).toBe(true);
    expect(traceRefines(STOP, ticket.recursive, ticket.env).holds).toBe(false);
  });

  it("名前を開くのを τ と数えると、P = P は最初から発散し、ガードのある再帰は発散しない", () => {
    expect(divergence(self.unwound, self.env)?.trace).toEqual([]);
    expect(divergence(ticket.unwound, ticket.env)).toBeNull();
    expect(divergence(coin.unwound, coin.env)).toBeNull();
  });
});
