import { describe, expect, it } from "vitest";

import { addOgImage, injectStatic, renderStaticTopic } from "./prerender.mjs";

const topic = {
  title: "仕組み<見本>",
  tagline: "1ステップずつ & 図で",
  lessons: [
    {
      id: "one",
      title: "1本目",
      subtitle: "副題",
      summary: '要約 "引用"',
      intro: ["概要の1段落目", "概要の2段落目"],
      steps: [
        { title: "手1", summary: "一覧の1行", explain: "説明 <b>太字ではない</b>" },
      ],
    },
  ],
};

describe("renderStaticTopic", () => {
  it("題材の題・各レッスンの題と要約・各ステップの題と説明を、文字を逃がして HTML にする", () => {
    const html = renderStaticTopic(topic);
    expect(html).toContain("<h1>仕組み&lt;見本&gt;</h1>");
    expect(html).toContain("1ステップずつ &amp; 図で");
    expect(html).toContain('<section class="static-lesson" id="static-one">');
    expect(html).toContain("<h2>1本目</h2>");
    expect(html).toContain("要約 &quot;引用&quot;");
    expect(html).toContain("説明 &lt;b&gt;太字ではない&lt;/b&gt;");
    expect(html).not.toContain("<b>");
    expect(html).toContain('<p class="static-intro">概要の1段落目</p>');
    expect(html).toContain('<p class="static-intro">概要の2段落目</p>');
  });
});

describe("injectStatic", () => {
  it("空の #app に静的な本文を入れる（JavaScript が動くと画面が置き換える）", () => {
    const html = '<body><div id="app"></div></body>';
    expect(injectStatic(html, "<p>本文</p>")).toBe(
      '<body><div id="app"><p>本文</p></div></body>',
    );
  });

  it("#app が見つからなければ例外にする（入れ忘れたまま公開しないため）", () => {
    expect(() => injectStatic("<body></body>", "<p>本文</p>")).toThrow();
  });
});

describe("addOgImage", () => {
  it("og:image と大きい画像のカードの meta を head の終わりに足す", () => {
    const html = "<head><title>t</title></head>";
    const result = addOgImage(html, "https://example.com/site/og.png");
    expect(result).toContain(
      '<meta property="og:image" content="https://example.com/site/og.png" />',
    );
    expect(result).toContain(
      '<meta name="twitter:card" content="summary_large_image" />',
    );
    expect(result.indexOf("og:image")).toBeLessThan(result.indexOf("</head>"));
  });
});
