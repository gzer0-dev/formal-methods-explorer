// 登場物のアイコン。24x24 の viewBox に線で描く。色は CSS の currentColor で決まる。
// 題材に固有のアイコンは Topic.icons で足す（ここには汎用のものだけを置く）。

import type { Topic } from "../core/types";
import { svgEl } from "./dom";

export const BUILTIN_ICONS: Record<string, string> = {
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  server:
    '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  database:
    '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  document: '<path d="M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 01-.5-9A6 6 0 0118 10.5 3.8 3.8 0 0117.5 18z"/>',
  device: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 20h20"/>',
  network:
    '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M10.8 7.2L6.2 16.8M13.2 7.2l4.6 9.6M7.5 19h9"/>',
  hash: '<path d="M9 3L7 21M17 3l-2 18M4 9h17M3 15h17"/>',
};

export const BUILTIN_ICON_IDS = Object.keys(BUILTIN_ICONS);

export function createIcon(topic: Topic, iconId: string): SVGSVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    class: "icon",
    "aria-hidden": "true",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.6,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  // アイコンの中身は題材のソースコード（信頼できる入力）なので innerHTML で入れてよい。
  svg.innerHTML = topic.icons?.[iconId] ?? BUILTIN_ICONS[iconId] ?? "";
  return svg;
}
