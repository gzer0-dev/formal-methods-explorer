// サイトの自作検査器（src/topic/models.ts）と同じモデルを TLA+ で書き、TLC の結果がサイトの数字と一致するかを確かめる。
// 期待値は src/topic/models.test.ts と CLAUDE.md の「この題材の不変条件」と同じ数字。どちらかを変えたら両方直す。
//
//   node specs/tla/check-tlc.mjs
//
// Java と tla2tools.jar が要る。場所は環境変数 JAVA / TLA2TOOLS で変えられる。

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const java = process.env.JAVA ?? "/opt/homebrew/opt/openjdk@21/bin/java";
const tla2tools =
  process.env.TLA2TOOLS ?? join(homedir(), ".local/share/tlaplus/tla2tools.jar");

/** 1 つの設定で TLC を走らせ、出力を返す（違反が見つかると TLC は 0 以外で終わるので、終了コードでは判定しない）。 */
function runTlc(module, cfg, flags = []) {
  const work = mkdtempSync(join(tmpdir(), "tlc-"));
  try {
    const cfgPath = join(work, "model.cfg");
    writeFileSync(cfgPath, cfg);
    try {
      return execFileSync(
        java,
        [
          "-XX:+UseParallelGC",
          "-cp",
          tla2tools,
          "tlc2.TLC",
          "-workers",
          "1",
          "-metadir",
          join(work, "states"),
          "-config",
          cfgPath,
          ...flags,
          `${module}.tla`,
        ],
        { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      return `${error.stdout ?? ""}${error.stderr ?? ""}`;
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function distinctStates(output) {
  const matches = [...output.matchAll(/(\d+) distinct states found/g)];
  return matches.length > 0 ? Number(matches.at(-1)[1]) : null;
}

function traceLength(output) {
  return (output.match(/^State \d+:/gm) ?? []).length;
}

// JS の true/false をそのまま書くと、TLC は小文字の false を「モデル値」と読む。TLA+ の TRUE/FALSE に直す。
const tla = (flag) => (flag ? "TRUE" : "FALSE");

const counter = (n, atomic) =>
  `CONSTANTS N = ${n}\nAtomic = ${tla(atomic)}\nSPECIFICATION Spec\nINVARIANT Correct\n`;
const locks = (same) => `CONSTANT SameOrder = ${tla(same)}\nSPECIFICATION Spec\n`;
const order = (bug) =>
  `CONSTANT ShipBug = ${tla(bug)}\nSPECIFICATION Spec\nINVARIANT PaidBeforeShip\n`;
const job = (unlimited, spec) =>
  `CONSTANTS MaxRetries = 2\nUnlimited = ${tla(unlimited)}\nSPECIFICATION ${spec}\nPROPERTY EventuallyFinished\n`;

const INVARIANT_BROKEN = /Invariant \w+ is violated/;
const DEADLOCK = /Deadlock reached/;
const TEMPORAL_BROKEN = /Temporal properties were violated/;
const NO_ERROR = /No error has been found/;

const cases = [
  // カウンタ: 全状態の数（-continue で違反後もたどる、-deadlock で終わりの状態を止めない）
  {
    name: "カウンタ 2プロセス・2手: 12状態",
    run: () => runTlc("Counter", counter(2, false), ["-continue", "-deadlock"]),
    distinct: 12,
  },
  {
    name: "カウンタ 2プロセス・1手: 4状態・違反なし",
    run: () => runTlc("Counter", counter(2, true), ["-deadlock"]),
    distinct: 4,
    expect: NO_ERROR,
  },
  {
    name: "カウンタ 3プロセス・2手: 59状態",
    run: () => runTlc("Counter", counter(3, false), ["-continue", "-deadlock"]),
    distinct: 59,
  },
  {
    name: "カウンタ 3プロセス・1手: 8状態",
    run: () => runTlc("Counter", counter(3, true), ["-deadlock"]),
    distinct: 8,
    expect: NO_ERROR,
  },
  // カウンタ: 最短の反例は 4 手（初期状態を含めて 5 状態）。読む・読む・書く・書くの順。
  {
    name: "カウンタ 2プロセス・2手: 4手の反例",
    run: () => runTlc("Counter", counter(2, false), ["-deadlock"]),
    expect: INVARIANT_BROKEN,
    trace: 5,
    order: ["<Read", "<Read", "<Write", "<Write"],
  },
  // TLC はデッドロックの検査が既定で有効で、正しく終わった状態も報告する（サイトの説明どおり）。
  {
    name: "カウンタ 1手: 既定では正しい終わりもデッドロック",
    run: () => runTlc("Counter", counter(2, true)),
    expect: DEADLOCK,
  },
  // ロック
  {
    name: "ロック 逆順: 2手でデッドロック",
    run: () => runTlc("Locks", locks(false)),
    expect: DEADLOCK,
    trace: 3,
  },
  {
    name: "ロック 逆順: 13状態",
    run: () => runTlc("Locks", locks(false), ["-deadlock"]),
    distinct: 13,
  },
  {
    name: "ロック 同じ順: 12状態・デッドロックなし",
    run: () => runTlc("Locks", locks(true)),
    distinct: 12,
    expect: NO_ERROR,
  },
  // 注文
  {
    name: "注文 書き忘れ: 1手で違反",
    run: () => runTlc("Order", order(true)),
    expect: INVARIANT_BROKEN,
    trace: 2,
  },
  {
    name: "注文 書き忘れ: 8状態",
    run: () => runTlc("Order", order(true), ["-continue"]),
    distinct: 8,
  },
  {
    name: "注文 正しい仕様: 6状態・違反なし",
    run: () => runTlc("Order", order(false)),
    distinct: 6,
    expect: NO_ERROR,
  },
  // ジョブ（活性）: 公平性の置き方ごと
  {
    name: "ジョブ 無制限・公平性なし: 足踏みで違反",
    run: () => runTlc("Job", job(true, "SpecNoFairness")),
    expect: TEMPORAL_BROKEN,
    contains: "Stuttering",
  },
  {
    name: "ジョブ 無制限・WF(Next): 輪で違反",
    run: () => runTlc("Job", job(true, "SpecWF")),
    expect: TEMPORAL_BROKEN,
    contains: "Back to state 1",
  },
  {
    name: "ジョブ 上限2・WF(Next): 成り立つ・10状態",
    run: () => runTlc("Job", job(false, "SpecWF")),
    expect: NO_ERROR,
    distinct: 10,
  },
  {
    name: "ジョブ 無制限・WF(Succeed): 輪は残る",
    run: () => runTlc("Job", job(true, "SpecWFSucceed")),
    expect: TEMPORAL_BROKEN,
  },
  {
    name: "ジョブ 無制限・SF(Succeed): 成り立つ",
    run: () => runTlc("Job", job(true, "SpecSFSucceed")),
    expect: NO_ERROR,
  },
  // 扉の時相論理（利用者の動きは公平性なし、扉の動きは弱い公平性）
  ...[false, true].flatMap((bug) =>
    [
      ["LeadsToOpen", bug ? TEMPORAL_BROKEN : NO_ERROR, "呼べばいつか開く"],
      ["InfinitelyOftenClosed", NO_ERROR, "何度でも閉じる"],
      ["EventuallyAlwaysOpen", TEMPORAL_BROKEN, "ずっと開いたまま"],
      ["Safe", NO_ERROR, "開いている間は呼び出しが残らない"],
    ].map(([property, expect, label]) => ({
      name: `扉（${bug ? "取りこぼしあり" : "正しい"}）: ${label}`,
      run: () =>
        runTlc(
          "Door",
          `CONSTANT HasBug = ${tla(bug)}\nSPECIFICATION Spec\nPROPERTY ${property}\n`,
        ),
      expect,
    })),
  ),
  // 状態爆発: 素朴に書いた哲学者の状態数（サイトの CSP のモデルとも一致）
  ...[
    [2, 10],
    [3, 35],
    [4, 118],
    [5, 392],
  ].map(([n, distinct]) => ({
    name: `哲学者 ${n}人: ${distinct}状態`,
    run: () =>
      runTlc("Philosophers", `CONSTANT N = ${n}\nSPECIFICATION Spec\n`, ["-deadlock"]),
    distinct,
  })),
];

let failures = 0;
for (const testCase of cases) {
  const output = testCase.run();
  const problems = [];
  if (/Parsing or semantic analysis failed|unexpected exception/.test(output))
    problems.push("TLC が仕様か設定を読めなかった");
  if (testCase.expect && !testCase.expect.test(output))
    problems.push(`期待した結果（${testCase.expect}）が出ない`);
  if (testCase.distinct !== undefined && distinctStates(output) !== testCase.distinct) {
    problems.push(`状態数 ${distinctStates(output)}（期待 ${testCase.distinct}）`);
  }
  if (testCase.trace !== undefined && traceLength(output) !== testCase.trace) {
    problems.push(`反例の長さ ${traceLength(output)} 状態（期待 ${testCase.trace}）`);
  }
  if (testCase.contains && !output.includes(testCase.contains))
    problems.push(`「${testCase.contains}」が出ない`);
  if (testCase.order) {
    const actions = (output.match(/^State \d+: (<\w+)/gm) ?? [])
      .map((line) => line.split(": ")[1])
      .filter((action) => action !== "<Initial");
    if (actions.join() !== testCase.order.join())
      problems.push(`反例の順 ${actions.join(" ")}`);
  }
  if (problems.length > 0) {
    failures += 1;
    console.error(`✗ ${testCase.name}: ${problems.join("、")}`);
    if (process.env.SHOW_TLC_OUTPUT) console.error(output);
  } else {
    console.log(`✓ ${testCase.name}`);
  }
}

if (failures > 0) {
  console.error(`TLC との照合: ${failures} 件が食い違った`);
  process.exit(1);
}
console.log(`TLC との照合: ${cases.length} 件すべて一致`);
