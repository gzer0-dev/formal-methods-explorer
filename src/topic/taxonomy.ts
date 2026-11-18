// ステップの種類とレッスンの分類。レッスンのファイルはここの id を使う。

import type { Category, Kind } from "../core/types";

export const KINDS: Kind[] = [
  { id: "spec", label: "仕様を書く", color: "var(--kind-spec)" },
  { id: "run", label: "動かす", color: "var(--kind-run)" },
  { id: "explore", label: "探索", color: "var(--kind-explore)" },
  { id: "found", label: "反例", color: "var(--kind-found)" },
  { id: "fix", label: "直す", color: "var(--kind-fix)" },
  { id: "test", label: "テスト", color: "var(--kind-test)" },
];

export const CATEGORIES: Category[] = [
  { id: "basics", label: "なぜ形式手法か" },
  { id: "model", label: "モデル検査" },
  { id: "spec", label: "仕様と証明" },
  { id: "csp", label: "プロセスで書く（CSP）" },
  { id: "testing", label: "テストへつなぐ" },
];
