// パズルを検査器で解く（src/topic/cspPuzzle.ts・cspPuzzle.test.ts と同じ結論）を ProB で照合する。
// ProB の反例は最短とは限らない（規則ありで11回、規則なしで33回の渡しを返した）。最短であることは、
// 「n 回渡った後でなければ solved は起きない」仕様 AtLeast(n) との比較で別に確かめる。
const FILE = "cases/cspPuzzle.csp";

export default ({ runProb, succeeded, failed }) => {
  const endsWithSolved = (r) => /,GO:,solved, At_last_step/.test(r.output);
  return [
    {
      name: "パズル: 仕様「solved は起きない」は破れ、反例は solved で終わる（解き方がある）",
      run: () => runProb(["-cspref", "NeverSolved", "[T=", "Puzzle"], FILE),
      expect: (r) => failed(r) && endsWithSolved(r),
    },
    {
      name: "パズル: 9回より短い解き方は無い（AtLeast(9) ⊑T Puzzle）",
      run: () => runProb(["-cspref", "AtLeast(9)", "[T=", "Puzzle"], FILE),
      expect: succeeded,
    },
    {
      name: "パズル: 9回で解ける（AtLeast(10) ⊑T Puzzle は破れる）",
      run: () => runProb(["-cspref", "AtLeast(10)", "[T=", "Puzzle"], FILE),
      expect: failed,
    },
    {
      name: "パズル: サイトの検査器が返した9回の解き方を、ProB のモデルも起こせる",
      run: () => runProb(["-cspref", "Puzzle", "[T=", "SiteSolution"], FILE),
      expect: succeeded,
    },
    {
      name: "パズル: 猫がちょっかいを出さなければ5回で解け、それより短くはならない",
      run: () => runProb(["-cspref", "AtLeast(5)", "[T=", "PuzzleNoRules"], FILE),
      expect: succeeded,
    },
    {
      name: "パズル: 猫がちょっかいを出さなければ5回で解ける（AtLeast(6) は破れる）",
      run: () => runProb(["-cspref", "AtLeast(6)", "[T=", "PuzzleNoRules"], FILE),
      expect: failed,
    },
  ];
};
