# Roscoe『The Theory and Practice of Concurrency』（TPC）の範囲をレッスンにする指示

ユーザーの依頼: TPC の内容もこのサイトで学べるようにする。範囲と対応は docs/TPC_COVERAGE.md（先に読む）。

## 著作権（必ず守る）

- TPC の PDF は個人の参照用として配られている。**本文・図・例・名前付きプロセスの定義を写さない。** 例は自作か古典の問題
  （交互ビットプロトコル・Needham–Schroeder とその攻撃・食事する哲学者など、論文や教科書で広く知られた題材）にする。
- 引用はしない。facts に `TPC_BOOK` / `TPC_BOOK_EN`（src/topic/references.ts）と章・節を書き添えるだけにする。
- 本を確かめたいときは PDF を Read で直接読む（/private/tmp/claude-501/-Users-gzer0/dfc977ef-670c-490a-944b-a9b21f8990a8/scratchpad/roscoe68b/68b.pdf。
  抽出した文字は □・⊓・⊑ が崩れるので、式はページの画像で読む）。PDF やその文をリポジトリにも報告にも入れない。

## 手本（先に読む）

- 計算: `src/topic/cspPipes.ts` とテスト `cspPipes.test.ts`（自作の例・不変条件のテスト）
- レッスン: `src/topic/lessons/cspPipes.ts`（日英・intro・facts・登場物・ステップ・lab）
- CSP の実装: `src/topic/csp.ts`（前置・外部選択・内部選択・並行合成・インターリーブ・隠蔽・逐次合成・名前の付け替え・再帰、
  詳細化 ⊑T/⊑F/⊑FD・デッドロック・発散・決定性・Lazy 抽象化・飢餓・正規化した状態数）
- 演習を作る担当は `src/topic/exerciseLesson.ts`（buildExerciseLesson）と `src/topic/lessons/exerciseShortest.ts`
- サイトの CLAUDE.md（文言の書式・日英・概要・照合の決まり）

## 1本のレッスンの形

- 計算は `src/topic/<名前>.ts` の純関数に置き、**先に失敗するテストを書く**（`<名前>.test.ts`）。その題材の「崩れたら説明が嘘になる」性質をテストにする。
  画面に出す数・反例・状態数はすべて計算の戻り値から作る（手書きしない）。重い計算は lazy で包むか lab の compute に回す（モジュールの最上位で重い比較をしない）。
- レッスンは `src/topic/lessons/<名前>.ts` に `export function xxxLesson(language: Language): Lesson`。6〜9ステップ、題は ja 16・en 32 文字、
  カードの行は4行まで、位置は 0〜100（横の間隔 20 以上、端 11〜89）。intro 2〜3段落（何の話か・なぜテストだけでは足りないか・図のどこを見るか。数は書かない）。
  facts に結果と「参考: TPC の章・節」。実物と違う簡略化は simplified に書く。lab を付ける（値を変えて結果を確かめられる所）。
- 日本語と英語の両方を `t()` で書く（英国式綴り）。モデルの操作名・イベント名は識別子なので英字にする（日本語のイベント名を作らない）。
- 名前と助詞・数字のまわりに空白を入れない（「セル1つ」「6通り」）。英字の名前の前後は空白を入れてよい。
- ProB との照合: CSPM を `specs/csp/cases/<名前>.csp` に書き、`specs/csp/cases/<名前>.mjs` に照合を置く
  （default export で `({ runProb, succeeded, failed }) => [...]`、runProb には `"cases/<名前>.csp"` を渡す。`Models.csp` と `check-prob.mjs` は触らない）。
  ProB で調べられない性質は照合を省き、レッスンの simplified か報告にそう書く。

## 触ってよいもの・いけないもの

- 作ってよい: 割り当てられたレッスン・その計算とテスト・`specs/csp/cases/<名前>.*`。
- 触らない: `csp.ts`（足りない演算子・解析があれば、自分の計算ファイルの中で既存の関数を組み合わせて作るか、報告する）、
  `index.ts`・`taxonomy.ts`・`references.ts`・`labels.ts`・`public/en/index.html`・`Models.csp`・`check-prob.mjs`・他の担当のファイル。
- git とブラウザは使わない。別のエージェントに任せない。
- zsh では `for p in "a b"` が引数を1つにまとめる。複数の引数を渡すスクリプトを回すときは `for f in a b; do cmd $f ${f}X; done` の形にする。

## 完了条件

- `npx vitest run src/lessonFiles.test.ts src/topic/<名前>.test.ts` が緑（自分のレッスンの日英・lab の samples を含む）
- `npx tsc --noEmit`、自分のファイルに `npx prettier --write` と `npx eslint <files> --max-warnings 0`
- `npm run check:csp` が通る（自分の照合を含む。ProB が無いなどで回せなければ報告に書く）
- 日本語の文（summary・explain・intro）を通して読み、`python3 ~/.claude/skills/yomiyasu/scripts/yomiyasu_lint.py -` にかける

## 報告

レッスンごとに: ファイル名・id・export 名・分類・英語の題と1行の説明（英語ページに載せる）、題材（自作か古典か）、
不変条件のテスト、ステップの題の一覧、ProB の照合の件数、本のどの節に当たるか、簡略化、気になった点。
