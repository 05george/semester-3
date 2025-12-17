window.onload = function () {

    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');

    let interactionEnabled = jsToggle ? jsToggle.checked : true;

    const RECT_WIDTH_MAP = { w: 114, wh: 57 };

    const activeState = { rect: null, zoomPart: null, baseText: null, zoomText: null, clipPathId: null, animationId: null };

    function debounce(fn, delay) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), delay); }; }

    function getRectSize(rect) {
        let width = parseFloat(rect.getAttribute('width'));
        if (isNaN(width)) {
            for (const cls in RECT_WIDTH_MAP) if (rect.classList.contains(cls)) { width = RECT_WIDTH_MAP[cls]; break; }
        }
        if (isNaN(width)) width = 114;
        const height = parseFloat(rect.getAttribute('height')) || 100;
        return { width, height };
    }

    function getCumulativeTranslate(el) {
        let x = 0, y = 0;
        while (el && el.tagName !== 'svg') {
            const t = el.getAttribute('transform');
            if (t) {
                const m = t.match(/translate\(([\d.-]+)[ ,]+([\d.-]+)\)/);
                if (m) { x += parseFloat(m[1]); y += parseFloat(m[2]); }
            }
            el = el.parentNode;
        }
        return { x, y };
    }

    function getGroupImage(rect) {
        let el = rect;
        while (el && el.tagName !== 'svg') {
            if (el.tagName === 'g') {
                const img = el.querySelector('image');
                if (img) return { src: img.getAttribute('data-src') || img.getAttribute('href'), width: parseFloat(img.getAttribute('width')), height: parseFloat(img.getAttribute('height')), group: el };
            }
            el = el.parentNode;
        }
        return null;
    }

    function cleanupHover() {
        if (!activeState.rect) return;
        if (activeState.animationId) cancelAnimationFrame(activeState.animationId);
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
        if (!interactionEnabled) return;
        const rect = this;
        if (activeState.rect === rect) return;
        cleanupHover();
        activeState.rect = rect;

        const scale = 1.1;
        const size = getRectSize(rect);
        const x = parseFloat(rect.getAttribute('x')) || 0;
        const y = parseFloat(rect.getAttribute('y')) || 0;
        const t = getCumulativeTranslate(rect);
        const absX = x + t.x;
        const absY = y + t.y;

        rect.style.transformOrigin = `${x + size.width / 2}px ${y + size.height / 2}px`;
        rect.style.transition = 'transform 0.3s ease, stroke-width 0.3s ease, filter 0.3s ease';
        rect.style.transform = `scale(${scale})`;
        rect.style.strokeWidth = '4px';

        const imageData = getGroupImage(rect);
        if (imageData) {
            const clipId = `clip-${Date.now()}`;
            activeState.clipPathId = clipId;
            const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
            clip.setAttribute('id', clipId);
            const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            clipRect.setAttribute('x', absX);
            clipRect.setAttribute('y', absY);
            clipRect.setAttribute('width', size.width);
            clipRect.setAttribute('height', size.height);
            clip.appendChild(clipRect);
            clipDefs.appendChild(clip);

            const zoomImg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            zoomImg.setAttribute('href', imageData.src);
            zoomImg.setAttribute('width', imageData.width);
            zoomImg.setAttribute('height', imageData.height);
            zoomImg.setAttribute('clip-path', `url(#${clipId})`);

            const gT = imageData.group.getAttribute('transform');
            if (gT) {
                const m = gT.match(/translate\(([\d.-]+),([\d.-]+)\)/);
                if (m) { zoomImg.setAttribute('x', m[1]); zoomImg.setAttribute('y', m[2]); }
            }

            zoomImg.style.transformOrigin = `${absX + size.width / 2}px ${absY + size.height / 2}px`;
            zoomImg.style.transition = 'transform 0.3s ease, filter 0.3s ease';
            zoomImg.style.transform = `scale(${scale})`;
            mainSvg.appendChild(zoomImg);
            activeState.zoomPart = zoomImg;
        }

        const label = rect.nextElementSibling;
        if (label && label.classList.contains('rect-label')) {
            label.style.opacity = '0';
            activeState.baseText = label;
            const clone = label.cloneNode(true);
            clone.style.opacity = '1';
            clone.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            clone.setAttribute('x', absX + size.width / 2);
            clone.setAttribute('y', absY - 10);
            mainSvg.appendChild(clone);
            activeState.zoomText = clone;
        }

        let hue = 0;
        function animateGlow() {
            hue = (hue + 2) % 360;
            const glow = `drop-shadow(0 0 8px hsl(${hue},100%,60%))`;
            rect.style.filter = glow;
            if (activeState.zoomPart) activeState.zoomPart.style.filter = glow;
            activeState.animationId = requestAnimationFrame(animateGlow);
        }
        animateGlow();
    }

    // IMAGE LOADING
    const images = mainSvg.querySelectorAll('image');
    let loaded = 0;
    function finishLoading() {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => { loadingOverlay.style.display = 'none'; mainSvg.style.opacity = '1'; scrollContainer.scrollLeft = 0; }, 400);
    }
    images.forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('href');
        const temp = new Image();
        temp.onload = temp.onerror = () => { loaded++; if (img.hasAttribute('data-src')) img.setAttribute('href', src); if (loaded === images.length) finishLoading(); };
        temp.src = src;
    });

    // INIT RECTANGLES
    document.querySelectorAll('rect.image-mapper-shape').forEach(rect => {
        const size = getRectSize(rect);
        const href = rect.getAttribute('data-href') || '';
        const name = href.split('/').pop().replace('.pdf', '');
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', (parseFloat(rect.getAttribute('x')) || 0) + size.width / 2);
        text.setAttribute('y', (parseFloat(rect.getAttribute('y')) || 0) + 14);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'rect-label');
        text.style.fill = 'white';
        text.style.fontSize = '12px';
        text.textContent = name;
        rect.parentNode.insertBefore(text, rect.nextSibling);
        rect.addEventListener('mouseenter', startHover);
        rect.addEventListener('mouseleave', cleanupHover);
        rect.addEventListener('click', () => { if (href && href !== '#') window.open(href, '_blank'); });
    });

    // SEARCH
    if (searchInput) {
        searchInput.addEventListener('input', debounce(e => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('rect.image-mapper-shape').forEach(r => {
                const match = (r.getAttribute('data-href') || '').toLowerCase().includes(q);
                const o = q ? (match ? '1' : '0.15') : '1';
                r.style.opacity = o;
                if (r.nextElementSibling) r.nextElementSibling.style.opacity = o;
            });
        }, 200));
    }

};