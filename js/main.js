/* =========================================================
   PORTFOLIO - VŨ VĂN HIẾU  |  JavaScript
   Chức năng: hiện dần khi cuộn, tab hồ sơ, menu di động,
   chuyển sáng/tối, chữ tự gõ, nút lên/xuống, form liên hệ.
   ========================================================= */

const $  = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

/* ---------- 1. Hiện dần khi cuộn ---------- */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('show'); });
}, { threshold: 0.15 });
$$('.reveal').forEach(el => revealObserver.observe(el));

/* ---------- 2. Tab Hồ sơ ---------- */
const tabs = $$('.tabs [role="tab"]');
function openTab(tab) {
  tabs.forEach(t => {
    const active = t === tab;
    t.classList.toggle('on', active);
    t.setAttribute('aria-selected', active);
    const panel = document.getElementById(t.getAttribute('aria-controls'));
    panel.classList.toggle('on', active);
    panel.hidden = !active;
  });
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => openTab(tab));
  tab.addEventListener('keydown', e => {            // dùng phím mũi tên để đổi tab
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    next.focus(); openTab(next);
  });
});

/* ---------- 3. Menu sáng theo mục đang xem ---------- */
const sections = $$('main section');
const menuLinks = $$('#menu a');
function setActive() {
  let current = sections[0].id;
  sections.forEach(s => {
    if (s.getBoundingClientRect().top < window.innerHeight * 0.4) current = s.id;
  });
  const key = current === 'about' ? 'about' : current;
  menuLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + key));
}
window.addEventListener('scroll', setActive, { passive: true });
setActive();

/* ---------- 4. Menu di động ---------- */
const menu = $('#menu');
const menuBtn = $('#menuBtn');
menuBtn.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open);
});
menuLinks.forEach(a => a.addEventListener('click', () => {
  menu.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', false);
}));

/* ---------- 5. Chuyển giao diện sáng / tối ---------- */
const root = document.documentElement;
try {
  const saved = localStorage.getItem('theme');
  if (saved) root.setAttribute('data-theme', saved);
} catch (e) { /* trình duyệt chặn lưu trữ: bỏ qua */ }

const themeBtn = $('#themeBtn');
function showThemeIcon() {
  // đang sáng thì hiện trăng (bấm để sang tối), đang tối thì hiện mặt trời
  themeBtn.textContent = root.getAttribute('data-theme') === 'light' ? '☾' : '☀';
}
themeBtn.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('theme', next); } catch (e) {}
  showThemeIcon();
});
showThemeIcon();

/* ---------- 6. Nút lên / xuống giữa các mục ---------- */
function goSection(step) {
  let index = 0;
  sections.forEach((s, k) => {
    if (s.getBoundingClientRect().top < window.innerHeight * 0.4) index = k;
  });
  const target = sections[Math.max(0, Math.min(sections.length - 1, index + step))];
  target.scrollIntoView({ behavior: 'smooth' });
}
$('#up').addEventListener('click', () => goSection(-1));
$('#down').addEventListener('click', () => goSection(1));

/* ---------- 7. Chữ tự gõ ở trang chủ ---------- */
const phrases = [
  'Hệ thống thông tin quản lý · ĐH Giao thông Vận tải',
  'Định hướng trở thành Data Engineer',
  'Toán học · Công nghệ · Khoa học dữ liệu'
];
const typingEl = $('#typing');
let wordIndex = 0, charIndex = 0, deleting = false;
function typeLoop() {
  const word = phrases[wordIndex];
  typingEl.textContent = word.slice(0, charIndex);
  if (!deleting && charIndex < word.length) {
    charIndex++;
  } else if (!deleting) {
    deleting = true;
    return setTimeout(typeLoop, 1400);
  } else if (charIndex > 0) {
    charIndex--;
  } else {
    deleting = false;
    wordIndex = (wordIndex + 1) % phrases.length;
  }
  setTimeout(typeLoop, deleting ? 35 : 70);
}
typeLoop();

/* ---------- 8. Form liên hệ: kiểm tra dữ liệu ---------- */
const form = $('#contactForm');
const rules = {
  name: v => v.trim().length >= 2 ? '' : 'Vui lòng nhập họ tên (ít nhất 2 ký tự).',
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Email chưa đúng định dạng (ví dụ: ban@example.com).',
  message: v => v.trim().length >= 10 ? '' : 'Nội dung cần ít nhất 10 ký tự.'
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
  form.elements[name].addEventListener('blur', () => checkField(name));
  form.elements[name].addEventListener('input', () => {
    if (form.elements[name].classList.contains('invalid')) checkField(name);
  });
});

form.addEventListener('submit', e => {
  e.preventDefault();
  const okMsg = $('#formOk');
  okMsg.textContent = '';

  const results = Object.keys(rules).map(checkField);   // kiểm tra tất cả ô
  if (results.includes(false)) {
    const firstBad = Object.keys(rules).find(n => form.elements[n].classList.contains('invalid'));
    form.elements[firstBad].focus();
    return;
  }

  // Dữ liệu hợp lệ: mở ứng dụng email với nội dung đã điền sẵn
  const subject = encodeURIComponent('Liên hệ từ trang portfolio - ' + form.elements.name.value.trim());
  const body = encodeURIComponent(
    form.elements.message.value.trim() + '\n\nTừ: ' +
    form.elements.name.value.trim() + ' (' + form.elements.email.value.trim() + ')'
  );
  window.location.href = 'mailto:vuhieu020304@gmail.com?subject=' + subject + '&body=' + body;

  okMsg.textContent = 'Cảm ơn bạn! Ứng dụng email sẽ mở ra để bạn gửi tin nhắn.';
  form.reset();
});
