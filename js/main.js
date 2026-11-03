/* =========================================================
   HỒ SƠ vvh_db - VŨ VĂN HIẾU  |  JavaScript chính
   1. Sáng / tối: thẻ ảnh lật và nút Tối/Sáng luôn khớp nhau
   2. Câu truy vấn màn đầu, chữ tự gõ
   3. Quỹ đạo và chuyển giữa các bảng
   4. Bộ lọc năng lực = mệnh đề WHERE
   5. Xem ảnh phóng to
   6. Form liên hệ = câu lệnh INSERT, có kiểm tra dữ liệu
   7. Bản 2: màn khởi động, âm thanh, gợn sóng, nhảy số
   Hiệu ứng nằm ở orbit.js, text-type.js, flip-card.js, glyph-bg.js; âm thanh ở sound.js.
   ========================================================= */

const $  = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
root.classList.add('js');

/* ---------- 1. Sáng / tối ---------- */
const GLYPH_COLORS = { dark: ['#64CCC5', '#9BA8AB'], light: ['#176B87', '#64CCC5'] };   // [glow, shape]
const startMode = root.dataset.theme || 'dark';
const glyph = createGlyphBackground($('#glyphBg'), { glowColor: GLYPH_COLORS[startMode][0], shapeColor: GLYPH_COLORS[startMode][1] });
const modeBtns = $$('.mode button');
function applyTheme(mode, save) {
  root.dataset.theme = mode;
  glyph.setColors(...GLYPH_COLORS[mode]);
  modeBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode));
  $('#sbMode').textContent = 'chế độ: ' + (mode === 'dark' ? 'tối' : 'sáng');
  if (save) { try { localStorage.setItem('theme', mode); } catch (e) {} }
}
applyTheme(startMode, false);
const flipCard = createFlipCard($('#flipCard'), {
  flipped: startMode === 'light',
  onFlipChange: flipped => {
    applyTheme(flipped ? 'light' : 'dark', true);
    SFX.play(flipped ? 'themeLight' : 'themeDark');
  }
});
// Đổi giao diện bằng nút: vòng tròn màu mới lan ra từ đúng chỗ bấm
modeBtns.forEach(btn => btn.addEventListener('click', e => {
  const mode = btn.dataset.mode;
  if (mode === root.dataset.theme) return;
  SFX.play(mode === 'light' ? 'themeLight' : 'themeDark');
  const swap = () => { applyTheme(mode, true); flipCard.set(mode === 'light'); };
  if (!document.startViewTransition || reduceMotion) { swap(); return; }
  const x = e.clientX || innerWidth - 60, y = e.clientY || 24;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(swap).ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.7, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => {});
}));

// Nút bật/tắt âm thanh
const soundBtn = $('#soundBtn');
soundBtn.setAttribute('aria-pressed', SFX.enabled);
soundBtn.addEventListener('click', () => {
  SFX.setEnabled(!SFX.enabled);
  soundBtn.setAttribute('aria-pressed', SFX.enabled);
});

/* ---------- 2. Câu truy vấn màn đầu, chữ tự gõ ---------- */
const heroHTML = '<span class="kw">SELECT</span> * <span class="kw">FROM</span> ho_so\n' +
                 '<span class="kw">WHERE</span> ho_ten = <span class="st">\'Vũ Văn Hiếu\'</span>;';
const heroText = heroHTML.replace(/<[^>]+>/g, '');
const heroEl = $('#heroQuery');
let typingTimer;

function typeHero(done) {
  clearTimeout(typingTimer);
  if (reduceMotion) { heroEl.innerHTML = heroHTML; done && done(); return; }
  let i = 0;
  (function step() {
    if (i <= heroText.length) {
      heroEl.textContent = heroText.slice(0, i++);
      heroEl.insertAdjacentHTML('beforeend', '<span class="caret">▌</span>');
      if (i > 1 && heroText[i - 2] !== ' ') SFX.play('key');
      typingTimer = setTimeout(step, 38);
    } else {
      heroEl.innerHTML = heroHTML;            // gõ xong thì tô màu từ khóa
      done && done();
    }
  })();
}

// Nút "Chạy": gõ lại câu lệnh, làm sáng kết quả, đổi thời gian chạy
$('.run').addEventListener('click', () => {
  SFX.play('run');
  typeHero(() => {
    SFX.play('success');
    const record = $('#ho_so .record');
    record.classList.remove('flash'); void record.offsetWidth; record.classList.add('flash');
    $('#ho_so .time').textContent = '1 dòng · 0.00' + (2 + Math.floor(Math.random() * 7)) + ' giây';
  });
});

createTextType($('#typed'), {
  text: [
    'Mình là sinh viên Hệ thống thông tin quản lý',
    'Mình đang học để trở thành Data Engineer',
    'Mình đang xây TOGET Enterprise, một hệ thống ERP'
  ],
  prefix: '-- ',
  typingSpeed: 55,
  deletingSpeed: 18,
  pauseDuration: 2200,
  mistakes: 0.2
});

/* ---------- 3a. Kết quả hiện từng dòng mỗi khi mở bảng ---------- */
const results = $$('.result');
results.forEach(r => $$('tr, .erd-flow li, .edu', r).forEach((row, i) => row.style.setProperty('--i', i)));
const resultIO = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting && !e.target.classList.contains('show')) {
    e.target.classList.add('show');
    e.target.dispatchEvent(new Event('reveal'));
  }
}), { threshold: 0.1 });
let tickTimer = 0;   // tiếng tick của thanh cấp độ (mục 4): lần chạy mới thì hủy tick cũ đang chờ
function replay(r) {
  clearTimeout(tickTimer);
  r.classList.remove('show');
  resultIO.unobserve(r);
  resultIO.observe(r);
}
function replayResults() { results.forEach(replay); }

/* ---------- 3b. Quỹ đạo các bảng ---------- */
const TABLES = [
  { id: 'ho_so',    title: 'Giới thiệu', rows: 1, cols: 'ho_ten · tuyen_ngon' },
  { id: 'so_thich', title: 'Sở thích',   rows: 5, cols: 'ten · nen_tang' },
  { id: 'muc_tieu', title: 'Mục tiêu',   rows: 3, cols: 'thoi_han · trang_thai' },
  { id: 'nang_luc', title: 'Năng lực',   rows: 14, cols: 'ky_nang · cap_do' },
  { id: 'du_an',    title: 'Dự án',      rows: 2, cols: 'ten · cong_nghe' },
  { id: 'hoc_van',  title: 'Học vấn',    rows: 4, cols: 'loai · ket_qua' },
  { id: 'lien_he',  title: 'Liên hệ',    rows: 3, cols: 'kenh · dia_chi' }
];
const ids = TABLES.map(t => t.id);
const orbitScreen = $('#orbitScreen');
const tablesEl = $('#tables');
const sections = $$('main section[id]');
let opening = false;

createOrbit($('#orbitStage'), {
  center: $('#orbitCenter'),
  items: TABLES.map(t => ({
    label: `Mở bảng ${t.id}: ${t.title}, ${t.rows} dòng`,
    html: `<div class="tcard"><div class="tcard-h"><b>${t.id}</b><small>${t.rows} dòng</small></div>` +
          `<div class="tcard-b"><strong>${t.title}</strong><span>${t.cols}</span></div></div>`
  })),
  // máy tính: elip nằm ngang. điện thoại: elip đứng để thẻ đủ to
  getConfig: () => innerWidth <= 720
    ? { baseWidth: 1400, radiusX: 250, radiusY: 430, rotation: 0, itemW: 200, itemH: 112, duration: 48, depth: 0.55, hoverScale: 1.06, hoverSpeed: 0.12, pathWidth: 1, pathDash: 5, packetSize: 7 }
    : { baseWidth: 1400, radiusX: 520, radiusY: 185, rotation: -6, itemW: 210, itemH: 124, duration: 48, depth: 0.6, hoverScale: 1.06, hoverSpeed: 0.12, pathWidth: 1.5, pathDash: 6, packetSize: 5 },
  onItemHover() { SFX.play('hover'); },
  onItemClick(index, wait) {
    if (opening) return;
    opening = true;
    SFX.play('open');
    // thẻ chạy ra phía trước, màn quỹ đạo mờ đi, rồi mở bảng
    setTimeout(() => {
      orbitScreen.classList.add('leaving');
      setTimeout(() => {
        location.hash = ids[index];
        orbitScreen.classList.remove('leaving');
        opening = false;
      }, reduceMotion ? 0 : 320);
    }, Math.min(wait * 750, 650));
  }
});

/* ---------- 3c. Chuyển màn theo địa chỉ, nên nút Back của trình duyệt cũng dùng được ---------- */
let firstRoute = true;
let lastView = null;
const sbQuery = $('#sbQuery');
let sbTimer;
// Thanh dưới: "đang chạy truy vấn..." rồi "OK · x ms" như phần mềm CSDL thật
function showQueryStatus(view) {
  clearTimeout(sbTimer);
  sbQuery.className = 'sb-query busy';
  sbQuery.textContent = view === 'all' ? 'SELECT * FROM * ...' : 'SELECT * FROM ' + view + ' ...';
  sbTimer = setTimeout(() => {
    sbQuery.className = 'sb-query done';
    sbQuery.textContent = 'OK · ' + (3 + Math.floor(Math.random() * 18)) + ' ms';
  }, reduceMotion ? 0 : 650);
}
// Số liệu nhảy từ 0 lên giá trị thật; data-suffix chỉ hiện khi chạy xong
function countUp(scope, dur = 1100) {
  $$('[data-count]', scope).forEach(el => {
    const end = +el.dataset.count, suffix = el.dataset.suffix || '';
    if (reduceMotion) { el.textContent = end + suffix; return; }
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + (p < 1 ? '' : suffix);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });
}
function route() {
  const hash = location.hash.slice(1);
  const view = hash === 'tat-ca' ? 'all' : ids.includes(hash) ? hash : 'orbit';
  const isOrbit = view === 'orbit';
  if (!firstRoute && lastView !== view) {
    if (isOrbit) SFX.play('back');
    else if (lastView && lastView !== 'orbit') SFX.play('tab');
  }
  lastView = view;

  document.body.dataset.view = isOrbit ? 'orbit' : view === 'all' ? 'all' : 'table';
  glyph.setIntensity(isOrbit ? 1 : 0.3);
  orbitScreen.hidden = !isOrbit;
  tablesEl.hidden = isOrbit;
  sections.forEach(s => { s.hidden = view !== 'all' && s.id !== view; });
  $$('.tabs a').forEach(a => {
    if (a.getAttribute('href') === '#' + view || (view === 'all' && a.classList.contains('tab-all'))) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const activeTab = $('.tabs a[aria-current]');
  if (activeTab) activeTab.scrollIntoView({ inline: 'center', block: 'nearest' });
  $('#sbTable').textContent = isOrbit ? 'màn: quỹ đạo' : view === 'all' ? 'bảng: tất cả' : 'bảng: ' + view;

  if (!isOrbit) {
    const i = ids.indexOf(view);
    const prev = $('#pagerPrev'), next = $('#pagerNext');
    prev.href = i > 0 ? '#' + ids[i - 1] : '#orbit';
    prev.textContent = '← ' + (i > 0 ? ids[i - 1] : 'quỹ đạo');
    next.href = i < ids.length - 1 ? '#' + ids[i + 1] : '#orbit';
    next.textContent = (i < ids.length - 1 ? ids[i + 1] : 'quỹ đạo') + ' →';
    replayResults();
    showQueryStatus(view);
    $$('.table-block').forEach(b => { b.classList.remove('running'); if (!b.hidden) { void b.offsetWidth; b.classList.add('running'); } });
    if (view === 'ho_so' || view === 'all') typeHero();
    if (view === 'du_an' || view === 'all') setTimeout(() => countUp($('#du_an')), 300);
  }

  const shown = isOrbit ? orbitScreen : tablesEl;
  scrollTo({ top: 0, behavior: 'instant' });
  shown.classList.remove('enter'); void shown.offsetWidth; shown.classList.add('enter');
  if (!firstRoute) shown.focus({ preventScroll: true });   // người dùng bàn phím đi tiếp từ màn mới
  firstRoute = false;
}
addEventListener('hashchange', route);
route();
if (isOrbitView()) { sbQuery.textContent = 'sẵn sàng'; }
function isOrbitView() { return document.body.dataset.view === 'orbit'; }

// Esc: quay về quỹ đạo
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || $('#viewer').open || e.target.matches('input, textarea')) return;
  if (document.body.dataset.view !== 'orbit') location.hash = 'orbit';
});

/* ---------- 4. Bộ lọc năng lực = WHERE ---------- */
const skillQuery = $('#skillQuery');
function writeSkillQuery(group) {
  skillQuery.innerHTML = '<span class="kw">SELECT</span> * <span class="kw">FROM</span> nang_luc' +
    (group === 'all' ? ';' : ' <span class="kw">WHERE</span> nhom = <span class="st">\'' + group + '\'</span>;');
}
writeSkillQuery('all');

// mask-image bị chặn CORS khi mở trực tiếp bằng file://, nên lúc đó dùng <img>: vẫn thấy icon nhưng không đổi màu theo thương hiệu
const iconHTML = name => location.protocol === 'file:'
  ? `<img src="images/icons/${name}.svg" alt="">`
  : `<i style="-webkit-mask-image:url(images/icons/${name}.svg);mask-image:url(images/icons/${name}.svg)"></i>`;

// Thẻ kỹ năng dựng từ các dòng của bảng, nên hai dạng luôn cùng dữ liệu
const LEVELS = ['', 'Làm quen', 'Cơ bản', 'Dùng trong dự án', 'Thành thạo'];
const skillsTable = $('#skills');
const skillCards = $('#skillCards');
const skillRows = $$('tbody tr', skillsTable);
skillCards.innerHTML = skillRows.map(tr => {
  const [, name, group, level, note] = [...tr.cells].map(td => td.textContent);
  const n = +level;
  return `<article class="skill frame" data-g="${group}" tabindex="0" style="--brand:${tr.dataset.brand}" aria-label="${name}, nhóm ${group}, cấp độ ${n} trên 4: ${LEVELS[n]}. ${note}">
    <span class="icon-box">${iconHTML(tr.dataset.icon)}</span>
    <b class="card-name">${name}</b>
    <span class="pill">${group}</span>
    <div class="meter-row">
      <div class="meter" role="meter" aria-label="Cấp độ" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="4" aria-valuetext="${n} trên 4: ${LEVELS[n]}">${[0, 1, 2, 3].map(s => `<i${s < n ? ' class="on"' : ''} style="--n:${s}"></i>`).join('')}</div>
      <span class="meter-val">cap_do ${n}/4</span>
    </div>
    <p class="skill-note">${note}</p>
  </article>`;
}).join('');
const skillEls = $$('.skill', skillCards);
const shownSkills = () => skillEls.filter(c => !c.hidden);
const indexSkills = () => shownSkills().forEach((c, i) => c.style.setProperty('--i', i));
indexSkills();

// Mỗi đoạn được tô một tiếng tick, tối đa 6 tiếng rải đều; mốc thời gian lấy theo transition-delay trong CSS
const TICK_MAX = 6, TICK_GAP = 40;
skillCards.addEventListener('reveal', () => {
  if (reduceMotion) return;
  const times = shownSkills().flatMap((card, i) => $$('.meter i.on', card).map((_, n) => i * 60 + 200 + n * 110)).sort((a, b) => a - b);
  const step = (times[times.length - 1] - times[0]) / (TICK_MAX - 1);
  const picks = times.length <= TICK_MAX ? times : Array.from({ length: TICK_MAX }, (_, k) => times[0] + k * step);
  // hẹn nối tiếp từng tiếng nên không bao giờ gần nhau dưới TICK_GAP, kể cả khi máy bận
  (function next(k, wait) {
    tickTimer = setTimeout(() => {
      if (!skillCards.offsetParent) return;
      SFX.play('key');
      if (k + 1 < picks.length) next(k + 1, Math.max(TICK_GAP, picks[k + 1] - picks[k]));
    }, wait);
  })(0, picks[0]);
});

$$('.where button[data-g]').forEach(btn => btn.addEventListener('click', () => {
  const group = btn.dataset.g;
  SFX.play('filter');
  $$('.where button[data-g]').forEach(b => b.setAttribute('aria-pressed', b === btn));
  [...skillRows, ...skillEls].forEach(el => { el.hidden = group !== 'all' && el.dataset.g !== group; });
  writeSkillQuery(group);
  $('#skillRows').textContent = skillRows.filter(tr => !tr.hidden).length + ' dòng';
  indexSkills();
  if (skillView() === 'cards') replay(skillCards);
  const shown = skillView() === 'cards' ? skillCards : skillsTable;
  shown.classList.remove('flash'); void shown.offsetWidth; shown.classList.add('flash');
}));

// Nút \x: chuyển dạng thẻ / dạng bảng, như lệnh bật tắt hiển thị mở rộng của psql. Mỗi mục nhớ lựa chọn riêng.
function setupViewToggle(viewBtn, key, cards, table) {
  let view = 'cards', viewTimer;
  try { if (localStorage.getItem(key) === 'table') view = 'table'; } catch (e) {}
  function show() {
    cards.hidden = view !== 'cards';
    table.hidden = view !== 'table';
    $$('[data-v]', viewBtn).forEach(s => s.classList.toggle('on', s.dataset.v === view));
    viewBtn.setAttribute('aria-label', 'Chuyển dạng hiển thị, đang là ' + (view === 'cards' ? 'dạng thẻ' : 'dạng bảng'));
  }
  show();
  viewBtn.addEventListener('click', () => {
    clearTimeout(tickTimer);
    (view === 'cards' ? cards : table).classList.add('view-out');
    view = view === 'cards' ? 'table' : 'cards';
    SFX.play('tab');
    try { localStorage.setItem(key, view); } catch (e) {}
    clearTimeout(viewTimer);
    viewTimer = setTimeout(() => {
      cards.classList.remove('view-out');
      table.classList.remove('view-out');
      show();
      const shown = view === 'cards' ? cards : table;
      (shown.matches('.result') ? [shown] : $$('.result', shown)).forEach(replay);   // Sở thích: mỗi bản ghi tự hiện khi cuộn tới
    }, reduceMotion ? 0 : 200);
  });
  return () => view;
}
const skillView = setupViewToggle($('#skillView'), 'vvh_skill_view', skillCards, skillsTable);
setupViewToggle($('#hobbyView'), 'vvh_hobby_view', $('#hobbyCards'), $('#hobbyTable'));

/* ---------- 4c. Sở thích: ảnh hiện như đang tải dữ liệu, chỉ chạy 1 lần ---------- */
const LOAD_MS = 900;   // trùng thời gian hoạt ảnh pic-open, pic-scan trong CSS
const picIO = new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  picIO.unobserve(e.target);
  const pic = e.target, img = $('img', pic), tag = $('.pic-tag', pic);
  const finish = failed => {
    pic.classList.add('loaded', 'scan');
    setTimeout(() => {
      pic.classList.remove('scan');
      if (tag) tag.textContent = 'anh_minh_hoa · ' + (failed ? 'lỗi tải' : '200 OK');
    }, reduceMotion ? 0 : LOAD_MS);
  };
  if (tag) tag.textContent = 'loading…';
  if (img.complete) finish(!img.naturalWidth);
  else {
    img.addEventListener('load', () => finish(false), { once: true });
    img.addEventListener('error', () => finish(true), { once: true });
  }
}), { threshold: 0.15 });
$$('.pic').forEach(pic => picIO.observe(pic));

// Rê chuột: ảnh phóng 1.04 và nghiêng tối đa 4 độ, chỉ khi có chuột
if (!reduceMotion && matchMedia('(pointer: fine)').matches) $$('.pic').forEach(pic => {
  const img = $('img', pic);
  pic.addEventListener('pointermove', e => {
    const r = pic.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    img.style.transform = `perspective(900px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) scale(1.04)`;
  });
  pic.addEventListener('pointerleave', () => { img.style.transform = ''; });
});

/* ---------- 4b. Học vấn: icon, thanh chạy bằng CSS, số chạy cùng lúc ---------- */
$$('.icon-box[data-icon]').forEach(box => { box.innerHTML = iconHTML(box.dataset.icon); });
$('#eduCards').addEventListener('reveal', e => countUp(e.target, 1200));

/* ---------- 5. Xem ảnh phóng to ---------- */
const viewer = $('#viewer');
$$('.shot, .pic').forEach(shot => shot.addEventListener('click', () => {
  const img = $('img', shot);
  $('#viewerImg').src = img.src;
  $('#viewerImg').alt = img.alt;
  $('#viewerCap').textContent = shot.dataset.cap;
  SFX.play('open');
  viewer.showModal();                         // <dialog> tự đóng khi nhấn Esc
}));
$('#viewerClose').addEventListener('click', () => viewer.close());
viewer.addEventListener('click', e => { if (e.target === viewer) viewer.close(); });

/* ---------- 6. Form liên hệ = INSERT ---------- */
const form = $('#contactForm');
const insertEl = $('#insertQuery');
// chỉ để hiển thị: thoát dấu nháy đơn như SQL và ký tự HTML
const sqlValue = v => '<span class="st">\'' +
  (v.trim() || '...').replace(/'/g, "''").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\'</span>';

function writeInsert() {
  const f = form.elements;
  const msg = f.message.value.length > 60 ? f.message.value.slice(0, 60) + '…' : f.message.value;
  insertEl.innerHTML = '<span class="kw">INSERT INTO</span> loi_nhan (ho_ten, email, noi_dung)\n' +
    '<span class="kw">VALUES</span> (' + sqlValue(f.name.value) + ', ' + sqlValue(f.email.value) + ', ' + sqlValue(msg) + ');';
}
writeInsert();

const rules = {
  name: v => v.trim().length >= 2 ? '' : 'ho_ten: cần ít nhất 2 ký tự.',
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'email: chưa đúng định dạng (ví dụ ban@example.com).',
  message: v => v.trim().length >= 10 ? '' : 'noi_dung: cần ít nhất 10 ký tự.'
};
function checkField(name) {
  const input = form.elements[name];
  const message = rules[name](input.value);
  $('#err-' + name).textContent = message;
  input.classList.toggle('invalid', Boolean(message));
  input.setAttribute('aria-invalid', Boolean(message));
  return !message;
}
Object.keys(rules).forEach(name => {
  const input = form.elements[name];
  input.addEventListener('input', () => {
    writeInsert();
    if (input.classList.contains('invalid')) checkField(name);
  });
  input.addEventListener('blur', () => checkField(name));
});

form.addEventListener('submit', e => {
  e.preventDefault();
  const ok = $('#formOk');
  ok.textContent = '';
  const passed = Object.keys(rules).map(checkField);
  if (passed.includes(false)) {
    SFX.play('error');
    form.elements[Object.keys(rules)[passed.indexOf(false)]].focus();
    return;
  }
  // Hợp lệ: mở ứng dụng email với nội dung điền sẵn (trang tĩnh, không có máy chủ lưu lời nhắn)
  const f = form.elements;
  const subject = encodeURIComponent('Liên hệ từ trang hồ sơ - ' + f.name.value.trim());
  const body = encodeURIComponent(f.message.value.trim() + '\n\nTừ: ' + f.name.value.trim() + ' (' + f.email.value.trim() + ')');
  SFX.play('success');
  location.href = 'mailto:vuhieu020304@gmail.com?subject=' + subject + '&body=' + body;
  ok.textContent = 'INSERT 0 1 · cảm ơn bạn! Ứng dụng email sẽ mở để gửi lời nhắn.';
  form.reset();
  writeInsert();
});

/* ---------- 7. Bản 2: hiệu ứng thêm ---------- */

// 7a. Gợn sóng khi bấm nút + tiếng bấm cho các nút/link chung
document.addEventListener('pointerdown', e => {
  const btn = e.target.closest('.btn, .run, .where button, .sound-btn, .mode button');
  if (!btn || reduceMotion) return;
  const r = btn.getBoundingClientRect(), size = Math.max(r.width, r.height);
  const dot = document.createElement('span');
  dot.className = 'ripple';
  dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  btn.appendChild(dot);
  dot.addEventListener('animationend', () => dot.remove());
});
document.addEventListener('click', e => {
  if (e.target.closest('.btn:not([type="submit"]):not(.boot-go), .pager a, .contact a, .tab-all')) SFX.play('click');
});

// 7b. Màn khởi động: chỉ hiện ở lần mở đầu tiên trong phiên, khi vào thẳng màn quỹ đạo
(function boot() {
  let seen = false;
  try { seen = sessionStorage.getItem('vvh_booted') === '1'; } catch (e) {}
  if (seen || !isOrbitView()) { glitchName(); return; }

  const box = $('#boot'), log = $('#bootLog'), bar = $('#bootBar'), go = $('#bootGo');
  const lines = [
    '$ psql -h localhost -d <em>vvh_db</em> -U khach',
    'Đang kết nối tới máy chủ ............ <b>OK</b>',
    'Xác thực người dùng "khach" ......... <b>OK</b>',
    'Nạp lược đồ: 7 bảng, 32 dòng ........ <b>OK</b>',
    'Dựng quỹ đạo các bảng ............... <b>OK</b>',
    '<em>vvh_db=#</em> sẵn sàng.'
  ];
  box.hidden = false;
  orbitScreen.hidden = true;                 // giữ hiệu ứng mở quỹ đạo cho đến khi kết nối xong
  document.body.style.overflow = 'hidden';
  document.body.classList.add('booting');
  let i = 0, done = false, autoTimer;

  (function next() {
    if (i < lines.length) {
      log.innerHTML += (i ? '\n' : '') + lines[i];
      bar.style.width = ((i + 1) / lines.length * 100) + '%';
      i++;
      setTimeout(next, reduceMotion ? 0 : 240 + Math.random() * 160);
    } else {
      go.hidden = false;
      go.focus({ preventScroll: true });
      autoTimer = setTimeout(finish, 7000);   // không ai bấm thì tự vào sau 7 giây
    }
  })();

  function finish() {
    if (done) return;
    done = true;
    clearTimeout(autoTimer);
    try { sessionStorage.setItem('vvh_booted', '1'); } catch (e) {}
    SFX.play('boot');
    document.body.style.overflow = '';
    document.body.classList.remove('booting');
    box.classList.add('out');
    setTimeout(() => { box.hidden = true; }, reduceMotion ? 0 : 700);
    route();
    glitchName();
  }
  go.addEventListener('click', finish);
  addEventListener('keydown', function onKey(e) {
    if (done) return removeEventListener('keydown', onKey);
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); finish(); }
  });
})();

function glitchName() {
  if (reduceMotion) return;
  const h = $('.orbit-center h1');
  h.classList.remove('glitch'); void h.offsetWidth; h.classList.add('glitch');
}
