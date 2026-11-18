// 「項目名: 値」の並びを描く。ステップの中身・レッスンの概要・実験の結果で共通に使う。

import type { Field, Section } from "../core/types";
import { el } from "./dom";

export function createFieldList(fields: Field[]): HTMLElement {
  const list = el("dl", { class: "fields" });
  for (const field of fields) {
    const value = el("dd", {
      class: [
        "field-value",
        field.isCode ? "is-code" : "",
        field.tone ? `tone-${field.tone}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      text: field.value,
    });
    if (field.note)
      value.append(el("small", { class: "field-note", text: field.note }));
    list.append(el("dt", { text: field.label }), value);
  }
  return list;
}

export function createSections(sections: Section[]): HTMLElement[] {
  return sections.map((section) =>
    el("section", { class: "detail-section" }, [
      el("h4", { text: section.title }),
      createFieldList(section.fields),
    ]),
  );
}
