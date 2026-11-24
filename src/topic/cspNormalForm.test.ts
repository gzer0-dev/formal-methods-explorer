import { describe, expect, it } from "vitest";
import {
  explore,
  failuresRefines,
  normalizedStateCount,
  TAU,
  traceRefines,
} from "./csp";
import {
  checkWithNormalForm,
  NORMAL_ENV,
  NORMAL_IMPLS,
  NORMAL_SPEC,
  normalForm,
  preNormalForm,
} from "./cspNormalForm";

const implOf = (id: (typeof NORMAL_IMPLS)[number]["id"]) =>
  NORMAL_IMPLS.find((impl) => impl.id === id)!.proc;

describe("仕様を正規化して比べる", () => {
  it("仕様の生の状態遷移は5状態・9本（τ が2本）で、前正規形は3節点。節点数は csp.ts の normalizedStateCount と同じ", () => {
    const lts = explore(NORMAL_SPEC, NORMAL_ENV);
    expect(lts.stateCount).toBe(5);
    expect(lts.transitionCount).toBe(9);
    expect(lts.edges.filter((edge) => edge.ev === TAU)).toHaveLength(2);
    const graph = preNormalForm(NORMAL_SPEC, NORMAL_ENV);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes).toHaveLength(normalizedStateCount(NORMAL_SPEC, NORMAL_ENV));
  });

  it("前正規形にも正規形にも τ の辺が無く、(節点, イベント) ごとに行き先が1つ", () => {
    for (const graph of [
      preNormalForm(NORMAL_SPEC, NORMAL_ENV),
      normalForm(NORMAL_SPEC, NORMAL_ENV),
    ]) {
      expect(graph.edges.some((edge) => edge.ev === TAU)).toBe(false);
      const keys = graph.edges.map((edge) => `${edge.from}|${edge.ev}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("req の後の節点は3状態をまとめ、最小の受け付け集合が {cancel, ok} と {busy, cancel} の2つある", () => {
    const graph = preNormalForm(NORMAL_SPEC, NORMAL_ENV);
    const afterReq = graph.edges.find((edge) => edge.from === 0 && edge.ev === "req")!;
    const node = graph.nodes[afterReq.to]!;
    expect(node.members).toHaveLength(3);
    expect(node.acceptances).toEqual([
      ["busy", "cancel"],
      ["cancel", "ok"],
    ]);
    expect(graph.nodes[0]!.acceptances).toEqual([["req"]]);
  });

  it("2段目で SERVER と RETRY の節点が1つにまとまり、正規形は2節点・4本になる", () => {
    const graph = normalForm(NORMAL_SPEC, NORMAL_ENV);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(4);
    expect(graph.nodes[0]!.members).toEqual(["RETRY", "SERVER"]);
    expect(graph.nodes.some((node) => node.isDivergent)).toBe(false);
  });

  it("正規形との組でたどった結果は、csp.ts の traceRefines・failuresRefines と合否も反例も同じ", () => {
    for (const { proc } of NORMAL_IMPLS) {
      for (const graph of [
        preNormalForm(NORMAL_SPEC, NORMAL_ENV),
        normalForm(NORMAL_SPEC, NORMAL_ENV),
      ]) {
        const traces = checkWithNormalForm(graph, proc, NORMAL_ENV, "traces");
        const expectedTraces = traceRefines(NORMAL_SPEC, proc, NORMAL_ENV);
        expect(traces.holds).toBe(expectedTraces.holds);
        if (traces.counterexample?.kind === "trace")
          expect(traces.counterexample.trace).toEqual(expectedTraces.counterexample);
        const failures = checkWithNormalForm(graph, proc, NORMAL_ENV, "failures");
        const expectedFailures = failuresRefines(NORMAL_SPEC, proc, NORMAL_ENV);
        expect(failures.holds).toBe(expectedFailures.holds);
        if (failures.counterexample) {
          const { kind, ...rest } = failures.counterexample;
          expect(rest).toEqual(
            kind === "trace"
              ? { trace: expectedFailures.counterexample!.trace }
              : expectedFailures.counterexample,
          );
        }
      }
    }
  });

  it("実装3つの結果: good は ⊑F で成り立つ、eager は ⟨ok⟩ で、nocancel は ⟨req⟩ の後に {cancel} を断って破れる", () => {
    const graph = normalForm(NORMAL_SPEC, NORMAL_ENV);
    expect(
      checkWithNormalForm(graph, implOf("good"), NORMAL_ENV, "failures").holds,
    ).toBe(true);
    expect(
      checkWithNormalForm(graph, implOf("eager"), NORMAL_ENV, "traces").counterexample,
    ).toEqual({ kind: "trace", trace: ["ok"] });
    expect(
      checkWithNormalForm(graph, implOf("nocancel"), NORMAL_ENV, "traces").holds,
    ).toBe(true);
    expect(
      checkWithNormalForm(graph, implOf("nocancel"), NORMAL_ENV, "failures")
        .counterexample,
    ).toEqual({ kind: "failure", trace: ["req"], refusal: ["cancel"] });
  });
});
