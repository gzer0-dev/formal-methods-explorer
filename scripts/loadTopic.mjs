// 題材（src/topic/index.ts）を Node から読み込む。esbuild で1つのファイルにまとめてから import する。
// 文言の書き出し（dump-text.mjs）と、検索向けの静的な本文の書き出し（prerender.mjs）で使う。

import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

const BUNDLE_DIR = resolve("node_modules/.cache/load-topic");

export async function loadTopic() {
  mkdirSync(BUNDLE_DIR, { recursive: true });
  const bundlePath = join(BUNDLE_DIR, `topic-${process.pid}-${Date.now()}.mjs`);
  await build({
    entryPoints: ["src/topic/index.ts"],
    bundle: true,
    format: "esm",
    outfile: bundlePath,
    logLevel: "error",
  });
  try {
    return (await import(pathToFileURL(bundlePath).href)).topic;
  } finally {
    rmSync(bundlePath, { force: true });
  }
}
