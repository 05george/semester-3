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
    const splashImage = document.getElementById('splash-image');

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
    // تحريك زر التبديل
    // ====================
    let toggleAtTop = true;
    if (moveToggle) {
        moveToggle.addEventListener('click', function() {
            const container = document.getElementById('js-toggle-container');
            if (toggleAtTop) {
                container.classList.remove('top');
                container.classList.add('bottom');
            } else {
                container.classList.remove('bottom');
                container.classList.add('top');
            }
            toggleAtTop = !toggleAtTop;
        });
    }

    // ====================
    // مؤشرات التحميل المتحركة
    // ====================
    function animateLoadingLights() {
        const bulbs = document.querySelectorAll('.light-bulb');
        let current = 0;
        
        const interval = setInterval(() => {
            bulbs.forEach(bulb => bulb.classList.remove('on'));
            bulbs[current].classList.add('on');
            current = (current + 1) % bulbs.length;
        }, 300);

        return interval;
    }

    const loadingInterval = animateLoadingLights();

    // ====================
    // دالة قراءة حجم المستطيل
    // ====================
    function getRectSize(rect) {
        const w = rect.getAttribute('width');
        const h = rect.getAttribute('height');

        if (w && h) {
            return {
                width: parseFloat(w),
                height: parseFloat(h)
            };
        }

        try {
            const bbox = rect.getBBox();
            if (bbox.width && bbox.height) {
                return {
                    width: bbox.width,
                    height: bbox.height
                };
            }
        } catch (e) {}

        return {
            width: 114,
            height: parseFloat(rect.getAttribute('height')) || 100
        };
    }

    // ====================
    // Debounce للتحسين
    // ====================
    function debounce(fn, delay) {
        let t;
        return function () {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, arguments), delay);
        };
    }

    // ====================
    // تحديث أحجام SVG الديناميكية
    // ====================
    function updateDynamicSizes() {
        const images = mainSvg.querySelectorAll('image');
        if (!images.length) return;

        const img = images[0];
        const w = parseFloat(img.getAttribute('width')) || 1024;
        const h = parseFloat(img.getAttribute('height')) || 2454;
        const totalW = images.length * w;

        mainSvg.setAttribute('viewBox', `0 0 ${totalW} ${h}`);
        window.MAX_SCROLL_LEFT = totalW - window.innerWidth;
    }

    // ====================
    // تنظيف تأثيرات التكبير
    // ====================
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

    // ====================
    // حدث Scroll
    // ====================
    scrollContainer.addEventListener('scroll', function () {
        if (!interactionEnabled) return;

        if (activeState.rect && !isTouchDevice) cleanupHover();

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

    // ====================
    // الحصول على بيانات الصورة في المجموعة
    // ====================
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

    // ====================
    // بدء تأثير التكبير (Hover)
    // ====================
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
            const glow = `drop-shadow(0 0 8px hsl(${hue},100%,60%))`;
            rect.style.filter = glow;
            if (activeState.zoomPart) activeState.zoomPart.style.filter = glow;
        }, 100);
    }

    // ====================
    // إيقاف تأثير التكبير
    // ====================
    function stopHover() {
        if (interactionEnabled) cleanupHover();
    }

    // ====================
    // فتح الرابط
    // ====================
    function handleLinkOpen(e) {
        const href = e.currentTarget.getAttribute('data-href');
        if (href && href !== '#') {
            window.open(href, '_blank');
            e.preventDefault();
        }
    }

    // ====================
    // إرفاق أحداث Hover للمستطيل
    // ====================
    function attachHover(rect) {
        if (!isTouchDevice) {
            rect.addEventListener('mouseover', startHover);
            rect.addEventListener('mouseout', stopHover);
        }
        rect.addEventListener('click', handleLinkOpen);
    }

    // ====================
    // إنشاء التسميات
    // ====================
    function createLabels() {
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
            attachHover(rect);
        });
    }

    // ====================
    // وظيفة البحث
    // ====================
    function setupSearch() {
        if (!searchInput) return;

        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const labels = document.querySelectorAll('.rect-label');
            
            labels.forEach(label => {
                const text = label.textContent.toLowerCase();
                const rect = label.previousElementSibling;
                
                if (searchTerm === '' || text.includes(searchTerm)) {
                    label.style.opacity = '1';
                    if (rect) rect.style.opacity = '1';
                } else {
                    label.style.opacity = '0.2';
                    if (rect) rect.style.opacity = '0.2';
                }
            });
        });

        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                this.value = '';
                this.dispatchEvent(new Event('input'));
                this.blur();
            }
        });
    }

    // ====================
    // إنهاء التحميل
    // ====================
    function finishLoading() {
        clearInterval(loadingInterval);
        loadingOverlay.style.opacity = '0';
        
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
            mainSvg.style.opacity = '1';
            updateDynamicSizes();
            createLabels();
            setupSearch();
        }, 300);
    }

    // ====================
    // تحميل الصور
    // ====================
    function loadImages() {
        const svgImages = Array.from(mainSvg.querySelectorAll('image'));
        let loaded = 0;
        const totalImages = svgImages.length;

        if (totalImages === 0) {
            finishLoading();
            return;
        }

        function updateProgress() {
            loaded++;
            loadingText.textContent = `Loading images... ${loaded}/${totalImages}`;
            
            if (loaded === totalImages) {
                finishLoading();
            }
        }

        svgImages.forEach(img => {
            const src = img.getAttribute('data-src') || img.getAttribute('href');
            const temp = new Image();
            
            temp.onload = () => {
                img.setAttribute('href', src);
                updateProgress();
            };
            
            temp.onerror = () => {
                console.warn(`Failed to load image: ${src}`);
                updateProgress();
            };
            
            temp.src = src;
        });
    }

    // ====================
    // تبديل التفاعل
    // ====================
    if (jsToggle) {
        jsToggle.addEventListener('change', function () {
            interactionEnabled = this.checked;
            if (!interactionEnabled) cleanupHover();
        });
    }

    // ====================
    // تهيئة شاشة اللمس
    // ====================
    if (isTouchDevice) {
        let touchStartTime = 0;
        
        document.addEventListener('touchstart', function(e) {
            touchStartTime = Date.now();
        }, { passive: true });

        document.addEventListener('touchend', function(e) {
            const tapDuration = Date.now() - touchStartTime;
            if (tapDuration < TAP_THRESHOLD_MS) {
                const rect = e.target.closest('rect.image-mapper-shape');
                if (rect && interactionEnabled) {
                    e.preventDefault();
                    handleLinkOpen(e);
                }
            }
        }, { passive: false });
    }

    // ====================
    // بدء التحميل
    // ====================
    loadImages();

    // ====================
    // تحسين الأداء عند تغيير الحجم
    // ====================
    window.addEventListener('resize', debounce(updateDynamicSizes, 250));
};

// ====================
// دعم المتصفحات القديمة
// ====================
if (!Element.prototype.closest) {
    Element.prototype.closest = function(s) {
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
        function(s) {
            var matches = (this.document || this.ownerDocument).querySelectorAll(s),
                i = matches.length;
            while (--i >= 0 && matches.item(i) !== this) {}
            return i > -1;
        };
}