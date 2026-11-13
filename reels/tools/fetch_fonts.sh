#!/usr/bin/env bash
# リール用フォントを reels/tools/fonts/ に取ってくる（どれも OFL ライセンスのフリーフォント）
#   本文：Kazesawa Extrabold / 強調：Noto Serif JP 900（源ノ明朝 Heavy と同じ字形） / カバー：Zen Maru Gothic 700
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fonts && cd fonts
if [ ! -f Kazesawa-Extrabold.ttf ]; then
  curl -sSL -o kazesawa.zip https://github.com/kazesawa/kazesawa/releases/download/alpha-v1/kazesawa.zip
  unzip -oqj kazesawa.zip '*Kazesawa-Extrabold.ttf' '*Kazesawa-Bold.ttf' -d .
  rm -f kazesawa.zip
fi
for pkg in noto-serif-jp zen-maru-gothic; do
  if [ ! -d "$pkg" ]; then
    tgz=$(npm pack "@fontsource/$pkg" 2>/dev/null | tail -1)
    mkdir -p "$pkg" && tar xzf "$tgz" -C "$pkg" --strip-components=1 && rm -f "$tgz"
  fi
done
echo "fonts ready: $(pwd)"
