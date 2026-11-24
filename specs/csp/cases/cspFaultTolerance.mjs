// csp-fault-tolerance の照合（期待値は src/topic/cspFaultTolerance.test.ts と同じ）。
// ProB の反例はサイトの最短の反例（最初の時点）より後の時点を返すが、拒否は同じ（書き込みも読み出しも断る）。
const file = "cases/cspFaultTolerance.csp";

export default ({ runProb, succeeded, failed }) => {
  const refines =
    (impl, spec = "Spec") =>
    () =>
      runProb(["-cspref", spec, "[F=", impl], file);
  return [
    {
      name: "耐故障: 故障を起こさせないと、ディスク1台で記憶の仕様を満たす",
      run: refines("View1Limit0"),
      expect: succeeded,
    },
    {
      name: "耐故障: ディスク1台は故障1回で破れる",
      run: refines("View1Limit1"),
      expect: failed,
      contains: "specification_can_do_one_of:,write.0,write.1,read",
    },
    {
      name: "耐故障: ディスク2台は故障1回までなら満たす",
      run: refines("View2Limit1"),
      expect: succeeded,
    },
    {
      name: "耐故障: ディスク2台は故障2回で破れる",
      run: refines("View2Limit2"),
      expect: failed,
    },
    {
      name: "耐故障: 故障の回数を限らないと、ディスク2台でも破れる",
      run: refines("View2Unlimited"),
      expect: failed,
    },
    {
      name: "耐故障: ディスク3台は故障2回までなら満たす",
      run: refines("View3Limit2"),
      expect: succeeded,
    },
    {
      name: "耐故障: ディスク3台は故障3回で破れる",
      run: refines("View3Limit3"),
      expect: failed,
    },
    {
      name: "耐故障（本の定義 NoFaults ⊑F Lazy）: 2台は故障1回まで耐える",
      run: refines("View2Limit1", "NoFaults2"),
      expect: succeeded,
    },
    {
      name: "耐故障（本の定義 NoFaults ⊑F Lazy）: 2台は故障2回で耐えない",
      run: refines("View2Limit2", "NoFaults2"),
      expect: failed,
    },
    {
      name: "耐故障（本の定義 NoFaults ⊑F Lazy）: 1台は故障1回で耐えない",
      run: refines("View1Limit1", "NoFaults1"),
      expect: failed,
    },
    {
      name: "耐故障: 故障を止めた系は記憶の仕様と失敗で等しい（逆向き）",
      run: refines("Spec", "NoFaults2"),
      expect: succeeded,
    },
  ];
};
