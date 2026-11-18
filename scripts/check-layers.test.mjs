import { describe, expect, it } from "vitest";

import {
  coverageProblems,
  emptyCoverage,
  importSpecifiers,
  layerOf,
} from "./check-layers.mjs";

const full = {
  files: 30,
  guarded: 28,
  edges: 40,
  perLayer: { core: 8, topic: 6, ui: 14 },
};

describe("coverageProblems", () => {
  it("全部の層にファイルがあれば問題なし", () => {
    expect(coverageProblems(full)).toEqual([]);
  });

  it("src/ が空なら落ちる", () => {
    expect(coverageProblems(emptyCoverage())[0]).toContain("検査対象が 0 件");
  });

  it("topic を別名にして 0 件になったら、その層を名指しで落とす", () => {
    const problems = coverageProblems({
      ...full,
      perLayer: { ...full.perLayer, topic: 0 },
    });
    expect(problems.join("\n")).toContain("src/topic/");
  });

  it("層はあるのに import を 1 本も読めていなければ落ちる", () => {
    expect(coverageProblems({ ...full, edges: 0 })[0]).toContain("相対 import が 0 件");
  });
});

describe("layerOf", () => {
  it("src 直下のディレクトリ名を層として返す", () => {
    expect(layerOf("/repo/src/ui/stage.ts", "/repo/src")).toBe("ui");
  });

  it("層に属さないファイルは null", () => {
    expect(layerOf("/repo/src/main.ts", "/repo/src")).toBeNull();
  });
});

describe("importSpecifiers", () => {
  it("from つきの import と副作用 import の両方を拾う", () => {
    const source = 'import { a } from "../core/a";\nimport "./style.css";\n';
    expect(importSpecifiers(source)).toEqual(["../core/a", "./style.css"]);
  });
});
