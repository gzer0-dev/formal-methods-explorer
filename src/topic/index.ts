// 題材の定義。レッスンの並びは、学ぶ順（なぜ → モデル検査 → 仕様と証明 → テストへつなぐ）にしてある。

import type { Topic } from "../core/types";
import { TOPIC_ICONS } from "./icons";
import { bfsLesson } from "./lessons/bfs";
import { caseDesignLesson } from "./lessons/caseDesign";
import { caseVerifyLesson } from "./lessons/caseVerify";
import { caseImplementLesson } from "./lessons/caseImplement";
import { counterexampleLesson } from "./lessons/counterexample";
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
    cspToCodeLesson,
    cspAbstractionLesson,
    cspAnonymityLesson,
    cspCancelLesson,
    caseDesignLesson,
    caseVerifyLesson,
    caseImplementLesson,
    propertyTestLesson,
    traceToTestLesson,
    transitionCoverLesson,
  ],
  icons: TOPIC_ICONS,
};
