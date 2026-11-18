import { describe, expect, it } from "vitest";

import { sha256Hex } from "./sha256";

// 期待値は NIST FIPS 180-4 の例と、広く知られた既知ベクタ。
describe("sha256Hex", () => {
  it("空文字列", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("abc", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("2 ブロックにまたがる 56 バイトの入力", () => {
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("日本語は UTF-8 のバイト列として計算する（Node の crypto と一致する）", async () => {
    const { createHash } = await import("node:crypto");
    const text = "こんにちは、ブロックチェーン";
    expect(sha256Hex(text)).toBe(
      createHash("sha256").update(text, "utf8").digest("hex"),
    );
  });

  it("長さがまちまちの入力でも Node の crypto と一致する", async () => {
    const { createHash } = await import("node:crypto");
    for (let length = 0; length < 200; length += 7) {
      const text = "x".repeat(length);
      expect(sha256Hex(text)).toBe(createHash("sha256").update(text).digest("hex"));
    }
  });
});
