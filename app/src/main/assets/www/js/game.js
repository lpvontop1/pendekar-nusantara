// ===== Game: loop, fisika dunia, bahaya, checkpoint, boss, kamera =====
const Game = {
  state: 'idle',        // idle | playing | paused | dead | victory
  level: null, levelNum: 0,
  player: null, enemies: [], boss: null,
  shots: [], pickups: [], particles: [], warnings: [],
  cam: { x: 0, y: 0 }, shakeT: 0,
  coinsRun: 0, deaths: 0, time: 0,
  lastCheckpoint: null,
  bossIntroShown: false, portalOpen: true,
  stompCue: false,

  start(levelNum) {
    this.levelNum = levelNum;
    const lv = Gen.genLevel(levelNum);
    this.level = lv;
    this.player = new Player(lv.spawn.x + 6, lv.spawn.y);
    this.enemies = lv.enemies.map(e => new Enemy(e.type, e.x + CFG.TILE / 2, e.y + CFG.TILE, e.min, e.max, lv.diff));
    this.shots = []; this.pickups = []; this.particles = []; this.warnings = [];
    this.coinsRun = 0; this.time = 0; this.shakeT = 0;
    this.lastCheckpoint = null;
    this.portalOpen = !lv.isBoss;
    this.boss = null; this.bossIntroShown = false;
    if (lv.isBoss) {
      this.boss = new Boss(lv.bossType, lv.worldW - 9 * CFG.TILE, lv.floorY, levelNum);
    }
    this.cam.x = clamp(this.player.x - CFG.VIEW_W / 2, 0, lv.worldW - CFG.VIEW_W);
    this.cam.y = clamp(this.player.y - CFG.VIEW_H / 2, 0, lv.worldH - CFG.VIEW_H);
    this.state = 'playing';
    UI.onLevelStart(this);
    AudioSys.startMusic(lv.isBoss ? 'boss' : 'calm');
    if (lv.isBoss && !this.bossIntroShown) this._showBossIntro();
  },

  _showBossIntro() {
    this.bossIntroShown = true;
    const info = CFG.BOSS_INFO[this.level.bossType];
    UI.showBossIntro(info.name, info.sub);
  },

  solids() {
    if (this._solidsCache && this._solidsCacheFor === this.level) return this._solidsCache;
    const T = CFG.TILE;
    const out = [];
    for (const p of this.level.platforms) {
      out.push({ x: p.x * T, y: p.y * T, w: p.w * T, h: (p.type === 'ground' ? this.level.worldH - p.y * T : T), oneWay: p.type === 'float' });
    }
    this._solidsCache = out; this._solidsCacheFor = this.level;
    return out;
  },

  // permukaan tertinggi di bawah titik (untuk musuh & pickup)
  groundBelow(px, py, self) {
    let best = null;
    for (const r of this.solids()) {
      if (px < r.x || px > r.x + r.w) continue;
      if (r.y >= py - 2) { if (best === null || r.y < best) best = r.y; }
    }
    return best;
  },

  spawnDust(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push(new Particle(x + (Math.random() - 0.5) * 10, y - 2,
        (Math.random() - 0.5) * 70, -Math.random() * 60, 0.4, '#b8a07a', 2, 200));
    }
  },
  spawnPoof(x, y, color) {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 80;
      this.particles.push(new Particle(x, y, Math.cos(a) * v, Math.sin(a) * v - 30, 0.5, color || '#e8d9b0', 2, 140));
    }
  },
  spawnEnemyShot(x, y, target, kind) {
    const dx = (target.x + target.w / 2) - x;
    const t = 0.9;
    const vx = clamp(dx / t, -200, 200);
    const vy = -Math.abs(dx) * 0.35 - 90;
    this.shots.push(new Shot(x - 5, y, vx, vy, kind, 900, 2.6));
  },
  spawnBossShot(x, y, target, kind, angleOff, straight) {
    const dx = (target.x + target.w / 2) - x;
    const dy = (target.y + target.h / 2) - y;
    const d = Math.hypot(dx, dy) || 1;
    if (straight) {
      this.shots.push(new Shot(x - 5, y, Math.sign(dx) * 240, 0, kind, 0, 2.2));
    } else {
      const sp = 190;
      const ang = Math.atan2(dy, dx) + (angleOff || 0);
      this.shots.push(new Shot(x - 5, y, Math.cos(ang) * sp, Math.sin(ang) * sp, kind, 0, 2.4));
    }
  },
  spawnShockwave(x, y, dir) {
    const s = new Shot(x - 5, y - 12, dir * 180, 0, 'shock', 0, 2.2);
    s.w = 12; s.h = 12;
    this.shots.push(s);
  },
  spawnWarning(x, groundY, delay) {
    this.warnings.push({ x, groundY, t: 0, delay, done: false });
  },
  spawnMoonOrb(x, y) {
    this.shots.push(new Shot(x - 5, y, 0, 260, 'orb', 0, 3));
  },

  // ---- pemanggilan kerusakan ----
  hurtPlayer(dmg, fromX) {
    const p = this.player;
    if (p.iframes > 0 || p.dead || this.state !== 'playing') return;
    p.hp -= dmg;
    p.iframes = CFG.IFRAMES;
    p.hurtT = 0.35;
    p.vx = Math.sign(p.x + p.w / 2 - fromX) * 160 || 160;
    p.vy = Math.min(p.vy, -160);
    AudioSys.play('hurt');
    AudioSys.vibe([40, 30, 40]);
    UI.syncHud(this);
    if (p.hp <= 0) this.killPlayer('enemy');
  },

  killPlayer(cause) {
    if (this.player.dead || this.state !== 'playing') return;
    const p = this.player;
    p.dead = true;
    this.state = 'dead';
    Save.get().deaths++;
    Save.commit();
    AudioSys.play(cause === 'lava' || cause === 'swamp' ? 'lava' : 'die');
    AudioSys.vibe([60, 40, 60, 40, 80]);
    this.spawnPoof(p.x + p.w / 2, p.y + p.h / 2, '#f2b8a8');
    UI.showDeath(cause);
    setTimeout(() => { if (this.state === 'dead') this.respawn(); }, 1300);
  },

  respawn() {
    const lv = this.level;
    const cp = this.lastCheckpoint || { x: lv.spawn.x, y: lv.spawn.y };
    const p = new Player(cp.x, cp.y - 40);
    this.player = p;
    p.x = clamp(cp.x + 6, 0, lv.worldW - 20);
    p.y = cp.y - p.h - 2;
    // bersihkan proyektil
    this.shots = []; this.warnings = [];
    // musuh mati tetap mati, hidup tetap hidup (posisi reset sederhana)
    for (const e of this.enemies) {
      if (!e.dead && e.type !== 'kunti') {
        // biarkan seperti adanya
      }
    }
    this.state = 'playing';
    UI.syncHud(this);
    UI.hideDeath();
  },

  onBossDead(boss) {
    this.portalOpen = true;
    AudioSys.play('bossDie');
    AudioSys.startMusic('calm');
    // hujan koin
    for (let i = 0; i < 26; i++) {
      this.pickups.push(new Pickup(boss.x + boss.w / 2, boss.y + 10));
    }
    UI.toast('Gerbang terbuka! Penguasa tumbang.', 'gold');
    UI.hideBossBar();
  },

  stealCoins(n) {
    const steal = Math.min(n, this.coinsRun);
    this.coinsRun -= steal;
    if (steal > 0) UI.toast('Tuyul mencuri ' + steal + ' koin!', 'bad');
  },

  // ---- UPDATE utama (dt tetap 1/60) ----
  update(dt) {
    if (this.state !== 'playing') { Input.endFrame(); return; }
    this.time += dt;
    const p = this.player, lv = this.level;

    p.update(dt, this);
    Input.endFrame();

    // checkpoint
    for (const c of lv.checkpoints) {
      if (!c.active) {
        const cx = c.x, cyTop = c.y + CFG.TILE;
        if (aabb(p.x, p.y, p.w, p.h, cx - 6, cyTop - 40, 44, 44)) {
          c.active = true;
          this.lastCheckpoint = c;
          AudioSys.play('check');
          UI.toast('Titik aman dinyalakan');
        }
      }
    }

    // koin statis
    for (const c of lv.coins) {
      if (!c.taken && aabb(p.x - 4, p.y - 4, p.w + 8, p.h + 8, c.x + 8, c.y + 8, 16, 16)) {
        c.taken = true; this.coinsRun++;
        AudioSys.play('coin');
        this.particles.push(new Particle(c.x + CFG.TILE / 2, c.y + CFG.TILE / 2, 0, -60, 0.4, '#f5d97a', 2, 0));
      }
    }

    // musuh
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.x - p.x) > CFG.VIEW_W) continue; // culling update
      e.update(dt, this);
      const eb = { x: e.x, y: e.y, w: e.w, h: e.h };
      if (aabb(p.x, p.y, p.w, p.h, eb.x, eb.y, eb.w, eb.h)) {
        // stamping: jatuh di atas kepala
        if (p.vy > 60 && (p.y + p.h) - e.y < 14) {
          e.dead = true;
          p.vy = -CFG.STOMP_BOUNCE;
          this.coinsRun += 1;
          AudioSys.play('stomp');
          AudioSys.vibe(25);
          this.spawnPoof(e.x + e.w / 2, e.y + e.h / 2, '#f5d97a');
          this.pickups.push(new Pickup(e.x + e.w / 2, e.y));
          UI.syncHud(this);
        } else if (p.dashT > 0) {
          e.dead = true;
          this.coinsRun += 1;
          AudioSys.play('enemyDie');
          this.spawnPoof(e.x + e.w / 2, e.y + e.h / 2, '#e8d9b0');
          this.pickups.push(new Pickup(e.x + e.w / 2, e.y));
        } else {
          if (p.iframes <= 0) {
            this.hurtPlayer(1, e.x + e.w / 2);
            if (e.type === 'tuyul' || e.type === 'leyak') this.stealCoins(3);
          }
        }
      }
    }

    // boss
    if (this.boss && !this.boss.dead) {
      const b = this.boss;
      b.update(dt, this);
      if (b.state !== 'intro' && b.state !== 'die') {
        const hb = b.hazardBox();
        if (aabb(p.x, p.y, p.w, p.h, hb.x, hb.y, hb.w, hb.h)) {
          if (p.vy > 60 && (p.y + p.h) - hb.y < 16 && p.dashT <= 0) {
            if (b.iframes <= 0) {
              b.hp--; b.iframes = 0.5;
              p.vy = -CFG.STOMP_BOUNCE * 1.05;
              AudioSys.play('bossHit');
              AudioSys.vibe(40);
              this.spawnPoof(hb.x + hb.w / 2, hb.y + 6, '#ffd9c0');
              UI.syncBossBar(b);
              if (b.hp <= 0) b.state = 'die';
            } else {
              p.vy = -CFG.STOMP_BOUNCE;
            }
          } else if (p.dashT > 0) {
            if (b.iframes <= 0) {
              b.hp--; b.iframes = 0.5;
              AudioSys.play('bossHit');
              AudioSys.vibe(40);
              this.spawnPoof(hb.x + hb.w / 2, hb.y + hb.h / 2, '#ffd9c0');
              UI.syncBossBar(b);
              if (b.hp <= 0) b.state = 'die';
            }
          } else {
            this.hurtPlayer(1, hb.x + hb.w / 2);
          }
        }
      }
    }

    // proyektil
    for (const s of this.shots) {
      s.update(dt, this);
      if (!s.dead && this.state === 'playing' &&
          aabb(p.x, p.y, p.w, p.h, s.x, s.y, s.w, s.h)) {
        if (p.dashT <= 0) {
          s.dead = true;
          this.hurtPlayer(1, s.x);
        }
      }
    }
    this.shots = this.shots.filter(s => !s.dead);

    // peringatan hujan orb
    for (const w of this.warnings) { if (!w.done) w.t += dt; }
    this.warnings = this.warnings.filter(w => !w.done || w.t < w.delay + 0.2);

    // pickup koin
    for (const pk of this.pickups) {
      pk.update(dt, this);
      if (aabb(p.x - 4, p.y - 4, p.w + 8, p.h + 8, pk.x, pk.y, pk.w, pk.h)) {
        pk.dead = true; this.coinsRun++;
        AudioSys.play('coin');
      }
    }
    this.pickups = this.pickups.filter(k => !k.dead);

    // partikel
    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter(pt => !pt.dead);

    // bahaya statis: lava/rawa dasar & ranjau
    if (p.y + p.h > lv.worldH - 2 * CFG.TILE + 6) {
      this.killPlayer(lv.hazard);
    }
    for (const s of lv.spikes) {
      if (aabb(p.x, p.y + p.h - 10, p.w, 10, s.x + 4, s.y + 8, s.w - 8, CFG.TILE - 8)) {
        this.killPlayer('spike');
      }
    }

    // portal
    const portalRect = { x: lv.portal.x + 6, y: lv.portal.y - 56, w: 36, h: 62 };
    if (this.portalOpen && aabb(p.x, p.y, p.w, p.h, portalRect.x, portalRect.y, portalRect.w, portalRect.h)) {
      this.completeLevel();
    }

    // kamera
    const tx = clamp(p.x + p.w / 2 - CFG.VIEW_W * 0.42, 0, lv.worldW - CFG.VIEW_W);
    const ty = clamp(p.y + p.h / 2 - CFG.VIEW_H * 0.55, 0, lv.worldH - CFG.VIEW_H);
    this.cam.x = lerp(this.cam.x, tx, Math.min(1, dt * 6));
    this.cam.y = lerp(this.cam.y, ty, Math.min(1, dt * 6));
    this.shakeT = Math.max(0, this.shakeT - dt);
  },

  completeLevel() {
    if (this.state !== 'playing') return;
    this.state = 'victory';
    AudioSys.play('portal');
    const bonus = CFG.BONUS_BASE + this.levelNum * CFG.BONUS_PER_LEVEL;
    Save.earn(this.coinsRun + bonus);
    Save.completeLevel(this.levelNum);
    UI.showVictory(this, bonus);
    AudioSys.startMusic('menu');
  },

  // ---- RENDER ----
  render(ctx) {
    const lv = this.level;
    if (!lv) return;
    let shx = 0, shy = 0;
    if (this.shakeT > 0) {
      shx = (Math.random() - 0.5) * 6 * this.shakeT * 4;
      shy = (Math.random() - 0.5) * 6 * this.shakeT * 4;
    }
    const camX = this.cam.x + shx, camY = this.cam.y + shy;
    const t = this.time;

    ctx.imageSmoothingEnabled = false;
    World.bg(ctx, lv, camX, camY, t);
    ctx.save();
    ctx.translate(-Math.round(camX), -Math.round(camY));
    World.tiles(ctx, lv, camX, camY);
    World.decor(ctx, lv, camX, camY, t);
    World.checkpoints(ctx, lv, camX, camY, t);
    World.warung(ctx, lv, camX);
    World.portal(ctx, lv, camX, camY, t, this.portalOpen);
    World.coins(ctx, lv, t, camX);

    // peringatan orb (bayangan jatuh)
    for (const w of this.warnings) {
      if (w.done) continue;
      const a = 0.35 + Math.sin(t * 12) * 0.2;
      ctx.fillStyle = `rgba(255,90,60,${a})`;
      ctx.fillRect(w.x - 12, w.groundY - 4, 24, 4);
    }

    // musuh
    for (const e of this.enemies) {
      if (e.dead) continue;
      const alpha = e.type === 'kunti' ? 0.86 : 1;
      const flick = (e.type === 'banaspati') ? (0.92 + Math.sin(t * 14) * 0.08) : 1;
      World.frame(ctx, e.type === 'leyak' ? 'tuyul' : e.type, this._enemyFrame(e),
        e.x - 2, e.y - 4, e.dir < 0, 1, 1, alpha * flick);
      if (e.type === 'kunti') {
        // aura
        ctx.fillStyle = 'rgba(160,220,200,0.08)';
        ctx.fillRect(e.x - 6, e.y - 8, e.w + 12, e.h + 14);
      }
    }

    // boss
    if (this.boss && !this.boss.dead) {
      const b = this.boss;
      if (b.state !== 'die' || b.fadeT < 1.1) {
        const alpha = b.state === 'die' ? 1 - b.fadeT / 1.1 : 1;
        const flash = (b.state === 'telegraph' && Math.floor(t * 10) % 2 === 0) ? 0.55 :
                      (b.iframes > 0 && Math.floor(t * 16) % 2 === 0) ? 0.5 : 1;
        let frameIdx = 0;
        if (b.state === 'attack') frameIdx = 2 + Math.floor(t * 8) % 3;
        else if (b.state === 'telegraph') frameIdx = 1;
        else frameIdx = Math.floor(t * 3) % 2;
        World.frame(ctx, b.type, frameIdx, b.x - 3, b.y - 6, b.dir < 0, 1, 1, alpha * flash);
        if (b.type === 'naga') {
          // ekor bergelombang
          ctx.fillStyle = 'rgba(80,140,70,0.5)';
          for (let i = 1; i <= 4; i++) {
            const wx = b.x + (b.dir < 0 ? b.w + i * 7 : -i * 7);
            const wy = b.y + b.h - 8 + Math.sin(t * 8 + i) * 4;
            ctx.fillRect(wx, wy, 6, 6);
          }
        }
      }
    }

    // proyektil
    for (const s of this.shots) {
      const colors = { fire: '#ff9a3c', mask: '#d9a0ff', orb: '#ffd9c0', shock: '#f5d97a' };
      const c = colors[s.kind] || '#fff';
      ctx.fillStyle = c;
      if (s.kind === 'shock') {
        ctx.fillRect(s.x, s.y - Math.abs(Math.sin(t * 20)) * 4, s.w, s.h);
      } else {
        ctx.fillRect(s.x + 1, s.y, s.w - 2, s.h);
        ctx.fillRect(s.x, s.y + 2, s.w, s.h - 4);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(s.x + 3, s.y + 3, 3, 3);
    }

    // pickup
    const imgCoin = Assets.img('coin');
    for (const pk of this.pickups) {
      ctx.drawImage(imgCoin, pk.x - 2, pk.y - 2, 12, 12);
    }

    // player
    const p = this.player;
    if (!p.dead) {
      const blink = p.iframes > 0 && Math.floor(t * 14) % 2 === 0;
      if (!blink) {
        // jejak dash
        if (p.dashT > 0) {
          World.frame(ctx, 'player', ANIM_FRAMES.dash[0], p.x - 10, p.y - 4, p.facing < 0, 1, 1, 0.25);
        }
        World.frame(ctx, 'player', World.frameIdx(p), p.x - 6, p.y - 4, p.facing < 0, p.squashY, p.squashX);
        if (p.dashT > 0) {
          ctx.fillStyle = 'rgba(240,225,180,0.5)';
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(p.x - p.facing * (8 + i * 7), p.y + 8 + i * 5, 4, 2);
          }
        }
      }
    }

    // partikel
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // vignette tipis
    const vg = ctx.createRadialGradient(CFG.VIEW_W / 2, CFG.VIEW_H / 2, 120, CFG.VIEW_W / 2, CFG.VIEW_H / 2, 300);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(10,6,2,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  },

  _enemyFrame(e) {
    // pemetaan animasi sederhana per tipe
    const t = this.time;
    switch (e.type) {
      case 'buta': {
        const walking = true;
        if (e.attackT > 0) return 6 + (Math.floor(t * 8) % 2);
        return walking ? 2 + Math.floor(t * 7) % 4 : Math.floor(t * 3) % 2;
      }
      case 'tuyul': case 'leyak':
        return (e.vy && e.vy < -20) ? 6 : 2 + Math.floor(t * 9) % 4;
      case 'kunti': {
        if (e.aggro) return 4 + Math.floor(t * 6) % 2;
        return Math.floor(t * 2.4) % 2;
      }
      case 'banaspati': {
        if (e.attackT > 0) return 2 + Math.floor(t * 8) % 2;
        return 4 + Math.floor(t * 6) % 2;
      }
    }
    return 0;
  },
};
