import { describe, expect, it } from "vitest";
import { acceptsTrace, explore } from "./csp";
import {
  ATTACK_EXPECTED,
  checkAuthentication,
  checkAuthenticationHidden,
  HONEST_RUN,
  intruderCanDeliver,
  intruderKnowledgeAfter,
  LOWE_ATTEMPT,
  LOWE_MISMATCH,
  NS_ENV,
  protocolMessages,
  protocolSystem,
} from "./cspSecurityProtocol";

describe("Needham–Schroeder 公開鍵プロトコルと侵入者", () => {
  it("元の版では、検査器が Lowe の中間者攻撃を最短8手で見つける", () => {
    const result = checkAuthentication({ version: "original" });
    expect(result.holds).toBe(false);
    expect(result.counterexample).toEqual(ATTACK_EXPECTED);
    expect(ATTACK_EXPECTED).toEqual([
      "send.A.I.{Na,A}pkI",
      "recv.B.A.{Na,A}pkB",
      "send.B.A.{Na,Nb}pkA",
      "recv.A.I.{Na,Nb}pkA",
      "running.A.I",
      "send.A.I.{Nb}pkI",
      "recv.B.A.{Nb}pkB",
      "commit.B.A",
    ]);
  });

  it("攻撃の中で A は B と話そうとしていない（running.A.B が無い）のに、B は A と確かめたと思う", () => {
    const attack = checkAuthentication({ version: "original" }).counterexample!;
    expect(attack).not.toContain("running.A.B");
    expect(attack.at(-1)).toBe("commit.B.A");
  });

  it("Lowe の直し（2通目に B の名前を入れる）では攻撃が見つからない", () => {
    expect(checkAuthentication({ version: "lowe" }).holds).toBe(true);
  });

  it("直した版でも、正直な A と B の実行は最後まで通る（性質が空虚に成り立っているのではない）", () => {
    expect(
      acceptsTrace(protocolSystem({ version: "lowe" }), NS_ENV, HONEST_RUN.lowe)
        .isAccepted,
    ).toBe(true);
    expect(
      acceptsTrace(protocolSystem({ version: "original" }), NS_ENV, HONEST_RUN.original)
        .isAccepted,
    ).toBe(true);
  });

  it("A が B としか話さないなら、元の版でも攻撃は無い（攻撃は A が侵入者と正規に話すことを使う）", () => {
    expect(checkAuthentication({ version: "original", partners: ["B"] }).holds).toBe(
      true,
    );
  });

  it("侵入者が聞いた暗号文を元の送り手・宛先のまま中継することしかできないなら、元の版でも攻撃は無い", () => {
    expect(checkAuthentication({ version: "original", canRedirect: false }).holds).toBe(
      true,
    );
  });

  it("running.A.B と commit.B.A 以外を隠して比べても同じ結論（ProB と同じ比べ方）", () => {
    const original = checkAuthenticationHidden({ version: "original" });
    expect(original.holds).toBe(false);
    expect(original.counterexample).toEqual(["commit.B.A"]);
    expect(checkAuthenticationHidden({ version: "lowe" }).holds).toBe(true);
  });

  it("侵入者は pkI の暗号文だけを開けて nonce を知り、pkA・pkB の暗号文はそのまま覚える", () => {
    const knowledge = intruderKnowledgeAfter(ATTACK_EXPECTED.slice(0, 3), true);
    expect(knowledge.nonces).toEqual(["Na", "Ni"]);
    expect(knowledge.ciphertexts).toEqual(["{Na,Nb}pkA"]);
    expect(intruderKnowledgeAfter(ATTACK_EXPECTED, true).nonces).toEqual([
      "Na",
      "Nb",
      "Ni",
    ]);
  });

  it("状態数は小さく抑えてある（侵入者の知識を固定した小さな集まりにした）", () => {
    const states = explore(protocolSystem({ version: "original" }), NS_ENV).stateCount;
    expect(states).toBeLessThan(400);
  });

  it("攻撃が見つかるのは、元の版で、A が I とも話し、侵入者が送り直せるときだけ（8通りのうち1通り）", () => {
    const found: string[] = [];
    for (const version of ["original", "lowe"] as const)
      for (const partners of [["B", "I"], ["B"]] as ("B" | "I")[][])
        for (const canRedirect of [true, false])
          if (!checkAuthentication({ version, partners, canRedirect }).holds)
            found.push(`${version}/${partners.join("")}/${canRedirect}`);
    expect(found).toEqual(["original/BI/true"]);
  });

  it("修正版では攻撃と同じ3手までは進めるが、A は B の書いた2通目を I からの返事として受け取らない", () => {
    const lowe = protocolSystem({ version: "lowe" });
    expect(acceptsTrace(lowe, NS_ENV, LOWE_ATTEMPT).isAccepted).toBe(true);
    expect(LOWE_MISMATCH.held).toBe("{Na,Nb,B}pkA");
    expect(
      acceptsTrace(lowe, NS_ENV, [...LOWE_ATTEMPT, `recv.A.I.${LOWE_MISMATCH.held}`])
        .isAccepted,
    ).toBe(false);
  });

  it("プロトコルの3通は A→B {Na,A}pkB・B→A {Na,Nb}pkA・A→B {Nb}pkB", () => {
    expect(protocolMessages("original")).toEqual([
      { from: "A", to: "B", message: "{Na,A}pkB" },
      { from: "B", to: "A", message: "{Na,Nb}pkA" },
      { from: "A", to: "B", message: "{Nb}pkB" },
    ]);
  });

  it("B が I に応じた実行では I も Nb を知るが、B が相手を A と信じる実行では、宛先を変えられない侵入者は Nb を知れない", () => {
    expect(intruderKnowledgeAfter(["send.B.I.{Ni,Nb}pkI"], false).nonces).toContain(
      "Nb",
    );
    expect(intruderKnowledgeAfter(ATTACK_EXPECTED.slice(0, 3), false).nonces).toEqual([
      "Na",
      "Ni",
    ]);
  });

  it("宛先を変えられない侵入者でも、聞いた暗号文を元の送り手・宛先のまま中継できるので、正直な実行は最後まで通る", () => {
    for (const version of ["original", "lowe"] as const) {
      const system = protocolSystem({ version, canRedirect: false });
      expect(acceptsTrace(system, NS_ENV, HONEST_RUN[version]).isAccepted).toBe(true);
    }
  });

  it("宛先を変えられない侵入者は、B の返事を B からの文として A に中継はできるが、I からの返事として渡せない", () => {
    const prefix = ATTACK_EXPECTED.slice(0, 3);
    expect(intruderCanDeliver(prefix, false, "recv.A.B.{Na,Nb}pkA")).toBe(true);
    expect(intruderCanDeliver(prefix, false, "recv.A.I.{Na,Nb}pkA")).toBe(false);
    expect(intruderCanDeliver(prefix, true, "recv.A.I.{Na,Nb}pkA")).toBe(true);
    expect(intruderKnowledgeAfter(prefix, false).ciphertexts).toEqual(["{Na,Nb}pkA"]);
  });
});
