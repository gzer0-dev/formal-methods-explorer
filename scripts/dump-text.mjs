#!/usr/bin/env node
// 題材の文言（題・要約・説明・簡略化の注記・実験の説明）を 1 つのテキストに書き出す。
// 校正のための道具: 書き出した docs/lesson-text.txt を日本語の lint にかけ、通して読む。
//
//   npm run dump:text              日本語 → docs/lesson-text.txt
//   npm run dump:text -- --lang en  英語 → docs/lesson-text.en.txt（英語の題材があるとき）

import { mkdirSync, writeFileSync } from "node:fs";

import { loadTopic } from "./loadTopic.mjs";

const SIMPLIFIED_LABEL = { ja: "簡略化", en: "Simplified" };

/** 題材の文言を、読む順に並べた行の配列にする。 */
export function topicLines(topic, language = "ja") {
  const lines = [topic.title, topic.tagline];
  for (const lesson of topic.lessons) {
    lines.push(
      "",
      `## ${lesson.title}`,
      lesson.subtitle,
      lesson.summary,
      ...(lesson.intro ?? []),
    );
    for (const fact of lesson.facts) lines.push(`${fact.label}: ${fact.value}`);
    for (const step of lesson.steps) {
      lines.push("", `### ${step.title}`, step.summary, step.explain);
      if (step.simplified)
        lines.push(`${SIMPLIFIED_LABEL[language]}: ${step.simplified}`);
      for (const section of step.detail ?? []) {
        lines.push(section.title);
        for (const field of section.fields) if (field.note) lines.push(field.note);
      }
    }
    if (lesson.lab) lines.push(lesson.lab.title, lesson.lab.hint);
  }
  return lines;
}

function requestedLanguage(argv) {
  const index = argv.indexOf("--lang");
  return index === -1 ? "ja" : argv[index + 1];
}

try {
  const language = requestedLanguage(process.argv);
  const topics = await loadTopic("topics");
  const topic = topics?.[language];
  if (!topic)
    throw new Error(`言語 "${language}" の題材が src/topic/index.ts の topics に無い`);
  const outputPath =
    language === "ja" ? "docs/lesson-text.txt" : `docs/lesson-text.${language}.txt`;
  mkdirSync("docs", { recursive: true });
  writeFileSync(outputPath, `${topicLines(topic, language).join("\n")}\n`);
  console.log(`${outputPath} に ${topic.lessons.length} レッスンの文言を書き出した`);
} catch (error) {
  console.error(`文言を書き出せなかった: ${error.message}`);
  process.exit(1);
}
