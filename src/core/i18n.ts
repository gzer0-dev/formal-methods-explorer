// 画面の言語。題材は「言語を受け取って Topic を返す関数」で書き、計算はモジュールの最上位で1回だけ行う。
//
// { ja, en } の組を Topic の中に置いて後で解決する案は採らなかった。カードの項目名（rows のキー）も
// 画面に出る文字列で、オブジェクトのキーには組を置けないため。

export type Language = "ja" | "en";

export const LANGUAGES: readonly Language[] = ["ja", "en"];

/** t("日本語", "English") の形で、選んだ言語の方を返す関数を作る。 */
export function translator(language: Language): (ja: string, en: string) => string {
  return (ja, en) => (language === "ja" ? ja : en);
}

// ひらがな・カタカナ・漢字・全角の句読点と括弧（全角の空白は数えない）。英語の画面にこれが残っていたら訳し忘れ。
const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}、-〿！-｠]/u;

function isLab(value: object): value is {
  inputs: { id: string; initial: string }[];
  compute: (values: Record<string, string>) => unknown;
} {
  return "inputs" in value && "compute" in value && typeof value.compute === "function";
}

/**
 * 日本語の文字が残っている文字列を「場所: 文字列」で返す。英語の題材に当てて、訳し忘れを機械で見つけるため。
 * Lab は初期値で compute した結果も調べる（画面に出るのは計算結果なので）。
 */
export function findUntranslated(value: unknown, path = ""): string[] {
  if (typeof value === "string") {
    return JAPANESE.test(value) ? [`${path}: ${value}`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findUntranslated(item, `${path}[${index}]`));
  }
  if (value === null || typeof value !== "object") return [];
  const found: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (JAPANESE.test(key)) found.push(`${path}: キー ${key}`);
    found.push(...findUntranslated(child, childPath));
  }
  if (isLab(value)) {
    const initial = Object.fromEntries(
      value.inputs.map((input) => [input.id, input.initial]),
    );
    found.push(
      ...findUntranslated(
        value.compute(initial),
        `${path ? `${path}.` : ""}compute(initial)`,
      ),
    );
  }
  return found;
}
