import { describe, expect, it } from "vitest";

import { initialPlayer, reducePlayer, stepIntervalMs } from "./player";

const LESSONS = [
  { id: "first", stepCount: 3 },
  { id: "second", stepCount: 2 },
];
const start = initialPlayer(LESSONS);

describe("initialPlayer", () => {
  it("最初のレッスンの、何も起きていない状態から始まる", () => {
    expect(start).toEqual({
      lessonId: "first",
      cursor: -1,
      isPlaying: false,
      speed: 1,
    });
  });

  it("指定したレッスンがあればそこから始まる", () => {
    expect(initialPlayer(LESSONS, "second").lessonId).toBe("second");
  });

  it("存在しないレッスンを指定されたら最初のレッスンにする", () => {
    expect(initialPlayer(LESSONS, "nope").lessonId).toBe("first");
  });
});

describe("reducePlayer", () => {
  it("next で 1 つ進み、再生は止まる", () => {
    const playing = reducePlayer(LESSONS, start, { type: "play" });
    expect(reducePlayer(LESSONS, playing, { type: "next" })).toMatchObject({
      cursor: 0,
      isPlaying: false,
    });
  });

  it("最後のステップで next を押しても進まない", () => {
    const atEnd = { ...start, cursor: 2 };
    expect(reducePlayer(LESSONS, atEnd, { type: "next" }).cursor).toBe(2);
  });

  it("prev で 1 つ戻り、最初より前には戻らない", () => {
    expect(
      reducePlayer(LESSONS, { ...start, cursor: 1 }, { type: "prev" }).cursor,
    ).toBe(0);
    expect(reducePlayer(LESSONS, start, { type: "prev" }).cursor).toBe(-1);
  });

  it("reset で最初の状態に戻り、再生は止まる", () => {
    const state = { ...start, cursor: 2, isPlaying: true };
    expect(reducePlayer(LESSONS, state, { type: "reset" })).toMatchObject({
      cursor: -1,
      isPlaying: false,
    });
  });

  it("seek で指定した行へ飛び、範囲外は端に丸める", () => {
    expect(reducePlayer(LESSONS, start, { type: "seek", cursor: 1 }).cursor).toBe(1);
    expect(reducePlayer(LESSONS, start, { type: "seek", cursor: 9 }).cursor).toBe(2);
  });

  it("tick は再生中だけ進める", () => {
    expect(reducePlayer(LESSONS, start, { type: "tick" }).cursor).toBe(-1);
    const playing = reducePlayer(LESSONS, start, { type: "play" });
    expect(reducePlayer(LESSONS, playing, { type: "tick" }).cursor).toBe(0);
  });

  it("tick で最後のステップに着いたら再生が止まる", () => {
    const state = { ...start, cursor: 1, isPlaying: true };
    expect(reducePlayer(LESSONS, state, { type: "tick" })).toMatchObject({
      cursor: 2,
      isPlaying: false,
    });
  });

  it("最後まで進んだあとの play は最初から再生し直す", () => {
    const atEnd = { ...start, cursor: 2 };
    expect(reducePlayer(LESSONS, atEnd, { type: "play" })).toMatchObject({
      cursor: -1,
      isPlaying: true,
    });
  });

  it("toggle は再生と一時停止を切り替える", () => {
    const playing = reducePlayer(LESSONS, start, { type: "toggle" });
    expect(playing.isPlaying).toBe(true);
    expect(reducePlayer(LESSONS, playing, { type: "toggle" }).isPlaying).toBe(false);
  });

  it("selectLesson でレッスンを替えると最初の状態になり、速さは引き継ぐ", () => {
    const state = { ...start, cursor: 2, isPlaying: true, speed: 2 };
    expect(
      reducePlayer(LESSONS, state, { type: "selectLesson", lessonId: "second" }),
    ).toEqual({ lessonId: "second", cursor: -1, isPlaying: false, speed: 2 });
  });

  it("存在しないレッスンへの selectLesson は何も変えない", () => {
    expect(reducePlayer(LESSONS, start, { type: "selectLesson", lessonId: "x" })).toBe(
      start,
    );
  });

  it("cycleSpeed は 1 → 2 → 0.5 → 1 の順に回る", () => {
    const twice = reducePlayer(LESSONS, start, { type: "cycleSpeed" });
    const half = reducePlayer(LESSONS, twice, { type: "cycleSpeed" });
    const once = reducePlayer(LESSONS, half, { type: "cycleSpeed" });
    expect([twice.speed, half.speed, once.speed]).toEqual([2, 0.5, 1]);
  });
});

describe("stepIntervalMs", () => {
  it("速さが 2 倍なら間隔は半分になる", () => {
    expect(stepIntervalMs(2)).toBe(stepIntervalMs(1) / 2);
  });
});
