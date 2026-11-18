// サイトの全列挙（src/topic/smallScope.ts）と同じ関係を Alloy で書き、形の数と反例の数が一致するかを確かめる。
// 期待値は src/topic/methods.test.ts と CLAUDE.md の「この題材の不変条件」と同じ数字。
//
//   node specs/alloy/check-alloy.mjs
//
// Java と Alloy 6 の jar が要る。場所は環境変数 JAVA / ALLOY_JAR で変えられる。

import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const java = process.env.JAVA ?? "/opt/homebrew/opt/openjdk@21/bin/java";
const alloyJar =
  process.env.ALLOY_JAR ??
  join(homedir(), ".local/share/alloy/org.alloytools.alloy.dist.jar");

/** 1 つのコマンドを実行し、コンソールに出た出力を返す。-o - なので出力用のフォルダは作られない。 */
function runAlloy(command, options) {
  return execFileSync(
    java,
    [
      "-jar",
      alloyJar,
      "exec",
      ...options,
      "-t",
      "text",
      "-o",
      "-",
      "-c",
      command,
      "Boss.als",
    ],
    {
      cwd: here,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

/** 解を全部列挙して数える。-y 0 で対称性の除去を切る（一般には入れ替えただけの形をまとめるため。このモデルでは数は変わらない）。 */
function countInstances(command) {
  return (runAlloy(command, ["-q", "-r", "0", "-y", "0"]).match(/---Trace---/g) ?? [])
    .length;
}

/** check の最初の反例の上司の関係。反例が無ければ null。 */
function firstCounterexample(command) {
  const match = runAlloy(command, ["-q"]).match(/this\/Person<:boss=\{([^}]*)\}/);
  return match ? match[1] : null;
}

const counts = [
  { command: "AllShapes", expected: 64, name: "制約なしの形" },
  { command: "CounterNoFacts", expected: 48, name: "制約なしの反例" },
  { command: "NoSelfShapes", expected: 27, name: "自分を上司にしない形" },
  { command: "CounterNoSelf", expected: 11, name: "自分を上司にしないときの反例" },
  { command: "BothShapes", expected: 16, name: "制約2つの形" },
  { command: "CounterBoth", expected: 0, name: "制約2つのときの反例" },
];
const checks = [
  { command: "NoFacts", hasCounterexample: true, name: "check 制約なし" },
  { command: "WithNoSelf", hasCounterexample: true, name: "check 自分を上司にしない" },
  { command: "WithBoth", hasCounterexample: false, name: "check 制約2つ" },
];

let failures = 0;
const report = (isOk, message) => {
  if (!isOk) failures += 1;
  (isOk ? console.log : console.error)(`${isOk ? "✓" : "✗"} ${message}`);
};

for (const { command, expected, name } of counts) {
  const actual = countInstances(command);
  report(actual === expected, `${name}: ${actual}通り（サイトは ${expected}通り）`);
}
for (const { command, hasCounterexample, name } of checks) {
  const found = firstCounterexample(command);
  report(
    (found !== null) === hasCounterexample,
    `${name}: ${found === null ? "反例なし" : `反例 ${found}`}`,
  );
}

if (failures > 0) {
  console.error(`Alloy との照合: ${failures} 件が食い違った`);
  process.exit(1);
}
console.log(`Alloy との照合: ${counts.length + checks.length} 件すべて一致`);
