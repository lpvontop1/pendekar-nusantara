// QA: validasi generator 200 level + sintaks
import fs from 'fs';
import vm from 'vm';

const base = '/home/z/my-project/nusantara-platformer/app/src/main/assets/www/js/';
const code = ['config.js', 'util.js', 'gen.js'].map(f => fs.readFileSync(base + f, 'utf8')).join('\n;\n');
const ctx = { window: {}, console, CFG: null };
vm.createContext(ctx);
vm.runInContext(code + '\n;this.CFG = CFG; this.Gen = Gen;', ctx);
const { Gen, CFG } = ctx;

let fails = 0;
const problems = [];
for (let n = 1; n <= 200; n++) {
  const lv = Gen.genLevel(n);
  const v = Gen.validate(lv);
  if (!v.ok) {
    fails++;
    problems.push(`L${n}: ${v.errors.slice(0, 3).join(' | ')}`);
    continue;
  }
  // pemeriksaan tambahan
  const T = CFG.TILE;
  if (lv.spawn.x < 0 || lv.spawn.y < 0) { fails++; problems.push(`L${n}: spawn negatif`); }
  if (lv.portal.x <= 0 || lv.portal.x >= lv.worldW) { fails++; problems.push(`L${n}: portal di luar dunia`); }
  // musuh harus berada di atas platform (feet dekat permukaan) kecuali kunti
  for (const e of lv.enemies) {
    if (e.type === 'kunti') continue;
    let onSurf = false;
    for (const p of lv.platforms) {
      const topY = p.y * T;
      if (e.x >= p.x * T && e.x <= (p.x + p.w) * T && Math.abs(e.y + T - topY) < 2) onSurf = true;
    }
    if (!onSurf) { fails++; problems.push(`L${n}: musuh ${e.type} tidak di permukaan (y=${e.y})`); break; }
  }
  // checkpoint minimal 1
  if (lv.checkpoints.length < 1) { fails++; problems.push(`L${n}: tanpa checkpoint`); }
}

// statistik
const lv1 = Gen.genLevel(1), lv50 = Gen.genLevel(50), lv25 = Gen.genLevel(25);
console.log('L1  : platforms=', lv1.platforms.length, 'coins=', lv1.coins.length, 'enemies=', lv1.enemies.length, 'cps=', lv1.checkpoints.length, 'worldW=', (lv1.worldW / CFG.TILE).toFixed(0));
console.log('L50 : platforms=', lv50.platforms.length, 'enemies=', lv50.enemies.length, 'cps=', lv50.checkpoints.length);
console.log('L25 : boss=', lv25.isBoss, lv25.bossType, 'worldW=', (lv25.worldW / CFG.TILE).toFixed(0));
console.log('L75 boss type =', Gen.genLevel(75).bossType, '| L100 =', Gen.genLevel(100).bossType);
console.log('');
if (fails === 0) {
  console.log('SEMUA 200 LEVEL VALID: tanpa overlap, semua terjangkau, checkpoint & portal OK');
} else {
  console.log(`GAGAL ${fails} level:`);
  for (const p of problems.slice(0, 20)) console.log('  -', p);
  process.exit(1);
}
