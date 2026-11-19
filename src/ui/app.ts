// 画面全体の組み立てと配線。題材（Topic）は引数で受け取り、特定の題材を知らない。
//
// 状態は PlayerState（core/player）と「図／シーケンス」の表示切り替えだけ。
// 入力はすべて dispatch を通り、そのたびに render が画面を状態に合わせ直す。

import {
  initialPlayer,
  reducePlayer,
  stepIntervalMs,
  type PlayerAction,
  type PlayerState,
} from "../core/player";
import { statesAt } from "../core/timeline";
import { LANGUAGES, type Language } from "../core/i18n";
import type { Lesson, Step, Topic } from "../core/types";
import { el } from "./dom";
import { createFieldList, createSections } from "./fields";
import { createIcon } from "./icons";
import { createSequence } from "./sequence";
import { createStage, type StageView } from "./stage";
import { UI_TEXT } from "./uiText";

export interface AppOptions {
  initialLessonId?: string;
  /** 開いてすぐ最初のレッスンを再生する（最初の数秒で「動く図」だと伝えるため）。 */
  shouldAutoplay?: boolean;
  /** 開いたときのステップ（言語を切り替えて作り直すとき、いまの位置を引き継ぐ）。 */
  initialCursor?: number;
  /** 画面の固定文言の言語。題材の文言は Topic の側で決まる。 */
  language?: Language;
  /** 2つ以上あると、ヘッダーに切り替えのボタンを出す。押すと onSwitchLanguage が呼ばれる。 */
  languages?: Language[];
  onSwitchLanguage?: (
    language: Language,
    position: { lessonId: string; cursor: number },
  ) => void;
}

export interface App {
  destroy(): void;
}

type ViewMode = "diagram" | "sequence";

const AUTOPLAY_DELAY_MS = 900;
// 流れる点が相手に着いてから次のステップまで、読む時間を残す。
const TRAVEL_SHARE_OF_INTERVAL = 0.45;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function controlButton(action: string, label: string, text: string): HTMLButtonElement {
  return el("button", {
    class: `control control-${action}`,
    text,
    attrs: { type: "button", "data-action": action, "aria-label": label, title: label },
  });
}

export function mountApp(
  root: HTMLElement,
  topic: Topic,
  options: AppOptions = {},
): App {
  const outlines = topic.lessons.map((lesson) => ({
    id: lesson.id,
    stepCount: lesson.steps.length,
  }));
  const text = UI_TEXT[options.language ?? "ja"];
  let player: PlayerState = initialPlayer(outlines, options.initialLessonId);
  if (options.initialCursor !== undefined) {
    player = reducePlayer(outlines, player, {
      type: "seek",
      cursor: options.initialCursor,
    });
  }
  let viewMode: ViewMode = "diagram";
  let tickTimer: number | undefined;
  let renderedLessonId: string | null = null;
  let renderedCursor = -1;
  let stage: StageView | null = null;

  const lessonOf = (state: PlayerState): Lesson =>
    topic.lessons.find((lesson) => lesson.id === state.lessonId) ?? topic.lessons[0];
  const kindOf = (step: Step | null) =>
    topic.kinds.find((kind) => kind.id === step?.kind) ?? null;

  // ---- 骨組み（題材が変わらない限り作り直さない部分） ----
  const lessonButtons = new Map<string, HTMLButtonElement>();
  const lessonNav = el("nav", {
    class: "lessons",
    attrs: { "aria-label": text.lessonsNav },
  });
  let lessonNumber = 0;
  for (const category of topic.categories) {
    const group = el("div", { class: "lesson-group" }, [
      el("h2", { text: category.label }),
    ]);
    for (const lesson of topic.lessons.filter((l) => l.category === category.id)) {
      lessonNumber += 1;
      const button = el(
        "button",
        {
          class: "lesson-button",
          attrs: { type: "button", "data-lesson-id": lesson.id },
        },
        [
          el("span", { class: "lesson-number", text: String(lessonNumber) }),
          el("span", { class: "lesson-names" }, [
            el("strong", { text: lesson.title }),
            el("small", { text: lesson.subtitle }),
          ]),
        ],
      );
      button.addEventListener("click", () =>
        dispatch({ type: "selectLesson", lessonId: lesson.id }),
      );
      lessonButtons.set(lesson.id, button);
      group.append(button);
    }
    lessonNav.append(group);
  }

  const header = el("header", { class: "app-header" }, [
    el("div", { class: "brand" }, [
      el("span", { class: "brand-mark" }, [createIcon(topic, topic.brandIcon)]),
      el("div", {}, [
        el("h1", { text: topic.title }),
        el("p", { text: topic.tagline }),
      ]),
    ]),
  ]);
  const otherLanguage = (options.languages ?? []).find(
    (language) => language !== (options.language ?? "ja"),
  );
  if (otherLanguage && options.onSwitchLanguage) {
    const onSwitchLanguage = options.onSwitchLanguage;
    // 押した先の言語の名前を、その言語の書き方で出す（読めない言語のボタンを探させないため）。
    const languageButton = el("button", {
      class: "language-switch",
      text: UI_TEXT[otherLanguage].languageName,
      attrs: {
        type: "button",
        "data-action": "switchLanguage",
        lang: otherLanguage,
        "aria-label": UI_TEXT[otherLanguage].switchLanguage,
        title: UI_TEXT[otherLanguage].switchLanguage,
      },
    });
    languageButton.addEventListener("click", () =>
      onSwitchLanguage(otherLanguage, {
        lessonId: player.lessonId,
        cursor: player.cursor,
      }),
    );
    header.append(languageButton);
  }

  const lessonTitle = el("h2", { attrs: { "data-role": "lesson-title" } });
  const lessonSubtitle = el("p", { class: "lesson-subtitle" });
  // 図を見る前に読む概要。図の上に置き、いつでも読み返せるようにする（再生しても消えない）。
  const lessonIntro = el("div", {
    class: "lesson-intro",
    attrs: { "data-role": "lesson-intro" },
  });
  const viewTabs = new Map<ViewMode, HTMLButtonElement>();
  const tabList = el("div", {
    class: "view-tabs",
    attrs: { role: "tablist", "aria-label": text.viewTabs },
  });
  for (const [mode, label] of [
    ["diagram", text.diagram],
    ["sequence", text.sequence],
  ] as const) {
    const tab = el("button", {
      text: label,
      attrs: { type: "button", role: "tab", "data-view-tab": mode },
    });
    tab.addEventListener("click", () => {
      viewMode = mode;
      render();
    });
    viewTabs.set(mode, tab);
    tabList.append(tab);
  }
  const stageHost = el("div", { class: "stage-host" });
  const sequenceHost = el("div", {
    class: "sequence",
    attrs: { "data-role": "sequence" },
  });
  const captionKind = el("span", { class: "kind-badge" });
  const captionTitle = el("strong", { attrs: { "data-role": "caption-title" } });
  const captionExplain = el("p", { attrs: { "data-role": "caption-explain" } });
  const captionSimplified = el("p", {
    class: "simplified",
    attrs: { "data-role": "caption-simplified" },
  });
  const caption = el("div", { class: "caption", attrs: { "aria-live": "polite" } }, [
    el("div", { class: "caption-head" }, [captionKind, captionTitle]),
    captionExplain,
    captionSimplified,
  ]);
  const viewer = el("section", { class: "panel viewer" }, [
    el("div", { class: "viewer-head" }, [
      el("div", {}, [lessonTitle, lessonSubtitle]),
      tabList,
    ]),
    lessonIntro,
    stageHost,
    sequenceHost,
    caption,
  ]);

  const speedButton = controlButton("cycleSpeed", text.speed, "1×");
  const prevButton = controlButton("prev", text.prevHint, text.prev);
  const toggleButton = controlButton("toggle", text.playHint, text.play);
  const nextButton = controlButton("next", text.nextHint, text.next);
  const resetButton = controlButton("reset", text.resetHint, text.reset);
  const stepCounter = el("span", {
    class: "step-counter",
    attrs: { "data-role": "step-counter" },
  });
  for (const button of [
    speedButton,
    prevButton,
    toggleButton,
    nextButton,
    resetButton,
  ]) {
    const action = button.dataset.action as PlayerAction["type"];
    button.addEventListener("click", () => dispatch({ type: action } as PlayerAction));
  }
  const legend = el(
    "ul",
    { class: "legend" },
    topic.kinds.map((kind) => {
      const item = el("li", { text: kind.label });
      item.style.setProperty("--kind-color", kind.color);
      return item;
    }),
  );
  const tableBody = el("tbody");
  const timeline = el("section", { class: "panel timeline" }, [
    el("div", { class: "timeline-head" }, [
      el("h2", { text: topic.timelineTitle }),
      legend,
      el("div", { class: "controls" }, [
        stepCounter,
        speedButton,
        prevButton,
        toggleButton,
        nextButton,
        resetButton,
      ]),
    ]),
    el("div", { class: "table-scroll" }, [
      el("table", {}, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", { text: text.columnNumber }),
            el("th", { text: text.columnKind }),
            el("th", { text: text.columnWhere }),
            el("th", { text: text.columnWhat }),
          ]),
        ]),
        tableBody,
      ]),
    ]),
    el("p", {
      class: "key-hint",
      text: text.keyHint,
    }),
  ]);

  const stepDetail = el("section", {
    class: "panel side-section",
    attrs: { "data-role": "step-detail" },
  });
  const overview = el("section", { class: "panel side-section" });
  const labHost = el("div");
  const side = el("aside", { class: "side" }, [stepDetail, overview, labHost]);

  const app = el("div", { class: "app" }, [
    header,
    lessonNav,
    el("main", { class: "main" }, [viewer, timeline]),
    side,
  ]);
  root.replaceChildren(app);

  // ---- レッスンが替わったときだけ作り直す部分 ----
  function actorLabel(lesson: Lesson, actorId: string): string {
    return lesson.actors.find((actor) => actor.id === actorId)?.label ?? actorId;
  }

  function buildTable(lesson: Lesson): void {
    tableBody.replaceChildren();
    lesson.steps.forEach((step, index) => {
      const kind = kindOf(step);
      const badge = el("span", { class: "kind-badge", text: kind?.label ?? step.kind });
      badge.style.setProperty("--kind-color", kind?.color ?? "currentColor");
      const where = [actorLabel(lesson, step.actor)];
      if (step.to?.length) {
        where.push(
          "→",
          step.to.map((id) => actorLabel(lesson, id)).join(text.listSeparator),
        );
      }
      const row = el(
        "tr",
        { attrs: { "data-step-index": String(index), tabindex: "0" } },
        [
          el("td", { class: "cell-number", text: String(index + 1) }),
          el("td", {}, [badge]),
          el("td", { class: "cell-where", text: where.join(" ") }),
          el("td", { text: step.summary }),
        ],
      );
      row.addEventListener("click", () => dispatch({ type: "seek", cursor: index }));
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        dispatch({ type: "seek", cursor: index });
      });
      tableBody.append(row);
    });
  }

  function buildOverview(lesson: Lesson): void {
    overview.replaceChildren(
      el("h3", { text: text.overviewTitle }),
      el("p", { text: lesson.summary }),
      createFieldList(lesson.facts),
    );
  }

  function buildLab(lesson: Lesson): void {
    labHost.replaceChildren();
    const lab = lesson.lab;
    if (!lab) return;
    const result = el("div", {
      attrs: { "data-role": "lab-result", "aria-live": "polite" },
    });
    const values = Object.fromEntries(
      lab.inputs.map((input) => [input.id, input.initial]),
    );
    const showResult = () => {
      try {
        result.replaceChildren(createFieldList(lab.compute(values)));
      } catch (error) {
        console.error("実験の計算に失敗した", error);
        result.replaceChildren(el("p", { text: text.labError }));
      }
    };
    const inputs = lab.inputs.map((input) => {
      const field = el("input", { attrs: { type: "text", value: input.initial } });
      field.addEventListener("input", () => {
        values[input.id] = field.value;
        showResult();
      });
      return el("label", { class: "lab-input" }, [
        el("span", { text: input.label }),
        field,
      ]);
    });
    showResult();
    labHost.append(
      el(
        "section",
        { class: "panel side-section lab", attrs: { "data-role": "lab" } },
        [el("h3", { text: lab.title }), el("p", { text: lab.hint }), ...inputs, result],
      ),
    );
  }

  /** スマホ幅ではレッスンの一覧が横に流れる。選んだレッスンが画面の外に残らないように寄せる。 */
  function scrollLessonNavTo(button: HTMLElement | undefined): void {
    const isScrollable = lessonNav.scrollWidth > lessonNav.clientWidth;
    if (!button || !isScrollable || typeof lessonNav.scrollTo !== "function") return;
    lessonNav.scrollTo({ left: button.offsetLeft - lessonNav.offsetLeft - 10 });
  }

  function buildLesson(lesson: Lesson): void {
    stage?.destroy();
    stage = createStage(topic, lesson);
    stageHost.replaceChildren(stage.element);
    lessonTitle.textContent = lesson.title;
    lessonSubtitle.textContent = lesson.subtitle;
    const introParagraphs = lesson.intro ?? [];
    lessonIntro.hidden = introParagraphs.length === 0;
    lessonIntro.replaceChildren(...introParagraphs.map((text) => el("p", { text })));
    buildTable(lesson);
    buildOverview(lesson);
    buildLab(lesson);
    document.title = `${lesson.title} | ${topic.title}`;
    for (const [lessonId, button] of lessonButtons) {
      const isCurrent = lessonId === lesson.id;
      if (isCurrent) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
    scrollLessonNavTo(lessonButtons.get(lesson.id));
  }

  // ---- 状態が変わるたびに合わせ直す部分 ----
  function renderCaption(step: Step | null): void {
    const kind = kindOf(step);
    captionKind.hidden = kind === null;
    captionKind.textContent = kind?.label ?? "";
    captionKind.style.setProperty("--kind-color", kind?.color ?? "currentColor");
    // 再生する前は説明の欄に何も出さない。「まだ何も起きていない」のような案内は、図とボタンを見れば分かるので置かない。
    // 欄ごと消すと、再生を押した瞬間に下の一覧とボタンが押し下げられて次の操作がずれるので、場所は残して見えなくする。
    caption.classList.toggle("is-empty", step === null);
    captionTitle.textContent = step?.title ?? "";
    captionExplain.textContent = step?.explain ?? "";
    captionSimplified.hidden = !step?.simplified;
    captionSimplified.textContent = step?.simplified
      ? `${text.simplified}: ${step.simplified}`
      : "";
  }

  function renderStepDetail(step: Step | null): void {
    const sections = step?.detail ?? [];
    stepDetail.hidden = sections.length === 0;
    stepDetail.replaceChildren(
      el("h3", { text: text.stepDetailTitle }),
      ...createSections(sections),
    );
  }

  function renderControls(lesson: Lesson): void {
    const lastCursor = lesson.steps.length - 1;
    stepCounter.textContent = `${player.cursor + 1} / ${lesson.steps.length}`;
    speedButton.textContent = `${player.speed}×`;
    toggleButton.textContent = player.isPlaying ? text.pause : text.play;
    toggleButton.setAttribute("aria-pressed", String(player.isPlaying));
    // 何も起きていないときは「再生」を目立たせて、最初の一手を画面で教える。
    toggleButton.classList.toggle(
      "is-inviting",
      player.cursor === -1 && !player.isPlaying,
    );
    prevButton.disabled = player.cursor <= -1;
    nextButton.disabled = player.cursor >= lastCursor;
    resetButton.disabled = player.cursor <= -1;
  }

  function renderRows(): void {
    tableBody.querySelectorAll("tr").forEach((row, index) => {
      row.classList.toggle("is-future", index > player.cursor);
      if (index === player.cursor) row.setAttribute("aria-current", "step");
      else row.removeAttribute("aria-current");
    });
  }

  /** 登場物が多いとシーケンス図は横に流れる。いまのステップが画面の外に残らないように寄せる。 */
  function scrollSequenceToCurrentStep(): void {
    const current = sequenceHost.querySelector(".seq-step.is-current");
    const focusX = Number(current?.getAttribute("data-focus-x"));
    const isScrollable = sequenceHost.scrollWidth > sequenceHost.clientWidth;
    if (!current || !isScrollable || typeof sequenceHost.scrollTo !== "function")
      return;
    sequenceHost.scrollTo({
      left: focusX - sequenceHost.clientWidth / 2,
      behavior: "smooth",
    });
  }

  function render(): void {
    const lesson = lessonOf(player);
    const hasLessonChanged = renderedLessonId !== lesson.id;
    if (hasLessonChanged) buildLesson(lesson);
    const step = lesson.steps[player.cursor] ?? null;
    // 点を流すのは「ちょうど 1 つ進んだとき」だけ。戻る・飛ぶ・リセットでは動かさない。
    const hasAdvancedByOne = !hasLessonChanged && player.cursor === renderedCursor + 1;
    const travelMs =
      hasAdvancedByOne && !prefersReducedMotion()
        ? stepIntervalMs(player.speed) * TRAVEL_SHARE_OF_INTERVAL
        : 0;

    stage?.update({
      states: statesAt(lesson, player.cursor),
      step,
      kindColor: kindOf(step)?.color ?? "currentColor",
      travelMs,
    });
    sequenceHost.replaceChildren(
      createSequence(
        topic,
        lesson,
        player.cursor,
        (cursor) => dispatch({ type: "seek", cursor }),
        text.sequenceLabel,
      ),
    );
    scrollSequenceToCurrentStep();
    stageHost.hidden = viewMode !== "diagram";
    if (stage) stage.element.hidden = viewMode !== "diagram";
    sequenceHost.hidden = viewMode !== "sequence";
    for (const [mode, tab] of viewTabs) {
      tab.setAttribute("aria-selected", String(mode === viewMode));
    }
    renderCaption(step);
    renderStepDetail(step);
    renderControls(lesson);
    renderRows();

    renderedLessonId = lesson.id;
    renderedCursor = player.cursor;
  }

  function scheduleTick(): void {
    window.clearTimeout(tickTimer);
    if (!player.isPlaying) return;
    tickTimer = window.setTimeout(
      () => dispatch({ type: "tick" }),
      stepIntervalMs(player.speed),
    );
  }

  function dispatch(action: PlayerAction): void {
    const previousLessonId = player.lessonId;
    player = reducePlayer(outlines, player, action);
    if (player.lessonId !== previousLessonId) {
      history.replaceState(null, "", `#${player.lessonId}`);
    }
    render();
    scheduleTick();
  }

  const KEY_ACTIONS: Record<string, PlayerAction> = {
    " ": { type: "toggle" },
    ArrowRight: { type: "next" },
    ArrowLeft: { type: "prev" },
    r: { type: "reset" },
    R: { type: "reset" },
  };

  function onKeyDown(event: KeyboardEvent): void {
    const action = KEY_ACTIONS[event.key];
    const hasModifier = event.metaKey || event.ctrlKey || event.altKey;
    if (!action || hasModifier || isTypingTarget(event.target)) return;
    // ボタンにフォーカスがあるときのスペースは、そのボタンを押す操作として残す。
    if (event.key === " " && event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    dispatch(action);
  }

  function onHashChange(): void {
    dispatch({ type: "selectLesson", lessonId: location.hash.slice(1) });
  }

  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("hashchange", onHashChange);
  render();

  let autoplayTimer: number | undefined;
  if (options.shouldAutoplay && !prefersReducedMotion()) {
    autoplayTimer = window.setTimeout(() => {
      // 図が画面の下に隠れているとき（スマホ幅で上の概要を読んでいるとき）は始めない。
      // 見えない所で再生が進み、図まで降りたときには最後まで終わっている、を避けるため。
      const isStageInView =
        stageHost.getBoundingClientRect().top < window.innerHeight * 0.7;
      if (player.cursor === -1 && !player.isPlaying && isStageInView) {
        dispatch({ type: "play" });
      }
    }, AUTOPLAY_DELAY_MS);
  }

  return {
    destroy() {
      window.clearTimeout(tickTimer);
      window.clearTimeout(autoplayTimer);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("hashchange", onHashChange);
      stage?.destroy();
    },
  };
}

export interface LocalizedAppOptions {
  /** 選んだ言語を覚えておく先。既定は localStorage（使えない環境では覚えないだけで動く）。 */
  storage?: KeyValueStore;
  shouldAutoplay?: boolean;
}

/** Map と同じ形。テストではメモリの Map を渡す。 */
interface KeyValueStore {
  get(key: string): string | null | undefined;
  set(key: string, value: string): unknown;
}

const LANGUAGE_KEY = "explainer-language";

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

function browserStorage(): KeyValueStore {
  return {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        console.warn("選んだ言語を読めなかった", error);
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        console.warn("選んだ言語を覚えられなかった", error);
      }
    },
  };
}

/**
 * 言語ごとの題材を受け取り、切り替えのボタン付きで画面を出す。
 * 始める言語は URL の ?lang= → 前に選んだ言語 → 最初に渡した言語の順に決める。
 * 切り替えるときは画面を作り直す（文言が画面のあちこちに焼き込まれているため）。いまのレッスンとステップは引き継ぐ。
 */
export function mountLocalizedApp(
  root: HTMLElement,
  topics: Partial<Record<Language, Topic>>,
  options: LocalizedAppOptions = {},
): App {
  const languages = LANGUAGES.filter((language) => topics[language] !== undefined);
  if (languages.length === 0) throw new Error("題材が1つも渡されていない");
  const storage = options.storage ?? browserStorage();
  const requested = new URLSearchParams(location.search).get("lang");
  const stored = storage.get(LANGUAGE_KEY);
  let language: Language =
    [requested, stored].find(
      (candidate): candidate is Language =>
        isLanguage(candidate) && languages.includes(candidate),
    ) ?? languages[0];

  let app: App;
  function mount(
    position: { lessonId?: string; cursor?: number },
    shouldAutoplay: boolean,
  ) {
    document.documentElement.lang = language;
    app = mountApp(root, topics[language]!, {
      initialLessonId: position.lessonId,
      initialCursor: position.cursor,
      shouldAutoplay,
      language,
      languages,
      onSwitchLanguage(next, current) {
        app.destroy();
        language = next;
        storage.set(LANGUAGE_KEY, next);
        const url = new URL(location.href);
        url.searchParams.set("lang", next);
        history.replaceState(null, "", url);
        mount(current, false);
      },
    });
  }
  mount(
    { lessonId: location.hash.slice(1) || undefined },
    options.shouldAutoplay ?? false,
  );
  return {
    destroy() {
      app.destroy();
    },
  };
}
