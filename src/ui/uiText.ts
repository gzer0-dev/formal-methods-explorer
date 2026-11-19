// 画面の固定文言。題材の文言は題材の側（Topic）が言語ごとに持つ。

import type { Language } from "../core/i18n";

export interface UiText {
  lessonsNav: string;
  viewTabs: string;
  diagram: string;
  sequence: string;
  sequenceLabel: string;
  speed: string;
  prev: string;
  prevHint: string;
  play: string;
  pause: string;
  playHint: string;
  next: string;
  nextHint: string;
  reset: string;
  resetHint: string;
  columnNumber: string;
  columnKind: string;
  columnWhere: string;
  columnWhat: string;
  keyHint: string;
  overviewTitle: string;
  stepDetailTitle: string;
  labError: string;
  simplified: string;
  /** 送り先が複数あるときの区切り。 */
  listSeparator: string;
  /** 切り替えのボタンに出す、この言語の名前（その言語自身の書き方で）。 */
  languageName: string;
  switchLanguage: string;
}

export const UI_TEXT: Record<Language, UiText> = {
  ja: {
    lessonsNav: "レッスン",
    viewTabs: "表示の切り替え",
    diagram: "図",
    sequence: "シーケンス",
    sequenceLabel: "シーケンス図",
    speed: "再生の速さ",
    prev: "前へ",
    prevHint: "前へ（←）",
    play: "再生",
    pause: "一時停止",
    playHint: "再生／一時停止（スペース）",
    next: "次へ",
    nextHint: "次へ（→）",
    reset: "最初から",
    resetHint: "最初から（R）",
    columnNumber: "番号",
    columnKind: "種類",
    columnWhere: "どこで",
    columnWhat: "起きること",
    keyHint: "キーボード: スペースで再生と一時停止、← → で1つずつ、R で最初から",
    overviewTitle: "このレッスンで分かること",
    stepDetailTitle: "このステップの中身",
    labError: "計算できなかった。入力を確かめよう。",
    simplified: "簡略化",
    listSeparator: "・",
    languageName: "日本語",
    switchLanguage: "言語を切り替える",
  },
  en: {
    lessonsNav: "Lessons",
    viewTabs: "Switch view",
    diagram: "Diagram",
    sequence: "Sequence",
    sequenceLabel: "Sequence diagram",
    speed: "Playback speed",
    prev: "Back",
    prevHint: "Back (←)",
    play: "Play",
    pause: "Pause",
    playHint: "Play / pause (Space)",
    next: "Next",
    nextHint: "Next (→)",
    reset: "Restart",
    resetHint: "Restart (R)",
    columnNumber: "No.",
    columnKind: "Kind",
    columnWhere: "Where",
    columnWhat: "What happens",
    keyHint: "Keyboard: Space to play or pause, ← → to step, R to restart",
    overviewTitle: "What this lesson shows",
    stepDetailTitle: "Inside this step",
    labError: "Could not compute. Check the input.",
    simplified: "Simplified",
    listSeparator: ", ",
    languageName: "English",
    switchLanguage: "Switch language",
  },
};
