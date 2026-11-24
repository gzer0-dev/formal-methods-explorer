// 交互ビットプロトコル（src/topic/cspAbp.ts・cspAbp.test.ts）と ProB の照合。CSPM は cspAbp.csp。
// ビットを使わない版の反例は、ProB がサイト（最短の ⟨in.0, out.0, out.0⟩）と別の長い並びを返すので、破れることだけを見る。
const FILE = "cases/cspAbp.csp";

export default ({ runProb, succeeded, failed }) => [
  {
    name: "交互ビット: 落とす・重複させる通信路でも、1要素のバッファを ⊑T で満たす",
    run: () => runProb(["-cspref", "Copy", "[T=", "AbpLossy"], FILE),
    expect: succeeded,
  },
  {
    name: "交互ビット: 同じく ⊑F で満たす",
    run: () => runProb(["-cspref", "Copy", "[F=", "AbpLossy"], FILE),
    expect: succeeded,
  },
  {
    name: "交互ビット: 仕様の側からも ⊑F（両向きで等しい）",
    run: () => runProb(["-cspref", "AbpLossy", "[F=", "Copy"], FILE),
    expect: succeeded,
  },
  {
    name: "交互ビット: 落とし続けられるので、in.0 の後に発散して ⊑FD を破る",
    run: () => runProb(["-cspref", "Copy", "[FD=", "AbpLossy"], FILE),
    expect: failed,
    trace: ["in.0", "DIVERGES"],
  },
  {
    name: "交互ビット: 落とすだけの通信路でも発散する",
    run: () => runProb(["-csplivelock", "AbpLoseOnly"], FILE),
    expect: failed,
  },
  {
    name: "交互ビット: 重複させるだけの通信路でも発散する",
    run: () => runProb(["-csplivelock", "AbpDupOnly"], FILE),
    expect: failed,
  },
  {
    name: "交互ビット: 故障の無い通信路なら発散しない",
    run: () => runProb(["-csplivelock", "AbpPerfect"], FILE),
    expect: succeeded,
  },
  {
    name: "交互ビット: 故障の無い通信路なら ⊑FD まで成り立つ",
    run: () => runProb(["-cspref", "Copy", "[FD=", "AbpPerfect"], FILE),
    expect: succeeded,
  },
  {
    name: "交互ビット: ビットを使わないと、送り直しの写しを2回渡して ⊑T を破る",
    run: () => runProb(["-cspref", "Copy", "[T=", "AbpNoBit"], FILE),
    expect: failed,
  },
];
