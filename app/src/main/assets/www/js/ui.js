// ===== UI: layar, HUD, toko, toast, level select =====
const UI = {
  curScreen: null, page: 0, shopFrom: null, settingsFrom: null,

  init() {
    const $ = (id) => document.getElementById(id);
    this.$ = {
      hud: $('hud'), controls: $('controls'), hearts: $('hearts'), stamFill: $('stamina-fill'),
      coinCount: $('coin-count'), hudLevel: $('hud-level'), bossBar: $('boss-bar'),
      bossName: $('boss-name'), bossHpFill: $('boss-hp-fill'), compass: $('compass'),
      shopFab: $('shop-fab'), boot: $('screen-boot'), bootFill: $('boot-fill'),
      menu: $('screen-menu'), levels: $('screen-levels'), settings: $('screen-settings'),
      pause: $('screen-pause'), shop: $('screen-shop'), victory: $('screen-victory'),
      death: $('screen-death'), bossintro: $('screen-bossintro'), toasts: $('toasts'),
      grid: $('level-grid'), pageLabel: $('page-label'),
      menuCoins: $('menu-coins'),
    };

    // ---- menu utama ----
    $('btn-continue').addEventListener('click', () => { AudioSys.play('click'); this.startLevel(Save.get().unlocked); });
    $('btn-levels').addEventListener('click', () => { AudioSys.play('click'); this.showLevels(); });
    $('btn-shop-menu').addEventListener('click', () => { AudioSys.play('click'); this.openShop('menu'); });
    $('btn-settings').addEventListener('click', () => { AudioSys.play('click'); this.showSettings('menu'); });
    $('btn-levels-back').addEventListener('click', () => { AudioSys.play('back'); this.showMenu(); });
    $('btn-settings-back').addEventListener('click', () => {
      AudioSys.play('back');
      if (this.settingsFrom === 'pause') { this.hideAll(); this.$.pause.classList.remove('hidden'); }
      else this.showMenu();
    });
    $('btn-page-prev').addEventListener('click', () => { AudioSys.play('click'); if (this.page > 0) { this.page--; this.renderGrid(); } });
    $('btn-page-next').addEventListener('click', () => { AudioSys.play('click'); this.page++; this.renderGrid(); });

    // ---- jeda ----
    $('btn-pause').addEventListener('click', () => { AudioSys.play('click'); this.pause(); });
    $('btn-resume').addEventListener('click', () => { AudioSys.play('click'); this.resume(); });
    $('btn-pause-shop').addEventListener('click', () => { AudioSys.play('click'); this.openShop('pause'); });
    $('btn-pause-retry').addEventListener('click', () => { AudioSys.play('click'); this.hideAll(); this.showHud(true); Game.start(Game.levelNum); });
    $('btn-pause-quit').addEventListener('click', () => { AudioSys.play('back'); this.quitToMenu(); });

    // ---- toko ----
    $('btn-shop-close').addEventListener('click', () => { AudioSys.play('back'); this.closeShop(); });
    $('shop-fab').addEventListener('click', () => { AudioSys.play('click'); this.pauseForShop(); });

    // ---- menang ----
    $('btn-next-level').addEventListener('click', () => { AudioSys.play('click'); this.hideAll(); this.showHud(true); Game.start(Game.levelNum + 1); });
    $('btn-victory-retry').addEventListener('click', () => { AudioSys.play('click'); this.hideAll(); this.showHud(true); Game.start(Game.levelNum); });
    $('btn-victory-menu').addEventListener('click', () => { AudioSys.play('back'); this.quitToMenu(); });

    // ---- pengaturan ----
    const bindToggle = (id, key) => {
      const el = $(id);
      el.classList.toggle('on', Save.get().set[key]);
      el.addEventListener('click', () => {
        const v = !Save.get().set[key];
        Save.get().set[key] = v; Save.commit();
        el.classList.toggle('on', v);
        AudioSys.applySettings();
        AudioSys.play('click');
      });
    };
    bindToggle('tg-music', 'music');
    bindToggle('tg-sfx', 'sfx');
    bindToggle('tg-vibe', 'vibe');
    $('btn-reset').addEventListener('click', () => {
      const el = $('btn-reset');
      if (el.dataset.confirm === '1') {
        Save.reset();
        this.toast('Progres direset');
        el.textContent = 'RESET'; el.dataset.confirm = '';
        AudioSys.applySettings();
        this.refreshMenuCoins();
      } else {
        el.dataset.confirm = '1'; el.textContent = 'YAKIN?';
        AudioSys.play('err');
        setTimeout(() => { el.dataset.confirm = ''; el.textContent = 'RESET'; }, 2200);
      }
    });

    // tombol toko mengapung (dekat warung)
    this._shopTick = 0;
  },

  // ---------- tampilan layar ----------
  hideAll() {
    for (const el of [this.$.menu, this.$.levels, this.$.settings, this.$.pause, this.$.shop, this.$.victory, this.$.death, this.$.bossintro, this.$.boot]) {
      el.classList.add('hidden');
    }
  },
  showMenu() {
    this.hideAll();
    this.$.menu.classList.remove('hidden');
    this.showHud(false);
    this.refreshMenuCoins();
    AudioSys.startMusic('calm');
    this.curScreen = 'menu';
  },
  refreshMenuCoins() {
    this.$.menuCoins.querySelector('b').textContent = Save.get().coins;
  },
  showLevels() {
    this.hideAll();
    this.$.levels.classList.remove('hidden');
    this.showHud(false);
    this.curScreen = 'levels';
    this.renderGrid();
  },
  showSettings(from) {
    this.hideAll();
    this.settingsFrom = from;
    this.$.settings.classList.remove('hidden');
    if (from === 'game') this.showHud(true);
    this.curScreen = 'settings';
  },
  pause() {
    if (Game.state !== 'playing') return;
    Game.state = 'paused';
    this.$.pause.classList.remove('hidden');
  },
  pauseForShop() {
    if (Game.state !== 'playing') return;
    Game.state = 'paused';
    this.openShop('game');
  },
  resume() {
    this.hideAll();
    this.showHud(true);
    Game.state = 'playing';
    this.curScreen = 'game';
  },
  quitToMenu() {
    Game.state = 'idle';
    this.hideAll();
    this.showMenu();
  },
  showHud(on) {
    this.$.hud.classList.toggle('hidden', !on);
    this.$.controls.classList.toggle('hidden', !on);
    if (!on) { this.$.shopFab.classList.add('hidden'); this.$.compass.classList.add('hidden'); this.$.bossBar.classList.add('hidden'); }
  },

  // ---------- level select ----------
  renderGrid() {
    const grid = this.$.grid;
    grid.innerHTML = '';
    const per = 20;
    const start = this.page * per + 1;
    this.$.pageLabel.textContent = 'PETAK ' + start + '-' + (start + per - 1);
    const unlocked = Save.get().unlocked;
    const done = Save.get().done;
    for (let i = start; i < start + per; i++) {
      const cell = document.createElement('div');
      cell.className = 'lv-cell';
      const isBoss = isBossLevel(i);
      if (i <= unlocked) {
        cell.classList.add('unlocked');
        if (isBoss) cell.classList.add('boss');
        if (done.indexOf(i) >= 0) cell.classList.add('done');
        if (i === unlocked) cell.classList.add('current');
        cell.textContent = i;
        if (isBoss) {
          const tag = document.createElement('span');
          tag.className = 'boss-tag';
          tag.textContent = 'BOSS';
          cell.appendChild(tag);
        }
        cell.addEventListener('click', () => { AudioSys.play('click'); this.startLevel(i); });
      } else {
        cell.classList.add('locked');
        if (isBoss) cell.classList.add('boss');
        const img = document.createElement('img');
        img.src = 'assets/img/padlock.png';
        img.alt = 'terkunci';
        cell.appendChild(img);
        cell.title = 'Selesaikan petak ' + (i - 1);
      }
      grid.appendChild(cell);
    }
  },
  startLevel(n) {
    this.hideAll();
    this.showHud(true);
    Game.start(n);
  },

  // ---------- HUD ----------
  onLevelStart(game) {
    this.syncHud(game);
    this.$.hudLevel.textContent = (game.level.isBoss ? 'PENGUASA ' : 'PETAK ') + game.levelNum;
    this.$.bossBar.classList.toggle('hidden', !game.level.isBoss);
    if (game.level.isBoss && game.boss) this.syncBossBar(game.boss);
  },
  syncHud(game) {
    const p = game.player;
    if (!p) return;
    // nyawa
    let html = '';
    for (let i = 0; i < p.maxHp; i++) {
      html += '<img src="assets/img/heart.png" class="' + (i < p.hp ? '' : 'empty') + '" alt="hp">';
    }
    this.$.hearts.innerHTML = html;
    // stamina
    const pct = clamp(p.stam / p.stamMax, 0, 1);
    this.$.stamFill.style.width = (pct * 100).toFixed(1) + '%';
    this.$.stamFill.style.background = p.kopiT > 0 ? '#8ec95a' : 'var(--stam)';
    // koin
    this.$.coinCount.textContent = Save.get().coins + game.coinsRun;
  },
  syncBossBar(boss) {
    this.$.bossName.textContent = CFG.BOSS_INFO[boss.type].name;
    this.$.bossHpFill.style.width = (clamp(boss.hp / boss.maxHp, 0, 1) * 100) + '%';
  },
  hideBossBar() { this.$.bossBar.classList.add('hidden'); },

  tick(game) {
    if (Game.state !== 'playing' || !game.player) return;
    this._shopTick++;
    if (this._shopTick % 6 === 0) {
      this.syncHud(game);
      // tombol toko dekat warung
      const near = game.level.warung &&
        Math.abs(game.player.x - game.level.warung.x) < 52 && game.level.warung.x !== 0;
      this.$.shopFab.classList.toggle('hidden', !near || game.level.isBoss);
      // kompas ke portal
      const nearEnd = game.player.x > game.level.worldW * 0.62;
      this.$.compass.classList.toggle('hidden', !nearEnd || !game.portalOpen);
      if (nearEnd && game.portalOpen) {
        const dx = (game.level.portal.x + 20) - (game.player.x + 8);
        const dy = (game.level.portal.y) - (game.player.y);
        const ang = Math.atan2(dy, dx);
        this.$.compass.style.transform = 'translateX(-50%) rotate(' + ang.toFixed(2) + 'rad)';
      }
    }
  },

  // ---------- toko ----------
  openShop(from) {
    this.shopFrom = from;
    if (from === 'game') { Game.state = 'paused'; }
    this.hideAll();
    if (from === 'game') this.showHud(true);
    this.$.shop.classList.remove('hidden');
    this.renderShop();
    this.curScreen = 'shop';
  },
  closeShop() {
    this.hideAll();
    if (this.shopFrom === 'game' || this.shopFrom === 'pause') {
      this.$.pause.classList.remove('hidden');
      this.showHud(true);
      Game.state = 'paused';
    } else {
      this.showMenu();
    }
    this.curScreen = 'pause';
  },
  renderShop() {
    const box = document.getElementById('shop-items');
    box.innerHTML = '';
    const s = Save.get();
    document.getElementById('shop-coin-count').textContent = s.coins;
    for (const item of CFG.SHOP) {
      const div = document.createElement('div');
      div.className = 'shop-item' + (item.kind.startsWith('up-') ? ' upgrade' : '');
      const img = document.createElement('img');
      img.src = 'assets/img/' + item.icon + '.png';
      img.alt = item.name;
      const info = document.createElement('div');
      info.className = 'si-info';
      info.innerHTML = '<div class="si-name">' + item.name + '</div><div class="si-desc">' + item.desc + '</div>';
      div.appendChild(img); div.appendChild(info);
      const owned = this._owned(item);
      if (owned) {
        const sp = document.createElement('div');
        sp.className = 'si-owned';
        sp.textContent = item.kind === 'up-heart' ? 'MAKS ' + Save.maxHp() : 'TERPASANG';
        div.appendChild(sp);
      } else {
        const btn = document.createElement('button');
        btn.className = 'si-buy';
        btn.textContent = item.price + ' KOIN';
        btn.disabled = s.coins < item.price;
        btn.addEventListener('click', () => this.buy(item, btn));
        div.appendChild(btn);
      }
      box.appendChild(div);
    }
  },
  _owned(item) {
    const up = Save.get().up;
    if (item.kind === 'up-stam') return up.stam2;
    if (item.kind === 'up-jump') return up.jump;
    if (item.kind === 'up-speed') return up.speed;
    if (item.kind === 'up-heart') return Save.maxHp() >= CFG.HP_MAX;
    return false;
  },
  buy(item, btn) {
    const game = Game;
    if (!Save.buy(item.price)) { AudioSys.play('err'); return; }
    AudioSys.play('buy');
    switch (item.kind) {
      case 'heal':
        if (game.player && game.state !== 'idle') { game.player.hp = game.player.maxHp; }
        this.toast('Jamu diminum. Segar kembali!', 'gold');
        break;
      case 'kopi':
        if (game.player && game.state !== 'idle') {
          game.player.stam = game.player.stamMax;
          game.player.kopiT = 30;
        }
        this.toast('Kopi tubruk! Stamina menyala 30 dtk', 'gold');
        break;
      case 'up-stam':
        Save.get().up.stam2 = true; Save.commit();
        if (game.player) { game.player.stamMax = Save.stamMax(); game.player.stam = game.player.stamMax; }
        this.toast('Roh kelapa menyatu: stamina 2x', 'gold');
        break;
      case 'up-jump':
        Save.get().up.jump = true; Save.commit();
        this.toast('Bulu rajawali: lompat lebih tinggi', 'gold');
        break;
      case 'up-speed':
        Save.get().up.speed = true; Save.commit();
        this.toast('Sandal angin: lari lebih cepat', 'gold');
        break;
      case 'up-heart':
        Save.get().up.hearts = Math.min((Save.get().up.hearts || 0) + 1, CFG.HP_MAX - CFG.HP_BASE);
        Save.commit();
        if (game.player) { game.player.maxHp = Save.maxHp(); game.player.hp = game.player.maxHp; }
        this.toast('Jantung waja berdetak lebih kuat', 'gold');
        break;
    }
    this.renderShop();
    this.refreshMenuCoins();
    if (game.player) this.syncHud(game);
  },

  // ---------- menang / gugur ----------
  showVictory(game, bonus) {
    this.hideAll();
    this.showHud(false);
    document.getElementById('v-coin-run').textContent = game.coinsRun;
    document.getElementById('v-coin-bonus').textContent = '+' + bonus;
    document.getElementById('v-coin-total').textContent = Save.get().coins;
    document.getElementById('victory-title').textContent =
      game.level.isBoss ? 'PENGUASA TUMBANG!' : 'PETAK SELESAI';
    const nb = document.getElementById('btn-next-level');
    nb.textContent = 'PETAK ' + (game.levelNum + 1);
    this.$.victory.classList.remove('hidden');
  },
  showDeath(cause) {
    const txt = {
      lava: 'Jatuh ke lava panas', swamp: 'Tenggelam di rawa beracun',
      spike: 'Tertusuk ranjau bambu', enemy: 'Ditaklukkan makhluk halus',
      pit: 'Jatuh ke jurang',
    }[cause] || 'Gugur di medan perang';
    document.getElementById('death-cause').textContent = txt;
    this.$.death.classList.remove('hidden');
  },
  hideDeath() { this.$.death.classList.add('hidden'); },
  showBossIntro(name, sub) {
    document.getElementById('boss-intro-name').textContent = name;
    document.getElementById('boss-intro-sub').textContent = sub;
    this.$.bossintro.classList.remove('hidden');
    AudioSys.play('boss');
    AudioSys.vibe([80, 60, 120]);
    setTimeout(() => this.$.bossintro.classList.add('hidden'), 1900);
  },

  // ---------- toast ----------
  toast(msg, cls) {
    const el = document.createElement('div');
    el.className = 'toast ' + (cls || '');
    el.textContent = msg;
    this.$.toasts.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 1600);
    setTimeout(() => el.remove(), 2000);
  },

  // tombol back Android
  nativeBack() {
    if (this.curScreen === 'game' || Game.state === 'playing') { this.pause(); return; }
    if (this.curScreen === 'levels' || this.curScreen === 'settings') { this.showMenu(); return; }
    if (this.curScreen === 'shop') { this.closeShop(); return; }
    if (this.curScreen === 'pause') { this.resume(); return; }
  },
};
