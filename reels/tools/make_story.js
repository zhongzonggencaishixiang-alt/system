// ストーリーズ用の静止画（1080x1920）を書き出す
//   node make_story.js <フォルダ>   … <フォルダ>/story.json を読んで <フォルダ>/story_01.png … を作る
// 見た目はダイエットのプロフィール一覧に合わせる（淡いピンクベージュのベール・角丸の淡い箱・茶色とくすみピンク）
// 上 250px・下 300px はInstagramの表示やスタンプで隠れるので空ける
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2]);
const spec = JSON.parse(fs.readFileSync(path.join(dir, 'story.json'), 'utf8'));
const F = 'file://' + path.join(__dirname, 'fonts');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const br = (s) => esc(s).replace(/\n/g, '<br>');

const css = `
@import url('${F}/zen-maru-gothic/700.css');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px}
.bg{position:absolute;inset:0;background-size:cover;background-position:center}
.veil{position:absolute;inset:0;background:rgba(246,232,228,.55)}
.wrap{position:absolute;left:70px;right:70px;top:260px;bottom:320px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;
      font-family:'Zen Maru Gothic';font-weight:700;color:#5C4C4A;text-align:center}
.tag{font-size:40px;background:rgba(250,242,238,.92);border-radius:14px;padding:10px 30px}
.title{font-size:78px;color:#BE8280;background:rgba(250,240,237,.92);border-radius:14px;padding:14px 40px;line-height:1.25}
.card{background:rgba(255,255,255,.92);border-radius:28px;padding:46px 50px;width:100%;box-shadow:0 10px 36px rgba(92,76,74,.15);display:flex;flex-direction:column;gap:22px}
.q{font-size:50px;line-height:1.6;color:#5C4C4A}
.q .mark{color:#BE8280}
.hl{font-size:56px;color:#BE8280;line-height:1.4}
.sub{font-size:36px;line-height:1.6}
.note{font-size:26px;color:#7A6A68;line-height:1.5}
.img{width:100%;border-radius:20px;box-shadow:0 10px 30px rgba(92,76,74,.18);display:block}
.cta{font-size:46px;color:#fff;background:#B87876;border-radius:28px;padding:30px 40px;line-height:1.5;width:100%}
.lines{font-size:42px;line-height:1.6;text-align:left;display:flex;flex-direction:column;gap:18px}
.lines b{color:#BE8280}
.space{height:200px;width:100%;border:3px dashed rgba(190,130,128,.6);border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:30px;color:#BE8280;background:rgba(255,255,255,.5)}
.foot{position:absolute;bottom:330px;left:0;right:0;text-align:center;font-family:'Zen Maru Gothic';font-weight:700;font-size:28px;color:#5C4C4A}
.foot span{background:rgba(250,242,238,.9);padding:6px 22px;border-radius:12px}
`;

function block(b) {
  switch (b.t) {
    case 'tag': return `<div class="tag">${br(b.text)}</div>`;
    case 'title': return `<div class="title">${br(b.text)}</div>`;
    case 'card': return `<div class="card">${b.items.map(block).join('')}</div>`;
    case 'q': return `<div class="q"><span class="mark">「</span>${br(b.text)}<span class="mark">」</span></div>`;
    case 'hl': return `<div class="hl">${br(b.text)}</div>`;
    case 'sub': return `<div class="sub">${br(b.text)}</div>`;
    case 'note': return `<div class="note">${br(b.text)}</div>`;
    case 'img': return `<img class="img" src="file://${path.join(dir, b.src)}">`;
    case 'cta': return `<div class="cta">${br(b.text)}</div>`;
    case 'lines': return `<div class="lines">${b.items.map((x) => '<div>' + br(x).replace(/\*([^*]+)\*/g, '<b>$1</b>') + '</div>').join('')}</div>`;
    case 'space': return `<div class="space">${br(b.text)}</div>`;
  }
  return '';
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (let i = 0; i < spec.frames.length; i++) {
    const f = spec.frames[i];
    const blur = f.blur ? `filter:blur(${f.blur}px);transform:scale(1.05);` : '';
    const bgDiv = f.photo
      ? `<div class="bg" style="background-image:url('file://${path.join(dir, f.photo)}');${blur}"></div><div class="veil"></div>`
      : `<div class="bg" style="background:#F6EEEA"></div>`;
    const body = `${bgDiv}
      <div class="wrap">${f.blocks.map(block).join('')}</div>
      ${spec.footer ? `<div class="foot"><span>${esc(spec.footer)}</span></div>` : ''}`;
    const html = path.join(dir, '_story.html');
    fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`);
    await page.goto('file://' + html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const out = path.join(dir, `story_${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: out });
    console.log(out);
  }
  fs.unlinkSync(path.join(dir, '_story.html'));
  await browser.close();
})();
