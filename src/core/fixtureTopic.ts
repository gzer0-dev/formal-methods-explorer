// テスト用の小さな題材。画面のテスト（src/ui）は題材の層を import できないので、ここに置く。
// 途中で現れる登場物・複数の送り先・実験・簡略化の注記を 1 つずつ含めてある。

import { translator, type Language } from "./i18n";
import type { Topic } from "./types";

/** 言語を渡すと、題と最初のレッスンの題だけ英語になる（言語の切り替えのテスト用。全部は訳していない）。 */
export function fixtureTopic(language: Language = "ja"): Topic {
  const t = translator(language);
  return {
    id: "fixture",
    title: t("見本の題材", "Sample topic"),
    tagline: "テスト用",
    brandIcon: "person",
    timelineTitle: "処理の流れ",
    kinds: [
      { id: "message", label: "通信", color: "#0a6" },
      { id: "work", label: "処理", color: "#c60" },
    ],
    categories: [
      { id: "basic", label: "基本" },
      { id: "advanced", label: "応用" },
    ],
    lessons: [
      {
        id: "order",
        category: "basic",
        title: t("注文が届くまで", "Until the order arrives"),
        subtitle: "客から店へ",
        summary: "客が店に注文し、店が伝票を作る。",
        intro: [
          "注文は、客から店へ届いて初めて処理が始まる。",
          "図では、注文が客から店へ流れ、店の中で伝票が現れるところを見る。",
        ],
        facts: [{ label: "登場物", value: "3" }],
        stageHeight: 300,
        actors: [
          { id: "customer", label: "客", icon: "person", x: 15, y: 50 },
          { id: "shop", label: "店", icon: "server", x: 55, y: 50 },
          {
            id: "slip",
            label: "伝票",
            icon: "document",
            x: 88,
            y: 50,
            initial: { isHidden: true },
          },
        ],
        links: [
          { from: "customer", to: "shop" },
          { from: "shop", to: "slip" },
        ],
        steps: [
          {
            id: "send-order",
            kind: "message",
            title: "注文を送る",
            actor: "customer",
            to: ["shop"],
            summary: "客が店に注文を送る",
            explain: "客が欲しい品を店に伝える。",
            set: { shop: { rows: { 注文: "りんご 2" } } },
            detail: [
              { title: "注文の中身", fields: [{ label: "品", value: "りんご" }] },
            ],
          },
          {
            id: "make-slip",
            kind: "work",
            title: "伝票を作る",
            actor: "shop",
            summary: "店が伝票を作る",
            explain: "店が注文を伝票に書き写す。",
            set: { slip: { isHidden: false, rows: { 品: "りんご 2" } } },
            simplified: "実際の店では在庫の確認が先に入る。",
          },
          {
            id: "confirm",
            kind: "message",
            title: "受付を知らせる",
            actor: "shop",
            to: ["customer", "slip"],
            summary: "店が客に受付を知らせる",
            explain: "店が注文を受け付けたことを客に知らせる。",
            set: { customer: { tone: "ok" }, slip: { tone: "ok" } },
          },
        ],
        lab: {
          title: "合計を確かめる",
          hint: "個数を入れると合計が出る。",
          inputs: [{ id: "count", label: "個数", initial: "2" }],
          compute: (values) => [
            { label: "合計", value: `${Number(values.count) * 100}円` },
          ],
        },
      },
      {
        id: "refund",
        category: "advanced",
        title: "返金の流れ",
        subtitle: "店から客へ",
        summary: "店が客に代金を返す。",
        facts: [{ label: "登場物", value: "2" }],
        actors: [
          { id: "customer", label: "客", icon: "person", x: 20, y: 50 },
          { id: "shop", label: "店", icon: "server", x: 80, y: 50 },
        ],
        links: [{ from: "shop", to: "customer" }],
        steps: [
          {
            id: "pay-back",
            kind: "message",
            title: "代金を返す",
            actor: "shop",
            to: ["customer"],
            summary: "店が客に代金を返す",
            explain: "店が受け取った代金を客に返す。",
          },
          {
            id: "note",
            kind: "work",
            title: "記録する",
            actor: "shop",
            summary: "店が返金を記録する",
            explain: "店が返金したことを帳簿に書く。",
          },
        ],
      },
    ],
  };
}
