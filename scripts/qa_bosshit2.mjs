import { chromium } from 'playwright';
import path from 'path';
const ROOT = '/home/z/my-project/nusantara-platformer/app/src/main/assets/www';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForTimeout(2200);
await page.evaluate(() => UI.startLevel(25));
await page.waitForTimeout(2400);
await page.evaluate(() => {
  const g = Game, p = g.player, b = g.boss;
  g.shots = [];
  b.state = 'idle'; b.t = -99;
  p.x = b.x - 20; p.y = g.level.floorY - p.h;   // berdiri tepat di lantai
  p.stam = 100; p.dashCd = 0; p.iframes = 0; p.vy = 0;
  p.dashT = CFG.DASH_TIME; p.dashDir = 1; p.vx = CFG.DASH_SPEED;
});
await page.waitForTimeout(250);
const after = await page.evaluate(() => ({
  hp: Game.boss.hp, max: Game.boss.maxHp, state: Game.state, hpP: Game.player.hp,
}));
console.log('dash ke boss (berdiri di lantai):', JSON.stringify(after), '-> hp harus 9');

// tes kala rain orb + warnings
await page.evaluate(() => UI.startLevel(50));
await page.waitForTimeout(2400);
await page.evaluate(() => { const b = Game.boss; b.state = 'telegraph'; b.t = 0; b.attack = 'rain'; });
await page.waitForTimeout(1400);
const rain = await page.evaluate(() => ({ warnings: Game.warnings.length, orbs: Game.shots.filter(s => s.kind === 'orb').length, state: Game.boss.state }));
console.log('kala hujan orb: warning =', rain.warnings, '| orb jatuh =', rain.orbs, '| state =', rain.state);

// naga slither
await page.evaluate(() => UI.startLevel(75));
await page.waitForTimeout(2400);
await page.evaluate(() => { const b = Game.boss; b.state = 'telegraph'; b.t = 0; b.attack = 'slither'; });
await page.waitForTimeout(800);
const naga = await page.evaluate(() => ({ type: Game.boss.type, state: Game.boss.state, y: Math.round(Game.boss.y), floor: Game.level.floorY }));
console.log('naga slither:', JSON.stringify(naga), '(y harus berosilasi di atas floor)');

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
