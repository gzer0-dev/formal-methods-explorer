import { describe, expect, it } from "vitest";
import type { Step } from "../core/types";
import { buildExerciseLesson, type ExerciseSpec } from "./exerciseLesson";

function stepOf(id: string): Step {
  return { id, kind: "explore", title: id, actor: "q", summary: id, explain: id };
}

function specWith(solveCalls: { count: number }): ExerciseSpec {
  return {
    id: "exercise-sample",
    title: "演習: 見本",
    subtitle: "見本",
    summary: "見本",
    intro: ["見本"],
    facts: [],
    actors: [
      { id: "q", label: "問題", icon: "document", x: 30, y: 50 },
      { id: "checker", label: "検査器", icon: "checker", x: 70, y: 50 },
    ],
    links: [],
    answerType: "number",
    answerLabel: "答え",
    hint: "答えを入れる",
    verdictActor: "checker",
    setupSteps: [stepOf("setup"), stepOf("question")],
    solve: () => {
      solveCalls.count++;
      return { answer: 4, reason: "4手で破れる" };
    },
    solutionSteps: () => [stepOf("move-1"), stepOf("move-2")],
  };
}

describe("演習のレッスンの組み立て（buildExerciseLesson）", () => {
  it("答える前のレッスンは設定のステップだけで、正解を計算しない", () => {
    const calls = { count: 0 };
    const lesson = buildExerciseLesson(specWith(calls), "ja");
    expect(lesson.steps.map((step) => step.id)).toEqual(["setup", "question"]);
    expect(calls.count).toBe(0);
  });

  it("答えを入れると、正解の手順と答え合わせのステップが足される", () => {
    const lesson = buildExerciseLesson(specWith({ count: 0 }), "ja");
    const answered = lesson.lab!.lesson!({ answer: "4" });
    expect(answered.steps.map((step) => step.id)).toEqual([
      "setup",
      "question",
      "move-1",
      "move-2",
      "verdict",
    ]);
    const verdict = answered.steps.at(-1)!;
    expect(verdict.title).toBe("答え合わせ: 正解");
    expect(verdict.explain).toBe("4手で破れる");
    expect(verdict.set?.checker?.tone).toBe("ok");
  });

  it("違う答えなら答え合わせは不正解になり、正解の数を見せる", () => {
    const lesson = buildExerciseLesson(specWith({ count: 0 }), "ja");
    const verdict = lesson.lab!.lesson!({ answer: "3" }).steps.at(-1)!;
    expect(verdict.title).toBe("答え合わせ: 不正解");
    expect(verdict.summary).toContain("正解は4");
    expect(verdict.set?.checker?.tone).toBe("bad");
  });

  it("答えが読めないときは答える前のレッスンのままで、正解を計算しない", () => {
    const calls = { count: 0 };
    const lesson = buildExerciseLesson(specWith(calls), "ja");
    const unanswered = lesson.lab!.lesson!({ answer: "" });
    expect(unanswered.steps.map((step) => step.id)).toEqual(["setup", "question"]);
    expect(calls.count).toBe(0);
  });

  it("英語のレッスンでは答え合わせの文言も英語になる", () => {
    const lesson = buildExerciseLesson(specWith({ count: 0 }), "en");
    const verdict = lesson.lab!.lesson!({ answer: "4" }).steps.at(-1)!;
    expect(verdict.title).toBe("Result: correct");
  });
  it("はい／いいえの答え合わせは、答えをかぎかっこで囲んで書く", () => {
    const spec = {
      ...specWith({ count: 0 }),
      answerType: "yesno" as const,
      solve: () => ({ answer: false, reason: "止まらない" }),
    };
    const verdict = buildExerciseLesson(spec, "ja").lab!.lesson!({
      answer: "はい",
    }).steps.at(-1)!;
    expect(verdict.summary).toBe("あなたは「はい」と答え、正解は「いいえ」");
  });
});
