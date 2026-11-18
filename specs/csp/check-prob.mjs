// サイトの CSP の実装（src/topic/csp.ts）と同じモデルを CSPM で書き（Models.csp）、ProB の結果がサイトと一致するかを確かめる。
// 期待値は src/topic/csp.test.ts・cspModels.test.ts と CLAUDE.md の「CSP のレッスン」と同じ。どちらかを変えたら両方直す。
//
//   node specs/csp/check-prob.mjs
//
// ProB（probcli）と Java が要る。場所は環境変数 PROBCLI / JAVA_HOME_BIN で変えられる。
// 注意: ProB は SKIP で正しく終わった状態もデッドロックとして報告する（a → SKIP でも「tick の後で DEADLOCKS」）。
// サイトの検査器は ✓ で終わった状態をデッドロックに数えないので、その差もここで固定して見張る。

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const probcli =
  process.env.PROBCLI ?? join(homedir(), ".local/share/prob/ProB/probcli");
const javaBin = process.env.JAVA_HOME_BIN ?? "/opt/homebrew/opt/openjdk@21/bin";

function runProb(args) {
  const result = spawnSync(probcli, [...args, "Models.csp"], {
    cwd: here,
    encoding: "utf8",
    env: { ...process.env, PATH: `${javaBin}:${process.env.PATH}` },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** ProB の反例 [GO:,a,GO:,b,...] から、見えるイベントの並びを取り出す（τ と区切りの語は除く）。 */
function counterexampleTrace(output) {
  const match = output.match(/^\[GO:.*\]$/m);
  if (!match) return null;
  const tokens = match[0].slice(1, -1).split(",");
  const trace = [];
  for (const token of tokens) {
    if (token.endsWith(":") || token === "GO:") {
      if (token !== "GO:") break; // At_last_step_… や CANNOT_REFUSE… から先は反例の説明
      continue;
    }
    if (token === "tau") continue;
    trace.push(token);
  }
  return trace;
}

const succeeded = (r) => r.status === 0 && !/error occurred/.test(r.output);
const failed = (r) => r.status !== 0 || /error occurred/.test(r.output);

const cases = [
  {
    name: "カウンタ: 仕様「最後は2」をロック無しは [finish, result.1] で破る",
    run: () => runProb(["-cspref", "ResultSpec", "[T=", "NaiveObserved"]),
    expect: failed,
    trace: ["finish", "result.1"],
  },
  {
    name: "カウンタ: ロックありは仕様を満たす",
    run: () => runProb(["-cspref", "ResultSpec", "[T=", "LockedObserved"]),
    expect: succeeded,
  },
  {
    name: "プリンタ: トレース詳細化は成り立つ",
    run: () => runProb(["-cspref", "PrinterSpec", "[T=", "PrinterImpl"]),
    expect: succeeded,
  },
  {
    name: "プリンタ: 失敗詳細化は破れ、color を拒否できる",
    run: () => runProb(["-cspref", "PrinterSpec", "[F=", "PrinterImpl"]),
    expect: failed,
    contains: "color",
  },
  {
    name: "プリンタ: 逆向きの失敗詳細化は成り立つ",
    run: () => runProb(["-cspref", "PrinterImpl", "[F=", "PrinterSpec"]),
    expect: succeeded,
  },
  {
    name: "哲学者2人: 2手でデッドロック",
    run: () => runProb(["-cspdeadlock", "Dining2", "F"]),
    expect: failed,
    trace: ["pick.0.0", "pick.1.1", "DEADLOCKS"],
  },
  {
    name: "哲学者3人: 3手でデッドロック",
    run: () => runProb(["-cspdeadlock", "Dining3", "F"]),
    expect: failed,
    trace: ["pick.0.0", "pick.1.1", "pick.2.2", "DEADLOCKS"],
  },
  {
    name: "哲学者2人・1人逆順: デッドロックなし",
    run: () => runProb(["-cspdeadlock", "Dining2Fixed", "F"]),
    expect: succeeded,
  },
  {
    name: "哲学者3人・1人逆順: デッドロックなし",
    run: () => runProb(["-cspdeadlock", "Dining3Fixed", "F"]),
    expect: succeeded,
  },
  {
    name: "ProB は SKIP で終わった状態もデッドロックと報告する（サイトは数えない）",
    run: () => runProb(["-cspdeadlock", "Locked", "F"]),
    expect: failed,
    contains: "tick,DEADLOCKS",
  },
  {
    name: "ジョブ: 無制限を隠すと発散する",
    run: () => runProb(["-csplivelock", "JobUnlimitedHidden"]),
    expect: failed,
  },
  {
    name: "ジョブ: 見えるままなら発散しない",
    run: () => runProb(["-csplivelock", "JobUnlimited"]),
    expect: succeeded,
  },
  {
    name: "ジョブ: 上限付きは隠しても発散しない",
    run: () => runProb(["-csplivelock", "JobLimitedHidden"]),
    expect: succeeded,
  },
];

let failures = 0;
for (const testCase of cases) {
  const result = testCase.run();
  const problems = [];
  if (/parsing_csp|ParseError/.test(result.output))
    problems.push("ProB が CSPM を読めなかった");
  if (!testCase.expect(result))
    problems.push(`期待した結果にならない（終了コード ${result.status}）`);
  if (testCase.trace) {
    const trace = counterexampleTrace(result.output);
    if (JSON.stringify(trace) !== JSON.stringify(testCase.trace))
      problems.push(`反例 ${JSON.stringify(trace)}`);
  }
  if (testCase.contains && !result.output.includes(testCase.contains))
    problems.push(`「${testCase.contains}」が出ない`);
  if (problems.length > 0) {
    failures += 1;
    console.error(`✗ ${testCase.name}: ${problems.join("、")}`);
    if (process.env.SHOW_PROB_OUTPUT) console.error(result.output);
  } else {
    console.log(`✓ ${testCase.name}`);
  }
}

if (failures > 0) {
  console.error(`ProB との照合: ${failures} 件が食い違った`);
  process.exit(1);
}
console.log(`ProB との照合: ${cases.length} 件すべて一致`);
