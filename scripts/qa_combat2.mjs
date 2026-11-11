// QA combat v2
import { chromium } from 'playwright';
import path from 'path';

const ROOT = '/home/z/my-project/nusantara-platformer/app/src/main/assets/www';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForTimeout(2200);
await page.evaluate(() => UI.startLevel(3));
await page.waitForTimeout(400);

// 1. STOMP benar: musuh di bawah kaki player
await page.evaluate(() => {
  const g = Game, p = g.player;
  const e = new Enemy('tuyul', p.x + 4, p.y + p.h + 2, 0, g.level.worldW, 1);
  e.x = p.x + 4; e.y = p.y + p.h; // kepala musuh = kaki player
  g.enemies.push(e);
  p.vy = 220;
});
await page.waitForTimeout(250);
const stomp = await page.evaluate(() => ({
  state: Game.state, hp: Game.player.hp,
  vy: Math.round(Game.player.vy),
  dead: Game.enemies.filter(e => e.dead).length,
}));
console.log('stomp: hp =', stomp.hp, '(tetap 3)', '| memantul vy =', stomp.vy, '< 0 =', stomp.vy < 0, '| state =', stomp.state);

// 2. BOSS fan-shot satu evaluate bersih
await page.evaluate(() => UI.startLevel(25));
await page.waitForTimeout(2400);
await page.evaluate(() => {
  const b = Game.boss;
  b.state = 'telegraph'; b.t = 0; b.attack = 'fan';
});
await page.waitForTimeout(900);
const shots = await page.evaluate(() => ({ n: Game.shots.length, type: Game.shots[0] ? Game.shots[0].kind : '-', state: Game.boss.state }));
console.log('rangda fan-shot: proyektil =', shots.n, shots.type, '| state boss =', shots.state);

// 3. Dash ke boss
await page.evaluate(() => {
  const g = Game, p = g.player, b = g.boss;
  p.x = b.x - 60; p.y = b.y + b.h - p.h;
  p.stam = 100; p.dashCd = 0; p.iframes = 0;
  p.dashT = CFG.DASH_TIME; p.dashDir = 1; p.vx = CFG.DASH_SPEED;
});
await page.waitForTimeout(200);
const bossHit = await page.evaluate(() => ({
  hp: Game.boss.hp, max: Game.boss.maxHp,
  px: Math.round(Game.player.x), bx: Math.round(Game.boss.x),
  pDash: Game.player.dashT, state: Game.boss.state,
}));
console.log('dash ke boss: hp', bossHit.hp, '/', bossHit.max, '| posisi px=', bossHit.px, 'bx=', bossHit.bx);

// 4. Shockwave kala
await page.evaluate(() => UI.startLevel(50));
await page.waitForTimeout(2400);
await page.evaluate(() => {
  const b = Game.boss;
  console.log('boss L50:', b.type);
  b.state = 'attack'; b.t = 0; b.attack = 'slam'; b.vy = -480;
  b.y = Game.level.worldH - 2 * CFG.TILE - b.h - 10; // hampir mendarat
});
await page.waitForTimeout(600);
const shock = await page.evaluate(() => ({
  n: Game.shots.filter(s => s.kind === 'shock').length,
  shake: Game.shakeT > 0,
  type: Game.boss.type,
}));
console.log('kala slam: shockwave =', shock.n, '| layar berguncang =', shock.shake, '| boss =', shock.type);

// 5. Tuyul mencuri koin
await page.evaluate(() => { Game.coinsRun = 10; });
await page.evaluate(() => {
  const g = Game, p = g.player;
  const e = new Enemy('tuyul', p.x + 20, p.y, 0, g.level.worldW, 1);
  e.x = p.x + 20; e.y = p.y;
  g.enemies.push(e);
});
await page.waitForTimeout(300);
const steal = await page.evaluate(() => ({ run: Game.coinsRun, hp: Game.player.hp }));
console.log('tuyul menyentuh: koin run =', steal.run, '(10-3=7)', '| hp =', steal.hp - 1 >= 0 ? steal.hp : 0, '(kena 1)');

console.log('');
console.log('console errors:', errors.length ? errors : 'TIDAK ADA');
await browser.close();
if (errors.length) process.exit(2);
