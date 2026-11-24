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

function runProb(args, file = "Models.csp") {
  const result = spawnSync(
    probcli,
    file === "Models.csp" ? [...args, file] : [file, ...args],
    {
      cwd: here,
      encoding: "utf8",
      env: { ...process.env, PATH: `${javaBin}:${process.env.PATH}` },
    },
  );
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
  // 並べ替えネットワーク（サイトの in.0 / out.0 は CSPM では c.in0 / c.out0）
  {
    name: "並べ替え: 仕様 [F= ネットワーク",
    run: () => runProb(["-cspref", "SortSpec", "[F=", "SortNetObserved"]),
    expect: succeeded,
  },
  {
    name: "並べ替え: ネットワーク [F= 仕様（等価）",
    run: () => runProb(["-cspref", "SortNetObserved", "[F=", "SortSpec"]),
    expect: succeeded,
  },
  {
    name: "並べ替え: 仕様 [FD= ネットワーク",
    run: () => runProb(["-cspref", "SortSpec", "[FD=", "SortNetObserved"]),
    expect: succeeded,
  },
  {
    name: "並べ替え: ネットワーク [FD= 仕様",
    run: () => runProb(["-cspref", "SortNetObserved", "[FD=", "SortSpec"]),
    expect: succeeded,
  },
  {
    name: "並べ替え: 比較器を忘れた配線は [in.0.0, in.1.0, out.0.0] で仕様を破る",
    run: () => runProb(["-cspref", "SortSpec", "[T=", "SortNetMissingObserved"]),
    expect: failed,
    trace: ["c.in0.0", "c.in1.0", "c.out0.0"],
  },
  // 失敗発散詳細化
  {
    name: "隠したリトライ: トレースでは仕様を満たす",
    run: () => runProb(["-cspref", "SucceedSpec", "[T=", "JobUnlimitedHidden"]),
    expect: succeeded,
  },
  {
    name: "隠したリトライ: 失敗でも仕様を満たす",
    run: () => runProb(["-cspref", "SucceedSpec", "[F=", "JobUnlimitedHidden"]),
    expect: succeeded,
  },
  {
    name: "隠したリトライ: 失敗発散では破れる",
    run: () => runProb(["-cspref", "SucceedSpec", "[FD=", "JobUnlimitedHidden"]),
    expect: failed,
  },
  // 代数法則
  {
    name: "法則 P □ STOP = P（左 ⊑FD 右）",
    run: () => runProb(["-cspref", "ExtStopLeft", "[FD=", "LawP"]),
    expect: succeeded,
  },
  {
    name: "法則 P □ STOP = P（右 ⊑FD 左）",
    run: () => runProb(["-cspref", "LawP", "[FD=", "ExtStopLeft"]),
    expect: succeeded,
  },
  {
    name: "法則 (a→P)□(a→Q) = a→(P⊓Q)（左 ⊑FD 右）",
    run: () => runProb(["-cspref", "ExtSameLeft", "[FD=", "ExtSameRight"]),
    expect: succeeded,
  },
  {
    name: "法則 (a→P)□(a→Q) = a→(P⊓Q)（右 ⊑FD 左）",
    run: () => runProb(["-cspref", "ExtSameRight", "[FD=", "ExtSameLeft"]),
    expect: succeeded,
  },
  {
    name: "非法則 a→(P□Q) と (a→P)□(a→Q): トレースは等しい",
    run: () => runProb(["-cspref", "PrefixExtLeft", "[T=", "ExtSameLeft"]),
    expect: succeeded,
  },
  {
    name: "非法則 a→(P□Q) と (a→P)□(a→Q): 失敗では破れる",
    run: () => runProb(["-cspref", "PrefixExtLeft", "[F=", "ExtSameLeft"]),
    expect: failed,
  },
  // 抽象化・匿名性
  {
    name: "抽象化: 哲学者0だけを見たトレースは小さな仕様と等しい（仕様 ⊑T）",
    run: () => runProb(["-cspref", "FocusSpec", "[T=", "FocusSym"]),
    expect: succeeded,
  },
  {
    name: "抽象化: 同（逆向き）",
    run: () => runProb(["-cspref", "FocusSym", "[T=", "FocusSpec"]),
    expect: succeeded,
  },
  {
    name: "抽象化: 全員左からは失敗詳細化で破れる（pick.0.0 の後）",
    run: () => runProb(["-cspref", "FocusSpec", "[F=", "FocusSym"]),
    expect: failed,
    trace: ["pick.0.0"],
  },
  {
    name: "抽象化: 1人逆順は失敗詳細化を満たす",
    run: () => runProb(["-cspref", "FocusSpec", "[F=", "FocusAsym"]),
    expect: succeeded,
  },
  {
    name: "抽象化: 1人逆順でも、隠したことで失敗発散では破れる",
    run: () => runProb(["-cspref", "FocusSpec", "[FD=", "FocusAsym"]),
    expect: failed,
  },
  {
    name: "匿名性: 0と1が払ったときは失敗まで等しい（0 ⊑F 1）",
    run: () => runProb(["-cspref", "Paid0", "[F=", "Paid1"]),
    expect: succeeded,
  },
  {
    name: "匿名性: 同（1 ⊑F 0）",
    run: () => runProb(["-cspref", "Paid1", "[F=", "Paid0"]),
    expect: succeeded,
  },
  {
    name: "匿名性: 1と2も等しい（1 ⊑F 2）",
    run: () => runProb(["-cspref", "Paid1", "[F=", "Paid2"]),
    expect: succeeded,
  },
  {
    name: "匿名性: 同（2 ⊑F 1）",
    run: () => runProb(["-cspref", "Paid2", "[F=", "Paid1"]),
    expect: succeeded,
  },
  {
    name: "匿名性: 誰も払っていないときとは区別できる",
    run: () => runProb(["-cspref", "PaidNone", "[T=", "Paid0"]),
    expect: failed,
  },
  {
    name: "匿名性: コインが漏れると0と1は区別できる",
    run: () => runProb(["-cspref", "Leak0", "[T=", "Leak1"]),
    expect: failed,
  },
  {
    name: "匿名性: コインが漏れても1と2は区別できない（1 ⊑T 2）",
    run: () => runProb(["-cspref", "Leak1", "[T=", "Leak2"]),
    expect: succeeded,
  },
  {
    name: "匿名性: 同（2 ⊑T 1）",
    run: () => runProb(["-cspref", "Leak2", "[T=", "Leak1"]),
    expect: succeeded,
  },
  // 送受信待ちの取り消し（終わった後は idle を繰り返す版で、本物のデッドロックだけを見る）
  {
    name: "取り消し: 待ち続けると、依頼が落ちたときデッドロック",
    run: () => runProb(["-cspdeadlock", "CancelWaitIdle", "F"]),
    expect: failed,
    trace: ["req", "DEADLOCKS"],
  },
  {
    name: "取り消し: タイムアウトだけだと、遅れたサーバーが止まる",
    run: () => runProb(["-cspdeadlock", "CancelTimeoutIdle", "F"]),
    expect: failed,
    trace: ["req", "timeout", "giveup", "work", "DEADLOCKS"],
  },
  {
    name: "取り消し: タイムアウト＋取り消しはデッドロックしない",
    run: () => runProb(["-cspdeadlock", "CancelFixedIdle", "F"]),
    expect: succeeded,
  },
  // 追加の照合（交換則・上限付きジョブ・発散する仕様）
  {
    name: "法則 P □ Q = Q □ P（左 ⊑FD 右）",
    run: () => runProb(["-cspref", "ExtPQ", "[FD=", "ExtQP"]),
    expect: succeeded,
  },
  {
    name: "法則 P □ Q = Q □ P（右 ⊑FD 左）",
    run: () => runProb(["-cspref", "ExtQP", "[FD=", "ExtPQ"]),
    expect: succeeded,
  },
  {
    name: "上限付きジョブ: succeed か giveup の仕様を ⊑T で満たす",
    run: () => runProb(["-cspref", "SucceedOrGiveUp", "[T=", "JobLimitedHidden"]),
    expect: succeeded,
  },
  {
    name: "上限付きジョブ: 同 ⊑F",
    run: () => runProb(["-cspref", "SucceedOrGiveUp", "[F=", "JobLimitedHidden"]),
    expect: succeeded,
  },
  {
    name: "上限付きジョブ: 同 ⊑FD",
    run: () => runProb(["-cspref", "SucceedOrGiveUp", "[FD=", "JobLimitedHidden"]),
    expect: succeeded,
  },
  {
    name: "上限付きジョブ: succeed だけの仕様にはトレースで破れる",
    run: () => runProb(["-cspref", "SucceedSpec", "[T=", "JobLimitedHidden"]),
    expect: failed,
  },
  {
    name: "発散する仕様の後は何でもあり",
    run: () => runProb(["-cspref", "DivergingSpec", "[FD=", "AnyImpl"]),
    expect: succeeded,
  },
  // 決定性（flaky なテストの原因）
  {
    name: "決定性: ロック無しのカウンタは非決定的（finish の後）",
    run: () => runProb(["-cspdeterministic", "NaiveObserved", "F"]),
    expect: failed,
    contains: "go(finish",
  },
  {
    name: "決定性: ロックありのカウンタは決定的",
    run: () => runProb(["-cspdeterministic", "LockedObserved", "F"]),
    expect: succeeded,
  },
  {
    name: "決定性: 勝手に断るプリンタは非決定的",
    run: () => runProb(["-cspdeterministic", "PrinterImpl", "F"]),
    expect: failed,
  },
  {
    name: "決定性: 仕様のプリンタは決定的",
    run: () => runProb(["-cspdeterministic", "PrinterSpec", "F"]),
    expect: succeeded,
  },
  // Lazy 抽象化
  {
    name: "Lazy 抽象化: 哲学者0は、ほかの人が止まると止まりうる（失敗詳細化で破れる）",
    run: () => runProb(["-cspref", "FocusSpec", "[F=", "LazyFocusAsym"]),
    expect: failed,
  },
  // 共用チャネルと飢餓（LTL は MAIN を決めた包みのファイルで調べる）
  {
    name: "飢餓: 好きな順の受け箱では、B が頼んでも応答が来ない実行がある",
    run: () =>
      runProb(["-ltlformula", "G([preq.CB] => F [presp.CB])"], "MainPoolAny.csp"),
    expect: failed,
  },
  {
    name: "飢餓: 先着順の受け箱では、B は必ず応答をもらえる",
    run: () =>
      runProb(["-ltlformula", "G([preq.CB] => F [presp.CB])"], "MainPoolFifo.csp"),
    expect: succeeded,
  },
  // チャネル渡し
  {
    name: "チャネル渡し: 空きを覚える振り分け役は同じセッションを2人に渡さない",
    run: () => runProb(["-cspref", "Exclusive", "[T=", "SessionViewOk"]),
    expect: succeeded,
  },
  {
    name: "チャネル渡し: 空きを覚えない振り分け役は [assign.A.s1, assign.B.s1] で破れる",
    run: () => runProb(["-cspref", "Exclusive", "[T=", "SessionViewBug"]),
    expect: failed,
    trace: ["assign.CA.s1", "assign.CB.s1"],
  },
  // 名前の付け替えでつなぐパイプとバッファ
  {
    name: "パイプ: セルを2つつなぐと、2要素のバッファの仕様を ⊑F で満たす",
    run: () => runProb(["-cspref", "PBuff2", "[F=", "PChain2"]),
    expect: succeeded,
  },
  {
    name: "パイプ: 2要素のバッファの仕様も、セル2つのパイプを ⊑F で満たす（両向きで等しい）",
    run: () => runProb(["-cspref", "PChain2", "[F=", "PBuff2"]),
    expect: succeeded,
  },
  {
    name: "パイプ: セル1つは、1つ入れた後に次の入力を断るので ⊑F で破れる",
    run: () => runProb(["-cspref", "PBuff2", "[F=", "PChain1"]),
    expect: failed,
  },
  {
    name: "パイプ: セル3つは [pin.0, pin.0, pin.0] で ⊑T を破る",
    run: () => runProb(["-cspref", "PBuff2", "[T=", "PChain3"]),
    expect: failed,
    trace: ["pin.0", "pin.0", "pin.0"],
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
