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

    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    const activeState = {
        rect: null,
        zoomPart: null,
        animationId: null,
        clipPathId: null,
        initialScrollLeft: 0,
        isScrolling: false,
        touchStartTime: 0,
        labels: []
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
        if (bulbs.length === 0) return null;
        
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
        } catch (e) {
            console.warn('Could not get BBox for rect:', e);
        }

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

        let totalW = 0;
        images.forEach(img => {
            const w = parseFloat(img.getAttribute('width')) || 1024;
            totalW += w;
        });

        const firstImg = images[0];
        const h = parseFloat(firstImg.getAttribute('height')) || 2454;
        
        mainSvg.setAttribute('viewBox', `0 0 ${totalW} ${h}`);
        mainSvg.setAttribute('width', totalW);
        mainSvg.setAttribute('height', h);
        
        window.MAX_SCROLL_LEFT = totalW - window.innerWidth;
    }

    // ====================
    // تنظيف تأثيرات التكبير
    // ====================
    function cleanupHover() {
        if (!activeState.rect) return;

        if (activeState.animationId) {
            clearInterval(activeState.animationId);
            activeState.animationId = null;
        }
        
        if (activeState.rect) {
            activeState.rect.style.transform = 'scale(1)';
            activeState.rect.style.filter = 'none';
            activeState.rect.style.strokeWidth = '2px';
        }

        if (activeState.zoomPart) {
            activeState.zoomPart.remove();
            activeState.zoomPart = null;
        }

        if (activeState.clipPathId) {
            const clip = document.getElementById(activeState.clipPathId);
            if (clip) clip.remove();
            activeState.clipPathId = null;
        }

        activeState.rect = null;
    }

    // ====================
    // حدث Scroll
    // ====================
    scrollContainer.addEventListener('scroll', function () {
        if (!interactionEnabled) return;

        if (activeState.rect && !isTouchDevice) {
            cleanupHover();
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
    function getCumulativeTranslate(el) {
        let x = 0, y = 0;
        let currentEl = el;
        
        while (currentEl && currentEl.tagName !== 'svg') {
            const t = currentEl.getAttribute('transform');
            if (t) {
                const m = t.match(/translate\(([\d.-]+)[ ,]+([\d.-]+)\)/);
                if (m) {
                    x += parseFloat(m[1]);
                    y += parseFloat(m[2]);
                }
            }
            currentEl = currentEl.parentNode;
        }
        return { x, y };
    }

    // ====================
    // الحصول على بيانات الصورة في المجموعة
    // ====================
    function getGroupImage(el) {
        let currentEl = el;
        
        while (currentEl && currentEl.tagName !== 'svg') {
            if (currentEl.tagName === 'g') {
                const img = currentEl.querySelector('image');
                if (img) {
                    return {
                        src: img.getAttribute('data-src') || img.getAttribute('href') || img.getAttribute('xlink:href'),
                        width: parseFloat(img.getAttribute('width')) || 1024,
                        height: parseFloat(img.getAttribute('height')) || 2454,
                        group: currentEl
                    };
                }
            }
            currentEl = currentEl.parentNode;
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
        const x = parseFloat(rect.getAttribute('x')) || 0;
        const y = parseFloat(rect.getAttribute('y')) || 0;
        const scale = 1.1;

        const c = getCumulativeTranslate(rect);
        const absX = x + c.x;
        const absY = y + c.y;
        const cx = absX + width / 2;
        const cy = absY + height / 2;

        // تطبيق تأثير التكبير
        rect.style.transformOrigin = `${cx}px ${cy}px`;
        rect.style.transform = `scale(${scale})`;
        rect.style.strokeWidth = '4px';

        // إنشاء clip path للتكبير
        const imageData = getGroupImage(rect);
        if (imageData && imageData.src) {
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

            // إنشاء صورة مكبرة
            const zoom = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            zoom.setAttribute('href', imageData.src);
            zoom.setAttribute('xlink:href', imageData.src);
            zoom.setAttribute('width', imageData.width);
            zoom.setAttribute('height', imageData.height);
            zoom.setAttribute('clip-path', `url(#${clipId})`);
            zoom.setAttribute('class', 'zoom-part');

            // تطبيق نفس تحويل المجموعة
            const gt = imageData.group.getAttribute('transform');
            if (gt) {
                zoom.setAttribute('transform', gt);
            }

            zoom.style.transformOrigin = `${cx}px ${cy}px`;
            zoom.style.transform = `scale(${scale})`;
            zoom.style.filter = 'none';
            mainSvg.appendChild(zoom);
            activeState.zoomPart = zoom;
        }

        // تأثير الوميض بالألوان
        let hue = 0;
        activeState.animationId = setInterval(() => {
            hue = (hue + 10) % 360;
            const glow = `drop-shadow(0 0 8px hsl(${hue},100%,60%))`;
            rect.style.filter = glow;
            if (activeState.zoomPart) {
                activeState.zoomPart.style.filter = glow;
            }
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
    // تقسيم النص الطويل
    // ====================
    function wrapText(text, maxLength) {
        if (!text) return [];
        
        const words = text.split(/[\/\-_]/);
        const result = [];
        let currentLine = '';
        
        for (const word of words) {
            if (!word.trim()) continue;
            
            if (currentLine.length + word.length + 1 <= maxLength) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) result.push(currentLine);
                currentLine = word;
            }
        }
        
        if (currentLine) result.push(currentLine);
        
        // إذا كان النص قصيراً، نرجعه كما هو
        if (result.length === 0) return [text];
        return result;
    }

    // ====================
    // إنشاء التسميات متعددة الأسطر
    // ====================
    function createMultiLineLabel(rect, filename) {
        const { width, height } = getRectSize(rect);
        const x = parseFloat(rect.getAttribute('x')) || 0;
        const y = parseFloat(rect.getAttribute('y')) || 0;
        
        // حجم الخط بناءً على عرض المستطيل
        const baseFontSize = Math.max(8, Math.min(14, width * 0.1));
        const lineHeight = baseFontSize * 1.2;
        
        // تقسيم النص
        const lines = wrapText(filename, 15);
        const totalTextHeight = lines.length * lineHeight;
        
        // إنشاء مجموعة للنصوص
        const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        textGroup.setAttribute('class', 'rect-label-group');
        
        // إضافة كل سطر
        lines.forEach((line, index) => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x + width / 2);
            text.setAttribute('y', y + height / 2 + (index - (lines.length - 1) / 2) * lineHeight);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.textContent = line;
            text.style.fontSize = `${baseFontSize}px`;
            text.style.fill = 'white';
            text.style.pointerEvents = 'none';
            text.style.fontFamily = 'Arial, sans-serif';
            text.style.fontWeight = 'bold';
            text.style.textShadow = '1px 1px 2px black';
            
            textGroup.appendChild(text);
        });
        
        return textGroup;
    }

    // ====================
    // إرفاق أحداث للمستطيل
    // ====================
    function attachRectEvents(rect) {
        if (!isTouchDevice) {
            rect.addEventListener('mouseover', startHover);
            rect.addEventListener('mouseout', stopHover);
        }
        
        rect.addEventListener('click', handleLinkOpen);
        
        // إضافة حدث للشاشات التي تعمل باللمس
        if (isTouchDevice) {
            let touchStart = 0;
            
            rect.addEventListener('touchstart', function(e) {
                touchStart = Date.now();
                activeState.initialScrollLeft = scrollContainer.scrollLeft;
                activeState.isScrolling = false;
                
                // بدء الهوفر على اللمس
                if (interactionEnabled) {
                    startHover.call(this);
                }
                e.preventDefault();
            }, { passive: false });
            
            rect.addEventListener('touchend', function(e) {
                const touchDuration = Date.now() - touchStart;
                
                if (touchDuration < TAP_THRESHOLD_MS && !activeState.isScrolling) {
                    handleLinkOpen.call(this, e);
                }
                
                // تنظيف الهوفر بعد تأخير
                setTimeout(() => {
                    if (interactionEnabled) {
                        stopHover();
                    }
                }, 500);
                
                e.preventDefault();
            }, { passive: false });
        }
    }

    // ====================
    // إنشاء جميع التسميات
    // ====================
    function createAllLabels() {
        // إزالة التسميات القديمة
        document.querySelectorAll('.rect-label-group').forEach(el => el.remove());
        
        const rects = document.querySelectorAll('rect.image-mapper-shape');
        activeState.labels = [];
        
        rects.forEach(rect => {
            const href = rect.getAttribute('data-href') || '';
            if (!href) return;
            
            // استخراج اسم الملف
            const filename = href.split('/').pop().replace('.pdf', '').replace(/\.[^/.]+$/, "");
            if (!filename) return;
            
            // إنشاء التسمية متعددة الأسطر
            const labelGroup = createMultiLineLabel(rect, filename);
            
            // إضافة التسمية بعد المستطيل مباشرة
            rect.parentNode.insertBefore(labelGroup, rect.nextSibling);
            
            // حفظ المرجع
            activeState.labels.push({
                rect: rect,
                label: labelGroup,
                text: filename.toLowerCase()
            });
            
            // إرفاق الأحداث
            attachRectEvents(rect);
        });
    }

    // ====================
    // وظيفة البحث
    // ====================
    function setupSearch() {
        if (!searchInput) return;

        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            
            activeState.labels.forEach(item => {
                const matches = searchTerm === '' || item.text.includes(searchTerm);
                
                // التحكم في ظهور المستطيل
                if (item.rect) {
                    item.rect.style.opacity = matches ? '1' : '0.2';
                    item.rect.style.pointerEvents = matches ? 'auto' : 'none';
                }
                
                // التحكم في ظهور التسمية
                if (item.label) {
                    item.label.style.opacity = matches ? '1' : '0.2';
                    item.label.style.display = matches ? 'block' : 'none';
                }
            });
        });

        // زر Esc لمسح البحث
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
        if (loadingInterval) clearInterval(loadingInterval);
        
        // إخفاء شاشة التحميل بسلاسة
        loadingOverlay.style.opacity = '0';
        
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
            mainSvg.style.opacity = '1';
            
            // تحديث الأحجام
            updateDynamicSizes();
            
            // إنشاء التسميات
            createAllLabels();
            
            // إعداد البحث
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
            console.warn('No images found in SVG');
            finishLoading();
            return;
        }

        function updateProgress() {
            loaded++;
            const percent = Math.round((loaded / totalImages) * 100);
            loadingText.textContent = `Loading images... ${percent}%`;
            
            if (loaded === totalImages) {
                finishLoading();
            }
        }

        svgImages.forEach(img => {
            const src = img.getAttribute('data-src') || 
                        img.getAttribute('href') || 
                        img.getAttribute('xlink:href');
            
            if (!src) {
                console.warn('Image without source:', img);
                updateProgress();
                return;
            }

            const temp = new Image();
            
            temp.onload = () => {
                // تحديث السمة href لتأمين العرض
                if (img.hasAttribute('xlink:href')) {
                    img.setAttribute('xlink:href', src);
                } else {
                    img.setAttribute('href', src);
                }
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
            
            // تحديث نص التبديل
            const toggleLabel = document.getElementById('toggle-label');
            if (toggleLabel) {
                toggleLabel.textContent = interactionEnabled ? 
                    'Interaction Enabled' : 'Interaction Disabled';
            }
            
            if (!interactionEnabled) {
                cleanupHover();
                
                // تعطيل أحداث جميع المستطيلات
                document.querySelectorAll('rect.image-mapper-shape').forEach(rect => {
                    rect.style.pointerEvents = 'none';
                });
            } else {
                // تمكين أحداث جميع المستطيلات
                document.querySelectorAll('rect.image-mapper-shape').forEach(rect => {
                    rect.style.pointerEvents = 'auto';
                });
            }
        });
    }

    // ====================
    // بدء التحميل
    // ====================
    loadImages();

    // ====================
    // تحسين الأداء عند تغيير الحجم
    // ====================
    window.addEventListener('resize', debounce(() => {
        updateDynamicSizes();
        createAllLabels(); // إعادة إنشاء التسميات لتناسب الحجم الجديد
    }, 250));

    // ====================
    // تهيئة أولية
    // ====================
    updateDynamicSizes();
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

// ====================
// دعم requestAnimationFrame
// ====================
if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (function() {
        return window.webkitRequestAnimationFrame ||
               window.mozRequestAnimationFrame ||
               window.oRequestAnimationFrame ||
               window.msRequestAnimationFrame ||
               function(callback) {
                   window.setTimeout(callback, 1000 / 60);
               };
    })();
}