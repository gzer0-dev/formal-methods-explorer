// @vitest-environment jsdom
//
// 画面の進行テスト。「入力 → 状態が変わって画面に出る」を、押せるものすべてについて確かめる。
// ここが無いと、配線を 1 本落としただけで「押しても進まない」画面が緑のまま出荷される。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureTopic } from "../core/fixtureTopic";
import { stepIntervalMs } from "../core/player";
import { mountApp } from "./app";

function setup(lessonId?: string) {
  const root = document.createElement("div");
  document.body.append(root);
  const app = mountApp(root, fixtureTopic(), { initialLessonId: lessonId });
  const q = <T extends Element>(selector: string): T => {
    const found = root.querySelector<T>(selector);
    if (!found) throw new Error(`画面に ${selector} が無い`);
    return found;
  };
  const click = (selector: string) => q<HTMLElement>(selector).click();
  const text = (selector: string) => q(selector).textContent ?? "";
  const press = (key: string) =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  return { root, app, q, click, text, press };
}

beforeEach(() => {
  vi.useFakeTimers();
  history.replaceState(null, "", "#");
});

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("最初の表示", () => {
  it("最初のレッスンが選ばれ、まだ何も起きていない", () => {
    const { text, q } = setup();
    expect(text("[data-role=lesson-title]")).toBe("注文が届くまで");
    expect(text("[data-role=step-counter]")).toBe("0 / 3");
    expect(q("[data-lesson-id=order]").getAttribute("aria-current")).toBe("true");
  });

  it("まだ現れていない登場物は隠れている", () => {
    const { q } = setup();
    expect(q("[data-actor-id=slip]").classList.contains("is-hidden")).toBe(true);
  });
});

describe("図の大きさ", () => {
  it("レッスンが指定した高さで図を組む", () => {
    const { q, click } = setup();
    expect(q<HTMLElement>(".stage-canvas").style.height).toBe("300px");
    click("[data-lesson-id=refund]");
    expect(q<HTMLElement>(".stage-canvas").style.height).toBe("520px");
  });
});

describe("登場物をつなぐ線", () => {
  it("片方の端がまだ現れていない線は出さず、現れたら出す", () => {
    const { q, click } = setup();
    const wire = q<SVGLineElement>("[data-wire='shop|slip']");
    expect(wire.classList.contains("is-hidden")).toBe(true);
    click("[data-action=next]");
    click("[data-action=next]");
    expect(wire.classList.contains("is-hidden")).toBe(false);
  });

  it("両端が見えている線は最初から出ている", () => {
    const { q } = setup();
    expect(q("[data-wire='customer|shop']").classList.contains("is-hidden")).toBe(
      false,
    );
  });
});

describe("1 つずつ進める", () => {
  it("「次へ」で 1 つ進み、字幕・一覧の現在行・登場物の状態が変わる", () => {
    const { click, text, q } = setup();
    click("[data-action=next]");
    expect(text("[data-role=step-counter]")).toBe("1 / 3");
    expect(text("[data-role=caption-title]")).toBe("注文を送る");
    expect(text("[data-role=caption-explain]")).toBe("客が欲しい品を店に伝える。");
    expect(q("tr[data-step-index='0']").getAttribute("aria-current")).toBe("step");
    expect(text("[data-actor-id=shop]")).toContain("りんご 2");
  });

  it("進めると、途中で現れる登場物が見えるようになる", () => {
    const { click, q } = setup();
    click("[data-action=next]");
    click("[data-action=next]");
    expect(q("[data-actor-id=slip]").classList.contains("is-hidden")).toBe(false);
  });

  it("「前へ」で 1 つ戻り、登場物の状態も戻る", () => {
    const { click, text, q } = setup();
    click("[data-action=next]");
    click("[data-action=next]");
    click("[data-action=prev]");
    expect(text("[data-role=step-counter]")).toBe("1 / 3");
    expect(q("[data-actor-id=slip]").classList.contains("is-hidden")).toBe(true);
  });

  it("「最初から」で何も起きていない状態に戻る", () => {
    const { click, text } = setup();
    click("[data-action=next]");
    click("[data-action=reset]");
    expect(text("[data-role=step-counter]")).toBe("0 / 3");
  });

  it("最初では「前へ」、最後では「次へ」が押せない", () => {
    const { click, q } = setup();
    expect(q<HTMLButtonElement>("[data-action=prev]").disabled).toBe(true);
    click("[data-action=next]");
    click("[data-action=next]");
    click("[data-action=next]");
    expect(q<HTMLButtonElement>("[data-action=next]").disabled).toBe(true);
  });

  it("主体と送り先の登場物が強調される", () => {
    const { click, q } = setup();
    click("[data-action=next]");
    expect(q("[data-actor-id=customer]").classList.contains("is-acting")).toBe(true);
    expect(q("[data-actor-id=shop]").classList.contains("is-receiving")).toBe(true);
  });
});

describe("ステップの中身", () => {
  it("詳細のあるステップでは中身が出る", () => {
    const { click, text } = setup();
    click("[data-action=next]");
    expect(text("[data-role=step-detail]")).toContain("注文の中身");
    expect(text("[data-role=step-detail]")).toContain("りんご");
  });

  it("簡略化の注記があるステップでは、その注記が出る", () => {
    const { click, text } = setup();
    click("[data-action=next]");
    click("[data-action=next]");
    expect(text("[data-role=caption-simplified]")).toContain("在庫の確認");
  });
});

describe("再生", () => {
  it("再生を押すと時間とともに進み、最後で止まる", () => {
    const { click, text, q } = setup();
    click("[data-action=toggle]");
    expect(q("[data-action=toggle]").getAttribute("aria-pressed")).toBe("true");
    vi.advanceTimersByTime(stepIntervalMs(1) * 2);
    expect(text("[data-role=step-counter]")).toBe("2 / 3");
    vi.advanceTimersByTime(stepIntervalMs(1) * 5);
    expect(text("[data-role=step-counter]")).toBe("3 / 3");
    expect(q("[data-action=toggle]").getAttribute("aria-pressed")).toBe("false");
  });

  it("再生中にもう一度押すと止まる", () => {
    const { click, text } = setup();
    click("[data-action=toggle]");
    click("[data-action=toggle]");
    vi.advanceTimersByTime(stepIntervalMs(1) * 3);
    expect(text("[data-role=step-counter]")).toBe("0 / 3");
  });

  it("速さを替えると表示が変わり、進む間隔が短くなる", () => {
    const { click, text } = setup();
    click("[data-action=cycleSpeed]");
    expect(text("[data-action=cycleSpeed]")).toBe("2×");
    click("[data-action=toggle]");
    vi.advanceTimersByTime(stepIntervalMs(2) * 2);
    expect(text("[data-role=step-counter]")).toBe("2 / 3");
  });
});

describe("一覧の行", () => {
  it("行を押すとそのステップへ飛ぶ", () => {
    const { click, text } = setup();
    click("tr[data-step-index='2']");
    expect(text("[data-role=step-counter]")).toBe("3 / 3");
    expect(text("[data-role=caption-title]")).toBe("受付を知らせる");
  });

  it("行にフォーカスして Enter でも飛ぶ", () => {
    const { q, text } = setup();
    q<HTMLElement>("tr[data-step-index='1']").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(text("[data-role=step-counter]")).toBe("2 / 3");
  });
});

describe("レッスンの切り替え", () => {
  it("別のレッスンを押すと内容が替わり、最初の状態になる", () => {
    const { click, text, q } = setup();
    click("[data-action=next]");
    click("[data-lesson-id=refund]");
    expect(text("[data-role=lesson-title]")).toBe("返金の流れ");
    expect(text("[data-role=step-counter]")).toBe("0 / 2");
    expect(q("[data-lesson-id=refund]").getAttribute("aria-current")).toBe("true");
    expect(location.hash).toBe("#refund");
  });

  it("URL で指定したレッスンから始められる", () => {
    const { text } = setup("refund");
    expect(text("[data-role=lesson-title]")).toBe("返金の流れ");
  });

  it("実験のないレッスンでは実験の欄が出ない", () => {
    const { click, root } = setup();
    expect(root.querySelector("[data-role=lab]")).not.toBeNull();
    click("[data-lesson-id=refund]");
    expect(root.querySelector("[data-role=lab]")).toBeNull();
  });
});

describe("表示の切り替え", () => {
  it("「シーケンス」を押すとシーケンス図に替わり、「図」で戻る", () => {
    const { click, q } = setup();
    click("[data-view-tab=sequence]");
    expect(q<HTMLElement>("[data-role=sequence]").hidden).toBe(false);
    expect(q<HTMLElement>("[data-role=stage]").hidden).toBe(true);
    click("[data-view-tab=diagram]");
    expect(q<HTMLElement>("[data-role=stage]").hidden).toBe(false);
  });

  it("シーケンス図の各ステップは、横スクロールで寄せる先の位置を持っている", () => {
    const { click, q } = setup();
    click("[data-view-tab=sequence]");
    // 客（1 列目）から店（2 列目）への矢印なので、2 つの列の中間になる。
    expect(
      q("[data-role=sequence] [data-step-index='0']").getAttribute("data-focus-x"),
    ).toBe("150");
    // 店（2 列目）の中で起きるステップは、店の列の位置になる。
    expect(
      q("[data-role=sequence] [data-step-index='1']").getAttribute("data-focus-x"),
    ).toBe("225");
  });

  it("シーケンス図のステップを押すとそこへ飛ぶ", () => {
    const { click, q, text } = setup();
    click("[data-view-tab=sequence]");
    q("[data-role=sequence] [data-step-index='1']").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(text("[data-role=step-counter]")).toBe("2 / 3");
  });
});

describe("キーボード", () => {
  it("→ で進み、← で戻る", () => {
    const { press, text } = setup();
    press("ArrowRight");
    press("ArrowRight");
    press("ArrowLeft");
    expect(text("[data-role=step-counter]")).toBe("1 / 3");
  });

  it("スペースで再生と一時停止を切り替える", () => {
    const { press, q } = setup();
    press(" ");
    expect(q("[data-action=toggle]").getAttribute("aria-pressed")).toBe("true");
    press(" ");
    expect(q("[data-action=toggle]").getAttribute("aria-pressed")).toBe("false");
  });

  it("R で最初に戻る", () => {
    const { press, text } = setup();
    press("ArrowRight");
    press("r");
    expect(text("[data-role=step-counter]")).toBe("0 / 3");
  });

  it("入力欄に打っているあいだはキー操作を奪わない", () => {
    const { q, text } = setup();
    q<HTMLInputElement>("[data-role=lab] input").dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(text("[data-role=step-counter]")).toBe("0 / 3");
  });
});

describe("実験", () => {
  it("入力を変えると結果が変わる", () => {
    const { q, text } = setup();
    expect(text("[data-role=lab-result]")).toContain("200円");
    const input = q<HTMLInputElement>("[data-role=lab] input");
    input.value = "5";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(text("[data-role=lab-result]")).toContain("500円");
  });
});

describe("後片づけ", () => {
  it("destroy のあとはキー操作に反応しない", () => {
    const { app, press, text } = setup();
    app.destroy();
    press("ArrowRight");
    expect(text("[data-role=step-counter]")).toBe("0 / 3");
  });
});
