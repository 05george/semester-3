window.onload = function () {
    // 1. تهيئة العناصر الأساسية
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const moveToggle = document.getElementById('move-toggle');
    const toggleContainer = document.getElementById('js-toggle-container');

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

    // 2. دالة Debounce لتحسين الأداء
    function debounce(func, delay) {
        let timeoutId;
        return function () {
            const context = this;
            const args = arguments;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // 3. دالة الحصول على حجم المستطيل (دعم الكلاس w)
    function getRectSize(rect) {
        let width, height;
        const attrWidth = rect.getAttribute('width');
        
        if (attrWidth && attrWidth !== "") {
            width = parseFloat(attrWidth);
        } else if (rect.classList.contains('w')) {
            width = 114; // القيمة الثابتة للكلاس w
        } else {
            try {
                const bbox = rect.getBBox();
                width = bbox.width || 114;
            } catch (e) {
                width = 114;
            }
        }
        height = parseFloat(rect.getAttribute('height')) || 0;
        return { width, height };
    }

    // 4. حساب الإزاحة التراكمية (للمجموعات g)
    function getCumulativeTranslate(element) {
        let x = 0, y = 0;
        let current = element;
        while (current && current.tagName !== 'svg') {
            const transformAttr = current.getAttribute('transform');
            if (transformAttr) {
                const match = transformAttr.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
                if (match) {
                    x += parseFloat(match[1]);
                    y += parseFloat(match[2]);
                }
            }
            current = current.parentNode;
        }
        return { x, y };
    }

    // 5. الحصول على صورة المجموعة الخلفية
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

    // 6. دالة التكبير عند الـ Hover (المحسنة لمنع الإزاحة)
    function startHover() {
        if (!interactionEnabled) return;
        const rect = this;
        if (activeState.rect === rect) return;

        cleanupHover();
        activeState.rect = rect;

        const scale = 1.1;
        const rectSize = getRectSize(rect);
        const width = rectSize.width;
        const height = rectSize.height;
        const x = parseFloat(rect.getAttribute('x')) || 0;
        const y = parseFloat(rect.getAttribute('y')) || 0;

        const cumulative = getCumulativeTranslate(rect);
        const absoluteX = x + cumulative.x;
        const absoluteY = y + cumulative.y;
        
        const centerX = absoluteX + width / 2;
        const centerY = absoluteY + height / 2;

        // تطبيق التكبير على المستطيل نفسه
        rect.style.transformOrigin = `${x + width / 2}px ${y + height / 2}px`;
        rect.style.transform = `scale(${scale})`;
        rect.style.strokeWidth = '4px';

        const imageData = getGroupImage(rect);
        let zoomPartElement = null;

        if (imageData) {
            const i = rect.getAttribute('data-index') || Date.now();
            const clipPathId = `clip-${i}-${Date.now()}`;
            activeState.clipPathId = clipPathId;

            const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
            clip.setAttribute('id', clipPathId);

            const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
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
            zoomPart.setAttribute('x', match ? parseFloat(match[1]) : 0);
            zoomPart.setAttribute('y', match ? parseFloat(match[2]) : 0);
            
            mainSvg.appendChild(zoomPart);
            activeState.zoomPart = zoomPart;

            zoomPart.style.transformOrigin = `${centerX}px ${centerY}px`;
            zoomPart.style.transform = `scale(${scale})`;
            zoomPart.style.opacity = 1;
            zoomPartElement = zoomPart;
        }

        // معالجة النص
        let baseText = rect.nextElementSibling;
        if (baseText && baseText.matches('text.rect-label')) {
            baseText.style.opacity = '0';
            activeState.baseText = baseText;

            const zoomText = baseText.cloneNode(true);
            const fullText = rect.getAttribute('data-full-text') || baseText.getAttribute('data-original-text');
            zoomText.innerHTML = "";
            zoomText.textContent = fullText;
            zoomText.style.fontSize = (parseFloat(baseText.style.fontSize) * 1.5) + 'px';
            zoomText.style.fill = 'white';
            zoomText.style.opacity = '1';
            zoomText.setAttribute('x', centerX);
            zoomText.setAttribute('y', absoluteY - 10); // رفعه قليلاً فوق المستطيل
            zoomText.setAttribute('text-anchor', 'middle');
            mainSvg.appendChild(zoomText);
            activeState.zoomText = zoomText;
        }

        let hue = 0;
        activeState.animationId = setInterval(() => {
            hue = (hue + 10) % 360;
            const glow = `drop-shadow(0 0 8px hsl(${hue},100%,55%)) drop-shadow(0 0 14px hsl(${(hue + 60) % 360},100%,60%))`;
            rect.style.filter = glow;
            if (zoomPartElement) zoomPartElement.style.filter = glow;
            if (activeState.zoomText) activeState.zoomText.style.filter = glow;
        }, 100);
    }

    // 7. دالة التنظيف (Cleanup)
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

    // 8. وظائف البحث والتصفية
    function filterRects(query) {
        const lowerQuery = query.toLowerCase();
        const rectShapes = mainSvg.querySelectorAll('rect.image-mapper-shape');
        rectShapes.forEach(rect => {
            const label = rect.nextElementSibling;
            const href = rect.getAttribute('data-href') || '';
            const text = label ? label.textContent.toLowerCase() : '';
            const isMatch = href.toLowerCase().includes(lowerQuery) || text.includes(lowerQuery);

            if (query.length > 0 && !isMatch) {
                rect.style.opacity = '0.1';
                if (label) label.style.opacity = '0.1';
            } else {
                rect.style.opacity = '1';
                if (label) label.style.opacity = '1';
                rect.style.filter = (query.length > 0 && isMatch) ? 'drop-shadow(0 0 8px #00FFFF)' : 'none';
            }
        });
    }

    // 9. إرفاق الأحداث والتحميل
    function attachHover(rect, i) {
        rect.setAttribute('data-index', i);
        if (!isTouchDevice) {
            rect.addEventListener('mouseover', startHover);
            rect.addEventListener('mouseout', cleanupHover);
        }
        rect.addEventListener('click', handleLinkOpen);
        rect.addEventListener('touchstart', function(e) {
            activeState.touchStartTime = Date.now();
            activeState.initialScrollLeft = scrollContainer.scrollLeft;
            activeState.isScrolling = false;
            startHover.call(this);
        });
        rect.addEventListener('touchend', function(e) {
            const time = Date.now() - activeState.touchStartTime;
            if (!activeState.isScrolling && time < TAP_THRESHOLD_MS) handleLinkOpen.call(this, e);
            cleanupHover();
        });
    }

    function handleLinkOpen(e) {
        const href = this.getAttribute('data-href');
        if (href && href !== '#') window.open(href, '_blank');
        e.preventDefault();
    }

    // تقسيم النص (Word Wrap)
    function wrapTextInSvg(textElement, maxWidth) {
        const words = textElement.textContent.split(/\s+/);
        textElement.textContent = "";
        let tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', textElement.getAttribute('x'));
        tspan.setAttribute('dy', '0');
        textElement.appendChild(tspan);
        let line = "";
        words.forEach(word => {
            let testLine = line + (line ? " " : "") + word;
            tspan.textContent = testLine;
            if (tspan.getComputedTextLength() > maxWidth - 5 && line !== "") {
                tspan.textContent = line;
                tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                tspan.setAttribute('x', textElement.getAttribute('x'));
                tspan.setAttribute('dy', '1.2em');
                textElement.appendChild(tspan);
                line = word;
                tspan.textContent = word;
            } else { line = testLine; }
        });
    }

    // الإجراءات النهائية عند التشغيل
    const images = mainSvg.querySelectorAll('image');
    let loaded = 0;
    images.forEach(img => {
        const temp = new Image();
        temp.onload = temp.onerror = () => {
            loaded++;
            if (loaded === images.length) {
                loadingOverlay.style.opacity = 0;
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                    mainSvg.style.opacity = 1;
                    scrollContainer.scrollLeft = scrollContainer.scrollWidth;
                }, 300);
            }
        };
        temp.src = img.getAttribute('data-src') || img.getAttribute('href');
    });

    document.querySelectorAll('rect.image-mapper-shape').forEach((rect, i) => {
        const size = getRectSize(rect);
        const fileName = (rect.getAttribute('data-href') || "").split('/').pop().split('.')[0];
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const fontSize = Math.max(8, Math.min(14, size.width * 0.12));
        
        text.setAttribute('x', parseFloat(rect.getAttribute('x')) + size.width / 2);
        text.setAttribute('y', parseFloat(rect.getAttribute('y')) + fontSize + 5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'rect-label');
        text.style.fontSize = fontSize + 'px';
        text.textContent = fileName;
        rect.parentNode.insertBefore(text, rect.nextSibling);
        if (size.width > 50) wrapTextInSvg(text, size.width);
        attachHover(rect, i);
    });

    searchInput.addEventListener('input', (e) => debounce(filterRects(e.target.value), 150));
    jsToggle.addEventListener('change', function() { interactionEnabled = this.checked; if(!interactionEnabled) cleanupHover(); });
    moveToggle.addEventListener('click', () => toggleContainer.classList.toggle('top') || toggleContainer.classList.toggle('bottom'));
};
