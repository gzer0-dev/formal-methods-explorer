# 演習を1問＝1レッスンに作り直す指示

ユーザーの指摘: 演習のページ（exerciseModel.ts・exerciseCsp.ts）は図が「問題→あなた→検査器」の3枚だけで、題材が図に出ず、アニメーションが意味をなしていない。
直し方: 1問＝1レッスンに分け、**図に題材のモデルそのものを出す**。答えを入れると、**正解を図で見せる手順**が足される。

## 手本（必ず先に読む）

- `src/topic/exerciseLesson.ts` の `buildExerciseLesson`（組み立て。答え合わせのステップは自動で足される）とテスト
- `src/topic/lessons/exerciseShortest.ts`（モデル検査の問2を作り直したもの）
- 元の問題: `src/topic/lessons/exerciseModel.ts`・`exerciseCsp.ts` の questionsOf（問題文・ヒント・solve・simplified）。**問題の条件・正解の計算は変えない**（同じ計算関数を使う）
- 題材の元のレッスン（登場物の置き方・カードの行・ステップの組み方を流用してよい）

## 1問のレッスンの形

- **setupSteps（答える前）**: 2〜4ステップ。題材の登場物（プロセス・ロック・ジョブ・人・配列・CSP のプロセスなど）で問題の設定を見せ、最後のステップで問いを出す（問題文とヒントは最後のステップの explain に）。
  **正解やその手掛かりになる手順を出さない**（数え上げの答えの数、反例の手順、デッドロックの有無など）。
- **solve**: 元の solve と同じ（answer と reason）。重い計算は lazy で包み、モジュールの最上位で呼ばない。
- **solutionSteps（答えた後）**: 2〜8ステップ。正解を図で見せる。例: 反例・デッドロックに至る手順を1手ずつ、活性なら回り続ける輪、
  数え上げなら悪い並びの1例と数え方、Alloy 風なら輪のある形の例、性質ベーステストなら反例を縮めていく様子、CSP ならトレースや拒否を1イベントずつ。
  数字はすべて計算関数の戻り値から作る（手書きしない）。
- 登場物の id と位置は答える前後で同じ（検査が見る）。途中で現れるものは `initial: { isHidden: true }`。カードの行は4行まで、題は ja 16・en 32 文字。
- id は `exercise-<短い英名>`、title は「演習: 〜」（16文字以内に収まらないときは「演習: 」の後を短く）。intro 2段落（何の問題か・図のどこを見るか。数は書かない）。
  facts に題材・答え方・出題範囲（元のレッスン名）。元の問題に simplified があれば、setupSteps の問いのステップか solutionSteps に入れる。
- 日本語と英語の両方を `t()` で書く（英国式綴り。用語は public/en/index.html と元の問題の英語に合わせる）。モデルの操作名は displayName を通す。
- 文言の書式は CLAUDE.md「文言と操作名の書式」（名前と助詞・数字のまわりに空白を入れない）。

## 規則

- 作ってよいのは、割り当てられたレッスンのファイル（`src/topic/lessons/exercise<名前>.ts`）だけ。`index.ts`・`exerciseModel.ts`・`exerciseCsp.ts`・
  共有の `exerciseLesson.ts`・計算ファイルは触らない（足りない部品があれば報告に書く）。git とブラウザは使わない。別のエージェントに任せない。
- 計算の振る舞いを変えない。新しい計算が要るときは、レッスンのファイルの中の小さな関数にとどめ、それで足りなければ報告する。

## 完了条件

- `npx vitest run src/lessonFiles.test.ts src/topic/exerciseLesson.test.ts` が緑（samples ごとに答えた後のレッスンも検査される）
- `npx tsc --noEmit`、自分のファイルに `npx prettier --write` と `npx eslint <files> --max-warnings 0`
- 答える前のレッスンの文言（JSON にして）に正解の値や反例の手順が出ていないことを自分で確かめる
- 答えた後の日本語の文（solutionSteps と reason）を通して読み、自然か確かめる

## 報告

レッスンごとに: ファイル名・id・export 名・英語の題、登場物、setupSteps と solutionSteps の題の一覧、正解の見せ方、気になった点。
