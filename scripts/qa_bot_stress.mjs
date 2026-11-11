// ============================================================
// BLACKBOX + STRESS TEST: bot auto-play memainkan game asli
//  - memainkan level 1..100 (rute & boss) dengan fisika asli
//  - stress entitas: 80 musuh + 400 partikel, ukur kecepatan tick
//  - stress memori: 120k tick beruntun, cek kenaikan heap
// Kriteria lulus: semua level victory, tick > 25x realtime, heap stabil.
// ============================================================
import fs from 'fs';
import vm from 'vm';

const BASE = '/home/z/my-project/nusantara-platformer/app/src/main/assets/www/js/';
const load = (f) => fs.readFileSync(BASE + f, 'utf8');

// ---- stub DOM/audio/UI untuk menjalankan logika game tanpa browser ----
function makeDummyEl() {
  return {
    addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} },
    setPointerCapture() {}, style: {}, textContent: '', innerHTML: '',
  };
}
const sandbox = {
  console, Math, JSON, Date, isFinite, parseFloat, parseInt,
  performance: { now: () => Date.now() },
  window: { addEventListener() {} },
  document: {
    getElementById: () => makeDummyEl(),
    addEventListener() {}, hidden: false,
    createElement: () => makeDummyEl(),
  },
  navigator: { vibrate: () => {} },
  requestAnimationFrame: () => 1,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  // fake timer: dipicu manual per tick (untuk respawn 1.3 dtk)
  __timers: [],
};
sandbox.setTimeout = (fn, ms) => { sandbox.__timers.push({ fn, at: sandbox.__tick + Math.ceil((ms || 0) / 16.667) }); return 0; };
sandbox.clearTimeout = () => {};
sandbox.UI = new Proxy({}, { get: () => () => {} });
sandbox.AudioSys = { play() {}, startMusic() {}, vibe() {}, ensure() {}, stopMusic() {} };
sandbox.Assets = { img: () => null, meta: null, ready: true };
sandbox.World = new Proxy({}, { get: () => () => {} });
vm.createContext(sandbox);

vm.runInContext(load('config.js') + '\n;this.CFG=CFG;', sandbox);
vm.runInContext(load('util.js'), sandbox);
vm.runInContext(load('save.js') + '\n;this.Save=Save;', sandbox);
vm.runInContext(load('input.js') + '\n;this.Input=Input;', sandbox);
vm.runInContext(load('gen.js') + '\n;this.Gen=Gen;', sandbox);
vm.runInContext(load('entities.js'), sandbox);
vm.runInContext(load('game.js') + '\n;this.Game=Game;', sandbox);

const { Game, Input, Gen, CFG, aabb, Enemy, Save } = sandbox;

// ============================================================
// BOT AI
// ============================================================
function wallAhead(game) {
  const p = game.player;
  for (const r of game.solids()) {
    if (r.oneWay) continue;
    if (aabb(p.x + p.w - 2, p.y + 6, 20, p.h - 10, r.x, r.y, r.w, r.h)) return true;
  }
  return false;
}
let lastCause = '';
(function wrapKill() {
  const orig = Game.killPlayer.bind(Game);
  Game.killPlayer = (c) => { lastCause = c; orig(c); };
})();
let jumpHold = 0; // tahan tombol lompat agar tidak terpotong jump-cut
let airTarget = null, airTargetLeft = null, spikeArm = false, waitT = 0; // target lompatan & rencana dash ranjau
function shotThreat(game) {
  const p = game.player;
  for (const s of game.shots) {
    const d = Math.hypot((s.x - p.x), (s.y - p.y));
    if (d < 55 && Math.abs(s.y - p.y) < 40 && s.vx * (p.x - s.x) >= 0) return true;
  }
  return false;
}
function surfAhead(game, x, feet) {
  let best = null;
  for (const r of game.solids()) {
    if (x < r.x || x > r.x + r.w) continue;
    if (r.y >= feet - 66 && (best === null || r.y < best)) best = r.y;
  }
  return best;
}
function botThink(game) {
  const p = game.player, lv = game.level;
  const st = Input.state;
  st.left = false; st.right = true; st.jump = false; st.jumpPressed = false; st.dashPressed = false;
  if (p.dead) return;
  if (jumpHold > 0) { st.jump = true; jumpHold--; }

  // ===== BOSS =====
  if (lv.isBoss) {
    // boss tumbang / gerbang terbuka -> lari KIRI ke portal (jangan terjebak di dinding)
    if (!game.boss || game.boss.dead || game.portalOpen) {
      const tx = game.level.portal.x;
      const dxp = tx - (p.x + p.w / 2);
      if (dxp < -8) { st.right = false; st.left = true; }
      else if (dxp > 8) { st.right = true; }
  const probe = 20;
  const gAhead = game.groundBelow(p.x + p.w / 2 + Math.sign(dxp || 1) * probe, p.y + p.h + 4);
      if (p.onGround && gAhead === null) { st.jumpPressed = true; st.jump = true; jumpHold = 30; }
      return;
    }
    const b = game.boss;
    const dx = (b.x + b.w / 2) - (p.x + p.w / 2);
    const dy = Math.abs((b.y + b.h) - (p.y + p.h));
    const bossCharging = b.state === 'attack' && (b.attack === 'dash' || b.attack === 'lunge' || b.attack === 'sweep' || b.attack === 'slither');
    if (bossCharging && Math.abs(dx) < 130 && p.onGround) { st.jumpPressed = true; st.jump = true; jumpHold = 26; return; }
    if (shotThreat(game)) { st.jumpPressed = true; st.jump = true; jumpHold = 26; return; }
    if (Math.abs(dx) < 170) {
      st.right = dx > 8; st.left = dx < -8;
      if (p.dashCd <= 0 && p.stam >= CFG.DASH_COST && p.dashT <= 0 && dy < 70) {
        st.dashPressed = true;
        st.right = dx > 0; st.left = dx < 0;
      }
    } else { st.right = dx > 0; st.left = dx < 0; }
    return;
  }

  // ===== RUTE normal =====
  // reset state udara setiap tick di darat (sebelum cabang2 yang return, cegah spikeArm basi)
  if (p.onGround) { waitT = 0; airTarget = null; airTargetLeft = null; spikeArm = false; }
  // info lintasan dihitung dulu
  const feet = p.y + p.h;
  const aheadX = p.x + p.w / 2 + 14;
  const gAhead = surfAhead(game, aheadX, feet);
  const gapAhead = gAhead === null;
  const ledgeUp = gAhead !== null && gAhead < feet - 10;
  const setTarget = () => {
    airTarget = gAhead; airTargetLeft = null;
    if (gAhead !== null) {
      for (const r of game.solids()) {
        if (r.y === gAhead && aheadX >= r.x && aheadX <= r.x + r.w) { airTargetLeft = r.x; break; }
      }
    }
  };
  // 1) ranjau di depan: lompati (prioritas tertinggi - jangan diganggu panic lain)
  const spikeHit = lv.spikes.find(s =>
    s.x > p.x + p.w - 4 && s.x - (p.x + p.w) < 20 && Math.abs((p.y + p.h) - (s.y + CFG.TILE)) < 44);
  if (p.onGround && spikeHit) {
    st.jumpPressed = true; st.jump = true; jumpHold = 32;
    spikeArm = spikeHit.w >= 60;
    return;
  }
  // di tepi celah: bila voli proyektil masih jauh (40-260px) tunggu dulu; bila sudah dekat lompat sekarang
  // (dilakukan di cabang celah di bawah)
  // 2) musuh di depan: dash menembus (langsung membunuh), atau lompat bila dash belum siap
  const foe = game.enemies.find(e =>
    !e.dead && e.x + e.w > p.x - 6 && e.x - (p.x + p.w) < 80 &&
    Math.abs((e.y + e.h / 2) - (p.y + p.h / 2)) < 80);
  if (foe && p.dashT <= 0 && p.onGround) {
    // jangan pernah dash menembus ranjau (dash tidak kebal ranjau)
    const spikeInPath = lv.spikes.some(sp => sp.x > p.x && sp.x - (p.x + p.w) < 84 &&
      Math.abs((p.y + p.h) - (sp.y + CFG.TILE)) < 44);
    if (p.dashCd <= 0 && p.stam >= CFG.DASH_COST && !spikeInPath) {
      if (gapAhead || ledgeUp) setTarget(); // dash bisa menerobos celah
      st.dashPressed = true; st.right = true; st.jump = false; return;
    }
    st.jumpPressed = true; st.jump = true; jumpHold = 26; return; // stomp / hindari
  }
  // 3) celah/dinding naik: lompati TEPAT di tepi (lompatan penuh 73px, margin tipis)
  if (p.onGround && (gapAhead || ledgeUp || wallAhead(game))) {
    const incoming = game.shots.find(s => s.x > p.x + 40 && s.x - p.x < 260 && Math.abs(s.y - p.y) < 90);
    if (incoming && waitT < 120) { st.right = false; waitT++; return; } // tunggu voli banaspati lewat
    waitT = 0;
    st.jumpPressed = true; st.jump = true; jumpHold = 30;
    setTarget();
    return;
  }
  // 4) proyektil sangat dekat: lompati (setelah ranjau/celah yang lebih kritis)
  if (shotThreat(game) && p.onGround) { st.jumpPressed = true; st.jump = true; jumpHold = 26; return; }

  // 4) di udara: dash HANYA bila proyeksi pendaratan jatuh pendek, atau ranjau lebar ter-armed
  if (!p.onGround && p.dashT <= 0 && p.airDash && p.stam >= CFG.DASH_COST) {
    if (spikeArm && p.vy > -330) {
      st.dashPressed = true; spikeArm = false;
    } else if (airTarget !== null && p.vy > 140) {
      const feet0 = p.y + p.h, vy0 = p.vy;
      const D = vy0 * vy0 - 3360 * (feet0 - airTarget);
      let tLand = null;
      if (feet0 < airTarget - 2) tLand = null; // sudah di bawah permukaan target -> pasti gagal
      else if (D >= 0) {
        const sq = Math.sqrt(D);
        const t1 = (-vy0 - sq) / 1680, t2 = (-vy0 + sq) / 1680;
        tLand = t2 > 0 ? t2 : (t1 > 0 ? t1 : null);
      }
      const willX = p.x + Math.max(p.vx, 60) * (tLand || 0.5);
      const foeAir = game.enemies.find(e =>
        !e.dead && e.x + e.w > p.x && e.x - (p.x + p.w) < 96 &&
        Math.abs((e.y + e.h / 2) - (p.y + p.h / 2)) < 80);
      const short = (tLand === null) || foeAir || (airTargetLeft !== null && willX + p.w < airTargetLeft + 10);
      if (short) st.dashPressed = true;
    }
  }
}

// ============================================================
// 1) PLAYTHROUGH LEVEL 1..100 + spot check jauh
// ============================================================
function setupProgress(n) {
  // model pemain sungguhan: sambil maju, beli upgrade di warung (koin dari level2 sebelumnya)
  const d = Save.get();
  d.unlocked = n; d.done = []; d.coins = 0; d.deaths = 0;
  d.up.jump = n >= 5;      // Bulu Rajawali +12% lompat
  d.up.speed = n >= 8;     // Sandal Angin +25% lari
  d.up.stam2 = n >= 12;    // Roh Kelapa: stamina 2x
  d.up.hearts = Math.min(2, Math.floor((n - 1) / 8)); // Jantung Waja -> HP 4/5
  Save.commit();
}
function lcg(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}
function playLevelOnce(n, budgetSec, rngSeed) {
  sandbox.Math.random = lcg(rngSeed); // perilaku musuh deterministik per percobaan
  setupProgress(n);
  Game.start(n);
  const budget = budgetSec * 60;
  let tick = 0, maxX = 0, stuckT = 0, deaths = 0, prevDead = false;
  let dieX = 0, dieTick = 0, cause = '';
  const deathLog = [];
  sandbox.__tick = 0; sandbox.__timers.length = 0; jumpHold = 0;
  while (tick < budget) {
    tick++; sandbox.__tick = tick;
    botThink(Game);
    Game.update(1 / 60);
    // jalankan timer jatuh tempo (respawn dsb)
    sandbox.__timers = sandbox.__timers.filter(t => {
      if (t.at <= tick) { t.fn(); return false; } return true;
    });
    if (Game.state === 'victory') {
      return { ok: true, tick, deaths, coins: Game.coinsRun };
    }
    if (Game.boss && n % 25 === 0 && tick % 1200 === 0) {
      console.log(`    [L${n}] tick ${tick}: boss hp ${Game.boss.hp}/${Game.boss.maxHp} (${Game.boss.state}${Game.boss.attack ? '/' + Game.boss.attack : ''}) player x=${Math.round(Game.player.x)} stam=${Math.round(Game.player.stam)}`);
    }
    const isDead = Game.state === 'dead';
    if (isDead && !prevDead) {
      deaths++; dieX = Math.round(Game.player.x); dieTick = tick; cause = lastCause;
      deathLog.push(`${cause}@${Math.round(Game.player.x)},${Math.round(Game.player.y)}`);
    }
    prevDead = isDead;
    if (deaths > 80) return { ok: false, why: `death-loop (terakhir: ${cause} @x=${dieX}, tick ${dieTick})`, tick, deaths, deathLog };
    const x = Game.player.x;
    if (x > maxX + 3) { maxX = x; stuckT = 0; }
    else if (Game.player.onGround) stuckT++;
    if (stuckT > 300) { // 5 dtk macet: coba recovery lompat+dash
      Input.state.jumpPressed = true; Input.state.jump = true;
      if (Game.player.stam >= CFG.DASH_COST) Input.state.dashPressed = true;
      stuckT = 0;
    }
  }
  return { ok: false, why: `timeout (maks x=${Math.round(maxX)}/${Math.round(Game.level.worldW)})`, tick, deaths, deathLog };
}

function playLevel(n, budgetSec) {
  // pemain nyata mengulang level; checkpoint dirancang untuk itu -> maks 3 percobaan
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = playLevelOnce(n, budgetSec, n * 7919 + attempt * 104729);
    r.attempt = attempt;
    if (r.ok) return r;
  }
  return Object.assign(playLevelOnce(n, budgetSec, n * 7919 + 104729), { attempt: 3 });
}

console.log('== BLACKBOX BOT PLAYTHROUGH (fisika asli, 1/60 tetap, maks 3 percobaan) ==');
const LEVELS = [];
for (let n = 1; n <= 100; n++) LEVELS.push(n);
LEVELS.push(101, 126, 150, 175, 200, 250, 300);

let pass = 0, fails = [], retries = [];
const t0 = Date.now();
for (const n of LEVELS) {
  const budget = (n % 25 === 0) ? 360 : 240; // boss 6 menit, rute 4 menit
  const r = playLevel(n, budget);
  if (r.ok) { pass++; if (r.attempt > 1) retries.push(`L${n}(coba${r.attempt})`); }
  else {
    fails.push(`L${n}: ${r.why} (${r.tick} tick, ${r.deaths} mati)`);
    if (r.deathLog && r.deathLog.length) {
      // ringkas: hitung frekuensi penyebab + lokasi terpadat
      const byCause = {};
      for (const d of r.deathLog) { const c = d.split('@')[0]; byCause[c] = (byCause[c] || 0) + 1; }
      const spots = {};
      for (const d of r.deathLog) { const loc = d.split('@')[1].split(',')[0]; spots[Math.round(+loc.split(',')[0] / 160)] = (spots[Math.round(+loc.split(',')[0] / 160)] || 0) + 1; }
      const top = Object.entries(spots).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k * 160}px x${v}`).join(', ');
      console.log(`      L${n} mati: ${JSON.stringify(byCause)} | lokasi terpadat: ${top}`);
    }
  }
  if (n <= 5 || n % 25 === 0) {
    console.log(`  L${n}${n % 25 === 0 ? ' (BOSS)' : ''} -> ${r.ok ? 'MENANG' : 'GAGAL ' + r.why} | ${r.tick} tick | ${r.deaths} mati | koin ${r.coins ?? '-'}`);
  }
}
const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nHasil: ${pass}/${LEVELS.length} level dimenangkan bot dalam ${dt} dtk`);
if (retries.length) console.log('Butuh >1 percobaan:', retries.join(', '));
if (fails.length) { console.log('GAGAL:'); fails.forEach(f => console.log('  ' + f)); }

// ============================================================
// 2) STRESS ENTITAS: 80 musuh + 500 partikel, kecepatan tick
// ============================================================
console.log('\n== STRESS ENTITAS ==');
Game.start(30); // level rute bioma temple
const p0 = Game.player;
for (let i = 0; i < 80; i++) {
  Game.enemies.push(new Enemy(['buta', 'tuyul', 'kunti', 'banaspati'][i % 4],
    p0.x + 120 + (i % 20) * 40, p0.y, p0.x, p0.x + 4000, 2));
}
for (let i = 0; i < 500; i++) Game.spawnPoof(p0.x + Math.random() * 300, p0.y - Math.random() * 60);
sandbox.__tick = 0; sandbox.__timers.length = 0;
const mem0 = process.memoryUsage().heapUsed;
const s0 = Date.now();
const STRESS_TICKS = 12000; // = 200 detik gameplay
let firstPass = 0;
for (let i = 0; i < STRESS_TICKS; i++) {
  sandbox.__tick = i;
  botThink(Game);
  Game.update(1 / 60);
  sandbox.__timers = sandbox.__timers.filter(t => { if (t.at <= i) { t.fn(); return false; } return true; });
  if (Game.state === 'victory' && !firstPass) firstPass = i;
  if (Game.state !== 'playing' && Game.state !== 'dead' && Game.state !== 'victory') break;
}
const sdt = (Date.now() - s0) / 1000;
const mem1 = process.memoryUsage().heapUsed;
const realtime = STRESS_TICKS / 60;
console.log(`${STRESS_TICKS} tick (${realtime.toFixed(0)} dtk gameplay) dalam ${sdt.toFixed(2)} dtk -> ${(realtime / sdt).toFixed(0)}x realtime`);
console.log(`musuh aktif: ${Game.enemies.length}, partikel hidup: ${Game.particles.length}, shots: ${Game.shots.length}`);
console.log(`heap: ${(mem0 / 1048576).toFixed(1)} MB -> ${(mem1 / 1048576).toFixed(1)} MB`);

// ============================================================
// 3) STRESS MEMORI JANGKA PANJANG: main terus 100k tick (28 menit gameplay)
// ============================================================
console.log('\n== STRESS MEMORI 100K TICK ==');
Game.start(7);
sandbox.__tick = 0; sandbox.__timers.length = 0;
const m0 = process.memoryUsage().heapUsed;
const samples = [];
let victoryAt = 0, restarts = 0;
for (let i = 0; i < 100000; i++) {
  sandbox.__tick = i;
  if (Game.state === 'victory') { Game.start(7); restarts++; victoryAt = i; }
  botThink(Game);
  Game.update(1 / 60);
  sandbox.__timers = sandbox.__timers.filter(t => { if (t.at <= i) { t.fn(); return false; } return true; });
  if (i % 20000 === 0) samples.push(+(process.memoryUsage().heapUsed / 1048576).toFixed(1));
}
const m1 = process.memoryUsage().heapUsed;
const growth = (m1 - m0) / 1048576;
console.log(`heap: ${samples.join(' -> ')} MB | pertumbuhan total: ${growth.toFixed(1)} MB | menang & restart: ${restarts}x (terakhir di tick ${victoryAt})`);
const okMem = growth < 25;
const okSpeed = (realtime / sdt) > 25;
const okPlay = fails.length === 0;
console.log('\n== KESIMPULAN ==');
console.log(`playthrough 108 level : ${okPlay ? 'LULUS' : 'GAGAL'}`);
console.log(`kecepatan tick stress : ${okSpeed ? 'LULUS' : 'GAGAL'} (${(realtime / sdt).toFixed(0)}x realtime, butuh > 25x)`);
console.log(`kebocoran memori      : ${okMem ? 'LULUS' : 'GAGAL'} (${growth.toFixed(1)} MB, butuh < 25 MB)`);
process.exit(okPlay && okSpeed && okMem ? 0 : 1);
