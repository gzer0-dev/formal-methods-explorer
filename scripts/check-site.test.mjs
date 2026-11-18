import { describe, expect, it } from "vitest";

import { localRefs, metaContent } from "./check-site.mjs";

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
