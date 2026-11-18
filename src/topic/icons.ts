// この題材だけで使うアイコン（24x24 の viewBox、線画）。共有のアイコンは src/ui/icons.ts にある。

export const TOPIC_ICONS: Record<string, string> = {
  process:
    '<rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  variable:
    '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M9 10l6 4M15 10l-6 4"/>',
  state: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  queue: '<path d="M4 6h16M4 12h16M4 18h10"/><path d="M18 16l3 2-3 2"/>',
  visited:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M15 17.5l2 2 3.5-4"/>',
  checker:
    '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M7.5 10.5l2 2 4-4"/>',
  spec: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 11h8M8 15h5M8 19h7"/>',
  route:
    '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h7a3 3 0 000-6h-4a3 3 0 010-6h7"/>',
  test: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4A2 2 0 0019 18l-5-9V3"/><path d="M7.5 15h9"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
  shrink:
    '<path d="M4 4l6 6M10 5v5H5M20 20l-6-6M14 19v-5h5M20 4l-6 6M14 5v5h5M4 20l6-6M10 19v-5H5"/>',
  contract:
    '<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0zM8 21h8"/>',
  job: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  people:
    '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20a5.5 5.5 0 0111 0M14 20a4 4 0 017.5-2"/>',
  // ヘッダーの印。状態の点が幅優先の順に現れて線でつながり、最後の点が反例として赤く光る。
  // 動きは theme.css の .mark-* が付ける。
  "graph-mark":
    '<circle class="mark-node mark-n1" cx="4" cy="12" r="2.6"/>' +
    '<path class="mark-edge mark-e1" d="M6.4 11l5.2-4.4"/>' +
    '<path class="mark-edge mark-e2" d="M6.4 13l5.2 4.4"/>' +
    '<circle class="mark-node mark-n2" cx="13.5" cy="5.5" r="2.6"/>' +
    '<circle class="mark-node mark-n3" cx="13.5" cy="18.5" r="2.6"/>' +
    '<path class="mark-edge mark-e3" d="M15.8 17.2l2.6-3"/>' +
    '<circle class="mark-node mark-n4 mark-bad" cx="20" cy="12" r="2.6"/>',
};
