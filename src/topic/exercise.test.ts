import { describe, expect, it } from "vitest";
import { formatAnswer, lazy, parseAnswer } from "./exercise";

describe("答えを読む", () => {
  it("数の答えは半角にそろえて整数で読む", () => {
    expect(parseAnswer("84", "number")).toBe(84);
    expect(parseAnswer(" ８４ ", "number")).toBe(84);
    expect(parseAnswer("4手", "number")).toBe(4);
  });

  it("数の答えが読めないと null になる", () => {
    expect(parseAnswer("", "number")).toBeNull();
    expect(parseAnswer("たくさん", "number")).toBeNull();
  });

  it("はい・yes・y・true は true、いいえ・no・n・false は false になる", () => {
    for (const text of ["はい", "yes", "Y", "true", " はい "]) {
      expect(parseAnswer(text, "yesno")).toBe(true);
    }
    for (const text of ["いいえ", "no", "N", "false"]) {
      expect(parseAnswer(text, "yesno")).toBe(false);
    }
  });

  it("はい／いいえとして読めない答えは null になる", () => {
    expect(parseAnswer("", "yesno")).toBeNull();
    expect(parseAnswer("たぶん", "yesno")).toBeNull();
  });

  it("答えを画面の文字にすると、真偽は「はい」「いいえ」になる", () => {
    expect(formatAnswer(true, "ja")).toBe("はい");
    expect(formatAnswer(false, "ja")).toBe("いいえ");
    expect(formatAnswer(12, "ja")).toBe("12");
  });

  it("英語の画面では、真偽は yes / no になる", () => {
    expect(formatAnswer(true, "en")).toBe("yes");
    expect(formatAnswer(false, "en")).toBe("no");
    expect(formatAnswer(12, "en")).toBe("12");
  });
});

describe("計算を後回しにして使い回す", () => {
  it("lazy の関数は、最初に呼んだときだけ計算し、2回目からは同じ結果を返す", () => {
    let calls = 0;
    const result = lazy(() => {
      calls += 1;
      return { value: 42 };
    });
    expect(calls).toBe(0);
    const first = result();
    const second = result();
    expect(calls).toBe(1);
    expect(second).toBe(first);
  });
});
