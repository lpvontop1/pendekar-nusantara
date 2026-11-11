// ===== Utilitas: RNG deterministik, matematika =====
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
function levelSeed(n) {
  let s = (n * 2654435761) >>> 0;
  s ^= s >>> 13; s = Math.imul(s, 0x5BD1E995) >>> 0;
  s ^= s >>> 15;
  return s >>> 0;
}
function isBossLevel(n) { return n % 25 === 0; }
function biomeOf(n) { return CFG.BIOMES[(n - 1) % CFG.BIOMES.length]; }
function bossTypeOf(n) { return CFG.BOSS_CYCLE[(Math.floor(n / 25) - 1) % CFG.BOSS_CYCLE.length]; }
