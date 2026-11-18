// ステップの差分を重ねて「いま各登場物がどういう状態か」を求める純関数。
//
// なぜ毎回先頭から計算し直すか: 「前のステップへ戻る」「好きな行へ飛ぶ」「リセット」を、
// 逆向きの差分を持たずに同じ1つの関数で実現するため。ステップは多くても数十なので十分速い。

import type { ActorPatch, ActorState, Lesson } from "./types";

export type ActorStates = Record<string, ActorState>;

const BLANK_STATE: ActorState = { tone: "idle", isHidden: false, rows: {} };

export function applyPatch(state: ActorState, patch: ActorPatch): ActorState {
  const rows = { ...state.rows };
  for (const [key, value] of Object.entries(patch.rows ?? {})) {
    if (value === null) delete rows[key];
    else rows[key] = value;
  }
  return {
    tone: patch.tone ?? state.tone,
    isHidden: patch.isHidden ?? state.isHidden,
    rows,
  };
}

export function initialStates(lesson: Lesson): ActorStates {
  const states: ActorStates = {};
  for (const actor of lesson.actors) {
    states[actor.id] = applyPatch(BLANK_STATE, actor.initial ?? {});
  }
  return states;
}

/** cursor は「最後に適用したステップの番号」。-1 は何も起きていない最初の状態。 */
export function statesAt(lesson: Lesson, cursor: number): ActorStates {
  const states = initialStates(lesson);
  const lastIndex = Math.min(cursor, lesson.steps.length - 1);
  for (let index = 0; index <= lastIndex; index += 1) {
    for (const [actorId, patch] of Object.entries(lesson.steps[index].set ?? {})) {
      const current = states[actorId];
      // 存在しない登場物への差分は validateTopic が落とす。ここでは黙って読み飛ばす。
      if (current) states[actorId] = applyPatch(current, patch);
    }
  }
  return states;
}
