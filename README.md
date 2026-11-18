# 形式手法のしくみ

テストが見逃す並行処理のバグを、モデル検査・不変条件・事前条件と事後条件・小さな範囲の全探索・性質ベーステストで見つけ、
テストへ落とすまでを、1ステップずつ動く図で追える学習サイト。図に出る状態数や反例は、ページの中で動く小さなモデル検査器が実際に計算している。

- TypeScript + Vite。実行時の依存ライブラリなし
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
