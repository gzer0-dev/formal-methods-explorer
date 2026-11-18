#!/bin/sh
# TLC を1つの設定で走らせる。使い方: ./run-tlc.sh <Module> <config.cfg> [TLC の追加オプション...]
# JAVA と TLA2TOOLS は環境変数で上書きできる（既定は Homebrew の openjdk@21 と ~/.local/share/tlaplus）。
set -eu
JAVA="${JAVA:-/opt/homebrew/opt/openjdk@21/bin/java}"
TLA2TOOLS="${TLA2TOOLS:-$HOME/.local/share/tlaplus/tla2tools.jar}"
module="$1"; config="$2"; shift 2
meta="$(mktemp -d)"
trap 'rm -rf "$meta"' EXIT
cd "$(dirname "$0")"
"$JAVA" -XX:+UseParallelGC -cp "$TLA2TOOLS" tlc2.TLC -workers 1 -metadir "$meta" -config "$config" "$@" "$module.tla"
