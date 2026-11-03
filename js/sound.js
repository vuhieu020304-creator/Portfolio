/* =========================================================
   ÂM THANH TƯƠNG TÁC (sound.js)
   Mọi tiếng đều được tạo bằng Web Audio API ngay trong trình duyệt,
   không dùng file âm thanh nào, nên không lo bản quyền và tải rất nhẹ.
   Dùng: SFX.play('click'), SFX.setEnabled(true/false), SFX.enabled
   Trình duyệt chỉ cho phát tiếng sau lần bấm hoặc gõ phím đầu tiên.
   ========================================================= */
(function () {
  const KEY = 'vvh_sound';
  let ctx = null, master = null;
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) {}

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;                    // âm lượng chung, để nhỏ cho dễ chịu
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Một nốt đơn: dạng sóng, tần số (có thể trượt), độ dài, âm lượng
  function tone({ type = 'sine', f = 440, f2 = null, t = 0, dur = 0.1, vol = 0.5, attack = 0.005 }) {
    const a = ctx, now = a.currentTime + t;
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, now);
    if (f2) osc.frequency.exponentialRampToValueAtTime(f2, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g).connect(master);
    osc.start(now); osc.stop(now + dur + 0.02);
  }

  // Tiếng "xì" ngắn từ nhiễu trắng, lọc qua bộ lọc để thành tiếng gió
  function noise({ t = 0, dur = 0.25, vol = 0.3, from = 400, to = 3000, q = 1.2 }) {
    const a = ctx, now = a.currentTime + t;
    const len = Math.ceil(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = buf;
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(from, now);
    bp.frequency.exponentialRampToValueAtTime(to, now + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(g).connect(master);
    src.start(now); src.stop(now + dur);
  }

  const SOUNDS = {
    hover:  () => tone({ type: 'sine', f: 1800, dur: 0.035, vol: 0.12 }),
    key:    () => tone({ type: 'square', f: 900 + Math.random() * 500, dur: 0.018, vol: 0.05 }),
    click:  () => { tone({ type: 'triangle', f: 660, dur: 0.06, vol: 0.4 }); tone({ type: 'triangle', f: 990, t: 0.04, dur: 0.08, vol: 0.3 }); },
    open:   () => { noise({ dur: 0.28, vol: 0.18, from: 300, to: 2600 }); tone({ type: 'sine', f: 440, f2: 880, dur: 0.22, vol: 0.25 }); },
    back:   () => { noise({ dur: 0.26, vol: 0.16, from: 2600, to: 300 }); tone({ type: 'sine', f: 880, f2: 330, dur: 0.22, vol: 0.22 }); },
    tab:    () => tone({ type: 'triangle', f: 1200, f2: 1500, dur: 0.05, vol: 0.22 }),
    filter: () => { tone({ type: 'square', f: 520, dur: 0.04, vol: 0.12 }); tone({ type: 'square', f: 780, t: 0.05, dur: 0.05, vol: 0.12 }); },
    run:    () => [0, 1, 2, 3].forEach(i => tone({ type: 'square', f: 300 + i * 120, t: i * 0.045, dur: 0.035, vol: 0.1 })),
    themeDark:  () => { tone({ type: 'sine', f: 520, f2: 260, dur: 0.3, vol: 0.3 }); noise({ dur: 0.3, vol: 0.08, from: 1800, to: 400 }); },
    themeLight: () => { tone({ type: 'sine', f: 260, f2: 620, dur: 0.3, vol: 0.3 }); noise({ dur: 0.3, vol: 0.08, from: 400, to: 2400 }); },
    success: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.08, dur: 0.35, vol: 0.28 })),
    error:  () => { tone({ type: 'sawtooth', f: 160, dur: 0.12, vol: 0.18 }); tone({ type: 'sawtooth', f: 120, t: 0.13, dur: 0.16, vol: 0.18 }); },
    boot:   () => {
      [261.63, 392, 523.25, 783.99].forEach((f, i) => tone({ type: 'sine', f, t: i * 0.09, dur: 0.6, vol: 0.22, attack: 0.02 }));
      noise({ dur: 0.5, vol: 0.06, from: 200, to: 4000 });
    }
  };

  // Chặn phát dồn dập (ví dụ rê chuột qua nhiều thẻ một lúc)
  const last = {};
  const GAP = { hover: 60, key: 25 };

  window.SFX = {
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = on;
      try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
      if (on) this.play('click');
    },
    play(name) {
      if (!enabled || !SOUNDS[name]) return;
      // chưa có tương tác nào thì trình duyệt chưa cho phát, bỏ qua lặng lẽ
      if (!ctx && !navigator.userActivation?.hasBeenActive) return;
      const now = performance.now();
      if (last[name] && now - last[name] < (GAP[name] || 0)) return;
      last[name] = now;
      try { if (audio()) SOUNDS[name](); } catch (e) {}
    }
  };
})();
