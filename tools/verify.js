/* playwright検証（HANDOFF §10プロトコル）: 全ビュー×2幅で
   H-OVERFLOW / NaN / undefined / consoleエラー / モーダル / ソート / 粒度トグルを確認。
   ERRORS: none になるまで公開禁止。 */
const fs = require('fs');
const { chromium } = require('playwright');
const PW_EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium';
const LAUNCH = fs.existsSync(PW_EXE) ? { executablePath: PW_EXE } : {};
const FILE = 'file://' + process.cwd() + '/plain.html';
const views = ['v1','v2','v3','v4','v5','v6','v7','v8','v9','vx1','vx2','vx3'];
(async () => {
  const b = await chromium.launch(LAUNCH);
  const errs = [];
  for (const [W, H] of [[1440, 900], [390, 844]]) {
    const p = await b.newPage({ viewport: { width: W, height: H } });
    p.on('pageerror', e => errs.push(`[${W}] pageerror: ${e.message}`));
    p.on('console', m => {
      const t = m.text();
      if (m.type() === 'error' && !/net::ERR_|Failed to load resource/.test(t)) errs.push(`[${W}] console: ${t}`);
    });
    await p.goto(FILE + '#v1', { waitUntil: 'load' });
    await p.waitForTimeout(2000);
    for (const v of views) {
      await p.evaluate(vv => go(vv), v);
      await p.waitForTimeout(1300);
      const info = await p.evaluate(() => {
        const m = document.querySelector('#main');
        const txt = m ? m.innerText : '';
        return { len: m ? m.innerHTML.length : 0,
                 ow: document.documentElement.scrollWidth > window.innerWidth + 2,
                 sw: document.documentElement.scrollWidth, iw: window.innerWidth,
                 nan: /NaN|undefined/.test(txt) };
      });
      if (info.len < 900) errs.push(`[${W}] ${v}: main too small (${info.len})`);
      if (info.ow) errs.push(`[${W}] ${v}: H-OVERFLOW ${info.sw}>${info.iw}`);
      if (info.nan) errs.push(`[${W}] ${v}: NaN/undefined in text`);
      console.log(`[${W}] ${v} len=${String(info.len).padStart(6)} ow=${info.ow}`);
    }
    if (W === 1440) {
      await p.evaluate(() => go('v1'));
      await p.waitForTimeout(500);
      await p.evaluate(() => help('idx'));
      await p.waitForTimeout(250);
      if (!await p.evaluate(() => document.querySelector('#mback').classList.contains('on')))
        errs.push('help modal did not open');
      await p.evaluate(() => closeModal());
      await p.evaluate(() => go('v6'));
      await p.waitForTimeout(1000);
      await p.evaluate(() => setGran('d'));
      await p.waitForTimeout(1200);
      const g = await p.evaluate(() => ({ ow: document.documentElement.scrollWidth > window.innerWidth + 2 }));
      if (g.ow) errs.push('v6 daily H-OVERFLOW');
      await p.evaluate(() => setGran('w'));
      await p.evaluate(() => go('v2'));
      await p.waitForTimeout(900);
      await p.evaluate(() => sortDom(1));
      const rows = await p.evaluate(() => document.querySelectorAll('#domtb tr').length);
      if (rows < 5) errs.push(`sortDom rows=${rows}`);
      await p.screenshot({ path: 's_board.png', fullPage: false });
    }
    await p.close();
  }
  await b.close();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'ERRORS: none');
  process.exit(errs.length ? 1 : 0);
})();
