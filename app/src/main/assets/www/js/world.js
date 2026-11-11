// ===== Rendering: aset, tile, parallax, hazard, sprite =====
const Assets = {
  imgs: {}, meta: null, ready: false, count: 0, total: 0,
  list: ['player', 'buta', 'kunti', 'tuyul', 'banaspati', 'rangda', 'kala', 'naga',
    'tree', 'statue', 'torch', 'warung', 'portal', 'checkpoint', 'coin', 'heart',
    'padlock', 'jamu', 'kopi', 'feather', 'sandal', 'amulet', 'tile_spikes',
    'tile_grass', 'tile_dirt', 'tile_stone', 'tile_lava', 'tile_swamp', 'tile_plank',
    'bg_far_jungle', 'bg_near_jungle', 'bg_far_temple', 'bg_near_temple', 'bg_far_volcano', 'bg_near_volcano'],
  load(cb, onProg) {
    this.meta = window.ASSET_META || null;
    if (!this.meta) { console.error('meta.js tidak ditemukan'); }
    this.total = this.list.length;
    const done = () => { this.ready = true; cb(); };
    let n = 0;
    for (const name of this.list) {
      const img = new Image();
      img.onload = () => {
        n++; this.count = n;
        if (onProg) onProg(n / this.total);
        if (n === this.list.length) done();
      };
      img.onerror = () => { n++; console.warn('gagal muat aset', name); if (n === this.list.length) done(); };
      img.src = 'assets/img/' + name + '.png';
      this.imgs[name] = img;
    }
  },
  img(name) { return this.imgs[name]; },
};

const World = {
  // ---- gambar 1 frame dari sheet karakter ----
  frame(ctx, name, frameIdx, x, y, flip, squashY, squashX, alpha) {
    const meta = Assets.meta && Assets.meta.chars[name];
    const img = Assets.img(name);
    if (!meta || !img) return;
    const fw = meta.fw, fh = meta.fh;
    const sy = squashY || 1, sx = squashX || 1;
    ctx.save();
    ctx.translate(x + (fw * sx) / 2, y + fh * sy);
    ctx.scale(flip < 0 ? -sx : sx, sy);
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.drawImage(img, frameIdx * fw, 0, fw, fh, -fw / 2, -fh, fw, fh);
    ctx.restore();
  },
  frameIdx(ent) {
    const fr = ANIM_FRAMES[ent.anim] || [0];
    return fr[Math.floor(ent.animT * 8) % fr.length];
  },
  sprite(ctx, name, x, y, bottom, alpha) {
    const img = Assets.img(name);
    if (!img) return;
    const w = img.width, h = img.height;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.drawImage(img, Math.round(x - w / 2), Math.round(bottom - h));
    ctx.restore();
  },

  // ---- latar parallax ----
  bg(ctx, level, camX, camY, t) {
    const biome = level.biome;
    const far = Assets.img('bg_far_' + biome);
    const near = Assets.img('bg_near_' + biome);
    const vw = CFG.VIEW_W, vh = CFG.VIEW_H;
    // langit dasar sesuai biome
    const sky = biome === 'volcano' ? '#2a0d08' : biome === 'temple' ? '#3a2313' : '#1c2210';
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, vw, vh);
    if (far) {
      const w = far.width;
      const ox = -((camX * 0.18) % w);
      const oy = vh - far.height - Math.max(0, (camY * 0.1)) * 0.3;
      for (let x = ox - w; x < vw + w; x += w) ctx.drawImage(far, Math.round(x), Math.round(oy));
    }
    if (near) {
      const w = near.width;
      const ox = -((camX * 0.45) % w);
      const oy = vh - near.height - Math.max(0, (camY * 0.18)) * 0.4;
      for (let x = ox - w; x < vw + w; x += w) ctx.drawImage(near, Math.round(x), Math.round(oy));
    }
    // partikel debu/bara ambient
    if (biome === 'volcano') {
      ctx.fillStyle = 'rgba(255,150,60,0.5)';
      for (let i = 0; i < 14; i++) {
        const px = ((i * 97 + t * 12) % (vw + 20)) - 10;
        const py = (i * 53 + t * 26) % vh;
        ctx.fillRect(px, py, 2, 2);
      }
    } else {
      ctx.fillStyle = 'rgba(230,220,140,0.35)';
      for (let i = 0; i < 10; i++) {
        const px = ((i * 83 + Math.sin(t * 0.8 + i) * 20) % vw);
        const py = (i * 61 + Math.cos(t * 0.5 + i * 2) * 14) % vh;
        ctx.fillRect(px, py, 1.5, 1.5);
      }
    }
  },

  // ---- platform (tile) ----
  tiles(ctx, level, camX, camY) {
    const T = CFG.TILE;
    const biome = level.biome;
    const topTile = biome === 'jungle' ? 'tile_grass' : 'tile_stone';
    const fillTile = biome === 'jungle' ? 'tile_dirt' : 'tile_stone';
    const x0 = Math.max(0, Math.floor(camX / T) - 1);
    const x1 = Math.floor((camX + CFG.VIEW_W) / T) + 1;
    for (const p of level.platforms) {
      const px = p.x * T, py = p.y * T;
      const pw = p.w * T;
      const ph = p.type === 'ground' ? (level.worldH - py) : T;
      if (px + pw < camX - T || px > camX + CFG.VIEW_W + T) continue;
      const isFloat = p.type === 'float';
      for (let tx = 0; tx < p.w; tx++) {
        const cx = px + tx * T;
        if (tx + p.x < x0 || tx + p.x > x1) continue;
        if (isFloat) {
          ctx.drawImage(Assets.img('tile_plank'), cx, py);
        } else {
          ctx.drawImage(Assets.img(topTile), cx, py);
          for (let ty = py + T; ty < py + ph; ty += T) {
            ctx.drawImage(Assets.img(fillTile), cx, ty);
          }
        }
      }
      // garis tepi atas terang (kedalaman)
      ctx.fillStyle = 'rgba(255,232,170,0.10)';
      ctx.fillRect(px, py, pw, 2);
      if (biome === 'volcano' && !isFloat) {
        ctx.fillStyle = 'rgba(80,20,8,0.28)';
        ctx.fillRect(px, py, pw, ph);
      }
    }
    // ranjau bambu
    for (const s of level.spikes) {
      const img = Assets.img('tile_spikes');
      for (let sx = s.x; sx < s.x + s.w; sx += T) {
        ctx.drawImage(img, sx, s.y + T - img.height);
      }
    }
    // permukaan bahaya (lava / rawa) di dasar dunia
    const hk = level.hazard;
    const imgH = Assets.img(hk === 'lava' ? 'tile_lava' : 'tile_swamp');
    const hy = level.worldH - 2 * T;
    const ox = -((camX * 1) % T);
    const t = performance.now() / 1000;
    for (let x = ox - T; x < CFG.VIEW_W + T; x += T) {
      ctx.drawImage(imgH, Math.round(x), hy);
    }
    // kilau bergerak
    ctx.fillStyle = hk === 'lava' ? 'rgba(255,190,60,0.22)' : 'rgba(160,230,120,0.16)';
    const glowX = ((t * 40) % T);
    for (let x = ox - T + glowX; x < CFG.VIEW_W + T; x += T * 3) {
      ctx.fillRect(Math.round(x), hy + 4, 10, 3);
    }
    // awa di atas hazard
    const grad = ctx.createLinearGradient(0, hy - 14, 0, hy);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, hk === 'lava' ? 'rgba(255,110,30,0.28)' : 'rgba(90,180,60,0.2)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, hy - 14, CFG.VIEW_W, 14);
  },

  // ---- dekorasi ----
  decor(ctx, level, camX, camY, t) {
    for (const d of level.decor) {
      const px = d.x + CFG.TILE / 2;
      const py = d.y + CFG.TILE;
      if (px < camX - 80 || px > camX + CFG.VIEW_W + 80) continue;
      World.sprite(ctx, d.type, px, py, py);
      if (d.type === 'torch') {
        // api berkedip
        const fy = py - Assets.img('torch').height;
        ctx.fillStyle = 'rgba(255,170,60,0.75)';
        const fl = 3 + Math.sin(t * 11 + d.x) * 1.6;
        ctx.fillRect(px - 1.5, fy + 2 - fl, 3, fl + 2);
        ctx.fillStyle = 'rgba(255,230,150,0.9)';
        ctx.fillRect(px - 1, fy + 3 - fl * 0.6, 2, 2);
        const g = ctx.createRadialGradient(px, fy, 2, px, fy, 46);
        g.addColorStop(0, 'rgba(255,170,70,0.16)');
        g.addColorStop(1, 'rgba(255,170,70,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - 46, fy - 46, 92, 92);
      }
    }
  },

  // ---- checkpoint (candi dupa) ----
  checkpoints(ctx, level, camX, camY, t) {
    for (const c of level.checkpoints) {
      const px = c.x + CFG.TILE / 2;
      const py = c.y + CFG.TILE;
      if (px < camX - 60 || px > camX + CFG.VIEW_W + 60) continue;
      World.sprite(ctx, 'checkpoint', px, py, py);
      if (c.active) {
        const fy = py - Assets.img('checkpoint').height + 6;
        ctx.fillStyle = 'rgba(120,255,160,0.9)';
        const fl = 4 + Math.sin(t * 9) * 1.5;
        ctx.fillRect(px - 1.5, fy - fl, 3, fl);
        // lingkaran cahaya lembut
        const g = ctx.createRadialGradient(px, fy, 2, px, fy, 34);
        g.addColorStop(0, 'rgba(120,255,160,0.14)');
        g.addColorStop(1, 'rgba(120,255,160,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - 34, fy - 34, 68, 68);
      }
    }
  },

  // ---- portal esoteris ----
  portal(ctx, level, camX, camY, t, open) {
    const px = level.portal.x + 24;
    const py = level.portal.y + CFG.TILE;
    if (px < camX - 80 || px > camX + CFG.VIEW_W + 80) return;
    World.sprite(ctx, 'portal', px, py, py);
    const iy = py - Assets.img('portal').height;
    const cx = px, cy = iy + 30;
    if (open) {
      // pusaran cahaya
      for (let i = 0; i < 7; i++) {
        const a = t * 2.2 + i * (Math.PI * 2 / 7);
        const r = 6 + ((t * 14 + i * 9) % 16);
        const gx = cx + Math.cos(a) * r;
        const gy = cy + Math.sin(a) * r * 1.6;
        ctx.fillStyle = i % 2 ? 'rgba(150,220,255,0.75)' : 'rgba(210,150,255,0.75)';
        ctx.fillRect(gx, gy, 2, 2);
      }
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 40);
      g.addColorStop(0, 'rgba(140,190,255,0.3)');
      g.addColorStop(0.6, 'rgba(160,120,255,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 40, cy - 40, 80, 80);
    } else {
      ctx.fillStyle = 'rgba(255,60,40,0.16)';
      ctx.fillRect(cx - 18, iy + 4, 36, 58);
    }
  },

  warung(ctx, level, camX) {
    if (!level.warung) return;
    const px = level.warung.x + CFG.TILE / 2;
    const py = level.warung.y + CFG.TILE;
    if (px < camX - 90 || px > camX + CFG.VIEW_W + 90) return;
    World.sprite(ctx, 'warung', px, py, py);
  },

  coins(ctx, level, t, camX) {
    const img = Assets.img('coin');
    for (const c of level.coins) {
      if (c.taken) continue;
      const px = c.x + CFG.TILE / 2;
      const py = c.y + CFG.TILE / 2 + Math.sin(t * 3 + c.x) * 2;
      if (px < camX - 40 || px > camX + CFG.VIEW_W + 40) continue;
      const wob = Math.abs(Math.sin(t * 4 + c.x * 0.7));
      const w = img.width * (0.35 + 0.65 * wob);
      ctx.save();
      ctx.translate(px, py);
      ctx.drawImage(img, -w / 2, -img.height / 2, w, img.height);
      ctx.restore();
    }
  },
};
