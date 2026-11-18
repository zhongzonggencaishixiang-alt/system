"""手書きの感想から大事な1行だけを切り出し、大きく見せる背景画像を作る（11/18）
  python3 hw_card.py  … photo/card_*.jpg を作る（上部に紙のカード、下はぼかした写真）"""
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance
from pathlib import Path
here = Path(__file__).resolve().parent.parent
hw = here.parent / 'story_monitor'
bg_src = here.parent / 'library' / '自_サロン_ハーブティー.jpg'
# (出力名, 元画像, [行の切り出し (x0,y0,x1,y1) …])  ※元画像の座標
CARDS = [
    ('card_gaman', 'hw01.png', [(80, 505, 1100, 645), (1112, 505, 1710, 645)]),
    ('card_akirame', 'hw05.png', [(95, 1092, 1040, 1215), (1048, 1092, 1820, 1215)]),
    ('card_stress', 'hw03.png', [(125, 335, 735, 440), (725, 295, 1215, 428)]),
    ('card_bunki', 'hw05.png', [(885, 1510, 1408, 1632), (1402, 1510, 1775, 1632)]),
]
W, H, CW = 1080, 1920, 960

def bg():
    im = Image.open(bg_src).convert('RGB')
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)))
    im = im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H))
    im = im.filter(ImageFilter.GaussianBlur(18))
    return ImageEnhance.Brightness(im).enhance(1.08)

for name, src, boxes in CARDS:
    im = Image.open(hw / src).convert('RGB')
    rows = []
    for b in boxes:
        r = im.crop(b)
        k = min((CW - 80) / r.width, 190 / r.height)
        r = r.resize((round(r.width * k), round(r.height * k)), Image.LANCZOS)
        rows.append(r)
    ch = sum(r.height for r in rows) + 60 + 20 * (len(rows) - 1)
    out = bg()
    card = Image.new('RGB', (CW, ch), (252, 250, 246))
    y = 30
    for r in rows:
        card.paste(r, ((CW - r.width) // 2, y)); y += r.height + 20
    mask = Image.new('L', card.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, CW - 1, ch - 1), 28, fill=255)
    sh = Image.new('L', (W, H), 0)
    top = max(270, 700 - ch)
    ImageDraw.Draw(sh).rounded_rectangle(((W - CW) // 2, top + 10, (W + CW) // 2, top + ch + 10), 28, fill=90)
    out.paste((60, 40, 30), (0, 0), sh.filter(ImageFilter.GaussianBlur(20)))
    out.paste(card, ((W - CW) // 2, top), mask)
    out.save(here / 'photo' / f'{name}.jpg', quality=92)
    print(name, ch, top)
