// テスト用の小さな題材。画面のテスト（src/ui）は題材の層を import できないので、ここに置く。
// 途中で現れる登場物・複数の送り先・実験・簡略化の注記を 1 つずつ含めてある。

import { translator, type Language } from "./i18n";
import type { Lesson, Topic } from "./types";

/** 言語を渡すと、全部の文言がその言語になる（言語の切り替えのテストで、英語の画面に日本語が残らないことを確かめるため）。 */
export function fixtureTopic(language: Language = "ja"): Topic {
  const t = translator(language);
  return {
    id: "fixture",
    title: t("見本の題材", "Sample topic"),
    tagline: t("テスト用", "For tests"),
    brandIcon: "person",
    timelineTitle: t("処理の流れ", "Flow"),
    kinds: [
      { id: "message", label: t("通信", "Message"), color: "#0a6" },
      { id: "work", label: t("処理", "Work"), color: "#c60" },
    ],
    categories: [
      { id: "basic", label: t("基本", "Basics") },
      { id: "advanced", label: t("応用", "Advanced") },
    ],
    lessons: [
      orderLesson(language, 2),
      {
        id: "refund",
        category: "advanced",
        title: t("返金の流れ", "Refund"),
        subtitle: t("店から客へ", "From shop to customer"),
        summary: t("店が客に代金を返す。", "The shop pays the customer back."),
        facts: [{ label: t("登場物", "Actors"), value: "2" }],
        actors: [
          { id: "customer", label: t("客", "Customer"), icon: "person", x: 20, y: 50 },
          { id: "shop", label: t("店", "Shop"), icon: "server", x: 80, y: 50 },
        ],
        links: [{ from: "shop", to: "customer" }],
        steps: [
          {
            id: "pay-back",
            kind: "message",
            title: t("代金を返す", "Pay back"),
            actor: "shop",
            to: ["customer"],
            summary: t("店が客に代金を返す", "The shop pays the customer back"),
            explain: t(
              "店が受け取った代金を客に返す。",
              "The shop returns the money it received.",
            ),
          },
          {
            id: "note",
            kind: "work",
            title: t("記録する", "Record"),
            actor: "shop",
            summary: t("店が返金を記録する", "The shop records the refund"),
            explain: t(
              "店が返金したことを帳簿に書く。",
              "The shop writes the refund in its books.",
            ),
          },
        ],
      },
    ],
  };
}

/** 注文のレッスン。count は注文する個数（実験の入力）。既定の2で組んだものが題材に載る。 */
function orderLesson(language: Language, count: number): Lesson {
  const t = translator(language);
  return {
    id: "order",
    category: "basic",
    title: t("注文が届くまで", "Until the order arrives"),
    subtitle: t("客から店へ", "From customer to shop"),
    summary: t(
      "客が店に注文し、店が伝票を作る。",
      "The customer orders and the shop writes a slip.",
    ),
    intro: [
      t(
        "注文は、客から店へ届いて初めて処理が始まる。",
        "Work starts only when the order reaches the shop.",
      ),
      t(
        "図では、注文が客から店へ流れ、店の中で伝票が現れるところを見る。",
        "Watch the order flow to the shop and a slip appear.",
      ),
    ],
    facts: [{ label: t("登場物", "Actors"), value: "3" }],
    stageHeight: 300,
    actors: [
      { id: "customer", label: t("客", "Customer"), icon: "person", x: 15, y: 50 },
      { id: "shop", label: t("店", "Shop"), icon: "server", x: 55, y: 50 },
      {
        id: "slip",
        label: t("伝票", "Slip"),
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
        title: t("注文を送る", "Send the order"),
        actor: "customer",
        to: ["shop"],
        summary: t("客が店に注文を送る", "The customer sends an order"),
        explain: t(
          "客が欲しい品を店に伝える。",
          "The customer tells the shop what they want.",
        ),
        set: {
          shop: {
            rows: { [t("注文", "Order")]: t(`りんご ${count}`, `apples ${count}`) },
          },
        },
        detail: [
          {
            title: t("注文の中身", "Order contents"),
            fields: [{ label: t("品", "Item"), value: t("りんご", "apple") }],
          },
        ],
      },
      {
        id: "make-slip",
        kind: "work",
        title: t("伝票を作る", "Write a slip"),
        actor: "shop",
        summary: t("店が伝票を作る", "The shop writes a slip"),
        explain: t(
          "店が注文を伝票に書き写す。",
          "The shop copies the order onto a slip.",
        ),
        set: {
          slip: {
            isHidden: false,
            rows: { [t("品", "Item")]: t(`りんご ${count}`, `apples ${count}`) },
          },
        },
        simplified: t(
          "実際の店では在庫の確認が先に入る。",
          "A real shop checks stock first.",
        ),
      },
      {
        id: "confirm",
        kind: "message",
        title: t("受付を知らせる", "Confirm"),
        actor: "shop",
        to: ["customer", "slip"],
        summary: t("店が客に受付を知らせる", "The shop confirms to the customer"),
        explain: t(
          "店が注文を受け付けたことを客に知らせる。",
          "The shop tells the customer the order was accepted.",
        ),
        set: { customer: { tone: "ok" }, slip: { tone: "ok" } },
      },
    ],
    lab: {
      title: t("合計を確かめる", "Check the total"),
      hint: t("個数を入れると合計が出る。", "Enter a count to see the total."),
      inputs: [
        { id: "count", label: t("個数", "Count"), initial: "2", samples: ["1", "9"] },
      ],
      compute: (values) => [
        {
          label: t("合計", "Total"),
          value: t(
            `${Number(values.count) * 100}円`,
            `${Number(values.count) * 100} yen`,
          ),
        },
      ],
      // 個数を変えると、図の店と伝票のカードの「りんご N」も変わる（入力で図を組み直す実験の見本）。
      lesson: (values) =>
        orderLesson(
          language,
          Math.max(1, Number.parseInt(values.count ?? "", 10) || 2),
        ),
    },
  };
}
