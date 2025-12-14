const mainSvg = document.getElementById('main-svg');
const clipDefs = mainSvg.querySelector('defs');
const scrollContainer = document.querySelector('div');
const activeState = { rect: null, zoomPart: null, animationId: null, clipPathId: null };
function updateDynamicSizes() {
    const images = mainSvg.querySelectorAll('image');
    if (!images.length) return;

    const firstImage = images[0];
    const imageWidth = parseFloat(firstImage.getAttribute('width')) || 1024;
    const imageHeight = parseFloat(firstImage.getAttribute('height')) || 2454;

    const totalWidth = images.length * imageWidth;

    mainSvg.setAttribute(
        'viewBox',
        `0 0 ${totalWidth} ${imageHeight}`
    );

    window.MAX_SCROLL_LEFT = totalWidth - window.innerWidth;
}

updateDynamicSizes();

scrollContainer.addEventListener('scroll', function () {
    if (this.scrollLeft > window.MAX_SCROLL_LEFT) {
    this.scrollLeft = window.MAX_SCROLL_LEFT;
}
});

function getCumulativeTranslate(element) {
    let x = 0, y = 0;
    let current = element;
    while (current && current.tagName !== 'svg') {
        const transformAttr = current.getAttribute('transform');
        if (transformAttr) {
            const match = transformAttr.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
            if (match) { x += parseFloat(match[1]); y += parseFloat(match[2]); }
        }
        current = current.parentNode;
    }
    return { x, y };
}

function getGroupImage(element) {
    let current = element;
    while (current && current.tagName !== 'svg') {
        if (current.tagName === 'g') {
            const images = [...current.children].filter(c => c.tagName === 'image');
            if (images.length) {
                const baseImage = images[0];
                return {
                    src: baseImage.getAttribute('href'),
                    width: parseFloat(baseImage.getAttribute('width')),
                    height: parseFloat(baseImage.getAttribute('height')),
                    group: current
                };
            }
        }
        current = current.parentNode;
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

    const currentClip = document.getElementById(activeState.clipPathId);
    if (currentClip) currentClip.remove();

    Object.assign(activeState, { rect: null, zoomPart: null, animationId: null, clipPathId: null });
}

function startHover() {
    const rect = this;

    if (activeState.rect === rect) return;
    cleanupHover();

    activeState.rect = rect;
    const i = rect.getAttribute('data-index') || Date.now();
    const clipPathId = `clip-${i}-${Date.now()}`;
    activeState.clipPathId = clipPathId;

    const scale = 1.1;
    const x = parseFloat(rect.getAttribute('x'));
    const y = parseFloat(rect.getAttribute('y'));
    const width = parseFloat(rect.getAttribute('width'));
    const height = parseFloat(rect.getAttribute('height'));

    const cumulative = getCumulativeTranslate(rect);
    const absoluteX = x + cumulative.x;
    const absoluteY = y + cumulative.y;

    const imageData = getGroupImage(rect);
    if (!imageData) return;

    let clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clip.setAttribute('id', clipPathId);
    let clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('x', absoluteX);
    clipRect.setAttribute('y', absoluteY);
    clipRect.setAttribute('width', width);
    clipRect.setAttribute('height', height);
    clipDefs.appendChild(clip).appendChild(clipRect);

    const zoomPart = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    zoomPart.setAttribute('href', imageData.src);
    zoomPart.setAttribute('width', imageData.width);
    zoomPart.setAttribute('height', imageData.height);
    zoomPart.setAttribute('class', 'zoom-part');
    zoomPart.setAttribute('clip-path', `url(#${clipPathId})`);

    const groupTransform = imageData.group.getAttribute('transform');
    const match = groupTransform ? groupTransform.match(/translate\(([\d.-]+),([\d.-]+)\)/) : null;
    const groupX = match ? parseFloat(match[1]) : 0;
    const groupY = match ? parseFloat(match[2]) : 0;

    zoomPart.setAttribute('x', groupX);
    zoomPart.setAttribute('y', groupY);

    zoomPart.style.opacity = 0;
    mainSvg.appendChild(zoomPart);
    activeState.zoomPart = zoomPart;

    const centerX = absoluteX + width / 2;
    const centerY = absoluteY + height / 2;

    rect.style.transformOrigin = `${x + width / 2}px ${y + height / 2}px`;
    rect.style.transform = `scale(${scale})`;
    rect.style.strokeWidth = '4px';

    zoomPart.style.transformOrigin = `${centerX}px ${centerY}px`;
    zoomPart.style.transform = `scale(${scale})`;
    zoomPart.style.opacity = 1;

    let hue = 0;
    const animationId = setInterval(() => {
        hue = (hue + 10) % 360;
        const glow = `drop-shadow(0 0 8px hsl(${hue},100%,55%)) drop-shadow(0 0 14px hsl(${(hue + 60) % 360},100%,60%))`;
        rect.style.filter = glow;
        zoomPart.style.filter = glow;
    }, 100);
    activeState.animationId = animationId;
}

function stopHover() {
    if (activeState.rect === this) {
        setTimeout(cleanupHover, 50);
    }
}

function attachHover(rect, i) {
    rect.setAttribute('data-index', i);

    rect.addEventListener('mouseover', startHover);
    rect.addEventListener('mouseout', stopHover);

    rect.addEventListener('touchstart', startHover);
    rect.addEventListener('touchend', cleanupHover);
}


    document.querySelectorAll('rect.image-mapper-shape').forEach(rect => {
    const href = rect.getAttribute('data-href') || '';
    const fileName = href.split('/').pop().split('#')[0] || '';

    const rectWidth  = parseFloat(rect.getAttribute('width'));
    const rectHeight = parseFloat(rect.getAttribute('height'));
    const rectX = parseFloat(rect.getAttribute('x'));
    const rectY = parseFloat(rect.getAttribute('y'));

    // إعدادات حجم الخط (ديناميكي)
    const minFont = 8;
    const maxFont = 16;
    const scaleFactor = 0.12;

    let fontSize = rectWidth * scaleFactor;
    fontSize = Math.max(minFont, Math.min(maxFont, fontSize));

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');

    // داخل المستطيل - أعلى المستطيل
    text.setAttribute('x', rectX + rectWidth / 2);          // توسيط أفقي
    text.setAttribute('y', rectY + fontSize + 6);           // مسافة من أعلى المستطيل
    text.setAttribute('text-anchor', 'middle');

    text.textContent = fileName;

    text.style.fontSize = fontSize + 'px';
    text.style.fill = 'white';
    text.style.pointerEvents = 'none';
    text.style.userSelect = 'none';

    rect.parentNode.appendChild(text);
});

document.querySelectorAll('rect.image-mapper-shape').forEach((rect, i) => {
    rect.setAttribute('data-processed', 'true');
    attachHover(rect, i);
});

const rootObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                if (node.matches('rect.image-mapper-shape') && !node.hasAttribute('data-processed')) {
                    attachHover(node, Date.now());
                    node.setAttribute('data-processed', 'true');
                }
                if (node.querySelector) {
                    node.querySelectorAll('rect.image-mapper-shape:not([data-processed])')
                        .forEach(rect => {
                            attachHover(rect, Date.now());
                            rect.setAttribute('data-processed', 'true');
                        });
                }
            }
        });
    });
});
rootObserver.observe(mainSvg, { childList: true, subtree: true });

function handleRectClick(event) {
    const targetRect = event.target.closest('.image-mapper-shape');
    if (targetRect) {
        const href = targetRect.getAttribute('data-href');
        if (href && href !== '#') {
            const isMobile =
                ('ontouchstart' in window) ||
                navigator.maxTouchPoints > 0 ||
                navigator.msMaxTouchPoints > 0 ||
                window.innerWidth < 800;

            if (isMobile) window.location.href = href;
            else window.open(href, '_blank');

            event.preventDefault();
        }
    }
}

mainSvg.addEventListener('click', handleRectClick);
function downloadFile(file) {
    const a = document.createElement('a');
    a.href = file;
    a.download = file.split('/').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function copyFullLink(file) {
    const basePath = location.origin + location.pathname.replace(/\/[^/]*$/, '/');
    const fullUrl = basePath + file;
    navigator.clipboard.writeText(fullUrl);
}

function isExternalLink(url) {
    return /^https?:\/\//i.test(url);
}