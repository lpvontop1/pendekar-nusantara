// QA browser: menu -> level -> gerak player -> pause/shop -> boss, cek error console
import { chromium } from 'playwright';
import path from 'path';

const ROOT = '/home/z/my-project/nusantara-platformer/app/src/main/assets/www';
const SHOT = '/home/z/my-project/work/shots';
import fs from 'fs';
fs.mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch({ args: ['--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

const url = 'file://' + path.join(ROOT, 'index.html');
await page.goto(url);
await page.waitForTimeout(2500);

// 1. menu tampil?
const menuVisible = await page.isVisible('#screen-menu');
console.log('menu visible:', menuVisible);
await page.screenshot({ path: SHOT + '/01-menu.png' });

// 2. pilih petak (level select) + kunci
await page.click('#btn-levels');
await page.waitForTimeout(400);
const lockedCount = await page.locator('.lv-cell.locked').count();
console.log('locked cells (halaman 1):', lockedCount, '(harus 19, karena unlocked=1)');
await page.screenshot({ path: SHOT + '/02-levels.png' });

// 3. mulai level 1 via tombol MULAI
await page.click('#btn-levels-back');
await page.waitForTimeout(200);
await page.click('#btn-continue');
await page.waitForTimeout(700);
let px0 = await page.evaluate(() => Game.player ? Game.player.x : -1);
console.log('player.x awal:', px0);

// 4. gerak kanan + lompat (keyboard)
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(700);
await page.keyboard.press('Space');
await page.waitForTimeout(500);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(200);
let px1 = await page.evaluate(() => Game.player.x);
const st = await page.evaluate(() => Game.state);
console.log('player.x setelah lari+loncat:', px1, '| state:', st);
await page.screenshot({ path: SHOT + '/03-gameplay.png' });
if (st === 'dead') {
  console.log('bot gugur (jurang/musuh) - menunggu respawn otomatis...');
  await page.waitForTimeout(1800);
  console.log('state setelah respawn:', await page.evaluate(() => Game.state));
}

// 5. sentuh tombol kontrol virtual (pointer events)
await page.evaluate(() => {
  const bl = document.getElementById('btn-left');
  const rect = bl.getBoundingClientRect();
  const ev = (type, x, y) => bl.dispatchEvent(new PointerEvent(type, { pointerId: 7, bubbles: true, clientX: x, clientY: y }));
  ev('pointerdown', rect.x + 10, rect.y + 10);
});
await page.waitForTimeout(400);
const pressedVisual = await page.evaluate(() => document.getElementById('btn-left').classList.contains('pressed'));
await page.evaluate(() => {
  const bl = document.getElementById('btn-left');
  const rect = bl.getBoundingClientRect();
  bl.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true, clientX: rect.x + 10, clientY: rect.y + 10 }));
});
console.log('tombol sentuh bekerja (visual pressed):', pressedVisual);

// 6. pause -> toko -> beli
await page.evaluate(() => { if (Game.state === 'dead') { Game.respawn(); } });
await page.waitForTimeout(400);
await page.click('#btn-pause');
await page.waitForTimeout(300);
await page.screenshot({ path: SHOT + '/04-pause.png' });
await page.click('#btn-pause-shop');
await page.waitForTimeout(300);
await page.evaluate(() => { Save.get().coins = 500; Save.commit(); UI.renderShop(); });
await page.click('.shop-item:nth-child(2) .si-buy'); // kopi
await page.waitForTimeout(200);
const coinsAfterBuy = await page.evaluate(() => Save.get().coins);
console.log('koin setelah beli kopi (500-8=492):', coinsAfterBuy);
await page.screenshot({ path: SHOT + '/05-shop.png' });
await page.click('#btn-shop-close');
await page.waitForTimeout(200);
await page.click('#btn-resume');
await page.waitForTimeout(200);

// 7. tes boss level 25 langsung
await page.evaluate(() => { UI.startLevel(25); });
await page.waitForTimeout(800);
const bossState = await page.evaluate(() => ({ isBoss: Game.level.isBoss, type: Game.level.bossType, hp: Game.boss ? Game.boss.hp : 0, maxHp: Game.boss ? Game.boss.maxHp : 0, portalOpen: Game.portalOpen }));
console.log('boss L25:', JSON.stringify(bossState));
await page.waitForTimeout(1800); // lewati intro
await page.screenshot({ path: SHOT + '/06-boss.png' });

// 8. cek lava: teleport player ke zona hazard
await page.evaluate(() => { Game.player.y = Game.level.worldH + 10; });
await page.waitForTimeout(300);
const deadState = await page.evaluate(() => Game.state);
console.log('jatuh ke jurang -> state:', deadState, '(harus dead)');
await page.waitForTimeout(1600); // auto respawn
const respawned = await page.evaluate(() => ({ state: Game.state, x: Game.player.x }));
console.log('respawn:', JSON.stringify(respawned));

// 9. menang: teleport ke portal
await page.evaluate(() => { const p = Game.level.portal; Game.player.x = p.x; Game.player.y = p.y - 40; Game.portalOpen = true; });
await page.waitForTimeout(500);
const victory = await page.evaluate(() => ({ state: Game.state, unlocked: Save.get().unlocked, coins: Save.get().coins }));
console.log('portal -> victory:', JSON.stringify(victory));
await page.screenshot({ path: SHOT + '/07-victory.png' });

// 10. level select halaman 2 (tak terbatas)
await page.click('#btn-victory-menu');
await page.waitForTimeout(300);
await page.click('#btn-levels');
await page.waitForTimeout(200);
await page.click('#btn-page-next');
await page.waitForTimeout(200);
const page2Label = await page.textContent('#page-label');
const unlockedAfter = await page.evaluate(() => Save.get().unlocked);
console.log('halaman 2 label:', page2Label, '| unlocked:', unlockedAfter);
await page.screenshot({ path: SHOT + '/08-levels-page2.png' });

console.log('');
console.log('console errors:', errors.length ? errors : 'TIDAK ADA');
await browser.close();
if (errors.length) process.exit(2);
