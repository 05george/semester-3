window.onload = function() {
    const dimensions = { 'w': 115, 'hw': 57 };
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const clipDefs = mainSvg.querySelector('defs') || mainSvg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'defs'));

    if (!mainSvg) return;

    // 1. ضبط الأبعاد الأولية
    Object.keys(dimensions).forEach(className => {
        document.querySelectorAll(`rect.${className}`).forEach(rect => {
            rect.setAttribute('width', dimensions[className]);
        });
    });

    let interactionEnabled = jsToggle ? jsToggle.checked : true;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const activeState = { rect: null, zoomPart: null, zoomText: null, baseText: null, animationId: null, clipPathId: null };

    // 2. منطق الحسابات الفيزيائية للمواقع (مهم جداً للهوفر الدقيق)
    function getCumulativeTranslate(element) {
        let x = 0, y = 0;
        let current = element;
        while (current && current.tagName !== 'svg') {
            const transform = current.getAttribute('transform');
            if (transform) {
                const match = transform.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
                if (match) {
                    x += parseFloat(match[1]);
                    y += parseFloat(match[2]);
                }
            }
            current = current.parentNode;
        }
        return { x, y };
    }

    function getGroupImage(element) {
        let current = element;
        while (current && current.tagName !== 'svg') {
            if (current.tagName === 'g') {
                const img = Array.from(current.children).find(c => c.tagName === 'image');
                if (img) return { 
                    src: img.getAttribute('data-src') || img.getAttribute('href'),
                    w: parseFloat(img.getAttribute('width')),
                    h: parseFloat(img.getAttribute('height')),
                    group: current 
                };
            }
            current = current.parentNode;
        }
        return null;
    }

    // 3. منطق الهوفر والزوم (إعادة البناء الكامل)
    function cleanupHover() {
        if (!activeState.rect) return;
        if (activeState.animationId) clearInterval(activeState.animationId);
        activeState.rect.style.filter = 'none';
        activeState.rect.style.transform = 'scale(1)';
        if (activeState.zoomPart) activeState.zoomPart.remove();
        if (activeState.zoomText) activeState.zoomText.remove();
        if (activeState.baseText) activeState.baseText.style.opacity = '1';
        const clip = document.getElementById(activeState.clipPathId);
        if (clip) clip.remove();
        Object.assign(activeState, { rect: null, zoomPart: null, zoomText: null, baseText: null, animationId: null });
    }

    function startHover() {
        if (!interactionEnabled || activeState.rect === this) return;
        cleanupHover();
        const rect = this;
        activeState.rect = rect;

        const scale = 1.1;
        const x = parseFloat(rect.getAttribute('x')), y = parseFloat(rect.getAttribute('y'));
        const w = parseFloat(rect.getAttribute('width')), h = parseFloat(rect.getAttribute('height'));
        const offset = getCumulativeTranslate(rect);
        const absX = x + offset.x, absY = y + offset.y;

        rect.style.transformOrigin = `${x + w/2}px ${y + h/2}px`;
        rect.style.transform = `scale(${scale})`;

        const imageData = getGroupImage(rect);
        if (imageData) {
            const clipId = `clip-${Date.now()}`;
            activeState.clipPathId = clipId;
            const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
            clip.setAttribute('id', clipId);
            const cr = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            cr.setAttribute('x', absX); cr.setAttribute('y', absY); cr.setAttribute('width', w); cr.setAttribute('height', h);
            clipDefs.appendChild(clip).appendChild(cr);

            const zp = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            zp.setAttribute('href', imageData.src);
            zp.setAttribute('width', imageData.w); zp.setAttribute('height', imageData.h);
            zp.setAttribute('clip-path', `url(#${clipId})`);
            zp.setAttribute('class', 'zoom-part');
            
            const gTrans = getCumulativeTranslate(imageData.group);
            zp.setAttribute('x', gTrans.x); zp.setAttribute('y', gTrans.y);
            
            mainSvg.appendChild(zp);
            activeState.zoomPart = zp;
            zp.style.transformOrigin = `${absX + w/2}px ${absY + h/2}px`;
            zp.style.transform = `scale(${scale})`;
        }

        // إضاءة متغيرة (RGB Glow)
        let hue = 0;
        activeState.animationId = setInterval(() => {
            hue = (hue + 10) % 360;
            const glow = `drop-shadow(0 0 8px hsl(${hue},100%,60%))`;
            rect.style.filter = glow;
            if (activeState.zoomPart) activeState.zoomPart.style.filter = glow;
        }, 100);
    }

    // 4. معالجة النصوص والروابط
    document.querySelectorAll('rect.m').forEach((rect, i) => {
        const href = rect.getAttribute('data-href') || '';
        const fileName = href.split('/').pop().split('#')[0] || '';
        const textContent = fileName.split('.')[0] || '';
        const rW = parseFloat(rect.getAttribute('width')), rX = parseFloat(rect.getAttribute('x')), rY = parseFloat(rect.getAttribute('y'));
        const fSize = Math.max(8, Math.min(13, rW * 0.12));

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', rX + rW / 2);
        text.setAttribute('y', rY + fSize * 1.5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'rect-label');
        text.style.fontSize = fSize + 'px';
        text.style.fill = 'white';
        text.style.pointerEvents = 'none';
        text.textContent = textContent;
        rect.parentNode.insertBefore(text, rect.nextSibling);

        rect.addEventListener('mouseenter', startHover);
        rect.addEventListener('mouseleave', cleanupHover);
        rect.addEventListener('click', () => { if(href && href !== '#') window.open(href, '_blank'); });
    });

    // 5. منطق التحميل الكسول (Lazy Loading)
    const allImages = Array.from(mainSvg.querySelectorAll('image'));
    const criticalImages = allImages.filter(img => !img.classList.contains('lazy-map'));
    let criticalLoaded = 0;

    function finishLoading() {
        if (loadingOverlay && loadingOverlay.style.display !== 'none') {
            loadingOverlay.style.opacity = 0;
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
                mainSvg.style.opacity = 1;
                scrollContainer.scrollLeft = scrollContainer.scrollWidth;
                allImages.forEach(img => {
                    const url = img.getAttribute('data-src') || img.getAttribute('href');
                    if (url) img.setAttribute('href', url);
                });
            }, 300);
        }
    }

    if (criticalImages.length === 0) finishLoading();
    else {
        criticalImages.forEach(svgImg => {
            const url = svgImg.getAttribute('data-src') || svgImg.getAttribute('href');
            const img = new Image();
            img.onload = img.onerror = () => {
                criticalLoaded++;
                if (criticalLoaded >= criticalImages.length) finishLoading();
            };
            img.src = url;
        });
    }
    setTimeout(finishLoading, 6000);

    // البحث والتبديل
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const q = this.value.toLowerCase();
            document.querySelectorAll('rect.m').forEach(r => {
                const l = r.nextElementSibling;
                const match = r.getAttribute('data-href')?.toLowerCase().includes(q) || l?.textContent.toLowerCase().includes(q);
                r.style.opacity = (q === "" || match) ? "1" : "0.1";
                if(l) l.style.opacity = (q === "" || match) ? "1" : "0.1";
            });
        });
    }

    jsToggle.addEventListener('change', function() {
        interactionEnabled = this.checked;
        if (!interactionEnabled) cleanupHover();
    });
};