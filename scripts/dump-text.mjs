#!/usr/bin/env node
// 題材の文言（題・要約・説明・簡略化の注記・実験の説明）を 1 つのテキストに書き出す。
// 校正のための道具: 書き出した docs/lesson-text.txt を日本語の lint にかけ、通して読む。
//
//   npm run dump:text

import { mkdirSync, writeFileSync } from "node:fs";

import { loadTopic } from "./loadTopic.mjs";

const OUT_FILE = "docs/lesson-text.txt";

/** 題材の文言を、読む順に並べた行の配列にする。 */
export function topicLines(topic) {
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
      if (step.simplified) lines.push(`簡略化: ${step.simplified}`);
      for (const section of step.detail ?? []) {
        lines.push(section.title);
        for (const field of section.fields) if (field.note) lines.push(field.note);
      }
    }
    if (lesson.lab) lines.push(lesson.lab.title, lesson.lab.hint);
  }
  return lines;
}

try {
  const topic = await loadTopic();
  mkdirSync("docs", { recursive: true });
  writeFileSync(OUT_FILE, `${topicLines(topic).join("\n")}\n`);
  console.log(`${OUT_FILE} に ${topic.lessons.length} レッスンの文言を書き出した`);
} catch (error) {
  console.error(`文言を書き出せなかった: ${error.message}`);
  process.exit(1);
}
