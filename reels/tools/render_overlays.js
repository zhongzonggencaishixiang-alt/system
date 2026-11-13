// spec.json から、文字の透明PNG（各枚）とカバー画像を書き出す
//   node render_overlays.js <reelフォルダ>
// 見た目の決まり（資料タブ⑦ sales_flow 11/2・11/5・11/6）
//   本文＝Kazesawa（太め）・強調（★〜★）＝Noto Serif JP 900 で一回り大きく・白文字＋やわらかい影・うっすら座布団
//   pos の強調＝暖かい金色 / list＝白い箱に縦並び（1つずつ出す） / カバー＝丸ゴシック・アイボリーの箱・茶と金茶
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2]);
const spec = JSON.parse(fs.readFileSync(path.join(dir, 'spec.json'), 'utf8'));
const out = path.join(dir, 'build');
fs.mkdirSync(out, { recursive: true });
const F = 'file://' + path.join(__dirname, 'fonts');

const fontCss = `
@import url('${F}/noto-serif-jp/900.css');
@import url('${F}/zen-maru-gothic/700.css');
@font-face{font-family:Kaze;src:url('${F}/Kazesawa-Extrabold.ttf');}
`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const markup = (line) => esc(line).replace(/★([^★]*)★/g, '<span class="em">$1</span>');

const base = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;background:transparent}
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 70px}
.pad{background:rgba(20,14,12,.22);border-radius:36px;padding:34px 46px;display:flex;flex-direction:column;align-items:center;gap:14px;
     box-shadow:0 0 60px 30px rgba(20,14,12,.14)}
.line{font-family:Kaze;font-size:64px;line-height:1.35;color:#fff;text-align:center;
      text-shadow:0 3px 10px rgba(0,0,0,.35),0 0 3px rgba(0,0,0,.35);letter-spacing:.02em;white-space:nowrap}
.em{font-family:'Noto Serif JP';font-weight:900;font-size:84px}
.pos .em{color:#F1D08A}
.big .line{font-size:76px}.big .em{font-size:100px}
.foot{position:absolute;bottom:330px;left:0;right:0;text-align:center}
.foot span{font-family:Kaze;font-size:28px;color:#fff;background:rgba(20,14,12,.28);padding:8px 22px;border-radius:20px;
      text-shadow:0 2px 6px rgba(0,0,0,.4)}
.box{background:rgba(255,255,255,.93);border-radius:30px;padding:46px 54px;display:flex;flex-direction:column;gap:30px;min-width:860px;
     box-shadow:0 10px 40px rgba(0,0,0,.25)}
.box .t{font-family:'Noto Serif JP';font-weight:900;font-size:62px;color:#5C4C4A;text-align:center;margin-bottom:6px}
.box .i{font-family:Kaze;font-size:52px;color:#4A3C3A;white-space:nowrap}
.box .i.hide{visibility:hidden}
.end .line{font-size:56px}.end .em{font-size:90px;color:#F1D08A}
`;

function slideHtml(s, stage) {
  const foot = `<div class="foot"><span>${esc(spec.footer)}</span></div>`;
  if (s.kind === 'list') {
    const items = s.items.map((t, i) => `<div class="i ${i < stage ? '' : 'hide'}">${esc(t)}</div>`).join('');
    return `<div class="wrap"><div class="box"><div class="t">${esc(s.title)}</div>${items}</div></div>${foot}`;
  }
  const lines = s.lines.map((l) => `<div class="line">${markup(l)}</div>`).join('');
  const cls = [s.kind, s.kind === 'pop' ? 'big' : ''].join(' ');
  return `<div class="wrap ${cls}"><div class="pad">${lines}</div></div>${foot}`;
}

function coverHtml(c) {
  const img = 'file://' + path.join(dir, c.photo);
  return `<style>
  .bg{position:absolute;inset:0;background:url('${img}') center/cover}
  .veil{position:absolute;inset:0;background:rgba(251,246,238,.30)}
  .cw{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);display:flex;justify-content:center}
  .cb{background:rgba(252,248,240,.92);border-radius:40px;padding:50px 56px;text-align:center;max-width:960px;box-shadow:0 10px 40px rgba(60,40,30,.18)}
  .s{font-family:'Zen Maru Gothic';font-weight:700;font-size:50px;color:#5C4C4A}
  .b{font-family:'Zen Maru Gothic';font-weight:700;font-size:94px;line-height:1.25;color:#A9844B;margin:18px 0;white-space:pre-line}
  .u{font-family:'Zen Maru Gothic';font-weight:700;font-size:46px;color:#5C4C4A;border-top:3px solid #D9C8A8;padding-top:18px;display:inline-block}
  .cf{position:absolute;bottom:330px;left:0;right:0;text-align:center;font-family:'Zen Maru Gothic';font-weight:700;font-size:30px;color:#5C4C4A}
  .cf span{background:rgba(252,248,240,.9);padding:8px 24px;border-radius:20px}
  </style><div class="bg"></div><div class="veil"></div>
  <div class="cw"><div class="cb"><div class="s">${esc(c.small)}</div><div class="b">${esc(c.big)}</div><div class="u">${esc(c.sub)}</div></div></div>
  <div class="cf"><span>${esc(spec.footer)}</span></div>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const shot = async (body, file, transparent) => {
    // file:// の写真・フォントを読めるよう、HTMLをファイルに書いてから開く
    const html = path.join(out, '_page.html');
    fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}${base}</style></head><body>${body}</body></html>`);
    await page.goto('file://' + html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, file), omitBackground: transparent });
    console.log(file);
  };
  await shot(coverHtml(spec.cover), 'cover.png', false);
  for (let n = 0; n < spec.slides.length; n++) {
    const s = spec.slides[n];
    const id = String(n + 1).padStart(2, '0');
    if (s.kind === 'list') {
      for (let k = 0; k <= s.items.length; k++) await shot(slideHtml(s, k), `ov_${id}_${k}.png`, true);
    } else {
      await shot(slideHtml(s, 0), `ov_${id}.png`, true);
    }
  }
  await browser.close();
})();
