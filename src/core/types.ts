// 題材（Topic）のデータ形式。題材を足す人が書くのはこの形のデータだけ。
//
// 設計の要点: ステップは「誰から誰へ何が流れたか」だけでなく「各登場物の状態がどう変わったか」
// (set) を持てる。通信の話（プロトコル）も、内部状態が変わる話（台帳・状態機械）も同じ形で書ける。

/** 登場物の持続する状態の色分け。「いま動いている」強調はステップから自動で付くので含めない。 */
export type Tone = "idle" | "ok" | "bad" | "wait";

export interface ActorState {
  tone: Tone;
  /** true のあいだ図に出ない。途中で現れる登場物（新しいブロックなど）に使う。 */
  isHidden: boolean;
  /** 図のカードに出す「項目名 → 値」。順序は書いた順。 */
  rows: Record<string, string>;
}

/** 状態の差分。rows の値に null を入れるとその行を消す。 */
export interface ActorPatch {
  tone?: Tone;
  isHidden?: boolean;
  rows?: Record<string, string | null>;
}

export interface Actor {
  id: string;
  label: string;
  sublabel?: string;
  icon: string;
  /** 図の中の位置。左上が (0, 0)、右下が (100, 100)。カードの中心を指す。 */
  x: number;
  y: number;
  initial?: ActorPatch;
}

export interface Link {
  from: string;
  to: string;
}

export interface Field {
  label: string;
  value: string;
  note?: string;
  tone?: Tone;
  /** ハッシュ値など、等幅で折り返して見せたい値。 */
  isCode?: boolean;
}

export interface Section {
  title: string;
  fields: Field[];
}

export interface Step {
  id: string;
  /** Topic.kinds の id。一覧と凡例の色分けに使う。 */
  kind: string;
  title: string;
  /** このステップの主体。to が無ければ「この登場物の中で起きたこと」になる。 */
  actor: string;
  /** 主体から何かが送られる先。複数なら同時に届く。 */
  to?: string[];
  /** 一覧の1行に出す短い説明。 */
  summary: string;
  /** 何が起きたか、なぜそうするのかの説明。 */
  explain: string;
  set?: Record<string, ActorPatch>;
  /** 「中身を見る」に出す詳細。 */
  detail?: Section[];
  /** 実物と違う簡略化をしたときに、何を省いたかを書く。画面に「簡略化」として出る。 */
  simplified?: string;
}

export interface LabInput {
  id: string;
  label: string;
  initial: string;
}

/** 読者が値を入れて結果を確かめる小さな実験。compute は純関数にする。 */
export interface Lab {
  title: string;
  hint: string;
  inputs: LabInput[];
  compute(values: Record<string, string>): Field[];
}

export interface Lesson {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  summary: string;
  /**
   * 図を見る前に読む概要（段落ごと）。何の話か・なぜ大事か・図のどこを見るかを書く。
   * summary と facts は「見た後に分かること（結果）」で、こちらは「見る前の前提と見どころ」。省略すると出さない。
   */
  intro?: string[];
  facts: Field[];
  actors: Actor[];
  /** 図の高さ（幅 960 に対する値）。登場物が横 1 列なら 300 前後、2 段以上なら既定の 520。 */
  stageHeight?: number;
  links: Link[];
  steps: Step[];
  lab?: Lab;
}

export interface Kind {
  id: string;
  label: string;
  /** CSS の色。theme.css の変数を var(--kind-a) のように指してよい。 */
  color: string;
}

export interface Category {
  id: string;
  label: string;
}

export interface Topic {
  id: string;
  title: string;
  tagline: string;
  /** ヘッダーの左上に出す印のアイコン id。 */
  brandIcon: string;
  /** 一覧の列見出し。題材の言葉に合わせる（「パケットの流れ」「処理の流れ」など）。 */
  timelineTitle: string;
  kinds: Kind[];
  categories: Category[];
  lessons: Lesson[];
  /** 追加のアイコン。値は 24x24 の viewBox に描く SVG の中身（path など）。 */
  icons?: Record<string, string>;
}
