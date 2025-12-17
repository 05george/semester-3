window.onload = function () {
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const moveToggle = document.getElementById('move-toggle');
    const toggleContainer = document.getElementById('js-toggle-container');

    let interactionEnabled = jsToggle ? jsToggle.checked : true;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    const activeState = {
        rect: null, zoomPart: null, zoomText: null, baseText: null,
        animationId: null, clipPathId: null, initialScrollLeft: 0,
        isScrolling: false, touchStartTime: 0
    };

    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function getRectSize(rect) {
        let width = parseFloat(rect.getAttribute('width'));
        if (isNaN(width) && rect.classList.contains('w')) width = 114;
        if (isNaN(width)) {
            try { width = rect.getBBox().width || 114; } catch(e) { width = 114; }
        }
        let height = parseFloat(rect.getAttribute('height')) || 100;
        return { width, height };
    }

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
                        src: baseImage.getAttribute('data-src') || baseImage.getAttribute('href'),
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
        activeState.rect.style.filter = 'none';
        activeState.rect.style.transform = 'scale(1)';
        activeState.rect.style.strokeWidth = '2px';
        if (activeState.zoomPart) activeState.zoomPart.remove();
        if (activeState.zoomText) activeState.zoomText.remove();
        if (activeState.baseText) activeState.baseText.style.opacity = '1';
        const clip = document.getElementById(activeState.clipPathId);
        if (clip) clip.remove();
        Object.assign(activeState, { rect: null, zoomPart: null, zoomText: null, baseText: null, animationId: null, clipPathId: null });
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
        const cumulative = getCumulativeTranslate(rect);
        const absoluteX = x + cumulative.x;
        const absoluteY = y + cumulative.y;
        const centerX = absoluteX + size.width / 2;
        const centerY = absoluteY + size.height / 2;

        rect.style.transformOrigin = `${x + size.width / 2}px ${y + size.height / 2}px`;
        rect.style.transform = `scale(${scale})`;
        rect.style.strokeWidth = '4px';

        const imageData = getGroupImage(rect);
        if (imageData) {
            const clipId = `clip-${Date.now()}`;
            activeState.clipPathId = clipId;
            const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
            clip.setAttribute('id', clipId);
            const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            clipRect.setAttribute('x', absoluteX); clipRect.setAttribute('y', absoluteY);
            clipRect.setAttribute('width', size.width); clipRect.setAttribute('height', size.height);
            clipDefs.appendChild(clip).appendChild(clipRect);

            const zoomPart = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            zoomPart.setAttribute('href', imageData.src);
            zoomPart.setAttribute('width', imageData.width);
            zoomPart.setAttribute('height', imageData.height);
            zoomPart.setAttribute('clip-path', `url(#${clipId})`);
            const groupMatch = imageData.group.getAttribute('transform')?.match(/translate\(([\d.-]+),([\d.-]+)\)/);
            zoomPart.setAttribute('x', groupMatch ? groupMatch[1] : 0);
            zoomPart.setAttribute('y', groupMatch ? groupMatch[2] : 0);
            mainSvg.appendChild(zoomPart);
            activeState.zoomPart = zoomPart;
            zoomPart.style.transformOrigin = `${centerX}px ${centerY}px`;
            zoomPart.style.transform = `scale(${scale})`;
        }

        let baseText = rect.nextElementSibling;
        if (baseText && baseText.classList.contains('rect-label')) {
            baseText.style.opacity = '0';
            activeState.baseText = baseText;
            const zoomText = baseText.cloneNode(true);
            zoomText.style.opacity = '1';
            zoomText.style.fontSize = (parseFloat(baseText.style.fontSize) * 1.4) + 'px';
            zoomText.setAttribute('y', absoluteY - 10);
            zoomText.setAttribute('x', centerX);
            mainSvg.appendChild(zoomText);
            activeState.zoomText = zoomText;
        }

        let hue = 0;
        activeState.animationId = setInterval(() => {
            hue = (hue + 15) % 360;
            const glow = `drop-shadow(0 0 8px hsl(${hue},100%,60%))`;
            rect.style.filter = glow;
            if (activeState.zoomPart) activeState.zoomPart.style.filter = glow;
        }, 100);
    }

    function finishLoading() {
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
                mainSvg.style.opacity = '1';
                scrollContainer.scrollLeft = scrollContainer.scrollWidth;
            }, 500);
        }
    }

    // إدارة تحميل الصور وإخفاء شاشة التحميل
    const svgImages = mainSvg.querySelectorAll('image');
    let loadedCount = 0;
    if (svgImages.length === 0) finishLoading();
    svgImages.forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('href');
        const temp = new Image();
        temp.onload = temp.onerror = () => {
            loadedCount++;
            if (img.getAttribute('data-src')) img.setAttribute('href', src);
            if (loadedCount >= svgImages.length) finishLoading();
        };
        temp.src = src;
    });

    // معالجة المستطيلات الموجودة
    document.querySelectorAll('rect.image-mapper-shape').forEach((rect, i) => {
        const size = getRectSize(rect);
        const href = rect.getAttribute('data-href') || "";
        const name = href.split('/').pop().split('.')[0] || "Link";
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const fontSize = Math.max(9, Math.min(14, size.width * 0.12));
        text.setAttribute('x', parseFloat(rect.getAttribute('x')) + size.width / 2);
        text.setAttribute('y', parseFloat(rect.getAttribute('y')) + fontSize + 5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'rect-label');
        text.style.fontSize = fontSize + 'px';
        text.style.fill = 'white';
        text.textContent = name;
        
        rect.parentNode.insertBefore(text, rect.nextSibling);
        
        rect.addEventListener('mouseenter', startHover);
        rect.addEventListener('mouseleave', cleanupHover);
        rect.addEventListener('click', () => { if(href && href !== '#') window.open(href, '_blank'); });
    });

    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('rect.image-mapper-shape').forEach(r => {
                const match = (r.getAttribute('data-href') || "").toLowerCase().includes(q);
                r.style.opacity = q ? (match ? "1" : "0.1") : "1";
                if(r.nextElementSibling) r.nextElementSibling.style.opacity = r.style.opacity;
            });
        }, 200));
    }
};
