// ===== Procedural Route Generation =====
// Deterministik per nomor level. Aturan lompatan dijamin fisika:
//  - flat  : gap <= 2 tile
//  - naik 1: gap <= 1 tile
//  - naik 2: gap <= 1 tile (jarang, level tinggi)
//  - turun : gap <= 2 tile, maks turun 3 tile
// Platform selalu maju ke kanan sehingga TIDAK MUNGKIN overlap horizontal.
// Semua route diverifikasi BFS reachability (lihat validate()).
const Gen = (() => {
  const T = CFG.TILE, H = CFG.WORLD_H_TILES;

  function genLevel(n) {
    const rng = mulberry32(levelSeed(n));
    const biome = biomeOf(n);
    const boss = isBossLevel(n);
    const lv = boss ? genBoss(n, biome, rng) : genRoute(n, biome, rng);
    lv.num = n; lv.biome = biome; lv.isBoss = boss;
    lv.worldW *= T; lv.worldH = H * T;
    lv.spawn = { x: lv.spawn.x * T, y: lv.spawn.y * T };
    lv.portal = { x: lv.portal.x * T, y: lv.portal.y * T };
    lv.warung = lv.warung ? { x: lv.warung.x * T, y: lv.warung.y * T } : null;
    lv.checkpoints = lv.checkpoints.map(c => ({ x: c.x * T, y: c.y * T, active: false }));
    lv.coins = lv.coins.map(c => ({ x: c.x * T, y: c.y * T, taken: false, t: Math.random() * 6 }));
    lv.spikes = lv.spikes.map(s => ({ x: s.x * T, y: s.y * T, w: s.w * T }));
    lv.enemies = lv.enemies.map(e => ({ type: e.type, x: e.x * T, y: e.y * T, min: e.min * T, max: e.max * T }));
    lv.decor = lv.decor.map(d => ({ type: d.type, x: d.x * T, y: d.y * T }));
    lv.diff = 1 + Math.min((n - 1) * 0.012, 0.55);
    return lv;
  }

  function hazardKind(biome) { return biome === 'jungle' ? 'swamp' : 'lava'; }

  function genRoute(n, biome, rng) {
    const lv = {
      platforms: [], coins: [], enemies: [], checkpoints: [], decor: [],
      spikes: [], portal: null, spawn: null, warung: null, worldW: 0,
      hazard: hazardKind(biome), bossType: null,
    };
    const S = CFG.SAFE;
    const startTop = 12;
    lv.platforms.push({ x: 0, y: startTop, w: 8, type: 'ground' });
    lv.spawn = { x: 2, y: startTop - 2 };
    lv.warung = { x: 5, y: startTop - 1 };
    lv.floorY = startTop * CFG.TILE;
    let cx = 8, cy = startTop;
    const steps = clamp(20 + Math.floor(n * 0.7), 22, 52);
    let sinceCp = 0, sinceEnemy = 0;
    const maxEnemies = Math.min(4 + Math.floor(n / 3), 14);
    const enemyChance = 0.34 + Math.min(n * 0.02, 0.42);

    for (let s = 0; s < steps; s++) {
      // ---- pilih dy & gap dalam batas aman ----
      let dy = 0;
      const r = rng();
      const canUp1 = cy - 1 >= 4, canUp2 = cy - 2 >= 4 && n >= 8;
      const canDown = cy + 1 <= 13;
      if (r < 0.34) dy = 0;
      else if (r < 0.34 + 0.30 && canUp1) dy = -1;
      else if (r < 0.34 + 0.30 + 0.12 && canUp2) dy = -2;
      else if (canDown) dy = 1 + Math.floor(rng() * Math.min(3, 13 - cy + 0));
      else dy = 0;
      dy = clamp(dy, -(cy - 4), Math.max(0, 13 - cy) || 0);
      if (dy === 0 && !canUp1 && !canDown) dy = 0; // datar terpaksa

      let gap = 1;
      if (dy === 0) gap = 1 + (rng() < 0.55 ? 1 : 0);              // <= 2
      else if (dy === -1) gap = 1;
      else if (dy === -2) gap = 1;
      else gap = 1 + (rng() < 0.5 ? 1 : 0);                        // turun <= 2

      // ---- tipe & lebar platform ----
      const isGround = dy !== 0 ? rng() < 0.62 : rng() < 0.55;
      let w;
      if (isGround) w = 5 + Math.floor(rng() * 4);   // 5-8
      else w = 3 + Math.floor(rng() * 2);            // 3-4
      if (dy === -2) w = Math.max(w, 4);

      // ---- pastikan tidak overlap: x selalu maju, jadi aman ----
      const nx = cx + gap;
      const ny = cy + dy;
      lv.platforms.push({ x: nx, y: ny, w: w, type: isGround ? 'ground' : 'float' });

      // ---- koin di atas platform & busur di celah ----
      if (rng() < 0.62) {
        const cn = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < cn; i++) {
          const tx = nx + Math.floor((w / cn) * (i + 0.5));
          lv.coins.push({ x: tx, y: ny - 1 });
        }
      }
      if (gap >= 2 && rng() < 0.8) {
        for (let i = 0; i < 3; i++) {
          const t = (i + 1) / 4;
          const arcX = cx + t * gap + 0.5;
          const arcY = Math.min(cy, ny) - 1 - Math.sin(t * Math.PI) * 1.6;
          lv.coins.push({ x: arcX, y: Math.round(arcY) });
        }
      }

      // ---- ranjau di ground (level >= 6): 1 tile, jauh dari zona pendaratan (>= 5 tile dari tepi kiri) ----
      if (isGround && n >= 6 && w >= 8 && rng() < 0.16) {
        const sx = nx + 5 + Math.floor(rng() * (w - 7));
        lv.spikes.push({ x: sx, y: ny - 1, w: 1 });
      }

      // ---- musuh ----
      sinceEnemy++;
      if (s >= 2 && s < steps - 2 && sinceEnemy >= 2 && lv.enemies.length < maxEnemies && rng() < enemyChance) {
        const pool = [];
        if (isGround && w >= 4) pool.push('buta', 'buta');
        if (isGround && w >= 6) pool.push('banaspati');
        if (w >= 3 && n >= 4) pool.push('tuyul');
        if (n >= 5) pool.push('kunti');
        if (biome === 'volcano' && isGround) pool.push('banaspati');
        if (biome === 'temple') pool.push('kunti');
        const type = pool[Math.floor(rng() * pool.length)] || 'buta';
        let ex, ey, min, max;
        if (type === 'kunti') {
          // melayang di atas platformnya (bukan atas celah) agar tidak menjegal lompatan
          ex = nx + w / 2; ey = ny - 2.5; min = nx; max = nx + w;
        } else {
          // patrol berjarak >= 1.1 tile dari tepi agar tidak mengunci zona pendaratan
          ex = nx + w / 2; ey = ny - 1;
          min = nx + 1.1; max = nx + w - 1.1;
        }
        lv.enemies.push({ type, x: ex, y: ey, min, max });
        sinceEnemy = 0;
      }

      // ---- checkpoint ----
      sinceCp++;
      if (isGround && w >= 5 && sinceCp >= 9) {
        lv.checkpoints.push({ x: nx + Math.floor(w / 2), y: ny - 1 });
        sinceCp = 0;
      }

      // ---- dekorasi ----
      if (isGround && rng() < 0.5) {
        const kinds = biome === 'jungle' ? ['tree', 'tree', 'statue', 'torch'] :
                      biome === 'temple' ? ['statue', 'torch', 'statue'] : ['statue', 'torch', 'tree'];
        const kind = kinds[Math.floor(rng() * kinds.length)];
        const dx = nx + 1 + Math.floor(rng() * (w - 2));
        lv.decor.push({ type: kind, x: dx, y: ny - 1 });
      }

      cx = nx + w; cy = ny;
    }

    // ---- platform akhir + portal ----
    const endY = clamp(cy, 6, 13);
    lv.platforms.push({ x: cx + 1, y: endY, w: 8, type: 'ground' });
    lv.portal = { x: cx + 4, y: endY - 1 };
    lv.worldW = cx + 10;
    if (lv.checkpoints.length === 0) lv.checkpoints.push({ x: 4, y: startTop - 1 });
    return lv;
  }

  function genBoss(n, biome, rng) {
    const lv = {
      platforms: [], coins: [], enemies: [], checkpoints: [], decor: [],
      spikes: [], portal: null, spawn: null, warung: null, worldW: 44,
      hazard: hazardKind(biome), bossType: bossTypeOf(n),
    };
    const top = 12;
    lv.platforms.push({ x: 1, y: top, w: 42, type: 'ground' });
    // pilar pembatas arena (ground = menembus dasar, jadi tembok)
    lv.platforms.push({ x: 0, y: 5, w: 1, type: 'ground' });
    lv.platforms.push({ x: 43, y: 5, w: 1, type: 'ground' });
    // pijakan menghindar
    lv.platforms.push({ x: 9, y: 9, w: 4, type: 'float' });
    lv.platforms.push({ x: 31, y: 9, w: 4, type: 'float' });
    if (n >= 50) {
      lv.platforms.push({ x: 19, y: 7, w: 4, type: 'float' });
    }
    lv.spawn = { x: 4, y: top - 2 };
    lv.checkpoints.push({ x: 6, y: top - 1 });
    lv.portal = { x: 2, y: top - 1 };
    lv.floorY = top * CFG.TILE;
    // koin di pijakan
    lv.coins.push({ x: 10, y: 8 }, { x: 11, y: 8 }, { x: 32, y: 8 }, { x: 33, y: 8 });
    // dekor obor
    lv.decor.push({ type: 'torch', x: 8, y: top - 1 }, { type: 'torch', x: 35, y: top - 1 });
    lv.decor.push({ type: 'statue', x: 13, y: top - 1 }, { type: 'statue', x: 30, y: top - 1 });
    return lv;
  }

  // ===== Validasi: anti-overlap + BFS reachability =====
  function platRect(p) {
    return { x: p.x, y: p.y, w: p.w, h: p.type === 'ground' ? (H - p.y) : 1 };
  }
  function canJump(A, B) {
    // jarak horizontal dari tepi kanan A ke tepi kiri B (atau overlap-x utk naik)
    const ra = platRect(A), rb = platRect(B);
    const gapX = Math.max(0, rb.x - (ra.x + ra.w));
    const overlapX = !(rb.x >= ra.x + ra.w || rb.x + rb.w <= ra.x);
    const dy = rb.y - ra.y; // negatif = B lebih tinggi
    if (dy > CFG.SAFE.DOWN_MAX && gapX >= 0 && !overlapX) return false;
    if (dy === 0) return gapX <= CFG.SAFE.FLAT_GAP + 0.5 || overlapX;
    if (dy === -1) return gapX <= CFG.SAFE.UP1_GAP + 0.5 || (overlapX && true);
    if (dy === -2) return gapX <= CFG.SAFE.UP2_GAP + 0.5;
    return true; // turun dalam batas
  }
  function validate(level) {
    const errors = [];
    const plats = level.platforms;
    // 1) overlap
    for (let i = 0; i < plats.length; i++) {
      const a = platRect(plats[i]);
      if (a.y < 0 || a.y >= H || a.x < 0) errors.push('platform out of bounds #' + i);
      for (let j = i + 1; j < plats.length; j++) {
        const b = platRect(plats[j]);
        if (aabb(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h)) {
          errors.push(`overlap ${i}:${j}`);
          break;
        }
      }
    }
    // 2) BFS reachability dari platform spawn
    const spawnPlat = plats[0];
    const portalPx = level.portal;
    const visited = new Set([0]);
    const q = [0];
    while (q.length) {
      const i = q.shift();
      for (let j = 0; j < plats.length; j++) {
        if (visited.has(j)) continue;
        if (canJump(plats[i], plats[j]) || canJump(plats[j], plats[i])) {
          visited.add(j); q.push(j);
        }
      }
    }
    if (visited.size !== plats.length) errors.push(`unreachable platforms: ${plats.length - visited.size}`);
    // portal harus di atas platform yang terjangkau
    const portalPlatIdx = plats.findIndex(p => portalPx.x >= p.x * CFG.TILE && portalPx.x < (p.x + p.w) * CFG.TILE);
    if (portalPlatIdx < 0 || !visited.has(portalPlatIdx)) errors.push('portal unreachable');
    // 3) spawn & portal menempati platform
    if (plats[0].type !== 'ground') errors.push('spawn platform bukan ground');
    // 4) musuh dalam batas patrol
    for (const e of level.enemies) {
      if (e.max < e.min) errors.push('enemy patrol terbalik');
    }
    // 5) koin dalam dunia (koordinat sudah dikonversi ke px)
    for (const c of level.coins) {
      if (c.x < 0 || c.y < 0 || c.x > level.worldW) errors.push('coin out of world');
    }
    return { ok: errors.length === 0, errors };
  }

  return { genLevel, validate, canJump, platRect };
})();
