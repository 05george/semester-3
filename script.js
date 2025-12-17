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
    baseText: null,
    animationId: null,
    clipPathId: null,
    initialScrollLeft: 0,
    isScrolling: false,
    touchStartTime: 0
  };

  /* =========================
     🔧 FIX: قراءة أبعاد rect
     ========================= */
  function getRectSize(rect) {
    const w = rect.getAttribute('width');
    const h = rect.getAttribute('height');

    if (w && h) {
      return {
        width: parseFloat(w),
        height: parseFloat(h)
      };
    }

    const bbox = rect.getBBox();
    return {
      width: bbox.width,
      height: bbox.height
    };
  }

  function debounce(fn, delay) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, arguments), delay);
    };
  }

  function updateDynamicSizes() {
    const images = mainSvg.querySelectorAll('image');
    if (!images.length) return;

    const first = images[0];
    const w = parseFloat(first.getAttribute('width')) || 1024;
    const h = parseFloat(first.getAttribute('height')) || 2454;
    const totalW = images.length * w;

    mainSvg.setAttribute('viewBox', `0 0 ${totalW} ${h}`);
    window.MAX_SCROLL_LEFT = totalW - window.innerWidth;
  }
  updateDynamicSizes();

  scrollContainer.addEventListener('scroll', function () {
    if (this.scrollLeft > window.MAX_SCROLL_LEFT) {
      this.scrollLeft = window.MAX_SCROLL_LEFT;
    }
    if (!interactionEnabled) return;

    if (activeState.rect && !isTouchDevice) cleanupHover();

    if (activeState.rect && isTouchDevice) {
      if (Math.abs(this.scrollLeft - activeState.initialScrollLeft) > 5) {
        activeState.isScrolling = true;
        cleanupHover();
      }
    }
  });

  function getCumulativeTranslate(el) {
    let x = 0, y = 0;
    while (el && el.tagName !== 'svg') {
      const t = el.getAttribute('transform');
      if (t) {
        const m = t.match(/translate\(([\d.-]+)[ ,]+([\d.-]+)\)/);
        if (m) {
          x += parseFloat(m[1]);
          y += parseFloat(m[2]);
        }
      }
      el = el.parentNode;
    }
    return { x, y };
  }

  function getGroupImage(el) {
    while (el && el.tagName !== 'svg') {
      if (el.tagName === 'g') {
        const img = el.querySelector('image');
        if (img) {
          return {
            src: img.getAttribute('data-src') || img.getAttribute('href'),
            width: parseFloat(img.getAttribute('width')),
            height: parseFloat(img.getAttribute('height')),
            group: el
          };
        }
      }
      el = el.parentNode;
    }
    return null;
  }

  function cleanupHover() {
    if (!activeState.rect) return;

    if (activeState.animationId) clearInterval(activeState.animationId);
    activeState.rect.style.transform = 'scale(1)';
    activeState.rect.style.filter = 'none';
    activeState.rect.style.strokeWidth = '2px';

    if (activeState.zoomPart) activeState.zoomPart.remove();
    if (activeState.zoomText) activeState.zoomText.remove();
    if (activeState.baseText) activeState.baseText.style.opacity = '1';

    const clip = document.getElementById(activeState.clipPathId);
    if (clip) clip.remove();

    Object.assign(activeState, {
      rect: null,
      zoomPart: null,
      zoomText: null,
      baseText: null,
      animationId: null,
      clipPathId: null
    });
  }

  function startHover() {
    if (!interactionEnabled) return;
    cleanupHover();

    const rect = this;
    activeState.rect = rect;

    const { width, height } = getRectSize(rect);
    const x = parseFloat(rect.getAttribute('x'));
    const y = parseFloat(rect.getAttribute('y'));
    const scale = 1.1;

    const c = getCumulativeTranslate(rect);
    const absX = x + c.x;
    const absY = y + c.y;
    const cx = absX + width / 2;
    const cy = absY + height / 2;

    rect.style.transformOrigin = `${x + width / 2}px ${y + height / 2}px`;
    rect.style.transform = `scale(${scale})`;
    rect.style.strokeWidth = '4px';

    const imageData = getGroupImage(rect);
    if (imageData) {
      const clipId = `clip-${Date.now()}`;
      activeState.clipPathId = clipId;

      const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
      clip.setAttribute('id', clipId);

      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', absX);
      r.setAttribute('y', absY);
      r.setAttribute('width', width);
      r.setAttribute('height', height);

      clip.appendChild(r);
      clipDefs.appendChild(clip);

      const zoom = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      zoom.setAttribute('href', imageData.src);
      zoom.setAttribute('width', imageData.width);
      zoom.setAttribute('height', imageData.height);
      zoom.setAttribute('clip-path', `url(#${clipId})`);
      zoom.setAttribute('class', 'zoom-part');

      const gt = imageData.group.getAttribute('transform');
      if (gt) {
        const m = gt.match(/translate\(([\d.-]+),([\d.-]+)\)/);
        if (m) {
          zoom.setAttribute('x', m[1]);
          zoom.setAttribute('y', m[2]);
        }
      }

      zoom.style.transformOrigin = `${cx}px ${cy}px`;
      zoom.style.transform = `scale(${scale})`;
      mainSvg.appendChild(zoom);
      activeState.zoomPart = zoom;
    }

    let hue = 0;
    activeState.animationId = setInterval(() => {
      hue = (hue + 10) % 360;
      rect.style.filter = `drop-shadow(0 0 8px hsl(${hue},100%,60%))`;
      if (activeState.zoomPart) {
        activeState.zoomPart.style.filter = rect.style.filter;
      }
    }, 100);
  }

  function stopHover() {
    if (interactionEnabled) cleanupHover();
  }

  function handleLinkOpen(e) {
    const href = e.currentTarget.getAttribute('data-href');
    if (href && href !== '#') {
      window.open(href, '_blank');
      e.preventDefault();
    }
  }

  function attachHover(rect) {
    if (!isTouchDevice) {
      rect.addEventListener('mouseover', startHover);
      rect.addEventListener('mouseout', stopHover);
    }

    rect.addEventListener('click', handleLinkOpen);

    rect.addEventListener('touchstart', () => {
      activeState.initialScrollLeft = scrollContainer.scrollLeft;
      activeState.isScrolling = false;
      activeState.touchStartTime = Date.now();
      startHover.call(rect);
    });

    rect.addEventListener('touchend', e => {
      const dt = Date.now() - activeState.touchStartTime;
      if (!activeState.isScrolling && dt < TAP_THRESHOLD_MS) {
        handleLinkOpen(e);
      }
      cleanupHover();
    });
  }

  /* =========================
     Labels
     ========================= */
  document.querySelectorAll('rect.image-mapper-shape').forEach(rect => {
    const { width } = getRectSize(rect);
    const x = parseFloat(rect.getAttribute('x'));
    const y = parseFloat(rect.getAttribute('y'));

    const fontSize = Math.max(8, Math.min(16, width * 0.12));
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');

    text.setAttribute('x', x + width / 2);
    text.setAttribute('y', y + fontSize);
    text.setAttribute('text-anchor', 'middle');
    text.textContent = (rect.getAttribute('data-href') || '').split('/').pop();
    text.style.fontSize = fontSize + 'px';
    text.style.fill = 'white';
    text.style.pointerEvents = 'none';
    text.setAttribute('class', 'rect-label');

    rect.parentNode.insertBefore(text, rect.nextSibling);
  });

  document.querySelectorAll('rect.image-mapper-shape').forEach(attachHover);

  jsToggle.addEventListener('change', function () {
    interactionEnabled = this.checked;
    if (!interactionEnabled) cleanupHover();
  });
};