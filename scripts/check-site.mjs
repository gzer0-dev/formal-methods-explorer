#!/usr/bin/env node
// ビルド成果物（dist/）が、公開したときに壊れていないかを見る。
//
//   1. index.html に置き換え忘れの %SITE_...% が残っていない
//   2. title・description・canonical・og:url が topic.config.json と一致する
//   3. robots.txt と sitemap.xml が公開 URL を指している
//   4. index.html が読み込むローカルのファイル（script・stylesheet・icon）の実体がある
//   5. 公開 URL が見本のまま（example.com）になっていない … 警告のみ。公開前に直す
//   6. #app に静的なレッスンの本文が書き込まれている（検索エンジン・SNS のプレビュー向け。0 件なら落とす）
//   7. og:image があれば、公開 URL の下を指し、dist にその画像の実体がある
//
// 「在るか」ではなく「中身が合っているか」を見る。4 は見た件数を出力し、0 件なら落とす
// （対象が 0 件のまま合格を出し続ける検査にしないため）。

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = "dist";

/** index.html が取りに行くローカルのファイル（外部 URL と data: は除く）。 */
export function localRefs(html) {
  const refs = [];
  const patterns = [
    /<script[^>]*\ssrc="([^"]+)"/g,
    /<link[^>]*\srel="(?:stylesheet|icon|modulepreload)"[^>]*\shref="([^"]+)"/g,
    /<link[^>]*\shref="([^"]+)"[^>]*\srel="(?:stylesheet|icon|modulepreload)"/g,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const ref = match[1];
      if (/^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith("data:")) continue;
      refs.push(ref.replace(/^\.?\//, ""));
    }
  }
  return [...new Set(refs)];
}

export function metaContent(html, attribute, name) {
  const pattern = new RegExp(`<meta ${attribute}="${name}" content="([^"]*)"`);
  return html.match(pattern)?.[1] ?? null;
}

/** prerender.mjs が #app に書き込んだ静的なレッスンの数。 */
export function staticLessonCount(html) {
  return (html.match(/<section class="static-lesson"/g) ?? []).length;
}

/** og:image の dist の中のファイル名。meta が無ければ null、公開 URL の外を指していれば undefined。 */
export function ogImageFile(html, siteUrl) {
  const url = metaContent(html, "property", "og:image");
  if (url === null) return null;
  return url.startsWith(siteUrl) ? url.slice(siteUrl.length) : undefined;
}

function unescapeHtml(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function main() {
  const problems = [];
  let html;
  let site;
  try {
    html = readFileSync(join(DIST, "index.html"), "utf8");
    site = JSON.parse(readFileSync("topic.config.json", "utf8"));
  } catch (error) {
    console.error(`読めなかった: ${error.message}（先に npm run build を実行する）`);
    process.exit(2);
  }

  if (/%SITE_[A-Z_]+%/.test(html))
    problems.push("index.html に %SITE_...% が残っている");

  const title = unescapeHtml(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
  if (title !== site.title) problems.push(`title が設定と違う: "${title}"`);
  const description = unescapeHtml(metaContent(html, "name", "description") ?? "");
  if (description !== site.description) problems.push("description が設定と違う");
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (canonical !== site.url) problems.push(`canonical が設定と違う: "${canonical}"`);
  if (metaContent(html, "property", "og:url") !== site.url) {
    problems.push("og:url が設定と違う");
  }
  if (!site.url.endsWith("/"))
    problems.push("topic.config.json の url が / で終わっていない");

  for (const [file, expected] of [
    ["robots.txt", `Sitemap: ${site.url}sitemap.xml`],
    ["sitemap.xml", `<loc>${site.url}</loc>`],
  ]) {
    const path = join(DIST, file);
    if (!existsSync(path)) problems.push(`${file} が無い`);
    else if (!readFileSync(path, "utf8").includes(expected)) {
      problems.push(`${file} が公開 URL を指していない`);
    }
  }

  const refs = localRefs(html);
  if (refs.length === 0)
    problems.push("index.html が読み込むファイルを 1 件も見つけられない");
  for (const ref of refs) {
    if (!existsSync(join(DIST, ref))) problems.push(`読み込み先の実体が無い: ${ref}`);
  }

  const lessonCount = staticLessonCount(html);
  if (lessonCount === 0)
    problems.push("#app に静的なレッスンの本文が無い（prerender が走っていない）");
  const ogImage = ogImageFile(html, site.url);
  if (ogImage === undefined) problems.push("og:image が公開 URL の外を指している");
  else if (ogImage !== null && !existsSync(join(DIST, ogImage))) {
    problems.push(`og:image の実体が無い: ${ogImage}`);
  }

  console.log(
    `site check: 読み込み先 ${refs.length} 件の実体と、メタ情報 4 項目と、静的な本文 ${lessonCount} レッスン` +
      `${ogImage ? "と og:image" : ""}を見た`,
  );
  if (site.url.includes("example.com")) {
    console.warn(
      "⚠ 公開 URL が見本のまま（example.com）。公開前に topic.config.json を直す",
    );
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log("site check: ok");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
