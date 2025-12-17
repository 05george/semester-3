window.onload = function () {
    // ====================
    // تهيئة العناصر الأساسية
    // ====================
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

    // ====================
    // دالة Debounce
    // ====================
    function debounce(func, delay) {
        let timeoutId;
        return function () {
            const context = this;
            const args = arguments;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // ====================
    // دالة قراءة حجم المستطيل مع دعم الكلاس w
    // ====================
    function getRectSize(rect) {
        let width, height;
        
        // قراءة العرض من السمة width
        const attrWidth = rect.getAttribute('width');
        if (attrWidth) {
            width = parseFloat(attrWidth);
        } else {
            // إذا لم يكن هناك سمة width، تحقق من الكلاس w
            if (rect.classList.contains('w')) {
                width = 114; // القيمة الافتراضية للكلاس w
            } else {
                // محاولة الحصول من BBox
                try {
                    const bbox = rect.getBBox();
                    width = bbox.width || 114;
                } catch (e) {
                    width = 114;
                }
            }
        }
        
        // قراءة الارتفاع من السمة height
        const attrHeight = rect.getAttribute('height');
        height = attrHeight ? parseFloat(attrHeight) : 100;
        
        return { width, height };
    }

    // ====================
    // تحديث أحجام SVG الديناميكية
    // ====================
    function updateDynamicSizes() {
        const images = mainSvg.querySelectorAll('image');
        if (!images.length) return;

        const firstImage = images[0];
        const imageWidth = parseFloat(firstImage.getAttribute('width')) || 1024;
        const imageHeight = parseFloat(firstImage.getAttribute('height')) || 2454;
        const totalWidth = images.length * imageWidth;

        mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${imageHeight}`);
        window.MAX_SCROLL_LEFT = totalWidth - window.innerWidth;
    }

    updateDynamicSizes();

    // ====================
    // Debounced Cleanup
    // ====================
    const debouncedCleanupHover = debounce(function () {
        if (!interactionEnabled || !activeState.rect) return;
        if (activeState.rect) {
            cleanupHover();
        }
    }, 50);

    // ====================
    // حدث Scroll
    // ====================
    scrollContainer.addEventListener('scroll', function () {
        // منع التمرير بعد الحد الأقصى
        if (this.scrollLeft > window.MAX_SCROLL_LEFT) {
            this.scrollLeft = window.MAX_SCROLL_LEFT;
        }

        if (!interactionEnabled) return;

        if (activeState.rect && !isTouchDevice) {
            debouncedCleanupHover();
        }

        if (activeState.rect && isTouchDevice) {
            if (Math.abs(this.scrollLeft - activeState.initialScrollLeft) > 5) {
                activeState.isScrolling = true;
                cleanupHover();
            }
        }
    });

    // ====================
    // حساب الترجمة التراكمية
    // ====================
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

    // ====================
    // الحصول على بيانات الصورة في المجموعة
    // ====================
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

    // ====================
    // تنظيف تأثيرات التكبير
    // ====================
    function cleanupHover() {
        if (!activeState.rect) return;

        const rectToClean = activeState.rect;
        const clipPathIdToClean = activeState.clipPathId;
        const zoomPartToClean = activeState.zoomPart;
        const zoomTextToClean = activeState.zoomText;
        const baseTextToClean = activeState.baseText;
        const animationIdToClean = activeState.animationId;

        if (animationIdToClean) clearInterval(animationIdToClean);

        rectToClean.style.filter = 'none';
        rectToClean.style.transform = 'scale(1)';
        rectToClean.style.strokeWidth = '2px';
        
        // إعادة تعيين العرض للكلاس w إذا لزم الأمر
        if (rectToClean.classList.contains('w')) {
            rectToClean.style.width = '114px';
        }

        if (zoomPartToClean) {
            zoomPartToClean.style.filter = 'none';
            zoomPartToClean.style.transform = 'scale(1)';
            zoomPartToClean.remove();
        }

        if (zoomTextToClean) {
            zoomTextToClean.style.filter = 'none';
            zoomTextToClean.style.opacity = '0';
            zoomTextToClean.remove();
        }

        if (baseTextToClean) {
            baseTextToClean.style.opacity = '1';
        }

        const currentClip = document.getElementById(clipPathIdToClean);
        if (currentClip) currentClip.remove();

        Object.assign(activeState, {
            rect: null,
            zoomPart: null,
            zoomText: null,
            baseText: null,
            animationId: null,
            clipPathId: null,
            initialScrollLeft: 0,
            isScrolling: false,
            touchStartTime: 0
        });
    }

    // ====================
    // بدء تأثير التكبير (Hover) - معدل للتعامل مع الكلاس w
    // ====================
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

        // تطبيق تأثير التكبير
        rect.style.transformOrigin = `${centerX}px ${centerY}px`;
        rect.style.transform = `scale(${scale})`;
        rect.style.strokeWidth = '4px';
        
        // التأكد من عرض الكلاس w يبقى كما هو
        if (rect.classList.contains('w')) {
            rect.style.width = width + 'px';
        }

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
            const groupX = match ? parseFloat(match[1]) : 0;
            const groupY = match ? parseFloat(match[2]) : 0;

            zoomPart.setAttribute('x', groupX);
            zoomPart.setAttribute('y', groupY);
            zoomPart.style.opacity = 0;
            mainSvg.appendChild(zoomPart);
            activeState.zoomPart = zoomPart;

            zoomPart.style.transformOrigin = `${centerX}px ${centerY}px`;
            zoomPart.style.transform = `scale(${scale})`;
            zoomPart.style.opacity = 1;
            zoomPartElement = zoomPart;
        }

        // معالجة النص
        let baseText = rect.nextElementSibling;
        if (baseText && !baseText.matches('text.rect-label')) {
            baseText = null;
        }

        if (baseText) {
            baseText.style.opacity = '0';
            activeState.baseText = baseText;

            const zoomText = baseText.cloneNode(true);
            const rectFullText = rect.getAttribute('data-full-text') || baseText.getAttribute('data-original-text');
            zoomText.textContent = rectFullText;
            zoomText.removeAttribute('data-original-text');

            while (zoomText.firstChild) {
                zoomText.removeChild(zoomText.firstChild);
            }
            zoomText.textContent = rectFullText;

            const baseFont = parseFloat(baseText.style.fontSize);
            zoomText.style.fontSize = (baseFont * 1.5) + 'px'; // تقليل التكبير من 2 إلى 1.5
            zoomText.style.fill = 'white';
            zoomText.style.pointerEvents = 'none';
            zoomText.style.userSelect = 'none';
            zoomText.style.opacity = '1';
            zoomText.setAttribute('x', absoluteX + width / 2);
            zoomText.setAttribute('y', absoluteY + height / 2); // وضع النص في منتصف المستطيل
            zoomText.setAttribute('text-anchor', 'middle');
            zoomText.setAttribute('dominant-baseline', 'middle');

            mainSvg.appendChild(zoomText);
            activeState.zoomText = zoomText;
        }

        // تأثير الوميض
        let hue = 0;
        activeState.animationId = setInterval(() => {
            hue = (hue + 10) % 360;
            const glow = `drop-shadow(0 0 8px hsl(${hue},100%,55%)) drop-shadow(0 0 14px hsl(${(hue + 60) % 360},100%,60%))`;
            rect.style.filter = glow;

            if (zoomPartElement) {
                zoomPartElement.style.filter = glow;
            }

            if (activeState.zoomText) {
                activeState.zoomText.style.filter = glow;
            }
        }, 100);
    }

    // ====================
    // إيقاف تأثير التكبير
    // ====================
    function stopHover() {
        if (!interactionEnabled) return;
        if (activeState.rect === this) cleanupHover();
    }

    // ====================
    // فتح الرابط
    // ====================
    function handleLinkOpen(event) {
        const href = event.currentTarget.getAttribute('data-href');
        if (href && href !== '#') {
            window.open(href, '_blank');
            event.preventDefault();
            event.stopPropagation();
        }
    }

    // ====================
    // إرفاق أحداث للمستطيل
    // ====================
    function attachHover(rect, i) {
        rect.setAttribute('data-index', i);

        if (!isTouchDevice) {
            function handleMouseOver() {
                if (interactionEnabled) startHover.call(rect);
            }

            function handleMouseOut() {
                if (interactionEnabled) stopHover.call(rect);
            }

            rect.addEventListener('mouseover', handleMouseOver);
            rect.addEventListener('mouseout', handleMouseOut);
        }

        rect.addEventListener('click', handleLinkOpen);

        rect.addEventListener('touchstart', function (event) {
            if (!interactionEnabled) return;
            activeState.touchStartTime = Date.now();
            activeState.initialScrollLeft = scrollContainer.scrollLeft;
            activeState.isScrolling = false;
            startHover.call(this);
        });

        rect.addEventListener('touchend', function (event) {
            if (!interactionEnabled) return;
            const timeElapsed = Date.now() - activeState.touchStartTime;

            if (activeState.isScrolling === false && timeElapsed < TAP_THRESHOLD_MS) {
                handleLinkOpen(event);
            }

            cleanupHover();
        });
    }

    // ====================
    // وظيفة البحث
    // ====================
    const svgImages = Array.from(mainSvg.querySelectorAll('image'));
    const rectShapes = Array.from(mainSvg.querySelectorAll('rect.image-mapper-shape'));
    const rectLabels = Array.from(mainSvg.querySelectorAll('text.rect-label'));
    const allRectsAndLabels = [...rectShapes, ...rectLabels];

    function filterRects(query) {
        const lowerQuery = query.toLowerCase();

        allRectsAndLabels.forEach(element => {
            let match = false;

            if (element.tagName === 'rect') {
                const href = element.getAttribute('data-href') || '';
                if (href.toLowerCase().includes(lowerQuery)) {
                    match = true;
                }
            } else if (element.tagName === 'text') {
                if (element.textContent.toLowerCase().includes(lowerQuery)) {
                    match = true;
                }
            }

            const rectShape = (element.tagName === 'rect') ? element : element.previousElementSibling;

            if (rectShape && rectShape.matches('rect.image-mapper-shape')) {
                const correspondingLabel = rectShape.nextElementSibling;

                if (query.length > 0 && !match) {
                    rectShape.style.opacity = '0.1';
                    rectShape.style.pointerEvents = 'none';
                    if (correspondingLabel) correspondingLabel.style.opacity = '0.1';
                } else {
                    rectShape.style.opacity = '1';
                    rectShape.style.pointerEvents = 'auto';
                    if (correspondingLabel) correspondingLabel.style.opacity = '1';

                    if (query.length > 0 && match) {
                        rectShape.style.filter = 'drop-shadow(0 0 8px #00FFFF) drop-shadow(0 0 14px #00FFFF)';
                    } else {
                        rectShape.style.filter = 'none';
                    }
                }
            }
        });
    }

    const debouncedFilter = debounce(filterRects, 150);

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            debouncedFilter(this.value);
        });
    }

    // ====================
    // تحميل الصور
    // ====================
    const urls = svgImages.map(img => img.getAttribute('data-src') || img.getAttribute('href'));
    let loadedCount = 0;
    const totalCount = urls.length;

    function updateLoader() {
        const percent = Math.round((loadedCount / totalCount) * 100);
        if (loadingText) loadingText.textContent = `Preparing the environment...`;

        if (percent >= 25) document.getElementById('bulb-1').classList.add('on');
        if (percent >= 50) document.getElementById('bulb-2').classList.add('on');
        if (percent >= 75) document.getElementById('bulb-3').classList.add('on');
        if (percent === 100) document.getElementById('bulb-4').classList.add('on');
    }

    function finishLoading() {
        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.style.opacity = 0;
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                    mainSvg.style.opacity = 1;
                    setTimeout(() => {
                        scrollContainer.scrollLeft = scrollContainer.scrollWidth;
                        scrollContainer.scrollTo({
                            left: scrollContainer.scrollWidth,
                            behavior: 'smooth'
                        });
                    }, 50);
                }, 300);
            }, 0);
        }
    }

    urls.forEach((url, index) => {
        const img = new Image();
        img.onload = img.onerror = () => {
            loadedCount++;
            updateLoader();
            if (loadedCount === totalCount) {
                finishLoading();
                svgImages.forEach((svgImg, i) => {
                    svgImg.setAttribute('href', urls[i]);
                });
            }
        };
        img.src = url;
    });

    // ====================
    // تقسيم النص إلى أسطر متعددة - معدل للتعامل مع الكلاس w
    // ====================
    function wrapTextInSvg(textElement, maxWidth, padding = 5) {
        const text = textElement.textContent;
        const words = text.split(/\s+/).filter(w => w.length > 0);
        textElement.textContent = null;

        let tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', textElement.getAttribute('x'));
        tspan.setAttribute('dy', '0');
        textElement.appendChild(tspan);

        let currentLine = '';
        const lineHeight = parseFloat(textElement.style.fontSize) * 1.2;
        let lineNumber = 0;

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const lineTest = currentLine + (currentLine.length ? ' ' : '') + word;
            tspan.textContent = lineTest;
            
            // تعديل الحد الأقصى للعرض للكلاس w
            const effectiveMaxWidth = maxWidth > 100 ? maxWidth - (padding * 2) : maxWidth - padding;
            
            if (tspan.getComputedTextLength() > effectiveMaxWidth && currentLine.length > 0) {
                tspan.textContent = currentLine;
                lineNumber++;
                tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                tspan.setAttribute('x', textElement.getAttribute('x'));
                tspan.setAttribute('dy', `${lineHeight}px`);
                textElement.appendChild(tspan);
                currentLine = word;
                tspan.textContent = word;
            } else {
                currentLine = lineTest;
            }
        }
    }

    // ====================
    // إنشاء تسميات للمستطيلات - معدل للتعامل مع الكلاس w
    // ====================
    document.querySelectorAll('rect.image-mapper-shape').forEach(rect => {
        const href = rect.getAttribute('data-href') || '';
        const fileName = href.split('/').pop().split('#')[0] || '';
        const baseName = fileName.split('.');
        const textContent = baseName.slice(0, baseName.length - 1).join('.');
        
        const rectSize = getRectSize(rect);
        const rectWidth = rectSize.width;
        const rectX = parseFloat(rect.getAttribute('x')) || 0;
        const rectY = parseFloat(rect.getAttribute('y')) || 0;
        
        const minFont = 8;
        const maxFont = 16;
        const scaleFactor = 0.12;
        let fontSize = rectWidth * scaleFactor;
        fontSize = Math.max(minFont, Math.min(maxFont, fontSize));
        
        // تعديل حجم الخط للكلاس w (أصغر قليلاً)
        if (rect.classList.contains('w') && rectWidth <= 114) {
            fontSize = Math.max(8, fontSize * 0.9);
        }
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', rectX + rectWidth / 2);
        
        const padding = fontSize * 0.2;
        const initialY = rectY + padding + fontSize * 0.8;
        text.setAttribute('y', initialY);
        text.setAttribute('text-anchor', 'middle');
        text.textContent = textContent;
        text.style.fontSize = fontSize + 'px';
        text.style.fill = 'white';
        text.style.pointerEvents = 'none';
        text.setAttribute('class', 'rect-label');
        text.setAttribute('data-original-text', textContent);
        
        rect.parentNode.insertBefore(text, rect.nextSibling);
        
        // عدم تقسيم النص إذا كان العرض صغيراً جداً
        if (rectWidth > 60) {
            wrapTextInSvg(text, rectWidth);
        }
    });

    // ====================
    // إرفاق أحداث لجميع المستطيلات
    // ====================
    document.querySelectorAll('rect.image-mapper-shape').forEach((rect, i) => {
        rect.setAttribute('data-processed', 'true');
        attachHover(rect, i);
    });

    // ====================
    // Mutation Observer للمستطيلات الجديدة
    // ====================
    const rootObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.matches('rect.image-mapper-shape') && !node.hasAttribute('data-processed')) {
                        attachHover(node, Date.now());
                        node.setAttribute('data-processed', 'true');
                    }

                    if (node.querySelector) {
                        node.querySelectorAll('rect.image-mapper-shape:not([data-processed])').forEach(rect => {
                            attachHover(rect, Date.now());
                            rect.setAttribute('data-processed', 'true');
                        });
                    }
                }
            });
        });
    });

    rootObserver.observe(mainSvg, { childList: true, subtree: true });

    // ====================
    // تبديل التفاعل
    // ====================
    jsToggle.addEventListener('change', function () {
        interactionEnabled = this.checked;
        const label = document.getElementById('toggle-label');

        if (interactionEnabled) {
            label.textContent = 'Interaction Enabled';
        } else {
            label.textContent = 'Interaction Disabled';
            cleanupHover();
        }
    });

    // ====================
    // تحريك زر التبديل
    // ====================
    if (moveToggle && toggleContainer) {
        moveToggle.addEventListener('click', function () {
            if (toggleContainer.classList.contains('top')) {
                toggleContainer.classList.remove('top');
                toggleContainer.classList.add('bottom');
            } else {
                toggleContainer.classList.remove('bottom');
                toggleContainer.classList.add('top');
            }
        });
    }

    // ====================
    // تحسين الأداء عند تغيير الحجم
    // ====================
    window.addEventListener('resize', debounce(updateDynamicSizes, 250));
};

// ====================
// دعم المتصفحات القديمة
// ====================
if (!Element.prototype.closest) {
    Element.prototype.closest = function (s) {
        var el = this;
        if (!document.documentElement.contains(el)) return null;
        do {
            if (el.matches(s)) return el;
            el = el.parentElement || el.parentNode;
        } while (el !== null && el.nodeType === 1);
        return null;
    };
}

if (!Element.prototype.matches) {
    Element.prototype.matches =
        Element.prototype.matchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        Element.prototype.oMatchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        function (s) {
            var matches = (this.document || this.ownerDocument).querySelectorAll(s),
                i = matches.length;
            while (--i >= 0 && matches.item(i) !== this) { }
            return i > -1;
        };
}