window.onload = function () {

const mainSvg = document.getElementById('main-svg');
const scrollContainer = document.getElementById('scroll-container');
const loadingOverlay = document.getElementById('loading-overlay');

if (!mainSvg || !scrollContainer || !loadingOverlay) {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    return;
}

const clipDefs = mainSvg.querySelector('defs');

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

function debounce(fn, delay) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), delay);
    };
}

function updateDynamicSizes() {
    const images = mainSvg.querySelectorAll('image');
    if (!images.length) return;

    const w = parseFloat(images[0].getAttribute('width')) || 1024;
    const h = parseFloat(images[0].getAttribute('height')) || 2454;
    const totalWidth = images.length * w;

    mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${h}`);
    window.MAX_SCROLL_LEFT = totalWidth - window.innerWidth;
}

updateDynamicSizes();

function lazyLoadImage(img) {
    if (img.hasAttribute('data-loading') || img.getAttribute('href')) return;

    const src = img.getAttribute('data-src');
    img.setAttribute('data-loading', '1');
    img.removeAttribute('data-src');
    img.setAttribute('href', src);

    const g = img.closest('g');
    const t = g?.getAttribute('transform') || '';
    const m = t.match(/translate\(([\d.-]+)/);
    const week = m ? Math.round(parseFloat(m[1]) / 1024) + 1 : 0;

    const overlay = mainSvg.querySelector(`.lazy-loading-overlay[data-loading-week="${week}"]`);
    const text = mainSvg.querySelector(`.lazy-loading-text[data-loading-week="${week}"]`);

    img.onload = () => {
        if (overlay) overlay.remove();
        if (text) text.remove();
        img.removeAttribute('data-loading');
    };
}

function checkLazyLoad() {
    const left = scrollContainer.scrollLeft;
    const vw = window.innerWidth;

    mainSvg.querySelectorAll('image[data-src]').forEach(img => {
        const g = img.closest('g');
        const t = g?.getAttribute('transform') || '';
        const m = t.match(/translate\(([\d.-]+)/);
        const x = m ? parseFloat(m[1]) : 0;

        if (x < left + vw * 2) lazyLoadImage(img);
    });
}

scrollContainer.addEventListener('scroll', () => {
    if (scrollContainer.scrollLeft > window.MAX_SCROLL_LEFT)
        scrollContainer.scrollLeft = window.MAX_SCROLL_LEFT;

    if (activeState.rect && isTouchDevice) cleanupHover();
    checkLazyLoad();
});

checkLazyLoad();

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

    Object.keys(activeState).forEach(k => activeState[k] = null);
}

function startHover() {
    if (isTouchDevice) return;

    const rect = this;
    if (activeState.rect === rect) return;
    cleanupHover();
    activeState.rect = rect;

    const image = rect.closest('g').querySelector('image[href]');
    if (!image) return;

    const clipId = 'clip-' + Date.now();
    activeState.clipPathId = clipId;

    const x = +rect.getAttribute('x');
    const y = +rect.getAttribute('y');
    const w = +rect.getAttribute('width');
    const h = +rect.getAttribute('height');

    const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clip.setAttribute('id', clipId);

    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', x);
    r.setAttribute('y', y);
    r.setAttribute('width', w);
    r.setAttribute('height', h);

    clip.appendChild(r);
    clipDefs.appendChild(clip);

    const zoom = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    zoom.setAttribute('href', image.getAttribute('href'));
    zoom.setAttribute('width', image.getAttribute('width'));
    zoom.setAttribute('height', image.getAttribute('height'));
    zoom.setAttribute('clip-path', `url(#${clipId})`);
    zoom.classList.add('zoom-part');

    mainSvg.appendChild(zoom);
    activeState.zoomPart = zoom;

    rect.style.transform = 'scale(1.1)';
    rect.style.strokeWidth = '4px';
}

function stopHover() {
    if (!isTouchDevice) cleanupHover();
}

function handleLink(e) {
    const href = this.getAttribute('href');
    if (href && href !== '#') {
        window.open(href, '_blank');
        e.preventDefault();
    }
}

document.querySelectorAll('rect.image-mapper-shape').forEach((rect, i) => {
    rect.addEventListener('mouseover', startHover);
    rect.addEventListener('mouseout', stopHover);
    rect.addEventListener('click', handleLink);
});

function finishLoading() {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => loadingOverlay.style.display = 'none', 500);
    mainSvg.style.opacity = '1';
}

finishLoading();

};