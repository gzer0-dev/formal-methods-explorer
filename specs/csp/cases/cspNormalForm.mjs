// csp-normal-form の照合。期待値は src/topic/cspNormalForm.test.ts と同じ。
// ProB は正規形そのものを出さないので、手で書いた正規形 NF0 と仕様が両向きに等しいことと、実装3つの合否を見る。
const FILE = "cases/cspNormalForm.csp";

export default ({ runProb, succeeded, failed }) => [
  {
    name: "正規形: 手で書いた正規形は仕様を満たす（SERVER [FD= NF0）",
    run: () => runProb(["-cspref", "SERVER", "[FD=", "NF0"], FILE),
    expect: succeeded,
  },
  {
    name: "正規形: 仕様は手で書いた正規形を満たす（NF0 [FD= SERVER）",
    run: () => runProb(["-cspref", "NF0", "[FD=", "SERVER"], FILE),
    expect: succeeded,
  },
  {
    name: "正規形: good は仕様を満たす（[F=）",
    run: () => runProb(["-cspref", "SERVER", "[F=", "IMPL_GOOD"], FILE),
    expect: succeeded,
  },
  {
    name: "正規形: eager は ⟨ok⟩ でトレースを破る",
    run: () => runProb(["-cspref", "SERVER", "[T=", "IMPL_EAGER"], FILE),
    expect: failed,
    trace: ["ok"],
  },
  {
    name: "正規形: nocancel はトレースでは仕様を満たす",
    run: () => runProb(["-cspref", "SERVER", "[T=", "IMPL_NOCANCEL"], FILE),
    expect: succeeded,
  },
  {
    name: "正規形: nocancel は cancel を断るので失敗で破れる",
    run: () => runProb(["-cspref", "SERVER", "[F=", "IMPL_NOCANCEL"], FILE),
    expect: failed,
  },
];
