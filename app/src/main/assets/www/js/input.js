// ===== Input: tombol sentuh multi-pointer + keyboard =====
const Input = (() => {
  const state = { left: false, right: false, jump: false, dash: false, jumpPressed: false, dashPressed: false };
  const pointers = {};   // pointerId -> button key
  let prevJump = false, prevDash = false;

  function press(key, on) {
    if (state[key] === on) return;
    state[key] = on;
    if (on && key === 'jump') state.jumpPressed = true;
    if (on && key === 'dash') state.dashPressed = true;
  }

  function bindButton(el, key) {
    const setVisual = (on) => { el.classList.toggle('pressed', on); };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (pointers[e.pointerId] !== undefined) return;
      pointers[e.pointerId] = key;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      press(key, true); setVisual(true);
    });
    const release = (e) => {
      if (pointers[e.pointerId] !== key) return;
      delete pointers[e.pointerId];
      press(key, false); setVisual(false);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', (e) => {
      if (pointers[e.pointerId] === key) { delete pointers[e.pointerId]; press(key, false); setVisual(false); }
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function init() {
    bindButton(document.getElementById('btn-left'), 'left');
    bindButton(document.getElementById('btn-right'), 'right');
    bindButton(document.getElementById('btn-jump'), 'jump');
    bindButton(document.getElementById('btn-dash'), 'dash');

    // keyboard (untuk pengujian desktop)
    const map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump', Shift: 'dash', k: 'dash', K: 'dash' };
    window.addEventListener('keydown', (e) => {
      const k = map[e.key];
      if (k) { e.preventDefault(); press(k, true); }
    });
    window.addEventListener('keyup', (e) => {
      const k = map[e.key];
      if (k) { e.preventDefault(); press(k, false); }
    });
  }

  // dipanggil sekali per frame di akhir update game (setelah fisika konsumsi)
  function endFrame() {
    // jumpPressed/dashPressed dikonsumsi langsung oleh fisika (Game.consumeJump)
    // di sini hanya menyimpan status untuk debug/visual bila diperlukan
  }

  function consumeJump() { const v = state.jumpPressed; state.jumpPressed = false; return v; }
  function consumeDash() { const v = state.dashPressed; state.dashPressed = false; return v; }

  return { init, state, endFrame, consumeJump, consumeDash };
})();
