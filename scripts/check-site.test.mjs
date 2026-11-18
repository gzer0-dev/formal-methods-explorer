import { describe, expect, it } from "vitest";

import {
  localRefs,
  metaContent,
  ogImageFile,
  staticLessonCount,
} from "./check-site.mjs";

describe("localRefs", () => {
  it("script・stylesheet・icon のローカルの読み込み先を拾う", () => {
    const html =
      '<link rel="icon" href="./favicon.svg" type="image/svg+xml" />' +
      '<script type="module" crossorigin src="./assets/index-abc.js"></script>' +
      '<link rel="stylesheet" crossorigin href="./assets/index-abc.css">';
    expect(localRefs(html).sort()).toEqual([
      "assets/index-abc.css",
      "assets/index-abc.js",
      "favicon.svg",
    ]);
  });

  it("外部の URL と canonical は拾わない", () => {
    const html =
      '<link rel="canonical" href="https://example.com/" />' +
      '<script src="https://cdn.example.com/x.js"></script>';
    expect(localRefs(html)).toEqual([]);
  });
});

describe("metaContent", () => {
  it("指定した meta の content を返し、無ければ null", () => {
    const html = '<meta property="og:url" content="https://example.com/" />';
    expect(metaContent(html, "property", "og:url")).toBe("https://example.com/");
    expect(metaContent(html, "name", "description")).toBeNull();
  });
});

describe("staticLessonCount", () => {
  it("#app に書き込んだ静的なレッスンの数を数える", () => {
    const html =
      '<div id="app"><section class="static-lesson" id="static-a"></section><section class="static-lesson" id="static-b"></section></div>';
    expect(staticLessonCount(html)).toBe(2);
    expect(staticLessonCount('<div id="app"></div>')).toBe(0);
  });
});

describe("ogImageFile", () => {
  it("og:image が公開 URL の下を指していれば、dist の中のファイル名を返す", () => {
    const html =
      '<meta property="og:image" content="https://example.com/site/og.png" />';
    expect(ogImageFile(html, "https://example.com/site/")).toBe("og.png");
  });

  it("og:image が無ければ null、公開 URL の外を指していれば undefined", () => {
    expect(ogImageFile("<head></head>", "https://example.com/site/")).toBeNull();
    const outside =
      '<meta property="og:image" content="https://other.example/og.png" />';
    expect(ogImageFile(outside, "https://example.com/site/")).toBeUndefined();
  });
});
