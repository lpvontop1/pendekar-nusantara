// ===== Audio: SFX sintesis + musik gamelan (WebAudio, tanpa file) =====
const AudioSys = (() => {
  let ctx = null, master, musicGain, sfxGain;
  let musicTimer = null, nextNoteT = 0, step = 0, curTrack = 'menu';
  const SLEN = [1, 1.125, 1.25, 1.5, 1.6667];           // approx laras slendro
  const BASE = 220;                                      // A3

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    applySettings();
    return ctx;
  }
  function applySettings() {
    if (!ctx) return;
    musicGain.gain.value = Save.get().set.music ? 0.34 : 0;
    sfxGain.gain.value = Save.get().set.sfx ? 0.9 : 0;
  }

  // ---- instrumen gamelan sederhana ----
  function metal(freq, t, dur, vol) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sine'; o.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq * 2.76;   // partial logam
    const g2 = ctx.createGain(); g2.gain.value = 0.22;
    f.type = 'bandpass'; f.frequency.value = freq * 1.2; f.Q.value = 1.1;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(musicGain);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
  }
  function gong(t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = BASE / 2;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 2.3);
  }
  function kendang(t, hard) {
    const buf = ctx.createBuffer(1, 2205, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 300);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = hard ? 420 : 260;
    const g = ctx.createGain(); g.gain.value = hard ? 0.5 : 0.3;
    s.connect(f); f.connect(g); g.connect(musicGain);
    s.start(t);
  }
  const MELODY = [0, 2, 1, 2, 4, 2, 1, 0, 3, 2, 1, 2, 0, 1, 2, 4,
                  0, 2, 1, 2, 4, 2, 1, 0, 3, 4, 3, 2, 1, 0, 1, 0];
  const MELODY_BOSS = [4, 3, 4, 2, 3, 1, 4, 3, 2, 1, 2, 3, 4, 3, 2, 1,
                       4, 3, 4, 2, 3, 1, 4, 4, 3, 2, 1, 0, 1, 2, 3, 4];
  function schedule() {
    if (!ctx) return;
    const boss = curTrack === 'boss';
    const stepDur = (60 / (boss ? 126 : 84)) / 2;   // not per ketuk
    while (nextNoteT < ctx.currentTime + 0.35) {
      const t = Math.max(nextNoteT, ctx.currentTime + 0.02);
      const mel = boss ? MELODY_BOSS : MELODY;
      const idx = step % 32;
      if (mel[idx] >= 0) {
        const freq = BASE * SLEN[mel[idx]] * (boss ? 1.5 : 1);
        metal(freq, t, stepDur * 1.9, boss ? 0.16 : 0.13);
        if (idx % 2 === 0) metal(freq * 2, t, stepDur, 0.05);   // pamurba
      }
      if (idx % 8 === 0) gong(t, boss ? 0.30 : 0.22);
      if (boss ? (idx % 4 === 2 || idx % 8 === 5) : (idx % 4 === 2)) kendang(t, idx % 8 === 5);
      nextNoteT += stepDur;
      step++;
    }
  }
  function startMusic(track) {
    if (!ensure()) return;
    curTrack = track || 'calm';
    step = 0;
    nextNoteT = ctx.currentTime + 0.06;
    if (!musicTimer) musicTimer = setInterval(schedule, 120);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  // ---- SFX ----
  function tone(f0, f1, dur, type, vol, when) {
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, fLo, fHi) {
    const t = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.4));
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = (fLo + fHi) / 2; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(sfxGain);
    s.start(t);
  }
  const SFX = {
    click:   () => tone(660, 520, 0.06, 'square', 0.16),
    back:    () => tone(420, 300, 0.07, 'square', 0.14),
    jump:    () => tone(300, 620, 0.14, 'square', 0.16),
    dash:    () => noise(0.16, 0.24, 500, 2400),
    land:    () => noise(0.06, 0.14, 80, 300),
    coin:    () => { tone(920, 920, 0.05, 'sine', 0.2); tone(1380, 1380, 0.09, 'sine', 0.18, 0.05); },
    stomp:   () => { noise(0.08, 0.2, 100, 400); tone(200, 90, 0.1, 'square', 0.18); },
    hurt:    () => tone(320, 110, 0.18, 'sawtooth', 0.22),
    die:     () => { tone(420, 60, 0.5, 'sawtooth', 0.24); noise(0.3, 0.16, 60, 300); },
    lava:    () => { noise(0.3, 0.24, 200, 900); tone(180, 40, 0.35, 'sawtooth', 0.2); },
    check:   () => { tone(520, 520, 0.09, 'sine', 0.2); tone(660, 660, 0.09, 'sine', 0.2, 0.09); tone(880, 880, 0.16, 'sine', 0.2, 0.18); },
    portal:  () => { tone(220, 880, 0.5, 'sine', 0.18); tone(330, 1320, 0.5, 'sine', 0.12, 0.08); },
    buy:     () => { tone(700, 700, 0.06, 'square', 0.16); tone(1050, 1050, 0.1, 'square', 0.14, 0.07); },
    err:     () => tone(200, 150, 0.14, 'square', 0.18),
    enemyDie:() => { noise(0.1, 0.2, 300, 1200); tone(500, 120, 0.14, 'square', 0.14); },
    fire:    () => noise(0.2, 0.14, 200, 700),
    boss:    () => { tone(120, 40, 0.8, 'sawtooth', 0.3); tone(90, 55, 0.9, 'square', 0.2, 0.05); },
    bossHit: () => { noise(0.1, 0.26, 150, 500); tone(160, 70, 0.16, 'square', 0.22); },
    bossDie: () => { tone(300, 50, 0.9, 'sawtooth', 0.3); gong(ctx.currentTime, 0.4); },
    heal:    () => { tone(600, 900, 0.12, 'sine', 0.16); tone(900, 1200, 0.12, 'sine', 0.14, 0.1); },
  };
  function play(name) {
    if (!Save.get().set.sfx) return;
    if (!ensure()) return;
    if (SFX[name]) SFX[name]();
  }
  function vibe(pattern) {
    if (Save.get().set.vibe && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }
  return { ensure, play, startMusic, stopMusic, applySettings, vibe };
})();
