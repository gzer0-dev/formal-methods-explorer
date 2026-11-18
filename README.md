# 形式手法のしくみ

テストが見逃す並行処理のバグを、モデル検査・不変条件・事前条件と事後条件・小さな範囲の全探索・性質ベーステストで見つけ、
テストへ落とすまでを、1ステップずつ動く図で追える学習サイト。図に出る状態数や反例は、ページの中で動く小さなモデル検査器が実際に計算している。

- TypeScript + Vite。実行時の依存ライブラリなし
- 同じモデルを [TLA+](specs/tla)・[Alloy](specs/alloy)・[CSPM](specs/csp) でも書き、TLC・Alloy Analyzer・ProB の結果がサイトの数字と一致することを CI で照合している（`npm run check:tla` / `check:alloy` / `check:csp`、Java が要る）
- 公開先: https://gzer0-dev.github.io/formal-methods-explorer/ （英語の概要: https://gzer0-dev.github.io/formal-methods-explorer/en/ ）
- `~/Projects/explainer-template` から派生

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run verify
```

設計判断の理由・不変条件・触ってよい層は [CLAUDE.md](CLAUDE.md) にある。

## English overview

Interactive, step-by-step lessons (in Japanese) on model checking, CSP refinement and property-based testing,
written for test automation engineers. Every number shown is computed by small checkers running in the page,
and CI cross-checks the same models with TLC, the Alloy Analyzer and ProB before each deploy.
See the English overview page: https://gzer0-dev.github.io/formal-methods-explorer/en/
