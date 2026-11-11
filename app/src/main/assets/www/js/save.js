// ===== Penyimpanan progres (localStorage) =====
const Save = (() => {
  const KEY = 'pendekar_nusantara_v1';
  const DEFAULTS = () => ({
    coins: 0,
    unlocked: 1,          // level tertinggi yang bisa dimainkan
    done: [],             // daftar level selesai
    up: { stam2: false, jump: false, speed: false, hearts: 0 },
    set: { music: true, sfx: true, vibe: true },
    deaths: 0,
  });
  let data = DEFAULTS();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        data = Object.assign(DEFAULTS(), p);
        data.up = Object.assign(DEFAULTS().up, p.up || {});
        data.set = Object.assign(DEFAULTS().set, p.set || {});
        if (!Array.isArray(data.done)) data.done = [];
      }
    } catch (e) { /* storage kosong / rusak -> default */ }
    return data;
  }
  function commit() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }
  function reset() {
    data = DEFAULTS();
    commit();
  }
  function maxHp() {
    return clamp(CFG.HP_BASE + (data.up.hearts || 0), CFG.HP_BASE, CFG.HP_MAX);
  }
  function stamMax() { return data.up.stam2 ? CFG.STAM_MAX * 2 : CFG.STAM_MAX; }
  function jumpMul() { return data.up.jump ? 1.12 : 1; }
  function speedMul() { return data.up.speed ? 1.25 : 1; }
  function buy(cost) {
    if (data.coins < cost) return false;
    data.coins -= cost; commit(); return true;
  }
  function earn(c) { data.coins += c; commit(); }
  function completeLevel(n) {
    if (data.unlocked < n + 1) data.unlocked = n + 1;
    if (data.done.indexOf(n) < 0) data.done.push(n);
    commit();
  }
  return { load, commit, reset, get: () => data, maxHp, stamMax, jumpMul, speedMul, buy, earn, completeLevel };
})();
