// 題材の定義。レッスンの並びは、学ぶ順（なぜ → モデル検査 → 仕様と証明 → テストへつなぐ）にしてある。

import type { Language } from "../core/i18n";
import type { Topic } from "../core/types";
import { TOPIC_ICONS } from "./icons";
import { bfsLesson } from "./lessons/bfs";
import { caseDesignLesson } from "./lessons/caseDesign";
import { caseVerifyLesson } from "./lessons/caseVerify";
import { caseImplementLesson } from "./lessons/caseImplement";
import { counterexampleLesson } from "./lessons/counterexample";
import { cspDeterminismLesson } from "./lessons/cspDeterminism";
import { cspLazyLesson } from "./lessons/cspLazy";
import { cspSharedLesson } from "./lessons/cspShared";
import { cspChannelPassingLesson } from "./lessons/cspChannelPassing";
import { stateExplosionLesson } from "./lessons/stateExplosion";
import { ltlDoorLesson } from "./lessons/ltlDoor";
import { exerciseModelLesson } from "./lessons/exerciseModel";
import { exerciseCspLesson } from "./lessons/exerciseCsp";
import { cspFdLesson } from "./lessons/cspFd";
import { cspLawsLesson } from "./lessons/cspLaws";
import { cspRulesLesson } from "./lessons/cspRules";
import { cspAbstractionLesson } from "./lessons/cspAbstraction";
import { cspAnonymityLesson } from "./lessons/cspAnonymity";
import { cspCancelLesson } from "./lessons/cspCancel";
import { deadlockLesson } from "./lessons/deadlock";
import { cspProcessLesson } from "./lessons/cspProcess";
import { cspParallelLesson } from "./lessons/cspParallel";
import { cspRefinementLesson } from "./lessons/cspRefinement";
import { cspFailuresLesson } from "./lessons/cspFailures";
import { cspDeadlockLesson } from "./lessons/cspDeadlock";
import { cspLivelockLesson } from "./lessons/cspLivelock";
import { cspToCodeLesson } from "./lessons/cspToCode";
import { invariantLesson } from "./lessons/invariant";
import { livenessLesson } from "./lessons/liveness";
import { lostUpdateLesson } from "./lessons/lostUpdate";
import { preconditionsLesson } from "./lessons/preconditions";
import { propertyTestLesson } from "./lessons/propertyTest";
import { smallScopeLesson } from "./lessons/smallScope";
import { stateMachineLesson } from "./lessons/stateMachine";
import { toolMapLesson } from "./lessons/toolMap";
import { traceToTestLesson } from "./lessons/traceToTest";
import { transitionCoverLesson } from "./lessons/transitionCover";
import { CATEGORIES, KINDS } from "./taxonomy";

export const topic: Topic = {
  id: "formal-methods",
  title: "形式手法のしくみ",
  tagline: "テストが見逃すバグを、全部の状態をたどって見つける",
  brandIcon: "graph-mark",
  timelineTitle: "検証の流れ",
  kinds: KINDS,
  categories: CATEGORIES,
  lessons: [
    lostUpdateLesson,
    toolMapLesson,
    stateMachineLesson,
    bfsLesson,
    counterexampleLesson,
    invariantLesson,
    deadlockLesson,
    livenessLesson,
    stateExplosionLesson,
    ltlDoorLesson,
    preconditionsLesson,
    smallScopeLesson,
    cspProcessLesson,
    cspParallelLesson,
    cspRefinementLesson,
    cspFailuresLesson,
    cspDeadlockLesson,
    cspLivelockLesson,
    cspFdLesson,
    cspLawsLesson,
    cspRulesLesson,
    cspDeterminismLesson,
    cspToCodeLesson,
    cspAbstractionLesson,
    cspAnonymityLesson,
    cspCancelLesson,
    cspLazyLesson,
    cspSharedLesson,
    cspChannelPassingLesson,
    caseDesignLesson,
    caseVerifyLesson,
    caseImplementLesson,
    propertyTestLesson,
    traceToTestLesson,
    transitionCoverLesson,
    exerciseModelLesson,
    exerciseCspLesson,
  ],
  icons: TOPIC_ICONS,
};

/** 言語ごとの題材。英語は全レッスンの訳し忘れが 0 件になるまで載せない（載せると切り替えのボタンが出る）。 */
export const topics: Partial<Record<Language, Topic>> = { ja: topic };
