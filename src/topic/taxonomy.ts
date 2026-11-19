// ステップの種類とレッスンの分類。レッスンのファイルはここの id を使う。

import { translator, type Language } from "../core/i18n";
import type { Category, Kind } from "../core/types";

export function kindsIn(language: Language): Kind[] {
  const t = translator(language);
  return [
    { id: "spec", label: t("仕様を書く", "Specify"), color: "var(--kind-spec)" },
    { id: "run", label: t("動かす", "Run"), color: "var(--kind-run)" },
    { id: "explore", label: t("探索", "Explore"), color: "var(--kind-explore)" },
    { id: "found", label: t("反例", "Counterexample"), color: "var(--kind-found)" },
    { id: "fix", label: t("直す", "Fix"), color: "var(--kind-fix)" },
    { id: "test", label: t("テスト", "Test"), color: "var(--kind-test)" },
  ];
}

export function categoriesIn(language: Language): Category[] {
  const t = translator(language);
  return [
    { id: "basics", label: t("なぜ形式手法か", "Why formal methods") },
    { id: "model", label: t("モデル検査", "Model checking") },
    { id: "spec", label: t("仕様と証明", "Specification and proof") },
    { id: "csp", label: t("プロセスで書く（CSP）", "Writing processes (CSP)") },
    { id: "apply", label: t("CSP の応用", "CSP in practice") },
    {
      id: "case",
      label: t("事例: 設計から実装まで", "Case study: from design to implementation"),
    },
    { id: "testing", label: t("テストへつなぐ", "Connecting to tests") },
    { id: "exercise", label: t("演習", "Exercises") },
  ];
}

// レッスン単位の検査（src/lessonFiles.test.ts）が読む日本語の分類。
export const KINDS: Kind[] = kindsIn("ja");
export const CATEGORIES: Category[] = categoriesIn("ja");
