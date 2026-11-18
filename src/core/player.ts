// 再生の状態機械。タイマーも DOM も持たない純関数で、画面側は tick を送るだけにする。
// こうしておくと「再生・一時停止・1つ進む・戻る・リセット」の全経路を時計なしでテストできる。

export interface PlayerState {
  lessonId: string;
  /** 最後に適用したステップの番号。-1 は何も起きていない最初の状態。 */
  cursor: number;
  isPlaying: boolean;
  speed: number;
}

export interface LessonOutline {
  id: string;
  stepCount: number;
}

export type PlayerAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "reset" }
  | { type: "tick" }
  | { type: "cycleSpeed" }
  | { type: "seek"; cursor: number }
  | { type: "selectLesson"; lessonId: string };

export const SPEEDS = [1, 2, 0.5];
const BASE_STEP_INTERVAL_MS = 2400;

export function stepIntervalMs(speed: number): number {
  return BASE_STEP_INTERVAL_MS / speed;
}

export function initialPlayer(
  lessons: LessonOutline[],
  lessonId?: string,
): PlayerState {
  const requested = lessons.find((lesson) => lesson.id === lessonId);
  return {
    lessonId: (requested ?? lessons[0]).id,
    cursor: -1,
    isPlaying: false,
    speed: SPEEDS[0],
  };
}

function clampCursor(cursor: number, lastCursor: number): number {
  return Math.max(-1, Math.min(cursor, lastCursor));
}

function play(state: PlayerState, lastCursor: number): PlayerState {
  const isAtEnd = state.cursor >= lastCursor;
  return { ...state, cursor: isAtEnd ? -1 : state.cursor, isPlaying: true };
}

export function reducePlayer(
  lessons: LessonOutline[],
  state: PlayerState,
  action: PlayerAction,
): PlayerState {
  const lesson = lessons.find((candidate) => candidate.id === state.lessonId);
  const lastCursor = (lesson?.stepCount ?? 0) - 1;

  switch (action.type) {
    case "play":
      return play(state, lastCursor);
    case "pause":
      return { ...state, isPlaying: false };
    case "toggle":
      return state.isPlaying ? { ...state, isPlaying: false } : play(state, lastCursor);
    case "next":
      return {
        ...state,
        cursor: clampCursor(state.cursor + 1, lastCursor),
        isPlaying: false,
      };
    case "prev":
      return {
        ...state,
        cursor: clampCursor(state.cursor - 1, lastCursor),
        isPlaying: false,
      };
    case "reset":
      return { ...state, cursor: -1, isPlaying: false };
    case "seek":
      return {
        ...state,
        cursor: clampCursor(action.cursor, lastCursor),
        isPlaying: false,
      };
    case "tick": {
      if (!state.isPlaying) return state;
      const cursor = clampCursor(state.cursor + 1, lastCursor);
      return { ...state, cursor, isPlaying: cursor < lastCursor };
    }
    case "cycleSpeed": {
      const nextIndex = (SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length;
      return { ...state, speed: SPEEDS[nextIndex] };
    }
    case "selectLesson": {
      const isKnown = lessons.some((candidate) => candidate.id === action.lessonId);
      if (!isKnown) return state;
      return { ...state, lessonId: action.lessonId, cursor: -1, isPlaying: false };
    }
  }
}
