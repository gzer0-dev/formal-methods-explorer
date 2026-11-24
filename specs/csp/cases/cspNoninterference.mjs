// csp-noninterference と exercise-noninterference の照合（期待値は src/topic/cspNoninterference.test.ts と同じ）。
// 決定性は安定失敗モデル（F）で調べる（FDR・本と同じ）。サイトは高い利用者の回数を限って発散を避けているので、
// 限らない版（HighAny）も F なら同じ結論になることを合わせて見る。
const file = "cases/cspNoninterference.csp";

export default ({ runProb, succeeded, failed }) => {
  const deterministic = (name) => () => runProb(["-cspdeterministic", name, "F"], file);
  return [
    {
      name: "非干渉: 受け皿が1つ・高い利用者1回・Lazy は非決定的（漏れる）",
      run: deterministic("SharedLazy1"),
      expect: failed,
    },
    {
      name: "非干渉: 受け皿が1つでも高い利用者が送らなければ決定的",
      run: deterministic("SharedLazy0"),
      expect: succeeded,
    },
    {
      name: "非干渉: ただ隠す（Eager）と受け皿が1つでも決定的（漏れが見えない）",
      run: deterministic("SharedEager1"),
      expect: succeeded,
    },
    {
      name: "非干渉: 受け皿を分けると決定的（高い利用者1回）",
      run: deterministic("SeparateLazy1"),
      expect: succeeded,
    },
    {
      name: "非干渉: 受け皿を分けると決定的（高い利用者3回）",
      run: deterministic("SeparateLazy3"),
      expect: succeeded,
    },
    {
      name: "非干渉: 回数を限らない高い利用者でも、F なら受け皿1つは非決定的",
      run: deterministic("SharedLazyAny"),
      expect: failed,
    },
    {
      name: "非干渉: 回数を限らない高い利用者で、受け皿を分けた版は F で決定的",
      run: deterministic("SeparateLazyAny"),
      expect: succeeded,
    },
    {
      name: "演習（非干渉）: 留め置き印刷の共有の記憶領域は、高い利用者2回で非決定的（漏れる）",
      run: deterministic("HeldLazy2"),
      expect: failed,
    },
    {
      name: "演習（非干渉）: 留め置き印刷は、高い利用者1回でも非決定的",
      run: deterministic("HeldLazy1"),
      expect: failed,
    },
    {
      name: "演習（非干渉）: 留め置き印刷でも、高い利用者が送らなければ決定的",
      run: deterministic("HeldLazy0"),
      expect: succeeded,
    },
  ];
};
