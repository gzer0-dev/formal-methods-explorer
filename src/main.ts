// 配線だけを行う入口。題材（topic）と画面（ui）を知っているのはこのファイルだけ。

import "./ui/base.css";
import "./topic/theme.css";

import { topics } from "./topic";
import { mountLocalizedApp } from "./ui/app";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("index.html に #app が無い");

mountLocalizedApp(root, topics, { shouldAutoplay: true });
