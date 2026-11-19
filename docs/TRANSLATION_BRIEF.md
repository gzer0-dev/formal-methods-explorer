# レッスンを英訳する担当への共通の指示

対象: formal-methods-explorer（形式手法を1ステップずつ図で学ぶサイト）。画面に日本語・英語の切り替えを付けるため、レッスンを英訳する。

## 手本と必ず読むもの

- `src/topic/lessons/lostUpdate.ts` — 訳し終えた手本。この形に合わせる。
- `src/topic/labels.ts` — モデルの操作名・状態の英語の表示名（displayName / displayNames / describeCounterIn / describeBossesIn）。
- `public/en/index.html` — 英語の用語と各レッスンの英語の題の正本。レッスンの title はここの題に合わせる。他のレッスンを「」で名指ししている所は、ここの英語の題を "" で引く。
- `src/core/i18n.ts`（translator）、CLAUDE.md の「この題材で決めたこと」「文言と操作名の書式」。

## 書き方

1. `export const xxxLesson: Lesson = {...}` を `export function xxxLesson(language: Language): Lesson { const t = translator(language); return {...}; }` に書き換える。
2. 画面に出る文字列をすべて `t("日本語", "English")` にする。対象は title・subtitle・summary・intro・facts・actors の label/sublabel・rows のキーと値・steps の title/summary/explain/simplified/detail・lab の title/hint/inputs の label・compute の戻り値。
   - rows のキーは `{ [t("値", "value")]: ... }` と書く。
   - 日本語の文字列は今のまま変えない（日本語の画面が変わらないこと）。数を手で書いた所を計算結果の埋め込みに直すのはよい。
3. **計算はモジュールの最上位に置いたまま**（関数の中で計算しない。言語ごとに計算すると読み込みが倍になる）。
4. **モデルの操作名・状態（「Aが読む」「未払い」など）は計算の識別子なので変えない。** 画面に出す所で `displayName(name, language)` / `displayNames(list, language)` を通す。
   labels.ts に無い名前が要るときは、labels.ts は編集せず、自分のレッスンのファイルの中に小さな対応表を書いて、報告に名前を書く（後で親が labels.ts へ移す）。
5. lab の入力の初期値（initial）が日本語なら英語でも受け付けるようにする（例: 「2手 / 1手」は includes("1") で判定しているので "2 steps" でも動く）。compute が入力の日本語の語を読んでいるなら、英語の語も受け付ける。
6. 他のレッスンを import して title を使っているときは、`xxxLesson(language).title` に直す（まだ関数でないレッスンなら `.title` のまま）。
7. `src/topic/index.ts` は変えなくてよい（関数のレッスンはそのまま並べられる）。

## 英語の文体

- 読者はテスト自動化エンジニア。平易で短い英語。専門用語は初出で短く言い換える（日本語の括弧書きと同じ所）。
- 文の数と内容は日本語に合わせる。意訳はよいが、日本語に無い主張を足さない。
- 数の後の助数詞（通り・個・手）は英語では落とすか "steps" などにする。"1 steps" にならないよう、1 のときは単数形にする（数が変わりうるなら `n === 1 ? "step" : "steps"`）。
- ステップの title は 32 文字以内（英語の上限）。カードの label・sublabel・rows はカードに収まるよう短く（1行に収まる長さ。lostUpdate を参考に）。
- 記号（□ ◇ ⊑ τ ✓ → など）・CSP の式・イベント名（pick.1.1 など）はそのまま。

## 完了条件（自分で実行して確かめる）

- `npx vitest run src/lessonFiles.test.ts` — 自分のファイルが ja と en の両方で緑（en は日本語が1文字でも残ると落ちる。lab は入力を 0〜6 に変えた結果も見る）。
- `npx vitest run src/topic` — 既存のテストが緑のまま（日本語の文言を変えていない）。
- `npx tsc --noEmit`、自分のファイルに `npx prettier --write` と `npx eslint <files> --max-warnings 0`。
- 他の担当が同時に別のファイルを訳している。他人のファイルが原因の失敗は直さず報告に書く。git の操作とブラウザは使わない。

## 報告

訳したレッスンの id、labels.ts に足してほしい名前（あれば）、英語の title の一覧、迷った訳語。
