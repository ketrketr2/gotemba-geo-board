/* 暗号化ゲートの復号ラウンドトリップ検証。
   鍵は環境変数 GOTEMBA_GATE_KEY（"id:pw"）から取り、リポジトリには書かない。 */
const fs = require('fs');
const { chromium } = require('playwright');
const PW_EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium';
const LAUNCH = fs.existsSync(PW_EXE) ? { executablePath: PW_EXE } : {};
const KM = process.env.GOTEMBA_GATE_KEY || '';
if (!KM.includes(':')) { console.error('GOTEMBA_GATE_KEY 未設定（"id:pw"）'); process.exit(1); }
const [GID, GPW] = [KM.slice(0, KM.indexOf(':')), KM.slice(KM.indexOf(':') + 1)];
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  const GATE_FILE = process.env.GATE_FILE || 'index_new.html';
  await p.goto('file://' + process.cwd() + '/' + GATE_FILE, { waitUntil: 'load' });
  await p.waitForTimeout(300);
  // 誤PW → エラー表示
  await p.fill('#u', GID); await p.fill('#p', 'wrong-password');
  await p.click('#b'); await p.waitForTimeout(1800);
  const bad = await p.evaluate(() => (document.querySelector('#e') || {}).textContent || '');
  console.log('誤PW時:', bad || '(空)');
  if (!bad.includes('正しくありません')) errs.push('wrong-pw did not show error');
  // 正PW → 復号してボードが出る
  await p.fill('#p', GPW);
  await p.click('#b'); await p.waitForTimeout(3600);
  const ok = await p.evaluate(() => ({
    main: (document.querySelector('#main') || document.body).innerHTML.length,
    title: document.title,
    marker: document.documentElement.outerHTML.indexOf('GOTEMBA_BOARD') >= 0,
  }));
  console.log('復号後:', JSON.stringify(ok));
  if (ok.main < 5000) errs.push('decrypt failed / main empty');
  await p.screenshot({ path: 's_gate_after.png' });
  await b.close();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'ERRORS: none');
  process.exit(errs.length ? 1 : 0);
})();
