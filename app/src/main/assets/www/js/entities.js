// ===== Entitas: Player, Musuh, Boss, Proyektil, Pickup, Partikel =====

function rectOf(e) { return { x: e.x, y: e.y, w: e.w, h: e.h }; }

// ---------- PLAYER ----------
function Player(x, y) {
  this.x = x; this.y = y;
  this.w = 14; this.h = 30;
  this.vx = 0; this.vy = 0;
  this.onGround = false; this.coyote = 0;
  this.facing = 1;
  this.maxHp = Save.maxHp(); this.hp = this.maxHp;
  this.stamMax = Save.stamMax(); this.stam = this.stamMax; this.stamDelay = 0;
  this.dashT = 0; this.dashCd = 0; this.airDash = true; this.dashDir = 1;
  this.iframes = 0; this.hurtT = 0;
  this.anim = 'idle'; this.animT = 0; this.frame = 0;
  this.squashY = 1; this.squashX = 1;
  this.kopiT = 0;
  this.dead = false;
  this.jumpCutDone = false;
}

Player.prototype.update = function (dt, game) {
  const inp = Input.state;
  const lv = game.level;
  const speedMul = Save.speedMul();
  const jumpMul = Save.jumpMul();

  this.dashCd = Math.max(0, this.dashCd - dt);
  this.iframes = Math.max(0, this.iframes - dt);
  this.hurtT = Math.max(0, this.hurtT - dt);
  this.stamDelay = Math.max(0, this.stamDelay - dt);
  this.kopiT = Math.max(0, this.kopiT - dt);
  this.coyote = Math.max(0, this.coyote - dt);

  // ---- dash ----
  if (Input.consumeDash() && this.dashT <= 0 && this.dashCd <= 0 && this.stam >= CFG.DASH_COST) {
    if (this.onGround || this.airDash) {
      this.dashT = CFG.DASH_TIME; this.dashCd = CFG.DASH_CD;
      this.stam -= CFG.DASH_COST; this.stamDelay = CFG.STAM_DELAY;
      this.dashDir = inp.left ? -1 : (inp.right ? 1 : this.facing);
      this.facing = this.dashDir;
      if (!this.onGround) this.airDash = false;
      AudioSys.play('dash');
      game.spawnDust(this.x + this.w / 2, this.y + this.h, 6);
    }
  }
  if (this.dashT > 0) {
    this.dashT -= dt;
    this.vx = this.dashDir * CFG.DASH_SPEED;
    this.vy = Math.min(this.vy, 40); // dash horizontal meluncur
  } else {
    // ---- gerak horizontal ----
    let dir = 0;
    if (inp.left) dir -= 1;
    if (inp.right) dir += 1;
    const maxS = CFG.MAX_SPEED * speedMul * (this.kopiT > 0 ? 1.1 : 1);
    if (dir !== 0) {
      const acc = (this.onGround ? CFG.ACCEL : CFG.AIR_ACCEL) * dt;
      this.vx += dir * acc;
      this.vx = clamp(this.vx, -maxS, maxS);
      this.facing = dir;
    } else {
      const fr = (this.onGround ? CFG.FRICTION : CFG.AIR_DRAG) * dt;
      if (Math.abs(this.vx) <= fr) this.vx = 0; else this.vx -= Math.sign(this.vx) * fr;
    }
    // ---- gravitasi & lompat ----
    this.vy = Math.min(this.vy + CFG.GRAVITY * dt, CFG.MAX_FALL);
    if (Input.consumeJump()) this._bufT = CFG.BUFFER;
    this._bufT = Math.max(0, (this._bufT || 0) - dt);
    if (this._bufT > 0 && (this.onGround || this.coyote > 0)) {
      this.vy = -CFG.JUMP_VEL * jumpMul;
      this.onGround = false; this.coyote = 0; this._bufT = 0;
      this.jumpCutDone = false;
      this.squashY = 1.14; this.squashX = 0.9;
      AudioSys.play('jump');
      game.spawnDust(this.x + this.w / 2, this.y + this.h, 4);
    }
    // variabel tinggi lompatan
    if (!inp.jump && this.vy < 0 && !this.jumpCutDone) {
      this.vy *= CFG.JUMP_CUT; this.jumpCutDone = true;
    }
  }

  // ---- integrasi + tumbukan platform ----
  this._moveX(this.vx * dt, game);
  const wasGround = this.onGround;
  this._moveY(this.vy * dt, game);
  if (this.onGround) {
    this.airDash = true;
    this.coyote = CFG.COYOTE;
    if (!wasGround && this.vy >= 0) {
      AudioSys.play('land');
      this.squashY = 0.82; this.squashX = 1.16;
      if (this.vy > 300) game.spawnDust(this.x + this.w / 2, this.y + this.h, 6);
    }
  }

  // ---- regen stamina ----
  const regen = CFG.STAM_REGEN * (this.kopiT > 0 ? 2 : 1) * (this.onGround ? 1.2 : 1);
  if (this.stamDelay <= 0) this.stam = Math.min(this.stamMax, this.stam + regen * dt);

  // squash easing
  this.squashY = lerp(this.squashY, 1, Math.min(1, dt * 12));
  this.squashX = lerp(this.squashX, 1, Math.min(1, dt * 12));

  // ---- pilih animasi ----
  this.animT += dt;
  if (this.dashT > 0) this.anim = 'dash';
  else if (!this.onGround) this.anim = this.vy < 0 ? 'jump' : 'fall';
  else if (Math.abs(this.vx) > 8) this.anim = 'run';
  else this.anim = 'idle';
  if (this.hurtT > 0) this.anim = 'hurt';
};

Player.prototype._moveX = function (dx, game) {
  this.x += dx;
  const solids = game.solids();
  for (const r of solids) {
    if (r.oneWay) continue;
    if (aabb(this.x, this.y, this.w, this.h, r.x, r.y, r.w, r.h)) {
      if (dx > 0) this.x = r.x - this.w;
      else if (dx < 0) this.x = r.x + r.w;
      this.vx = 0;
      if (this.dashT > 0) this.dashT = 0;
    }
  }
  this.x = clamp(this.x, 0, game.level.worldW - this.w);
};
Player.prototype._moveY = function (dy, game) {
  const prevBottom = this.y + this.h;
  this.y += dy;
  this.onGround = false;
  const solids = game.solids();
  for (const r of solids) {
    if (!aabb(this.x, this.y, this.w, this.h, r.x, r.y, r.w, r.h)) continue;
    if (r.oneWay) {
      // platform searah: hanya mendarat dari atas
      if (dy > 0 && prevBottom <= r.y + 4) {
        this.y = r.y - this.h; this.vy = 0; this.onGround = true;
      }
      continue;
    }
    if (dy > 0) { this.y = r.y - this.h; this.vy = 0; this.onGround = true; }
    else if (dy < 0) { this.y = r.y + r.h; this.vy = Math.max(0, this.vy); }
  }
  // jatuh ke jurang
  if (this.y > game.level.worldH + 40) game.killPlayer('pit');
};

// animasi frame index per state (urutan sheet)
const ANIM_FRAMES = {
  idle: [0, 1, 0, 1],
  run: [2, 3, 4, 5],
  jump: [6], fall: [7], dash: [8], attack: [9], hurt: [10],
};

// ---------- MUSUH ----------
const ENEMY_SPEC = {
  buta:      { w: 26, h: 24, hp: 1, speed: 42,  frames: 9 },
  tuyul:     { w: 14, h: 16, hp: 1, speed: 84,  frames: 9 },
  kunti:     { w: 20, h: 26, hp: 1, speed: 55,  frames: 7 },
  banaspati: { w: 26, h: 26, hp: 1, speed: 0,   frames: 7 },
  leyak:     { w: 14, h: 16, hp: 1, speed: 110, frames: 9 },
};

function Enemy(type, x, y, min, max, diff) {
  const s = ENEMY_SPEC[type];
  this.type = type;
  this.w = s.w; this.h = s.h;
  this.x = x - s.w / 2; this.y = y - s.h;
  this.hp = s.hp; this.diff = diff || 1;
  this.min = min; this.max = max;
  this.dir = Math.random() < 0.5 ? -1 : 1;
  this.t = Math.random() * 6;
  this.dead = false; this.hurtT = 0;
  this.anchorY = y - s.h;
  this.fireCd = 1.5 + Math.random();
  this.hopT = 1 + Math.random() * 2;
}

Enemy.prototype.update = function (dt, game) {
  const p = game.player;
  this.t += dt;
  this.hurtT = Math.max(0, this.hurtT - dt);
  const spd = 1 + (this.diff - 1) * 0.6;
  switch (this.type) {
    case 'buta': {
      const dxp = (p.x + p.w / 2) - (this.x + this.w / 2);
      const chase = Math.abs(dxp) < 96 && Math.abs((p.y + p.h) - (this.y + this.h)) < 48 && !p.dead;
      let v = CFG.BUTA_SPEED * spd * (chase ? 1.35 : 1);
      if (chase) this.dir = dxp > 0 ? 1 : -1;
      this.x += this.dir * v * dt;
      if (this.x < this.min) { this.x = this.min; this.dir = 1; }
      if (this.x + this.w > this.max) { this.x = this.max - this.w; this.dir = -1; }
      break;
    }
    case 'tuyul': case 'leyak': {
      const v = (this.type === 'leyak' ? 110 : CFG.TUYUL_SPEED) * spd;
      this.x += this.dir * v * dt;
      if (this.x < this.min) { this.x = this.min; this.dir = 1; }
      if (this.x + this.w > this.max) { this.x = this.max - this.w; this.dir = -1; }
      // hop kecil
      this.hopT -= dt;
      if (this.onGroundE(game) && this.hopT <= 0) {
        this.vy = -220; this.hopT = 1.2 + Math.random() * 1.6;
      }
      this.vy = (this.vy || 0) + CFG.GRAVITY * dt;
      this.y += this.vy * dt;
      const g = game.groundBelow(this.x + this.w / 2, this.y + this.h, this);
      if (g !== null && this.vy > 0 && this.y + this.h >= g) { this.y = g - this.h; this.vy = 0; }
      break;
    }
    case 'kunti': {
      // melayang: sine di sekitar anchor; terbang mendekat bila player dekat
      const dxp = (p.x + p.w / 2) - (this.x + this.w / 2);
      const dyp = (p.y + p.h / 2) - (this.y + this.h / 2);
      const d = Math.hypot(dxp, dyp);
      if (d < 120 && !p.dead) {
        const v = CFG.KUNTI_SPEED * spd;
        this.x += (dxp / d) * v * dt;
        this.y += (dyp / d) * v * dt;
        this.aggro = true;
        this.x = clamp(this.x, this.min, this.max - this.w);
        this.y = clamp(this.y, this.anchorY - 60, this.anchorY + 40);
      } else {
        this.aggro = false;
        const hx = (this.min + this.max) / 2 - this.w / 2;
        this.x = lerp(this.x, hx, dt * 1.4);
        this.y = this.anchorY + Math.sin(this.t * 2.1) * 9;
      }
      break;
    }
    case 'banaspati': {
      // diam, hadap player, lempar bola api
      this.dir = ((p.x + p.w / 2) < (this.x + this.w / 2)) ? -1 : 1;
      this.fireCd -= dt;
      const dxp = Math.abs((p.x + p.w / 2) - (this.x + this.w / 2));
      if (this.fireCd <= 0 && dxp < 190 && !p.dead) {
        this.fireCd = CFG.FIRE_CD * (0.9 + Math.random() * 0.4);
        game.spawnEnemyShot(this.x + this.w / 2, this.y + 6, p, 'fire');
        AudioSys.play('fire');
        this.attackT = 0.4;
      }
      if (this.attackT > 0) this.attackT -= dt;
      break;
    }
  }
};
Enemy.prototype.onGroundE = function (game) {
  const g = game.groundBelow(this.x + this.w / 2, this.y + this.h + 2, this);
  return g !== null && Math.abs(g - (this.y + this.h)) < 3;
};

// ---------- BOSS ----------
function Boss(type, x, y, level) {
  const info = { rangda: { w: 40, h: 48 }, kala: { w: 48, h: 42 }, naga: { w: 58, h: 30 } }[type];
  this.type = type;
  this.w = info.w; this.h = info.h;
  this.x = x; this.y = y - info.h;
  this.maxHp = 8 + 2 * Math.floor(level / 25);
  this.hp = this.maxHp;
  this.state = 'intro'; this.t = 0;
  this.dir = -1;
  this.dead = false; this.fadeT = 0;
  this.iframes = 0; this.attack = null; this.homeX = x;
  this.vx = 0; this.vy = 0; this.baseY = y;
  this.step = 0;
}

Boss.prototype.hazardBox = function () { return { x: this.x, y: this.y, w: this.w, h: this.h }; };

Boss.prototype.update = function (dt, game) {
  const p = game.player;
  this.t += dt;
  this.iframes = Math.max(0, this.iframes - dt);
  const groundY = game.level.floorY; // permukaan arena
  const left = CFG.TILE * 1.2, right = game.level.worldW - CFG.TILE * 1.2 - this.w;

  if (this.state === 'die') {
    this.fadeT += dt;
    if (this.fadeT > 1.1 && !this.dead) { this.dead = true; game.onBossDead(this); }
    return;
  }
  if (this.state === 'intro') {
    if (this.t > 1.5) { this.state = 'idle'; this.t = 0; }
    return;
  }

  switch (this.type) {
    case 'rangda': this._rangda(dt, game, left, right); break;
    case 'kala': this._kala(dt, game, groundY, left, right); break;
    case 'naga': this._naga(dt, game, groundY, left, right); break;
  }
};

Boss.prototype._face = function (p) {
  this.dir = (p.x + p.w / 2) < (this.x + this.w / 2) ? -1 : 1;
};
Boss.prototype._pick = function (game, moves) {
  this.state = 'telegraph'; this.t = 0;
  this.attack = moves[Math.floor(Math.random() * moves.length)];
  this.step = 0;
};
Boss.prototype._rangda = function (dt, game, left, right) {
  const p = game.player;
  if (this.state === 'idle') {
    this._face(p);
    this.y = this.baseY - this.h + Math.sin(this.t * 2.4) * 10;
    this.x += (p.x < this.homeX ? -1 : 1) * 0; // menjaga posisi
    if (this.t > 1.3) this._pick(game, ['fan', 'fan', 'summon', 'dash']);
  } else if (this.state === 'telegraph') {
    if (this.t > 0.55) {
      this.state = 'attack'; this.t = 0;
      if (this.attack === 'fan') {
        for (let i = -2; i <= 2; i++) {
          game.spawnBossShot(this.x + this.w / 2, this.y + 14, p, 'mask', i * 0.35);
        }
        AudioSys.play('fire');
      } else if (this.attack === 'summon') {
        const alive = game.enemies.filter(e => e.type === 'leyak' && !e.dead).length;
        for (let i = 0; i < 2 - alive; i++) {
          const lx = this.x + (i === 0 ? -30 : 30);
          const e = new Enemy('leyak', clamp(lx, 80, game.level.worldW - 80), this.y + 30, 80, game.level.worldW - 80, 1);
          e.x = clamp(e.x, 80, game.level.worldW - 80 - e.w);
          game.enemies.push(e);
        }
      } else if (this.attack === 'dash') {
        this.vx = this.dir * 300;
      }
    }
  } else if (this.state === 'attack') {
    if (this.attack === 'dash') {
      this.x += this.vx * dt;
      if (this.x < left || this.x > right) { this.vx *= -1; this.x = clamp(this.x, left, right); }
      if (this.t > 0.85) { this.state = 'idle'; this.t = 0; }
    } else {
      this.y = this.baseY - this.h + Math.sin(this.t * 3) * 8;
      if (this.t > 0.5) { this.state = 'idle'; this.t = 0; }
    }
  }
};
Boss.prototype._kala = function (dt, game, groundY, left, right) {
  const p = game.player;
  if (this.state === 'idle') {
    this._face(p);
    this.y = groundY - this.h;
    if (this.t > 1.5) this._pick(game, ['slam', 'rain', 'lunge', 'slam']);
  } else if (this.state === 'telegraph') {
    if (this.t > 0.6) {
      this.state = 'attack'; this.t = 0;
      if (this.attack === 'slam') { this.vy = -480; }
      else if (this.attack === 'rain') {
        for (let i = 0; i < 4; i++) {
          const ox = 80 + Math.random() * (game.level.worldW - 160);
          game.spawnWarning(ox, groundY, 0.7);
        }
      } else if (this.attack === 'lunge') { this.vx = this.dir * 260; }
    }
  } else if (this.state === 'attack') {
    if (this.attack === 'slam') {
      this.vy += 1500 * dt;
      this.y += this.vy * dt;
      if (this.y >= groundY - this.h) {
        this.y = groundY - this.h;
        game.spawnShockwave(this.x + this.w / 2, groundY, -1);
        game.spawnShockwave(this.x + this.w / 2, groundY, 1);
        AudioSys.play('stomp'); AudioSys.vibe(30);
        game.shakeT = 0.3;
        this.state = 'idle'; this.t = 0;
      }
    } else if (this.attack === 'rain') {
      if (this.step < 4 && this.t > 0.72 + this.step * 0.18) {
        this.step++;
        // posisi dari warning aktif
        const ws = game.warnings.filter(w => !w.done);
        const w = ws[0];
        if (w) { w.done = true; game.spawnMoonOrb(w.x, -20); }
      }
      if (this.t > 2.2) { this.state = 'idle'; this.t = 0; game.warnings = game.warnings.filter(w => !w.done); }
    } else if (this.attack === 'lunge') {
      this.x += this.vx * dt;
      if (this.x < left || this.x > right) { this.vx = 0; this.x = clamp(this.x, left, right); }
      if (this.t > 0.5) { this.state = 'idle'; this.t = 0; }
    }
  }
};
Boss.prototype._naga = function (dt, game, groundY, left, right) {
  const p = game.player;
  if (this.state === 'idle') {
    this._face(p);
    this.y = groundY - this.h;
    if (this.t > 1.2) this._pick(game, ['slither', 'stream', 'sweep']);
  } else if (this.state === 'telegraph') {
    if (this.t > 0.45) {
      this.state = 'attack'; this.t = 0;
      if (this.attack === 'slither') { this.vx = (p.x > this.x ? 1 : -1) * 170; }
      else if (this.attack === 'stream') { this.step = 0; }
      else if (this.attack === 'sweep') { this.vx = (p.x > this.x ? 1 : -1) * 320; }
    }
  } else if (this.state === 'attack') {
    if (this.attack === 'slither') {
      this.x += this.vx * dt;
      this.y = groundY - this.h - Math.abs(Math.sin(this.t * 6)) * 30;
      if (this.x < left || this.x > right) { this.vx *= -1; this.x = clamp(this.x, left, right); }
      if (this.t > 2.0) { this.state = 'idle'; this.t = 0; this.y = groundY - this.h; }
    } else if (this.attack === 'stream') {
      if (this.step < 3 && this.t > this.step * 0.24) {
        this.step++;
        game.spawnBossShot(this.x + (this.dir > 0 ? this.w : 0), this.y + 10, p, 'fire', 0, true);
        AudioSys.play('fire');
      }
      if (this.t > 1.0) { this.state = 'idle'; this.t = 0; }
    } else if (this.attack === 'sweep') {
      this.x += this.vx * dt;
      if (this.x < left || this.x > right) { this.vx = 0; this.x = clamp(this.x, left, right); }
      if (this.t > 0.55) { this.state = 'idle'; this.t = 0; }
    }
  }
};

// ---------- PROYEKTIL ----------
function Shot(x, y, vx, vy, kind, grav, life) {
  this.x = x; this.y = y;
  this.w = 10; this.h = 10;
  this.vx = vx; this.vy = vy;
  this.kind = kind || 'fire';
  this.grav = grav === undefined ? 0 : grav;
  this.life = life || 3;
  this.dead = false;
}
Shot.prototype.update = function (dt, game) {
  this.vy += this.grav * dt;
  this.x += this.vx * dt; this.y += this.vy * dt;
  this.life -= dt;
  if (this.life <= 0) this.dead = true;
  // tabrak platform (kecuali shockwave yang merayap di tanah)
  if (this.kind !== 'shock') {
    for (const r of game.solids()) {
      if (r.oneWay) continue;
      if (aabb(this.x, this.y, this.w, this.h, r.x, r.y, r.w, r.h)) {
        this.dead = true;
        game.spawnPoof(this.x + 5, this.y + 5, this.kind === 'fire' ? '#ff9a3c' : '#c9a0ff');
        break;
      }
    }
  }
  if (this.x < -20 || this.x > game.level.worldW + 20 || this.y > game.level.worldH + 20) this.dead = true;
};

// ---------- PICKUP KOIN JATUH ----------
function Pickup(x, y) {
  this.x = x; this.y = y;
  this.vx = (Math.random() - 0.5) * 120;
  this.vy = -180 - Math.random() * 80;
  this.w = 10; this.h = 10;
  this.life = 9;
  this.dead = false;
  this.t = 0;
}
Pickup.prototype.update = function (dt, game) {
  this.t += dt;
  this.vy += 900 * dt;
  this.x += this.vx * dt; this.y += this.vy * dt;
  const g = game.groundBelow(this.x + this.w / 2, this.y + this.h);
  if (g !== null && this.y + this.h > g && this.vy > 0) {
    this.y = g - this.h; this.vy *= -0.45; this.vx *= 0.8;
    if (Math.abs(this.vy) < 30) this.vy = 0;
  }
  this.life -= dt;
  if (this.life <= 0) this.dead = true;
};

// ---------- PARTIKEL ----------
function Particle(x, y, vx, vy, life, color, size, grav) {
  this.x = x; this.y = y;
  this.vx = vx; this.vy = vy;
  this.life = life; this.maxLife = life;
  this.color = color;
  this.size = size || 2;
  this.grav = grav === undefined ? 300 : grav;
  this.dead = false;
}
Particle.prototype.update = function (dt) {
  this.vy += this.grav * dt;
  this.x += this.vx * dt; this.y += this.vy * dt;
  this.life -= dt;
  if (this.life <= 0) this.dead = true;
};
