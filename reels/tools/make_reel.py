#!/usr/bin/env python3
"""spec.json から縦長リール（1080x1920・30fps・音なし）を作る。

  python3 reels/tools/make_reel.py reels/<フォルダ>

手順：1) render_overlays.js で文字PNGとカバーを書き出す  2) 1枚ずつ動画にする  3) 0.3秒のふわっと切りかえでつなぐ
見せ方（資料タブ⑦ sales_flow 11/5）：
  pop  = 文字がポンと出る（1枚目）／neg = 写真をさらに暗く・文字が少し揺れる
  pos  = 写真がゆっくり大きくなる・文字がふわっと出る（強調は金色）／list = 白い箱に1つずつ出る
写真の暗さ：ふつう26%・neg 42%・pos 30%（1枚目とカバーは明るいまま）
"""
import json
import subprocess
import sys
from pathlib import Path

W, H, FPS, XF = 1080, 1920, 30, 0.3
DARK = {"pop": 0.0, "neg": 0.42, "pos": 0.30, "list": 0.26, "end": 0.30}
ZOOM = {"pop": 0.03, "neg": 0.02, "pos": 0.08, "list": 0.03, "end": 0.05}


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def bg_filter(kind, dur, blur):
    k = 1 - DARK[kind]
    z = ZOOM[kind]
    f = [f"scale={W}:{H}:force_original_aspect_ratio=increase", f"crop={W}:{H}"]
    if blur:
        f.append(f"gblur=sigma={blur}")
    if k < 1:
        f.append(f"colorchannelmixer=rr={k}:gg={k}:bb={k}")
    # ゆっくりズーム（中央基準）
    f.append(f"scale=w='trunc({W}*(1+{z}*t/{dur})/2)*2':h=-2:eval=frame")
    f.append(f"crop={W}:{H}")
    f.append("setsar=1,format=yuv420p")
    return ",".join(f)


def clip(src_dir, build, n, s):
    dur = s["seconds"]
    out = build / f"clip_{n:02d}.mp4"
    photo = src_dir / s["photo"]
    kind = s["kind"]
    inputs = ["-loop", "1", "-t", str(dur), "-i", str(photo)]
    fc = [f"[0:v]fps={FPS},{bg_filter(kind, dur, s.get('blur'))}[bg]"]
    if kind == "list":
        stages = sorted(build.glob(f"ov_{n:02d}_*.png"))
        step = (dur - 0.6) / (len(stages) - 1)
        last = "bg"
        for i, p in enumerate(stages):
            inputs += ["-loop", "1", "-t", str(dur), "-i", str(p)]
            start = 0 if i == 0 else 0.3 + step * (i - 1) + 0.3
            end = dur if i == len(stages) - 1 else 0.3 + step * i + 0.3
            fc.append(f"[{last}][{i+1}:v]overlay=0:0:enable='between(t,{start:.2f},{end:.2f})'[s{i}]")
            last = f"s{i}"
        fc.append(f"[{last}]format=yuv420p[v]")
    else:
        inputs += ["-loop", "1", "-t", str(dur), "-i", str(build / f"ov_{n:02d}.png")]
        if kind == "pop":
            fc.append("[1:v]format=rgba,scale=w='trunc(iw*if(lt(t,0.18),1.18-t,1)/2)*2':h=-2:eval=frame[ov]")
            fc.append("[bg][ov]overlay=x='(W-w)/2':y='(H-h)/2':eval=frame,format=yuv420p[v]")
        elif kind == "neg":
            fc.append("[bg][1:v]overlay=x='5*sin(2*PI*5*t)':y='2*sin(2*PI*7*t)':eval=frame,format=yuv420p[v]")
        else:  # pos / end
            fc.append("[1:v]format=rgba,fade=t=in:st=0:d=0.45:alpha=1[ov]")
            fc.append("[bg][ov]overlay=0:0,format=yuv420p[v]")
    run(["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", "[v]",
         "-t", str(dur), "-r", str(FPS), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", str(out)])
    return out, dur


def main():
    src = Path(sys.argv[1]).resolve()
    tools = Path(__file__).resolve().parent
    spec = json.loads((src / "spec.json").read_text(encoding="utf-8"))
    build = src / "build"
    build.mkdir(exist_ok=True)
    subprocess.run(["node", str(tools / "render_overlays.js"), str(src)], check=True)

    # カバー（最初の0.6秒）
    cdur = spec["cover"]["seconds"] + XF
    cover_clip = build / "clip_00.mp4"
    run(["ffmpeg", "-y", "-loop", "1", "-t", str(cdur), "-i", str(build / "cover.png"),
         "-vf", f"fps={FPS},scale={W}:{H},setsar=1,format=yuv420p", "-t", str(cdur),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", str(cover_clip)])
    clips = [(cover_clip, cdur)] + [clip(src, build, i + 1, s) for i, s in enumerate(spec["slides"])]

    # ふわっと切りかえ（xfade）でつなぐ
    inputs, fc, t, last = [], [], 0.0, "0:v"
    for i, (p, d) in enumerate(clips):
        inputs += ["-i", str(p)]
    t = clips[0][1]
    for i in range(1, len(clips)):
        t -= XF
        lab = f"x{i}"
        fc.append(f"[{last}][{i}:v]xfade=transition=fade:duration={XF}:offset={t:.3f}[{lab}]")
        last = lab
        t += clips[i][1]
    name = src.name
    out = src / f"{name}.mp4"
    run(["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", f"[{last}]",
         "-r", str(FPS), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", str(out)])
    run(["cp", str(build / "cover.png"), str(src / f"{name}_cover.png")])
    print(f"done: {out} ({t:.1f}s)")


if __name__ == "__main__":
    main()
