/* =========================================================
   QUỸ ĐẠO THẺ BẢNG
   Chuyển sang JavaScript thuần từ OrbitImages của React Bits
   (tác giả Dominik Koch, giấy phép xem LICENSES/react-bits.md).
   Đã đổi: chỉ giữ đường elip, thẻ là nội dung HTML thay vì ảnh,
   thêm chấm dữ liệu chạy trên đường, không cần React.
   ========================================================= */

(function () {
  const SAMPLES = 720;          // số điểm lấy mẫu trên đường elip
  const FRONT_GROW = 0.3;       // thẻ phía trước to lên
  const BACK_SHRINK = 0.45;     // thẻ phía sau nhỏ lại
  const BACK_DIM = 0.55;        // thẻ phía sau mờ đi
  const INTRO_SPREAD = 1.3;     // thời gian xòe thẻ lúc mở (giây)
  const INTRO_FADE = 0.45;
  const DRAG_THRESHOLD = 5;     // kéo quá 5px mới tính là kéo

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const wrapSigned = v => v - Math.round(v);
  const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
  const ellipsePath = (cx, cy, rx, ry) =>
    `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
  const NS = 'http://www.w3.org/2000/svg';

  // options: { items: [{ html, label }], center: Element, getConfig(): cấu hình theo màn hình, onItemClick(index, chờ_giây) }
  window.createOrbit = function (root, options) {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    let cfg = options.getConfig();
    const st = {
      lut: null, length: 0, front: 0, yMid: 0, yHalf: 1, bbox: [0, 0, 1, 1],
      width: 0, height: 0, scale: 0, sizeW: 0, sizeH: 0,
      items: [], strokes: [],
      lap: 0, manual: 0, placed: false, glide: 0, speed: 1,
      drag: null, seek: null, hovered: false, hoverIndex: -1, suppressUntil: 0,
      introStart: -1, introDone: false,
      visible: false, reduced: query.matches, raf: 0, last: 0
    };
    st.speed = st.reduced ? 0 : 1;

    /* ---------- Dựng DOM ---------- */
    root.classList.add('orbit-container');
    root.setAttribute('data-intro', '');
    root.setAttribute('data-draggable', '');

    const clipId = 'orbit-clip-' + Math.random().toString(36).slice(2, 8);
    root.innerHTML = `
      <svg class="orbit-path-svg" data-orbit-svg preserveAspectRatio="none" style="z-index:0" aria-hidden="true">
        <path data-orbit-path data-orbit-stroke class="orbit-line" fill="none" stroke-linecap="round"></path>
        <g data-orbit-packets></g>
      </svg>
      <svg class="orbit-path-svg" data-orbit-svg preserveAspectRatio="none" style="z-index:105" aria-hidden="true">
        <defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect data-orbit-clip></rect></clipPath></defs>
        <g clip-path="url(#${clipId})"><path data-orbit-stroke class="orbit-line" fill="none" stroke-linecap="round"></path></g>
      </svg>`;

    options.items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'orbit-item';
      el.dataset.orbitItem = i;
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.setAttribute('aria-label', item.label);
      el.innerHTML = `<div class="orbit-item-inner">${item.html}</div>`;
      root.append(el);
    });

    const centerBox = document.createElement('div');
    centerBox.className = 'orbit-center-content';
    centerBox.dataset.orbitCenter = '';
    centerBox.append(options.center);
    root.append(centerBox);

    st.items = [...root.querySelectorAll('[data-orbit-item]')].map(el => ({ el, t: '', o: '', z: '' }));
    st.strokes = [...root.querySelectorAll('[data-orbit-stroke]')];

    /* ---------- Lấy mẫu đường elip thành bảng tọa độ ---------- */
    function build() {
      cfg = options.getConfig();
      const center = cfg.baseWidth / 2;
      const d = ellipsePath(center, center, cfg.radiusX, cfg.radiusY);
      const rotate = `rotate(${cfg.rotation} ${center} ${center})`;
      st.strokes.forEach(s => { s.setAttribute('d', d); s.setAttribute('transform', rotate); });

      // chấm dữ liệu chạy dọc đường
      const packets = root.querySelector('[data-orbit-packets]');
      packets.setAttribute('transform', rotate);
      packets.innerHTML = '';
      if (!st.reduced) {
        [0, 1, 2].forEach(i => {
          const dot = document.createElementNS(NS, 'circle');
          dot.setAttribute('r', cfg.packetSize);
          dot.setAttribute('class', 'orbit-packet');
          const motion = document.createElementNS(NS, 'animateMotion');
          motion.setAttribute('dur', cfg.duration / 3 + 's');
          motion.setAttribute('begin', (-i * cfg.duration / 9) + 's');
          motion.setAttribute('repeatCount', 'indefinite');
          motion.setAttribute('path', d);
          dot.append(motion);
          packets.append(dot);
        });
      }

      const path = root.querySelector('[data-orbit-path]');
      let length = 0;
      try { length = path.getTotalLength(); } catch (e) { length = 0; }
      if (!length || !isFinite(length)) { st.lut = null; return; }   // đang bị ẩn: dựng lại khi hiện

      const lut = new Float32Array(SAMPLES * 2);
      const angle = cfg.rotation * Math.PI / 180;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, front = 0;
      for (let i = 0; i < SAMPLES; i++) {
        const p = path.getPointAtLength(i / SAMPLES * length);
        const dx = p.x - center, dy = p.y - center;
        const x = center + dx * cos - dy * sin;
        const y = center + dx * sin + dy * cos;
        lut[i * 2] = x; lut[i * 2 + 1] = y;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        if (y > lut[front * 2 + 1] + 1e-6) front = i;
      }
      st.lut = lut;
      st.length = length;
      st.front = front / SAMPLES;
      st.yMid = (y0 + y1) / 2;
      st.yHalf = Math.max(1e-3, (y1 - y0) / 2);
      const grow = (1 + clamp(cfg.depth, 0, 1) * FRONT_GROW) * Math.max(1, cfg.hoverScale);
      const mx = cfg.itemW / 2 * grow + 2, my = cfg.itemH / 2 * grow + 2;
      st.bbox = [x0 - mx, y0 - my, x1 + mx, y1 + my];
      if (!st.placed) { st.manual = st.front; st.placed = true; }     // thẻ đầu tiên (ho_so) đứng phía trước
    }

    function layout() {
      st.width = root.clientWidth;
      st.height = root.clientHeight;
      if (!st.lut) return;
      const [bx0, by0, bx1, by1] = st.bbox;
      const scale = Math.min(st.width / (bx1 - bx0), st.height / (by1 - by0));
      st.scale = scale > 0 && isFinite(scale) ? scale : 0;
      st.sizeW = cfg.itemW * st.scale;
      st.sizeH = cfg.itemH * st.scale;
      st.items.forEach(it => {
        it.el.style.width = st.sizeW + 'px';
        it.el.style.height = st.sizeH + 'px';
        it.el.style.fontSize = st.sizeW / 12 + 'px';   // chữ trong thẻ co giãn theo cỡ thẻ
      });
      if (!st.scale) return;
      const vw = st.width / st.scale, vh = st.height / st.scale;
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      root.querySelectorAll('[data-orbit-svg]').forEach(svg => {
        svg.setAttribute('viewBox', `${cx - vw / 2} ${cy - vh / 2} ${vw} ${vh}`);
      });
      const clip = root.querySelector('[data-orbit-clip]');
      clip.setAttribute('x', cx - vw);
      clip.setAttribute('y', st.yMid);
      clip.setAttribute('width', vw * 2);
      clip.setAttribute('height', vh * 2);
      st.strokes.forEach(s => { s.style.strokeWidth = cfg.pathWidth / st.scale; });
      applyDash(1);
    }

    function applyDash(reveal) {
      const dash = cfg.pathDash > 0 && st.scale ? cfg.pathDash / st.scale : 0;
      st.strokes.forEach(s => {
        s.style.strokeDasharray = dash ? `${dash} ${dash * 1.6}` : '';
        s.style.opacity = reveal < 1 ? reveal : '';
      });
    }

    function sample(u) {
      const f = (((u % 1) + 1) % 1) * SAMPLES;
      const i0 = Math.floor(f) % SAMPLES, i1 = (i0 + 1) % SAMPLES;
      const t = f - Math.floor(f), lut = st.lut;
      return [lut[i0 * 2] + (lut[i1 * 2] - lut[i0 * 2]) * t, lut[i0 * 2 + 1] + (lut[i1 * 2 + 1] - lut[i0 * 2 + 1]) * t];
    }

    const progress = () => st.lap + st.manual;
    const offsetOf = (index, count) => index / Math.max(1, count);

    function write(it, key, prop, value) {
      if (it[key] !== value) { it[key] = value; it.el.style[prop] = value; }
    }

    /* ---------- Vẽ một khung hình ---------- */
    function render(now) {
      if (!st.lut || !st.scale) return;
      const p = progress(), count = st.items.length, depth = clamp(cfg.depth, 0, 1);
      const [bx0, by0, bx1, by1] = st.bbox;
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      const intro = st.introStart >= 0;
      const elapsed = intro ? (now - st.introStart) / 1000 : 0;
      const spread = intro ? easeOutQuint(clamp(elapsed / INTRO_SPREAD, 0, 1)) : 1;
      const appear = intro ? clamp(elapsed / INTRO_FADE, 0, 1) : 1;
      st.items.forEach((it, i) => {
        let u = p + offsetOf(i, count);
        if (intro) u = st.front + wrapSigned(u - st.front) * spread;
        const [x, y] = sample(u);
        const d = clamp((y - st.yMid) / st.yHalf, -1, 1), w = (d + 1) / 2;
        let scale = 1 + depth * (FRONT_GROW * w - BACK_SHRINK * (1 - w));
        let opacity = 1 - depth * BACK_DIM * (1 - w);
        if (intro) { scale *= 0.7 + 0.3 * appear; opacity *= appear * appear * (3 - 2 * appear); }
        const sx = (x - cx) * st.scale + st.width / 2 - st.sizeW / 2;
        const sy = (y - cy) * st.scale + st.height / 2 - st.sizeH / 2;
        let z = d <= 0 ? 10 + Math.round((d + 1) * 80) : 110 + Math.round(d * 80);   // sau: dưới tên, trước: trên tên
        if (i === st.hoverIndex) z += 200;
        write(it, 't', 'transform', `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`);
        write(it, 'o', 'opacity', opacity > 0.999 ? '' : opacity.toFixed(3));
        write(it, 'z', 'zIndex', String(z));
      });
      if (intro) applyDash(spread);
    }

    function frame(now) {
      st.raf = 0;
      const dt = st.last ? clamp((now - st.last) / 1000, 0, 0.1) : 0;
      st.last = now;
      let busy = false;
      if (st.lut && st.scale && st.introStart === -1 && !st.introDone && st.visible) {
        if (!st.reduced) st.introStart = now; else st.introDone = true;
        root.removeAttribute('data-intro');
      }
      if (st.introStart >= 0) {
        if ((now - st.introStart) / 1000 >= INTRO_SPREAD) { st.introStart = -2; st.introDone = true; applyDash(1); }
        else busy = true;
      }
      const want = st.reduced ? 0 : st.hovered ? clamp(cfg.hoverSpeed, 0, 1) : 1;
      if (st.speed !== want) {
        st.speed += (want - st.speed) * (1 - Math.exp(-dt / 0.35));
        if (Math.abs(st.speed - want) < 0.002) st.speed = want;
        busy = true;
      }
      if (st.speed > 0) { st.lap += dt * st.speed / cfg.duration; busy = true; }
      if (st.drag && st.drag.active) {
        busy = true;
      } else if (st.seek) {
        st.seek.t = Math.min(1, st.seek.t + dt / st.seek.dur);
        const t = st.seek.t, e = t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
        st.manual = st.seek.from + st.seek.delta * e;
        if (st.seek.t >= 1) st.seek = null;
        busy = true;
      } else if (st.glide) {                      // quán tính sau khi hất tay
        st.manual += st.glide * dt;
        st.glide *= Math.exp(-dt / 0.7);
        if (Math.abs(st.glide) < 0.0004) st.glide = 0;
        busy = true;
      }
      render(now);
      st.lap -= Math.floor(st.lap);
      if (!st.drag && !st.seek) st.manual -= Math.floor(st.manual);
      if (busy && st.visible) st.raf = requestAnimationFrame(frame);
    }

    function wake() {
      if (st.raf || !st.visible) return;
      st.last = 0;
      st.raf = requestAnimationFrame(frame);
    }

    /* ---------- Tương tác ---------- */
    function local(e) {
      const r = root.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    function dragRate() {
      if (!st.lut || !st.scale) return 0;
      const a = sample(st.front - 3 / SAMPLES), b = sample(st.front + 3 / SAMPLES);
      const along = (b[0] - a[0]) / (6 / SAMPLES) * st.scale;
      const floor = st.length * st.scale * 0.35;
      return Math.abs(along) < floor ? Math.sign(along || 1) * floor : along;
    }
    function itemIndex(target) {
      const el = target instanceof Element ? target.closest('[data-orbit-item]') : null;
      return el && root.contains(el) ? Number(el.dataset.orbitItem) : -1;
    }
    // đưa thẻ ra phía trước, trả về số giây sẽ chạy
    function bringToFront(index) {
      if (!st.lut || index < 0) return 0;
      const u = progress() + offsetOf(index, st.items.length);
      const delta = wrapSigned(st.front - u);
      st.glide = 0;
      if (st.reduced) { st.manual += delta; render(performance.now()); return 0; }
      const dur = 0.45 + Math.abs(delta) * 1.4;
      st.seek = { from: st.manual, delta, t: 0, dur };
      wake();
      return dur;
    }

    root.addEventListener('pointerenter', () => { st.hovered = true; wake(); });
    root.addEventListener('pointerleave', () => { st.hovered = false; st.hoverIndex = -1; wake(); });
    root.addEventListener('pointerover', e => {
      const index = itemIndex(e.target);
      if (index !== st.hoverIndex) {
        st.hoverIndex = index;
        if (st.lut) render(performance.now());
        if (index >= 0 && options.onItemHover) options.onItemHover(index);
      }
    });
    root.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const [x, y] = local(e);
      st.drag = { id: e.pointerId, x, y, active: false, samples: [], rate: dragRate(), anchor: 0, manual: 0 };
    });
    root.addEventListener('pointermove', e => {
      const d = st.drag;
      if (!d || e.pointerId !== d.id) return;
      const [x, y] = local(e);
      const along = x - d.x;
      if (!d.active) {
        if (Math.abs(along) < DRAG_THRESHOLD) return;
        if (Math.abs(y - d.y) > Math.abs(along)) { st.drag = null; return; }   // vuốt dọc: để trang cuộn
        d.active = true; d.anchor = along; d.manual = st.manual;
        st.seek = null; st.glide = 0;
        try { root.setPointerCapture(e.pointerId); } catch (err) {}
        root.setAttribute('data-dragging', '');
      }
      if (d.rate) st.manual = d.manual + (along - d.anchor) / d.rate;
      const now = performance.now();
      d.samples.push([now, along]);
      while (d.samples.length > 2 && now - d.samples[0][0] > 100) d.samples.shift();
      wake();
    });
    function endDrag(e, cancelled) {
      const d = st.drag;
      if (!d || e.pointerId !== d.id) return;
      st.drag = null;
      if (!d.active) return;
      root.removeAttribute('data-dragging');
      try { root.releasePointerCapture(e.pointerId); } catch (err) {}
      const now = performance.now();
      st.suppressUntil = now + 400;              // cú thả sau khi kéo không tính là bấm
      const s = d.samples;
      if (!cancelled && s.length > 1 && d.rate) {
        const [t0, a0] = s[0], [t1, a1] = s[s.length - 1];
        if (t1 > t0 && now - t1 < 80) st.glide = clamp((a1 - a0) / (t1 - t0) * 1000 / d.rate, -3, 3);
      }
      wake();
    }
    root.addEventListener('pointerup', e => endDrag(e, false));
    root.addEventListener('pointercancel', e => endDrag(e, true));
    root.addEventListener('lostpointercapture', e => endDrag(e, true));

    function activate(index) {
      if (index < 0) return;
      const wait = bringToFront(index);
      options.onItemClick(index, wait);
    }
    root.addEventListener('click', e => {
      if (performance.now() < st.suppressUntil) { st.suppressUntil = 0; return; }
      activate(itemIndex(e.target));
    });
    root.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const index = itemIndex(e.target);
      if (index < 0) return;
      e.preventDefault();
      activate(index);
    });
    root.addEventListener('focusin', e => {
      const index = itemIndex(e.target);
      if (index >= 0 && e.target.matches(':focus-visible')) bringToFront(index);
    });
    query.addEventListener('change', () => { st.reduced = query.matches; refresh(); });

    /* ---------- Theo dõi kích thước và trạng thái hiện/ẩn ---------- */
    function refresh() {
      build();
      layout();
      render(performance.now());
      wake();
    }
    new ResizeObserver(refresh).observe(root);    // gồm cả lúc màn quỹ đạo vừa hiện lại
    addEventListener('resize', refresh);          // đổi kiểu elip khi xoay điện thoại
    new IntersectionObserver(entries => {
      st.visible = entries[entries.length - 1].isIntersecting;
      if (st.visible) wake();
    }, { threshold: 0.05 }).observe(root);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

    refresh();
    return { refresh };
  };
})();
