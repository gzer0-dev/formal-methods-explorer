// 題材の定義。レッスンの並びは、学ぶ順（なぜ → モデル検査 → 仕様と証明 → テストへつなぐ）にしてある。

import { translator, type Language } from "../core/i18n";
import type { Lesson, Topic } from "../core/types";
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
import { exerciseThreeProcessesLesson } from "./lessons/exerciseThreeProcesses";
import { exerciseShortestLesson } from "./lessons/exerciseShortest";
import { exerciseSameOrderLesson } from "./lessons/exerciseSameOrder";
import { exerciseUnlimitedRetryLesson } from "./lessons/exerciseUnlimitedRetry";
import { exerciseNoSelfBossLesson } from "./lessons/exerciseNoSelfBoss";
import { exerciseShrunkLesson } from "./lessons/exerciseShrunk";
import { exercisePrinterTraceLesson } from "./lessons/exercisePrinterTrace";
import { exercisePrinterFailuresLesson } from "./lessons/exercisePrinterFailures";
import { exercisePhilosophersLesson } from "./lessons/exercisePhilosophers";
import { exerciseCryptoLesson } from "./lessons/exerciseCrypto";
import { exerciseSortTestLesson } from "./lessons/exerciseSortTest";
import { exerciseDeterminismLesson } from "./lessons/exerciseDeterminism";
import { exerciseInboxLesson } from "./lessons/exerciseInbox";
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
import { categoriesIn, kindsIn } from "./taxonomy";

// 英訳の途中は、Lesson そのもの（日本語だけ）と (language) => Lesson の関数が混ざる。
type LessonSource = Lesson | ((language: Language) => Lesson);

const LESSON_SOURCES: LessonSource[] = [
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
  exerciseThreeProcessesLesson,
  exerciseShortestLesson,
  exerciseSameOrderLesson,
  exerciseUnlimitedRetryLesson,
  exerciseNoSelfBossLesson,
  exerciseShrunkLesson,
  exercisePrinterTraceLesson,
  exercisePrinterFailuresLesson,
  exercisePhilosophersLesson,
  exerciseCryptoLesson,
  exerciseSortTestLesson,
  exerciseDeterminismLesson,
  exerciseInboxLesson,
];

function buildTopic(language: Language): Topic {
  const t = translator(language);
  return {
    id: "formal-methods",
    title: t("形式手法のしくみ", "Formal Methods, Step by Step"),
    tagline: t(
      "テストが見逃すバグを、全部の状態をたどって見つける",
      "Find the bugs tests miss by walking every state",
    ),
    brandIcon: "graph-mark",
    timelineTitle: t("検証の流れ", "Verification flow"),
    kinds: kindsIn(language),
    categories: categoriesIn(language),
    lessons: LESSON_SOURCES.map((source) =>
      typeof source === "function" ? source(language) : source,
    ),
    icons: TOPIC_ICONS,
  };
}

export const topic: Topic = buildTopic("ja");

/** 言語ごとの題材。2つあるので画面に切り替えのボタンが出る。英語の訳し忘れは topicContent.test.ts と lessonFiles.test.ts が落とす。 */
export const topics: Partial<Record<Language, Topic>> = {
  ja: topic,
  en: buildTopic("en"),
};
