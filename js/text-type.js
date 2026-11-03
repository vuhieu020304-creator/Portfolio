/* =========================================================
   CHỮ TỰ GÕ
   Chuyển sang JavaScript thuần từ TextType của React Bits
   (giấy phép xem LICENSES/react-bits.md).
   Đã đổi: bỏ phụ thuộc GSAP, chỉ giữ các tùy chọn trang này dùng.
   ========================================================= */

(function () {
  // phím gần nhau, dùng để giả lập gõ nhầm
  const NEIGHBORS = {
    a: 'qwsz', b: 'vghn', c: 'xdfv', d: 'serfcx', e: 'wsdr', f: 'drtgvc', g: 'ftyhbv', h: 'gyujnb',
    i: 'ujko', j: 'huikmn', k: 'jiolm', l: 'kop', m: 'njk', n: 'bhjm', o: 'iklp', p: 'ol', q: 'wa',
    r: 'edft', s: 'awedxz', t: 'rfgy', u: 'yhji', v: 'cfgb', w: 'qase', x: 'zsdc', y: 'tghu', z: 'asx'
  };

  // tách đúng ký tự có dấu tiếng Việt
  const graphemes = value => (typeof Intl !== 'undefined' && Intl.Segmenter)
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), p => p.segment)
    : Array.from(value);

  const typoFor = char => {
    const keys = NEIGHBORS[char.toLowerCase()];
    if (!keys) return null;
    const pick = keys[Math.floor(Math.random() * keys.length)];
    return char === char.toLowerCase() ? pick : pick.toUpperCase();
  };

  // options: { text: [...], prefix, typingSpeed, deletingSpeed, pauseDuration, mistakes }
  window.createTextType = function (root, options) {
    const { text, prefix = '', typingSpeed = 50, deletingSpeed = 30, pauseDuration = 2000, mistakes = 0 } = options;

    root.classList.add('text-type');
    // viết liền một dòng: khung chữ dùng pre-wrap nên khoảng trắng thừa sẽ hiện ra
    root.innerHTML = '<span class="text-type__sr"></span>' +
      '<span class="text-type__content" aria-hidden="true"><span class="text-type__prefix"></span><span class="text-type__text"></span><span class="text-type__caret">​</span></span>' +
      '<span class="text-type__cursor" aria-hidden="true"><span class="text-type__blink"><span class="text-type__shape"></span></span></span>';
    root.querySelector('.text-type__sr').textContent = text.join('. ');
    root.querySelector('.text-type__prefix').textContent = prefix;

    const box = root.querySelector('.text-type__text');
    const caret = root.querySelector('.text-type__caret');
    const cursor = root.querySelector('.text-type__cursor');

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {   // tắt chuyển động: hiện đủ cả ba câu
      box.textContent = text.join(' · ');
      cursor.hidden = true;
      return;
    }

    let visible = false, timer = 0, index = 0, chars = [], last = null;

    // con trỏ lướt tới vị trí mới; xuống dòng thì nhảy thẳng
    function placeCursor() {
      const x = caret.offsetLeft, y = caret.offsetTop;
      cursor.classList.toggle('no-glide', !last || Math.abs(last.y - y) > 1);
      cursor.style.transform = `translate(${x}px, ${y}px)`;
      last = { x, y };
    }
    function addChar(char) {
      const span = document.createElement('span');
      span.className = 'text-type__char';
      span.textContent = char;
      box.append(span);
      if (span.animate) span.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.25,1,.5,1)' });
      placeCursor();
    }
    function removeChar() {
      if (box.lastChild) box.lastChild.remove();
      placeCursor();
    }
    function wait(ms, next) {
      timer = setTimeout(() => { if (visible) next(); else waitVisible(next); }, ms);
    }
    function waitVisible(next) {               // đang ẩn thì tạm dừng, không gõ phí
      timer = setTimeout(() => { if (visible) next(); else waitVisible(next); }, 300);
    }

    function typeNext(shown) {
      if (shown >= chars.length) { wait(pauseDuration, () => selectNext(0)); return; }
      const next = chars[shown];
      const wrong = mistakes > 0 && shown > 0 ? typoFor(next) : null;
      if (wrong && Math.random() < Math.min(1, mistakes) * 0.16) {
        // gõ nhầm một phím, khựng lại, xóa rồi gõ đúng
        wait(typingSpeed, () => {
          addChar(wrong);
          wait(260 + Math.random() * 320, () => {
            removeChar();
            wait(90 + Math.random() * 140, () => typeNext(shown));
          });
        });
        return;
      }
      wait(typingSpeed, () => { addChar(next); typeNext(shown + 1); });
    }
    // xóa kiểu bôi đen như trong trình soạn thảo, rồi xóa cả câu
    function selectNext(marked) {
      const nodes = box.children;
      if (marked < nodes.length) {
        nodes[nodes.length - 1 - marked].classList.add('text-type__char--selected');
        wait(deletingSpeed, () => selectNext(marked + 1));
      } else {
        wait(Math.max(160, deletingSpeed * 8), () => {
          box.textContent = '';
          placeCursor();
          index = (index + 1) % text.length;
          startSentence();
        });
      }
    }
    function startSentence() {
      chars = graphemes(text[index]);
      typeNext(0);
    }

    new IntersectionObserver(entries => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) placeCursor();
      if (visible && !timer) startSentence();
    }, { threshold: 0.1 }).observe(root);
  };
})();
