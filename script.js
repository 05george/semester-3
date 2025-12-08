const mainSvg = document.getElementById('main-svg');
const clipDefs = mainSvg.querySelector('defs');
const scrollContainer = document.querySelector('div');

const activeState = {
    rect: null,
    zoomPart: null,
    animationId: null,
    clipPathId: null
};

const MAX_SCROLL_LEFT = 6 * 1024;

// منع التمرير الزيادة
scrollContainer.addEventListener('scroll', function () {
    if (this.scrollLeft > MAX_SCROLL_LEFT) {
        this.scrollLeft = MAX_SCROLL_LEFT;
    }
});

// جمع التحويلات (translate)
function getCumulativeTranslate(element) {
    let x = 0, y = 0;
    let current = element;

    while (current && current.tagName !== 'svg') {
        const t = current.getAttribute('transform');
        if (t) {
            const match = t.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
            if (match) {
                x += parseFloat(match[1]);
                y += parseFloat(match[2]);
            }
        }
        current = current.parentNode;
    }

    return { x, y };
}

// جلب بيانات الصورة الخاصة بالـ group
function getGroupImage(element) {
    let current = element;
    while (current && current.tagName !== 'svg') {
        if (current.tagName === 'g') {
            const images = [...current.children].filter(c =>
                c.tagName === 'image' && (c.getAttribute('href') || c.getAttribute('xlink:href'))
            );
            if (images.length) {
                const img = images[0];
                return {
                    src: img.getAttribute('href') || img.getAttribute('xlink:href'),
                    width: parseFloat(img.getAttribute('width')),
                    height: parseFloat(img.getAttribute('height')),
                    group: current
                };
            }
        }
        current = current.parentNode;
    }
    return null;
}

// تنظيف المؤثرات السابقة
function cleanupHover() {
    if (!activeState.rect) return;

    if (activeState.animationId) clearInterval(activeState.animationId);

    activeState.rect.style.transform = 'scale(1)';
    activeState.rect.style.filter = 'none';
    activeState.rect.style.strokeWidth = '2px';

    if (activeState.zoomPart) activeState.zoomPart.remove();

    const oldClip = document.getElementById(activeState.clipPathId);
    if (oldClip) oldClip.remove();

    Object.assign(activeState, {
        rect: null,
        zoomPart: null,
        animationId: null,
        clipPathId: null
    });
}

// تركيب الهوفر على كل Rect
function attachHover(rect, index) {
    const clipPathId = `clip-${index}-${Date.now()}`;
    rect.setAttribute('data-index', index);

    rect.addEventListener('mouseenter', startHover);
    rect.addEventListener('mouseleave', stopHover);

    rect.addEventListener('touchstart', startHover);
    rect.addEventListener('touchend', cleanupHover);

    function startHover() {
        if (activeState.rect === rect) return;

        cleanupHover();
        activeState.rect = rect;
        activeState.clipPathId = clipPathId;

        const x = parseFloat(rect.getAttribute('x'));
        const y = parseFloat(rect.getAttribute('y'));
        const width = parseFloat(rect.getAttribute('width'));
        const height = parseFloat(rect.getAttribute('height'));

        const cumulative = getCumulativeTranslate(rect);
        const ax = x + cumulative.x;
        const ay = y + cumulative.y;

        const img = getGroupImage(rect);
        if (!img) return;

        // clipPath
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clip.setAttribute('id', clipPathId);

        const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clipRect.setAttribute('x', ax);
        clipRect.setAttribute('y', ay);
        clipRect.setAttribute('width', width);
        clipRect.setAttribute('height', height);

        clip.appendChild(clipRect);
        clipDefs.appendChild(clip);

        // zoom layer
        const zoom = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        zoom.setAttribute('href', img.src);
        zoom.setAttribute('width', img.width);
        zoom.setAttribute('height', img.height);
        zoom.setAttribute('clip-path', `url(#${clipPathId})`);
        zoom.style.opacity = 0;

        const t = img.group.getAttribute('transform');
        const match = t ? t.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/) : null;

        zoom.setAttribute('x', match ? parseFloat(match[1]) : 0);
        zoom.setAttribute('y', match ? parseFloat(match[2]) : 0);

        mainSvg.appendChild(zoom);

        activeState.zoomPart = zoom;

        const scale = 1.1;

        rect.style.transform = `scale(${scale})`;
        zoom.style.transform = `scale(${scale})`;
        zoom.style.opacity = 1;

        let hue = 0;
        activeState.animationId = setInterval(() => {
            hue = (hue + 3) % 360;
            const glow = `drop-shadow(0 0 7px hsl(${hue},100%,60%))`;
            rect.style.filter = glow;
            zoom.style.filter = glow;
        }, 60);
    }

    function stopHover(e) {
        if (e.type === "mouseleave") cleanupHover();
    }
}

// تركيب الهوفر على العناصر الأساسية
document.querySelectorAll('rect.image-mapper-shape').forEach((rect, i) => {
    rect.setAttribute('data-processed', 'true');
    attachHover(rect, i);
});

// رصد العناصر الجديدة (لو الصور بتتغير دايناميك)
new MutationObserver(muts => {
    for (const m of muts)
        for (const n of m.addedNodes)
            if (n.nodeType === 1) {
                if (n.matches('rect.image-mapper-shape') && !n.hasAttribute('data-processed')) {
                    attachHover(n, Date.now());
                    n.setAttribute('data-processed', 'true');
                }
                if (n.querySelectorAll)
                    n.querySelectorAll('rect.image-mapper-shape:not([data-processed])')
                        .forEach(r => {
                            attachHover(r, Date.now());
                            r.setAttribute('data-processed', 'true');
                        });
            }
}).observe(mainSvg, { childList: true, subtree: true });

// فتح الروابط
mainSvg.addEventListener('click', e => {
    const rect = e.target.closest('.image-mapper-shape');
    if (!rect) return;

    const href = rect.getAttribute('data-href');
    if (!href || href === '#') return;

    const isMobile =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth < 900;

    if (isMobile) window.location.href = href;
    else window.open(href, "_blank");

    e.preventDefault();
});