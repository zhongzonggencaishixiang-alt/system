# リール動画の作り方（このフォルダ）

1. フォントを用意する（初回だけ）：`bash reels/tools/fetch_fonts.sh`
2. `reels/<名前>/photo/` に写真を入れ、`reels/<名前>/spec.json` に各枚の文字・見せ方（pop／neg／pos／list／end）・写真・秒数を書く
   - `★〜★` で囲んだ言葉が強調（明朝・一回り大きく。pos と end は金色）
3. `python3 reels/tools/make_reel.py reels/<名前>` → `reels/<名前>/<名前>.mp4`（1080×1920・音なし）と `<名前>_cover.png` ができる

見た目の決まりは資料タブ⑦（sales_flow 11/2・11/5・11/6）に合わせている。音楽と効果音はInstagramで付ける。
