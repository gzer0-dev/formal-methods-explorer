# レッスンを書く担当への共通の指示

対象: /Users/gzer0/Projects/formal-methods-explorer（形式手法を1ステップずつ図で学ぶサイト。TypeScript + Vite）

## 必ず読むもの

- CLAUDE.md の「新しい題材のサイトを作る手順」4 番（配置・文字数の規則）
- src/core/types.ts（Lesson の型）
- src/topic/lessons/lostUpdate.ts（手本。値はすべて計算関数の結果から埋め込んでいる）
- src/topic/modelCheck.ts / models.ts / contracts.ts / pbt.ts / smallScope.ts / coverage.ts（使ってよい計算。各 *.test.ts に期待値がある）
- src/topic/taxonomy.ts（kind: spec/run/explore/found/fix/test、category: basics/model/spec/testing）
- src/topic/icons.ts（題材のアイコン: process variable state queue visited checker spec route test dice shrink contract job people）と共有アイコン（person server database document key lock gear cloud device network hash）

## 規則

- 作ってよいのは、割り当てられた src/topic/lessons/<file>.ts だけ。index.ts・計算・テーマ・他人のレッスンは触らない。
  どうしても新しい計算が要るなら、新しいファイル src/topic/<自分の名前>.ts と、先に書いた失敗するテスト（TDD）で足してよい。既存の計算ファイルは変えない。
- 画面に出す数字・状態・反例は、計算関数の戻り値から埋め込む。手で書いた「それらしい値」は禁止。
- 自作の検査器と実物（TLA+/TLC、Alloy、Dafny、fast-check など）の違いや省略は、そのステップの simplified に書く。
- 1レッスン5〜8ステップ。step.title は16文字以内。summary は一覧の1行。explain は「何が起きたか＋なぜ」を2〜3文。
- 位置は 0〜100。カード幅は約18なので横の間隔は20以上、端は11〜89。横1列なら stageHeight: 300、2段なら y=27 と y=73。カードの行（rows）は4行まで。途中で現れる登場物は initial: { isHidden: true }。
- 読者が値を変えて確かめられる所には lab を付ける（compute は純関数。入力は文字列なので、壊れた入力でも既定値に戻して結果を返す）。
- 文言: 平易な現代日本語。古語・一字の漢字ラベル・造語・誇張・比喩の多用を避ける。英語の専門用語は初出で日本語の言い換えを添える。読者はテスト自動化エンジニア（SET）で、形式手法は初学者。
- export 名は `<名前>Lesson`（例: export const bfsLesson: Lesson）。lesson.id はケバブケースで一意。

## 完了条件（すべて自分で実行して確かめる）

- `npx vitest run src/lessonFiles.test.ts` が通る（自分のファイルの検査が緑）
- `npx tsc --noEmit` が通る
- `npx eslint src/topic/lessons/<自分のファイル> --max-warnings 0` と `npx prettier --check src/topic/lessons/<自分のファイル>`（落ちたら `npx prettier --write` で整える）
- 他の担当が同時に別のファイルを書いている。他人のファイルが原因の失敗は直さず、報告に書く。
- git の操作（add・commit）はしない。ブラウザは使わない（見た目の確認は親がやる）。

## 報告

作ったファイル、各レッスンの id・title・category・ステップ数、使った計算関数、simplified に書いた要点、気になった点を短く。
