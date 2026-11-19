import { describe, expect, it } from "vitest";

import { findUntranslated } from "../core/i18n";
import { UI_TEXT } from "./uiText";

describe("画面の固定文言", () => {
  it("英語の文言に日本語が残っていない", () => {
    expect(findUntranslated(UI_TEXT.en)).toEqual([]);
  });

  it("日英で同じ項目がそろっている", () => {
    expect(Object.keys(UI_TEXT.en).sort()).toEqual(Object.keys(UI_TEXT.ja).sort());
  });
});
