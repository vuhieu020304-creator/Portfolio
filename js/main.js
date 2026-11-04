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
  { id: 'muc_tieu', title: 'Mục tiêu',   rows: 8, cols: 'task_id · trang_thai' },
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
  if (closeOpenTask()) return;
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
    viewBtn.setAttribute('aria-label', 'Chuyển dạng hiển thị, đang là ' + $('.on', viewBtn).textContent);
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

/* ---------- 4d. Mục tiêu: lộ trình vẽ như một DAG. Dữ liệu lấy từ các dòng của bảng, nên hai dạng luôn khớp ---------- */
const DAG_ID = 'lo_trinh_data_engineer';
const DAG_RUN_MS = 1300;      // các nút hiện và đường nối vẽ xong, rồi chấm dữ liệu mới chạy
const PACKET_SPEED = 70;      // px mỗi giây
const EDGE_RADIUS = 6, AXIS_BELOW = 24;   // bo góc đường gấp khúc; khoảng từ hàng song song xuống trục gộp
const PACKET_GAP = 33;        // chấm chậm nên 30 khung/giây là đủ mượt; xin khung hình thưa lại để màn 144Hz không phải dựng đủ 144 lần
const LOG_MARKS = { '✔': ['s-success', 'đã làm được', 1], '●': ['s-running', 'đang làm', .5], '○': ['s-queued', 'chưa bắt đầu', 0] };
const SVG_NS = 'http://www.w3.org/2000/svg';
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const dagTasks = $$('#taskTable tbody tr').map(tr => {
  const [, id, time, title, state] = [...tr.cells].map(td => td.textContent);
  // "SQL ✔ (ghi chú)" tách thành tên, ký hiệu, ghi chú; mục không có ký hiệu chỉ là ghi chú, không tính vào tiến độ
  const log = tr.dataset.log.split(' · ').map(item => { const [name, mark, note = ''] = item.split(/([✔●○])/); return { name: name.trim(), mark, note: note.trim() }; });
  return { id, time, title, state, log, parallel: tr.dataset.branch === 'song_song' };
});
const dagMain = dagTasks.filter(t => !t.parallel), dagParallel = dagTasks.filter(t => t.parallel);
dagMain.forEach((t, i) => Object.assign(t, { col: i + 1, row: 1, rank: i }));
dagParallel.forEach((t, i) => Object.assign(t, { col: i + 2, row: 2, rank: i + 1 }));

const taskHTML = t => `<button type="button" class="task" data-task="${t.id}" data-state="${t.state}" aria-expanded="false" aria-controls="taskLog" aria-label="${esc(t.id)}: ${esc(t.title)}, ${esc(t.time)}, trạng thái ${t.state}" style="--c:${t.col};--r:${t.row};--i:${t.rank}">
    <code class="task-id">${t.id.replace(/_/g, '_<wbr>')}</code>
    <span class="task-title">${esc(t.title)}</span>
    <span class="task-time">${esc(t.time)}</span>
    <i class="task-dot"></i>
  </button>`;
const countState = s => dagTasks.filter(t => t.state === s).length;
const nextRun = dagTasks.find(t => t.state === 'queued');
const dagWrap = $('#dagWrap');
dagWrap.innerHTML = `<div class="dag-run">
    <p>DAG <b>${DAG_ID}</b> · <b>${countState('running')}/${dagTasks.length}</b> task đang chạy · <b>${countState('success')}</b> hoàn thành · next_run: <b>${nextRun ? esc(nextRun.time.toLowerCase()) : '-'}</b></p>
    <div class="dag-cells" aria-hidden="true">${dagTasks.map(t => `<i data-state="${t.state}"></i>`).join('')}</div>
  </div>
  <div class="dag" id="dag">
    <svg class="dag-edges" aria-hidden="true">
      <defs>${['', ' live'].map(c => `<marker id="dagArrow${c ? 'Live' : ''}" class="dag-arrow${c}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0.5 8 4 0 7.5z"></path></marker>`).join('')}</defs>
      <g class="dag-lines"></g>
    </svg>
    <div class="dag-packets" aria-hidden="true"></div>
    ${taskHTML(dagMain[0])}
    <div class="dag-par" data-state="running"><p>-- chạy song song suốt lộ trình</p>${dagParallel.map(taskHTML).join('')}</div>
    ${dagMain.slice(1).map(taskHTML).join('')}
    <div class="task-goal" style="--i:${dagMain.length}">
      <code class="task-id">tuyen_ngon</code>
      <blockquote>“Một Data Engineer xuất sắc không tối ưu hệ thống cho ngày hôm nay, họ xây dựng kiến trúc để sẵn sàng cho sự bùng nổ dữ liệu của 5 năm tới.”</blockquote>
    </div>
  </div>
  <div class="task-log frame" id="taskLog" aria-live="polite"></div>`;
const dag = $('#dag'), taskLog = $('#taskLog'), dagLines = $('.dag-lines', dag), dagPacketBox = $('.dag-packets', dag);
const taskEl = id => $(`.task[data-task="${id}"]`, dag);
const narrowDag = matchMedia('(max-width: 899.98px)');
let dagPaths = [], dagPackets = [], dagDrawn = false, dagInView = false, dagRaf = 0, dagWait = 0;

/* Cặp nút cần nối. Màn hẹp là một chuỗi dọc, khối song song tính như một nút */
function dagEdges() {
  if (narrowDag.matches) {
    const chain = [...dag.children].filter(e => e.matches('.task, .dag-par, .task-goal'));
    return chain.slice(1).map((to, i) => [chain[i], to]);
  }
  const main = dagMain.map(t => taskEl(t.id)), last = main[main.length - 1];
  return [
    ...main.slice(1).map((to, i) => [main[i], to]),
    [last, $('.task-goal', dag)],
    ...dagParallel.flatMap(t => [[main[0], taskEl(t.id)], [taskEl(t.id), last]])
  ];
}
// Đoạn đã chạy: cả hai đầu đều là task đã hoặc đang chạy. Đích tuyen_ngon chưa có trạng thái nên vẫn là nét đứt
const edgeLive = (a, b) => a.dataset.state !== 'queued' && !!b.dataset.state && b.dataset.state !== 'queued';
const edgeRank = el => +(el.style.getPropertyValue('--i') || 0);
function edgePath(a, b) {
  const A = { x: a.offsetLeft, y: a.offsetTop, w: a.offsetWidth, h: a.offsetHeight }, B = { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight };
  if (narrowDag.matches) return `M10 ${A.y + 20} L10 ${B.y + 19}`;
  if (A.y === B.y) {                                  // cùng hàng: nối từ phải sang trái
    const x1 = A.x + A.w, x2 = B.x - 1, y = A.y + A.h / 2, g = (x2 - x1) / 2;
    return `M${x1} ${y} C${x1 + g} ${y} ${x2 - g} ${y} ${x2} ${y}`;
  }
  if (b.matches('.task-goal')) {                      // mid_level_de thẳng xuống đích đến
    const x = A.x + A.w * .75;
    return `M${x} ${A.y + A.h} L${x} ${B.y - 1}`;
  }
  // Nhánh song song: đường gấp khúc kiểu sơ đồ mạch. Các nhánh đi chung một trục ngang nên không cắt nhau
  const x1 = A.x + A.w / 2, y1 = A.y + A.h, r = EDGE_RADIUS;
  if (B.y > A.y) {                                    // tách ra: trục nằm giữa hai hàng
    const x2 = B.x + B.w / 2, axis = (y1 + B.y) / 2;
    return `M${x1} ${y1} V${axis - r} Q${x1} ${axis} ${x1 + r} ${axis} H${x2 - r} Q${x2} ${axis} ${x2} ${axis + r} V${B.y - 1}`;
  }
  const x2 = B.x + B.w * .3, axis = y1 + AXIS_BELOW;   // gộp lại: trục ngay dưới hàng song song
  return `M${x1} ${y1} V${axis - r} Q${x1} ${axis} ${x1 + r} ${axis} H${x2 - r} Q${x2} ${axis} ${x2} ${axis - r} V${B.y + B.h + 1}`;
}
function dagLayout() {
  if (!dag.offsetParent || !dag.offsetWidth) return;     // đang ẩn: ResizeObserver gọi lại khi hiện
  const edges = dagEdges();
  if (dagPaths.length !== edges.length) {
    dagLines.innerHTML = '';
    dagPacketBox.innerHTML = '';
    dagPaths = edges.map(() => dagLines.appendChild(document.createElementNS(SVG_NS, 'path')));
    dagPackets = [];
  }
  edges.forEach(([a, b], i) => {
    const path = dagPaths[i], live = edgeLive(a, b);
    path.setAttribute('d', edgePath(a, b));
    path.setAttribute('class', 'dag-line' + (live ? ' live' : ''));
    const len = path.getTotalLength();
    // mẫu gồm đường cần vẽ rồi một khoảng trống dài bằng cả đường: đẩy dashoffset về 0 là đường hiện dần, kể cả nét đứt
    // nét đứt đếm nhịp từ cuối đường, để hai đường gộp chung một đoạn thì nét trùng khít, không thành nét liền
    const rest = len % 8;
    const dashes = live ? [len, 0] : [Math.max(rest - 4, 0), Math.min(rest, 4), ...Array.from({ length: Math.floor(len / 8) * 2 }, () => 4)];
    const drawn = dashes.reduce((s, d) => s + d, 0);
    dashes[dashes.length - 1] += len;
    path.setAttribute('stroke-dasharray', dashes.join(' '));
    path.style.setProperty('--len', drawn);
    path.style.setProperty('--i', edgeRank(narrowDag.matches ? b : a));
    path.dataset.live = live ? '1' : '';
  });
  showArrows();
  buildPackets();
}
function showArrows() {
  const on = dagDrawn || reduceMotion;
  dagPaths.forEach(p => { if (on) p.setAttribute('marker-end', `url(#dagArrow${p.dataset.live ? 'Live' : ''})`); else p.removeAttribute('marker-end'); });
}

/* Chấm dữ liệu: cùng kiểu chấm chạy dọc đường của quỹ đạo, do requestAnimationFrame điều khiển để dừng được hẳn.
   Là phần tử HTML di chuyển bằng transform: đổi tọa độ chấm SVG sẽ bắt vẽ lại cả lớp SVG mỗi khung hình */
function buildPackets() {
  if (reduceMotion) return;
  const perEdge = narrowDag.matches ? 1 : 2, live = dagPaths.filter(p => p.dataset.live);
  if (dagPackets.length === live.length * perEdge) { dagPackets.forEach(p => { p.len = p.path.getTotalLength(); }); return; }
  dagPacketBox.innerHTML = '';
  dagPackets = live.flatMap(path => Array.from({ length: perEdge }, (_, k) => {
    const dot = dagPacketBox.appendChild(document.createElement('i'));
    dot.className = 'dag-packet';
    return { path, dot, k: k / perEdge, len: path.getTotalLength() };
  }));
}
function packetFrame(now) {
  dagRaf = 0;
  dagWait = setTimeout(() => { dagWait = 0; dagRaf = requestAnimationFrame(packetFrame); }, PACKET_GAP);
  dagPackets.forEach(p => {
    const at = p.path.getPointAtLength((now / 1000 * PACKET_SPEED + p.k * p.len) % p.len);
    p.dot.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
  });
}
function syncPackets() {
  const on = !reduceMotion && dagDrawn && dagInView && !document.hidden && dagWrap.classList.contains('show');
  dag.classList.toggle('flowing', on);
  if (on && !dagRaf && !dagWait) dagRaf = requestAnimationFrame(packetFrame);
  if (!on) { cancelAnimationFrame(dagRaf); clearTimeout(dagWait); dagRaf = dagWait = 0; }
}
// Rời mục, chuyển sang dạng bảng hay cuộn khỏi màn hình đều làm sơ đồ không còn giao với khung nhìn
new IntersectionObserver(entries => {
  dagInView = entries[entries.length - 1].isIntersecting;
  syncPackets();
}).observe(dag);
document.addEventListener('visibilitychange', syncPackets);
new ResizeObserver(dagLayout).observe(dag);
narrowDag.addEventListener('change', () => { placeTaskLog(); dagLayout(); });

dagWrap.addEventListener('reveal', () => {
  dagLayout();
  dagDrawn = false;
  showArrows();
  syncPackets();
  clearTimeout(sbTimer);
  sbQuery.className = 'sb-query busy';
  sbQuery.textContent = `DAG run · ${DAG_ID} ...`;
  sbTimer = setTimeout(() => {
    dagDrawn = true;
    showArrows();
    syncPackets();
    sbQuery.className = 'sb-query done';
    sbQuery.textContent = `OK · ${dagTasks.length} tasks`;
  }, reduceMotion ? 0 : DAG_RUN_MS);
});

/* Bấm một task: xem chi tiết như xem log */
let openTaskId = null;
const logProgress = t => {
  const marked = t.log.filter(i => i.mark);
  return marked.reduce((s, i) => s + LOG_MARKS[i.mark][2], 0) / marked.length * 100;
};
function logHTML(t) {
  const pct = +logProgress(t).toFixed(1);
  const items = t.log.map(i => {
    if (!i.mark) return `<li class="log-note"><span>${esc(i.name)}</span></li>`;
    const [cls, label] = LOG_MARKS[i.mark];
    return `<li><i class="${cls}" role="img" aria-label="${label}">${i.mark}</i><span>${esc(i.name)}${i.note ? ` <small>${esc(i.note)}</small>` : ''}</span></li>`;
  }).join('');
  return `<div class="log-head"><code>${t.id}</code><span class="status st-${t.state}">${t.state}</span><span>${esc(t.time)}</span></div>
    <ul class="log-items">${items}</ul>
    <div class="log-line"><span>tien_do</span><b>${pct}%</b></div>
    <div class="log-bar" role="meter" aria-label="Tiến độ ${t.id}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="--w:${pct}%"></i></div>`;
}
function placeTaskLog() {
  const el = openTaskId && taskEl(openTaskId);
  if (narrowDag.matches && el) el.after(taskLog);
  else if (taskLog.parentElement !== dagWrap) dagWrap.append(taskLog);
}
function setOpenTask(id) {
  openTaskId = id;
  $$('.task', dag).forEach(el => el.setAttribute('aria-expanded', el.dataset.task === id));
  dag.classList.toggle('has-open', !!id);
  taskLog.innerHTML = id ? logHTML(dagTasks.find(t => t.id === id)) : '';
  placeTaskLog();
}
$$('.task', dag).forEach(el => {
  el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') SFX.play('hover'); });
  el.addEventListener('click', () => {
    const id = el.dataset.task;
    if (id === openTaskId) { setOpenTask(null); return; }
    SFX.play('tab');
    setOpenTask(id);
    if (narrowDag.matches) el.scrollIntoView({ block: 'nearest' });   // chi tiết ở trên vừa đóng có thể đẩy task ra khỏi màn hình
  });
});
// Esc: đóng chi tiết nếu đang nhìn thấy. Ở màn SELECT * thì chi tiết đã cuộn khỏi màn hình không giữ phím Esc lại
function closeOpenTask() {
  if (!openTaskId || !dag.offsetParent) return false;
  if (document.body.dataset.view === 'all') {
    const r = taskLog.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= innerHeight) return false;
  }
  const el = taskEl(openTaskId);
  setOpenTask(null);
  el.focus({ preventScroll: true });
  return true;
}
setOpenTask('du_an_ca_nhan');   // việc đang tập trung
setupViewToggle($('#dagView'), 'vvh_goal_view', dagWrap, $('#taskTable'));

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
    'Nạp lược đồ: 7 bảng, 37 dòng ........ <b>OK</b>',
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
