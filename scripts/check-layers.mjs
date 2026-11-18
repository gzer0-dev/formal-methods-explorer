#!/usr/bin/env node
// 層の依存方向の静的検査。CLAUDE.md の「触ってよい層／共有基盤」の境界を機械的に守る。
//
// ルール:
//   core  → topic / ui を import 禁止（core は題材にも画面にも依存しない純粋な TS）
//   topic → ui を import 禁止（題材はデータと計算だけ。画面の作りを知らない）
//   ui    → topic を import 禁止（画面は題材を引数で受け取る。特定の題材に縛られない）
// 層に属さないファイル (main.ts 等) は制限しない。配線は main.ts だけが行う。
//
// ⚠ この検査は「層に属するファイル」しか見ない。層を別名にしたり中身を層の外へ移したりすると
// 違反 0 件ではなく対象 0 件になる。なので、いま何件を見ているかを必ず出力し、0 件なら落とす。

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = resolve("src");
const LAYERS = ["core", "topic", "ui"];

// importer の層 → import してはならない層。
const FORBIDDEN = {
  core: ["topic", "ui"],
  topic: ["ui"],
  ui: ["topic"],
};

function listTsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listTsFiles(abs));
    else if (entry.name.endsWith(".ts")) files.push(abs);
  }
  return files;
}

/** src からの相対パスの先頭ディレクトリを層名として返す。層外は null。 */
export function layerOf(absPath, srcDir = SRC_DIR) {
  const rel = relative(srcDir, absPath);
  if (rel.startsWith("..")) return null;
  const top = rel.split(sep)[0];
  return LAYERS.includes(top) ? top : null;
}

/** import / export ... from "..." と副作用 import "..." の指定子を抜き出す。 */
export function importSpecifiers(source) {
  const specifiers = [];
  const fromRe = /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/g;
  const bareRe = /(?:^|\n)\s*import\s+["']([^"']+)["']/g;
  for (const re of [fromRe, bareRe]) {
    for (const match of source.matchAll(re)) specifiers.push(match[1]);
  }
  return specifiers;
}

/**
 * 「いま何件を見ているか」の内訳。**違反 0 件と対象 0 件を見分けるためにある**。
 *
 * @returns {{files: number, guarded: number, edges: number, perLayer: Record<string, number>}}
 */
export function emptyCoverage() {
  return { files: 0, guarded: 0, edges: 0, perLayer: {} };
}

/** 対象が 0 件で「検査が何も見ていない」状態の理由。問題が無ければ空配列。 */
export function coverageProblems(coverage) {
  const problems = [];
  if (coverage.files === 0)
    problems.push("src/ に .ts が 1 つも無い（検査対象が 0 件）");
  if (coverage.guarded === 0) {
    problems.push(
      `制限のある層 (${Object.keys(FORBIDDEN).join(" / ")}) のファイルが 0 件` +
        "（層の名前を変えたか、中身を層の外へ移した可能性がある）",
    );
  }
  for (const layer of Object.keys(FORBIDDEN)) {
    if ((coverage.perLayer[layer] ?? 0) === 0) {
      problems.push(
        `src/${layer}/ のファイルが 0 件（この層の禁止ルールは誰にも当たっていない）`,
      );
    }
  }
  if (coverage.guarded > 0 && coverage.edges === 0) {
    problems.push(
      "制限のある層からの相対 import が 0 件（読み取りが壊れている可能性がある）",
    );
  }
  return problems;
}

function main() {
  const violations = [];
  const coverage = emptyCoverage();

  for (const file of listTsFiles(SRC_DIR)) {
    coverage.files += 1;
    const fromLayer = layerOf(file);
    if (fromLayer !== null) {
      coverage.perLayer[fromLayer] = (coverage.perLayer[fromLayer] ?? 0) + 1;
    }
    const forbidden = FORBIDDEN[fromLayer];
    if (!forbidden) continue;
    coverage.guarded += 1;
    // テストは仕様上ロジックと同層に併置されるため同じルールを適用する。
    const source = readFileSync(file, "utf8");
    for (const spec of importSpecifiers(source)) {
      if (!spec.startsWith(".")) continue; // node_modules は対象外。
      coverage.edges += 1;
      const toLayer = layerOf(resolve(dirname(file), spec));
      if (toLayer && forbidden.includes(toLayer)) {
        violations.push(
          `  ${relative(process.cwd(), file)} (${fromLayer}) → "${spec}" (${toLayer})`,
        );
      }
    }
  }

  const perLayer = LAYERS.map(
    (layer) => `${layer} ${coverage.perLayer[layer] ?? 0}`,
  ).join(" / ");
  console.log(
    `layer dependencies: .ts ${coverage.files} 件 (${perLayer})、` +
      `制限のある層 ${coverage.guarded} 件から相対 import ${coverage.edges} 件を見た`,
  );

  const problems = coverageProblems(coverage);
  if (problems.length > 0) {
    console.error("この検査は何も見ていない（対象が 0 件）:");
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      "  層の名前を変えたなら check-layers.mjs の LAYERS / FORBIDDEN も一緒に直すこと。",
    );
    process.exit(1);
  }

  if (violations.length > 0) {
    console.error(
      "layer dependency violations (core は topic / ui を知らず、topic と ui は互いを知らない):",
    );
    for (const v of violations) console.error(v);
    process.exit(1);
  }
  console.log("layer dependencies: ok");
}

// テストから import されたときは走らせない（直接起動したときだけ検査する）。
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
