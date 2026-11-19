// 題材データの整合検査。問題を日本語の文で返す（空配列なら問題なし）。
//
// なぜ要るか: 題材はただのデータなので、id の打ち間違いや消し忘れは型検査を通ってしまい、
// 画面では「線が出ない」「行を押しても何も起きない」といった黙った壊れ方をする。
// 題材を足す・直すたびに src/topicContent.test.ts がこれを実際の題材に当てる。

import { statesAt } from "./timeline";
import type { Language } from "./i18n";
import type { Lesson, Section, Step, Topic } from "./types";

const STAGE_MIN = 0;
const STAGE_MAX = 100;
// シーケンス図の矢印の上と、図の字幕に 1 行で収まる長さ。
// 図の字幕と一覧に1行で収まる長さ。英語は単語の分だけ字数が要る。
const MAX_STEP_TITLE_LENGTH: Record<Language, number> = { ja: 16, en: 32 };

function isBlank(text: string | undefined): boolean {
  return text === undefined || text.trim() === "";
}

function duplicates(ids: string[]): string[] {
  return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
}

function sectionProblems(where: string, sections: Section[]): string[] {
  const problems: string[] = [];
  for (const section of sections) {
    if (isBlank(section.title)) problems.push(`${where}: 詳細の見出しが空`);
    if (section.fields.length === 0) {
      problems.push(`${where}: 詳細「${section.title}」に項目が 1 つも無い`);
    }
    for (const field of section.fields) {
      if (isBlank(field.label)) problems.push(`${where}: 詳細の項目名が空`);
    }
  }
  return problems;
}

function stepProblems(
  where: string,
  step: Step,
  actorIds: Set<string>,
  kindIds: Set<string>,
  maxTitleLength: number,
): string[] {
  const problems: string[] = [];
  for (const key of ["title", "summary", "explain"] as const) {
    if (isBlank(step[key])) problems.push(`${where}: ${key} が空`);
  }
  if (step.title.length > maxTitleLength) {
    problems.push(`${where}: title が ${maxTitleLength} 文字を超えている`);
  }
  if (!kindIds.has(step.kind))
    problems.push(`${where}: 種類 "${step.kind}" が kinds に無い`);
  if (!actorIds.has(step.actor)) {
    problems.push(`${where}: 主体 "${step.actor}" が登場物に無い`);
  }
  for (const target of step.to ?? []) {
    if (!actorIds.has(target))
      problems.push(`${where}: 送り先 "${target}" が登場物に無い`);
    if (target === step.actor)
      problems.push(`${where}: 送り先が主体と同じ "${target}"`);
  }
  for (const actorId of Object.keys(step.set ?? {})) {
    if (!actorIds.has(actorId))
      problems.push(`${where}: set の "${actorId}" が登場物に無い`);
  }
  problems.push(...sectionProblems(where, step.detail ?? []));
  return problems;
}

/** 各ステップの時点で、参加する登場物が図に出ているかを見る。 */
function visibilityProblems(where: string, lesson: Lesson): string[] {
  const problems: string[] = [];
  const everVisible = new Set<string>();
  for (let cursor = -1; cursor < lesson.steps.length; cursor += 1) {
    const states = statesAt(lesson, cursor);
    for (const [actorId, state] of Object.entries(states)) {
      if (!state.isHidden) everVisible.add(actorId);
    }
    const step = lesson.steps[cursor];
    if (!step) continue;
    for (const participant of [step.actor, ...(step.to ?? [])]) {
      if (states[participant]?.isHidden) {
        problems.push(
          `${where} > ステップ "${step.id}": "${participant}" がまだ隠れているのに参加している`,
        );
      }
    }
  }
  for (const actor of lesson.actors) {
    if (!everVisible.has(actor.id)) {
      problems.push(`${where}: 登場物 "${actor.id}" が最後まで一度も現れない`);
    }
  }
  return problems;
}

// カードに4行より多く積むと、図の高さを超えて隣のカードや図の外にはみ出す。
// 前のステップの行は消すまで残るので、ステップごとの set ではなく、その時点の状態で数える。
const MAX_CARD_ROWS = 4;

function rowCountProblems(where: string, lesson: Lesson): string[] {
  const problems = new Set<string>();
  for (let cursor = -1; cursor < lesson.steps.length; cursor += 1) {
    const states = statesAt(lesson, cursor);
    for (const [actorId, state] of Object.entries(states)) {
      if (Object.keys(state.rows).length > MAX_CARD_ROWS) {
        const at = cursor < 0 ? "最初" : `ステップ "${lesson.steps[cursor]!.id}"`;
        problems.add(
          `${where} > ${at}: "${actorId}" のカードの行が${MAX_CARD_ROWS}行を超えている（${Object.keys(state.rows).length}行。前の行は null で消す）`,
        );
      }
    }
  }
  return [...problems];
}

function labProblems(where: string, lesson: Lesson): string[] {
  const lab = lesson.lab;
  if (!lab) return [];
  const problems: string[] = [];
  if (isBlank(lab.title) || isBlank(lab.hint))
    problems.push(`${where}: 実験の題か説明が空`);
  if (lab.inputs.length === 0) problems.push(`${where}: 実験の入力欄が 1 つも無い`);
  const initialValues = Object.fromEntries(lab.inputs.map((i) => [i.id, i.initial]));
  try {
    if (lab.compute(initialValues).length === 0) {
      problems.push(`${where}: 実験が初期値で結果を返さない`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    problems.push(`${where}: 実験の compute が失敗した: ${reason}`);
  }
  return problems;
}

/** 関数（compute・lesson）と実験そのものを除いた、レッスンの中身の比較用の文字列。 */
function lessonFingerprint(lesson: Lesson): string {
  const { lab: _lab, ...rest } = lesson;
  return JSON.stringify(rest, (_key, value: unknown) =>
    typeof value === "function" ? undefined : value,
  );
}

function actorLayout(lesson: Lesson): string {
  return JSON.stringify(lesson.actors.map((actor) => [actor.id, actor.x, actor.y]));
}

/**
 * 入力に合わせて組み直す実験（lab.lesson）の検査。
 * 初期値で組んだものが元のレッスンと同じか、見本の入力（samples）ごとに組み直したレッスンが壊れていないかを見る。
 */
function rebuildProblems(
  where: string,
  lesson: Lesson,
  check: (variant: Lesson, where: string) => string[],
): string[] {
  const lab = lesson.lab;
  if (!lab?.lesson) return [];
  const problems: string[] = [];
  const initial = Object.fromEntries(
    lab.inputs.map((input) => [input.id, input.initial]),
  );
  const variants: { label: string; values: Record<string, string> }[] = [
    { label: "初期値", values: initial },
  ];
  for (const input of lab.inputs) {
    for (const sample of input.samples ?? []) {
      if (sample === input.initial) continue;
      variants.push({
        label: `${input.id}=${sample}`,
        values: { ...initial, [input.id]: sample },
      });
    }
  }
  for (const variant of variants) {
    let rebuilt: Lesson;
    try {
      rebuilt = lab.lesson(variant.values);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      problems.push(
        `${where}（${variant.label} のとき）: 組み直しが失敗した: ${reason}`,
      );
      continue;
    }
    if (
      variant.label === "初期値" &&
      lessonFingerprint(rebuilt) !== lessonFingerprint(lesson)
    ) {
      problems.push(`${where}: 既定値で組み直したレッスンが元のレッスンと違う`);
    }
    if (rebuilt.id !== lesson.id || actorLayout(rebuilt) !== actorLayout(lesson)) {
      problems.push(
        `${where}（${variant.label} のとき）: 登場物の id か位置が変わった（図の配置は入力で変えない）`,
      );
    }
    const { lab: _lab, ...withoutLab } = rebuilt;
    problems.push(...check(withoutLab, `${where}（${variant.label} のとき）`));
  }
  return problems;
}

function lessonProblems(
  lesson: Lesson,
  topic: Topic,
  iconIds: Set<string>,
  kindIds: Set<string>,
  maxTitleLength: number,
): string[] {
  const where = `レッスン "${lesson.id}"`;
  const problems: string[] = [];
  const actorIds = new Set(lesson.actors.map((actor) => actor.id));

  for (const key of ["title", "subtitle", "summary"] as const) {
    if (isBlank(lesson[key])) problems.push(`${where}: ${key} が空`);
  }
  (lesson.intro ?? []).forEach((paragraph, index) => {
    if (isBlank(paragraph)) problems.push(`${where}: 概要の ${index + 1} 段落目が空`);
  });
  if (!topic.categories.some((category) => category.id === lesson.category)) {
    problems.push(`${where}: カテゴリ "${lesson.category}" が無い`);
  }
  if (lesson.steps.length === 0) problems.push(`${where}: ステップが 1 つも無い`);
  for (const id of duplicates(lesson.actors.map((actor) => actor.id))) {
    problems.push(`${where}: 登場物の id が重複 "${id}"`);
  }
  for (const id of duplicates(lesson.steps.map((step) => step.id))) {
    problems.push(`${where}: ステップの id が重複 "${id}"`);
  }

  for (const actor of lesson.actors) {
    if (isBlank(actor.label))
      problems.push(`${where}: 登場物 "${actor.id}" の名前が空`);
    if (!iconIds.has(actor.icon)) {
      problems.push(`${where}: 登場物 "${actor.id}" のアイコン "${actor.icon}" が無い`);
    }
    const isInsideStage = [actor.x, actor.y].every(
      (position) => position >= STAGE_MIN && position <= STAGE_MAX,
    );
    if (!isInsideStage) {
      problems.push(`${where}: 登場物 "${actor.id}" の位置が 0〜100 の外`);
    }
  }
  for (const link of lesson.links) {
    for (const end of [link.from, link.to]) {
      if (!actorIds.has(end)) problems.push(`${where}: 線の端 "${end}" が登場物に無い`);
    }
  }
  for (const step of lesson.steps) {
    problems.push(
      ...stepProblems(
        `${where} > ステップ "${step.id}"`,
        step,
        actorIds,
        kindIds,
        maxTitleLength,
      ),
    );
  }
  problems.push(...visibilityProblems(where, lesson));
  problems.push(...rowCountProblems(where, lesson));
  problems.push(
    ...rebuildProblems(where, lesson, (variant, variantWhere) =>
      lessonProblems(variant, topic, iconIds, kindIds, maxTitleLength).map((problem) =>
        problem.replace(where, variantWhere),
      ),
    ),
  );
  problems.push(...labProblems(where, lesson));
  return problems;
}

/**
 * @param builtinIconIds 画面側が持っているアイコンの id。core は画面を知らないので引数で受け取る。
 */
export function validateTopic(
  topic: Topic,
  builtinIconIds: string[],
  language: Language = "ja",
): string[] {
  const problems: string[] = [];
  const iconIds = new Set([...builtinIconIds, ...Object.keys(topic.icons ?? {})]);
  const kindIds = new Set(topic.kinds.map((kind) => kind.id));

  for (const key of ["title", "tagline", "timelineTitle"] as const) {
    if (isBlank(topic[key])) problems.push(`題材の ${key} が空`);
  }
  if (!iconIds.has(topic.brandIcon)) {
    problems.push(`題材の brandIcon "${topic.brandIcon}" が無い`);
  }
  if (topic.lessons.length === 0) problems.push("レッスンが 1 つも無い");
  for (const id of duplicates(topic.lessons.map((lesson) => lesson.id))) {
    problems.push(`レッスンの id が重複 "${id}"`);
  }
  for (const category of topic.categories) {
    if (!topic.lessons.some((lesson) => lesson.category === category.id)) {
      problems.push(`カテゴリ "${category.id}" にレッスンが無い`);
    }
  }
  const usedKinds = new Set(topic.lessons.flatMap((l) => l.steps.map((s) => s.kind)));
  for (const kind of topic.kinds) {
    if (!usedKinds.has(kind.id)) {
      problems.push(`種類 "${kind.id}" がどのステップにも使われていない`);
    }
  }
  for (const lesson of topic.lessons) {
    problems.push(
      ...lessonProblems(
        lesson,
        topic,
        iconIds,
        kindIds,
        MAX_STEP_TITLE_LENGTH[language],
      ),
    );
  }
  return problems;
}
