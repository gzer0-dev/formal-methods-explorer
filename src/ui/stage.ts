// 図（登場物のカードと、そのあいだを流れるもの）を描く。
//
// カードはレッスンごとに 1 回だけ作り、ステップが変わるたびに中身とクラスだけを更新する。
// 毎回作り直さないのは、CSS の transition（現れる・色が変わる）を効かせるため。

import type { ActorStates } from "../core/timeline";
import type { Lesson, Step, Topic } from "../core/types";
import { el, svgEl } from "./dom";
import { createIcon } from "./icons";

// 図は固定の大きさで組み、入れ物の幅に合わせて丸ごと拡大縮小する。
// こうすると題材側は「0〜100 の位置」だけ考えればよく、画面幅ごとの配置を書かずに済む。
const STAGE_WIDTH = 960;
const DEFAULT_STAGE_HEIGHT = 520;
// これより小さくすると文字が読めない。狭い画面では縮めずに横スクロールにする。
const MIN_SCALE = 0.62;

export interface StageUpdate {
  states: ActorStates;
  step: Step | null;
  kindColor: string;
  /** 0 なら動かさない（戻る・飛ぶ・リセットのとき）。 */
  travelMs: number;
}

export interface StageView {
  element: HTMLElement;
  update(next: StageUpdate): void;
  destroy(): void;
}

interface Point {
  x: number;
  y: number;
}

function toPixels(actor: { x: number; y: number }, stageHeight: number): Point {
  return { x: (actor.x / 100) * STAGE_WIDTH, y: (actor.y / 100) * stageHeight };
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

// これより長い項目名の行は縦に並べる（6文字までなら、横に並べても値に十分な幅が残る）。
const STACK_LABEL_LENGTH = 6;

export function createStage(topic: Topic, lesson: Lesson): StageView {
  const stageHeight = lesson.stageHeight ?? DEFAULT_STAGE_HEIGHT;
  const element = el("div", { class: "stage", attrs: { "data-role": "stage" } });
  const sizer = el("div", { class: "stage-sizer" });
  const canvas = el("div", { class: "stage-canvas" });
  canvas.style.width = `${STAGE_WIDTH}px`;
  canvas.style.height = `${stageHeight}px`;
  const wires = svgEl("svg", {
    class: "stage-wires",
    viewBox: `0 0 ${STAGE_WIDTH} ${stageHeight}`,
    "aria-hidden": "true",
  });
  const flows = svgEl("g", { class: "stage-flows" });
  canvas.append(wires);
  sizer.append(canvas);
  element.append(sizer);

  const positions = new Map<string, Point>();
  for (const actor of lesson.actors)
    positions.set(actor.id, toPixels(actor, stageHeight));

  const wireByPair = new Map<
    string,
    { line: SVGLineElement; ends: [string, string] }
  >();
  for (const link of lesson.links) {
    const from = positions.get(link.from);
    const to = positions.get(link.to);
    if (!from || !to) continue;
    const line = svgEl("line", {
      class: "wire",
      "data-wire": pairKey(link.from, link.to),
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
    });
    wires.append(line);
    wireByPair.set(pairKey(link.from, link.to), { line, ends: [link.from, link.to] });
  }
  wires.append(flows);

  const cards = new Map<string, { card: HTMLElement; rows: HTMLElement }>();
  for (const actor of lesson.actors) {
    const rows = el("dl", { class: "actor-rows" });
    const card = el("div", { class: "actor", attrs: { "data-actor-id": actor.id } }, [
      el("div", { class: "actor-head" }, [
        createIcon(topic, actor.icon),
        el("div", { class: "actor-names" }, [
          el("strong", { text: actor.label }),
          ...(actor.sublabel ? [el("span", { text: actor.sublabel })] : []),
        ]),
      ]),
      rows,
    ]);
    card.style.left = `${actor.x}%`;
    card.style.top = `${actor.y}%`;
    canvas.append(card);
    cards.set(actor.id, { card, rows });
  }

  let scale = 1;
  function fit(): void {
    const availableWidth = element.clientWidth;
    if (availableWidth === 0) return;
    scale = Math.max(availableWidth / STAGE_WIDTH, MIN_SCALE);
    canvas.style.transform = `scale(${scale})`;
    sizer.style.width = `${STAGE_WIDTH * scale}px`;
    sizer.style.height = `${stageHeight * scale}px`;
  }
  const resizeObserver =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
  resizeObserver?.observe(element);

  /** 横スクロールになっているとき、いま動いている登場物が見える位置へ寄せる。 */
  function scrollToActor(actorId: string): void {
    const position = positions.get(actorId);
    const isScrollable = sizer.offsetWidth > element.clientWidth;
    if (!position || !isScrollable || typeof element.scrollTo !== "function") return;
    element.scrollTo({
      left: position.x * scale - element.clientWidth / 2,
      behavior: "smooth",
    });
  }

  function sendToken(from: Point, to: Point, color: string, travelMs: number): void {
    const token = el("div", { class: "token" });
    token.style.background = color;
    token.style.left = `${to.x}px`;
    token.style.top = `${to.y}px`;
    canvas.append(token);
    // jsdom には Web Animations API が無い。動きは飾りなので、無ければ出さずに消す。
    if (typeof token.animate !== "function") {
      token.remove();
      return;
    }
    const animation = token.animate(
      [
        { left: `${from.x}px`, top: `${from.y}px`, opacity: 1 },
        { left: `${to.x}px`, top: `${to.y}px`, opacity: 1, offset: 0.85 },
        { left: `${to.x}px`, top: `${to.y}px`, opacity: 0 },
      ],
      { duration: travelMs, easing: "cubic-bezier(0.45, 0, 0.2, 1)" },
    );
    animation.finished.then(() => token.remove()).catch(() => token.remove());
  }

  let previousRows = new Map<string, Record<string, string>>();

  function updateCard(actorId: string, next: StageUpdate): void {
    const entry = cards.get(actorId);
    const state = next.states[actorId];
    if (!entry || !state) return;
    const { card, rows } = entry;
    const isActing = next.step?.actor === actorId;
    const isReceiving = next.step?.to?.includes(actorId) ?? false;
    card.className = [
      "actor",
      `tone-${state.tone}`,
      state.isHidden ? "is-hidden" : "",
      isActing ? "is-acting" : "",
      isReceiving ? "is-receiving" : "",
    ]
      .filter(Boolean)
      .join(" ");
    card.setAttribute("aria-hidden", String(state.isHidden));

    const before = previousRows.get(actorId) ?? {};
    rows.replaceChildren();
    for (const [label, value] of Object.entries(state.rows)) {
      const hasChanged = next.step !== null && before[label] !== value;
      // カードは幅が約150pxしかない。項目名が長いと横並びでは値の列が数文字幅まで縮むので、項目名を上・値を下に置く。
      const stacked = label.length > STACK_LABEL_LENGTH ? "is-stacked" : "";
      rows.append(
        el("dt", { text: label, class: stacked }),
        el("dd", {
          text: value,
          class: [stacked, hasChanged ? "is-changed" : ""].filter(Boolean).join(" "),
        }),
      );
    }
  }

  function update(next: StageUpdate): void {
    for (const actorId of cards.keys()) updateCard(actorId, next);
    previousRows = new Map(
      Object.entries(next.states).map(([actorId, state]) => [actorId, state.rows]),
    );

    flows.replaceChildren();
    for (const { line, ends } of wireByPair.values()) {
      line.classList.remove("is-live");
      // まだ現れていない登場物へ向かう線だけが先に見えると、何も無い所へ線が伸びてしまう。
      const hasHiddenEnd = ends.some(
        (actorId) => next.states[actorId]?.isHidden ?? true,
      );
      line.classList.toggle("is-hidden", hasHiddenEnd);
    }
    canvas.style.setProperty("--kind-color", next.kindColor);
    canvas.querySelectorAll(".token").forEach((token) => token.remove());

    const step = next.step;
    if (!step) return;
    const from = positions.get(step.actor);
    if (!from) return;
    for (const targetId of step.to ?? []) {
      const to = positions.get(targetId);
      if (!to) continue;
      wireByPair.get(pairKey(step.actor, targetId))?.line.classList.add("is-live");
      flows.append(
        svgEl("line", { class: "flow", x1: from.x, y1: from.y, x2: to.x, y2: to.y }),
      );
      if (next.travelMs > 0) sendToken(from, to, next.kindColor, next.travelMs);
    }
    scrollToActor(step.to?.[0] ?? step.actor);
  }

  return {
    element,
    update,
    destroy: () => resizeObserver?.disconnect(),
  };
}
