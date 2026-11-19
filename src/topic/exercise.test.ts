import { describe, expect, it } from "vitest";
import { findUntranslated } from "../core/i18n";
import {
  type ExerciseQuestion,
  formatAnswer,
  gradeExercise,
  lazy,
  parseAnswer,
  parseQuestionNumber,
} from "./exercise";

describe("問題の番号を読む", () => {
  it("1〜N の半角数字はその番号になる", () => {
    expect(parseQuestionNumber("1", 6)).toBe(1);
    expect(parseQuestionNumber(" 6 ", 6)).toBe(6);
  });

  it("全角数字や「問3」も番号として読む", () => {
    expect(parseQuestionNumber("３", 6)).toBe(3);
    expect(parseQuestionNumber("問3", 6)).toBe(3);
  });

  it("範囲の外・空・数でない入力は null になる", () => {
    expect(parseQuestionNumber("0", 6)).toBeNull();
    expect(parseQuestionNumber("7", 6)).toBeNull();
    expect(parseQuestionNumber("", 6)).toBeNull();
    expect(parseQuestionNumber("abc", 6)).toBeNull();
    expect(parseQuestionNumber(undefined, 6)).toBeNull();
  });
});

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

describe("答え合わせ", () => {
  let solveCalls = 0;
  const questions: ExerciseQuestion[] = [
    {
      title: "問1 数の問題",
      answerType: "number",
      solve: () => {
        solveCalls += 1;
        return { answer: 12, reason: "12になる理由" };
      },
    },
    {
      title: "問2 はいの問題",
      answerType: "yesno",
      solve: () => ({ answer: false, reason: "いいえの理由" }),
    },
  ];
  const grade = gradeExercise(questions, "ja");

  function valueOf(fields: ReturnType<typeof grade>, label: string) {
    return fields.find((field) => field.label === label);
  }

  it("正しい答えなら正解になり、正解の値と解説が出る", () => {
    const fields = grade({ number: "1", answer: "12" });
    expect(valueOf(fields, "判定")).toMatchObject({ value: "正解", tone: "ok" });
    expect(valueOf(fields, "正解")?.value).toBe("12");
    expect(valueOf(fields, "解説")?.value).toBe("12になる理由");
  });

  it("違う答えなら不正解になり、正解の値が出る", () => {
    const fields = grade({ number: "2", answer: "はい" });
    expect(valueOf(fields, "判定")).toMatchObject({ value: "不正解", tone: "bad" });
    expect(valueOf(fields, "正解")?.value).toBe("いいえ");
  });

  it("番号が読めないと、番号の範囲を案内する", () => {
    const fields = grade({ number: "9", answer: "12" });
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.map((field) => field.value).join(" ")).toContain("1〜2");
  });

  it("答えが空や読めないときは、計算せずに答え方を案内する", () => {
    const before = solveCalls;
    const empty = grade({ number: "1", answer: "" });
    const unreadable = grade({ number: "2", answer: "たぶん" });
    expect(solveCalls).toBe(before);
    expect(valueOf(empty, "判定")?.value).toContain("半角数字");
    expect(valueOf(unreadable, "判定")?.value).toContain("「はい」か「いいえ」");
    expect(valueOf(empty, "正解")).toBeUndefined();
  });

  it("同じ問題の計算は1回だけ行い、結果を使い回す", () => {
    const before = solveCalls;
    grade({ number: "1", answer: "12" });
    grade({ number: "1", answer: "13" });
    expect(solveCalls - before).toBeLessThanOrEqual(1);
  });
});

describe("英語の答え合わせ", () => {
  const questions: ExerciseQuestion[] = [
    {
      title: "Q1 A number",
      answerType: "number",
      solve: () => ({ answer: 12, reason: "Why it is 12" }),
    },
    {
      title: "Q2 Yes or no",
      answerType: "yesno",
      solve: () => ({ answer: false, reason: "Why it is no" }),
    },
  ];
  const grade = gradeExercise(questions, "en");

  it("どの番号・どの答えでも、英語の結果に日本語が残らない", () => {
    const answers = ["", "12", "13", "yes", "no", "maybe"];
    for (const number of ["", "0", "1", "2", "3"]) {
      for (const answer of answers) {
        expect(findUntranslated(grade({ number, answer }))).toEqual([]);
      }
    }
  });

  it("英語で正しい答えを入れると Correct になり、正解の値と解説が出る", () => {
    const fields = grade({ number: "2", answer: "no" });
    const result = fields.find((field) => field.label === "Result");
    expect(result).toMatchObject({ value: "Correct", tone: "ok" });
    expect(fields.find((field) => field.label === "Correct answer")?.value).toBe("no");
    expect(fields.find((field) => field.label === "Explanation")?.value).toBe(
      "Why it is no",
    );
  });

  it("英語の画面でも「はい」「いいえ」の答えを受け付ける", () => {
    const fields = grade({ number: "2", answer: "いいえ" });
    expect(fields.find((field) => field.label === "Result")?.value).toBe("Correct");
  });

  it("違う答えなら Incorrect になる", () => {
    const fields = grade({ number: "1", answer: "13" });
    expect(fields.find((field) => field.label === "Result")).toMatchObject({
      value: "Incorrect",
      tone: "bad",
    });
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
