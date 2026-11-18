#!/usr/bin/env node
// ビルドした dist/index.html に、全レッスンの題・要約・ステップの説明を静的な HTML として書き込む。
// 本文は JavaScript で描くので、そのままでは JavaScript を動かさない検索エンジンや SNS のプレビューに本文が見えない。
// 書き込む先は #app の中で、JavaScript が動くと画面が置き換える（root.replaceChildren）。
// public/og.png があれば、og:image と大きい画像のカードの meta も足す。
//
//   node scripts/prerender.mjs   （npm run build の最後に走る）

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = "dist";

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 題材を、見出しと段落だけの素朴な HTML にする（画面が置き換えるまでの間と、JavaScript を動かさない読み手のため）。 */
export function renderStaticTopic(topic) {
  const parts = [
    '<main class="static-topic">',
    `<h1>${escapeHtml(topic.title)}</h1>`,
    `<p>${escapeHtml(topic.tagline)}</p>`,
  ];
  for (const lesson of topic.lessons) {
    parts.push(
      `<section class="static-lesson" id="static-${escapeHtml(lesson.id)}">`,
      `<h2>${escapeHtml(lesson.title)}</h2>`,
      `<p>${escapeHtml(lesson.subtitle)}</p>`,
      `<p>${escapeHtml(lesson.summary)}</p>`,
      "<ol>",
      ...lesson.steps.map(
        (step) =>
          `<li><strong>${escapeHtml(step.title)}</strong> ${escapeHtml(step.explain)}</li>`,
      ),
      "</ol>",
      "</section>",
    );
  }
  parts.push("</main>");
  return parts.join("\n");
}

export function injectStatic(html, staticHtml) {
  const marker = '<div id="app"></div>';
  if (!html.includes(marker))
    throw new Error('index.html に空の <div id="app"></div> が無い');
  return html.replace(marker, `<div id="app">${staticHtml}</div>`);
}

export function addOgImage(html, imageUrl) {
  const tags =
    `    <meta property="og:image" content="${escapeHtml(imageUrl)}" />\n` +
    `    <meta name="twitter:card" content="summary_large_image" />\n`;
  return html.replace("</head>", `${tags}  </head>`);
}

async function main() {
  const { loadTopic } = await import("./loadTopic.mjs");
  const indexPath = join(DIST, "index.html");
  const site = JSON.parse(readFileSync("topic.config.json", "utf8"));
  const topic = await loadTopic();
  let html = injectStatic(readFileSync(indexPath, "utf8"), renderStaticTopic(topic));
  if (existsSync(join(DIST, "og.png"))) html = addOgImage(html, `${site.url}og.png`);
  writeFileSync(indexPath, html);
  console.log(
    `prerender: ${topic.lessons.length} レッスンの本文を index.html に書き込んだ`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`静的な本文を書き込めなかった: ${error.message}`);
    process.exit(1);
  });
}
