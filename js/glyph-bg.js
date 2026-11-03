/* =========================================================
   NỀN ĐỘNG GLYPH
   Chuyển sang JavaScript thuần từ Glyph Background của Animate UI
   (tác giả Elliot Sutton, giấy phép xem LICENSES/animate-ui.md).
   Đã đổi: bỏ React và thư viện motion, phủ cả màn hình và nghe chuột
   trên window, thêm setColors/setIntensity/destroy, vẽ ít đi khi đang mở bảng.
   ========================================================= */

(function () {
  const CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const MAX_WAVES = 12;
  const TRAIL = 12;
  const TRAIL_LIFE = 700;
  const WAVE_LIFE = 4;          // sóng tắt sau 4 giây
  const WAVE_GAP = 0.3;         // đợt sóng thứ hai đi sau 0,3 giây
  const WAVE_SPEED = 560;
  const WAVE_SLOWDOWN = 0.66;
  const WAVE_EDGE = 10;         // viền ngoài sắc
  const WAVE_TAIL = 30;         // mờ dần vào trong
  const DRIFT = [-30, 12];      // vùng sáng trôi về góc dưới bên trái
  const ACTIVITY_DECAY = 900;   // lắng xuống sau khoảng 1 giây đứng yên
  const DIM_FRAME_GAP = 30;     // khi mờ: vẽ khoảng 30 khung/giây (để dưới 33ms vì màn 60Hz có sai số)

  const VERTEX = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  const FRAGMENT = `
precision highp float;
uniform sampler2D atlas;
uniform vec2 size;
uniform vec2 cell;
uniform float dpr;
uniform float count;
uniform float time;
uniform float rest;
uniform float haze;
uniform float hoverInk;
uniform float activity;
uniform vec2 drift;
uniform vec3 color;
uniform vec3 accent;
uniform vec4 waves[${MAX_WAVES * 2}];
uniform vec4 trail[${TRAIL}];

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smoothNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float outline(float kind, float angle, float phase) {
  if (kind < 0.5) return 1.0;
  if (kind < 1.5) {
    float s = sin(angle);
    float c = cos(angle);
    return (2.0 - 2.0 * s + s * sqrt(abs(c)) / (s + 1.4)) * 0.42;
  }
  return 1.0 + 0.14 * sin(3.0 * angle + phase) + 0.08 * sin(5.0 * angle - phase * 1.3);
}

void main() {
  vec2 pixel = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec2 index = floor(pixel / cell);
  vec2 point = (index + 0.5) * cell / dpr;

  float ring = 0.0;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    vec4 a = waves[i * 2];
    vec4 b = waves[i * 2 + 1];
    if (a.w <= 0.0) continue;
    vec2 v = point - a.xy;
    float angle = atan(-v.y, v.x);
    float shape = mix(1.0, outline(b.x, angle, b.z), b.y);
    shape *= 1.0 + 0.07 * sin(3.0 * angle + b.z + b.w) + 0.05 * sin(5.0 * angle - b.z * 1.7 - b.w * 1.3) + 0.03 * sin(9.0 * angle + b.w * 2.1);
    float d = length(v) - a.z * shape;
    float k = d > 0.0 ? d / ${WAVE_EDGE.toFixed(1)} : d / ${WAVE_TAIL.toFixed(1)};
    ring = max(ring, exp(-k * k) * a.w);
  }

  float hover = 0.0;
  for (int i = 0; i < ${TRAIL}; i++) {
    vec4 t = trail[i];
    if (t.w <= 0.0) continue;
    vec2 v = point - t.xy;
    hover += t.w * exp(-dot(v, v) / (2.0 * t.z * t.z));
  }
  hover = min(hover, 1.0);

  mat2 turn = mat2(0.82, 0.57, -0.57, 0.82);
  vec2 q = turn * (point - drift);
  float blob = smoothNoise(vec2(q.x / 140.0, q.y / 80.0) + vec2(time * 0.04, 0.0)) * 0.62
    + smoothNoise(vec2(q.x / 62.0, q.y / 36.0) + vec2(3.7, time * 0.06)) * 0.38;
  float grain = smoothNoise(vec2(q.x / 30.0, q.y / 14.0) + vec2(time * 0.2, 7.3));
  float cloud = blob * (0.82 + 0.24 * grain);
  float mask = pow(smoothstep(0.47 - 0.2 * activity, 0.84, cloud), 2.6);

  float seed = hash(index);
  float epoch = floor(time * 0.08 * (0.4 + seed) + seed * 97.0);
  float character = floor(hash(index + epoch * 0.137) * count);
  vec2 local = fract(pixel / cell);
  float ink = pow(texture2D(atlas, vec2((character + local.x) / count, local.y)).a, 1.7);

  float grey = ink * clamp(rest + haze * mask * (1.0 + 0.3 * activity) + hoverInk * hover * (0.6 + 0.4 * mask), 0.0, 1.0);
  float blue = ink * ring * 0.72;
  float alpha = grey + blue - grey * blue;
  vec3 tint = color * grey * (1.0 - blue) + accent * blue;
  gl_FragColor = vec4(tint, alpha);
}
`;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  }

  function toRgb(color) {
    const probe = document.createElement('canvas').getContext('2d');
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    return [r / 255, g / 255, b / 255];
  }

  function drawAtlas(cellWidth, cellHeight, font) {
    const atlas = document.createElement('canvas');
    atlas.width = Math.ceil(cellWidth * CHARACTERS.length);
    atlas.height = Math.ceil(cellHeight);
    const context = atlas.getContext('2d');
    context.font = font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#fff';
    for (let i = 0; i < CHARACTERS.length; i++) context.fillText(CHARACTERS[i], (i + 0.5) * cellWidth, cellHeight / 2);
    return atlas;
  }

  function createRenderer(gl) {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const at = name => gl.getUniformLocation(program, name);
    const u = {
      size: at('size'), cell: at('cell'), dpr: at('dpr'), time: at('time'), activity: at('activity'),
      drift: at('drift'), color: at('color'), accent: at('accent'), waves: at('waves'), trail: at('trail')
    };
    gl.uniform1i(at('atlas'), 0);
    gl.uniform1f(at('count'), CHARACTERS.length);
    gl.uniform1f(at('rest'), 0);
    gl.uniform1f(at('haze'), 0.1);
    gl.uniform1f(at('hoverInk'), 0.3);

    return {
      atlas(image) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      },
      draw(f) {
        gl.viewport(0, 0, f.width, f.height);
        gl.uniform2f(u.size, f.width, f.height);
        gl.uniform2f(u.cell, f.cell[0], f.cell[1]);
        gl.uniform1f(u.dpr, f.dpr);
        gl.uniform1f(u.time, f.time);
        gl.uniform1f(u.activity, f.activity);
        gl.uniform2f(u.drift, f.drift[0], f.drift[1]);
        gl.uniform3fv(u.color, f.color);
        gl.uniform3fv(u.accent, f.accent);
        gl.uniform4fv(u.waves, f.waves);
        gl.uniform4fv(u.trail, f.trail);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
  }

  // options: { glowColor, shapeColor, fontSize (bỏ trống: 10, màn hình ≤ 720px là 14), interactive }
  // Trả về { setColors(glow, shape), setIntensity(0..1), destroy() }.
  // Khi chạy được, <html> có class glyph-on; không có class này thì CSS dùng nền dự phòng.
  window.createGlyphBackground = function (container, options = {}) {
    const { fontSize, interactive = true } = options;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = document.createElement('canvas');
    let gl = null;
    try { gl = canvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false }); } catch (e) {}
    const renderer = gl ? createRenderer(gl) : null;
    if (!renderer) return { setColors() {}, setIntensity() {}, destroy() {} };

    container.append(canvas);
    document.documentElement.classList.add('glyph-on');

    let width = 0, height = 0, dpr = 1, cell = [7, 13];
    let color = toRgb(options.glowColor), accent = toRgb(options.shapeColor);
    let time = 0, raf = 0, last = 0, intensity = 1, energy = { value: 0, at: 0 };
    let wavesList = [], trailList = [];
    const waves = new Float32Array(MAX_WAVES * 8);
    const trail = new Float32Array(TRAIL * 4);

    function resize() {
      const phone = innerWidth <= 720;
      width = container.clientWidth;
      height = container.clientHeight;
      dpr = Math.max(1, Math.min(devicePixelRatio || 1, phone ? 1.5 : 2));
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      const size = (fontSize || (phone ? 14 : 10)) * dpr;
      const font = `${size}px Menlo, ui-monospace, SFMono-Regular, Consolas, monospace`;
      const measure = document.createElement('canvas').getContext('2d');
      measure.font = font;
      cell = [Math.round(measure.measureText('0').width), Math.round(size * 1.25)];
      renderer.atlas(drawAtlas(cell[0], cell[1], font));
    }

    function draw() {
      if (!width || !height) return;
      waves.fill(0);
      wavesList = wavesList.filter(wave => (time - wave.born) / 1000 < WAVE_LIFE);
      wavesList.forEach((wave, i) => {
        const age = (time - wave.born) / 1000;
        if (age <= 0) return;
        const fade = Math.min(1, age / 0.05) * Math.exp(-Math.max(0, age - 0.4) / 1.3) * Math.min(1, (WAVE_LIFE - age) / 0.5);
        waves[i * 8] = wave.x;
        waves[i * 8 + 1] = wave.y;
        waves[i * 8 + 2] = WAVE_SPEED * age / (1 + WAVE_SLOWDOWN * age);
        waves[i * 8 + 3] = fade * wave.strength;
        waves[i * 8 + 4] = wave.kind;
        waves[i * 8 + 5] = 0.12 + 0.5 * Math.min(1, age / 2.2);
        waves[i * 8 + 6] = wave.phase;
        waves[i * 8 + 7] = age * 3;
      });
      trail.fill(0);
      trailList.forEach((p, i) => {
        const age = (time - p.t) / TRAIL_LIFE;
        if (age < 0 || age >= 1) return;
        trail[i * 4] = p.x;
        trail[i * 4 + 1] = p.y;
        trail[i * 4 + 2] = 40 + 25 * age;
        trail[i * 4 + 3] = 0.3 * (1 - age) * (1 - age);
      });
      const seconds = time / 1000;
      renderer.draw({
        width: canvas.width, height: canvas.height, dpr, cell, time: seconds,
        activity: energyNow(), drift: [DRIFT[0] * seconds, DRIFT[1] * seconds], color, accent, waves, trail
      });
    }
    const energyNow = () => energy.value * Math.exp(-Math.max(0, time - energy.at) / ACTIVITY_DECAY);

    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (intensity < 1 && now - last < DIM_FRAME_GAP) return;
      time += Math.min(now - last, 64);
      last = now;
      draw();
    }
    // Giảm chuyển động: chỉ vẽ một khung, vùng sáng đứng yên.
    // Điện thoại đang mở bảng: giữ khung hình cuối, nền gần như bị các bảng che hết.
    function syncPlaying() {
      if (document.hidden || reduce || (intensity < 1 && innerWidth <= 720)) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    }

    // Đang dừng thì bỏ qua, nếu không sóng cũ sẽ bật ra khi nền chạy lại
    function onMove(e) {
      if (!raf) return;
      const x = e.clientX, y = e.clientY, prev = trailList[trailList.length - 1];
      const dist = prev ? Math.hypot(x - prev.x, y - prev.y) : 0;
      energy = { value: Math.min(1, energyNow() + dist / 600), at: time };
      if (prev && dist < 18) return;
      trailList = [...trailList.filter(p => time - p.t < TRAIL_LIFE).slice(1 - TRAIL), { x, y, t: time }];
    }
    function onDown(e) {
      if (!raf) return;
      const kind = 1 + Math.floor(Math.random() * 2), phase = Math.random() * Math.PI * 2;
      [[0, 1], [WAVE_GAP, 0.55]].forEach(([delay, strength]) => {
        wavesList = [...wavesList.slice(1 - MAX_WAVES), { x: e.clientX, y: e.clientY, kind, phase, strength, born: time + delay * 1000 }];
      });
    }
    const watchPointer = interactive && !reduce;
    if (watchPointer) {
      addEventListener('pointermove', onMove, { passive: true });
      addEventListener('pointerdown', onDown, { passive: true });
    }

    const observer = new ResizeObserver(() => { resize(); draw(); syncPlaying(); });   // xoay máy có thể vượt mốc 720px
    observer.observe(container);
    document.addEventListener('visibilitychange', syncPlaying);

    function destroy() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncPlaying);
      canvas.removeEventListener('webglcontextlost', destroy);
      if (watchPointer) {
        removeEventListener('pointermove', onMove);
        removeEventListener('pointerdown', onDown);
      }
      document.documentElement.classList.remove('glyph-on');
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      canvas.remove();
    }
    canvas.addEventListener('webglcontextlost', destroy);   // mất GPU giữa chừng: về nền dự phòng

    resize();
    draw();
    syncPlaying();

    return {
      setColors(glow, shape) {
        color = toRgb(glow);
        accent = toRgb(shape);
        draw();
      },
      setIntensity(value) {
        intensity = value;
        canvas.style.opacity = value;   // CSS lo phần chuyển mượt 0,6 giây
        syncPlaying();
      },
      destroy
    };
  };
})();
