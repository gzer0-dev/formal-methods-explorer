// 配線だけを行う入口。題材（topic）と画面（ui）を知っているのはこのファイルだけ。

import "./ui/base.css";
import "./topic/theme.css";

import { topic } from "./topic";
import { mountApp } from "./ui/app";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("index.html に #app が無い");

mountApp(root, topic, {
  initialLessonId: location.hash.slice(1) || undefined,
  shouldAutoplay: true,
});
