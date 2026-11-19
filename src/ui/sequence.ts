// シーケンス図。登場物を横に並べ、ステップを上から下へ時間順に描く。
// 図（stage）が「いまの状態」を見せるのに対して、こちらは「ここまでの順番」を見せる。

import type { Lesson, Topic } from "../core/types";
import { svgEl } from "./dom";

const COLUMN_WIDTH = 150;
const HEADER_HEIGHT = 56;
const ROW_HEIGHT = 58;
const NOTE_HEIGHT = 26;
const NOTE_PADDING = 12;
const NOTE_CHAR_WIDTH = 12.5;
const ARROW_HEAD = 7;

function kindColor(topic: Topic, kindId: string): string {
  return topic.kinds.find((kind) => kind.id === kindId)?.color ?? "currentColor";
}

function arrowHead(x: number, y: number, isPointingRight: boolean): SVGPathElement {
  const back = isPointingRight ? x - ARROW_HEAD : x + ARROW_HEAD;
  return svgEl("path", {
    class: "seq-head",
    d: `M${x} ${y}L${back} ${y - ARROW_HEAD / 1.6}L${back} ${y + ARROW_HEAD / 1.6}Z`,
  });
}

export function createSequence(
  topic: Topic,
  lesson: Lesson,
  cursor: number,
  onSeek: (stepIndex: number) => void,
  label = "シーケンス図",
): SVGSVGElement {
  const width = COLUMN_WIDTH * lesson.actors.length;
  const height = HEADER_HEIGHT + ROW_HEIGHT * lesson.steps.length + 16;
  const svg = svgEl("svg", {
    class: "sequence-svg",
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "group",
    "aria-label": label,
  });

  const columnX = new Map<string, number>();
  lesson.actors.forEach((actor, index) => {
    const x = COLUMN_WIDTH * index + COLUMN_WIDTH / 2;
    columnX.set(actor.id, x);
    const label = svgEl("text", {
      class: "seq-actor",
      x,
      y: 24,
      "text-anchor": "middle",
    });
    label.textContent = actor.label;
    svg.append(
      label,
      svgEl("line", {
        class: "seq-lifeline",
        x1: x,
        y1: 36,
        x2: x,
        y2: height - 8,
      }),
    );
  });

  lesson.steps.forEach((step, index) => {
    const y = HEADER_HEIGHT + ROW_HEIGHT * index + ROW_HEIGHT / 2;
    const fromX = columnX.get(step.actor) ?? 0;
    const stateClass =
      index === cursor ? "is-current" : index > cursor ? "is-future" : "is-past";
    const group = svgEl("g", {
      class: `seq-step ${stateClass}`,
      "data-step-index": index,
      role: "button",
      tabindex: 0,
      "aria-label": `${index + 1}. ${step.title}`,
    });
    group.style.setProperty("--kind-color", kindColor(topic, step.kind));
    // 行のどこを押しても反応するように、見えない当たり判定を敷く。
    group.append(
      svgEl("rect", {
        class: "seq-hit",
        x: 0,
        y: y - ROW_HEIGHT / 2,
        width,
        height: ROW_HEIGHT,
      }),
    );

    const targets = (step.to ?? []).map((id) => columnX.get(id) ?? 0);
    const nearestTarget = targets.reduce(
      (a, b) => (Math.abs(a - fromX) <= Math.abs(b - fromX) ? a : b),
      targets[0] ?? fromX,
    );
    // 列が多くて横スクロールになるとき、画面側がこの位置を見える所へ寄せる。
    group.setAttribute("data-focus-x", String((fromX + nearestTarget) / 2));
    if (targets.length === 0) {
      const noteWidth = Math.min(
        step.title.length * NOTE_CHAR_WIDTH + NOTE_PADDING * 2,
        COLUMN_WIDTH * 1.6,
      );
      const noteX = Math.max(4, Math.min(fromX - noteWidth / 2, width - noteWidth - 4));
      const text = svgEl("text", {
        class: "seq-note-text",
        x: noteX + noteWidth / 2,
        y: y + 4,
        "text-anchor": "middle",
      });
      text.textContent = step.title;
      group.append(
        svgEl("rect", {
          class: "seq-note",
          x: noteX,
          y: y - NOTE_HEIGHT / 2,
          width: noteWidth,
          height: NOTE_HEIGHT,
          rx: 4,
        }),
        text,
      );
    } else {
      for (const toX of targets) {
        group.append(
          svgEl("line", {
            class: "seq-arrow",
            x1: fromX,
            y1: y + 8,
            x2: toX,
            y2: y + 8,
          }),
          arrowHead(toX, y + 8, toX > fromX),
        );
      }
      const label = svgEl("text", {
        class: "seq-label",
        x: (fromX + nearestTarget) / 2,
        y: y - 2,
        "text-anchor": "middle",
      });
      label.textContent = step.title;
      group.append(label);
    }

    group.addEventListener("click", () => onSeek(index));
    group.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      onSeek(index);
    });
    svg.append(group);
  });

  return svg;
}
