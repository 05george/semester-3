window.onload = function () {

const mainSvg = document.getElementById('main-svg');
const scrollContainer = document.getElementById('scroll-container');
const clipDefs = mainSvg.querySelector('defs');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const jsToggle = document.getElementById('js-toggle');
const searchInput = document.getElementById('search-input');

let interactionEnabled = jsToggle.checked;
const isTouchDevice = window.matchMedia('(hover: none)').matches;
const TAP_THRESHOLD_MS = 300;

const activeState = {
  rect: null,
  zoomPart: null,
  zoomText: null,
  zoomTextBg: null,
  baseText: null,
  animationId: null,
  clipPathId: null,
  initialScrollLeft: 0,
  isScrolling: false,
  touchStartTime: 0
};

function debounce(func, delay) {
  let timeout;
  return function () {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, arguments), delay);
  };
}

function updateDynamicSizes() {
  const images = mainSvg.querySelectorAll('image');
  if (!images.length) return;
  const w = parseFloat(images[0].getAttribute('width')) || 1024;
  const h = parseFloat(images[0].getAttribute('height')) || 2454;
  mainSvg.setAttribute('viewBox', `0 0 ${images.length * w} ${h}`);
  window.MAX_SCROLL_LEFT = images.length * w - window.innerWidth;
}
updateDynamicSizes();

function cleanupHover() {
  if (!activeState.rect) return;

  if (activeState.animationId) clearInterval(activeState.animationId);

  if (activeState.zoomPart) activeState.zoomPart.remove();
  if (activeState.zoomText) activeState.zoomText.remove();
  if (activeState.zoomTextBg) activeState.zoomTextBg.remove();

  const clip = document.getElementById(activeState.clipPathId);
  if (clip) clip.remove();

  activeState.rect.style.transform = 'scale(1)';
  activeState.rect.style.strokeWidth = '2px';
  activeState.rect.style.filter = 'none';

  if (activeState.baseText) activeState.baseText.style.opacity = '1';

  Object.assign(activeState, {
    rect: null,
    zoomPart: null,
    zoomText: null,
    zoomTextBg: null,
    baseText: null,
    animationId: null,
    clipPathId: null,
    initialScrollLeft: 0,
    isScrolling: false,
    touchStartTime: 0
  });
}

function getCumulativeTranslate(el) {
  let x = 0, y = 0;
  while (el && el.tagName !== 'svg') {
    const t = el.getAttribute('transform');
    if (t) {
      const m = t.match(/translate\(([\d.-]+)[ ,]+([\d.-]+)\)/);
      if (m) { x += +m[1]; y += +m[2]; }
    }
    el = el.parentNode;
  }
  return { x, y };
}

function startHover() {
  if (!interactionEnabled) return;
  if (activeState.rect === this) return;

  cleanupHover();
  activeState.rect = this;

  const rect = this;
  const scale = 1.1;
  const x = +rect.getAttribute('x');
  const y = +rect.getAttribute('y');
  const w = +rect.getAttribute('width');
  const h = +rect.getAttribute('height');

  const t = getCumulativeTranslate(rect);
  const absX = x + t.x;
  const absY = y + t.y;

  rect.style.transformOrigin = `${x + w / 2}px ${y + h / 2}px`;
  rect.style.transform = `scale(${scale})`;
  rect.style.strokeWidth = '4px';

  const baseText = rect.nextElementSibling;
  if (baseText && baseText.classList.contains('rect-label')) {
    baseText.style.opacity = '0';
    activeState.baseText = baseText;

    const zoomText = baseText.cloneNode(true);
    const fullText =
      rect.getAttribute('data-full-text') ||
      baseText.getAttribute('data-original-text');

    zoomText.textContent = fullText;
    zoomText.style.fontSize =
      (parseFloat(baseText.style.fontSize) * 2) + 'px';
    zoomText.style.fill = 'white';
    zoomText.style.pointerEvents = 'none';
    zoomText.style.opacity = '1';

    zoomText.setAttribute('x', absX + w / 2);
    zoomText.setAttribute('y', absY + 40);
    zoomText.setAttribute('text-anchor', 'middle');

    mainSvg.appendChild(zoomText);

    const box = zoomText.getBBox();
    const pad = 10;

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', box.x - pad);
    bg.setAttribute('y', box.y - pad);
    bg.setAttribute('width', box.width + pad * 2);
    bg.setAttribute('height', box.height + pad * 2);
    bg.setAttribute('rx', 6);
    bg.setAttribute('ry', 6);
    bg.setAttribute('fill', 'rgba(0,0,0,0.85)');
    bg.style.pointerEvents = 'none';

    mainSvg.insertBefore(bg, zoomText);

    activeState.zoomText = zoomText;
    activeState.zoomTextBg = bg;
  }

  let hue = 0;
  activeState.animationId = setInterval(() => {
    hue = (hue + 10) % 360;
    const glow = `drop-shadow(0 0 8px hsl(${hue},100%,55%))`;
    rect.style.filter = glow;
    if (activeState.zoomText) activeState.zoomText.style.filter = glow;
    if (activeState.zoomTextBg) activeState.zoomTextBg.style.filter = glow;
  }, 100);
}

function stopHover() {
  if (activeState.rect === this) cleanupHover();
}

function attachHover(rect) {
  if (!isTouchDevice) {
    rect.addEventListener('mouseover', startHover);
    rect.addEventListener('mouseout', stopHover);
  }

  rect.addEventListener('touchstart', e => {
    activeState.touchStartTime = Date.now();
    activeState.initialScrollLeft = scrollContainer.scrollLeft;
    startHover.call(rect);
  });

  rect.addEventListener('touchend', e => {
    if (Date.now() - activeState.touchStartTime < TAP_THRESHOLD_MS)
      rect.click();
    cleanupHover();
  });
}

document.querySelectorAll('rect.image-mapper-shape').forEach(attachHover);

jsToggle.addEventListener('change', function () {
  interactionEnabled = this.checked;
  if (!interactionEnabled) cleanupHover();
});

};