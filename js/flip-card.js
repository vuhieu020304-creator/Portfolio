/* =========================================================
   THẺ ẢNH LẬT
   Chuyển sang JavaScript thuần từ FlipCard của React Bits
   (giấy phép xem LICENSES/react-bits.md).
   Đã đổi: tự tính lò xo thay cho thư viện motion, thêm hàm set()
   để nút Tối/Sáng và thẻ luôn khớp nhau.
   ========================================================= */

(function () {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const snap = deg => Math.round(deg / 180) * 180;
  const isBack = deg => Math.abs(Math.round(deg / 180)) % 2 === 1;
  const FLING = 0.16, HISTORY_MS = 90;

  // một bước của lò xo: giá trị bị kéo về đích, có giảm chấn
  function spring(s, target, stiffness, damping, dt) {
    s.v += (-stiffness * (s.x - target) - damping * s.v) * dt;
    s.x += s.v * dt;
  }
  const settled = (s, target, eps) => Math.abs(s.x - target) < eps && Math.abs(s.v) < eps;

  // options: { flipped, onFlipChange(flipped), tiltMax, hoverScale, perspective, stiffness, damping }
  window.createFlipCard = function (root, options) {
    const { tiltMax = 10, hoverScale = 1.03, perspective = 1100, stiffness = 170, damping = 20, onFlipChange } = options;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rotor = root.querySelector('.flip-card__rotor');
    const shadow = root.querySelector('.flip-card__shadow');
    const faces = { front: root.querySelector('.flip-card__face--front'), back: root.querySelector('.flip-card__face--back') };

    let shown = !!options.flipped;
    let grip = null, raf = 0, last = 0;
    const turn = { x: shown ? 180 : 0, v: 0 }, tiltX = { x: 0, v: 0 }, tiltY = { x: 0, v: 0 }, lift = { x: 1, v: 0 };
    let turnTarget = turn.x, tiltXTo = 0, tiltYTo = 0, liftTo = 1, sheen = 0;

    function draw() {
      if (reduce) return;
      rotor.style.transform = `perspective(${perspective}px) scale(${lift.x.toFixed(4)}) rotateX(${tiltX.x.toFixed(2)}deg) rotateY(${(turn.x + tiltY.x).toFixed(2)}deg)`;
      const facing = Math.abs(Math.cos(turn.x * Math.PI / 180));
      shadow.style.transform = `scaleX(${(0.08 + 0.92 * facing).toFixed(3)})`;
      shadow.style.opacity = (0.1 + 0.9 * facing * facing).toFixed(3);
      root.style.setProperty('--fc-sheen', sheen);
    }
    function syncState() {
      root.setAttribute('aria-pressed', shown);
      faces.front.setAttribute('aria-hidden', shown);
      faces.back.setAttribute('aria-hidden', !shown);
      if (reduce) root.dataset.fade = shown ? 'back' : 'front';
    }

    function frame(now) {
      raf = 0;
      const dt = last ? clamp((now - last) / 1000, 0, 1 / 30) : 1 / 60;
      last = now;
      if (!(grip && grip.moved)) spring(turn, turnTarget, stiffness, damping, dt);
      spring(tiltX, tiltXTo, 240 / 0.6, 24 / 0.6, dt);
      spring(tiltY, tiltYTo, 240 / 0.6, 24 / 0.6, dt);
      spring(lift, liftTo, 320, 26, dt);
      draw();
      const moving = (grip && grip.moved) || !settled(turn, turnTarget, 0.05) || !settled(tiltX, tiltXTo, 0.02) ||
        !settled(tiltY, tiltYTo, 0.02) || !settled(lift, liftTo, 0.001);
      if (moving) raf = requestAnimationFrame(frame);
      else { turn.x = turnTarget; turn.v = 0; last = 0; draw(); }
    }
    function wake() {
      if (!raf && !reduce) { last = 0; raf = requestAnimationFrame(frame); }
    }

    // chạy về một mặt; notify = true khi do người dùng lật
    function settle(to, velocity, notify) {
      turnTarget = to;
      turn.v = velocity;
      const next = isBack(to);
      if (next !== shown) {
        shown = next;
        syncState();
        if (notify && onFlipChange) onFlipChange(shown);
      }
      wake();
    }
    function flip() {
      const base = snap(turnTarget);
      settle(isBack(base) ? base - 180 : base + 180, 0, true);
    }
    function rest() {
      tiltXTo = 0; tiltYTo = 0; sheen = 0; liftTo = 1;
      root.style.setProperty('--fc-sheen', 0);
      wake();
    }

    root.addEventListener('pointerdown', e => {
      if (e.button !== 0 || grip) return;
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
      grip = { id: e.pointerId, x: e.clientX, base: turn.x, moved: false, slop: e.pointerType === 'touch' ? 8 : 4, hist: [] };
      if (!reduce) { liftTo = hoverScale; wake(); }
    });
    root.addEventListener('pointermove', e => {
      if (grip && grip.id === e.pointerId) {
        const d = e.clientX - grip.x;
        if (!grip.moved) {
          if (Math.abs(d) < grip.slop || reduce) return;
          grip.moved = true;
          root.setAttribute('data-dragging', '');
          tiltXTo = 0; tiltYTo = 0; sheen = 0;
        }
        const deg = grip.base + d / root.offsetWidth * 180;     // kéo hết bề ngang thẻ = lật nửa vòng
        turn.x = deg; turn.v = 0;
        const now = performance.now();
        grip.hist.push({ t: now, v: deg });
        while (grip.hist.length > 2 && now - grip.hist[0].t > HISTORY_MS) grip.hist.shift();
        wake();
        return;
      }
      if (reduce || e.pointerType === 'touch') return;
      // thẻ nghiêng và ánh sáng chạy theo con trỏ
      const r = root.getBoundingClientRect();
      const px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1);
      tiltXTo = (0.5 - py) * 2 * tiltMax;
      tiltYTo = (px - 0.5) * 2 * tiltMax;
      root.style.setProperty('--fc-gx', px * 100 + '%');
      root.style.setProperty('--fc-gy', py * 100 + '%');
      sheen = 1;
      wake();
    });
    function release(e, cancelled) {
      if (!grip || grip.id !== e.pointerId) return;
      const g = grip;
      grip = null;
      try { if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId); } catch (err) {}
      root.removeAttribute('data-dragging');
      if (e.pointerType === 'touch' || !root.matches(':hover')) rest();
      if (!g.moved) {
        if (!cancelled) flip();
        return;
      }
      // thả tay: về mặt gần nhất, tính cả đà hất
      const here = turn.x;
      let velocity = 0;
      const a = g.hist[0], b = g.hist[g.hist.length - 1];
      if (!cancelled && a && b && b.t > a.t && performance.now() - b.t < 60) velocity = (b.v - a.v) / (b.t - a.t) * 1000;
      const to = cancelled ? snap(g.base) : clamp(snap(here + velocity * FLING), snap(here) - 180, snap(here) + 180);
      settle(to, velocity, true);
    }
    root.addEventListener('pointerup', e => release(e, false));
    root.addEventListener('pointercancel', e => release(e, true));
    root.addEventListener('lostpointercapture', e => release(e, true));
    root.addEventListener('pointerenter', e => { if (!reduce && e.pointerType !== 'touch') { liftTo = hoverScale; wake(); } });
    root.addEventListener('pointerleave', () => { if (!grip) rest(); });
    root.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!e.repeat) flip();
    });
    root.addEventListener('dragstart', e => e.preventDefault());

    syncState();
    draw();

    return {
      // gọi từ nút Tối/Sáng; không báo ngược lại để khỏi lặp
      set(flipped) {
        if (flipped === shown) return;
        const base = snap(turnTarget);
        settle(isBack(base) ? base - 180 : base + 180, 0, false);
      }
    };
  };
})();
