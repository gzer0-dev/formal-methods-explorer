// データ独立性（src/topic/cspDataIndependence.ts・cspDataIndependence.test.ts）と ProB の照合。CSPM は cspDataIndependence.csp。
const FILE = "cases/cspDataIndependence.csp";

export default ({ runProb, succeeded, failed }) => [
  ...[1, 2, 3].map((n) => ({
    name: `データ独立性: 値${n}つでも、2つのセルは受け取った順に渡す仕様を ⊑F で満たす`,
    run: () => runProb(["-cspref", `FifoSpec${n}`, "[F=", `CellPair${n}`], FILE),
    expect: succeeded,
  })),
  {
    name: "データ独立性: 値1つでは、スタックも仕様を ⊑T で満たして見逃す",
    run: () => runProb(["-cspref", "FifoSpec1", "[T=", "Stack1"], FILE),
    expect: succeeded,
  },
  ...[2, 3].map((n) => ({
    name: `データ独立性: 値${n}つなら、スタックは [in.0, in.1, out.1] で ⊑T を破る`,
    run: () => runProb(["-cspref", `FifoSpec${n}`, "[T=", `Stack${n}`], FILE),
    expect: failed,
    trace: ["in.0", "in.1", "out.1"],
  })),
  {
    name: "データ独立性: 直近2つを覚える重複よけは、値2つなら同じ値を2回渡さない",
    run: () => runProb(["-cspref", "Unique2", "[T=", "Dedup2"], FILE),
    expect: succeeded,
  },
  {
    name: "データ独立性: 値3つなら、忘れた0をもう一度渡して ⊑T を破る",
    run: () => runProb(["-cspref", "Unique3", "[T=", "Dedup3"], FILE),
    expect: failed,
    trace: ["in.0", "out.0", "in.1", "out.1", "in.2", "out.2", "in.0", "out.0"],
  },
  {
    name: "データ独立性: 値2を1に付け替えた3値のスタックは、2値のスタックを ⊑FD で満たす",
    run: () => runProb(["-cspref", "Stack2", "[FD=", "Stack3Collapsed"], FILE),
    expect: succeeded,
  },
  {
    name: "データ独立性: 逆向きも ⊑FD で満たす（付け替えた後は区別できない）",
    run: () => runProb(["-cspref", "Stack3Collapsed", "[FD=", "Stack2"], FILE),
    expect: succeeded,
  },
  {
    name: "データ独立性: 値2を1に付け替えた3値の重複よけは、値2つの仕様を ⊑T で破る（値2つの版と区別できる）",
    run: () => runProb(["-cspref", "Unique2", "[T=", "Dedup3Collapsed"], FILE),
    expect: failed,
  },
];
