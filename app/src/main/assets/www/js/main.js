// ===== Bootstrap: layar, loop utama, resize, fullscreen =====
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let last = 0, acc = 0;
  const STEP = 1 / 60;
  let started = false;

  // ---- boot & progress aset ----
  UI.init();
  Input.init();
  Assets.load(() => {
    // fade out boot screen
    const bootFill = document.getElementById('boot-fill');
    bootFill.style.width = '100%';
    setTimeout(() => {
      UI.hideAll();
      UI.showMenu();
    }, 250);
    requestAnimationFrame(loop);
  }, (p) => {
    document.getElementById('boot-fill').style.width = Math.round(p * 100) + '%';
  });

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    // fisika langkah tetap
    let guard = 0;
    while (acc >= STEP && guard < 5) {
      if (Game.state === 'playing') Game.update(STEP);
      acc -= STEP; guard++;
    }
    if (guard >= 5) acc = 0;
    if (Game.state !== 'idle') {
      Game.render(ctx);
      UI.tick(Game);
    } else {
      // latar menu: gambar pemandangan dari level 1 sebagai dekorasi
      renderMenuBackdrop();
    }
  }

  let menuLevel = null;
  function renderMenuBackdrop() {
    if (!menuLevel) {
      menuLevel = Gen.genLevel(1);
      menuLevel.worldW *= CFG.TILE; menuLevel.worldH = CFG.WORLD_H_TILES * CFG.TILE;
    }
    const t = performance.now() / 1000;
    ctx.imageSmoothingEnabled = false;
    World.bg(ctx, menuLevel, 40 + t * 6, 0, t);
    ctx.save();
    ctx.translate(0, CFG.VIEW_H - menuLevel.worldH);
    World.tiles(ctx, menuLevel, 0, 0);
    World.portal(ctx, menuLevel, 0, 0, t, true);
    ctx.restore();
  }

  // ---- resize: jaga rasio 16:9, letterbox ----
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const scale = Math.min(w / CFG.VIEW_W, h / CFG.VIEW_H);
    canvas.style.width = Math.round(CFG.VIEW_W * scale) + 'px';
    canvas.style.height = Math.round(CFG.VIEW_H * scale) + 'px';
    // posisi tengah
    canvas.style.left = Math.round((w - CFG.VIEW_W * scale) / 2) + 'px';
    canvas.style.top = Math.round((h - CFG.VIEW_H * scale) / 2) + 'px';
    canvas.style.position = 'absolute';
    // hint rotasi bila portrait di browser/WebView
    const portrait = h > w;
    document.getElementById('rotate-hint').classList.toggle('hidden', !portrait);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  resize();

  // ---- fullscreen di browser (WebView Android sudah immersive via Kotlin) ----
  function tryFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    AudioSys.ensure();       // bangunkan audio pada gesture pertama
    if (!started) { started = true; AudioSys.startMusic('calm'); }
  }
  window.addEventListener('pointerdown', tryFullscreen, { once: false });

  // ---- jeda otomatis saat tab/WebView tidak aktif ----
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && Game.state === 'playing') UI.pause();
  });

  // tombol back native dari Kotlin
  window.onNativeBack = () => {
    if (Game.state === 'playing') UI.pause();
    else UI.nativeBack();
  };

  // blokir zoom dua jari & scroll
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
})();
